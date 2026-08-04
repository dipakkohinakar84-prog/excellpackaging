import cors from 'cors';
import express from 'express';
import nodemailer from 'nodemailer';
import PocketBase from 'pocketbase';
import webpush from 'web-push';

const port = Number(process.env.PORT || process.env.PUSH_RELAY_PORT || 8091);
const pocketBaseUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL || '';
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD || '';
const mailApiKey = process.env.MAIL_API_KEY || '';
const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = String(process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false';
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpFromName = process.env.SMTP_FROM_NAME || 'Excell Packaging';
const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser;
const smtpReplyTo = process.env.SMTP_REPLY_TO || 'support@excellpackaging.in';
const websiteEnquiryTo = process.env.WEBSITE_ENQUIRY_TO || smtpReplyTo;

const pushEnabled = Boolean(vapidPublicKey && vapidPrivateKey);
const mailEnabled = Boolean(smtpUser && smtpPass && smtpFromEmail);

if (!pushEnabled) {
  console.warn('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY. Push sends will fail until configured.');
} else {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

if (!mailEnabled) {
  console.warn('Missing SMTP_USER, SMTP_PASS, or SMTP_FROM_EMAIL. Order email sends will fail until configured.');
}

const mailTransporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
});

const websiteEnquiryHits = new Map();
const websiteEnquiryWindowMs = 15 * 60 * 1000;
const websiteEnquiryMaxHits = 5;

const normalizeDepartment = (dept = '') => {
  const normalized = dept.trim().toLowerCase().replace(/[^a-z]/g, '_').replace(/_+/g, '_');
  const map = {
    wood_work: 'Wood_Work',
    woodwork: 'Wood_Work',
    plywood: 'Plywood',
    corrugation: 'Corrugation',
    trading_consumables: 'Trading_Consumables',
    trading_consumable: 'Trading_Consumables',
    quality_control: 'Quality_Control',
    quality: 'Quality_Control',
    qc: 'Quality_Control',
    dispatch: 'Dispatch',
    despatch: 'Dispatch',
    office: 'Office',
  };
  return map[normalized] || dept;
};

const escapeFilterValue = (value) => JSON.stringify(String(value));

const describeError = (error) => ({
  message: error?.message || 'Unknown error',
  status: error?.status || error?.statusCode || null,
  response: error?.response || error?.data || null,
});

