/* ============ Maya — datos, sesión y sincronización ============ */

const Store = (() => {
  const LS_DATA = 'maya.data.v1';
  const LS_SESSION = 'maya.session.v1';
  const LS_CONFIG = 'maya.config.v1';
  const LS_TIMERS = 'maya.timers.v1';

  // Hash de acceso (SHA-256 de usuario|contraseña). No se documenta en el repo.
  const ACCESS_HASH = '4910db4d71ab6452a6b35ced89bce1f9ee91d93f878e263875f9f65cf463f718';

  // Sincronización integrada: el token de GitHub viaja cifrado (AES-GCM con
  // llave derivada de las credenciales). Solo se descifra al iniciar sesión
  // con el usuario y contraseña correctos; en el código solo hay ruido.
  const SYNC_EMBED = {
    owner: 'PaulHRios',
    repo: 'maya_datos',
    salt: 'pyjCGrQ4cDvf9+LtA9Cn8w==',
    iv: 'irFc/7hkawYmbQgO',
    ct: 'GJIDVJwuJg0rf1kxRNR+KAUr6DtC0befifr4Q2+mzCNGgJrBKLhMWKOKH7NFn2wBgYqMN5qSgucgQT//+knpH+ZBu2I0i5lsZh+VdI9CaGbYDZF8t5vJTEUO9UNeAlVOQnPWKlRTRz3/upt1ug==',
  };

  async function descifrarToken(credencial) {
    try {
      const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
      const material = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(credencial), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: b64(SYNC_EMBED.salt), iterations: 310000, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const plano = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64(SYNC_EMBED.iv) }, key, b64(SYNC_EMBED.ct));
      return new TextDecoder().decode(plano);
    } catch { return null; }
  }

  const emptyData = () => ({
    version: 1,
    bebe: { nombre: 'Maya', nacimiento: '' },
    tomas: [],        // {id, tipo: materno|donante|formula, ml, lado, duracionSeg, inicio, notas, updatedAt}
    suenos: [],       // {id, inicio, fin, notas, updatedAt}
    panales: [],      // {id, tipo: pipi|popo|mixto, hora, notas, updatedAt}
    condiciones: [],  // {id, nombre, unidad, mediciones:[{id, valor, fecha, nota}], info, updatedAt}
    intervenciones: [], // {id, titulo, categoria, fecha, notas, updatedAt}
    medicamentos: [], // {id, nombre, dosis, frecuencia, inicio, fin, notas, activo, updatedAt}
    crecimiento: [],  // {id, fecha, pesoKg, tallaCm, perimetroCm, updatedAt}
    fotos: [],        // {id, fecha, titulo, archivo, dataUrl?, sincronizada, semana?, updatedAt}
    actividades: [],  // {id, fecha: 'YYYY-MM-DD', tarea, titulo, hecha, duracionSeg, updatedAt}
    borrados: [],     // tombstones {col, id, at}
  });

  let data = emptyData();
  let config = { owner: 'PaulHRios', repo: 'maya_datos', branch: 'main', token: '', autoSync: true, lastSync: null };
  let syncState = 'off'; // off | ok | busy | error
  let syncTimer = null;
  const listeners = [];

  /* ---------- utilidades ---------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = () => new Date().toISOString();

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- sesión ---------- */
  async function login(user, pass) {
    const credencial = `${user.trim().toLowerCase()}|${pass}`;
    const h = await sha256(credencial);
    if (h !== ACCESS_HASH) return false;
    localStorage.setItem(LS_SESSION, 'ok');

    // dejar lista la sincronización sin que haya que configurar nada
    try {
      const raw = localStorage.getItem(LS_CONFIG);
      if (raw) config = Object.assign(config, JSON.parse(raw));
      if (!config.token) {
        const token = await descifrarToken(credencial);
        if (token) {
          config.token = token;
          if (!config.owner) config.owner = SYNC_EMBED.owner;
          if (!config.repo) config.repo = SYNC_EMBED.repo;
          saveConfig();
        }
      }
    } catch (e) { console.error(e); }
    return true;
  }
  const hasSession = () => localStorage.getItem(LS_SESSION) === 'ok';
  const logout = () => localStorage.removeItem(LS_SESSION);

  /* ---------- persistencia local ---------- */
  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_DATA);
      if (raw) data = Object.assign(emptyData(), JSON.parse(raw));
      const rawCfg = localStorage.getItem(LS_CONFIG);
      if (rawCfg) config = Object.assign(config, JSON.parse(rawCfg));
      // configuraciones guardadas con versiones viejas pueden traer campos vacíos
      if (!config.owner) config.owner = SYNC_EMBED.owner;
      if (!config.repo) config.repo = SYNC_EMBED.repo;
    } catch (e) { console.error('Error cargando datos locales', e); }
  }

  function saveLocal() {
    localStorage.setItem(LS_DATA, JSON.stringify(data));
    notify();
    scheduleSync();
  }

  function saveConfig() {
    localStorage.setItem(LS_CONFIG, JSON.stringify(config));
  }

  // un error al refrescar la vista nunca debe impedir que se guarden los datos
  function notify() {
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  }
  function onChange(fn) { listeners.push(fn); }

  /* ---------- CRUD genérico ---------- */
  const COLS = ['tomas', 'suenos', 'panales', 'condiciones', 'intervenciones', 'medicamentos', 'crecimiento', 'fotos', 'actividades'];

  function add(col, item) {
    item.id = item.id || uid();
    item.updatedAt = now();
    data[col].push(item);
    saveLocal();
    return item;
  }

  function update(col, id, patch) {
    const item = data[col].find(x => x.id === id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: now() });
    saveLocal();
    return item;
  }

  function remove(col, id) {
    data[col] = data[col].filter(x => x.id !== id);
    data.borrados.push({ col, id, at: now() });
    saveLocal();
  }

  // marca o desmarca una tarea del día (id determinístico: se fusiona
  // bien aunque los dos celulares completen la misma)
  function marcarActividad(fecha, tarea, titulo, hecha, duracionSeg) {
    const id = `act-${fecha}-${tarea}`;
    const existente = data.actividades.find(a => a.id === id);
    if (existente) {
      Object.assign(existente, { hecha, duracionSeg: duracionSeg ?? existente.duracionSeg, updatedAt: now() });
    } else {
      data.actividades.push({ id, fecha, tarea, titulo, hecha, duracionSeg: duracionSeg || null, updatedAt: now() });
    }
    saveLocal();
  }

  /* foto de perfil: vive en el repo privado; se cachea por dispositivo */
  const LS_AVATAR = 'maya.avatar.v1';
  function getAvatarCache() { return localStorage.getItem(LS_AVATAR); }
  async function fetchAvatar() {
    if (!canSync()) return getAvatarCache();
    try {
      const f = await ghGetFile('fotos/avatar.jpg');
      if (!f || !f.content) return getAvatarCache();
      const url = `data:image/jpeg;base64,${f.content.replace(/\n/g, '')}`;
      localStorage.setItem(LS_AVATAR, url);
      return url;
    } catch { return getAvatarCache(); }
  }

  /* ---------- timers persistentes (lactancia / sueño) ---------- */
  function getTimers() {
    try { return JSON.parse(localStorage.getItem(LS_TIMERS)) || {}; }
    catch { return {}; }
  }
  function setTimers(t) {
    localStorage.setItem(LS_TIMERS, JSON.stringify(t));
    notify();
  }

  /* ---------- fusión para sincronización ---------- */
  function mergeData(remote) {
    const merged = emptyData();
    merged.bebe = (remote.bebe && remote.bebe.actualizado > (data.bebe.actualizado || '')) ? remote.bebe : data.bebe;

    const tombs = new Map();
    [...(data.borrados || []), ...(remote.borrados || [])].forEach(t => {
      const k = `${t.col}:${t.id}`;
      if (!tombs.has(k) || tombs.get(k).at < t.at) tombs.set(k, t);
    });
    merged.borrados = [...tombs.values()].slice(-500);

    for (const col of COLS) {
      const byId = new Map();
      [...(remote[col] || []), ...(data[col] || [])].forEach(item => {
        const prev = byId.get(item.id);
        if (!prev || (item.updatedAt || '') > (prev.updatedAt || '')) byId.set(item.id, item);
      });
      merged[col] = [...byId.values()].filter(item => {
        const t = tombs.get(`${col}:${item.id}`);
        return !t || t.at < (item.updatedAt || '');
      });
    }
    return merged;
  }

  /* ---------- API de GitHub ---------- */
  const apiBase = () => `https://api.github.com/repos/${config.owner}/${config.repo}/contents`;
  const headers = () => ({
    'Authorization': `Bearer ${config.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });

  function b64encodeUtf8(str) {
    return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
  }
  function b64decodeUtf8(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }

  async function ghGetFile(path) {
    const res = await fetch(`${apiBase()}/${path}?ref=${config.branch}&t=${Date.now()}`, { headers: headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    return res.json();
  }

  async function ghPutFile(path, contentB64, sha, message) {
    const body = { message, content: contentB64, branch: config.branch };
    if (sha) body.sha = sha;
    const res = await fetch(`${apiBase()}/${path}`, {
      method: 'PUT', headers: headers(), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    return res.json();
  }

  const canSync = () => !!(config.token && config.owner && config.repo);

  function setSyncState(s) {
    syncState = s;
    notify();
  }

  async function syncPhotos() {
    for (const foto of data.fotos) {
      if (!foto.sincronizada && foto.dataUrl) {
        const b64 = foto.dataUrl.split(',')[1];
        try {
          await ghPutFile(`fotos/${foto.archivo}`, b64, null, `Foto: ${foto.titulo || foto.archivo}`);
          foto.sincronizada = true;
          foto.updatedAt = now();
        } catch (e) {
          if (String(e.message).includes('422')) { foto.sincronizada = true; } // ya existe
          else throw e;
        }
      }
    }
  }

  async function fetchPhoto(foto) {
    if (foto.dataUrl) return foto.dataUrl;
    try {
      const f = await ghGetFile(`fotos/${foto.archivo}`);
      if (!f) return null;
      let b64 = f.content;
      if (!b64 && f.download_url) {
        // archivos >1MB: la API no regresa contenido inline
        const r = await fetch(f.download_url);
        const blob = await r.blob();
        b64 = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
      }
      foto.dataUrl = `data:image/jpeg;base64,${b64.replace(/\n/g, '')}`;
      localStorage.setItem(LS_DATA, JSON.stringify(data));
      return foto.dataUrl;
    } catch (e) { console.error('Foto no disponible', e); return null; }
  }

  let syncing = false;
  async function syncNow() {
    if (!canSync() || syncing) return;
    syncing = true;
    setSyncState('busy');
    try {
      const remoteFile = await ghGetFile('datos/maya.json');
      let sha = null;
      if (remoteFile) {
        sha = remoteFile.sha;
        const remote = JSON.parse(b64decodeUtf8(remoteFile.content));
        data = mergeData(remote);
      }
      await syncPhotos();
      // no subir las fotos en el JSON (van como archivos aparte)
      const slim = JSON.parse(JSON.stringify(data));
      slim.fotos = slim.fotos.map(f => { const c = { ...f }; delete c.dataUrl; return c; });
      await ghPutFile('datos/maya.json', b64encodeUtf8(JSON.stringify(slim, null, 1)), sha, `Registro ${new Date().toLocaleString('es-MX')}`);
      config.lastSync = now();
      saveConfig();
      localStorage.setItem(LS_DATA, JSON.stringify(data));
      setSyncState('ok');
    } catch (e) {
      console.error('Error de sincronización', e);
      setSyncState('error');
    } finally {
      syncing = false;
    }
  }

  function scheduleSync() {
    if (!canSync() || !config.autoSync) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 4000);
  }

  async function testConnection() {
    const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, { headers: headers() });
    return res.ok;
  }

  return {
    login, hasSession, logout,
    loadLocal, saveLocal, saveConfig,
    add, update, remove, onChange,
    marcarActividad, fetchAvatar, getAvatarCache,
    getTimers, setTimers,
    syncNow, scheduleSync, testConnection, canSync, fetchPhoto,
    get data() { return data; },
    set data(d) { data = d; },
    get config() { return config; },
    get syncState() { return syncState; },
    emptyData, uid,
  };
})();
