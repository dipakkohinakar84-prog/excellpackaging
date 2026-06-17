import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';

const app = express();
app.use(cors());
app.use(express.json());

const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@excellpackaging.com';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', smtp: SMTP_HOST, port: SMTP_PORT }));

app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, text or html' });
    }
    const t = getTransporter();
    const info = await t.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      text: text || html?.replace(/<[^>]*>/g, '') || '',
      html: html || text?.replace(/\n/g, '<br/>') || '',
    });
    res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.EMAIL_RELAY_PORT || 8092;
app.listen(PORT, () => {
  console.log(`Email relay running on port ${PORT}`);
  console.log(`SMTP: ${SMTP_HOST}:${SMTP_PORT}`);
});