const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildOrderMail = ({ type, erpOrderId, itemName, qty, etd, dispatchedDate }) => {
  const orderIdText = erpOrderId ? `#${erpOrderId}` : '-';
  const safeItemName = itemName || '-';
  const safeQty = qty ?? '-';
  const safeEtd = etd || '-';
  const safeDispatchedDate = dispatchedDate || '-';

  const config = {
    accepted: {
      subject: `Order Accepted - ERP Order ${orderIdText}`,
      intro: 'Your order has been accepted.',
    },
    received: {
      subject: `Order Received - ERP Order ${orderIdText}`,
      intro: 'Your order has been received.',
    },
    dispatched: {
      subject: `Order Dispatched - ERP Order ${orderIdText}`,
      intro: 'Your order has been dispatched.',
    },
  }[type];

  if (!config) return null;

  const lines = [
    'Dear Customer,',
    '',
    config.intro,
    '',
    `ERP Order ID: ${orderIdText}`,
    `Item Name: ${safeItemName}`,
    `Quantity: ${safeQty}`,
    `ETD: ${safeEtd}`,
  ];

  if (type === 'dispatched') lines.push(`Dispatched Date: ${safeDispatchedDate}`);

  lines.push('', 'Thank you,', 'Excell Packaging');

  const rows = [
    ['ERP Order ID', orderIdText],
    ['Item Name', safeItemName],
    ['Quantity', safeQty],
    ['ETD', safeEtd],
  ];
  if (type === 'dispatched') rows.push(['Dispatched Date', safeDispatchedDate]);

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <p>Dear Customer,</p>
      <p>${escapeHtml(config.intro)}</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
        ${rows.map(([label, value]) => `<tr><td style="font-weight:700;color:#334155">${escapeHtml(label)}:</td><td>${escapeHtml(value)}</td></tr>`).join('')}
      </table>
      <p>Thank you,<br/>Excell Packaging</p>
    </div>
  `;

  return { subject: config.subject, text: lines.join('\n'), html };
};

const buildWebsiteEnquiryMail = ({ name, company, email, quantity, product, message }) => {
  const safeName = String(name || '').trim();
  const safeCompany = String(company || '').trim() || '-';
  const safeEmail = String(email || '').trim();
  const safeQuantity = String(quantity || '').trim() || '-';
  const safeProduct = String(product || '').trim() || '-';
  const safeMessage = String(message || '').trim();

  const rows = [
    ['Name', safeName],
    ['Company', safeCompany],
    ['Email', safeEmail],
    ['Quantity', safeQuantity],
    ['Product Requirement', safeProduct],
  ];

  const text = [
    'New website enquiry received.',
    '',
    `Name: ${safeName}`,
    `Company: ${safeCompany}`,
    `Email: ${safeEmail}`,
    `Quantity: ${safeQuantity}`,
    `Product Requirement: ${safeProduct}`,
    '',
    'Message:',
    safeMessage,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <h2 style="margin:0 0 12px">New website enquiry</h2>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
        ${rows.map(([label, value]) => `<tr><td style="font-weight:700;color:#334155">${escapeHtml(label)}:</td><td>${escapeHtml(value)}</td></tr>`).join('')}
      </table>
      <p style="font-weight:700;color:#334155;margin:18px 0 6px">Message:</p>
      <p style="white-space:pre-wrap;margin:0">${escapeHtml(safeMessage)}</p>
    </div>
  `;

  return { subject: `Website Enquiry - ${safeProduct}`, text, html };
};

const isWebsiteEnquiryRateLimited = (req) => {
  const key = req.ip || req.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const hits = (websiteEnquiryHits.get(key) || []).filter((timestamp) => now - timestamp < websiteEnquiryWindowMs);
  hits.push(now);
  websiteEnquiryHits.set(key, hits);
  return hits.length > websiteEnquiryMaxHits;
};

const buildDepartmentFilter = (departments) => {
  const departmentFilter = departments.map((department) => `department = ${escapeFilterValue(department)}`).join(' || ');
  return `is_active = true && (${departmentFilter})`;
};

const authenticatePocketBase = async (pb) => {
  if (!adminEmail || !adminPassword || pb.authStore.isValid) return;
  try {
    await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
  } catch (superuserError) {
    try {
      await pb.admins.authWithPassword(adminEmail, adminPassword);
    } catch (adminError) {
      console.warn('PocketBase admin auth failed; continuing with public API rules.', describeError(adminError || superuserError));
    }
  }
};

const authorizeOrderEmailRequest = async (req) => {
  if (mailApiKey && req.get('x-mail-api-key') === mailApiKey) return true;

  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return false;

  const pb = new PocketBase(pocketBaseUrl);
  pb.autoCancellation(false);
  pb.authStore.save(token, null);

  try {
    const auth = await pb.collection('erp_users').authRefresh({ requestKey: null });
    return auth?.record?.collectionName === 'erp_users';
  } catch (_error) {
    return false;
  }
};

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: 'push-mail-2026-08-04', pocketBaseUrl, pushEnabled, mailEnabled });
});

