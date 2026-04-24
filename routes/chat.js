const express = require('express');
const { supabase } = require('../lib/db');
const { verifyUser, checkAndCountUsage } = require('../lib/auth');
const { groq, TEMPLATE_PROMPTS, generiereFollowUps } = require('../lib/llm');

const router = express.Router();

router.post('/chat', verifyUser, async (req, res) => {
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
router.post('/feedback', verifyUser, async (req, res) => {
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
router.delete('/chat/:user_id/:session_id', verifyUser, async (req, res) => {
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
router.get('/chat/:user_id', verifyUser, async (req, res) => {
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

// ── Chat-Suche ───────────────────────────────────────────────────────────────
router.post('/chat/search', verifyUser, async (req, res) => {
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
router.post('/chat/rename', verifyUser, async (req, res) => {
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
router.get('/chat/:user_id/:session_id', verifyUser, async (req, res) => {
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

module.exports = router;
