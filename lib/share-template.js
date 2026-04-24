const escapeHtml = require('escape-html');

function renderSharedNotFound() {
  return `
        <!DOCTYPE html>
        <html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
        <title>Nicht gefunden – Dokuvo</title>
        <style>body{font-family:-apple-system,sans-serif;background:#0D0D0D;color:#E8EAED;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
        .box{text-align:center;padding:40px;}.box h1{font-size:2rem;margin-bottom:12px;}.box p{color:#7A7F88;margin-bottom:24px;}
        .box a{color:#3B82F6;text-decoration:none;font-weight:600;}</style>
        </head><body><div class="box"><h1>Nicht gefunden</h1><p>Diese Erklärung existiert nicht oder wurde gelöscht.</p><a href="/">Zurück zu Dokuvo</a></div></body></html>
      `;
}

function renderSharedPage({ title, content, createdAt }) {
  const date = new Date(createdAt).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
  return `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(title)} – Dokuvo</title>
        <meta name="description" content="Erklärung erstellt mit Dokuvo – Komplexe Dokumente einfach verstehen.">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'DM Sans', -apple-system, sans-serif;
            background: #0D0D0D;
            color: #E8EAED;
            line-height: 1.7;
            -webkit-font-smoothing: antialiased;
          }
          .share-header {
            border-bottom: 1px solid #1A1C1F;
            padding: 16px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .share-logo {
            font-weight: 700;
            font-size: 1.1rem;
            color: #E8EAED;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .share-cta {
            padding: 8px 20px;
            background: #3B82F6;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            text-decoration: none;
            transition: background 0.2s;
          }
          .share-cta:hover { background: #2563EB; }
          .share-content {
            max-width: 740px;
            margin: 0 auto;
            padding: 48px 24px 80px;
          }
          .share-title {
            font-size: 1.6rem;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .share-meta {
            color: #6B7280;
            font-size: 0.85rem;
            margin-bottom: 32px;
          }
          .share-body {
            font-size: 1rem;
            line-height: 1.8;
            color: #D1D5DB;
          }
          .share-body h1, .share-body h2, .share-body h3 { color: #E8EAED; margin: 24px 0 12px; }
          .share-body ul, .share-body ol { padding-left: 24px; margin: 12px 0; }
          .share-body li { margin-bottom: 6px; }
          .share-body strong { color: #F1F5F9; }
          .share-body p { margin-bottom: 14px; }
          .share-footer {
            text-align: center;
            padding: 32px 24px;
            border-top: 1px solid #1A1C1F;
            color: #4A4F58;
            font-size: 0.8rem;
          }
          .share-footer a { color: #6B7280; text-decoration: none; }
          .share-footer a:hover { color: #9CA3AF; }
          @media (max-width: 600px) {
            .share-content { padding: 32px 16px 60px; }
            .share-title { font-size: 1.3rem; }
          }
        </style>
      </head>
      <body>
        <header class="share-header">
          <a href="/" class="share-logo">Dokuvo</a>
          <a href="/app" class="share-cta">Selbst ausprobieren</a>
        </header>
        <main class="share-content">
          <h1 class="share-title">${escapeHtml(title)}</h1>
          <div class="share-meta">Erstellt am ${date} mit Dokuvo</div>
          <div class="share-body">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
        </main>
        <footer class="share-footer">
          <p>Erstellt mit <a href="/">Dokuvo</a> — Komplexe Dokumente einfach verstehen</p>
          <p style="margin-top:8px;">Dokuvo ist kein Ersatz für rechtliche, medizinische oder steuerliche Beratung.</p>
        </footer>
      </body>
      </html>
    `;
}

function renderInviteInvalid(appUrl) {
  return `
        <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Einladung ungültig</title>
        <style>body{font-family:system-ui,sans-serif;background:#111214;color:#E8EAED;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
        .card{background:#1A1C1F;border:1px solid #2A2D32;border-radius:16px;padding:40px;max-width:420px;text-align:center;}
        h2{color:#F87171;margin-top:0;}p{color:#7A7F88;line-height:1.6;}
        a{display:inline-block;margin-top:16px;background:#3B82F6;color:white;text-decoration:none;border-radius:8px;padding:12px 24px;font-weight:600;}</style></head>
        <body><div class="card"><h2>Einladung ungültig</h2><p>Diese Einladung ist ungültig oder abgelaufen. Bitte fordere eine neue Einladung an.</p>
        <a href="${appUrl}/app">Zur App</a></div></body></html>`;
}

module.exports = { renderSharedNotFound, renderSharedPage, renderInviteInvalid };