app.post('/api/send-website-enquiry', async (req, res) => {
  try {
    if (!mailEnabled) {
      res.status(500).json({ error: 'Mail is not configured. Set SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL.' });
      return;
    }

    if (isWebsiteEnquiryRateLimited(req)) {
      res.status(429).json({ error: 'Too many enquiries. Please try again later.' });
      return;
    }

    const { name, company, email, quantity, product, message, website } = req.body || {};

    if (website) {
      res.json({ ok: true });
      return;
    }

    const senderEmail = String(email || '').trim();
    const senderName = String(name || '').trim();
    const enquiryMessage = String(message || '').trim();

    if (!senderName || senderName.length > 120) {
      res.status(400).json({ error: 'Valid name is required.' });
      return;
    }
    if (!isValidEmail(senderEmail)) {
      res.status(400).json({ error: 'Valid email is required.' });
      return;
    }
    if (!enquiryMessage || enquiryMessage.length > 5000) {
      res.status(400).json({ error: 'Valid message is required.' });
      return;
    }

    const mail = buildWebsiteEnquiryMail({ name, company, email, quantity, product, message });
    const info = await mailTransporter.sendMail({
      from: `${smtpFromName} <${smtpFromEmail}>`,
      replyTo: `${senderName} <${senderEmail}>`,
      to: websiteEnquiryTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    res.json({ ok: true, messageId: info.messageId });
  } catch (error) {
    console.error('Website enquiry email failed:', describeError(error));
    res.status(500).json({ error: error?.message || 'Website enquiry email failed' });
  }
});

app.post('/api/send-order-email', async (req, res) => {
  try {
    if (!mailEnabled) {
      res.status(500).json({ error: 'Mail is not configured. Set SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL.' });
      return;
    }
    const authorized = await authorizeOrderEmailRequest(req);
    if (!authorized) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { type, to, erpOrderId, itemName, qty, etd, dispatchedDate } = req.body || {};
    const recipient = String(to || '').trim();
    if (!isValidEmail(recipient)) {
      res.status(400).json({ error: 'Valid recipient email is required.' });
      return;
    }

    const mail = buildOrderMail({ type, erpOrderId, itemName, qty, etd, dispatchedDate });
    if (!mail) {
      res.status(400).json({ error: 'Invalid email type.' });
      return;
    }

    const info = await mailTransporter.sendMail({
      from: `${smtpFromName} <${smtpFromEmail}>`,
      replyTo: smtpReplyTo,
      to: recipient,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    res.json({ ok: true, messageId: info.messageId });
  } catch (error) {
    console.error('Order email failed:', describeError(error));
    res.status(500).json({ error: error?.message || 'Order email failed' });
  }
});

app.post('/api/send-push', async (req, res) => {
  const pb = new PocketBase(pocketBaseUrl);
  pb.autoCancellation(false);

  try {
    await authenticatePocketBase(pb);

    if (!pushEnabled) {
      res.status(500).json({ error: 'Push is not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.' });
      return;
    }

    const title = req.body?.title || 'Work Update';
    const message = req.body?.body || 'You have a new update';
    const workOrderId = req.body?.workOrderId;
    const actor = req.body?.actor || '';
    const rawDepartments = Array.isArray(req.body?.departments) ? req.body.departments : [];
    const departments = Array.from(new Set(rawDepartments.map(normalizeDepartment).filter(Boolean)));

    if (departments.length === 0) {
      res.status(400).json({ error: 'No departments provided' });
      return;
    }

    const subscriptions = await pb.collection('push_subscriptions').getFullList({
      filter: buildDepartmentFilter(departments),
      requestKey: null,
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const pushPayload = JSON.stringify({
        title,
        body: message,
        icon: '/app-icon.svg',
        badge: '/app-icon.svg',
        requireInteraction: true,
        timestamp: Date.now(),
        actions: [
          { action: 'open', title: 'Open ERP' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
        vibrate: [120, 60, 120],
        data: {
          workOrderId,
          url: '/',
          tag: workOrderId ? `wo-${workOrderId}` : undefined,
        },
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload,
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await pb.collection('push_subscriptions').update(sub.id, { is_active: false }, { requestKey: null });
        }
      }
    }

    await pb.collection('notification_events').create(
      {
        title,
        body: message,
        actor,
        departments,
        work_order_id: workOrderId || null,
        event_time: new Date().toISOString(),
        sent,
        failed,
        targets: subscriptions.length,
      },
      { requestKey: null },
    );

    res.json({ sent, failed, targets: subscriptions.length, departments });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Push relay failed' });
  }
});

app.listen(port, () => {
  console.log(`PocketBase push relay listening on http://127.0.0.1:${port}`);
  console.log('Relay features: send-push; PocketBase admin auth is optional when API rules are open.');
});
