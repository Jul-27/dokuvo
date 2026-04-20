const axios = require('axios');

async function sendReminderEmail(email, title, due_date, description) {
  const datumFormatiert = new Date(due_date + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  await axios.post('https://api.resend.com/emails', {
    from: 'Dokuvo <onboarding@resend.dev>',
    to: email,
    subject: `Erinnerung: ${title}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;padding:32px 28px;">
        <h2 style="color:#3B82F6;margin-top:0;">Frist-Erinnerung</h2>
        <p>Wir erinnern dich an eine bevorstehende Frist:</p>
        <div style="background:#f4f4f5;border-left:3px solid #3B82F6;border-radius:8px;padding:16px 18px;margin:20px 0;">
          <div style="font-weight:600;font-size:1rem;">${title}</div>
          ${description ? `<div style="color:#6b7280;font-size:0.9rem;margin-top:6px;">${description}</div>` : ''}
          <div style="color:#d97706;font-size:0.85rem;margin-top:10px;">Fälligkeitsdatum: <strong>${datumFormatiert}</strong></div>
        </div>
        <p style="color:#6b7280;font-size:0.85rem;">Diese Erinnerung wurde in Dokuvo gesetzt.</p>
      </div>
    `
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
}

async function sendTeamInviteEmail(email, teamName, joinUrl) {
  return axios.post('https://api.resend.com/emails', {
    from: 'Dokuvo <onboarding@resend.dev>',
    to: email,
    subject: `Du wurdest zum Team "${teamName}" eingeladen`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;padding:32px 28px;">
        <h2 style="color:#3B82F6;margin-top:0;">Team-Einladung</h2>
        <p>Du wurdest eingeladen, dem Team <strong>${teamName}</strong> auf Dokuvo beizutreten.</p>
        <div style="background:#f4f4f5;border-left:3px solid #3B82F6;border-radius:8px;padding:16px 18px;margin:20px 0;">
          <div style="font-weight:600;font-size:1rem;">Team: ${teamName}</div>
          <div style="color:#6b7280;font-size:0.9rem;margin-top:6px;">Melde dich bei Dokuvo an, um dem Team beizutreten und gemeinsam Dokumente zu analysieren.</div>
        </div>
        <a href="${joinUrl}" style="display:inline-block;background:#3B82F6;color:white;text-decoration:none;border-radius:8px;padding:12px 24px;font-weight:600;margin-top:8px;">Team beitreten</a>
        <p style="color:#6b7280;font-size:0.85rem;margin-top:24px;">Diese Einladung wurde über Dokuvo versendet.</p>
      </div>
    `
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
}

module.exports = { sendReminderEmail, sendTeamInviteEmail };
