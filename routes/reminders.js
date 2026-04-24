const express = require('express');
const { supabase } = require('../lib/db');
const { verifyUser } = require('../lib/auth');
const { sendReminderEmail } = require('../lib/email');

const router = express.Router();

// ── Google Token erneuern ─────────────────────────────────────────────────────
let googleAccessToken = process.env.GOOGLE_ACCESS_TOKEN;

async function erneuereGoogleToken() {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });
    const data = await res.json();
    if (data.access_token) {
      googleAccessToken = data.access_token;
      return true;
    }
    return false;
  } catch(e) {
    return false;
  }
}

// ── Fristen-Alarm via Google Calendar ────────────────────────────────────────
router.post('/kalender-alarm', verifyUser, async (req, res) => {
  const { titel, datum, beschreibung } = req.body;
  try {
    const startDate = new Date(datum);
    startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(10, 0, 0, 0);

    const event = {
      summary: `⏰ ${titel}`,
      description: `${beschreibung}\n\nErstellt von Dokuvo`,
      start: { dateTime: startDate.toISOString(), timeZone: 'Europe/Vienna' },
      end: { dateTime: endDate.toISOString(), timeZone: 'Europe/Vienna' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 24 * 60 },
          { method: 'email', minutes: 24 * 60 }
        ]
      }
    };

    const kalenderRequest = async (token) => {
      return fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(event)
      });
    };

    let gcalRes = await kalenderRequest(googleAccessToken);

    // Token abgelaufen → erneuern und nochmal versuchen
    if (gcalRes.status === 401) {
      const erneuert = await erneuereGoogleToken();
      if (erneuert) {
        gcalRes = await kalenderRequest(googleAccessToken);
      }
    }

    if (gcalRes.ok) {
      const data = await gcalRes.json();
      res.json({ success: true, eventId: data.id });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error('Kalender Fehler:', err.message);
    res.json({ success: false });
  }
});

// Erinnerung erstellen
router.post('/reminders', verifyUser, async (req, res) => {
  const { user_id, title, due_date, description, email } = req.body;
  if (!user_id || !title || !due_date || !email) return res.status(400).json({ error: 'Pflichtfelder fehlen' });
  try {
    const { data, error } = await supabase
      .from('reminders')
      .insert({ user_id, title, due_date, description, email, notified: false })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // E-Mail sofort schicken wenn Datum heute ist
    const today = new Date().toISOString().split('T')[0];
    if (due_date === today) {
      await sendReminderEmail(email, title, due_date, description);
      await supabase.from('reminders').update({ notified: true }).eq('id', data.id);
    }

    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Erinnerungen laden
router.get('/reminders/:user_id', verifyUser, async (req, res) => {
  try {
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', req.params.user_id)
      .order('due_date', { ascending: true });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Erinnerung löschen
router.delete('/reminders/:id', verifyUser, async (req, res) => {
  const { user_id } = req.body;
  try {
    await supabase.from('reminders').delete().eq('id', req.params.id).eq('user_id', user_id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cron-Endpoint: fällige Erinnerungen versenden — täglich 07:00 UTC via Vercel Cron
router.post('/reminders/notify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data: due } = await supabase
      .from('reminders')
      .select('*')
      .lte('due_date', today)
      .eq('notified', false);
    await Promise.all((due || []).map(async r => {
      try {
        await sendReminderEmail(r.email, r.title, r.due_date, r.description);
        await supabase.from('reminders').update({ notified: true }).eq('id', r.id);
      } catch (e) {
        console.error('E-Mail Fehler für Reminder', r.id, e.message);
      }
    }));
    res.json({ notified: (due || []).length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
