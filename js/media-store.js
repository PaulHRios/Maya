/* Encrypted photo blobs for local accounts. The AES key is itself stored only
   inside AccountVault; IndexedDB contains ciphertext and non-secret metadata. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MayaMediaStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DB_NAME = 'maya-media-v2';
  const STORE_NAME = 'encrypted-media';
  const MAX_BYTES = 8 * 1024 * 1024;
  let dbPromise = null;

  function openDb() {
    if (!('indexedDB' in globalThis)) return Promise.reject(new Error('MEDIA_UNAVAILABLE'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('MEDIA_UNAVAILABLE'));
    });
    return dbPromise;
  }

  function validPart(value) {
    const part = String(value || '');
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(part)) throw new Error('MEDIA_INVALID_ID');
    return part;
  }

  function fromBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function toBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunk));
    }
    return btoa(binary);
  }

  function parseDataUrl(dataUrl) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(dataUrl || ''));
    if (!match) throw new Error('MEDIA_INVALID_IMAGE');
    const bytes = fromBase64(match[2].replace(/[\r\n]/g, ''));
    if (!bytes.length || bytes.byteLength > MAX_BYTES) throw new Error('MEDIA_TOO_LARGE');
    return { mime: match[1], bytes };
  }

  async function cryptoKey(secret) {
    const raw = fromBase64(secret);
    if (raw.byteLength !== 32) throw new Error('MEDIA_INVALID_KEY');
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('MEDIA_STORAGE_ERROR'));
    });
  }

  async function put(scope, id, dataUrl, secret) {
    const safeScope = validPart(scope), safeId = validPart(id);
    const parsed = parseDataUrl(dataUrl);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(`${safeScope}:${safeId}:${parsed.mime}`);
    const key = await cryptoKey(secret);
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, parsed.bytes));
    const db = await openDb();
    const record = {
      key: `${safeScope}:${safeId}`,
      scope: safeScope,
      id: safeId,
      mime: parsed.mime,
      iv: toBase64(iv),
      ciphertext: encrypted.buffer,
      bytes: parsed.bytes.byteLength,
      updatedAt: new Date().toISOString(),
    };
    await requestResult(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record));
    return { id: safeId, bytes: record.bytes };
  }

  async function get(scope, id, secret) {
    const safeScope = validPart(scope), safeId = validPart(id);
    const db = await openDb();
    const record = await requestResult(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(`${safeScope}:${safeId}`));
    if (!record) return null;
    const aad = new TextEncoder().encode(`${safeScope}:${safeId}:${record.mime}`);
    const key = await cryptoKey(secret);
    const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(record.iv), additionalData: aad }, key, record.ciphertext));
    return `data:${record.mime};base64,${toBase64(decrypted)}`;
  }

  async function remove(scope, id) {
    const db = await openDb();
    await requestResult(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(`${validPart(scope)}:${validPart(id)}`));
  }

  async function removeScope(scope) {
    const safeScope = validPart(scope);
    const db = await openDb();
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    const keys = await requestResult(store.getAllKeys());
    const matches = keys.filter(key => typeof key === 'string' && key.startsWith(`${safeScope}:`));
    if (!matches.length) return 0;
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    matches.forEach(key => transaction.objectStore(STORE_NAME).delete(key));
    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('MEDIA_STORAGE_ERROR'));
      transaction.onabort = () => reject(new Error('MEDIA_STORAGE_ERROR'));
    });
    return matches.length;
  }

  return Object.freeze({ DB_NAME, MAX_BYTES, put, get, remove, removeScope });
});
