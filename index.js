const express = require('express');
const helmet = require('helmet');
const Stripe = require('stripe');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

const {
  groq,
  SYSTEM_PROMPT,
  TEMPLATE_PROMPTS,
  extrahiereFristen,
  generiereFollowUps,
  analysiereRisiken,
  generiereZusammenfassung,
  generiereHandlungsempfehlungen,
  extrahiereGlossar,
  generiereCheckliste,
  berechneStatistiken,
  extrahiereAnnotationen,
  extractPdfText,
} = require('./lib/llm');
const { supabase } = require('./lib/db');
const { isUuid, verifyUser, checkAndCountUsage } = require('./lib/auth');
const { sendTeamInviteEmail } = require('./lib/email');
const { renderInviteInvalid } = require('./lib/share-template');

const APP_URL = process.env.APP_URL || '${APP_URL}';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://cdnjs.cloudflare.com"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "connect-src": ["'self'", "https://*.supabase.co", "https://api.stripe.com"],
      "frame-src": ["https://js.stripe.com", "https://hooks.stripe.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ── Request Logger (Routen, keine statischen Assets) ───────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (!req.path.startsWith('/public/') && !req.path.match(/\.(css|js|png|jpg|jpeg|svg|ico|woff2?)$/)) {
      const ms = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    }
  });
  next();
});

// Webhook braucht raw body — muss VOR express.json() stehen
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/', (req, res) => {
  const landingPath = path.join(__dirname, 'public', 'landing.html');
  if (fs.existsSync(landingPath)) {
    res.send(fs.readFileSync(landingPath, 'utf8'));
  } else {
    // Fallback: wenn landing.html noch nicht existiert, zeige die App
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    res.send(fs.readFileSync(htmlPath, 'utf8'));
  }
});

app.get('/app', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  res.send(fs.readFileSync(htmlPath, 'utf8'));
});

// Statische Dateien (CSS, Bilder etc.) aus public/ ausliefern
app.use(express.static(path.join(__dirname, 'public')));

// Stripe Webhook
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook Fehler:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'customer.subscription.created') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    const metaUserId = subscription.metadata?.user_id;
    const customer = await stripe.customers.retrieve(customerId);
    const email = customer.email;
    if (metaUserId) {
      await supabase.from('users').upsert({ id: metaUserId, email, plan: 'premium', stripe_customer_id: customerId });
      console.log(`Premium aktiviert für user_id ${metaUserId} (${email})`);
    } else {
      console.error('Webhook: subscription.created ohne metadata.user_id', customerId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    await supabase.from('users').update({ plan: 'free' }).eq('stripe_customer_id', customerId);
    console.log(`Premium deaktiviert für stripe_customer ${customerId}`);
  }

  res.json({ received: true });
});


