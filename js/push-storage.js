/* Shared local IndexedDB; notification details never reach the scheduler. */
const MayaPushStorage = (() => {
  let opening;
  const db = () => opening || (opening = new Promise((resolve, reject) => {
    const req = indexedDB.open('maya.push-device.v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('state');
    req.onsuccess = () => resolve(req.result);
    req.onerror = req.onblocked = () => reject(new Error('Local push storage unavailable'));
  }).catch(e => { opening = null; throw e; }));
  async function change(fn) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('state', 'readwrite');
      const store = tx.objectStore('state'), req = store.get('active');
      let value;
      req.onsuccess = () => {
        try {
          const next = fn(req.result || null);
          if (next?.write !== undefined) store.put(next.write, 'active');
          value = next?.value;
        } catch { tx.abort(); }
      };
      tx.oncomplete = () => resolve(value);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Local push transaction failed'));
    });
  }
  return { change };
})();
