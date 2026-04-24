const express = require('express');
const multer = require('multer');
const { checkAndCountUsage } = require('../lib/auth');
const {
  groq, SYSTEM_PROMPT, TEMPLATE_PROMPTS,
  extrahiereFristen, generiereFollowUps, analysiereRisiken,
  generiereZusammenfassung, generiereHandlungsempfehlungen,
  extrahiereGlossar, generiereCheckliste, extrahiereAnnotationen,
  berechneStatistiken, extractPdfText,
} = require('../lib/llm');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Dokument hochladen und analysieren ───────────────────────────────────────
router.post('/upload-document', upload.single('document'), async (req, res) => {
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
router.post('/analyze-image', upload.single('image'), async (req, res) => {
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

// ── Dokumente vergleichen ─────────────────────────────────────────────────────
router.post('/compare-documents', upload.fields([{ name: 'doc1' }, { name: 'doc2' }]), async (req, res) => {
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

module.exports = router;