// ── Dokument hochladen und analysieren ───────────────────────────────────────
app.post('/upload-document', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Kein Dokument hochgeladen' });
  }
  const user_id = req.body.user_id;
  if (user_id) {
    const usage = await checkAndCountUsage(user_id);
    if (!usage.allowed) return res.status(429).json({ error: 'LIMIT_REACHED', remaining: 0 });
  }
  const depth = parseInt(req.body.depth) || 2;
  const template = req.body.template || null;
  const depthInstructions = {
    1: 'Erkläre so einfach wie möglich, als würdest du mit einem Kind sprechen. Kurze Sätze, keine Fachbegriffe.',
    2: 'Erkläre verständlich für jemanden ohne Fachkenntnisse. Fachbegriffe kurz in Klammern erklären.',
    3: 'Erkläre präzise und fachlich korrekt. Fachbegriffe dürfen verwendet werden.'
  };

  try {
    let text = '';

    if (req.file.mimetype === 'application/pdf') {
      try {
        text = await extractPdfText(req.file.buffer);
      } catch (pdfErr) {
        console.error('PDF Parse Fehler:', pdfErr.message);
        return res.status(400).json({
          error: 'PDF konnte nicht gelesen werden. Bitte stelle sicher, dass das PDF Text enthält (kein gescanntes Bild).'
        });
      }
    }

    if (!text || text.trim().length < 10) {
      return res.status(400).json({
        error: 'Kein Text im Dokument gefunden. Falls es ein gescanntes PDF ist, bitte als Foto hochladen.'
      });
    }

    const cleanText = text.replace(/\s+/g, ' ').trim();
    const truncatedText = cleanText.substring(0, 12000);

    // System-Prompt: spezialisiert wenn Template gewählt, sonst Standard
    const uploadSystemPrompt = (template && TEMPLATE_PROMPTS[template])
      ? TEMPLATE_PROMPTS[template] + `\n\nERKLÄRUNGSTIEFE: ${depthInstructions[depth]}\n\n` + SYSTEM_PROMPT.split('PFLICHTREGELN')[1]
      : SYSTEM_PROMPT + `\n\nERKLÄRUNGSTIEFE: ${depthInstructions[depth]}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: uploadSystemPrompt },
        { role: 'user', content: `Analysiere dieses Dokument genau und erkläre mir alle wichtigen Informationen darin. Extrahiere konkret: Fahrzeug- oder Produktdetails, alle Preise und Kosten, alle Fristen und Gültigkeitsdaten, Konditionen und Bedingungen, sowie alle Aktionen oder Rabatte. Erkläre jeden Fachbegriff sofort in Klammern.\n\nDOKUMENT:\n${truncatedText}` }
      ]
    });

    const explanation = completion.choices[0].message.content;
    const statistiken = berechneStatistiken(cleanText);
    const [followUps, fristen, risiken, zusammenfassung, handlungen, glossar, checkliste, annotationen] = await Promise.all([
      generiereFollowUps(explanation),
      extrahiereFristen(truncatedText),
      analysiereRisiken(truncatedText),
      generiereZusammenfassung(truncatedText),
      generiereHandlungsempfehlungen(truncatedText),
      extrahiereGlossar(truncatedText),
      generiereCheckliste(truncatedText),
      extrahiereAnnotationen(truncatedText)
    ]);
    res.json({ explanation, followUps, fristen, risiken, zusammenfassung, handlungen, glossar, checkliste, annotationen, statistiken });

  } catch (error) {
    console.error('Upload Fehler:', error.message);
    res.status(500).json({ error: 'Dokument konnte nicht verarbeitet werden.' });
  }
});

// ── Foto analysieren (Groq Vision) ───────────────────────────────────────────
app.post('/analyze-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Kein Bild hochgeladen' });
  }
  const user_id = req.body.user_id;
  if (user_id) {
    const usage = await checkAndCountUsage(user_id);
    if (!usage.allowed) return res.status(429).json({ error: 'LIMIT_REACHED', remaining: 0 });
  }
  const depth = parseInt(req.body.depth) || 2;
  const templateImg = req.body.template || null;
  const depthInstructions = {
    1: 'Erkläre so einfach wie möglich, als würdest du mit einem Kind sprechen. Kurze Sätze, keine Fachbegriffe.',
    2: 'Erkläre verständlich für jemanden ohne Fachkenntnisse. Fachbegriffe kurz in Klammern erklären.',
    3: 'Erkläre präzise und fachlich korrekt. Fachbegriffe dürfen verwendet werden.'
  };

  try {
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const imgSystemPrompt = (templateImg && TEMPLATE_PROMPTS[templateImg])
      ? TEMPLATE_PROMPTS[templateImg] + `\n\nERKLÄRUNGSTIEFE: ${depthInstructions[depth]}\n\n` + SYSTEM_PROMPT.split('PFLICHTREGELN')[1]
      : SYSTEM_PROMPT + `\n\nERKLÄRUNGSTIEFE: ${depthInstructions[depth]}`;

    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: imgSystemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` }
            },
            {
              type: 'text',
              text: 'Analysiere dieses Bild genau. Falls es Text enthält (Dokument, Brief, Formular, Rechnung usw.), erkläre alle wichtigen Informationen daraus: Preise, Fristen, Bedingungen, Handlungsschritte. Falls es kein Textdokument ist, beschreibe und erkläre was du siehst. Erkläre jeden Fachbegriff sofort in Klammern.'
            }
          ]
        }
      ]
    });

    const explanation = completion.choices[0].message.content;
    const statistiken = berechneStatistiken(explanation);
    const [followUps, fristen, risiken, zusammenfassung, handlungen, glossar, checkliste] = await Promise.all([
      generiereFollowUps(explanation),
      extrahiereFristen(explanation),
      analysiereRisiken(explanation),
      generiereZusammenfassung(explanation),
      generiereHandlungsempfehlungen(explanation),
      extrahiereGlossar(explanation),
      generiereCheckliste(explanation)
    ]);
    res.json({ explanation, followUps, fristen, risiken, zusammenfassung, handlungen, glossar, checkliste, statistiken });

  } catch (error) {
    console.error('Vision Fehler:', error.message);
    res.status(500).json({ error: 'Bild konnte nicht verarbeitet werden.' });
  }
});

