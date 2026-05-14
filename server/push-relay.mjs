import cors from 'cors';
import express from 'express';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
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
const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = String(process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false';
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const mailFrom = process.env.MAIL_FROM || smtpUser;
const mailFromName = process.env.MAIL_FROM_NAME || 'Excell Packaging ERP';
const mailReplyTo = process.env.MAIL_REPLY_TO || mailFrom;
const imapHost = process.env.IMAP_HOST || '';
const imapPort = Number(process.env.IMAP_PORT || 993);
const imapSecure = String(process.env.IMAP_SECURE || 'true').toLowerCase() !== 'false';
const imapUser = process.env.IMAP_USER || smtpUser;
const imapPass = process.env.IMAP_PASS || smtpPass;
const inboundDepartment = process.env.INBOUND_DEPARTMENT || 'Office';
const inboundSenderUserId = Number(process.env.INBOUND_SENDER_USER_ID || 1);
const mailSyncIntervalMs = Number(process.env.MAIL_SYNC_INTERVAL_MS || 30000);
const mailSyncLookbackDays = Math.max(1, Number(process.env.MAIL_SYNC_LOOKBACK_DAYS || 2));
const mailSyncFetchLimit = Math.min(100, Math.max(10, Number(process.env.MAIL_SYNC_FETCH_LIMIT || 50)));
const autoSyncInbox = String(process.env.AUTO_SYNC_INBOX || 'true').toLowerCase() !== 'false';

const pushEnabled = Boolean(vapidPublicKey && vapidPrivateKey);

if (!pushEnabled) {
  console.warn('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY. Push sends will fail until configured.');
} else {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

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

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const getMailer = () => {
  if (!smtpHost || !smtpUser || !smtpPass || !mailFrom) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM.');
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
};

const toMailAttachments = (attachments = []) => attachments
  .filter((attachment) => attachment?.name && attachment?.data_url)
  .map((attachment) => {
    const dataUrl = String(attachment.data_url);
    const base64 = dataUrl.includes(',') ? dataUrl.split(',').pop() : dataUrl;
    return {
      filename: String(attachment.name),
      content: Buffer.from(base64 || '', 'base64'),
      contentType: attachment.type || undefined,
    };
  });

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getImapClient = () => {
  if (!imapHost || !imapUser || !imapPass) {
    throw new Error('IMAP is not configured. Set IMAP_HOST, IMAP_USER, and IMAP_PASS.');
  }

  return new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapSecure,
    auth: {
      user: imapUser,
      pass: imapPass,
    },
    logger: false,
  });
};

const toDataUrlAttachments = (attachments = []) => attachments
  .filter((attachment) => attachment?.filename && attachment?.content?.length && attachment.content.length <= 2 * 1024 * 1024)
  .slice(0, 5)
  .map((attachment) => ({
    name: attachment.filename,
    size: attachment.content.length,
    type: attachment.contentType || 'application/octet-stream',
    data_url: `data:${attachment.contentType || 'application/octet-stream'};base64,${attachment.content.toString('base64')}`,
  }));

