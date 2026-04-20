const validator = require('validator');
const { supabase } = require('./db');

const AVATAR_EXT_WHITELIST = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const FREE_LIMIT = 5;

const isUuid = (v) => typeof v === 'string' && validator.isUUID(v);

// ── Auth-Middleware: prüft ob user_id gültig ist ────────────────────────────
async function verifyUser(req, res, next) {
  const user_id = req.body.user_id || req.params.user_id || req.query.user_id || req.headers['x-user-id'];
  if (!user_id) return res.status(401).json({ error: 'Nicht autorisiert' });
  if (!isUuid(user_id)) return res.status(400).json({ error: 'Ungültige user_id' });
  try {
    const { data, error } = await supabase.auth.admin.getUserById(user_id);
    if (error || !data?.user) return res.status(401).json({ error: 'Ungültige Sitzung' });
    req.authUser = data.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentifizierung fehlgeschlagen' });
  }
}

// ── Usage-Limit: prüft und zählt Verbrauch für Free-User ────────────────────
async function checkAndCountUsage(user_id) {
  const today = new Date().toISOString().split('T')[0];
  // Premium-Check
  const { data: sessionData } = await supabase.auth.admin.getUserById(user_id);
  const userEmail = sessionData?.user?.email;
  const { data: userData } = await supabase.from('users').select('plan').eq('email', userEmail).single();
  const isPremium = userData?.plan === 'premium';

  if (isPremium) return { allowed: true, remaining: 999, isPremium: true };

  // Free-User: Verbrauch prüfen
  const { data: usageData } = await supabase.from('usage').select('count').eq('user_id', user_id).eq('date', today).single();
  const count = usageData?.count || 0;

  if (count >= FREE_LIMIT) {
    return { allowed: false, remaining: 0, isPremium: false };
  }

  // Verbrauch hochzählen
  await supabase.from('usage').upsert({ user_id, date: today, count: count + 1 }, { onConflict: 'user_id,date' });
  return { allowed: true, remaining: FREE_LIMIT - count - 1, isPremium: false };
}

module.exports = { AVATAR_EXT_WHITELIST, FREE_LIMIT, isUuid, verifyUser, checkAndCountUsage };