// ── Checkout Session erstellen ────────────────────────────────────────────────
app.post('/create-checkout', verifyUser, async (req, res) => {
  const user_id = req.authUser.id;
  const email = req.authUser.email;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/`,
      metadata: { user_id }
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Fehler:', error.message);
    res.status(500).json({ error: 'Checkout konnte nicht erstellt werden.' });
  }
});

// ── Nach erfolgreichem Kauf ───────────────────────────────────────────────────
app.get('/success', async (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'success.html');
  res.send(fs.readFileSync(htmlPath, 'utf8'));
});

// ── Chat ─────────────────────────────────────────────────────────────────────
app.post('/chat', verifyUser, async (req, res) => {
  const { user_id, session_id, message, depth = 2, template } = req.body;
  const depthInstructions = {
    1: 'Erkläre so einfach wie möglich, als würdest du mit einem Kind sprechen. Kurze Sätze, keine Fachbegriffe, nur Alltagssprache und Beispiele aus dem Alltag.',
    2: 'Erkläre verständlich für jemanden ohne Fachkenntnisse. Fachbegriffe kurz in Klammern erklären.',
    3: 'Erkläre präzise und fachlich korrekt. Fachbegriffe dürfen verwendet werden, aber trotzdem klar strukturiert.'
  };

  try {
    const usage = await checkAndCountUsage(user_id);
    if (!usage.allowed) {
      return res.status(429).json({ error: 'LIMIT_REACHED' });
    }

    const { data: history } = await supabase
      .from('chats')
      .select('role, message')
      .eq('user_id', user_id)
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    const messages = (history || []).map(h => ({ role: h.role, content: h.message }));
    messages.push({ role: 'user', content: message });

    await supabase.from('chats').insert({ user_id, session_id, role: 'user', message });

    // System-Prompt: spezialisiert wenn Template gewählt, sonst generisch
    let systemContent = TEMPLATE_PROMPTS[template] || `Du bist Dokuvo, ein KI-Assistent der komplexe Themen und Dokumente erklärt.
Erkenne automatisch die Sprache der Nachricht und antworte in derselben Sprache.`;

    systemContent += `

ERKLÄRUNGSTIEFE: ${depthInstructions[depth] || depthInstructions[2]}

PFLICHTREGELN:
- Hebe wichtige Begriffe mit **fett** hervor
- Beantworte Rückfragen immer im Kontext des bisherigen Gesprächs
- Schreibe kurze, klare Sätze

Wenn es eine erste Erklärung ist, strukturiere sie so:
## Was ist das?
## Die wichtigsten Punkte
## Zusammenfassung

Verwende KEINE Aufzählungszeichen (-) oder Bullet Points (*). Verwende stattdessen nummerierte Absätze oder Fließtext.
Bei Rückfragen antworte natürlich und direkt ohne starre Struktur.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemContent },
        ...messages
      ],
      max_tokens: 1000
    });

    const reply = completion.choices[0].message.content;
    await supabase.from('chats').insert({ user_id, session_id, role: 'assistant', message: reply });

    const followUps = await generiereFollowUps(reply);
    res.json({ reply, session_id, followUps });

  } catch (err) {
    console.error('Chat Fehler:', err.message);
    res.status(500).json({ error: 'Fehler beim Chat' });
  }
});

