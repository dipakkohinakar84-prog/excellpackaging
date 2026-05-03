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
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
    tag: payload.data?.tag || undefined,
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Notification', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

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
