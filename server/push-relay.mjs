import cors from 'cors';
import express from 'express';
import PocketBase from 'pocketbase';
import webpush from 'web-push';

const port = Number(process.env.PORT || process.env.PUSH_RELAY_PORT || 8091);
const pocketBaseUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL || '';
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD || '';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY. Push sends will fail until configured.');
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

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

const buildDepartmentFilter = (departments) => {
  const departmentFilter = departments.map((department) => `department = ${escapeFilterValue(department)}`).join(' || ');
  return `is_active = true && (${departmentFilter})`;
};

const authenticatePocketBase = async (pb) => {
  if (!adminEmail || !adminPassword || pb.authStore.isValid) return;
  await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, pocketBaseUrl });
});

app.post('/api/send-push', async (req, res) => {
  const pb = new PocketBase(pocketBaseUrl);
  pb.autoCancellation(false);

  try {
    await authenticatePocketBase(pb);

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
});
