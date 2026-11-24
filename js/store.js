/* ============ Maya — datos, sesión y sincronización ============ */

const Store = (() => {
  const LS_DATA = 'maya.data.v1';
  const LS_SESSION = 'maya.session.v1';
  const LS_CONFIG = 'maya.config.v1';
  const LS_TIMERS = 'maya.timers.v1';

  // Cuentas de la familia. Cada entrada lleva el hash de acceso (SHA-256 de
  // correo|contraseña — las credenciales no se documentan en el repo) y el
  // token de GitHub cifrado (AES-GCM) con llave derivada de esa credencial:
  // cada quien abre el candado con su propio correo al iniciar sesión.
  const SYNC_EMBED = { v: 2, owner: 'PaulHRios', repo: 'maya_datos' };
  const CUENTAS = [
    { // papá
      quien: 'papa',
      hash: 'c8007c8db38dd614d5a7c952441ecbed9f5e308bb123345eed934491102802ee',
      salt: 'uF99kb/0k1J/AAcX+NhDbA==',
      iv: 'kgAfVZ5MX8Kxxn4w',
      ct: '5IlzOdbChTbizV43V0kzbbd2alH9LOp1APWeVlDQ312coNMQgEwIWoVROgWl7NR/qBBKAeATq5bPNcIyARvBYO1q1YlD2T9t5Aax0SUJeWDt9ZD6JYMAAwmtmelFhsKiFqrZtu++viQrmbL+0w==',
    },
    { // mamá
      quien: 'mama',
      hash: 'ac5eafa3eff30b7d25e8d9c000fc797016e62aa59f40e701614107d0ad2e3b29',
      salt: 'Wr0uWFX0nvcly2gn6npc4A==',
      iv: 'eFZtpwHbVLfHezXa',
      ct: 'n5FMdsC2ympVA7vq5iydkkdRDDVYuII6A+QJIwucwri77zl63AgB6aP9/UM2jfhTnAUaQEFUlrShvwq7Fn2+NGXmcgC5qF1+MISzTB3IzWWs8NSrQGn1aTab2ddkeuPctwovqqOXShMZQPAabw==',
    },
    { // acceso original, de respaldo
      quien: '',
      hash: '4910db4d71ab6452a6b35ced89bce1f9ee91d93f878e263875f9f65cf463f718',
      salt: 'HGTGW4XkU8tbdNltmdURkQ==',
      iv: 'G+t9ttzdtRx6MbeR',
      ct: 'Z5yTBc7S0jcnX/NSiqpYBjbiHuG1qaKkWIlC88nopVS8M0lhz9tHNnGzHAJ7Fk2a+f7Udno0DxETsLyY80APyOYZoOcvIKoK53WMv/Mudr463UQVJ1v1ww4LVAjOXUSZFG99KTb5tMF+GtE0hA==',
    },
  ];

  async function descifrarToken(credencial, cuenta) {
    try {
      const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
      const material = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(credencial), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: b64(cuenta.salt), iterations: 310000, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const plano = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64(cuenta.iv) }, key, b64(cuenta.ct));
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
    banco: [],        // movimientos de leche {id, tipo, lugar, ml, fecha, notas, tomaId?, updatedAt}
    citas: [],        // citas médicas {id, titulo, lugar, fecha, notas, hecha, updatedAt}
    rutina: null,     // rutina de dormir {pasos:[{id, emoji, titulo, min}], hora, updatedAt}
    borrados: [],     // tombstones {col, id, at}
  });

  let data = emptyData();
  // el usuario/repo reales viven en SYNC_EMBED y solo se adoptan para la
  // familia original al cargar; el default arranca en blanco
  let config = { owner: '', repo: '', branch: 'main', token: '', autoSync: true, lastSync: null };
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
    const cuenta = CUENTAS.find(c => c.hash === h);
    if (!cuenta) {
      // cuentas locales creadas en este dispositivo (otras familias)
      const local = cuentasLocales().find(c => c.email === user.trim().toLowerCase());
      if (!local) return false;
      const { hash } = await hashPass(pass, local.salt);
      if (hash !== local.hash) return false;
      iniciarSesionFamilia(local.familia, local.quien, local.email);
      return true;
    }
    iniciarSesionFamilia('maya', cuenta.quien, user.trim().toLowerCase());

    // dejar lista la sincronización sin que haya que configurar nada.
    // Si la app trae un token embebido más nuevo (SYNC_EMBED.v), se adopta
    // al iniciar sesión: así basta cerrar y abrir sesión tras una rotación.
    try {
      const raw = localStorage.getItem(kConfig());
      if (raw) config = Object.assign(config, JSON.parse(raw));
      if (!config.token || (config.tokenV || 0) < (SYNC_EMBED.v || 1)) {
        const token = await descifrarToken(credencial, cuenta);
        if (token) {
          config.token = token;
          config.tokenV = SYNC_EMBED.v || 1;
          if (!config.owner) config.owner = SYNC_EMBED.owner;
          if (!config.repo) config.repo = SYNC_EMBED.repo;
          saveConfig();
        }
      }
    } catch (e) { console.error(e); }
    return true;
  }
  function hasRealSession() {
    const active = sesionActiva();
    // A real login always writes both keys. Older demos wrote only LS_SESSION.
    return localStorage.getItem(LS_SESSION) === 'ok' &&
      typeof active?.familia === 'string' && !!active.familia &&
      typeof active?.email === 'string' && !!active.email;
  }
  const hasSession = () => modoDemo || hasRealSession();
  function logout() {
    if (modoDemo) return;
    clearTimeout(syncTimer);
    localStorage.removeItem(LS_SESSION);
    localStorage.removeItem(LS_SESION_ACTIVA);
  }

  /* ---------- familias y cuentas locales (creadas en el dispositivo) ----------
     La familia original ('maya') usa las cuentas integradas de arriba con su
     nube preconfigurada. Las familias nuevas se crean aquí: credenciales con
     PBKDF2 en el dispositivo y datos locales, con opción de configurar su
     propia nube (repositorio privado + token) en Ajustes. */
  const LS_SESION_ACTIVA = 'maya.sesion-activa.v1';
  const LS_CUENTAS = 'maya.cuentas-locales.v1';

  function sesionActiva() {
    try { return JSON.parse(localStorage.getItem(LS_SESION_ACTIVA)) || null; }
    catch { return null; }
  }
  const familiaActiva = () => (sesionActiva() && sesionActiva().familia) || 'maya';

  function cuentasLocales() {
    try { return JSON.parse(localStorage.getItem(LS_CUENTAS)) || []; }
    catch { return []; }
  }

  const aB64 = a => btoa(String.fromCharCode(...new Uint8Array(a)));
  const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function hashPass(pass, saltB64) {
    const salt = saltB64 ? deB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, material, 256);
    return { salt: aB64(salt), hash: aB64(bits) };
  }

  async function crearCuenta({ email, pass, quien, familia, nombreBebe }) {
    if (modoDemo) return { error: 'Sal del demo para crear una cuenta' };
    email = (email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Correo no válido' };
    if ((pass || '').length < 8) return { error: 'La contraseña necesita al menos 8 caracteres' };
    const cuentas = cuentasLocales();
    if (cuentas.some(c => c.email === email)) return { error: 'Ese correo ya tiene cuenta en este dispositivo' };
    const esNueva = !familia;
    if (esNueva) {
      familia = uid();
      const bebeId = uid();
      const lista = getBebesGlobal();
      lista.push({ id: bebeId, nombre: nombreBebe || 'Bebé', familia, updatedAt: now() });
      guardarBebes(lista);
      const nuevo = emptyData();
      nuevo.bebe.nombre = nombreBebe || 'Bebé';
      localStorage.setItem(kData(bebeId), JSON.stringify(nuevo));
    }
    const { salt, hash } = await hashPass(pass);
    cuentas.push({ email, salt, hash, quien: quien || '', familia, creada: now() });
    localStorage.setItem(LS_CUENTAS, JSON.stringify(cuentas));
    return { ok: true, familia };
  }

  function cuentasDeFamilia() {
    if (modoDemo) return [{ email: 'mom@demo.family', quien: 'mama' }, { email: 'dad@demo.family', quien: 'papa' }];
    const f = familiaActiva();
    const propias = cuentasLocales().filter(c => c.familia === f).map(c => ({ email: c.email, quien: c.quien }));
    if (f === 'maya') return [{ email: 'papá (integrada)', quien: 'papa' }, { email: 'mamá (integrada)', quien: 'mama' }, ...propias];
    return propias;
  }

  function iniciarSesionFamilia(familia, quien, email) {
    if (modoDemo) return;
    localStorage.setItem(LS_SESION_ACTIVA, JSON.stringify({ familia, quien: quien || '', email: email || '' }));
    localStorage.setItem(LS_SESSION, 'ok');
    if (quien) setDispositivo(quien);
    // aterrizar en un bebé de esta familia
    const propios = getBebes();
    if (propios.length && !propios.some(b => b.id === bebeActivo)) {
      bebeActivo = propios[0].id;
      localStorage.setItem(LS_BEBE_ACTIVO, bebeActivo);
    }
  }

  /* ---------- varios bebés (hasta 5) ----------
     Cada bebé tiene su propio archivo de datos, timers y avatar.
     'maya' es el bebé original y conserva sus claves/archivos de siempre. */
  const LS_BEBES = 'maya.bebes.v1';
  const LS_BEBE_ACTIVO = 'maya.bebe-activo.v1';
  const MAX_BEBES = 5;

  let modoDemo = false, dispositivoDemo = '';
  let bebeActivo = localStorage.getItem(LS_BEBE_ACTIVO) || 'maya';

  // el demo se reinicia solo: si alguien lo llena de datos, a la media hora
  // vuelve al default para el siguiente que lo pruebe (y la edad queda fija).
  // Súbele la versión para forzar el re-seed tras un cambio (p. ej. fotos nuevas).
  const DEMO_VER = 3;
  const DEMO_TTL = 30 * 60 * 1000; // 30 minutos
  function activarDemo(seed) {
    modoDemo = true;
    bebeActivo = 'demo';                     // claves propias: jamás toca datos reales
    let reseed = !localStorage.getItem(kData('demo'));
    try {
      const meta = JSON.parse(localStorage.getItem('maya.demo-meta.v1') || 'null');
      if (!meta || meta.ver !== DEMO_VER || (Date.now() - (meta.at || 0)) > DEMO_TTL) reseed = true;
    } catch { reseed = true; }
    if (seed && reseed) {
      localStorage.setItem(kData('demo'), JSON.stringify(seed));
      localStorage.removeItem(kTimers('demo'));   // limpia timers del intento anterior
      localStorage.removeItem(kAvatar('demo'));
      localStorage.setItem('maya.demo-meta.v1', JSON.stringify({ ver: DEMO_VER, at: Date.now() }));
    }
  }
  const kData = id => id === 'maya' ? LS_DATA : `${LS_DATA}.${id}`;
  const kTimers = id => id === 'maya' ? LS_TIMERS : `${LS_TIMERS}.${id}`;
  const archivoDatos = id => id === 'maya' ? 'datos/maya.json' : `datos/bebe-${id}.json`;

  function getBebesGlobal() {
    try { return JSON.parse(localStorage.getItem(LS_BEBES)) || []; }
    catch { return []; }
  }

  function getBebes() {
    if (modoDemo) return [{ id: 'demo', nombre: (data.bebe && data.bebe.nombre) || 'Emma', updatedAt: '' }];
    const f = familiaActiva();
    const lista = getBebesGlobal().filter(b => (b.familia || 'maya') === f);
    if (f === 'maya' && !lista.some(b => b.id === 'maya')) lista.unshift({ id: 'maya', nombre: 'Maya', familia: 'maya', updatedAt: '' });
    return lista;
  }
  function guardarBebes(lista) { localStorage.setItem(LS_BEBES, JSON.stringify(lista)); }

  function actualizarPerfilActivo() {
    if (modoDemo) return; // el demo nunca escribe perfiles reales
    const lista = getBebesGlobal();
    const p = lista.find(b => b.id === bebeActivo);
    const nombre = (data.bebe && data.bebe.nombre) || 'Bebé';
    if (p && p.nombre !== nombre) { p.nombre = nombre; p.updatedAt = now(); guardarBebes(lista); }
    else if (!p && bebeActivo !== 'demo') { lista.push({ id: bebeActivo, nombre, familia: familiaActiva(), updatedAt: now() }); guardarBebes(lista); }
  }

  function cambiarBebe(id) {
    if (id === bebeActivo) return;
    persistir(bebeActivo, data); // asegurar guardado
    bebeActivo = id;
    localStorage.setItem(LS_BEBE_ACTIVO, id);
    data = emptyData();
    loadLocal();
    notify();
    scheduleSync();
  }

  function agregarBebe(nombre) {
    if (modoDemo) return null;
    if (getBebes().length >= MAX_BEBES) return null;
    const id = uid();
    const lista = getBebesGlobal();
    lista.push({ id, nombre, familia: familiaActiva(), updatedAt: now() });
    guardarBebes(lista);
    const nuevo = emptyData();
    nuevo.bebe.nombre = nombre;
    localStorage.setItem(kData(id), JSON.stringify(nuevo));
    cambiarBebe(id);
    return id;
  }

  /* ---------- persistencia local ---------- */
  const kConfig = () => familiaActiva() === 'maya' ? LS_CONFIG : `${LS_CONFIG}.${familiaActiva()}`;

  function loadLocal() {
    try {
      const raw = localStorage.getItem(kData(bebeActivo));
      if (raw) data = Object.assign(emptyData(), JSON.parse(raw));
      config = { owner: '', repo: '', branch: 'main', token: '', autoSync: true, lastSync: null };
      if (modoDemo) return; // el demo jamás ve la configuración real
      const rawCfg = localStorage.getItem(kConfig());
      if (rawCfg) config = Object.assign(config, JSON.parse(rawCfg));
      if (familiaActiva() === 'maya') {
        // la familia original trae su nube preconfigurada
        if (!config.owner) config.owner = SYNC_EMBED.owner;
        if (!config.repo) config.repo = SYNC_EMBED.repo;
      }
    } catch (e) { console.error('Error cargando datos locales', e); }
  }

  // guarda en localStorage sin reventar la cuota: las fotos YA sincronizadas
  // se guardan sin su dataUrl (se pueden volver a bajar del repo). Si aún así
  // no cabe, suelta todos los dataUrl. Nunca lanza: devuelve true/false.
  function persistir(id, d) {
    const sinSync = f => f.sincronizada && f.dataUrl ? { ...f, dataUrl: undefined } : f;
    const sinNada = f => ({ ...f, dataUrl: undefined, miniaturaPendiente: undefined });
    for (const trim of [sinSync, sinNada]) {
      try {
        const copia = { ...d, fotos: (d.fotos || []).map(trim) };
        localStorage.setItem(kData(id), JSON.stringify(copia));
        return true;
      } catch (e) { /* cuota llena: probamos con menos */ }
    }
    console.error('No se pudo guardar en localStorage (cuota llena)');
    return false;
  }

  function saveLocal() {
    persistir(bebeActivo, data);
    actualizarPerfilActivo();
    notify();
    scheduleSync();   // aunque falle el guardado local, se intenta subir al repo
  }

  function saveConfig() {
    if (modoDemo) return; // nada del demo se persiste como configuración real
    localStorage.setItem(kConfig(), JSON.stringify(config));
  }

  // un error al refrescar la vista nunca debe impedir que se guarden los datos
  function notify() {
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  }
  function onChange(fn) { listeners.push(fn); }

  /* ---------- CRUD genérico ---------- */
  const COLS = ['tomas', 'suenos', 'panales', 'condiciones', 'intervenciones', 'medicamentos', 'crecimiento', 'fotos', 'actividades', 'banco', 'citas'];

  function add(col, item) {
    item.id = item.id || uid();
    item.updatedAt = now();
    // cada registro queda firmado por quien lo agregó desde su cuenta
    if (!item.autor && getDispositivo()) item.autor = getDispositivo();
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
    const removed = col === 'fotos' ? data.fotos.find(f => f.id === id) : null;
    if (removed && !modoDemo) {
      MayaPhotoThumbs.discard(photoCacheScope(), photoKey(removed)).catch(() => {});
      if (removed.miniatura && removed.archivo && canSync()) queueThumbRemoval(removed.archivo);
    }
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

  /* identidad del dispositivo: a quién pertenece este teléfono.
     Se guarda localmente en cada equipo, una sola vez. */
  const LS_DISPOSITIVO = 'maya.dispositivo.v1';
  const getDispositivo = () => modoDemo ? dispositivoDemo : localStorage.getItem(LS_DISPOSITIVO) || '';
  function setDispositivo(v) {
    if (modoDemo) dispositivoDemo = v;
    else localStorage.setItem(LS_DISPOSITIVO, v);
  }

  /* foto de perfil: vive en el repo privado; se cachea por dispositivo */
  const LS_AVATAR = 'maya.avatar.v1';
  const kAvatar = id => id === 'maya' ? LS_AVATAR : `${LS_AVATAR}.${id}`;
  const archivoAvatar = id => id === 'maya' ? 'fotos/avatar.jpg' : `fotos/avatar-${id}.jpg`;
  function getAvatarCache() { return localStorage.getItem(kAvatar(bebeActivo)); }
  async function fetchAvatar() {
    if (!canSync()) return getAvatarCache();
    try {
      const f = await ghGetFile(archivoAvatar(bebeActivo));
      if (!f || !f.content) return getAvatarCache();
      const url = `data:image/jpeg;base64,${f.content.replace(/\n/g, '')}`;
      localStorage.setItem(kAvatar(bebeActivo), url);
      return url;
    } catch { return getAvatarCache(); }
  }

  /* ---------- timers persistentes (lactancia / sueño) ---------- */
  function getTimers() {
    try { return JSON.parse(localStorage.getItem(kTimers(bebeActivo))) || {}; }
    catch { return {}; }
  }
  function setTimers(t) {
    localStorage.setItem(kTimers(bebeActivo), JSON.stringify(t));
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
    merged.rutina = (remote.rutina && (!data.rutina || (remote.rutina.updatedAt || '') > (data.rutina.updatedAt || '')))
      ? remote.rutina : data.rutina;

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
    // conservar el dataUrl de las fotos ya descargadas: el remoto no lo trae
    // (se guarda aparte) y sin esto la galería tendría que volver a bajarlas
    const localPhotos = new Map((data.fotos || []).map(f => [f.id, f]));
    merged.fotos.forEach(f => {
      const local = localPhotos.get(f.id);
      if (!local || local.archivo !== f.archivo) return;
      if (!f.dataUrl && local.dataUrl) f.dataUrl = local.dataUrl;
      if (local.miniaturaPendiente) f.miniaturaPendiente = local.miniaturaPendiente;
      if (local.miniaturaSubida) f.miniaturaSubida = true;
    });
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
    // por bloques: desparramar cada byte como argumento individual
    // revienta la pila del iPhone cuando el archivo crece (>~65 KB)
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const BLOQUE = 0x8000;
    for (let i = 0; i < bytes.length; i += BLOQUE) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + BLOQUE));
    }
    return btoa(bin);
  }
  function b64decodeUtf8(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }

  async function ghGetFile(path, options = {}) {
    const res = await fetch(`${apiBase()}/${path}?ref=${config.branch}&t=${Date.now()}`, { headers: headers(), ...options });
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

  const canSync = () => !modoDemo && hasRealSession() && !!(config.token && config.owner && config.repo);

  function setSyncState(s) {
    syncState = s;
    notify();
  }

  // A sidecar exists only for new user uploads. A legacy read never writes or
  // mutates the record; clients without the sidecar field continue opening JPEGs.
  const validPhotoFile = filename => typeof filename === 'string' && /^[a-z0-9._-]+\.jpe?g$/i.test(filename) && !filename.startsWith('.');
  const thumbPath = filename => `fotos/miniaturas/${encodeURIComponent(filename)}`;
  const photoPath = filename => `fotos/${encodeURIComponent(filename)}`;
  function photoCacheScope() {
    return JSON.stringify(modoDemo
      ? ['demo']
      : [familiaActiva(), sesionActiva()?.email || getDispositivo(), bebeActivo, config.owner, config.repo, config.branch]);
  }
  function pushOwner() {
    if (modoDemo || !hasRealSession()) return '';
    return JSON.stringify([familiaActiva(), sesionActiva()?.email || getDispositivo()]);
  }
  const pushEnrollmentEligible = () => !!pushOwner() && familiaActiva() === 'maya';
  async function pushEnrollmentCode(owner) {
    const authorized = () => owner && owner === pushOwner() && pushEnrollmentEligible()
      && canSync() && config.owner === SYNC_EMBED.owner && config.repo === SYNC_EMBED.repo
      && config.branch === 'main';
    if (!authorized()) throw new Error('enrollment-unavailable');
    try {
      const file = await ghGetFile('config/push-enrollment-v1.json', {
        cache:'no-store', redirect:'error', signal:AbortSignal.timeout(6000),
      });
      if (!authorized() || file?.type !== 'file' || file.encoding !== 'base64'
        || typeof file.content !== 'string' || file.content.length > 2048) throw new Error();
      const data = JSON.parse(b64decodeUtf8(file.content));
      if (data?.version !== 1 || typeof data.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.code)) throw new Error();
      return data.code;
    } catch { throw new Error('enrollment-unavailable'); }
  }
  const photoKey = f => JSON.stringify([f.id, f.archivo || '', f.fecha || '']);
  const thumbRemovalKey = () => 'maya.thumb-removal.v1.' + photoCacheScope();
  function queueThumbRemoval(filename) {
    if (!validPhotoFile(filename)) return;
    try {
      const key = thumbRemovalKey();
      const pending = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
      pending.add(filename);
      localStorage.setItem(key, JSON.stringify([...pending].slice(-100)));
    } catch { /* The existing local deletion still succeeds. */ }
  }
  async function syncPhotoRemovals(scope) {
    const key = thumbRemovalKey();
    let pending;
    try { pending = JSON.parse(localStorage.getItem(key) || '[]'); } catch { return; }
    for (const filename of pending) {
      if (scope !== photoCacheScope() || !canSync()) return;
      if (!validPhotoFile(filename)) continue;
      try {
        const path = thumbPath(filename);
        const remote = await ghGetFile(path);
        if (scope !== photoCacheScope() || !canSync()) return;
        if (remote?.sha) {
          const r = await fetch(`${apiBase()}/${path}`, {
            method: 'DELETE', headers: headers(),
            body: JSON.stringify({ sha: remote.sha, branch: config.branch, message: 'Eliminar miniatura de foto' }),
          });
          if (!r.ok && r.status !== 404) continue;
        }
        const fresh = JSON.parse(localStorage.getItem(key) || '[]').filter(f => f !== filename);
        localStorage.setItem(key, JSON.stringify(fresh));
      } catch { /* leave queued for the next sync */ }
    }
  }
  async function syncPhotos(scope) {
    for (const foto of data.fotos) {
      if (scope !== photoCacheScope() || !canSync()) return;
      if (!validPhotoFile(foto.archivo) || !data.fotos.includes(foto)) continue;
      if (!foto.sincronizada && foto.dataUrl) {
        const b64 = foto.dataUrl.split(',')[1];
        try {
          await ghPutFile(photoPath(foto.archivo), b64, null, `Foto: ${foto.titulo || foto.archivo}`);
        } catch (e) {
          if (!String(e.message).includes('422')) continue;
          // A GitHub 422 does not always imply a duplicate.
          try { if (!await ghGetFile(photoPath(foto.archivo))) continue; } catch { continue; }
        }
        if (scope !== photoCacheScope() || !canSync()) return;
        if (!data.fotos.includes(foto)) continue;
        foto.sincronizada = true;
        foto.updatedAt = now();
      }
      if (foto.sincronizada && foto.miniatura && (foto.miniaturaPendiente || (foto.dataUrl && !foto.miniaturaSubida))) {
        let src = foto.miniaturaPendiente || await MayaPhotoThumbs.resize(foto.dataUrl);
        if (scope !== photoCacheScope() || !canSync()) return;
        if (!src || !data.fotos.includes(foto)) continue;
        try {
          const path = thumbPath(foto.archivo);
          try {
            await ghPutFile(path, src.split(',')[1], null, 'Miniatura de foto');
          } catch (e) {
            if (!String(e.message).includes('422')) throw e;
            const existing = await ghGetFile(path);
            if (!existing?.content) throw e;
          }
          foto.miniaturaSubida = true;
          delete foto.miniaturaPendiente;
        } catch {
          foto.miniaturaPendiente = src; // retry on the next normal/manual sync
        }
      }
    }
    await syncPhotoRemovals(scope);
  }

  const originalPending = new Map();
  async function fetchPhoto(foto, { retain = true } = {}) {
    if (foto.dataUrl) return foto.dataUrl;
    if (!canSync() || !validPhotoFile(foto.archivo)) return null;
    const scope = photoCacheScope(), key = JSON.stringify([scope, photoKey(foto)]);
    const path = photoPath(foto.archivo);
    if (!originalPending.has(key)) {
      originalPending.set(key, ghPhotoSource(path).finally(() => originalPending.delete(key)));
    }
    const src = await originalPending.get(key);
    if (!src || scope !== photoCacheScope() || !canSync()) return null;
    if (retain) foto.dataUrl = src;
    return src;
  }
  async function ghPhotoSource(path) {
    // Capture credentials and target together before awaiting. A late response
    // must not make a subsequent raw request against a new family's backend.
    const url = `${apiBase()}/${path}?ref=${encodeURIComponent(config.branch)}`;
    const auth = headers();
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 12000);
    try {
      const meta = await fetch(url, { headers: auth, cache: 'no-store', signal: abort.signal });
      if (!meta.ok) return null;
      const f = await meta.json();
      if (f.content) return `data:image/jpeg;base64,${f.content.replace(/\n/g, '')}`;
      const r = await fetch(url, {
        headers: { ...auth, Accept: 'application/vnd.github.raw+json' }, cache: 'no-store', signal: abort.signal,
      });
      if (!r.ok) return null;
      const blob = await r.blob();
      return new Promise(resolve => {
        const fr = new FileReader();
        fr.onload = () => resolve(`data:image/jpeg;base64,${String(fr.result).split(',')[1]}`);
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(blob);
      });
    } catch { return null; }
    finally { clearTimeout(timeout); }
  }
  async function fetchThumb(foto) {
    const scope = photoCacheScope();
    const demo = modoDemo;
    return MayaPhotoThumbs.get({
      scope, file: photoKey(foto), persist: !demo,
      stillCurrent: () => scope === photoCacheScope() && (demo || hasSession()),
      load: async () => {
        if (MayaPhotoThumbs.valid(foto.miniaturaPendiente)) return foto.miniaturaPendiente;
        if (foto.miniatura && canSync() && validPhotoFile(foto.archivo)) {
          const src = await ghPhotoSource(thumbPath(foto.archivo));
          if (MayaPhotoThumbs.valid(src)) return src;
        }
        if (scope !== photoCacheScope() || (!demo && !hasSession())) return null;
        // Legacy preview: generate it during the first read, then use the
        // phone's compact cache. Never backfill old records remotely.
        return MayaPhotoThumbs.resize(foto.dataUrl || await fetchPhoto(foto, { retain: false }));
      },
    });
  }

  let syncing = false;
  async function syncNow() {
    if (!canSync() || syncing) return;
    syncing = true;
    setSyncState('busy');
    const idSync = bebeActivo;
    const scope = photoCacheScope(); // por si cambian de bebé a media sincronización
    try {
      const remoteFile = await ghGetFile(archivoDatos(idSync));
      if (scope !== photoCacheScope() || !canSync()) return;
      let sha = null;
      if (remoteFile) {
        sha = remoteFile.sha;
        let texto;
        if (remoteFile.content) {
          texto = b64decodeUtf8(remoteFile.content);
        } else if (remoteFile.download_url) {
          // archivos >1MB: la API ya no regresa el contenido inline
          const r = await fetch(remoteFile.download_url);
          if (!r.ok) throw new Error(`GitHub raw ${r.status}`);
          texto = await r.text();
        }
        if (scope !== photoCacheScope() || !canSync()) return;
        if (texto) data = mergeData(JSON.parse(texto));
      }
      // primero los registros: una foto atorada nunca debe bloquearlos
      const slim = JSON.parse(JSON.stringify(data));
      slim.fotos = slim.fotos.map(f => { const c = { ...f }; delete c.dataUrl; delete c.miniaturaPendiente; delete c.miniaturaSubida; return c; });
      await ghPutFile(archivoDatos(idSync), b64encodeUtf8(JSON.stringify(slim, null, 1)), sha, `Registro ${new Date().toLocaleString('es-MX')}`);
      if (scope !== photoCacheScope() || !canSync()) return;
      config.lastSync = now();
      saveConfig();
      persistir(idSync, data);
      setSyncState('ok');
      try {
        await syncPhotos(scope);
        if (scope !== photoCacheScope() || !canSync()) return;
        persistir(idSync, data);
      } catch (e) {
        console.error('Fotos pendientes de subir', e);
      }
      // perfiles de bebés compartidos entre los dos teléfonos
      try {
        const pf = await ghGetFile('datos/perfiles.json');
        if (scope !== photoCacheScope() || !canSync()) return;
        const remotos = pf && pf.content ? JSON.parse(b64decodeUtf8(pf.content)) : [];
        const porId = new Map();
        [...remotos, ...getBebes()].forEach(p => {
          const prev = porId.get(p.id);
          if (!prev || (p.updatedAt || '') > (prev.updatedAt || '')) porId.set(p.id, p);
        });
        const fusion = [...porId.values()].map(p => ({ ...p, familia: p.familia || familiaActiva() }));
        const otras = getBebesGlobal().filter(b => (b.familia || 'maya') !== familiaActiva());
        guardarBebes([...otras, ...fusion]);
        const json = JSON.stringify(fusion, null, 1);
        if (!pf || b64decodeUtf8(pf.content) !== json) {
          await ghPutFile('datos/perfiles.json', b64encodeUtf8(json), pf ? pf.sha : null, 'Perfiles de bebés');
        }
      } catch (e) { console.error('Perfiles no sincronizados', e); }
    } catch (e) {
      console.error('Error de sincronización', e);
      if (scope === photoCacheScope()) setSyncState('error');
    } finally {
      syncing = false;
      if (scope !== photoCacheScope()) scheduleSync();
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
    login, hasSession, hasRealSession, logout,
    loadLocal, saveLocal, saveConfig,
    add, update, remove, onChange,
    marcarActividad, fetchAvatar, getAvatarCache,
    getDispositivo, setDispositivo,
    getBebes, cambiarBebe, agregarBebe, activarDemo,
    crearCuenta, cuentasDeFamilia, entrarAFamilia: iniciarSesionFamilia,
    get familiaActiva() { return familiaActiva(); },
    get modoDemo() { return modoDemo; },
    get bebeActivo() { return bebeActivo; },
    getTimers, setTimers,
    syncNow, scheduleSync, testConnection, canSync, fetchPhoto, fetchThumb, photoCacheScope, pushOwner, pushEnrollmentCode, pushEnrollmentEligible,
    get data() { return data; },
    set data(d) { data = d; },
    get config() { return config; },
    get syncState() { return syncState; },
    emptyData, uid,
  };
})();
