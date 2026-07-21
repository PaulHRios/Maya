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
  const hasSession = () => localStorage.getItem(LS_SESSION) === 'ok';
  const logout = () => { localStorage.removeItem(LS_SESSION); localStorage.removeItem(LS_SESION_ACTIVA); };

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

  let modoDemo = false;
  let bebeActivo = localStorage.getItem(LS_BEBE_ACTIVO) || 'maya';

  // el demo se reinicia solo: si alguien lo llena de datos, a la media hora
  // vuelve al default para el siguiente que lo pruebe (y la edad queda fija).
  // Súbele la versión para forzar el re-seed tras un cambio (p. ej. fotos nuevas).
  const DEMO_VER = 3;
  const DEMO_TTL = 30 * 60 * 1000; // 30 minutos
  function activarDemo(seed) {
    modoDemo = true;
    bebeActivo = 'demo';                     // claves propias: jamás toca datos reales
    localStorage.setItem(LS_SESSION, 'ok');  // el demo entra directo
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
    localStorage.setItem(kData(bebeActivo), JSON.stringify(data)); // asegurar guardado
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

  function saveLocal() {
    localStorage.setItem(kData(bebeActivo), JSON.stringify(data));
    actualizarPerfilActivo();
    notify();
    scheduleSync();
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
  const getDispositivo = () => localStorage.getItem(LS_DISPOSITIVO) || '';
  const setDispositivo = v => localStorage.setItem(LS_DISPOSITIVO, v);

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
    const dataUrlPorId = new Map((data.fotos || []).filter(f => f.dataUrl).map(f => [f.id, f.dataUrl]));
    merged.fotos.forEach(f => { if (!f.dataUrl && dataUrlPorId.has(f.id)) f.dataUrl = dataUrlPorId.get(f.id); });
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

  const canSync = () => !modoDemo && !!(config.token && config.owner && config.repo);

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
      localStorage.setItem(kData(bebeActivo), JSON.stringify(data));
      return foto.dataUrl;
    } catch (e) { console.error('Foto no disponible', e); return null; }
  }

  let syncing = false;
  async function syncNow() {
    if (!canSync() || syncing) return;
    syncing = true;
    setSyncState('busy');
    const idSync = bebeActivo; // por si cambian de bebé a media sincronización
    try {
      const remoteFile = await ghGetFile(archivoDatos(idSync));
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
        if (texto) data = mergeData(JSON.parse(texto));
      }
      // primero los registros: una foto atorada nunca debe bloquearlos
      const slim = JSON.parse(JSON.stringify(data));
      slim.fotos = slim.fotos.map(f => { const c = { ...f }; delete c.dataUrl; return c; });
      await ghPutFile(archivoDatos(idSync), b64encodeUtf8(JSON.stringify(slim, null, 1)), sha, `Registro ${new Date().toLocaleString('es-MX')}`);
      config.lastSync = now();
      saveConfig();
      localStorage.setItem(kData(idSync), JSON.stringify(data));
      setSyncState('ok');
      try {
        await syncPhotos();
        localStorage.setItem(kData(idSync), JSON.stringify(data));
      } catch (e) {
        console.error('Fotos pendientes de subir', e);
      }
      // perfiles de bebés compartidos entre los dos teléfonos
      try {
        const pf = await ghGetFile('datos/perfiles.json');
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
    getDispositivo, setDispositivo,
    getBebes, cambiarBebe, agregarBebe, activarDemo,
    crearCuenta, cuentasDeFamilia, entrarAFamilia: iniciarSesionFamilia,
    get familiaActiva() { return familiaActiva(); },
    get modoDemo() { return modoDemo; },
    get bebeActivo() { return bebeActivo; },
    getTimers, setTimers,
    syncNow, scheduleSync, testConnection, canSync, fetchPhoto,
    get data() { return data; },
    set data(d) { data = d; },
    get config() { return config; },
    get syncState() { return syncState; },
    emptyData, uid,
  };
})();
