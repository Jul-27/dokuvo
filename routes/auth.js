const express = require('express');
const { supabase } = require('../lib/db');
const { AVATAR_EXT_WHITELIST, FREE_LIMIT, verifyUser } = require('../lib/auth');

const router = express.Router();

// ── Status prüfen ─────────────────────────────────────────────────────────────
router.post('/check-status', verifyUser, async (req, res) => {
  const { user_id } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: sessionData } = await supabase.auth.admin.getUserById(user_id);
    const userEmail = sessionData?.user?.email;

    const { data: userData, error } = await supabase
      .from('users')
      .select('plan, created_at')
      .eq('email', userEmail)
      .single();

    const isPremium = !error && userData?.plan === 'premium';

    if (isPremium) {
      return res.json({ remaining: 999, isPremium: true, premiumSince: userData.created_at });
    }

    const { data: usageData } = await supabase
      .from('usage')
      .select('count')
      .eq('user_id', user_id)
      .eq('date', today)
      .single();

    const remaining = FREE_LIMIT - (usageData?.count || 0);
    res.json({ remaining, isPremium: false, premiumSince: null });

  } catch (err) {
    console.error('check-status Fehler:', err.message);
    res.json({ remaining: 5, isPremium: false, premiumSince: null });
  }
});

router.post('/upload-avatar', verifyUser, async (req, res) => {
  const { user_id, image_base64, file_ext } = req.body;
  if (!file_ext || !AVATAR_EXT_WHITELIST.includes(String(file_ext).toLowerCase())) {
    return res.status(400).json({ error: 'Ungültiges Dateiformat' });
  }
  const safeExt = String(file_ext).toLowerCase();
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    const email = userData?.user?.email;
    const fileName = `${user_id}.${safeExt}`;
    const buffer = Buffer.from(image_base64, 'base64');
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, buffer, { contentType: `image/${safeExt}`, upsert: true });
    if (uploadError) return res.status(500).json({ error: uploadError.message });
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    // Zuerst versuchen zu updaten, wenn 0 rows → insert
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) {
      await supabase.from('users').update({ avatar_url: urlData.publicUrl }).eq('email', email);
    } else {
      await supabase.from('users').insert({ id: user_id, email, avatar_url: urlData.publicUrl, plan: 'free' });
    }
    res.json({ avatar_url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Anzeigename speichern ─────────────────────────────────────────────────────
router.post('/update-profile', verifyUser, async (req, res) => {
  const { user_id, display_name } = req.body;
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    const email = userData?.user?.email;
    // Zuerst versuchen zu updaten, wenn 0 rows → insert
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) {
      await supabase.from('users').update({ display_name }).eq('email', email);
    } else {
      await supabase.from('users').insert({ id: user_id, email, display_name, plan: 'free' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Passwort ändern ───────────────────────────────────────────────────────────
router.post('/change-password', verifyUser, async (req, res) => {
  const { user_id, new_password } = req.body;
  try {
    const { error } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Account löschen ───────────────────────────────────────────────────────────
router.post('/delete-account', verifyUser, async (req, res) => {
  const { user_id } = req.body;
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    const email = userData?.user?.email;
    await supabase.from('users').delete().eq('email', email);
    await supabase.from('usage').delete().eq('user_id', user_id);
    await supabase.from('history').delete().eq('user_id', user_id);
    await supabase.from('chats').delete().eq('user_id', user_id);
    await supabase.auth.admin.deleteUser(user_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Profildaten laden ─────────────────────────────────────────────────────────
router.post('/get-profile', verifyUser, async (req, res) => {
  const { user_id } = req.body;
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    const email = userData?.user?.email;
    const { data } = await supabase.from('users').select('display_name, avatar_url, plan, created_at').eq('email', email).single();
    res.json(data || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
