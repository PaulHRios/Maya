/* Service worker: deja usar la app sin internet (los datos viven en el
   dispositivo y se sincronizan cuando vuelve la conexión). */
importScripts('./js/reminders.js', './js/push-storage.js');

const CACHE = 'maya-v22';
const ARCHIVOS = [
  './',
  './index.html',
  './demo.html',
  './css/styles.css?v=22',
  './js/i18n.js',
  './js/store.js?v=22',
  './js/reminders.js',
  './js/photo-thumbs.js',
  './js/push-config.js?v=22',
  './js/push-storage.js',
  './js/push-client.js?v=22',
  './js/actividades.js',
  './js/analisis.js',
  './js/epds.js',
  './js/info.js',
  './js/pdf.js',
  './js/demo-fotos.js',
  './js/app.js?v=22',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/vendor/chart.umd.min.js',
  './js/vendor/jspdf.umd.min.js',
  './js/vendor/jspdf.plugin.autotable.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS.map(file =>
    new Request(file, { cache: 'reload' })
  ))).then(() => self.skipWaiting()));
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
  const scope = self.registration.scope;
  if (!ARCHIVOS.some(file => new URL(file, scope).pathname === url.pathname)) return;

  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE);
        const exact = await cache.match(e.request);
        // Only unversioned app navigation can reuse an entry with different query params.
        if (exact) return exact;
        if (e.request.mode === 'navigate') {
          const page = url.pathname === new URL('./demo.html', scope).pathname ? './demo.html' : './index.html';
          return (await cache.match(page)) || Response.error();
        }
        // An obsolete client may still request old names; never substitute a different version.
        return Response.error();
      })
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

function pushBody(job, now) {
  const en=job.lang==='en', name=String(job.name || (en ? 'your baby' : 'tu bebé')).slice(0,80);
  const minutes=Math.max(0,Math.floor((now-job.since)/60000));
  const elapsed=minutes>=60 ? Math.floor(minutes/60)+' h'+(minutes%60?' '+minutes%60+' min':'') : minutes+' min';
  if(job.type==='photo') return en ? name+'’s week '+job.week+' photo is still missing.' : 'Falta la foto de '+name+' de la semana '+job.week+'.';
  if(job.type==='feed') return en ? 'It’s been '+elapsed+' since '+name+'’s last logged feed.' : 'Hace '+elapsed+' que no registras una toma de '+name+'.';
  if(job.type==='poop') return en ? 'It’s been '+elapsed+' since '+name+'’s last logged dirty diaper.' : 'Hace '+elapsed+' que no registras popó de '+name+'.';
  if(job.type==='wet') return en ? 'It’s been '+elapsed+' since '+name+'’s last logged wet diaper.' : 'Hace '+elapsed+' que no registras pipí de '+name+'.';
  return en ? name+' has been awake for '+elapsed+' based on your logs. Check the wake window.' : name+' lleva '+elapsed+' despierta según el registro. Revisa su ventana de sueño.';
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let id;
    try { id=event.data?.json()?.id; } catch { return; }
    if(typeof id!=='string' || !/^[A-Za-z0-9_-]{22,64}$/.test(id)) return;
    const now=Date.now();
    const job=await MayaPushStorage.change(state=>{
      const entry=state?.jobs?.find(j=>j.id===id);
      if(!entry || entry.delivered || now<entry.at-10000 || now>=entry.expiresAt ||
        MayaReminders.isQuiet(entry.prefs,new Date(now))) return {value:null};
      return {value:entry,write:{...state,jobs:state.jobs.map(j=>j.id===id?{...j,delivered:true}:j)}};
    }).catch(()=>null);
    if(!job) return;
    await self.registration.showNotification('Maya',{body:pushBody(job,now),icon:'./icons/icon-192.png',tag:'maya-care-'+job.id});
  })());
});
