const express = require('express');
const helmet = require('helmet');
const Stripe = require('stripe');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

const { supabase } = require('./lib/db');
const { isUuid, verifyUser } = require('./lib/auth');
const { sendTeamInviteEmail } = require('./lib/email');
const { renderInviteInvalid } = require('./lib/share-template');

const APP_URL = process.env.APP_URL || '${APP_URL}';

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
app.use(require('./routes/chat'));
app.use(require('./routes/documents'));

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