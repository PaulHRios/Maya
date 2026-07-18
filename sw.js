/* Versioned application shell. Private records are never stored in Cache API. */
const CACHE = 'maya-shell-v4';
const ARCHIVOS = [
  './',
  './index.html',
  './css/styles.css',
  './js/runtime.js',
  './js/data-schema.js',
  './js/account-vault.js',
  './js/media-store.js',
  './js/demo-data.js',
  './js/insights-engine.js',
  './js/insights-client.js',
  './js/store.js',
  './js/actividades.js',
  './js/info.js',
  './js/pdf.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/maskable-512.png',
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const network = await fetch(e.request);
        if (network.ok) {
          const cache = await caches.open(CACHE);
          cache.put('./index.html', network.clone()).catch(() => {});
        }
        return network;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Cache-first makes the installed PWA respond immediately on weak networks.
  const refresh = fetch(e.request).then(async response => {
    if (response.ok) (await caches.open(CACHE)).put(e.request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);
  e.waitUntil(refresh);
  e.respondWith(caches.match(e.request).then(cached => cached || refresh.then(response => {
    if (response) return response;
    return new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })));
});
