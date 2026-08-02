// Service worker di Casa Points — SOLO notifiche.
//
// IMPORTANTE: qui non c'è nessun handler 'fetch' e nessuna cache. Tutte le
// richieste continuano ad andare in rete come prima, quindi questo service
// worker non può far restare l'app indietro rispetto al sito pubblicato.
// Serve unicamente perché su iPhone le notifiche push non esistono senza.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Casa Points', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Casa Points';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'casa-points',
    renotify: true,
    data: { url: payload.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) {
        try { await client.navigate(target); } catch (e) { /* alcune versioni non lo permettono */ }
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
