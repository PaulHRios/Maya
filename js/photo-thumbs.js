/* Small, private preview cache. Only derived thumbnails, never full-size photos. */
const MayaPhotoThumbs = (() => {
  const DB_NAME = 'maya.photo-previews.v1', TABLE = 'previews';
  const MAX_CACHE = 180, MAX_MEMORY = 40, MAX_SIDE = 300, MAX_BYTES = 85000;
  const memory = new Map(), inFlight = new Map();
  let dbPromise;
  function remember(key, value) {
    memory.delete(key);
    memory.set(key, value);
    if (memory.size > MAX_MEMORY) memory.delete(memory.keys().next().value);
  }
  function db() {
    if (!dbPromise) dbPromise = new Promise(resolve => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(TABLE, { keyPath: 'key' });
        store.createIndex('at', 'at');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = request.onblocked = () => resolve(null);
    }).catch(() => null);
    return dbPromise;
  }
  function valid(src) {
    return typeof src === 'string' && src.length <= MAX_BYTES &&
      /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(src);
  }
  async function read(key) {
    const database = await db();
    if (!database) return null;
    return new Promise(resolve => {
      const req = database.transaction(TABLE).objectStore(TABLE).get(key);
      req.onsuccess = () => resolve(valid(req.result?.value) ? req.result.value : null);
      req.onerror = () => resolve(null);
    }).catch(() => null);
  }
  async function write(key, value) {
    const database = await db();
    if (!database) return;
    const store = database.transaction(TABLE, 'readwrite').objectStore(TABLE);
    store.put({ key, value, at: Date.now() });
    const count = store.count();
    count.onsuccess = () => {
      let extra = count.result - MAX_CACHE;
      if (extra <= 0) return;
      const req = store.index('at').openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || extra-- <= 0) return;
        cursor.delete();
        cursor.continue();
      };
    };
  }
  async function discard(scope, file) {
    const key = file != null ? JSON.stringify([scope, file]) : null;
    for (const k of memory.keys()) if (key === k || (!key && JSON.parse(k)[0] === scope)) memory.delete(k);
    const database = await db();
    if (!database) return;
    const store = database.transaction(TABLE, 'readwrite').objectStore(TABLE);
    if (key) { store.delete(key); return; }
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if (JSON.parse(cursor.key)[0] === scope) cursor.delete();
      cursor.continue();
    };
  }
  function resize(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          for (const quality of [0.66, 0.5, 0.35]) {
            const out = canvas.toDataURL('image/jpeg', quality);
            if (valid(out)) return resolve(out);
          }
        } catch { /* unsupported image or canvas */ }
        resolve(null);
      };
      img.src = src;
    });
  }
  function get({ scope, file, persist = true, load, stillCurrent = () => true }) {
    const key = JSON.stringify([scope, file]);
    if (memory.has(key)) return Promise.resolve(memory.get(key));
    if (inFlight.has(key)) return inFlight.get(key);
    const pending = (async () => {
      const src = ((persist && await read(key)) || (stillCurrent() && await load())) || null;
      if (!valid(src) || !stillCurrent()) return null;
      remember(key, src);
      if (persist) write(key, src).catch(() => {});
      return src;
    })().catch(() => null).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
    return pending;
  }
  return { get, resize, discard, valid };
})();