const trimForPocketBaseText = (value, max = 5000) => {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max - 40)}\n\n[Message truncated in ERP mailbox]` : text;
};

const getNextLegacyId = async (pb, collectionName) => {
  const records = await pb.collection(collectionName).getFullList({ fields: 'legacy_id', requestKey: null });
  const highest = records.reduce((max, record) => Math.max(max, Number(record.legacy_id || 0)), 0);
  return highest > 0 ? highest + 1 : 1;
};

const describeError = (error) => ({
  message: error?.message || 'Unknown error',
  status: error?.status || error?.statusCode || null,
  response: error?.response || error?.data || null,
});

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

let inboxSyncRunning = false;
let lastInboxSync = null;

const syncInbox = async ({ limit = 25, source = 'manual' } = {}) => {
  if (inboxSyncRunning) return { imported: 0, skipped: 0, checked: 0, errors: [], running: true, source };

  const pb = new PocketBase(pocketBaseUrl);
  pb.autoCancellation(false);
  let client;
  let step = 'initializing';
  inboxSyncRunning = true;

  try {
    step = 'configuring IMAP client';
    client = getImapClient();
    step = 'authenticating PocketBase admin';
    await authenticatePocketBase(pb);
    step = 'connecting to IMAP';
    await client.connect();

    const cappedLimit = Math.min(Number(limit || mailSyncFetchLimit), mailSyncFetchLimit);
    step = 'loading customers';
    let customers = [];
    try {
      customers = await pb.collection('customers').getFullList({ requestKey: null });
    } catch (error) {
      console.warn('Customer matching skipped during inbox sync.', describeError(error));
    }
    const customersByEmail = new Map(customers
      .filter((customer) => customer.email || customer.contact)
      .map((customer) => [normalizeEmail(customer.email || customer.contact), customer]));

    let imported = 0;
    let skipped = 0;
    let checked = 0;
    const errors = [];
    step = 'locking inbox';
    const lock = await client.getMailboxLock('INBOX');

    try {
      const mailboxSize = Number(client.mailbox?.exists || 0);
      if (mailboxSize === 0) {
        lastInboxSync = { at: new Date().toISOString(), imported, skipped, checked, errors: errors.length, source };
        return { imported, skipped, checked, errors, running: false, source, lastSync: lastInboxSync };
      }

      const fromSeq = Math.max(1, mailboxSize - cappedLimit + 1);
      step = `fetching latest inbox messages ${fromSeq}:*`;
      for await (const message of client.fetch(`${fromSeq}:*`, { uid: true, envelope: true, source: true, internalDate: true })) {
        if (checked >= cappedLimit) break;
        checked += 1;

        try {
          step = `parsing message ${message.uid}`;
          const parsed = await simpleParser(message.source);
          const fromAddress = parsed.from?.value?.[0];
          const fromEmail = normalizeEmail(fromAddress?.address);
          const externalMessageId = parsed.messageId || `${fromEmail}-${message.uid}`;

          if (!isEmail(fromEmail)) {
            skipped += 1;
            continue;
          }

          const existing = await pb.collection('mailbox_messages').getFirstListItem(
            `external_message_id = ${escapeFilterValue(externalMessageId)}`,
            { requestKey: null },
          ).catch(() => null);

          if (existing) {
            skipped += 1;
            continue;
          }

          const matchedCustomer = customersByEmail.get(fromEmail);
          const body = trimForPocketBaseText(parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') || '(No message body)');
          step = `creating mailbox message for ${fromEmail}`;
          await pb.collection('mailbox_messages').create({
            legacy_id: await getNextLegacyId(pb, 'mailbox_messages'),
            subject: trimForPocketBaseText(parsed.subject || '(No subject)', 500),
            body,
            sender_user_id: inboundSenderUserId,
            sender_name: fromAddress?.name || matchedCustomer?.name || fromEmail,
            recipient_user_ids: [],
            recipient_customer_ids: matchedCustomer?.legacy_id ? [Number(matchedCustomer.legacy_id)] : [],
            recipient_departments: [normalizeDepartment(inboundDepartment)],
            read_by_user_ids: [],
            attachments: toDataUrlAttachments(parsed.attachments || []),
            priority: 'normal',
            delivery_status: 'inbound_received',
            direction: 'inbound',
            external_message_id: externalMessageId,
            from_email: fromEmail,
            from_name: fromAddress?.name || '',
            to_email: parsed.to?.value?.map((item) => item.address).filter(Boolean).join(', ') || imapUser,
            sent_at: parsed.date?.toISOString?.() || message.internalDate?.toISOString?.() || new Date().toISOString(),
          }, { requestKey: null });

          imported += 1;
        } catch (error) {
          const detail = describeError(error);
          errors.push({ step, ...detail });
          console.error('Inbox message import failed:', { step, ...detail });
        }
      }
    } finally {
      lock.release();
    }

    lastInboxSync = { at: new Date().toISOString(), imported, skipped, checked, errors: errors.length, source };
    return { imported, skipped, checked, errors, running: false, source, lastSync: lastInboxSync };
  } catch (error) {
    const detail = describeError(error);
    console.error('Inbox sync failed:', { step, ...detail });
    throw Object.assign(new Error(detail.message || 'Inbox sync failed'), { step, detail });
  } finally {
    if (client) await client.logout().catch(() => null);
    inboxSyncRunning = false;
  }
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: 'mail-sync-latest-inbox-2026-05-07', pocketBaseUrl, autoSyncInbox, mailSyncIntervalMs, mailSyncLookbackDays, mailSyncFetchLimit, lastInboxSync });
});

app.post('/api/send-mail', async (req, res) => {
  try {
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();
    const senderName = String(req.body?.senderName || mailFromName).trim();
    const recipients = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    const validRecipients = recipients
      .map((recipient) => ({
        name: String(recipient?.name || '').trim(),
        email: String(recipient?.email || '').trim(),
      }))
      .filter((recipient) => isEmail(recipient.email));

    if (!subject || !body) {
      res.status(400).json({ error: 'Subject and body are required' });
      return;
    }

    if (validRecipients.length === 0) {
      res.status(400).json({ error: 'No valid recipient emails provided' });
      return;
    }

    const mailer = getMailer();
    const attachments = toMailAttachments(Array.isArray(req.body?.attachments) ? req.body.attachments : []);
    const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#213343;white-space:pre-wrap;">${escapeHtml(body)}</div><hr style="border:0;border-top:1px solid #dbe4ec;margin:24px 0;"><div style="font-family:Arial,sans-serif;font-size:12px;color:#516f90;">Sent by ${escapeHtml(senderName)} from Excell Packaging ERP.</div>`;

    let sent = 0;
    const failed = [];

    for (const recipient of validRecipients) {
      try {
        await mailer.sendMail({
          from: `"${mailFromName.replace(/"/g, '')}" <${mailFrom}>`,
          to: recipient.name ? `"${recipient.name.replace(/"/g, '')}" <${recipient.email}>` : recipient.email,
          replyTo: mailReplyTo,
          subject,
          text: `${body}\n\nSent by ${senderName} from Excell Packaging ERP.`,
          html: htmlBody,
          attachments,
        });
        sent += 1;
      } catch (error) {
        failed.push({ email: recipient.email, error: error?.message || 'Send failed' });
      }
    }

    res.json({
      sent,
      failed: failed.length,
      targets: validRecipients.length,
      skipped: recipients.length - validRecipients.length,
      errors: failed,
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Mail relay failed' });
  }
});

app.post('/api/sync-inbox', async (req, res) => {
  try {
    res.json(await syncInbox({ limit: req.body?.limit || 25, source: 'manual' }));
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Inbox sync failed', step: error?.step || 'sync inbox', detail: error?.detail || describeError(error) });
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
  console.log('Relay features: send-push, send-mail, sync-inbox; PocketBase admin auth is optional when API rules are open.');
  if (autoSyncInbox && imapHost && imapUser && imapPass && mailSyncIntervalMs > 0) {
    console.log(`Auto inbox sync enabled every ${Math.round(mailSyncIntervalMs / 1000)}s.`);
    setInterval(() => {
      syncInbox({ limit: 25, source: 'auto' })
        .then((result) => {
          if (result.imported > 0 || result.errors.length > 0) {
            console.log('Auto inbox sync result:', result);
          }
        })
        .catch((error) => console.error('Auto inbox sync failed:', { step: error?.step, detail: error?.detail || describeError(error) }));
    }, mailSyncIntervalMs);
  } else {
    console.log('Auto inbox sync disabled or IMAP is not configured.');
  }
});
