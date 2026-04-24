const express = require('express');
const { supabase } = require('../lib/db');
const { verifyUser } = require('../lib/auth');

const router = express.Router();

// ── Dokumenten-Ordner ────────────────────────────────────────────────────────
// Ordner auflisten
router.get('/folders/:user_id', verifyUser, async (req, res) => {
  try {
    const { data } = await supabase
      .from('folders')
      .select('id, name, created_at')
      .eq('user_id', req.params.user_id)
      .order('created_at', { ascending: false });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ordner erstellen
router.post('/folders', verifyUser, async (req, res) => {
  const { user_id, name } = req.body;
  try {
    const { data, error } = await supabase
      .from('folders')
      .insert({ user_id, name })
      .select('id, name, created_at')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ordner umbenennen
router.put('/folders/:id', verifyUser, async (req, res) => {
  const { name, user_id } = req.body;
  try {
    await supabase.from('folders').update({ name }).eq('id', req.params.id).eq('user_id', user_id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ordner löschen
router.delete('/folders/:id', verifyUser, async (req, res) => {
  const { user_id } = req.body;
  try {
    await supabase.from('folders').delete().eq('id', req.params.id).eq('user_id', user_id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Chat einem Ordner zuweisen
router.post('/folders/assign', verifyUser, async (req, res) => {
  const { user_id, session_id, folder_id } = req.body;
  try {
    await supabase.from('chat_titles').upsert(
      { user_id, session_id, folder_id },
      { onConflict: 'session_id' }
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Chats in einem Ordner laden (mit Kontext)
router.get('/folders/:folder_id/chats/:user_id', verifyUser, async (req, res) => {
  try {
    const { data: titles } = await supabase
      .from('chat_titles')
      .select('session_id, title')
      .eq('user_id', req.params.user_id)
      .eq('folder_id', req.params.folder_id);

    if (!titles || !titles.length) return res.json([]);

    const sessionIds = titles.map(t => t.session_id);
    const titleMap = {};
    titles.forEach(t => { titleMap[t.session_id] = t.title; });

    const { data: chats } = await supabase
      .from('chats')
      .select('session_id, message, created_at')
      .eq('user_id', req.params.user_id)
      .in('session_id', sessionIds)
      .eq('role', 'user')
      .order('created_at', { ascending: false });

    const sessions = {};
    (chats || []).forEach(row => {
      if (!sessions[row.session_id]) {
        sessions[row.session_id] = {
          session_id: row.session_id,
          title: titleMap[row.session_id] || row.message.substring(0, 60),
          created_at: row.created_at
        };
      }
    });

    res.json(Object.values(sessions));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
