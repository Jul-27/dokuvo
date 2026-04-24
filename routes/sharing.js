const express = require('express');
const { supabase } = require('../lib/db');
const { verifyUser } = require('../lib/auth');
const { renderSharedPage, renderSharedNotFound } = require('../lib/share-template');

const router = express.Router();

// ── Erklärung teilen (Share erstellen) ───────────────────────────────────────
router.post('/share', verifyUser, async (req, res) => {
  const { user_id, session_id, title, content } = req.body;
  if (!content) return res.status(400).json({ error: 'Kein Inhalt zum Teilen' });

  try {
    const { data, error } = await supabase
      .from('shared_explanations')
      .insert({ user_id, session_id, title: title || 'Dokuvo-Erklärung', content })
      .select('id')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    res.json({ shareUrl: `${baseUrl}/shared/${data.id}`, shareId: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Geteilte Erklärung anzeigen (öffentlich) ─────────────────────────────────
router.get('/shared/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('shared_explanations')
      .select('title, content, created_at')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).send(renderSharedNotFound());
    }

    res.send(renderSharedPage({ title: data.title, content: data.content, createdAt: data.created_at }));
  } catch (err) {
    res.status(500).send('Fehler beim Laden der Erklärung');
  }
});

module.exports = router;
