/* Service worker: deja usar la app sin internet (los datos viven en el
   dispositivo y se sincronizan cuando vuelve la conexión). */
const CACHE = 'maya-v19';
const ARCHIVOS = [
  './',
  './index.html',
  './css/styles.css',
  './js/i18n.js',
  './js/store.js',
  './js/reminders.js',
  './js/photo-thumbs.js',
  './js/actividades.js',
  './js/analisis.js',
  './js/epds.js',
  './js/info.js',
  './js/pdf.js',
  './js/demo-fotos.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/vendor/chart.umd.min.js',
  './js/vendor/jspdf.umd.min.js',
  './js/vendor/jspdf.plugin.autotable.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => /^maya-v\d+$/.test(k) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Cache the app shell only; private GitHub/API/raw responses must never enter it.
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const page = pages.find(p => p.url.startsWith(self.registration.scope));
    if (page) await page.focus();
    else await self.clients.openWindow(self.registration.scope);
  })());
});
