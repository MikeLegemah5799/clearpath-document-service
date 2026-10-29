// Vercel serverless function: emails the intake form to help@clearpathdocumentservice.com via Google Workspace SMTP.
// Env vars (Vercel project settings): SMTP_USER (the Workspace address), SMTP_PASS (a Google app password).
const nodemailer = require('nodemailer');

const TO = 'help@clearpathdocumentservice.com';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const label = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  // Honeypot: bots fill this in. Pretend success.
  if (body._honey) return res.status(200).json({ ok: true });

  const fields = Object.entries(body)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => [k, (Array.isArray(v) ? v.join(', ') : String(v)).trim()])
    .filter(([, v]) => v);

  if (!fields.length || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({ error: 'Not configured' });
  }

  const text = fields.map(([k, v]) => `${label(k)}: ${v}`).join('\n\n');
  const html = fields
    .map(([k, v]) => `<p><strong>${esc(label(k))}</strong><br>${esc(v).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const replyTo = body.email && /^\S+@\S+\.\S+$/.test(body.email) ? body.email : undefined;

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transport.sendMail({
      from: `Clear Path Website <${process.env.SMTP_USER}>`,
      to: TO,
      replyTo,
      subject: 'New client intake form',
      text,
      html,
    });
  } catch (e) {
    return res.status(502).json({ error: 'Send failed' });
  }
  return res.status(200).json({ ok: true });
};
