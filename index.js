const express = require('express');
const helmet = require('helmet');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

const APP_URL = process.env.APP_URL || '${APP_URL}';

const app = express();

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

app.use(require('./routes/auth'));
app.use(require('./routes/folders'));
app.use(require('./routes/sharing'));
app.use(require('./routes/reminders'));
app.use(require('./routes/chat'));
app.use(require('./routes/documents'));
app.use(require('./routes/teams'));
app.use(require('./routes/payments'));

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