/* global self, clients */
self.addEventListener('push', (event) => {
  let data = { title: 'Pointer', body: '', url: '/pulse' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        data = {
          title: typeof parsed.title === 'string' ? parsed.title : data.title,
          body: typeof parsed.body === 'string' ? parsed.body : '',
          url: typeof parsed.url === 'string' ? parsed.url : data.url,
        };
      }
    }
  } catch {
    /* use defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || 'Open Pointer',
      icon: '/branding/logo-black.png',
      badge: '/branding/logo-black.png',
      data: { url: data.url },
      tag: 'pointer-alert',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/pulse';
  const path = typeof url === 'string' && url.startsWith('/') ? url : '/pulse';
  const targetUrl = new URL(path, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
