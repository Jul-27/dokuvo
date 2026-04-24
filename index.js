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

app.use(require('./routes/auth'));
app.use(require('./routes/folders'));
app.use(require('./routes/sharing'));
app.use(require('./routes/reminders'));
app.use(require('./routes/chat'));
app.use(require('./routes/documents'));
app.use(require('./routes/teams'));

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