// ── Feedback ──────────────────────────────────────────────────────────────────
app.post('/feedback', verifyUser, async (req, res) => {
  const { user_id, session_id, message, rating } = req.body;
  try {
    await supabase.from('feedback').insert({ user_id, session_id, message, rating });
    res.json({ ok: true });
  } catch (err) {
    console.error('Feedback Fehler:', err.message);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// ── Chat Session löschen ──────────────────────────────────────────────────────
app.delete('/chat/:user_id/:session_id', verifyUser, async (req, res) => {
  const { user_id, session_id } = req.params;
  try {
    await supabase
      .from('chats')
      .delete()
      .eq('user_id', user_id)
      .eq('session_id', session_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Chat Sessions laden ───────────────────────────────────────────────────────
app.get('/chat/:user_id', verifyUser, async (req, res) => {
  const { user_id } = req.params;
  try {
    const { data } = await supabase
      .from('chats')
      .select('session_id, message, created_at')
      .eq('user_id', user_id)
      .eq('role', 'user')
      .order('created_at', { ascending: false });

    // Custom-Titel laden
    const { data: titles } = await supabase
      .from('chat_titles')
      .select('session_id, title')
      .eq('user_id', user_id);

    const titleMap = {};
    (titles || []).forEach(t => { titleMap[t.session_id] = t.title; });

    const sessions = {};
    (data || []).forEach(row => {
      if (!sessions[row.session_id]) {
        const autoTitle = row.message.substring(0, 60) + (row.message.length > 60 ? '...' : '');
        sessions[row.session_id] = {
          session_id: row.session_id,
          title: titleMap[row.session_id] || autoTitle,
          created_at: row.created_at
        };
      }
    });

    res.json(Object.values(sessions));
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Chats' });
  }
});

// ── Dokumente vergleichen ─────────────────────────────────────────────────────
app.post('/compare-documents', upload.fields([{ name: 'doc1' }, { name: 'doc2' }]), async (req, res) => {
  const user_id = req.body.user_id;
  if (user_id) {
    const usage = await checkAndCountUsage(user_id);
    if (!usage.allowed) return res.status(429).json({ error: 'LIMIT_REACHED', remaining: 0 });
  }
  const depth = parseInt(req.body.depth) || 2;
  const depthInstructions = {
    1: 'Erkläre so einfach wie möglich, kurze Sätze, keine Fachbegriffe.',
    2: 'Erkläre verständlich für jemanden ohne Fachkenntnisse. Fachbegriffe kurz in Klammern erklären.',
    3: 'Erkläre präzise und fachlich korrekt.'
  };

  try {
    const file1 = req.files['doc1']?.[0];
    const file2 = req.files['doc2']?.[0];
    if (!file1 || !file2) return res.status(400).json({ error: 'Zwei Dokumente erforderlich' });

    // Texte extrahieren
    const extractText = async (file) => {
      if (file.mimetype === 'application/pdf') {
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const data = await pdfParse(file.buffer);
        return data.text.replace(/\s+/g, ' ').trim().substring(0, 8000);
      } else {
        // Bild: Groq Vision
        const base64 = file.buffer.toString('base64');
        const completion = await groq.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens: 1000,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${file.mimetype};base64,${base64}` } },
            { type: 'text', text: 'Extrahiere den gesamten Text aus diesem Bild. Gib nur den reinen Text zurück.' }
          ]}]
        });
        return completion.choices[0].message.content.substring(0, 8000);
      }
    };

    const [text1, text2] = await Promise.all([extractText(file1), extractText(file2)]);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: `Du bist Dokuvo, ein KI-Assistent der Dokumente vergleicht und erklärt.
${depthInstructions[depth]}

Strukturiere den Vergleich so:
## Worum geht es bei den Dokumenten?
Kurze Beschreibung was beide Dokumente sind.

## Die wichtigsten Unterschiede
Erkläre die konkreten Unterschiede zwischen den Dokumenten — Preise, Konditionen, Fristen, Inhalte.
Nutze eine klare Gegenüberstellung mit nummerierten Punkten (keine Aufzählungszeichen).

## Was ist besser?
Gib eine ehrliche Einschätzung welches Dokument vorteilhafter ist und warum.

## Zusammenfassung
Ein klarer Satz was die wichtigste Erkenntnis aus dem Vergleich ist.`
        },
        {
          role: 'user',
          content: `Vergleiche diese zwei Dokumente:\n\n--- DOKUMENT 1: ${file1.originalname} ---\n${text1}\n\n--- DOKUMENT 2: ${file2.originalname} ---\n${text2}`
        }
      ]
    });

    const comparison = completion.choices[0].message.content;

    // Diff-Analyse: konkrete Unterschiede als strukturiertes JSON
    let diff = [];
    try {
      const diffCompletion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 600,
        messages: [
          { role: 'system', content: `Erstelle eine strukturierte Gegenüberstellung der beiden Dokumente. Antworte NUR mit einem JSON-Array. Jedes Element hat:
{"kategorie": "z.B. Preis, Laufzeit, Konditionen, Leistung", "dok1": "Wert/Klausel in Dokument 1", "dok2": "Wert/Klausel in Dokument 2", "vorteil": 1|2|0}
vorteil = 1 wenn Dokument 1 besser, 2 wenn Dokument 2 besser, 0 wenn gleichwertig.
Maximal 8 Vergleichspunkte, nur relevante Unterschiede. Keine anderen Texte.` },
          { role: 'user', content: `Vergleiche:\n\n--- DOKUMENT 1 ---\n${text1.substring(0, 4000)}\n\n--- DOKUMENT 2 ---\n${text2.substring(0, 4000)}` }
        ]
      });
      const raw = diffCompletion.choices[0].message.content.trim();
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) diff = JSON.parse(match[0]);
    } catch(e) { /* diff optional */ }

    const [followUps, fristen] = await Promise.all([
      generiereFollowUps(comparison),
      extrahiereFristen(text1 + ' ' + text2)
    ]);

    res.json({ comparison, followUps, fristen, diff, doc1Name: file1.originalname, doc2Name: file2.originalname });

  } catch (err) {
    console.error('Vergleich Fehler:', err.message);
    res.status(500).json({ error: 'Fehler beim Vergleichen' });
  }
});

// ── Chat-Suche ───────────────────────────────────────────────────────────────
app.post('/chat/search', verifyUser, async (req, res) => {
  const { user_id, query } = req.body;
  if (!query || query.trim().length < 2) {
    return res.json([]);
  }
  const searchTerm = `%${query.trim()}%`;

  try {
    // Suche in Chat-Nachrichten
    const { data: chatResults } = await supabase
      .from('chats')
      .select('session_id, message, role, created_at')
      .eq('user_id', user_id)
      .ilike('message', searchTerm)
      .order('created_at', { ascending: false })
      .limit(50);

    // Suche in Chat-Titeln
    const { data: titleResults } = await supabase
      .from('chat_titles')
      .select('session_id, title')
      .eq('user_id', user_id)
      .ilike('title', searchTerm);

    // Alle Titel laden für die Anzeige
    const { data: allTitles } = await supabase
      .from('chat_titles')
      .select('session_id, title')
      .eq('user_id', user_id);

    const titleMap = {};
    (allTitles || []).forEach(t => { titleMap[t.session_id] = t.title; });

    // Ergebnisse zusammenführen (dedupliziert nach session_id)
    const sessionMap = {};

    // Titel-Treffer zuerst
    (titleResults || []).forEach(t => {
      if (!sessionMap[t.session_id]) {
        sessionMap[t.session_id] = {
          session_id: t.session_id,
          title: t.title,
          matchType: 'title',
          matchText: t.title
        };
      }
    });

    // Chat-Treffer
    (chatResults || []).forEach(c => {
      if (!sessionMap[c.session_id]) {
        // Auto-Titel generieren falls kein Custom-Titel
        const autoTitle = titleMap[c.session_id] || c.message.substring(0, 60) + (c.message.length > 60 ? '...' : '');
        const snippet = c.message.length > 100 ? '...' + c.message.substring(0, 100) + '...' : c.message;
        sessionMap[c.session_id] = {
          session_id: c.session_id,
          title: autoTitle,
          matchType: c.role,
          matchText: snippet,
          created_at: c.created_at
        };
      }
    });

    res.json(Object.values(sessionMap).slice(0, 20));
  } catch (err) {
    res.status(500).json({ error: 'Suchfehler: ' + err.message });
  }
});

// ── Chat umbenennen ───────────────────────────────────────────────────────────
app.post('/chat/rename', verifyUser, async (req, res) => {
  const { user_id, session_id, title } = req.body;
  try {
    await supabase.from('chat_titles').upsert(
      { user_id, session_id, title },
      { onConflict: 'session_id' }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Einzelne Chat Session laden ───────────────────────────────────────────────
app.get('/chat/:user_id/:session_id', verifyUser, async (req, res) => {
  const { user_id, session_id } = req.params;
  try {
    // Erst versuchen, eigene Nachrichten zu laden
    let { data } = await supabase
      .from('chats')
      .select('role, message, created_at')
      .eq('user_id', user_id)
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(200);

    // Falls keine eigenen Nachrichten: prüfen ob über Team geteilt
    if (!data || data.length === 0) {
      const { data: share } = await supabase
        .from('team_shares')
        .select('shared_by, team_id')
        .eq('session_id', session_id)
        .limit(1)
        .maybeSingle();
      if (share) {
        // Prüfen ob der User Mitglied des Teams ist
        const { data: membership } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', share.team_id)
          .eq('user_id', user_id)
          .maybeSingle();
        if (membership) {
          const { data: sharedData } = await supabase
            .from('chats')
            .select('role, message, created_at')
            .eq('user_id', share.shared_by)
            .eq('session_id', session_id)
            .order('created_at', { ascending: true })
            .limit(200);
          data = sharedData || [];
        }
      }
    }

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// ── Team-Workspace ───────────────────────────────────────────────────────────

// Team erstellen
app.post('/teams', verifyUser, async (req, res) => {
  const { user_id, name } = req.body;
  if (!name) return res.status(400).json({ error: 'Teamname fehlt' });
  try {
    const { data: team, error } = await supabase
      .from('teams')
      .insert({ name, owner_id: user_id })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await supabase.from('team_members').insert({ team_id: team.id, user_id, email: req.authUser.email, role: 'owner' });
    res.json(team);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Teams des Users laden
app.get('/teams/:user_id', verifyUser, async (req, res) => {
  try {
    const userId = req.params.user_id;
    const userEmail = req.authUser.email;

    // Teams laden über user_id
    const { data: byId, error: e1 } = await supabase
      .from('team_members')
      .select('id, role, user_id, teams(id, name, owner_id, created_at)')
      .eq('user_id', userId);
    if (e1) return res.status(500).json({ error: e1.message });

    // Auch Teams laden wo nur die E-Mail eingetragen ist (user_id noch NULL)
    let byEmail = [];
    if (userEmail) {
      const { data: emailData } = await supabase
        .from('team_members')
        .select('id, role, user_id, teams(id, name, owner_id, created_at)')
        .eq('email', userEmail)
        .is('user_id', null);
      if (emailData?.length) {
        byEmail = emailData;
        // user_id nachträglich setzen für zukünftige Abfragen
        const memberIds = emailData.map(m => m.id);
        await supabase.from('team_members').update({ user_id: userId }).in('id', memberIds);
      }
    }

    // Deduplizieren nach team_id
    const allMembers = [...(byId || []), ...byEmail];
    const seen = new Set();
    const teams = [];
    for (const d of allMembers) {
      if (d.teams && !seen.has(d.teams.id)) {
        seen.add(d.teams.id);
        teams.push({ ...d.teams, role: d.role });
      }
    }

    // Bulk member + shared counts in 2 queries statt 2N
    const teamIds = teams.map(t => t.id);
    const memberCountMap = {};
    const sharedCountMap = {};
    if (teamIds.length) {
      const { data: memberRows } = await supabase
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds);
      for (const row of (memberRows || [])) {
        memberCountMap[row.team_id] = (memberCountMap[row.team_id] || 0) + 1;
      }
      const { data: sharedRows } = await supabase
        .from('team_shares')
        .select('team_id')
        .in('team_id', teamIds);
      for (const row of (sharedRows || [])) {
        sharedCountMap[row.team_id] = (sharedCountMap[row.team_id] || 0) + 1;
      }
    }

    const teamsWithCounts = teams.map(t => ({
      ...t,
      member_count: memberCountMap[t.id] || 0,
      shared_count: sharedCountMap[t.id] || 0
    }));

    res.json(teamsWithCounts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mitglied per E-Mail einladen
app.post('/teams/:id/invite', verifyUser, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-Mail fehlt' });
  try {
    // Prüfen ob der Einladende berechtigt ist (Owner oder can_invite)
    const inviterId = req.authUser.id;
    const { data: inviter } = await supabase.from('team_members')
      .select('id, role, can_invite').eq('team_id', req.params.id).eq('user_id', inviterId).maybeSingle();
    if (!inviter) return res.status(403).json({ error: 'Du bist kein Mitglied dieses Teams' });
    if (inviter.role !== 'owner' && !inviter.can_invite) {
      return res.status(403).json({ error: 'Du hast keine Berechtigung, Mitglieder einzuladen' });
    }

    // Prüfen ob schon per E-Mail eingeladen
    const { data: existingByEmail } = await supabase.from('team_members')
      .select('id').eq('team_id', req.params.id).eq('email', email).maybeSingle();
    if (existingByEmail) return res.status(409).json({ error: 'Diese E-Mail ist bereits eingeladen' });

    // Mitglied eintragen: user_id setzen wenn Supabase-Account existiert, sonst NULL
    let inviteeUserId = null;
    try {
      const { data: inviteeData } = await supabase.auth.admin.getUserByEmail(email);
      if (inviteeData?.user?.id) inviteeUserId = inviteeData.user.id;
    } catch {}
    const insertPayload = { team_id: req.params.id, email, role: 'member' };
    if (inviteeUserId) insertPayload.user_id = inviteeUserId;
    const { error: insertError } = await supabase.from('team_members').insert(insertPayload);
    if (insertError) return res.status(500).json({ error: insertError.message });

    // Team-Name für E-Mail laden
    const { data: teamData } = await supabase.from('teams').select('name').eq('id', req.params.id).single();
    const teamName = teamData?.name || 'einem Dokuvo-Team';

    // Einladungs-E-Mail senden
    try {
      const emailResult = await sendTeamInviteEmail(email, teamName, `${APP_URL}/join-team/${req.params.id}/${encodeURIComponent(email)}`);
      console.log('Resend Result:', JSON.stringify(emailResult.data));
    } catch (mailErr) {
      console.error('Einladungs-E-Mail Fehler:', mailErr.message);
      if (mailErr.response) console.error('Resend Error Details:', JSON.stringify(mailErr.response.data));
    }

    res.json({ success: true, email, message: 'Einladung gesendet' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Team-Mitglieder laden
app.get('/teams/:id/members', verifyUser, async (req, res) => {
  try {
    const { data, error } = await supabase.from('team_members')
      .select('id, user_id, email, role, can_invite, created_at')
      .eq('team_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Team-Mitglied entfernen
app.delete('/teams/:id/members/:memberId', verifyUser, async (req, res) => {
  try {
    // Nur Owner darf entfernen
    const userId = req.authUser.id;
    const { data: ownerCheck } = await supabase.from('team_members')
      .select('id').eq('team_id', req.params.id).eq('user_id', userId).eq('role', 'owner').maybeSingle();
    if (!ownerCheck) return res.status(403).json({ error: 'Nur der Eigentümer kann Mitglieder entfernen' });

    const { error } = await supabase.from('team_members')
      .delete().eq('id', req.params.memberId).eq('team_id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Einladeberechtigung eines Mitglieds togglen (nur Owner)
app.patch('/teams/:id/members/:memberId/can-invite', verifyUser, async (req, res) => {
  try {
    const userId = req.authUser.id;
    const { data: ownerCheck } = await supabase.from('team_members')
      .select('id').eq('team_id', req.params.id).eq('user_id', userId).eq('role', 'owner').maybeSingle();
    if (!ownerCheck) return res.status(403).json({ error: 'Nur der Owner kann Berechtigungen ändern' });

    const { can_invite } = req.body;
    const { error } = await supabase.from('team_members')
      .update({ can_invite: !!can_invite })
      .eq('id', req.params.memberId).eq('team_id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, can_invite: !!can_invite });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Chat-Session mit Team teilen
app.post('/teams/:id/share', verifyUser, async (req, res) => {
  const { user_id, session_id, note } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id fehlt' });
  try {
    // Prüfen ob Mitglied
    const { data: member } = await supabase.from('team_members')
      .select('id').eq('team_id', req.params.id).eq('user_id', user_id).single();
    if (!member) return res.status(403).json({ error: 'Kein Mitglied dieses Teams' });

    const { data, error } = await supabase.from('team_shares')
      .insert({ team_id: req.params.id, session_id, shared_by: user_id, note: note || null })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Geteilte Sessions im Team laden
app.get('/teams/:id/shared', verifyUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('team_shares')
      .select('id, session_id, note, shared_by, created_at')
      .eq('team_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Titel aus chat_titles laden
    const sessionIds = (data || []).map(d => d.session_id);
    const { data: titles } = sessionIds.length
      ? await supabase.from('chat_titles').select('session_id, title').in('session_id', sessionIds)
      : { data: [] };
    const titleMap = {};
    (titles || []).forEach(t => { titleMap[t.session_id] = t.title; });

    const result = (data || []).map(d => ({ ...d, title: titleMap[d.session_id] || d.session_id }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Team beitreten via E-Mail-Link (öffentlich, kein Auth)
app.get('/join-team/:teamId/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const { data: member } = await supabase.from('team_members')
      .select('id, user_id, teams(name)')
      .eq('team_id', req.params.teamId)
      .eq('email', email)
      .maybeSingle();
    if (!member) {
      return res.status(404).send(renderInviteInvalid(APP_URL));
    }

    // user_id zuweisen falls der User inzwischen einen Account hat
    if (!member.user_id) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserByEmail(email);
        if (userData?.user?.id) {
          await supabase.from('team_members').update({ user_id: userData.user.id }).eq('id', member.id);
        }
      } catch {}
    }

    const teamName = member.teams?.name || 'dem Team';
    res.redirect(`${APP_URL}/app?joined=${encodeURIComponent(teamName)}`);
  } catch (err) { res.status(500).send('Serverfehler'); }
});

// Team löschen (nur Owner)
app.delete('/teams/:id', verifyUser, async (req, res) => {
  try {
    const userId = req.authUser.id;
    const { data: team } = await supabase.from('teams')
      .select('owner_id').eq('id', req.params.id).single();
    if (!team) return res.status(404).json({ error: 'Team nicht gefunden' });
    if (team.owner_id !== userId) return res.status(403).json({ error: 'Nur der Eigentümer kann das Team löschen' });

    // team_members und team_shares werden per CASCADE gelöscht
    const { error } = await supabase.from('teams').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use(require('./routes/auth'));
app.use(require('./routes/folders'));
app.use(require('./routes/sharing'));
app.use(require('./routes/reminders'));

// ── 404 Handler (alle nicht gematchten Routen) ──────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global Error Handler (fängt ungecatchte Fehler aus Routes/Middleware) ───
app.use((err, req, res, next) => {
  console.error('Unhandled error:', req.method, req.path, err.message, err.stack);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Interner Serverfehler' });
});

app.listen(3000, () => {
  console.log('Dokuvo läuft auf Port 3000');
});

module.exports = app;