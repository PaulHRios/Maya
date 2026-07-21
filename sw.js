/* Service worker: deja usar la app sin internet (los datos viven en el
   dispositivo y se sincronizan cuando vuelve la conexión). */
const CACHE = 'maya-v15';
const ARCHIVOS = [
  './',
  './index.html',
  './css/styles.css',
  './js/i18n.js',
  './js/store.js',
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // nunca cachear llamadas a APIs (GitHub, Wikipedia)
  if (url.hostname.includes('api.github.com') || url.hostname.includes('wikipedia.org')) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
