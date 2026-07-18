/* ============ Maya — encrypted local accounts and isolated demo ============ */
const Store = (() => {
  'use strict';

  const LEGACY_DATA = 'maya.data.v1';
  const LEGACY_SESSION = 'maya.session.v1';
  const LEGACY_CONFIG = 'maya.config.v1';
  const LEGACY_TIMERS = 'maya.timers.v1';
  const LEGACY_DEVICE = 'maya.dispositivo.v1';
  const LEGACY_AVATAR = 'maya.avatar.v1';
  const VAULT_NAMESPACE = 'maya.secure.v2';
  const SCHEMA = globalThis.MayaDataSchema;
  const RUNTIME = globalThis.MayaRuntime;
  const DEMO = globalThis.MayaDemoData;

  if (!SCHEMA || !globalThis.AccountVault) throw new Error('No se pudo iniciar el almacenamiento seguro');
  const vault = globalThis.AccountVault.createAccountVault({ namespace: VAULT_NAMESPACE });

  // Remove the legacy browser credential and GitHub PAT as soon as the secure
  // build loads. The tracker data remains available for one-time migration.
  try {
    localStorage.removeItem(LEGACY_SESSION);
    localStorage.removeItem(LEGACY_CONFIG);
  } catch { /* storage may be unavailable in private browsing */ }

  let data = SCHEMA.emptyData('');
  let timers = {};
  let device = '';
  let avatar = '';
  let mediaSecret = '';
  let mediaChain = Promise.resolve();
  const mediaCache = new Map();
  let preferences = { theme: 'system', installHintDismissed: false };
  let mode = 'signed-out'; // signed-out | account | demo
  let demoScenario = null;
  let demoClock = null;
  let syncState = 'off'; // off | busy | ok | error (local encrypted save state)
  let lastSaved = null;
  let saveChain = Promise.resolve();
  const listeners = [];
  const safeConfig = Object.seal({ localOnly: true, autoSync: false, lastSync: null });
  const COLLECTIONS = ['tomas', 'suenos', 'panales', 'condiciones', 'intervenciones', 'medicamentos', 'crecimiento', 'fotos', 'actividades', 'banco'];

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function readJson(storage, key, fallback = null) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeTracker(value, defaultName = '') {
    const demoMeta = value && value.demo && typeof value.demo === 'object' ? clone(value.demo) : null;
    const normalized = SCHEMA.normalizeData(value || SCHEMA.emptyData(defaultName), { defaultBabyName: defaultName });
    if (mode === 'demo' && demoMeta) normalized.demo = demoMeta;
    return normalized;
  }

  function notify() {
    listeners.forEach(fn => { try { fn(); } catch (error) { console.error(error); } });
  }

  function onChange(fn) {
    if (typeof fn === 'function' && !listeners.includes(fn)) listeners.push(fn);
    return () => {
      const index = listeners.indexOf(fn);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  function setSyncState(next) {
    syncState = next;
    notify();
  }

  function envelope(snapshot = data) {
    const tracker = clone(snapshot);
    if (mode === 'account') tracker.fotos = tracker.fotos.map(photo => {
      const clean = Object.assign({}, photo);
      delete clean.dataUrl;
      return clean;
    });
    return {
      schemaVersion: 2,
      baby: clone(snapshot.bebe),
      tracker,
      timers: clone(timers),
      device,
      avatar: avatar && avatar.length <= 350000 ? avatar : '',
      mediaSecret,
      preferences: clone(preferences),
    };
  }

  function unpack(payload, fallbackBaby) {
    const rawTracker = payload && payload.tracker ? payload.tracker : payload;
    data = normalizeTracker(rawTracker || { bebe: fallbackBaby || {} }, fallbackBaby && fallbackBaby.nombre || '');
    if (payload && payload.baby && typeof payload.baby === 'object') {
      data.bebe = SCHEMA.normalizeData({ bebe: payload.baby }, { defaultBabyName: data.bebe.nombre }).bebe;
    }
    timers = payload && payload.timers && typeof payload.timers === 'object' ? clone(payload.timers) : {};
    device = SCHEMA.text(payload && payload.device, 40);
    avatar = typeof (payload && payload.avatar) === 'string' && /^data:image\//.test(payload.avatar) ? payload.avatar : '';
    mediaSecret = typeof (payload && payload.mediaSecret) === 'string' ? payload.mediaSecret : '';
    preferences = Object.assign({ theme: 'system', installHintDismissed: false },
      payload && payload.preferences && typeof payload.preferences === 'object' ? payload.preferences : {});
  }

  function tombstoneMap(...sets) {
    const map = new Map();
    sets.flat().forEach(item => {
      if (!item || !item.col || !item.id || !item.at) return;
      const key = `${item.col}:${item.id}`;
      if (!map.has(key) || map.get(key).at < item.at) map.set(key, item);
    });
    return map;
  }

  function mergeTrackers(local, remote) {
    const a = normalizeTracker(local);
    const b = normalizeTracker(remote);
    const result = SCHEMA.emptyData(a.bebe.nombre || b.bebe.nombre);
    result.bebe = (b.bebe.actualizado || '') > (a.bebe.actualizado || '') ? b.bebe : a.bebe;
    const tombs = tombstoneMap(a.borrados || [], b.borrados || []);
    result.borrados = [...tombs.values()].sort((x, y) => x.at.localeCompare(y.at)).slice(-5000);
    COLLECTIONS.forEach(collection => {
      const items = new Map();
      [...(b[collection] || []), ...(a[collection] || [])].forEach(item => {
        const previous = items.get(item.id);
        if (!previous || (item.updatedAt || '') > (previous.updatedAt || '')) items.set(item.id, item);
      });
      result[collection] = [...items.values()].filter(item => {
        const tomb = tombs.get(`${collection}:${item.id}`);
        return !tomb || tomb.at < (item.updatedAt || '');
      });
    });
    return normalizeTracker(result);
  }

  function demoKey(scenario = demoScenario) {
    return RUNTIME ? RUNTIME.demoStorageKey(scenario || 'steady') : `maya.demo.v2.${scenario || 'steady'}`;
  }

  function persistDemo() {
    const payload = envelope(data);
    payload.demo = { scenario: demoScenario, clock: demoClock };
    sessionStorage.setItem(demoKey(), JSON.stringify(payload));
    lastSaved = new Date().toISOString();
    syncState = 'ok';
    safeConfig.lastSync = lastSaved;
  }

  async function persistAccount(snapshot) {
    try {
      await vault.saveVault(envelope(snapshot));
    } catch (firstError) {
      // A second open tab may have saved first. Reload its revision, merge by
      // record id/timestamp and retry once instead of losing either side.
      const localSnapshot = clone(snapshot);
      const remotePayload = await vault.loadVault();
      const remoteTracker = remotePayload && remotePayload.tracker ? remotePayload.tracker : remotePayload;
      data = mergeTrackers(localSnapshot, remoteTracker);
      const remoteTimers = remotePayload && remotePayload.timers && typeof remotePayload.timers === 'object' ? remotePayload.timers : {};
      timers = mergeTimers(timers, remoteTimers);
      await vault.saveVault(envelope(data));
    }
    lastSaved = new Date().toISOString();
    safeConfig.lastSync = lastSaved;
  }

  function queueSave() {
    const snapshot = clone(data);
    setSyncState('busy');
    saveChain = saveChain.then(async () => {
      if (mode === 'demo') persistDemo();
      else if (mode === 'account' && vault.hasSession()) await persistAccount(snapshot);
      setSyncState('ok');
    }).catch(error => {
      console.error('No se pudo guardar la bóveda local', error);
      setSyncState('error');
    });
    return saveChain;
  }

  function saveLocal() {
    extractInlineMedia();
    data = normalizeTracker(data, data.bebe && data.bebe.nombre || '');
    notify();
    return queueSave();
  }

  function mergeTimers(left, right) {
    const result = Object.assign({}, right || {}, left || {});
    if (result.sueno && result.vigilia) {
      const sleepStart = new Date(result.sueno.inicio || 0).getTime();
      const awakeStart = new Date(result.vigilia.inicio || 0).getTime();
      if (sleepStart >= awakeStart) delete result.vigilia;
      else delete result.sueno;
    }
    return result;
  }

  function newMediaSecret() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function mediaScope() {
    const account = vault.currentAccount();
    return account && account.username || '';
  }

  function queueMediaPut(photoId, dataUrl) {
    if (mode !== 'account' || !globalThis.MayaMediaStore || !mediaSecret || !dataUrl) return;
    const scope = mediaScope();
    if (!scope) return;
    mediaCache.set(photoId, dataUrl);
    mediaChain = mediaChain.then(() => MayaMediaStore.put(scope, photoId, dataUrl, mediaSecret)).catch(error => {
      console.error('No se pudo guardar la foto cifrada', error);
      setSyncState('error');
    });
  }

  function extractInlineMedia() {
    if (mode !== 'account') return;
    data.fotos.forEach(photo => {
      if (!photo.dataUrl) return;
      queueMediaPut(photo.id, photo.dataUrl);
      delete photo.dataUrl;
    });
  }

  /* ---------- account lifecycle ---------- */
  function listAccounts() {
    try { return vault.listAccounts(); }
    catch { return []; }
  }

  async function login(username, password) {
    try {
      const result = await vault.unlockAccount({ username, password });
      mode = 'account';
      demoScenario = null;
      demoClock = null;
      unpack(result.data, result.data && result.data.baby);
      if (!mediaSecret) {
        mediaSecret = newMediaSecret();
        queueSave();
      }
      syncState = 'ok';
      lastSaved = result.account.updatedAt;
      safeConfig.lastSync = lastSaved;
      notify();
      return true;
    } catch {
      return false;
    }
  }

  function legacyPayload() {
    const raw = readJson(localStorage, LEGACY_DATA);
    if (!raw) return null;
    try { return SCHEMA.importData(raw); }
    catch { return null; }
  }

  function hasLegacyData() {
    return !!legacyPayload();
  }

  function legacyBaby() {
    const legacy = legacyPayload();
    return legacy ? clone(legacy.bebe) : null;
  }

  async function createAccount(options) {
    const input = options || {};
    let seed = input.data ? SCHEMA.importData(input.data) : null;
    const importing = !!input.importLegacy && hasLegacyData();
    if (!seed && importing) seed = legacyPayload();
    if (!seed) seed = SCHEMA.emptyData(input.babyName || '');
    seed.bebe = Object.assign({}, seed.bebe, {
      nombre: SCHEMA.text(input.babyName || seed.bebe.nombre, 80),
      nacimiento: input.birth || seed.bebe.nacimiento || '',
      hora: input.birthTime || seed.bebe.hora || '',
      mama: SCHEMA.text(input.mother || seed.bebe.mama, 80),
      papa: SCHEMA.text(input.father || seed.bebe.papa, 80),
      actualizado: new Date().toISOString(),
    });
    seed = normalizeTracker(seed, input.babyName || '');
    const pendingMedia = seed.fotos.filter(photo => photo.dataUrl).map(photo => ({ id: photo.id, dataUrl: photo.dataUrl }));
    seed.fotos.forEach(photo => { delete photo.dataUrl; });
    const initialMediaSecret = newMediaSecret();

    const legacyTimers = importing ? readJson(localStorage, LEGACY_TIMERS, {}) : {};
    const legacyDevice = importing ? (localStorage.getItem(LEGACY_DEVICE) || '') : '';
    const initial = {
      schemaVersion: 2,
      tracker: seed,
      timers: mergeTimers({}, legacyTimers),
      device: SCHEMA.text(legacyDevice, 40),
      mediaSecret: initialMediaSecret,
      preferences: { theme: 'system', installHintDismissed: false },
    };
    const result = await vault.createAccount({
      username: input.username,
      displayName: input.displayName || input.username,
      password: input.password,
      baby: seed.bebe,
      data: initial,
    });
    mode = 'account';
    unpack(result.data, seed.bebe);
    pendingMedia.forEach(photo => queueMediaPut(photo.id, photo.dataUrl));
    syncState = 'ok';
    lastSaved = result.account.updatedAt;
    safeConfig.lastSync = lastSaved;

    if (importing) {
      // The encrypted write completed successfully; remove duplicate plaintext.
      localStorage.removeItem(LEGACY_DATA);
      localStorage.removeItem(LEGACY_TIMERS);
      localStorage.removeItem(LEGACY_DEVICE);
    }
    notify();
    return { account: result.account, data: clone(data) };
  }

  async function startDemo(scenario = 'steady', options = {}) {
    if (!DEMO) throw new Error('El demo no está disponible');
    const selected = (RUNTIME && RUNTIME.cleanScenario(scenario)) || 'steady';
    mode = 'demo';
    demoScenario = selected;
    const stored = options.reset ? null : readJson(sessionStorage, demoKey(selected));
    if (stored && stored.tracker && stored.demo && stored.demo.scenario === selected) {
      demoClock = stored.demo.clock || (stored.tracker.demo && stored.tracker.demo.clock) || new Date().toISOString();
      unpack(stored, stored.baby);
      data.demo = Object.assign({}, stored.tracker.demo || {}, { scenario: selected, synthetic: true, clock: demoClock, offline: selected === 'offline' });
    } else {
      const clock = options.clock ? new Date(options.clock) : new Date();
      clock.setSeconds(0, 0);
      demoClock = clock.toISOString();
      const generated = DEMO.rebaseScenario(selected, demoClock);
      data = normalizeTracker(generated, 'Bebé Demo');
      data.demo = clone(generated.demo);
      timers = {};
      device = 'demo';
      avatar = '';
      mediaSecret = '';
      preferences = { theme: 'system', installHintDismissed: true };
      persistDemo();
    }
    syncState = 'ok';
    notify();
    return clone(data);
  }

  async function resetDemo() {
    if (mode !== 'demo') return;
    try { sessionStorage.removeItem(demoKey()); } catch { /* ignore */ }
    return startDemo(demoScenario || 'steady', { reset: true });
  }

  function logout() {
    vault.lock();
    mode = 'signed-out';
    data = SCHEMA.emptyData('');
    timers = {};
    device = '';
    avatar = '';
    mediaSecret = '';
    mediaCache.clear();
    syncState = 'off';
    lastSaved = null;
    notify();
  }

  async function deleteCurrentAccount() {
    if (mode !== 'account' || !vault.hasSession()) throw new Error('ACCOUNT_REQUIRED');
    const scope = mediaScope();
    await flush();
    if (scope && globalThis.MayaMediaStore && typeof MayaMediaStore.removeScope === 'function') {
      await MayaMediaStore.removeScope(scope);
    }
    vault.deleteCurrentAccount();
    mode = 'signed-out';
    data = SCHEMA.emptyData('');
    timers = {};
    device = '';
    avatar = '';
    mediaSecret = '';
    mediaCache.clear();
    syncState = 'off';
    lastSaved = null;
    notify();
    return true;
  }

  const hasSession = () => mode === 'demo' || (mode === 'account' && vault.hasSession());
  const currentAccount = () => mode === 'account' ? vault.currentAccount() : null;

  /* ---------- CRUD ---------- */
  const uid = () => {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const now = () => new Date().toISOString();

  function add(collection, item) {
    if (!COLLECTIONS.includes(collection) || !item || typeof item !== 'object') return null;
    const candidate = Object.assign({}, item, { id: item.id || uid(), updatedAt: now() });
    if (collection === 'fotos' && mode === 'account' && candidate.dataUrl) {
      queueMediaPut(candidate.id, candidate.dataUrl);
      delete candidate.dataUrl;
    }
    data[collection].push(candidate);
    saveLocal();
    return data[collection].find(entry => entry.id === candidate.id) || null;
  }

  function update(collection, recordId, patch) {
    if (!COLLECTIONS.includes(collection) || !patch || typeof patch !== 'object') return null;
    const item = data[collection].find(entry => entry.id === recordId);
    if (!item) return null;
    Object.assign(item, patch, { id: item.id, updatedAt: now() });
    saveLocal();
    return data[collection].find(entry => entry.id === recordId) || null;
  }

  function remove(collection, recordId) {
    if (!COLLECTIONS.includes(collection)) return;
    data[collection] = data[collection].filter(entry => entry.id !== recordId);
    if (collection === 'fotos' && mode === 'account' && globalThis.MayaMediaStore && mediaScope()) {
      mediaCache.delete(recordId);
      const scope = mediaScope();
      mediaChain = mediaChain.then(() => MayaMediaStore.remove(scope, recordId)).catch(error => console.error('No se pudo borrar la foto cifrada', error));
    }
    data.borrados.push({ col: collection, id: SCHEMA.id(recordId), at: now() });
    saveLocal();
  }

  function marcarActividad(fecha, tarea, titulo, hecha, duracionSeg) {
    const recordId = `act-${SCHEMA.text(fecha, 10)}-${SCHEMA.text(tarea, 80).replace(/[^A-Za-z0-9._-]/g, '-')}`;
    const existing = data.actividades.find(activity => activity.id === recordId);
    if (existing) Object.assign(existing, { hecha: !!hecha, duracionSeg: duracionSeg ?? existing.duracionSeg, updatedAt: now() });
    else data.actividades.push({ id: recordId, fecha, tarea, titulo, hecha: !!hecha, duracionSeg: duracionSeg || null, updatedAt: now() });
    saveLocal();
  }

  /* ---------- local device state ---------- */
  function getTimers() { return clone(timers); }
  function setTimers(next) {
    timers = mergeTimers({}, next && typeof next === 'object' ? next : {});
    notify();
    queueSave();
  }
  const getDispositivo = () => device;
  function setDispositivo(value) {
    device = SCHEMA.text(value, 40);
    notify();
    queueSave();
  }
  const getAvatarCache = () => avatar || '';
  const fetchAvatar = async () => avatar || null;
  function setAvatarCache(value) {
    avatar = typeof value === 'string' && /^data:image\//.test(value) && value.length <= 350000 ? value : '';
    queueSave();
  }

  /* ---------- compatibility and diagnostics ---------- */
  function loadLocal() { return data; }
  const flush = () => Promise.all([saveChain, mediaChain]);
  const canSync = () => false;
  async function syncNow() { await flush(); }
  async function testConnection() { return false; }
  function scheduleSync() { return queueSave(); }
  function saveConfig() { /* secrets and remote config no longer live in the browser */ }
  async function fetchPhoto(photo) {
    if (!photo) return null;
    if (photo.dataUrl) return photo.dataUrl;
    if (mediaCache.has(photo.id)) return mediaCache.get(photo.id);
    const scope = mediaScope();
    if (mode !== 'account' || !globalThis.MayaMediaStore || !mediaSecret || !scope) return null;
    try {
      const value = await MayaMediaStore.get(scope, photo.id, mediaSecret);
      if (value) mediaCache.set(photo.id, value);
      return value;
    } catch (error) {
      console.error('No se pudo abrir la foto cifrada', error);
      return null;
    }
  }
  async function storageEstimate() {
    if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate();
    return { usage: null, quota: null };
  }

  return {
    login, createAccount, listAccounts, hasSession, currentAccount, logout, deleteCurrentAccount,
    startDemo, resetDemo, hasLegacyData, legacyBaby,
    loadLocal, saveLocal, saveConfig, flush,
    add, update, remove, onChange, marcarActividad,
    getTimers, setTimers, getDispositivo, setDispositivo,
    fetchAvatar, getAvatarCache, setAvatarCache, fetchPhoto,
    syncNow, scheduleSync, testConnection, canSync, storageEstimate,
    get data() { return data; },
    set data(value) { data = SCHEMA.importData(value); },
    get config() { return safeConfig; },
    get syncState() { return syncState; },
    get lastSaved() { return lastSaved; },
    get mode() { return mode; },
    get demoScenario() { return demoScenario; },
    get demoClock() { return demoClock; },
    get preferences() { return preferences; },
    set preferences(value) { preferences = Object.assign({}, preferences, value || {}); queueSave(); },
    isDemo() { return mode === 'demo'; },
    emptyData: SCHEMA.emptyData,
    normalizeData: SCHEMA.normalizeData,
    importData: SCHEMA.importData,
    uid,
  };
})();
