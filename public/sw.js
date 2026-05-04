self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'New Notification',
    body: 'You have a new update.',
    data: {}
  };

  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (_err) {}

  const options = {
    body: payload.body,
    icon: payload.icon || '/app-icon.svg',
    badge: payload.badge || '/app-icon.svg',
    image: payload.image,
    data: payload.data || {},
    tag: payload.data?.tag || payload.tag || undefined,
    renotify: true,
    requireInteraction: payload.requireInteraction || false,
    actions: payload.actions || [
      { action: 'open', title: 'Open ERP' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    timestamp: payload.timestamp || Date.now(),
    vibrate: payload.vibrate || [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Notification', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return Promise.resolve();
    })
  );
});
