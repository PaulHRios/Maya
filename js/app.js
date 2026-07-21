/* ============ Maya — interfaz ============ */

(() => {
  const $ = sel => document.querySelector(sel);
  const main = $('#main');

  let tabActual = 'inicio';
  let vistaMas = null; // subvista dentro de "Más"
  let tickInterval = null;

  /* ---------- formato ---------- */
  const fmtHora = iso => new Date(iso).toLocaleTimeString(I18N.loc(), { hour: '2-digit', minute: '2-digit' });
  const fmtFechaLarga = d => d.toLocaleDateString(I18N.loc(), { weekday: 'long', day: 'numeric', month: 'long' });

  function fmtDia(iso) {
    const d = new Date(iso), hoy = new Date();
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
    const en = I18N.lang === 'en';
    if (d.toDateString() === hoy.toDateString()) return en ? 'Today' : 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return en ? 'Yesterday' : 'Ayer';
    return d.toLocaleDateString(I18N.loc(), { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function hace(iso) {
    const min = Math.floor((Date.now() - new Date(iso)) / 60000);
    const en = I18N.lang === 'en';
    if (min < 1) return en ? 'just now' : 'ahora mismo';
    if (min < 60) return en ? `${min} min ago` : `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) {
      const rm = min % 60;
      if (en) return rm ? `${h} h ${rm} min ago` : `${h} h ago`;
      return rm ? `hace ${h} h ${rm} min` : `hace ${h} h`;
    }
    const dd = Math.floor(h / 24);
    return en ? `${dd} day${dd === 1 ? '' : 's'} ago` : `hace ${dd} día${dd === 1 ? '' : 's'}`;
  }

  function fmtDur(seg) {
    const m = Math.floor(seg / 60), s = Math.floor(seg % 60);
    if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function fmtDurLarga(ms) {
    const min = Math.round(ms / 60000);
    return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
  }

  // para <input type="datetime-local">
  function aInputLocal(iso) {
    const d = iso ? new Date(iso) : new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
  const deInputLocal = v => new Date(v).toISOString();

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // nombre del bebé activo (nunca el real de otra familia); genérico si aún no lo ponen
  const nb = () => esc(Store.data.bebe.nombre || (I18N.lang === 'en' ? 'your baby' : 'tu bebé'));

  /* ---------- toast y hoja modal ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    // traduce automáticamente los toasts que estén en el diccionario;
    // los que ya vienen en inglés o llevan variables se muestran igual
    t.textContent = I18N.t(msg);
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  function abrirSheet(html) {
    $('#sheet-content').innerHTML = html;
    I18N.aplicar($('#sheet-content'));
    $('#sheet').classList.remove('hidden');
    $('#sheet-backdrop').classList.remove('hidden');
  }
  function cerrarSheet() {
    const sheet = $('#sheet'), back = $('#sheet-backdrop');
    if (sheet.classList.contains('hidden')) return;
    sheet.classList.add('cerrando');
    back.classList.add('cerrando');
    setTimeout(() => {
      sheet.classList.add('hidden');
      back.classList.add('hidden');
      sheet.classList.remove('cerrando');
      back.classList.remove('cerrando');
    }, 210);
  }
  $('#sheet-backdrop').addEventListener('click', cerrarSheet);

  /* ---------- agrupar registros por día ---------- */
  function porDia(items, campoFecha) {
    const grupos = [];
    const orden = [...items].sort((a, b) => (b[campoFecha] || '').localeCompare(a[campoFecha] || ''));
    for (const item of orden) {
      const dia = fmtDia(item[campoFecha]);
      let g = grupos.find(x => x.dia === dia);
      if (!g) { g = { dia, items: [] }; grupos.push(g); }
      g.items.push(item);
    }
    return grupos;
  }

  function listaEntradas(grupos, renderEntry, vacio) {
    if (!grupos.length) return `<div class="empty-state"><span class="big">${vacio.emoji}</span>${vacio.texto}</div>`;
    return grupos.map(g => `
      <div class="day-label">${g.dia}</div>
      <div class="entry-list">${g.items.map(renderEntry).join('')}</div>
    `).join('');
  }

  const btnsEntrada = (col, id) => `
    <div class="entry-actions">
      <button data-edit="${col}:${id}">✏️</button>
      <button data-del="${col}:${id}">🗑️</button>
    </div>`;

  /* ============================================================
     INICIO
  ============================================================ */
  function fechaLocal(d = new Date()) {
    d = new Date(d);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function edadDias() {
    const b = Store.data.bebe;
    if (!b.nacimiento) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(`${b.nacimiento}T${b.hora || '12:00'}`)) / 86400000));
  }

  // semana 0 = días 0–6 de vida; cambia en cada múltiplo de 7 días.
  // El recordatorio sigue apareciendo hasta que la foto de esa semana exista.
  const semanaActual = () => {
    const e = edadDias();
    return e === null ? null : Math.floor(e / 7);
  };

  function bannerFotoSemanal() {
    const sem = semanaActual();
    if (sem === null || Store.data.fotos.some(f => f.semana === sem)) return '';
    return `<div class="foto-semanal">
      <span class="fs-emoji">📸</span>
      <div>
        <div class="fs-titulo">Foto de la semana ${sem}</div>
        <div class="fs-sub">Su retrato semanal para ver cómo crece</div>
      </div>
      <button data-accion="foto-semanal" data-sem="${sem}">Tomarla</button>
    </div>`;
  }

  function renderInicio() {
    const d = Store.data;
    const hoy = new Date();
    const esHoy = iso => new Date(iso).toDateString() === hoy.toDateString();

    const ultToma = [...d.tomas].sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
    const ultPanal = [...d.panales].sort((a, b) => b.hora.localeCompare(a.hora))[0];

    const tomasHoy = d.tomas.filter(t => esHoy(t.inicio));
    const mlHoy = tomasHoy.reduce((s, t) => s + (Number(t.ml) || 0), 0);
    const minPechoHoy = Math.round(tomasHoy.reduce((s, t) => s + (t.duracionSeg || 0), 0) / 60);
    const popoHoy = d.panales.filter(p => esHoy(p.hora) && (p.tipo === 'popo' || p.tipo === 'mixto')).length;
    const pipiHoy = d.panales.filter(p => esHoy(p.hora) && (p.tipo === 'pipi' || p.tipo === 'mixto')).length;
    // pañales físicos gastados: cada registro es un pañal (mixto cuenta uno)
    const panalesHoy = d.panales.filter(p => esHoy(p.hora)).length;

    const enI = I18N.lang === 'en';
    const nombreTipo = enI
      ? { materno: 'Breast milk', donante: 'Expressed milk', formula: 'Formula' }
      : { materno: 'Leche materna', donante: 'Leche extraída', formula: 'Fórmula' };
    const descToma = t => {
      if (!t) return enI ? 'No entries yet' : 'Aún sin registros';
      const partes = [nombreTipo[t.tipo]];
      if (t.lado) partes.push(t.lado === 'izq' ? (enI ? 'left' : 'izquierda') : (enI ? 'right' : 'derecha'));
      if (t.duracionSeg) partes.push(`${Math.round(t.duracionSeg / 60)} min`);
      if (t.ml) partes.push(`${t.ml} ml`);
      return partes.join(' · ');
    };

    const h = new Date().getHours();
    const enH = I18N.lang === 'en';
    const saludo = h < 6 ? (enH ? 'Quiet night' : 'Madrugada tranquila') : h < 12 ? (enH ? 'Good morning' : 'Buenos días') : h < 19 ? (enH ? 'Good afternoon' : 'Buenas tardes') : (enH ? 'Good evening' : 'Buenas noches');
    const emojiH = h < 6 ? '🌙' : h < 12 ? '☀️' : h < 19 ? '🌤️' : '✨';
    const quienSaludo = nombreQuien(Store.getDispositivo());
    main.innerHTML = `
      <div class="hero-inicio">
        <span class="hi-emoji">${emojiH}</span>
        <div>
          <div class="hi-saludo">${saludo}${quienSaludo ? `, ${esc(quienSaludo)}` : ''}</div>
          <div class="hi-frase">${enH ? `Here's how ${esc(d.bebe.nombre || 'baby')}'s day is going` : `Así va el día de ${esc(d.bebe.nombre || 'la bebé')}`}</div>
        </div>
      </div>
      ${bannerFotoSemanal()}
      <div class="quick-actions">
        <button class="quick-btn" data-accion="toma-izq"><span>🤱</span>Pecho izq.</button>
        <button class="quick-btn" data-accion="toma-der"><span>🤱</span>Pecho der.</button>
        <button class="quick-btn" data-accion="dormir"><span>😴</span>A dormir</button>
        <button class="quick-btn" data-accion="panal-pipi"><span>💧</span>Pipí</button>
        <button class="quick-btn" data-accion="panal-popo"><span>💩</span>Popó</button>
        <button class="quick-btn" data-accion="biberon"><span>🍼</span>Biberón</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card bg-peach">
          <span class="stat-emoji">🍼</span>
          <span class="stat-value">${tomasHoy.length} tomas</span>
          <span class="stat-label">${mlHoy ? `${mlHoy} ml` : ''}${mlHoy && minPechoHoy ? ' · ' : ''}${minPechoHoy ? `${minPechoHoy} min ${enI ? 'breast' : 'pecho'}` : (mlHoy ? '' : (enI ? 'today' : 'hoy'))}</span>
          <span class="stat-ago">${ultToma ? `última ${hace(ultToma.inicio)}` : ''}</span>
        </div>
        <div class="stat-card bg-yellow">
          <span class="stat-emoji">🧷</span>
          <span class="stat-value">${panalesHoy} ${enI ? (panalesHoy === 1 ? 'diaper' : 'diapers') : 'pañal' + (panalesHoy === 1 ? '' : 'es')}</span>
          <span class="stat-label">${enI ? 'used today' : 'gastados hoy'}</span>
          <span class="stat-ago">${ultPanal ? (enI ? `last ${hace(ultPanal.hora)}` : `último ${hace(ultPanal.hora)}`) : ''}</span>
        </div>
        <div class="stat-card bg-blue">
          <span class="stat-emoji">💧</span>
          <span class="stat-value">${pipiHoy} ${enI ? 'pee' : 'pipí'}</span>
          <span class="stat-label">${enI ? 'today' : 'hoy'}</span>
        </div>
        <div class="stat-card bg-mint">
          <span class="stat-emoji">💩</span>
          <span class="stat-value">${popoHoy} ${enI ? 'poop' : 'popó'}</span>
          <span class="stat-label">${enI ? 'today' : 'hoy'}</span>
        </div>
      </div>

      <div style="margin-top:14px">${bancoCardInicio()}</div>
      ${(() => {
        const r = Analisis.generar(Store.data, edadDias());
        return `<div class="analisis-mini" data-accion="ver-analisis">
          <span class="am-emoji">${r.estado.emoji}</span>
          <span class="am-texto">${r.estado.titulo}<span class="am-sub">${enI ? `${r.hallazgos.length} point${r.hallazgos.length === 1 ? '' : 's'} in today's check · tap to view` : `${r.hallazgos.length} punto${r.hallazgos.length === 1 ? '' : 's'} en su análisis de hoy · toca para ver`}</span></span>
          <span class="mi-chev" style="color:#d4c6cd">›</span>
        </div>`;
      })()}

      <div class="card">
        <h2>Última toma</h2>
        <div class="card-row">
          <div>
            <div style="font-weight:700">${descToma(ultToma)}</div>
            ${ultToma ? `<div style="font-size:13px;color:var(--text-2);margin-top:2px">${fmtDia(ultToma.inicio)} a las ${fmtHora(ultToma.inicio)} · ${hace(ultToma.inicio)}${etiquetaAutor(ultToma)}</div>` : ''}
          </div>
        </div>
      </div>
      ${condicionesResumen()}
    `;
  }

  function condicionesResumen() {
    const conds = Store.data.condiciones.filter(c => !c.curada);
    if (!conds.length) return '';
    return `<div class="card condition-card">
      <h2>Seguimiento médico</h2>
      ${conds.map(c => {
        const meds = [...(c.mediciones || [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
        const ult = meds[0];
        let txt = 'sin mediciones';
        if (ult) txt = (ult.valor === null || ult.valor === '')
          ? `resultado pendiente (${hace(ult.fecha)})`
          : `${ult.valor}${c.unidad ? ` ${c.unidad}` : ''} · ${hace(ult.fecha)}`;
        return `<div class="measure-row"><span>${esc(c.nombre)}</span><span class="measure-val">${txt}</span></div>`;
      }).join('')}
    </div>`;
  }

  /* ============================================================
     COMIDA
  ============================================================ */
  let tipoComida = 'materno';

  function renderComida() {
    const timers = Store.getTimers();
    const d = Store.data;
    const enC = I18N.lang === 'en';
    const nombreTipo = enC
      ? { materno: 'Breast', donante: 'Expressed', formula: 'Formula' }
      : { materno: 'Materna', donante: 'Extraída', formula: 'Fórmula' };

    let panel = '';
    if (tipoComida === 'materno') {
      panel = timers.toma ? `
        <div class="empty-state" style="padding:18px">⏱️ Toma en curso — usa la barra rosa de arriba para terminarla.</div>
      ` : `
        <div class="boob-buttons">
          <button class="boob-btn boob-izq" data-accion="toma-izq">
            <span class="big">🤱</span>Izquierda<span class="hint">▶ tocar para iniciar</span>
          </button>
          <button class="boob-btn boob-der" data-accion="toma-der">
            <span class="big">🤱</span>Derecha<span class="hint">▶ tocar para iniciar</span>
          </button>
        </div>
        <button class="btn-ghost btn-block" data-accion="toma-manual">＋ Registrar toma de pecho sin timer</button>
      `;
    } else {
      panel = `<button class="btn-primary btn-block" data-accion="biberon-tipo">＋ Registrar toma de ${tipoComida === 'donante' ? 'leche extraída (biberón)' : 'fórmula'}</button>
        ${tipoComida === 'donante' ? '<button class="btn-ghost btn-block" data-accion="ver-banco">🥛 ¿Extrajiste leche? Agrégala en el Banco de leche</button>' : ''}`;
    }

    const grupos = porDia(d.tomas, 'inicio');
    main.innerHTML = `
      <h2 class="section-title">Alimentación</h2>
      <div class="segmented" id="seg-comida">
        <button data-tipo="materno" class="${tipoComida === 'materno' ? 'active' : ''}">🤱 Materna</button>
        <button data-tipo="donante" class="${tipoComida === 'donante' ? 'active' : ''}">🥛 Extraída</button>
        <button data-tipo="formula" class="${tipoComida === 'formula' ? 'active' : ''}">🍼 Fórmula</button>
      </div>
      ${panel}
      ${listaEntradas(grupos, t => `
        <div class="entry">
          <span class="entry-emoji">${t.tipo === 'materno' ? '🤱' : t.tipo === 'donante' ? '🥛' : '🍼'}</span>
          <div class="entry-main">
            <div class="entry-title">${nombreTipo[t.tipo]}${t.lado ? ` · ${t.lado === 'izq' ? (enC ? 'left' : 'izquierda') : (enC ? 'right' : 'derecha')}` : ''}</div>
            <div class="entry-sub">${[t.duracionSeg ? `${Math.round(t.duracionSeg / 60)} min` : '', t.ml ? `${t.ml} ml` : '', t.notas ? esc(t.notas) : ''].filter(Boolean).join(' · ') || '—'}${etiquetaAutor(t)}</div>
          </div>
          <span class="entry-time">${fmtHora(t.inicio)}</span>
          ${btnsEntrada('tomas', t.id)}
        </div>
      `, { emoji: '🍼', texto: I18N.lang === 'en' ? `${nb()}'s feeds will appear here` : `Aquí aparecerán las tomas de ${nb()}` })}
    `;

    $('#seg-comida').addEventListener('click', e => {
      const b = e.target.closest('button[data-tipo]');
      if (b) { tipoComida = b.dataset.tipo; render(); }
    });
  }

  // desde Inicio: primero preguntar qué traía el biberón
  function hojaTipoBiberon() {
    abrirSheet(`
      <h2>¿Qué traía el biberón? 🍼</h2>
      <div class="dispositivo-botones">
        <button class="bg-pink" data-bib="donante"><span>🥛</span>Leche extraída</button>
        <button class="bg-blue" data-bib="formula"><span>🍼</span>Fórmula</button>
      </div>
    `);
    document.querySelectorAll('[data-bib]').forEach(b => b.onclick = () => hojaBiberon(b.dataset.bib));
  }

  function hojaBiberon(tipo, existente) {
    const ml0 = existente ? (existente.ml || 60) : 60;
    abrirSheet(`
      <h2>${existente ? 'Editar toma' : tipo === 'donante' ? 'Toma de leche extraída 🥛' : tipo === 'formula' ? 'Fórmula 🍼' : 'Toma de pecho 🤱'}</h2>
      ${!existente && tipo === 'donante' ? `<p style="font-size:13px;color:var(--text-2);margin:-6px 0 12px">${I18N.lang === 'en' ? `This logs what ${nb()} <b>drank</b> from a bottle (it is deducted from the milk bank). To add milk you pumped, use the <b>Milk bank 🥛</b>.` : `Esto registra lo que ${nb()} <b>se tomó</b> en biberón (se resta del banco de leche). Para agregar leche que extrajiste, usa el <b>Banco de leche 🥛</b>.`}</p>` : ''}
      ${tipo === 'materno' ? `
        <div class="form-group"><label>Lado</label>
          <select id="f-lado">
            <option value="izq" ${existente && existente.lado === 'izq' ? 'selected' : ''}>Izquierda</option>
            <option value="der" ${existente && existente.lado === 'der' ? 'selected' : ''}>Derecha</option>
          </select>
        </div>
        <div class="form-group"><label>Minutos</label>
          <input type="number" id="f-min" inputmode="numeric" value="${existente && existente.duracionSeg ? Math.round(existente.duracionSeg / 60) : ''}" placeholder="15">
        </div>` : `
        <div class="ml-stepper">
          <button type="button" id="ml-menos">−</button>
          <div class="ml-value"><span id="ml-num">${ml0}</span> <small>ml</small></div>
          <button type="button" id="ml-mas">+</button>
        </div>
        <div class="ml-presets">
          ${[30, 45, 60, 90, 120].map(v => `<button type="button" data-ml="${v}">${v} ml</button>`).join('')}
        </div>`}
      <div class="form-group"><label>Hora de la toma</label>
        <input type="datetime-local" id="f-hora" value="${aInputLocal(existente ? existente.inicio : null)}">
      </div>
      <div class="form-group"><label>Notas (opcional)</label>
        <input type="text" id="f-notas" value="${esc(existente ? existente.notas : '')}" placeholder="Comió bien, se quedó dormida…">
      </div>
      <button class="btn-primary btn-block" id="f-guardar">Guardar</button>
    `);

    let ml = ml0;
    if (tipo !== 'materno') {
      const num = $('#ml-num');
      $('#ml-menos').onclick = () => { ml = Math.max(0, ml - 5); num.textContent = ml; };
      $('#ml-mas').onclick = () => { ml += 5; num.textContent = ml; };
      document.querySelectorAll('[data-ml]').forEach(b => b.onclick = () => { ml = Number(b.dataset.ml); num.textContent = ml; });
    }

    $('#f-guardar').onclick = () => {
      const registro = {
        tipo,
        inicio: deInputLocal($('#f-hora').value),
        notas: $('#f-notas').value.trim(),
      };
      if (tipo === 'materno') {
        registro.lado = $('#f-lado').value;
        const min = Number($('#f-min').value);
        registro.duracionSeg = min ? min * 60 : null;
        registro.ml = existente ? existente.ml : null;
      } else {
        registro.ml = ml;
        registro.lado = null;
      }
      const faltanteAntes = saldosBanco().faltante;
      const guardada = existente
        ? Store.update('tomas', existente.id, registro)
        : Store.add('tomas', registro);
      sincronizarConsumoBanco(guardada); // la leche extraída se resta del refri
      cerrarSheet();
      toast(existente ? 'Toma actualizada' : 'Toma guardada 🍼');
      if (registro.tipo === 'donante') {
        const { refri, faltante } = saldosBanco();
        setTimeout(() => toast(faltante > faltanteAntes
          ? '⚠️ El banco no tenía toda esa leche registrada — no olviden registrar sus extracciones 🥛'
          : `🥛 Quedan ${refri} ml listos en el refri`), 1400);
      }
    };
  }

  /* ---------- timer de lactancia ---------- */
  // segundos transcurridos sin contar las pausas
  function segundosToma(t) {
    let ms = Date.now() - new Date(t.inicio);
    for (const p of (t.pausas || [])) ms -= (new Date(p.hasta) - new Date(p.desde));
    if (t.pausadoDesde) ms -= (Date.now() - new Date(t.pausadoDesde));
    return Math.max(0, Math.floor(ms / 1000));
  }

  function iniciarToma(lado) {
    const timers = Store.getTimers();
    if (timers.toma) { toast('Ya hay una toma en curso'); return; }
    timers.toma = { lado, inicio: new Date().toISOString(), pausas: [] };
    Store.setTimers(timers);
    toast(I18N.lang === 'en' ? `Timer started · ${lado === 'izq' ? 'left' : 'right'} breast ▶` : `Timer iniciado · pecho ${lado === 'izq' ? 'izquierdo' : 'derecho'} ▶`);
  }

  function pausarToma() {
    const timers = Store.getTimers();
    const t = timers.toma;
    if (!t) return;
    if (t.pausadoDesde) {
      t.pausas = t.pausas || [];
      t.pausas.push({ desde: t.pausadoDesde, hasta: new Date().toISOString() });
      delete t.pausadoDesde;
      toast('Toma reanudada ▶');
    } else {
      t.pausadoDesde = new Date().toISOString();
      toast('Toma en pausa ⏸');
    }
    Store.setTimers(timers);
  }

  function terminarToma(cancelar) {
    const timers = Store.getTimers();
    if (!timers.toma) return;
    const t = timers.toma;
    const dur = segundosToma(t);
    delete timers.toma;
    Store.setTimers(timers);
    if (cancelar) { toast('Toma cancelada'); return; }
    Store.add('tomas', { tipo: 'materno', lado: t.lado, inicio: t.inicio, duracionSeg: dur, ml: null, notas: '' });
    toast(`${I18N.lang === 'en' ? 'Feed saved' : 'Toma guardada'} · ${fmtDur(dur)} 🤱`);
  }

  /* ============================================================
     SUEÑO Y VIGILIA
  ============================================================ */
  const esVigilia = s => s.tipo === 'vigilia';

  /* ---------- ventanas de despierto por edad (en minutos) ---------- */
  const VENTANAS_SUENO = [
    { desde: 0, hasta: 4, min: 45, max: 60, siestas: I18N.lang === 'en' ? '4–6 naps · 14–17 h of sleep per day' : '4–6 siestas · 14–17 h de sueño al día' },
    { desde: 4, hasta: 9, min: 45, max: 75, siestas: I18N.lang === 'en' ? '4–5 naps · 14–17 h per day' : '4–5 siestas · 14–17 h al día' },
    { desde: 9, hasta: 13, min: 60, max: 90, siestas: I18N.lang === 'en' ? '4–5 naps · 14–16 h per day' : '4–5 siestas · 14–16 h al día' },
    { desde: 13, hasta: 17, min: 75, max: 120, siestas: I18N.lang === 'en' ? '3–4 naps · 13–16 h per day' : '3–4 siestas · 13–16 h al día' },
    { desde: 17, hasta: 26, min: 90, max: 150, siestas: I18N.lang === 'en' ? '3–4 naps · 12–15 h per day' : '3–4 siestas · 12–15 h al día' },
    { desde: 26, hasta: 39, min: 120, max: 180, siestas: I18N.lang === 'en' ? '2–3 naps · 12–15 h per day' : '2–3 siestas · 12–15 h al día' },
    { desde: 39, hasta: 53, min: 150, max: 210, siestas: I18N.lang === 'en' ? '2 naps · 12–14 h per day' : '2 siestas · 12–14 h al día' },
  ];

  function ventanaEdad() {
    const dias = edadDias();
    if (dias === null) return null;
    const sem = Math.floor(dias / 7);
    return VENTANAS_SUENO.find(v => sem >= v.desde && sem < v.hasta) || VENTANAS_SUENO[VENTANAS_SUENO.length - 1];
  }

  function cardVentanaSueno() {
    const v = ventanaEdad();
    if (!v) return '';
    const timers = Store.getTimers();
    if (timers.sueno) return `
      <div class="card ventana-card">
        <h2>⏳ Ventana de despierta</h2>
        <p style="font-size:14px;color:var(--text-2)">${I18N.lang === 'en' ? `Asleep 😴 — when she wakes, her awake window at this age is <b>${v.min}–${v.max} min</b> before the next nap.` : `Está dormida 😴 — al despertar, su ventana para esta edad es de <b>${v.min}–${v.max} min</b> antes de la siguiente siesta.`}</p>
      </div>`;
    const ult = Store.data.suenos.filter(s => s.fin && s.tipo !== 'vigilia')
      .sort((a, b) => b.fin.localeCompare(a.fin))[0];
    if (!ult) return `
      <div class="card ventana-card">
        <h2>⏳ Ventana de despierta</h2>
        <p style="font-size:14px;color:var(--text-2)">${I18N.lang === 'en' ? `At her age she can stay awake <b>${v.min}–${v.max} min</b> between sleeps (${v.siestas}). Log her sleeps and you'll see here when her window is closing.` : `A su edad aguanta despierta <b>${v.min}–${v.max} min</b> entre sueños (${v.siestas}). Registra sus sueños y aquí verás cuándo se acerca su hora.`}</p>
      </div>`;
    const despiertaMin = Math.floor((Date.now() - new Date(ult.fin)) / 60000);
    const pct = Math.min(100, Math.round((despiertaMin / v.max) * 100));
    let color = '#4cc38a', estado = I18N.lang === 'en' ? 'Freshly recharged ✨' : 'Recién recargada ✨';
    if (despiertaMin >= v.max) { color = '#e25555'; estado = I18N.lang === 'en' ? 'Window passed! She may get overtired and fight sleep' : '¡Ventana pasada! Puede sobre-cansarse y costarle más dormir'; }
    else if (despiertaMin >= v.min) { color = '#f5b54a'; estado = I18N.lang === 'en' ? 'Sweet spot: great moment to put her down 😴' : 'En su punto: es buen momento para dormirla 😴'; }
    else if (pct >= 70) { color = '#f5b54a'; estado = I18N.lang === 'en' ? 'Almost time — start winding down' : 'Se acerca su hora — vayan bajando el ritmo'; }
    return `
      <div class="card ventana-card">
        <h2>⏳ Ventana de despierta</h2>
        <div style="font-size:22px;font-weight:800">${Math.floor(despiertaMin / 60) ? `${Math.floor(despiertaMin / 60)} h ` : ''}${despiertaMin % 60} min <small style="font-size:13px;color:var(--text-2);font-weight:600">${I18N.lang === 'en' ? 'awake' : 'despierta'}</small></div>
        <div class="ventana-barra"><div class="vb-fill" style="width:${pct}%;background-color:${color}"></div></div>
        <div class="ventana-meta"><span>0</span><span>${v.min} min</span><span>${v.max} min</span></div>
        <p style="font-size:13px;font-weight:700;margin-top:6px;color:${color}">${estado}</p>
        <p style="font-size:12px;color:var(--text-2);margin-top:4px">${I18N.lang === 'en' ? `At her age: ${v.min}–${v.max} min per window · ${v.siestas}` : `A su edad: ${v.min}–${v.max} min por ventana · ${v.siestas}`}</p>
      </div>`;
  }

  /* ---------- rutina de dormir ---------- */
  const RUTINA_BASE = () => I18N.lang === 'en' ? [
    { id: 'r1', emoji: '🛁', titulo: 'Warm bath', min: 10 },
    { id: 'r2', emoji: '👐', titulo: 'Lotion massage', min: 5 },
    { id: 'r3', emoji: '👶', titulo: 'Diaper & pajamas', min: 5 },
    { id: 'r4', emoji: '🍼', titulo: 'Last feed (lights low)', min: 15 },
    { id: 'r5', emoji: '📖', titulo: 'Quiet story or song', min: 5 },
    { id: 'r6', emoji: '🌙', titulo: 'Lights off + white noise', min: 1 },
    { id: 'r7', emoji: '😴', titulo: 'Into the crib drowsy but awake', min: 1 },
  ] : [
    { id: 'r1', emoji: '🛁', titulo: 'Baño tibio', min: 10 },
    { id: 'r2', emoji: '👐', titulo: 'Masaje con crema', min: 5 },
    { id: 'r3', emoji: '👶', titulo: 'Pañal y pijama', min: 5 },
    { id: 'r4', emoji: '🍼', titulo: 'Última toma (con luz baja)', min: 15 },
    { id: 'r5', emoji: '📖', titulo: 'Cuento o canción bajito', min: 5 },
    { id: 'r6', emoji: '🌙', titulo: 'Luz apagada + ruido blanco', min: 1 },
    { id: 'r7', emoji: '😴', titulo: 'A la cuna somnolienta pero despierta', min: 1 },
  ];

  function cardRutina() {
    const r = Store.data.rutina;
    const timers = Store.getTimers();
    if (timers.rutina) {
      const pasos = (r && r.pasos) || [];
      const hechos = timers.rutina.hechos || [];
      const todos = pasos.length && hechos.length >= pasos.length;
      return `
        <div class="card" style="border-left:5px solid #7c63d8">
          <div class="card-row"><h2 style="margin:0">🌙 Rutina en curso</h2>
            <button class="btn-ghost" data-accion="rutina-cancelar" style="color:var(--danger)">✕</button></div>
          <div class="rutina-progreso"><div style="width:${pasos.length ? Math.round((hechos.length / pasos.length) * 100) : 0}%"></div></div>
          ${pasos.map(p => `
            <div class="rutina-paso ${hechos.includes(p.id) ? 'hecho' : ''}">
              <span class="rp-emoji">${p.emoji}</span>
              <span class="rp-titulo">${esc(p.titulo)}</span>
              ${p.min > 1 ? `<span class="rp-min">~${p.min} min</span>` : ''}
              <button class="rutina-check ${hechos.includes(p.id) ? 'lista' : ''}" data-paso="${p.id}">✓</button>
            </div>`).join('')}
          ${todos ? `<button class="btn-primary btn-block" data-accion="rutina-dormir" style="margin-top:8px">😴 ¡Se durmió! Iniciar timer de sueño</button>` : ''}
        </div>`;
    }
    if (!r || !r.pasos || !r.pasos.length) {
      return `
        <div class="card" style="border-left:5px solid #7c63d8">
          <h2>🌙 Rutina de dormir</h2>
          <p style="font-size:13.5px;color:var(--text-2);margin-bottom:12px">${I18N.lang === 'en' ? `The same sequence every night teaches ${esc(Store.data.bebe.nombre || 'the baby')}'s body that the long sleep is coming. It's what infant-sleep experts recommend most.` : `La misma secuencia cada noche le enseña al cuerpo de ${esc(Store.data.bebe.nombre || 'la bebé')} que viene el sueño largo. Es lo que más recomiendan los expertos en sueño infantil.`}</p>
          <button class="btn-secondary btn-block" data-accion="rutina-editar">✨ Crear nuestra rutina</button>
        </div>`;
    }
    const dur = r.pasos.reduce((s, p) => s + (p.min || 0), 0);
    return `
      <div class="card" style="border-left:5px solid #7c63d8">
        <div class="card-row">
          <h2 style="margin:0">🌙 Rutina de dormir</h2>
          <button class="btn-ghost" data-accion="rutina-editar">✏️ Editar</button>
        </div>
        <p style="font-size:13px;color:var(--text-2)">${I18N.lang === 'en' ? `${r.pasos.length} steps · ~${dur} min${r.hora ? ` · target ${r.hora}` : ''}` : `${r.pasos.length} pasos · ~${dur} min${r.hora ? ` · hora objetivo ${r.hora}` : ''}`}</p>
        <p style="font-size:12.5px;color:var(--text-2)">${r.pasos.map(p => p.emoji).join(' → ')}</p>
        <button class="btn-primary btn-block" data-accion="rutina-iniciar" style="margin-top:10px">▶ Empezar rutina de esta noche</button>
      </div>`;
  }

  function hojaEditarRutina() {
    const r = Store.data.rutina;
    let pasos = r && r.pasos && r.pasos.length ? JSON.parse(JSON.stringify(r.pasos)) : RUTINA_BASE();
    let hora = (r && r.hora) || '20:00';

    const pintar = () => {
      $('#re-pasos').innerHTML = pasos.map((p, i) => `
        <div class="rutina-paso">
          <span class="rp-emoji">${p.emoji}</span>
          <span class="rp-titulo">${esc(p.titulo)}</span>
          ${p.min > 1 ? `<span class="rp-min">~${p.min} min</span>` : ''}
          <div class="entry-actions">
            ${i > 0 ? `<button data-sube="${i}">⬆️</button>` : ''}
            <button data-quita="${i}">✕</button>
          </div>
        </div>`).join('') || '<p style="color:var(--text-2);font-size:14px">Agrega pasos abajo ↓</p>';
      $('#re-pasos').querySelectorAll('[data-quita]').forEach(b => b.onclick = () => { pasos.splice(Number(b.dataset.quita), 1); pintar(); });
      $('#re-pasos').querySelectorAll('[data-sube]').forEach(b => b.onclick = () => {
        const i = Number(b.dataset.sube);
        [pasos[i - 1], pasos[i]] = [pasos[i], pasos[i - 1]];
        pintar();
      });
    };

    abrirSheet(`
      <h2>${I18N.lang === 'en' ? (r && r.pasos ? 'Edit' : 'Create') + ' bedtime routine 🌙' : (r && r.pasos ? 'Editar' : 'Crear') + ' rutina de dormir 🌙'}</h2>
      <p style="font-size:12.5px;color:var(--text-2);margin-bottom:10px">Consejo: siempre el mismo orden, empezando 30–45 min antes de la hora objetivo, y terminando en la cuna somnolienta pero despierta.</p>
      <div id="re-pasos"></div>
      <div class="form-row" style="margin-top:10px">
        <div class="form-group" style="flex:0 0 62px"><label>Emoji</label>
          <input type="text" id="re-emoji" value="🧸" maxlength="4" style="text-align:center">
        </div>
        <div class="form-group"><label>Nuevo paso</label>
          <input type="text" id="re-titulo" placeholder="Mecerla 5 minutos…">
        </div>
        <div class="form-group" style="flex:0 0 74px"><label>Min</label>
          <input type="number" id="re-min" inputmode="numeric" value="5">
        </div>
      </div>
      <button class="btn-secondary btn-block" id="re-agregar">＋ Agregar paso</button>
      <div class="form-group" style="margin-top:12px"><label>Hora objetivo para dormir (misma cada noche)</label>
        <input type="time" id="re-hora" value="${hora}">
      </div>
      <button class="btn-primary btn-block" id="re-guardar">Guardar rutina</button>
    `);
    pintar();
    $('#re-agregar').onclick = () => {
      const titulo = $('#re-titulo').value.trim();
      if (!titulo) { toast('Escribe el paso'); return; }
      pasos.push({ id: Store.uid(), emoji: $('#re-emoji').value.trim() || '🧸', titulo, min: Number($('#re-min').value) || 1 });
      $('#re-titulo').value = '';
      pintar();
    };
    $('#re-guardar').onclick = () => {
      if (!pasos.length) { toast('Agrega al menos un paso'); return; }
      Store.data.rutina = { pasos, hora: $('#re-hora').value, updatedAt: new Date().toISOString() };
      Store.saveLocal();
      cerrarSheet();
      toast('Rutina guardada 🌙');
    };
  }

  function iniciarRutina() {
    const timers = Store.getTimers();
    if (timers.rutina) return;
    timers.rutina = { inicio: new Date().toISOString(), hechos: [] };
    Store.setTimers(timers);
    toast('🌙 Rutina iniciada — palomea cada paso');
  }

  function marcarPasoRutina(id) {
    const timers = Store.getTimers();
    if (!timers.rutina) return;
    const hechos = timers.rutina.hechos || [];
    timers.rutina.hechos = hechos.includes(id) ? hechos.filter(x => x !== id) : [...hechos, id];
    Store.setTimers(timers);
    const pasos = (Store.data.rutina && Store.data.rutina.pasos) || [];
    if (pasos.length && timers.rutina.hechos.length >= pasos.length) {
      confeti(60);
      toast('✨ Rutina completa — ahora sí, a dormir');
    }
  }

  function terminarRutina(durmio) {
    const timers = Store.getTimers();
    if (!timers.rutina) return;
    delete timers.rutina;
    Store.setTimers(timers);
    if (durmio) {
      iniciarSueno();
      celebracion('🌙', I18N.lang === 'en' ? 'Good night!' : '¡Buenas noches!', I18N.lang === 'en' ? 'Routine complete and sleep timer running' : 'Rutina completa y timer de sueño corriendo');
    } else {
      toast('Rutina cancelada');
    }
  }

  /* ---------- sugerencias para dormir mejor ---------- */
  function sugerenciasDormir() {
    const tips = [];
    const d = Store.data;
    const dias = edadDias();
    const DIA_MS = 86400000;

    // noches: sueños que inician entre 18:00 y 02:00, últimos 7 días
    const noches = d.suenos.filter(s => {
      if (!s.fin || s.tipo === 'vigilia') return false;
      const t = new Date(s.inicio);
      if (Date.now() - t > 7 * DIA_MS) return false;
      const h = t.getHours();
      return h >= 18 || h < 2;
    });

    // consistencia de la hora de acostarla
    const inicios = noches.filter(s => new Date(s.inicio).getHours() >= 18).map(s => {
      const t = new Date(s.inicio);
      return t.getHours() * 60 + t.getMinutes();
    });
    if (inicios.length >= 3) {
      const rango = Math.max(...inicios) - Math.min(...inicios);
      if (rango > 90) tips.push({ emoji: '🕗', texto: I18N.lang === 'en' ? `Bedtime varied ${Math.round(rango / 60 * 10) / 10} h this week. A fixed hour (±30 min) is one of the biggest sleep boosters${d.rutina && d.rutina.hora ? ` — your target is ${d.rutina.hora}` : ''}.` : `La hora de dormirla varió ${Math.round(rango / 60 * 10) / 10} h esta semana. Una hora fija (± 30 min) es de lo que más ayuda a dormir corrido${d.rutina && d.rutina.hora ? ` — su objetivo es ${d.rutina.hora}` : ''}.` });
      else tips.push({ emoji: '🏅', texto: I18N.lang === 'en' ? 'Bedtime has been very consistent this week — that is what builds long night sleep. Keep it up!' : 'La hora de acostarla ha sido muy constante esta semana — eso construye el sueño nocturno. ¡Sigan así!' });
    }

    // mejor racha nocturna
    const rachas = noches.map(s => new Date(s.fin) - new Date(s.inicio));
    if (rachas.length) {
      const mejor = Math.max(...rachas);
      tips.push({ emoji: '🌙', texto: I18N.lang === 'en' ? `Her best night stretch this week: ${fmtDurLarga(mejor)}. That number grows on its own with a steady routine.` : `Su mejor racha nocturna esta semana: ${fmtDurLarga(mejor)}. Ese número irá creciendo solo con la rutina constante.` });
    }

    // confusión día/noche (primeras 8 semanas)
    if (dias !== null && dias <= 56) {
      const en7 = d.suenos.filter(s => s.fin && s.tipo !== 'vigilia' && Date.now() - new Date(s.inicio) < 7 * DIA_MS);
      const deDia = en7.filter(s => { const h = new Date(s.inicio).getHours(); return h >= 8 && h < 19; })
        .reduce((t, s) => t + (new Date(s.fin) - new Date(s.inicio)), 0);
      const deNoche = en7.filter(s => { const h = new Date(s.inicio).getHours(); return h >= 19 || h < 8; })
        .reduce((t, s) => t + (new Date(s.fin) - new Date(s.inicio)), 0);
      if (deDia > deNoche * 1.3 && en7.length >= 5) {
        tips.push({ emoji: '☀️', texto: I18N.lang === 'en' ? 'She is sleeping more by day than by night. To flip it: daytime naps with light and normal noise; nights pitch dark, whisper voice and boring feeds.' : 'Está durmiendo más de día que de noche. Para voltearlo: de día luz y ruido normal en sus siestas; de noche oscuridad total, voz bajita y tomas aburridas (sin jugar ni prender luces).' });
      }
    }

    // generales que rotan por día
    const POOL = I18N.lang === 'en' ? [
      { emoji: '😴', texto: 'Put her down drowsy but awake: she learns to fall asleep in her crib and to link cycles alone at night.' },
      { emoji: '🌑', texto: 'A really dark room and constant white noise all night: recreates the womb and masks house sounds.' },
      { emoji: '🍼', texto: 'Night feeds in boring mode: minimal light, no chatting or play, diaper change only if needed. Eat and back to the crib.' },
      { emoji: '🌡️', texto: 'Cool room (68–72 °F / 20–22 °C) and a sleep sack instead of loose blankets — safer and she sleeps better.' },
      { emoji: '⏳', texto: 'Respecting wake windows prevents overtiredness: an overtired baby fights sleep harder, not less.' },
      { emoji: '🧺', texto: 'Keep the last nap away from bedtime: leave at least one full wake window before the routine.' },
    ] : [
      { emoji: '😴', texto: 'Acuéstenla somnolienta pero aún despierta: así aprende a dormirse sola en su cuna, y a hilar ciclos sin ayuda a media noche.' },
      { emoji: '🌑', texto: 'Cuarto bien oscuro y ruido blanco constante toda la noche: recrea el útero y tapa los ruidos de la casa.' },
      { emoji: '🍼', texto: 'Tomas nocturnas en modo aburrido: luz mínima, sin plática ni juego, cambio de pañal solo si hace falta. Comer y de vuelta a la cuna.' },
      { emoji: '🌡️', texto: 'Temperatura fresca (20–22 °C) y su saquito de dormir en vez de cobijas sueltas — más seguro y duerme mejor.' },
      { emoji: '⏳', texto: 'Respetar sus ventanas de despierta evita el sobre-cansancio: un bebé pasado de cansancio pelea más el sueño, no menos.' },
      { emoji: '🧺', texto: 'La última siesta no muy pegada a la noche: dejen al menos una ventana completa antes de la rutina.' },
    ];
    const dia = Math.floor(Date.now() / DIA_MS);
    for (let i = 0; tips.length < 4 && i < POOL.length; i++) tips.push(POOL[(dia + i) % POOL.length]);
    return tips.slice(0, 4);
  }

  function nombreQuien(q) {
    const b = Store.data.bebe;
    if (q === 'mama') return b.mama || 'Mamá';
    if (q === 'papa') return b.papa || 'Papá';
    if (q === 'ambos') return `${b.mama || 'Mamá'} y ${b.papa || 'Papá'}`;
    return '';
  }

  const chipsQuien = (sel) => ['mama', 'papa', 'ambos'].map(q =>
    `<button type="button" class="${sel === q ? 'activo' : ''}" data-quien="${q}">${q === 'ambos' ? '👫 Ambos' : (q === 'mama' ? '👩 ' : '👨 ') + nombreQuien(q)}</button>`).join('');

  function renderSueno() {
    const timers = Store.getTimers();
    const grupos = porDia(Store.data.suenos.filter(s => s.fin), 'inicio');

    const cardVigilia = !timers.vigilia ? '' : `
      <div class="card" style="border-left:5px solid #ffc964">
        <h2>👁️ Vigilia en curso · bitácora</h2>
        <label style="font-size:13px;font-weight:700;color:var(--text-2)">¿Quién está despierto con ella?</label>
        <div class="quien-chips" id="vig-quien">${chipsQuien(timers.vigilia.quien)}</div>
        <div class="bitacora">
          ${(timers.vigilia.notas || []).map((n, i) => `
            <div class="bitacora-item"><b>${fmtHora(n.hora)}</b><span>${esc(n.texto)}${etiquetaAutor(n)}</span>
            <button class="bit-x" data-bit-x="${i}">✕</button></div>`).join('')
            || '<p style="font-size:13px;color:var(--text-2)">Ve anotando qué pasa: "llora por cólicos", "la cargamos y se calmó", "pusimos música"…</p>'}
        </div>
        <div class="vig-add">
          <input type="text" id="vig-nota" placeholder="¿Qué está pasando?" enterkeyhint="done">
          <button id="vig-agregar">＋</button>
        </div>
      </div>`;

    main.innerHTML = `
      <h2 class="section-title">Sueño y vigilia</h2>
      <div class="sueno-botones">
        ${timers.sueno ? `<div class="empty-state" style="padding:14px 6px">🌙 Dormida<br><small>usa la barra de arriba</small></div>`
          : `<button class="bg-lav" data-accion="dormir"><span>😴</span>Se durmió<span class="hint">iniciar timer</span></button>`}
        ${timers.vigilia ? `<div class="empty-state" style="padding:14px 6px">👁️ En vigilia<br><small>bitácora aquí abajo ↓</small></div>`
          : `<button class="bg-yellow" data-accion="vigilia"><span>👁️</span>En vigilia<span class="hint">despierta y alerta</span></button>`}
      </div>
      ${cardVigilia}
      ${cardVentanaSueno()}
      ${cardRutina()}
      <details class="card" style="border-left:5px solid #4cc38a">
        <summary style="font-weight:800;font-size:16px;cursor:pointer">💤 Dormir mejor — consejos de esta semana</summary>
        <div style="margin-top:10px">
          ${sugerenciasDormir().map(t => `<div class="tip-item" style="border-top:1px solid var(--linea)"><span class="t-emoji">${t.emoji}</span><span>${t.texto}</span></div>`).join('')}
        </div>
        <p class="disclaimer" style="margin-top:8px">Basado en guías de sueño infantil y sus propios registros de la semana.</p>
      </details>
      <button class="btn-ghost btn-block" data-accion="sueno-manual">＋ Registrar sueño o vigilia con horario manual</button>
      ${listaEntradas(grupos, s => {
        const ms = new Date(s.fin) - new Date(s.inicio);
        const vig = esVigilia(s);
        const bit = s.bitacora || [];
        return `
        <div class="entry">
          <span class="entry-emoji">${vig ? '👁️' : '🌙'}</span>
          <div class="entry-main">
            <div class="entry-title">${vig ? 'Vigilia' : 'Durmió'} ${fmtDurLarga(ms)}</div>
            <div class="entry-sub">${fmtHora(s.inicio)} → ${fmtHora(s.fin)}${s.quien ? ` · ${esc(nombreQuien(s.quien))}` : ''}${s.notas ? ` · ${esc(s.notas)}` : ''}${etiquetaAutor(s)}</div>
            ${bit.length ? `<div class="entry-bitacora">${bit.map(n => `<div><b>${fmtHora(n.hora)}</b> ${esc(n.texto)}${etiquetaAutor(n)}</div>`).join('')}</div>` : ''}
          </div>
          ${btnsEntrada('suenos', s.id)}
        </div>`;
      }, { emoji: '🌙', texto: I18N.lang === 'en' ? `${nb()}'s sleep and wake windows will appear here` : `Aquí aparecerán los sueños y vigilias de ${nb()}` })}
    `;

    if (timers.vigilia) {
      $('#vig-quien').querySelectorAll('[data-quien]').forEach(b => b.onclick = () => {
        const t = Store.getTimers();
        const nuevo = t.vigilia.quien === b.dataset.quien ? null : b.dataset.quien;
        // cada relevo queda en la bitácora con su hora
        if (nuevo && nuevo !== t.vigilia.quien) {
          t.vigilia.notas = t.vigilia.notas || [];
          t.vigilia.notas.push({ hora: new Date().toISOString(), texto: `🔄 Ahora con ella: ${nombreQuien(nuevo)}`, autor: Store.getDispositivo() || null });
        }
        t.vigilia.quien = nuevo;
        Store.setTimers(t);
      });
      const agregar = () => {
        const texto = $('#vig-nota').value.trim();
        if (!texto) return;
        agregarNotaVigilia(texto);
      };
      $('#vig-agregar').onclick = agregar;
      $('#vig-nota').addEventListener('keydown', e => { if (e.key === 'Enter') agregar(); });
      main.querySelectorAll('[data-bit-x]').forEach(b => b.onclick = () => {
        const t = Store.getTimers();
        t.vigilia.notas.splice(Number(b.dataset.bitX), 1);
        Store.setTimers(t);
      });
    }
  }

  // etiqueta pequeña de quién escribió una nota (según el dueño del teléfono)
  const etiquetaAutor = n => n.autor ? `<small class="bit-autor">${esc(nombreQuien(n.autor))}</small>` : '';

  function agregarNotaVigilia(texto) {
    const t = Store.getTimers();
    if (!t.vigilia) return;
    t.vigilia.notas = t.vigilia.notas || [];
    t.vigilia.notas.push({ hora: new Date().toISOString(), texto, autor: Store.getDispositivo() || null });
    Store.setTimers(t);
    toast('Nota agregada 📝');
  }

  function hojaNotaVigilia() {
    abrirSheet(`
      <h2>Nota de la vigilia 📝</h2>
      <div class="form-group">
        <input type="text" id="f-texto" placeholder="Llora por cólicos, la cargué y se calmó…" enterkeyhint="done">
      </div>
      <button class="btn-primary btn-block" id="f-guardar">Agregar a la bitácora</button>
    `);
    $('#f-texto').focus();
    $('#f-guardar').onclick = () => {
      const texto = $('#f-texto').value.trim();
      if (!texto) return;
      agregarNotaVigilia(texto);
      cerrarSheet();
    };
  }

  function hojaSuenoManual(existente) {
    const tipo0 = existente && existente.tipo === 'vigilia' ? 'vigilia' : 'sueno';
    let quien = existente ? (existente.quien || null) : null;
    let bitacora = existente ? [...(existente.bitacora || [])] : [];

    const pintarBitacora = () => {
      const cont = $('#f-bitacora');
      if (!cont) return;
      cont.innerHTML = bitacora.map((n, i) => `
        <div class="bitacora-item"><b>${fmtHora(n.hora)}</b><span>${esc(n.texto)}${etiquetaAutor(n)}</span>
        <button type="button" class="bit-x" data-i="${i}">✕</button></div>`).join('');
      cont.querySelectorAll('.bit-x').forEach(b => b.onclick = () => {
        bitacora.splice(Number(b.dataset.i), 1);
        pintarBitacora();
      });
    };

    abrirSheet(`
      <h2>${existente ? 'Editar registro' : 'Registro manual 🌙'}</h2>
      <div class="form-group"><label>Tipo</label>
        <select id="f-tipo">
          <option value="sueno" ${tipo0 === 'sueno' ? 'selected' : ''}>😴 Sueño</option>
          <option value="vigilia" ${tipo0 === 'vigilia' ? 'selected' : ''}>👁️ Vigilia (despierta)</option>
        </select>
      </div>
      <div class="form-group"><label>Comenzó</label>
        <input type="datetime-local" id="f-inicio" value="${aInputLocal(existente ? existente.inicio : null)}">
      </div>
      <div class="form-group"><label>Terminó</label>
        <input type="datetime-local" id="f-fin" value="${aInputLocal(existente ? existente.fin : null)}">
      </div>
      <div id="f-vigilia-extra" class="${tipo0 === 'vigilia' ? '' : 'hidden'}">
        <div class="form-group"><label>¿Quién estuvo despierto con ella?</label>
          <div class="quien-chips" id="f-quien">${chipsQuien(quien)}</div>
        </div>
        <div class="form-group"><label>Bitácora</label>
          <div class="bitacora" id="f-bitacora"></div>
          <div class="vig-add">
            <input type="text" id="f-bit-texto" placeholder="Agregar nota a la bitácora…">
            <button type="button" id="f-bit-agregar">＋</button>
          </div>
        </div>
      </div>
      <div class="form-group"><label>Notas (opcional)</label>
        <input type="text" id="f-notas" value="${esc(existente ? existente.notas : '')}" placeholder="Siesta en su cuna, muy despierta y tranquila…">
      </div>
      <button class="btn-primary btn-block" id="f-guardar">Guardar</button>
    `);

    pintarBitacora();
    $('#f-tipo').onchange = () =>
      $('#f-vigilia-extra').classList.toggle('hidden', $('#f-tipo').value !== 'vigilia');
    $('#f-quien').addEventListener('click', e => {
      const b = e.target.closest('[data-quien]');
      if (!b) return;
      quien = quien === b.dataset.quien ? null : b.dataset.quien;
      $('#f-quien').innerHTML = chipsQuien(quien);
    });
    $('#f-bit-agregar').onclick = () => {
      const texto = $('#f-bit-texto').value.trim();
      if (!texto) return;
      bitacora.push({ hora: new Date().toISOString(), texto, autor: Store.getDispositivo() || null });
      $('#f-bit-texto').value = '';
      pintarBitacora();
    };

    $('#f-guardar').onclick = () => {
      const inicio = deInputLocal($('#f-inicio').value);
      const fin = deInputLocal($('#f-fin').value);
      if (new Date(fin) <= new Date(inicio)) { toast('La hora de fin debe ser después'); return; }
      const tipo = $('#f-tipo').value;
      const reg = {
        tipo, inicio, fin, notas: $('#f-notas').value.trim(),
        quien: tipo === 'vigilia' ? quien : null,
        bitacora: tipo === 'vigilia' ? bitacora : [],
      };
      if (existente) Store.update('suenos', existente.id, reg);
      else Store.add('suenos', reg);
      cerrarSheet();
      toast(reg.tipo === 'vigilia' ? 'Vigilia guardada 👁️' : 'Sueño guardado 🌙');
    };
  }

  function iniciarSueno() {
    const timers = Store.getTimers();
    if (timers.sueno) { toast('Ya hay un sueño en curso'); return; }
    timers.sueno = { inicio: new Date().toISOString() };
    Store.setTimers(timers);
    toast('Dulces sueños 😴');
  }

  function terminarSueno(cancelar) {
    const timers = Store.getTimers();
    if (!timers.sueno) return;
    const s = timers.sueno;
    delete timers.sueno;
    Store.setTimers(timers);
    if (cancelar) { toast('Registro cancelado'); return; }
    Store.add('suenos', { tipo: 'sueno', inicio: s.inicio, fin: new Date().toISOString(), notas: '' });
    toast('Sueño registrado 🌙');
  }

  function iniciarVigilia() {
    const timers = Store.getTimers();
    if (timers.vigilia) { toast('Ya hay una vigilia en curso'); return; }
    timers.vigilia = { inicio: new Date().toISOString(), quien: null, notas: [] };
    Store.setTimers(timers);
    toast('Ojitos bien abiertos 👁️ · ve anotando en la bitácora');
  }

  function terminarVigilia(cancelar) {
    const timers = Store.getTimers();
    if (!timers.vigilia) return;
    const v = timers.vigilia;
    delete timers.vigilia;
    Store.setTimers(timers);
    if (cancelar) { toast('Registro cancelado'); return; }
    Store.add('suenos', {
      tipo: 'vigilia', inicio: v.inicio, fin: new Date().toISOString(),
      quien: v.quien || null, bitacora: v.notas || [], notas: '',
    });
    toast('Vigilia registrada 👁️');
  }

  /* ============================================================
     PAÑAL
  ============================================================ */
  const COLORES_POPO = [
    { id: 'mostaza', nombre: 'Mostaza', hex: '#d9a514' },
    { id: 'cafe', nombre: 'Café', hex: '#8a5a2b' },
    { id: 'verde', nombre: 'Verde', hex: '#5c8a3a' },
    { id: 'negro', nombre: 'Negro', hex: '#3b3b3b' },
    { id: 'rojo', nombre: 'Rojizo', hex: '#c0392b' },
    { id: 'gris', nombre: 'Blanco/gris', hex: '#cfcabe' },
  ];
  const colorPopo = id => COLORES_POPO.find(c => c.id === id);

  const LECTURA_COLOR = {
    mostaza: 'Color mostaza: el clásico de bebés que toman leche materna. Normal y saludable. ✅',
    cafe: 'Café: normal, muy común cuando toman fórmula. ✅',
    verde: 'Verde: suele ser normal (frecuente con fórmula o tránsito rápido). Si es constante o viene con moco, coméntenlo en la próxima consulta.',
    negro: 'Negro: normal los primeros días (meconio). Si aparece después de la primera semana, coméntenlo al pediatra.',
    rojo: 'Tonos rojizos pueden indicar sangre: vale la pena avisar al pediatra pronto. ⚠️',
    gris: 'Blanco o gris es poco común y amerita avisar al pediatra. ⚠️',
  };

  const CONSISTENCIAS = [
    { id: 'liquida', nombre: 'Aguada', emoji: '💦' },
    { id: 'cremosa', nombre: 'Cremosa', emoji: '🍦' },
    { id: 'grumitos', nombre: 'Con grumitos', emoji: '🌾' },
    { id: 'pastosa', nombre: 'Pastosa', emoji: '🥜' },
    { id: 'dura', nombre: 'Bolitas duras', emoji: '🪨' },
  ];
  const consistenciaPopo = id => CONSISTENCIAS.find(c => c.id === id);

  const LECTURA_CONSISTENCIA = {
    liquida: 'Aguada: una que otra es normal; si son varias seguidas y muy líquidas puede ser diarrea — vigilen que siga comiendo bien y mojando pañales.',
    cremosa: 'Cremosa: la consistencia típica y saludable.',
    grumitos: 'Con grumitos o "semillitas": el clásico de la lactancia materna, totalmente normal.',
    pastosa: 'Pastosa: normal, común cuando toman fórmula.',
    dura: 'Bolitas duras y secas sugieren estreñimiento; si se repite, coméntenlo al pediatra.',
  };

  function lecturaCombinada(colorId, consId) {
    const partes = [];
    if (colorId && LECTURA_COLOR[colorId]) partes.push(`🎨 ${LECTURA_COLOR[colorId]}`);
    if (consId && LECTURA_CONSISTENCIA[consId]) partes.push(`🥣 ${LECTURA_CONSISTENCIA[consId]}`);
    if (!partes.length) return 'Elijan color y consistencia para ver la lectura.';
    return partes.join('<br><br>');
  }

  /* Análisis en el dispositivo: detecta el color dominante de la foto
     (ignorando el blanco del pañal) y sugiere la clasificación. */
  function analizarFotoPopo(dataUrl) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const S = 72;
        const c = document.createElement('canvas');
        c.width = S; c.height = S;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, S, S);
        const px = ctx.getImageData(0, 0, S, S).data;
        const cuentas = { mostaza: 0, cafe: 0, verde: 0, negro: 0, rojo: 0, gris: 0 };
        const mascara = new Array(S * S).fill(false);
        const lum = new Array(S * S).fill(0);
        let utiles = 0;
        for (let i = 0; i < px.length; i += 4) {
          const idx = i / 4;
          const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
          lum[idx] = 0.299 * r + 0.587 * g + 0.114 * b;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const v = max, s = max === 0 ? 0 : (max - min) / max;
          let h = 0;
          if (max !== min) {
            if (max === r) h = 60 * (((g - b) / (max - min)) % 6);
            else if (max === g) h = 60 * ((b - r) / (max - min) + 2);
            else h = 60 * ((r - g) / (max - min) + 4);
          }
          if (h < 0) h += 360;
          if (s < 0.13 && v > 0.72) continue; // blanco del pañal / fondo claro
          mascara[idx] = true;
          utiles++;
          if (v < 0.16) cuentas.negro++;
          else if (s < 0.16 && v > 0.45) cuentas.gris++;
          else if ((h < 14 || h > 338) && s > 0.42) cuentas.rojo++;
          else if (h >= 14 && h < 42 && v < 0.52) cuentas.cafe++;
          else if (h >= 32 && h < 72) cuentas.mostaza++;
          else if (h >= 72 && h < 175) cuentas.verde++;
          else if (h >= 14 && h < 32) cuentas.cafe++;
          else cuentas.cafe++;
        }
        if (utiles < 80) return res(null); // foto sin suficiente contenido analizable
        const [color, n] = Object.entries(cuentas).sort((a, b) => b[1] - a[1])[0];

        // consistencia: textura (cambios bruscos de luz dentro de la mancha)
        // y qué tan extendida está respecto a la foto
        let bordes = 0, pares = 0;
        for (let yy = 0; yy < S - 1; yy++) {
          for (let xx = 0; xx < S - 1; xx++) {
            const idx = yy * S + xx;
            if (!mascara[idx]) continue;
            if (mascara[idx + 1]) { pares++; if (Math.abs(lum[idx] - lum[idx + 1]) > 0.13) bordes++; }
            if (mascara[idx + S]) { pares++; if (Math.abs(lum[idx] - lum[idx + S]) > 0.13) bordes++; }
          }
        }
        const textura = pares ? bordes / pares : 0;
        const extension = utiles / (S * S);
        let consistencia = 'cremosa';
        if (textura > 0.16) consistencia = 'grumitos';
        else if (extension > 0.5 && textura < 0.06) consistencia = 'liquida';
        else if (extension < 0.12 && textura > 0.08) consistencia = 'dura';

        res({ color, confianza: Math.round((n / utiles) * 100), consistencia });
      };
      img.onerror = () => res(null);
      img.src = dataUrl;
    });
  }


  /* traduccion EN de constantes de la interfaz (el cambio de idioma recarga) */
  if (typeof I18N !== 'undefined' && I18N.lang === 'en') {
    COLORES_POPO.forEach(c => c.nombre = ({ mostaza: 'Mustard', cafe: 'Brown', verde: 'Green', negro: 'Black', rojo: 'Reddish', gris: 'White/gray' })[c.id] || c.nombre);
    CONSISTENCIAS.forEach(c => c.nombre = ({ liquida: 'Watery', cremosa: 'Creamy', grumitos: 'Seedy', pastosa: 'Pasty', dura: 'Hard pellets' })[c.id] || c.nombre);
    Object.assign(LECTURA_COLOR, {
      mostaza: 'Mustard: the classic for breastfed babies. Normal and healthy. ✅',
      cafe: 'Brown: normal, very common with formula. ✅',
      verde: 'Green: usually fine (common with formula or fast transit). If constant or with mucus, mention it at the next visit.',
      negro: 'Black: normal the first days (meconium). If it shows up after week one, tell the pediatrician.',
      rojo: 'Reddish tones can mean blood: worth telling the pediatrician soon. ⚠️',
      gris: 'White or gray is uncommon and deserves a call to the pediatrician. ⚠️',
    });
    Object.assign(LECTURA_CONSISTENCIA, {
      liquida: 'Watery: one now and then is fine; several very liquid in a row may be diarrhea — watch feeding and wet diapers.',
      cremosa: 'Creamy: the typical, healthy consistency.',
      grumitos: 'Seedy ("little curds"): the breastfeeding classic, totally normal.',
      pastosa: 'Pasty: normal, common with formula.',
      dura: 'Hard, dry pellets suggest constipation; if it repeats, tell the pediatrician.',
    });
  }

  function avisoColor(colorId) {
    if (colorId === 'rojo' || colorId === 'gris') {
      setTimeout(() => toast('💡 Ese color vale la pena comentarlo al pediatra'), 1300);
    }
  }

  function renderPanal() {
    const grupos = porDia(Store.data.panales, 'hora');
    const nombre = I18N.lang === 'en'
      ? { pipi: 'Pee', popo: 'Poop', mixto: 'Pee + Poop' }
      : { pipi: 'Pipí', popo: 'Popó', mixto: 'Pipí + Popó' };
    const emoji = { pipi: '💧', popo: '💩', mixto: '🌊' };
    main.innerHTML = `
      <h2 class="section-title">Pañales</h2>
      <div class="diaper-buttons">
        <button class="diaper-btn bg-blue" data-accion="panal-pipi"><span>💧</span>Pipí</button>
        <button class="diaper-btn bg-yellow" data-accion="panal-popo"><span>💩</span>Popó</button>
        <button class="diaper-btn bg-mint" data-accion="panal-mixto"><span>🌊</span>Ambos</button>
      </div>
      <p style="text-align:center;font-size:13px;color:var(--text-2);margin-bottom:2px">Pipí se registra al instante; popó pregunta color y consistencia ✨</p>
      <button class="btn-ghost btn-block" data-accion="panal-manual">＋ Registrar con otra hora</button>
      ${listaEntradas(grupos.map(g => ({ ...g, dia: `${g.dia} · ${g.items.length} pañal${g.items.length === 1 ? '' : 'es'} 🧷` })), p => {
        const col = colorPopo(p.color);
        const cons = consistenciaPopo(p.consistencia);
        return `
        <div class="entry">
          <span class="entry-emoji">${emoji[p.tipo] || '💧'}</span>
          <div class="entry-main">
            <div class="entry-title">${nombre[p.tipo] || p.tipo}${col ? ` <span class="color-dot" style="background:${col.hex}"></span>` : ''}${etiquetaAutor(p)}</div>
            ${col || cons || p.notas ? `<div class="entry-sub">${[col && col.nombre, cons && cons.nombre.toLowerCase(), p.notas && esc(p.notas)].filter(Boolean).join(' · ')}</div>` : ''}
          </div>
          ${p.fotoId ? `<img class="entry-thumb" data-foto-panal="${p.fotoId}" alt="">` : ''}
          <span class="entry-time">${fmtHora(p.hora)}</span>
          ${btnsEntrada('panales', p.id)}
        </div>`;
      }, { emoji: '💧', texto: 'Aquí aparecerán los cambios de pañal' })}
    `;

    main.querySelectorAll('[data-foto-panal]').forEach(async img0 => {
      const f = Store.data.fotos.find(x => x.id === img0.dataset.fotoPanal);
      if (!f) { img0.remove(); return; }
      const p = Store.data.panales.find(x => x.fotoId === f.id);
      const src = f.dataUrl || await Store.fetchPhoto(f);
      // re-consulta el <img> por si un re-render lo reemplazó durante el fetch
      const img = main.querySelector(`[data-foto-panal="${f.id}"]`) || img0;
      if (src && img) { img.src = src; img.onclick = () => hojaAnalisisPanal(p); }
    });
  }

  function registrarPanal(tipo) {
    if (tipo === 'pipi') {
      Store.add('panales', { tipo, hora: new Date().toISOString(), color: null, notas: '' });
      toast('Pipí 💧 registrado');
      return;
    }
    // popó o ambos: color y consistencia con lectura en vivo (foto opcional)
    let fotoPend = null;
    let det = null;
    const sel = { color: null, cons: null };

    abrirSheet(`
      <h2>${I18N.lang === 'en' ? (tipo === 'mixto' ? 'Pee + Poop 🌊' : 'Poop 💩') : (tipo === 'mixto' ? 'Pipí + Popó 🌊' : 'Popó 💩')}</h2>
      <div class="form-group"><label>Color</label>
        <div class="color-picker" id="pp-colores">
          ${COLORES_POPO.map(c => `
            <button class="color-opt" data-color="${c.id}">
              <span class="bolita" style="background:${c.hex}"></span><span class="cnombre">${c.nombre}</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="form-group"><label>Consistencia (opcional)</label>
        <div class="color-picker" id="pp-cons">
          ${CONSISTENCIAS.map(c => `
            <button class="color-opt" data-cons="${c.id}">
              <span style="font-size:24px">${c.emoji}</span><span class="cnombre">${c.nombre}</span>
            </button>`).join('')}
        </div>
      </div>
      <div id="pp-lectura"></div>
      <div id="pp-analisis"></div>
      <button class="btn-primary btn-block" id="pp-guardar" style="margin-top:12px">Guardar registro</button>
      <div class="form-row" style="margin-top:6px">
        <button class="btn-ghost" style="flex:1" id="pp-camara">📷 Tomar foto</button>
        <button class="btn-ghost" style="flex:1" id="pp-carrete">🖼️ Del carrete</button>
      </div>
      <p class="disclaimer">La lectura es orientativa. Si agregan foto, se analiza aquí en el teléfono y se guarda en su repositorio privado.</p>
    `);

    const pintar = () => {
      const colorEf = sel.color || (det && det.color) || null;
      const consEf = sel.cons || (det && det.consistencia) || null;
      document.querySelectorAll('#pp-colores .color-opt').forEach(b => {
        b.classList.toggle('activo', b.dataset.color === sel.color);
        const sug = !sel.color && det && b.dataset.color === det.color;
        b.classList.toggle('sugerido', sug);
        b.querySelector('.cnombre').textContent = (sug ? '✨ ' : '') + colorPopo(b.dataset.color).nombre;
      });
      document.querySelectorAll('#pp-cons .color-opt').forEach(b => {
        b.classList.toggle('activo', b.dataset.cons === sel.cons);
        const sug = !sel.cons && det && b.dataset.cons === det.consistencia;
        b.classList.toggle('sugerido', sug);
        b.querySelector('.cnombre').textContent = (sug ? '✨ ' : '') + consistenciaPopo(b.dataset.cons).nombre;
      });
      $('#pp-lectura').innerHTML = (colorEf || consEf)
        ? `<div class="info-box" style="margin-top:4px"><h4>🔍 Lectura</h4>${lecturaCombinada(colorEf, consEf)}</div>`
        : '';
    };

    document.querySelectorAll('#pp-colores .color-opt').forEach(b => b.onclick = () => {
      sel.color = sel.color === b.dataset.color ? null : b.dataset.color;
      pintar();
    });
    document.querySelectorAll('#pp-cons .color-opt').forEach(b => b.onclick = () => {
      sel.cons = sel.cons === b.dataset.cons ? null : b.dataset.cons;
      pintar();
    });

    $('#pp-guardar').onclick = () => {
      const colorEf = sel.color || (det && det.color) || null;
      const consEf = sel.cons || (det && det.consistencia) || null;
      let fotoId = null;
      if (fotoPend) {
        fotoId = Store.uid();
        Store.add('fotos', {
          id: fotoId, fecha: new Date().toISOString(),
          titulo: `Pañal ${new Date().toLocaleString(I18N.loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
          archivo: `${new Date().toISOString().slice(0, 10)}-${fotoId}.jpg`,
          dataUrl: fotoPend, sincronizada: false, categoria: 'panal',
        });
      }
      Store.add('panales', { tipo, hora: new Date().toISOString(), color: colorEf, consistencia: consEf, notas: '', fotoId });
      cerrarSheet();
      toast(I18N.lang === 'en'
        ? `${tipo === 'mixto' ? 'Full diaper 🌊' : 'Poop 💩'} logged${fotoPend ? ' with photo 📸' : ''}`
        : `${tipo === 'mixto' ? 'Pañal completo 🌊' : 'Popó 💩'} registrado${fotoPend ? ' con foto 📸' : ''}`);
      avisoColor(colorEf);
    };

    const agregarFoto = conCamara => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      if (conCamara) input.capture = 'environment';
      input.onchange = async e => {
        const cont = $('#pp-analisis');
        cont.innerHTML = '<div class="pp-analizando">🔍 Analizando la foto…</div>';
        fotoPend = await leerFoto(e.target.files[0]).catch(() => null);
        if (!fotoPend) { cont.innerHTML = ''; toast('No se pudo leer la foto'); return; }
        det = await analizarFotoPopo(fotoPend);
        cont.innerHTML = `
          <div class="pp-resultado">
            <img src="${fotoPend}" alt="">
            <div><b>📸 Foto lista</b><br>${det
              ? `Lo que veo está marcado con ✨ arriba — corrijan lo que no cuadre.`
              : 'No pude distinguir bien la foto; elijan ustedes el color y consistencia.'}</div>
          </div>`;
        pintar();
      };
      input.click();
    };
    $('#pp-camara').onclick = () => agregarFoto(true);
    $('#pp-carrete').onclick = () => agregarFoto(false);
  }

  /* análisis de una foto de pañal ya guardada: el color que definió el
     usuario manda; si no hay, se usa el detectado. La consistencia se
     estima por textura y se puede corregir. */
  async function hojaAnalisisPanal(p) {
    const foto = Store.data.fotos.find(x => x.id === p.fotoId);
    if (!foto) { toast('Este registro no tiene foto'); return; }

    let sel = { color: p.color || null, cons: p.consistencia || null };
    let detectado = null;

    abrirSheet(`
      <h2>Análisis del pañal 🔍</h2>
      <img id="an-img" style="width:100%;max-height:280px;object-fit:contain;border-radius:16px;background:#2b233010" alt="">
      <div class="pp-analizando" id="an-status">Cargando foto…</div>
      <div class="form-group" style="margin-top:8px"><label id="an-lbl-color">Color</label>
        <div class="color-picker" id="an-colores">
          ${COLORES_POPO.map(c => `
            <button type="button" class="color-opt" data-color="${c.id}">
              <span class="bolita" style="background:${c.hex}"></span><span class="cnombre">${c.nombre}</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="form-group"><label id="an-lbl-cons">Consistencia</label>
        <div class="color-picker" id="an-cons">
          ${CONSISTENCIAS.map(c => `
            <button type="button" class="color-opt" data-cons="${c.id}">
              <span style="font-size:24px">${c.emoji}</span><span class="cnombre">${c.nombre}</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="info-box" id="an-lectura"></div>
      <button class="btn-primary btn-block" id="an-guardar" style="margin-top:12px">Guardar</button>
      <button class="btn-ghost btn-block" id="an-borrar" style="color:var(--danger)">🗑️ Borrar la foto de este registro</button>
      <p class="disclaimer">Análisis aproximado hecho en el teléfono; no sustituye la valoración del pediatra.</p>
    `);

    const pintar = () => {
      const colorEf = sel.color || (detectado && detectado.color) || null;
      const consEf = sel.cons || (detectado && detectado.consistencia) || null;
      document.querySelectorAll('#an-colores .color-opt').forEach(b => {
        b.classList.toggle('activo', b.dataset.color === sel.color);
        const esSug = !sel.color && detectado && b.dataset.color === detectado.color;
        b.classList.toggle('sugerido', esSug);
        b.querySelector('.cnombre').textContent = (esSug ? '✨ ' : '') + colorPopo(b.dataset.color).nombre;
      });
      document.querySelectorAll('#an-cons .color-opt').forEach(b => {
        b.classList.toggle('activo', b.dataset.cons === sel.cons);
        const esSug = !sel.cons && detectado && b.dataset.cons === detectado.consistencia;
        b.classList.toggle('sugerido', esSug);
        b.querySelector('.cnombre').textContent = (esSug ? '✨ ' : '') + consistenciaPopo(b.dataset.cons).nombre;
      });
      $('#an-lbl-color').textContent = sel.color ? 'Color (definido por ustedes)' : 'Color (✨ = lo que veo en la foto)';
      $('#an-lbl-cons').textContent = sel.cons ? 'Consistencia (definida por ustedes)' : 'Consistencia (✨ = lo que veo en la foto)';
      $('#an-lectura').innerHTML = `<h4>🔍 Lectura</h4>${lecturaCombinada(colorEf, consEf)}`;
    };

    document.querySelectorAll('#an-colores .color-opt').forEach(b => b.onclick = () => {
      sel.color = sel.color === b.dataset.color ? null : b.dataset.color;
      pintar();
    });
    document.querySelectorAll('#an-cons .color-opt').forEach(b => b.onclick = () => {
      sel.cons = sel.cons === b.dataset.cons ? null : b.dataset.cons;
      pintar();
    });

    $('#an-guardar').onclick = () => {
      const colorEf = sel.color || (detectado && detectado.color) || null;
      const consEf = sel.cons || (detectado && detectado.consistencia) || null;
      Store.update('panales', p.id, { color: colorEf, consistencia: consEf });
      cerrarSheet();
      toast('Análisis guardado 🔍');
      avisoColor(colorEf);
    };
    $('#an-borrar').onclick = () => {
      if (!confirm(I18N.t('¿Borrar la foto? El registro del pañal se conserva.'))) return;
      Store.remove('fotos', foto.id);
      Store.update('panales', p.id, { fotoId: null });
      cerrarSheet();
      toast('Foto borrada');
    };

    // cargar la foto y analizarla
    const src = foto.dataUrl || await Store.fetchPhoto(foto);
    if (!src) { $('#an-status').textContent = 'No se pudo cargar la foto (¿sin conexión?)'; pintar(); return; }
    $('#an-img').src = src;
    $('#an-status').textContent = '🔍 Analizando…';
    detectado = await analizarFotoPopo(src);
    $('#an-status').remove();
    pintar();
  }

  function hojaPanal(existente) {
    const tipo0 = existente ? existente.tipo : 'pipi';
    abrirSheet(`
      <h2>${existente ? 'Editar pañal' : 'Registrar pañal'}</h2>
      <div class="form-group"><label>Tipo</label>
        <select id="f-tipo">
          <option value="pipi" ${tipo0 === 'pipi' ? 'selected' : ''}>💧 Pipí</option>
          <option value="popo" ${tipo0 === 'popo' ? 'selected' : ''}>💩 Popó</option>
          <option value="mixto" ${tipo0 === 'mixto' ? 'selected' : ''}>🌊 Ambos</option>
        </select>
      </div>
      <div id="f-color-grupo" class="form-group ${tipo0 === 'pipi' ? 'hidden' : ''}"><label>Color de la popó</label>
        <div class="color-picker">
          ${COLORES_POPO.map(c => `
            <button type="button" class="color-opt ${existente && existente.color === c.id ? 'activo' : ''}" data-color="${c.id}">
              <span class="bolita" style="background:${c.hex}"></span>${c.nombre}
            </button>`).join('')}
        </div>
      </div>
      <div id="f-cons-grupo" class="form-group ${tipo0 === 'pipi' ? 'hidden' : ''}"><label>Consistencia</label>
        <div class="color-picker">
          ${CONSISTENCIAS.map(c => `
            <button type="button" class="color-opt ${existente && existente.consistencia === c.id ? 'activo' : ''}" data-cons="${c.id}">
              <span style="font-size:24px">${c.emoji}</span>${c.nombre}
            </button>`).join('')}
        </div>
      </div>
      <div class="form-group"><label>Hora</label>
        <input type="datetime-local" id="f-hora" value="${aInputLocal(existente ? existente.hora : null)}">
      </div>
      <div class="form-group"><label>Notas (consistencia, cantidad…)</label>
        <input type="text" id="f-notas" value="${esc(existente ? existente.notas : '')}" placeholder="Aguada, con semillitas, abundante…">
      </div>
      <button class="btn-primary btn-block" id="f-guardar">Guardar</button>
    `);
    let color = existente ? existente.color : null;
    let cons = existente ? (existente.consistencia || null) : null;
    document.querySelectorAll('#f-color-grupo .color-opt').forEach(b => b.onclick = () => {
      color = color === b.dataset.color ? null : b.dataset.color; // tocar de nuevo lo quita
      document.querySelectorAll('#f-color-grupo .color-opt').forEach(x =>
        x.classList.toggle('activo', x.dataset.color === color));
    });
    document.querySelectorAll('#f-cons-grupo .color-opt').forEach(b => b.onclick = () => {
      cons = cons === b.dataset.cons ? null : b.dataset.cons;
      document.querySelectorAll('#f-cons-grupo .color-opt').forEach(x =>
        x.classList.toggle('activo', x.dataset.cons === cons));
    });
    $('#f-tipo').onchange = () => {
      const esPipi = $('#f-tipo').value === 'pipi';
      $('#f-color-grupo').classList.toggle('hidden', esPipi);
      $('#f-cons-grupo').classList.toggle('hidden', esPipi);
    };
    $('#f-guardar').onclick = () => {
      const esPipi = $('#f-tipo').value === 'pipi';
      const reg = {
        tipo: $('#f-tipo').value,
        color: esPipi ? null : color,
        consistencia: esPipi ? null : cons,
        hora: deInputLocal($('#f-hora').value),
        notas: $('#f-notas').value.trim(),
      };
      if (existente) Store.update('panales', existente.id, reg);
      else Store.add('panales', reg);
      cerrarSheet();
      toast(existente ? 'Pañal actualizado' : 'Pañal registrado');
      avisoColor(reg.color);
    };
  }

  /* ============================================================
     RETOS (actividades de estimulación)
  ============================================================ */
  function confeti(cantidad = 60) {
    const colores = ['#f06a9b', '#ffd166', '#4cc38a', '#74b9f0', '#c79df5', '#ff9ec3'];
    for (let i = 0; i < cantidad; i++) {
      const c = document.createElement('div');
      c.className = 'confeti';
      c.style.left = `${Math.random() * 100}vw`;
      c.style.background = colores[i % colores.length];
      c.style.width = c.style.height = `${6 + Math.random() * 7}px`;
      c.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
      c.style.animationDuration = `${1.3 + Math.random() * 1.4}s`;
      c.style.animationDelay = `${Math.random() * .35}s`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3200);
    }
  }

  function celebracion(emoji, texto, sub) {
    const div = document.createElement('div');
    div.className = 'celebracion';
    div.innerHTML = `<div class="cele-card">
      <span class="cele-emoji">${emoji}</span>
      <div class="cele-texto">${texto}</div>
      ${sub ? `<div class="cele-sub">${sub}</div>` : ''}
    </div>`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3300);
  }

  function tareasHoy() {
    const dias = edadDias();
    if (dias === null) return null;
    return Actividades.tareasDeHoy(dias, Store.data.condiciones.filter(c => !c.curada), fechaLocal());
  }

  function renderRetos() {
    const info = tareasHoy();
    if (!info) {
      main.innerHTML = `
        <h2 class="section-title">Retos del día 🏆</h2>
        <div class="empty-state"><span class="big">🎂</span>
          ${I18N.lang === 'en' ? `To suggest activities tailored to ${nb()}, set the birth date in` : `Para sugerirle actividades a su medida, pon la fecha de nacimiento de ${nb()} en`}
          <b>${I18N.lang === 'en' ? 'More → Settings' : 'Más → Ajustes'}</b>.</div>`;
      return;
    }
    const hoy = fechaLocal();
    const regs = Store.data.actividades;
    const hechaHoy = key => regs.some(a => a.fecha === hoy && a.tarea === key && a.hecha);
    const hechas = info.tareas.filter(t => hechaHoy(t.key)).length;
    const sem = semanaActual();
    const fotoLista = Store.data.fotos.some(f => f.semana === sem);
    const total = info.tareas.length + 1; // +1 por la foto semanal
    const completadas = hechas + (fotoLista ? 1 : 0);
    const rachaDias = Actividades.racha(regs, hoy);
    const fotosSem = new Set(Store.data.fotos.filter(f => f.semana != null).map(f => f.semana)).size;
    const medallas = Actividades.medallas(regs, fotosSem, rachaDias);
    const C = 2 * Math.PI * 36;
    const timers = Store.getTimers();

    main.innerHTML = `
      <h2 class="section-title">Retos del día 🏆</h2>
      <div class="retos-hero">
        <div class="anillo">
          <svg width="86" height="86">
            <circle class="fondo" cx="43" cy="43" r="36"></circle>
            <circle class="avance" cx="43" cy="43" r="36"
              stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - completadas / total)}"></circle>
          </svg>
          <div class="num">${completadas}/${total}<small>de hoy</small></div>
        </div>
        <div>
          <h2>${completadas >= total ? '¡Día perfecto! 🌟' : completadas > 0 ? '¡Van muy bien!' : 'Retos de hoy'}</h2>
          <div class="hero-sub">${I18N.lang === 'en' ? `Stage: ${info.etapa.nombre} · week ${sem} of life` : `Etapa: ${info.etapa.nombre} · semana ${sem} de vida`}</div>
          <div class="racha-chip"><span class="flama">🔥</span> ${rachaDias} día${rachaDias === 1 ? '' : 's'} de racha</div>
        </div>
      </div>

      ${fotoLista ? '' : `
      <div class="tarea especial" style="animation-delay:0s">
        <span class="t-emoji">📸</span>
        <div class="t-main">
          <div class="t-titulo">Foto de la semana ${sem}</div>
          <div class="t-desc">Su retrato semanal para ver su progreso. ¡La de esta semana aún no está!</div>
        </div>
        <button class="t-play" data-accion="foto-semanal" data-sem="${sem}">📷</button>
      </div>`}

      ${info.tareas.map(t => {
        const hecha = hechaHoy(t.key);
        const activa = timers.actividad && timers.actividad.key === t.key;
        let boton;
        if (hecha) boton = `<button class="t-check lista" data-tarea="${t.key}">✓</button>`;
        else if (activa) boton = `<button class="t-check" style="border-style:solid;border-color:#4cc38a;color:#2ea06d;font-size:13px;font-weight:800">⏳</button>`;
        else if (t.min) boton = `<button class="t-play" data-timer-tarea="${t.key}">▶<small>${t.min} min</small></button>`;
        else boton = `<button class="t-check" data-tarea="${t.key}">✓</button>`;
        return `
        <div class="tarea ${hecha ? 'hecha' : ''}">
          <span class="t-emoji">${t.emoji}</span>
          <div class="t-main">
            ${t.porCondicion ? `<span class="t-cond">${I18N.lang === 'en' ? 'for' : 'por'} ${esc(t.porCondicion)}</span><br>` : ''}
            <div class="t-titulo">${esc(t.titulo)}</div>
            <div class="t-desc">${esc(t.desc)}</div>
          </div>
          ${boton}
        </div>`;
      }).join('')}

      <h2 class="section-title" style="margin-top:22px">Medallero 🏅</h2>
      <div class="medallero">
        ${medallas.map(m => `
          <div class="medalla ${m.ganada ? 'ganada' : ''}" title="${esc(m.desc)}">
            <span class="m-emoji">${m.emoji}</span>
            <span class="m-nombre">${esc(m.nombre)}</span>
          </div>`).join('')}
      </div>
      <p class="disclaimer">Actividades sugeridas según su edad (guías de estimulación temprana AAP/CDC). Siempre con supervisión; cada bebé lleva su propio ritmo. 💗</p>
    `;

    main.querySelectorAll('[data-tarea]').forEach(b => b.onclick = () => alternarTarea(b.dataset.tarea));
    main.querySelectorAll('[data-timer-tarea]').forEach(b => b.onclick = () => iniciarActividad(b.dataset.timerTarea));
  }

  function alternarTarea(key) {
    const info = tareasHoy();
    const t = info.tareas.find(x => x.key === key);
    if (!t) return;
    const hoy = fechaLocal();
    const yaHecha = Store.data.actividades.some(a => a.fecha === hoy && a.tarea === key && a.hecha);
    Store.marcarActividad(hoy, key, t.titulo, !yaHecha);
    if (!yaHecha) festejarTarea(t);
  }

  function festejarTarea(t) {
    confeti(50);
    toast(I18N.lang === 'en' ? `${t.emoji} ${t.titulo} done!` : `${t.emoji} ¡${t.titulo} lista!`);
    // ¿día perfecto?
    setTimeout(() => {
      const info = tareasHoy();
      const hoy = fechaLocal();
      const todas = info.tareas.every(x => Store.data.actividades.some(a => a.fecha === hoy && a.tarea === x.key && a.hecha));
      if (todas) {
        confeti(120);
        celebracion('🌟', I18N.lang === 'en' ? 'Perfect day!' : '¡Día perfecto!', I18N.lang === 'en' ? `You finished all of today's goals with ${nb()}` : `Completaron todos los retos de hoy con ${nb()}`);
      }
    }, 350);
  }

  function iniciarActividad(key) {
    const timers = Store.getTimers();
    if (timers.actividad) { toast('Ya hay una actividad en curso'); return; }
    const info = tareasHoy();
    const t = info.tareas.find(x => x.key === key);
    if (!t) return;
    timers.actividad = { key, titulo: t.titulo, emoji: t.emoji, min: t.min, inicio: new Date().toISOString(), fecha: fechaLocal() };
    Store.setTimers(timers);
    toast(`${t.emoji} ${t.titulo} · ${t.min} min ▶`);
  }

  function terminarActividad(completar) {
    const timers = Store.getTimers();
    const act = timers.actividad;
    if (!act) return;
    delete timers.actividad;
    Store.setTimers(timers);
    if (!completar) { toast('Actividad cancelada'); return; }
    const seg = Math.round((Date.now() - new Date(act.inicio)) / 1000);
    Store.marcarActividad(act.fecha, act.key, act.titulo, true, seg);
    festejarTarea(act);
  }

  /* ============================================================
     BANCO DE LECHE 🥛
     Libro de movimientos del que se calculan los saldos:
     refri (lista para usar) y congelador (reserva).
  ============================================================ */
  function saldosBanco() {
    // en orden cronológico y con piso en cero: si una toma consume leche
    // que no estaba registrada, se come lo disponible y ya — el banco
    // nunca "debe" leche ni acumula hoyos invisibles. Lo consumido de
    // más se reporta como "faltante" para poder avisar.
    const movs = [...Store.data.banco].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    let refri = 0, cong = 0, faltante = 0;
    for (const m of movs) {
      const ml = Number(m.ml) || 0;
      switch (m.tipo) {
        case 'extraccion': m.lugar === 'congelador' ? cong += ml : refri += ml; break;
        case 'descongelar': { const q = Math.min(ml, cong); cong -= q; refri += q; break; }
        case 'congelar': { const q = Math.min(ml, refri); refri -= q; cong += q; break; }
        case 'consumo': { const q = Math.min(ml, refri); faltante += ml - q; refri -= q; break; }
        case 'descarte': m.lugar === 'congelador' ? cong = Math.max(0, cong - ml) : refri = Math.max(0, refri - ml); break;
        case 'ajuste': m.lugar === 'congelador' ? cong = Math.max(0, cong + ml) : refri = Math.max(0, refri + ml); break;
      }
    }
    return { refri: Math.round(refri), cong: Math.round(cong), faltante: Math.round(faltante) };
  }

  // meta sugerida: 2 días del consumo promedio de leche extraída en biberón
  // (últimos 3 días con registros). Sin datos aún: 150 ml de arranque.
  function objetivoBanco() {
    const porDia = {};
    Store.data.tomas.filter(t => t.tipo === 'donante' && t.ml).forEach(t => {
      const f = fechaLocal(t.inicio);
      porDia[f] = (porDia[f] || 0) + Number(t.ml);
    });
    const dias = Object.keys(porDia).sort().slice(-3);
    const prom = dias.length ? dias.reduce((s, f) => s + porDia[f], 0) / dias.length : 0;
    const meta = (prom || 75) * 2;
    return Math.max(60, Math.round(meta / 10) * 10);
  }

  // nivel en tercios respecto a la meta
  function nivelBanco(refri, objetivo) {
    const pct = objetivo ? refri / objetivo : 0;
    if (pct >= 2 / 3) return { color: '#4cc38a', texto: I18N.lang === 'en' ? 'Healthy stash 💚' : 'Reserva sana 💚' };
    if (pct >= 1 / 3) return { color: '#f5b54a', texto: I18N.lang === 'en' ? 'Halfway there 💛' : 'Va a la mitad 💛' };
    return { color: '#e25555', texto: refri <= 0 ? (I18N.lang === 'en' ? 'No milk ready ❤️' : 'Sin leche lista ❤️') : (I18N.lang === 'en' ? 'Running low ❤️' : 'Queda poquita ❤️') };
  }

  function tanqueHTML(refri, objetivo, grande) {
    const nivel = nivelBanco(refri, objetivo);
    const pct = Math.min(100, Math.round((objetivo ? refri / objetivo : 0) * 100));
    return `
      <div class="tanque ${grande ? 'grande' : ''}" title="${pct}% de la meta">
        <div class="nivel" style="height:${Math.max(pct, refri > 0 ? 8 : 0)}%;background-color:${nivel.color}">
          <div class="ola"></div>
        </div>
      </div>`;
  }

  function bancoCardInicio() {
    const { refri, cong } = saldosBanco();
    const objetivo = objetivoBanco();
    const nivel = nivelBanco(refri, objetivo);
    return `
      <div class="banco-card" data-accion="ver-banco">
        ${tanqueHTML(refri, objetivo)}
        <div class="banco-info">
          <div class="b-titulo">Banco de leche 🥛</div>
          <div class="b-ml">${refri} ml <small style="font-size:13px;color:var(--text-2);font-weight:600">listos en el refri</small></div>
          <div class="b-sub">🧊 ${cong} ml congelados · meta ${objetivo} ml (~2 días)</div>
          <span class="nivel-chip" style="background:${nivel.color}">${nivel.texto}</span>
        </div>
        <span class="mi-chev" style="color:#d4c6cd;font-size:20px">›</span>
      </div>`;
  }

  // mantiene el banco en sintonía con las tomas de leche extraída
  function sincronizarConsumoBanco(toma) {
    const mov = Store.data.banco.find(m => m.tomaId === toma.id);
    if (toma.tipo === 'donante' && Number(toma.ml) > 0) {
      if (mov) Store.update('banco', mov.id, { ml: Number(toma.ml), fecha: toma.inicio });
      else Store.add('banco', { tipo: 'consumo', lugar: 'refri', ml: Number(toma.ml), fecha: toma.inicio, tomaId: toma.id, notas: '' });
    } else if (mov) {
      Store.remove('banco', mov.id);
    }
  }

  const NOMBRE_MOV = I18N.lang === 'en' ? {
    extraccion: m => ({ emoji: '🥛', titulo: `Pumped → ${m.lugar === 'congelador' ? 'freezer' : 'fridge'}` }),
    descongelar: () => ({ emoji: '🧊', titulo: 'Thawed → fridge' }),
    congelar: () => ({ emoji: '❄️', titulo: 'Fridge → freezer' }),
    consumo: () => ({ emoji: '🍼', titulo: 'Expressed-milk feed' }),
    descarte: m => ({ emoji: '🗑️', titulo: `Discarded (${m.lugar === 'congelador' ? 'freezer' : 'fridge'})` }),
    ajuste: m => ({ emoji: '✏️', titulo: `${m.lugar === 'congelador' ? 'Freezer' : 'Fridge'} correction` }),
  } : {
    extraccion: m => ({ emoji: '🥛', titulo: `Extracción → ${m.lugar === 'congelador' ? 'congelador' : 'refri'}` }),
    descongelar: () => ({ emoji: '🧊', titulo: 'Descongelada → refri' }),
    congelar: () => ({ emoji: '❄️', titulo: 'Del refri → congelador' }),
    consumo: () => ({ emoji: '🍼', titulo: 'Toma de leche extraída' }),
    descarte: m => ({ emoji: '🗑️', titulo: `Descartada (${m.lugar === 'congelador' ? 'congelador' : 'refri'})` }),
    ajuste: m => ({ emoji: '✏️', titulo: `Corrección de ${m.lugar === 'congelador' ? 'congelador' : 'refri'}` }),
  };

  /* ---------- timer de extracción con métodos guiados ---------- */
  const MODOS_EXTRACCION = {
    normal: {
      nombre: 'Sencilla', emoji: '🍼', fases: null,
      desc: 'Libre: tú decides cuándo parar. Recomendado 15–20 min.',
    },
    medela: {
      nombre: 'Medela 2 fases', emoji: '🎛️',
      desc: 'El ciclo de tu bomba: 2 min en modo estimulación (gotitas) y 13 en modo extracción. Te aviso cuándo cambiar.',
      fases: [
        { nombre: 'Estimulación (modo gotitas)', min: 2 },
        { nombre: 'Extracción (modo succión)', min: 13 },
      ],
    },
    stanford: {
      nombre: 'Manos activas', emoji: '🙌',
      desc: 'Método Stanford: masaje antes, compresiones durante y remate manual. Puede sacar hasta 48% más.',
      fases: [
        { nombre: 'Masaje en ambos pechos', min: 2 },
        { nombre: 'Extraer con compresiones', min: 15 },
        { nombre: 'Remate con extracción manual', min: 3 },
      ],
    },
    power: {
      nombre: 'Power pumping', emoji: '⚡',
      desc: 'Para subir producción: simula que la bebé pide muy seguido. Ideal 1 vez al día por 3–7 días. Dura 1 hora.',
      fases: [
        { nombre: 'Extraer', min: 20 },
        { nombre: 'Descansar', min: 10 },
        { nombre: 'Extraer', min: 10 },
        { nombre: 'Descansar', min: 10 },
        { nombre: 'Extraer', min: 10 },
      ],
    },
    powerx: {
      nombre: 'Power exprés', emoji: '🌪️',
      desc: 'La versión corta del power pumping para cuando no hay una hora: 40 min.',
      fases: [
        { nombre: 'Extraer', min: 10 },
        { nombre: 'Descansar', min: 5 },
        { nombre: 'Extraer', min: 10 },
        { nombre: 'Descansar', min: 5 },
        { nombre: 'Extraer', min: 10 },
      ],
    },
    postoma: {
      nombre: 'Después de amamantar', emoji: '➕',
      desc: '10 min justo después de la toma: manda la señal de "se necesita más" sin quitarle leche a la bebé.',
      fases: [{ nombre: 'Extraer', min: 10 }],
    },
  };

  if (typeof I18N !== 'undefined' && I18N.lang === 'en') {
    const M = {
      normal: ['Simple', 'Free-form: you decide when to stop. 15-20 min recommended.'],
      medela: ['Medela 2-phase', "Your pump's cycle: 2 min stimulation (letdown) and 13 min expression. I'll tell you when to switch."],
      stanford: ['Hands-on', 'Stanford method: massage before, compressions during and a hand-express finish. Up to 48% more milk.'],
      power: ['Power pumping', "To boost supply: mimics cluster feeding. Ideal once a day for 3-7 days. Takes 1 hour."],
      powerx: ['Power express', 'The short power-pumping version when there is no full hour: 40 min.'],
      postoma: ['After nursing', '10 min right after a feed: sends the "make more" signal without taking milk from the baby.'],
    };
    const F = { 'Extraer': 'Pump', 'Descansar': 'Rest', 'Estimulación (modo gotitas)': 'Stimulation (letdown mode)', 'Extracción (modo succión)': 'Expression (suction mode)', 'Masaje en ambos pechos': 'Massage both breasts', 'Extraer con compresiones': 'Pump with compressions', 'Remate con extracción manual': 'Hand-express finish' };
    Object.entries(MODOS_EXTRACCION).forEach(([id, m]) => {
      if (M[id]) { m.nombre = M[id][0]; m.desc = M[id][1]; }
      (m.fases || []).forEach(f => { if (F[f.nombre]) f.nombre = F[f.nombre]; });
    });
  }

  const modoExt = id => MODOS_EXTRACCION[id] || MODOS_EXTRACCION.normal;
  const duracionModo = m => (m.fases || []).reduce((s, f) => s + f.min, 0);

  function faseDe(modoId, seg) {
    const fases = modoExt(modoId).fases;
    if (!fases) return null;
    let acc = 0;
    for (let i = 0; i < fases.length; i++) {
      acc += fases[i].min * 60;
      if (seg < acc) return { i, total: fases.length, nombre: fases[i].nombre, min: fases[i].min, restante: acc - seg };
    }
    return { fin: true }; // sesión completa
  }

  function hojaElegirMetodo() {
    abrirSheet(`
      <h2>¿Qué método hoy? 🥛</h2>
      <div class="menu-list">
        ${Object.entries(MODOS_EXTRACCION).map(([id, m]) => `
          <button class="menu-item" data-metodo="${id}">
            <span class="mi-emoji bg-blue">${m.emoji}</span>
            <span>${m.nombre}${m.fases ? ` <small style="font-weight:600;color:var(--text-2)">· ${duracionModo(m)} min</small>` : ''}
              <span class="mi-sub">${m.desc}</span></span>
          </button>`).join('')}
      </div>
    `);
    document.querySelectorAll('[data-metodo]').forEach(b => b.onclick = () => {
      cerrarSheet();
      iniciarExtraccion(b.dataset.metodo);
    });
  }

  function iniciarExtraccion(modoId) {
    const timers = Store.getTimers();
    if (timers.extraccion) { toast('Ya hay una extracción en curso'); return; }
    timers.extraccion = { inicio: new Date().toISOString(), modo: modoId, faseAvisada: 0 };
    Store.setTimers(timers);
    const m = modoExt(modoId);
    toast(m.fases ? `${m.emoji} ${m.nombre}: ${m.fases[0].nombre}, ${m.fases[0].min} min` : '⏱️ Extracción iniciada');
  }

  function terminarExtraccion(cancelar) {
    const timers = Store.getTimers();
    const ext = timers.extraccion;
    if (!ext) return;
    delete timers.extraccion;
    Store.setTimers(timers);
    if (cancelar) { toast('Extracción cancelada'); return; }
    const dur = Math.round((Date.now() - new Date(ext.inicio)) / 1000);
    hojaFinExtraccion(dur, ext.modo, ext.inicio);
  }

  function hojaFinExtraccion(duracionSeg, modo, inicioISO) {
    abrirSheet(`
      <h2>¿Cuánto salió? 🥛</h2>
      <p style="font-size:13px;color:var(--text-2)">Sesión de ${Math.max(1, Math.round(duracionSeg / 60))} min${modo && modo !== 'normal' ? ` · ${modoExt(modo).emoji} ${modoExt(modo).nombre}` : ''}</p>
      <div class="ml-stepper">
        <button type="button" id="ml-menos">−</button>
        <div class="ml-value"><span id="ml-num">30</span> <small>ml</small></div>
        <button type="button" id="ml-mas">+</button>
      </div>
      <div class="ml-presets">
        ${[10, 20, 30, 45, 60, 90].map(v => `<button type="button" data-ml="${v}">${v} ml</button>`).join('')}
      </div>
      <div class="form-group"><label>¿Dónde se guarda?</label>
        <div class="quien-chips" id="f-lugar">
          <button type="button" class="activo" data-lugar="refri">🥛 Refri</button>
          <button type="button" data-lugar="congelador">🧊 Congelador</button>
        </div>
      </div>
      <div class="form-group"><label>Notas (opcional)</label>
        <input type="text" id="f-notas" placeholder="Lado izquierdo, en la mañana…">
      </div>
      <button class="btn-primary btn-block" id="f-guardar">Guardar extracción</button>
      <button class="btn-ghost btn-block" id="f-descartar" style="color:var(--danger)">Descartar sesión (no salió leche)</button>
    `);
    let ml = 30, lugar = 'refri';
    const num = $('#ml-num');
    $('#ml-menos').onclick = () => { ml = Math.max(0, ml - 5); num.textContent = ml; };
    $('#ml-mas').onclick = () => { ml += 5; num.textContent = ml; };
    document.querySelectorAll('[data-ml]').forEach(b => b.onclick = () => { ml = Number(b.dataset.ml); num.textContent = ml; });
    $('#f-lugar').addEventListener('click', e => {
      const b = e.target.closest('[data-lugar]');
      if (!b) return;
      lugar = b.dataset.lugar;
      $('#f-lugar').querySelectorAll('button').forEach(x => x.classList.toggle('activo', x === b));
    });
    $('#f-descartar').onclick = () => { cerrarSheet(); toast('Sesión descartada'); };
    $('#f-guardar').onclick = () => {
      if (!ml) { toast('Pon los mililitros (o descarta la sesión)'); return; }
      // récords ANTES de guardar, para comparar contra lo anterior
      const exts = Store.data.banco.filter(m => m.tipo === 'extraccion' && m.ml > 0);
      const maxSesion = Math.max(0, ...exts.map(m => Number(m.ml)));
      const porDia = {};
      exts.forEach(m => { const f = fechaLocal(m.fecha); porDia[f] = (porDia[f] || 0) + Number(m.ml); });
      const hoy = fechaLocal();
      const maxDiaPrevio = Math.max(0, ...Object.entries(porDia).filter(([f]) => f !== hoy).map(([, v]) => v));
      const totalHoy = (porDia[hoy] || 0) + ml;

      Store.add('banco', {
        tipo: 'extraccion', lugar, ml, fecha: inicioISO || new Date().toISOString(),
        duracionSeg, modo: modo || 'normal', notas: $('#f-notas').value.trim(),
      });
      cerrarSheet();
      const promSesion = exts.length >= 5 ? exts.reduce((s, m) => s + Number(m.ml), 0) / exts.length : null;
      if (exts.length >= 3 && ml > maxSesion) {
        confeti(100);
        celebracion('🏆', I18N.lang === 'en' ? 'New session record!' : '¡Nuevo récord de sesión!', I18N.lang === 'en' ? `${ml} ml in a single session` : `${ml} ml en una sola extracción`);
      } else if (Object.keys(porDia).length >= 2 && totalHoy > maxDiaPrevio) {
        confeti(80);
        celebracion('🥇', I18N.lang === 'en' ? 'Daily production record!' : '¡Récord de producción diaria!', I18N.lang === 'en' ? `${totalHoy} ml pumped today` : `${totalHoy} ml extraídos hoy`);
      } else if (promSesion && ml < promSesion * 0.6) {
        // sesión floja: ánimo, no números fríos
        celebracion('💗', I18N.lang === 'en' ? "It's okay, this is normal" : 'Tranquila, es normal', I18N.lang === 'en' ? 'Some sessions and days yield less milk — it says nothing about you. Breathe, drink water and take a break 🤍' : `Hay sesiones y días con menos leche — no dice nada de ti. Respira, toma agua y date un respiro 🤍`);
        setTimeout(() => toast(I18N.lang === 'en' ? `🥛 +${ml} ml saved · every drop counts` : `🥛 +${ml} ml guardados · cada gota cuenta`), 3600);
      } else {
        toast(`🥛 +${ml} ml al ${lugar === 'congelador' ? 'congelador' : 'refri'}`);
      }
    };
  }

  /* ---------- estadísticas y entrenadora de producción ---------- */
  function statsExtraccion() {
    const exts = Store.data.banco.filter(m => m.tipo === 'extraccion' && m.ml > 0);
    const porDia = {};
    exts.forEach(m => { const f = fechaLocal(m.fecha); porDia[f] = (porDia[f] || 0) + Number(m.ml); });
    const fechas = Object.keys(porDia).sort();
    const hoy = fechaLocal();
    const ult7 = fechas.slice(-7);
    const promedio = ult7.length ? Math.round(ult7.reduce((s, f) => s + porDia[f], 0) / ult7.length) : 0;
    const sesionesPorDia = fechas.length ? Math.round((exts.length / fechas.length) * 10) / 10 : 0;
    const conDur = exts.filter(m => m.duracionSeg);
    const durProm = conDur.length ? Math.round(conDur.reduce((s, m) => s + m.duracionSeg, 0) / conDur.length / 60) : null;
    const ult3 = fechas.slice(-3).reduce((s, f) => s + porDia[f], 0) / Math.max(1, Math.min(3, fechas.length));
    const prev3 = fechas.slice(-6, -3);
    const prev = prev3.length ? prev3.reduce((s, f) => s + porDia[f], 0) / prev3.length : null;
    const tendencia = prev ? Math.round(((ult3 - prev) / prev) * 100) : null;
    const madrugada = exts.some(m => {
      const h = new Date(m.fecha).getHours();
      return m.fecha >= new Date(Date.now() - 3 * 86400000).toISOString() && h >= 2 && h < 6;
    });
    return {
      exts, porDia, fechas,
      hoy: porDia[hoy] || 0,
      promedio, sesionesPorDia, durProm, tendencia, madrugada,
      recordSesion: Math.max(0, ...exts.map(m => Number(m.ml))),
      recordDia: Math.max(0, ...Object.values(porDia)),
    };
  }

  const TIPS_GENERALES = [
    { emoji: '📏', texto: 'Revisa la talla del embudo de tu Medela: el pezón debe moverse libre sin jalar areola. Una talla equivocada puede bajar mucho la producción (y doler).' },
    { emoji: '🎚️', texto: 'En tu Medela usa el vacío más alto que NO duela: sube niveles hasta que incomode y bájale uno. Dolor = menos leche, no más.' },
    { emoji: '🤲', texto: 'Aprovecha que tu bomba es manos libres: compresiones suaves en el pecho mientras extraes sacan notablemente más (método "manos activas" del timer).' },
    { emoji: '💆', texto: 'Masaje suave y compresas tibias 2 minutos antes: el reflejo de bajada llega antes y sale más leche.' },
    { emoji: '👶', texto: 'Ver, oler o tener cerca a la bebé (o su foto en la app 😉) mientras extraes libera oxitocina y mejora la bajada.' },
    { emoji: '💧', texto: 'Hidratación y comidas completas: la leche es ~90% agua. Ten un vaso al lado en cada sesión.' },
    { emoji: '🍼', texto: 'El método "Después de amamantar" del timer (10 min tras la toma) manda la señal de "se necesita más" sin robarle leche a la bebé.' },
    { emoji: '🧘', texto: 'El estrés bloquea la oxitocina: hombros sueltos, respira profundo y no te quedes viendo el bote.' },
    { emoji: '🔄', texto: 'Si la bomba deja de sacar pero aún sientes leche, vuelve 1 minuto al modo estimulación de tu Medela: provoca una segunda bajada.' },
  ];


  if (typeof I18N !== 'undefined' && I18N.lang === 'en') {
    TIPS_GENERALES.length = 0;
    TIPS_GENERALES.push(
      { emoji: '📏', texto: 'Check your Medela flange size: the nipple should move freely without pulling areola. A wrong size can really lower output (and hurt).' },
      { emoji: '🎚️', texto: 'Use the highest vacuum that does NOT hurt: step up until uncomfortable, then back one. Pain = less milk, not more.' },
      { emoji: '🤲', texto: 'Hands-free pump superpower: gentle breast compressions while pumping get noticeably more out (the hands-on method in the timer).' },
      { emoji: '💆', texto: 'Massage and warm compresses 2 minutes before: letdown comes sooner and more milk flows.' },
      { emoji: '👶', texto: 'Seeing, smelling or holding your baby (or her photo in the app 😉) while pumping releases oxytocin and helps letdown.' },
      { emoji: '💧', texto: 'Hydration and full meals: milk is ~90% water. Keep a glass next to you every session.' },
      { emoji: '🍼', texto: 'The "After nursing" timer method (10 min post-feed) sends the "make more" signal without shorting the baby.' },
      { emoji: '🧘', texto: 'Stress blocks oxytocin: drop the shoulders, breathe, and don\'t stare at the bottle.' },
      { emoji: '🔄', texto: 'If flow stops but you still feel milk, switch back to stimulation mode for 1 minute: it can trigger a second letdown.' },
    );
  }

  function tipsProduccion(s) {
    const tips = [];
    // día flojo: primero el ánimo, luego la técnica
    const sesionesHoy = s.exts.filter(m => fechaLocal(m.fecha) === fechaLocal()).length;
    if (s.promedio > 30 && sesionesHoy >= 2 && s.hoy < s.promedio * 0.7) {
      tips.push({ emoji: '💗', texto: I18N.lang === 'en' ? `Today is running below your average — and that's okay. Supply moves with sleep, stress and hormones, not effort. Hydrate, breathe before the next session, and take a 10-minute break if you can. Tomorrow is a new day. 🤍` : `Hoy va más bajito que tu promedio y está bien — la producción varía con el sueño, el estrés y las hormonas, no con cuánto te esfuerzas. Hidrátate, respira hondo antes de la siguiente sesión y, si puedes, tómate un respiro de 10 minutos. Mañana es otro día. 🤍` });
    }
    if (s.tendencia !== null && s.tendencia <= -10) {
      tips.push({ emoji: '⚡', texto: I18N.lang === 'en' ? `Supply dipped ~${Math.abs(s.tendencia)}% these days. Try Power pumping (or the express version) once a day for 3–7 days — it's in the timer above and guides the phases.` : `La producción bajó ~${Math.abs(s.tendencia)}% estos días. Prueba el Power pumping (o el exprés si no hay una hora) 1 vez al día durante 3–7 días — está en el timer de arriba y te guía con las fases.` });
    }
    if (s.sesionesPorDia && s.sesionesPorDia < 4) {
      tips.push({ emoji: '🔁', texto: I18N.lang === 'en' ? `You're at ~${s.sesionesPorDia} sessions a day. Supply answers frequency more than duration: getting to 6–8 short sessions a day "orders" more milk.` : `Van ~${s.sesionesPorDia} extracciones por día. La producción responde a la frecuencia más que a la duración: acercarse a 6–8 sesiones cortas al día "ordena" producir más.` });
    }
    if (!s.madrugada) {
      tips.push({ emoji: '🌙', texto: I18N.lang === 'en' ? 'One session between 2 and 5 a.m. rides the prolactin peak — the most supply-boosting hour there is (and you\'re up anyway… 😅).' : 'Una extracción entre 2 y 5 a.m. aprovecha el pico de prolactina — es la hora que más estimula la producción (y como andan despiertos en las vigilias… 😅).' });
    }
    if (s.durProm !== null && s.durProm < 12) {
      tips.push({ emoji: '⏱️', texto: I18N.lang === 'en' ? `Your sessions average ${s.durProm} min. Aim for 15–20 and keep going 2–5 min after the last drop: full emptying is the strongest signal.` : `Tus sesiones promedian ${s.durProm} min. Apunta a 15–20 min y sigue 2–5 min después de la última gota: el vaciado completo es la señal más fuerte para producir.` });
    }
    if (s.tendencia !== null && s.tendencia >= 10) {
      tips.push({ emoji: '📈', texto: I18N.lang === 'en' ? `Supply is climbing ~${s.tendencia}%! Whatever you're doing is working — keep the same schedule.` : `¡La producción va subiendo ~${s.tendencia}%! Lo que están haciendo funciona — mantengan la misma rutina de horarios.` });
    }
    // completar hasta 3 con tips generales, rotando por día
    const dia = Math.floor(Date.now() / 86400000);
    for (let i = 0; tips.length < 3 && i < TIPS_GENERALES.length; i++) {
      tips.push(TIPS_GENERALES[(dia + i) % TIPS_GENERALES.length]);
    }
    return tips.slice(0, 3);
  }

  function renderBanco() {
    const { refri, cong } = saldosBanco();
    const objetivo = objetivoBanco();
    const nivel = nivelBanco(refri, objetivo);
    const grupos = porDia(Store.data.banco, 'fecha');
    const s = statsExtraccion();
    const timers = Store.getTimers();
    const tips = tipsProduccion(s);

    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Banco de leche 🥛</h2>
      <div class="card" style="display:flex;gap:18px;align-items:center">
        ${tanqueHTML(refri, objetivo, true)}
        <div style="flex:1">
          <div style="font-size:30px;font-weight:800;letter-spacing:-.5px">${refri} ml</div>
          <div style="font-size:13px;color:var(--text-2);font-weight:600">listos para calentar y usar</div>
          <span class="nivel-chip" style="background:${nivel.color}">${nivel.texto}</span>
          <div style="font-size:12px;color:var(--text-2);margin-top:8px">
            ${I18N.lang === 'en' ? `Suggested goal: <b>${objetivo} ml</b> — about 2 days of her usual bottle intake.` : `Meta sugerida: <b>${objetivo} ml</b> — unos 2 días de lo que suele tomar en biberón.`}
          </div>
        </div>
      </div>
      <div class="banco-saldos">
        <div class="banco-saldo bg-blue"><div class="bs-ml">${refri} ml</div><div class="bs-label">🥛 En el refri</div></div>
        <div class="banco-saldo bg-lav"><div class="bs-ml">${cong} ml</div><div class="bs-label">🧊 Congelados</div></div>
      </div>
      ${timers.extraccion ? '<div class="empty-state" style="padding:12px">⏱️ Extracción en curso — usa la barra azul de arriba</div>' : `
      <button class="btn-primary btn-block" id="btn-elegir-metodo" style="margin-bottom:10px;padding:17px">⏱️ Iniciar extracción · elegir método</button>`}
      <div class="banco-acciones">
        <button data-mov="extraccion"><span>🥛</span>Agregar sin timer</button>
        <button data-mov="descongelar"><span>🧊</span>Descongelar</button>
        <button data-mov="congelar"><span>❄️</span>Congelar del refri</button>
        <button data-mov="descarte"><span>🗑️</span>Descartar</button>
      </div>
      <button class="btn-ghost btn-block" data-mov="ajuste">✏️ Corregir inventario (contar lo que hay)</button>

      <h2 class="section-title" style="margin-top:18px">Producción 📈</h2>
      <div class="prod-stats">
        <div class="prod-stat"><div class="ps-num">${s.hoy} ml</div><div class="ps-label">hoy</div></div>
        <div class="prod-stat"><div class="ps-num">${s.promedio} ml</div><div class="ps-label">promedio/día</div></div>
        <div class="prod-stat record"><div class="ps-num">🏆 ${s.recordDia}</div><div class="ps-label">récord día</div></div>
        <div class="prod-stat record"><div class="ps-num">🥇 ${s.recordSesion}</div><div class="ps-label">récord sesión</div></div>
      </div>
      ${s.fechas.length >= 2 ? '<div class="card"><canvas class="chart" id="chart-prod" height="170"></canvas></div>' : ''}

      <div class="tips-card">
        <h3>🤖 Entrenadora de producción</h3>
        <div class="tc-resumen">${s.exts.length ? (I18N.lang === 'en' ? `${s.sesionesPorDia} sessions/day · avg ${s.promedio} ml/day${s.durProm ? ` · ${s.durProm} min/session` : ''}${s.tendencia !== null ? ` · trend ${s.tendencia > 0 ? '+' : ''}${s.tendencia}%` : ''}` : `${s.sesionesPorDia} sesiones/día · promedio ${s.promedio} ml/día${s.durProm ? ` · ${s.durProm} min por sesión` : ''}${s.tendencia !== null ? ` · tendencia ${s.tendencia > 0 ? '+' : ''}${s.tendencia}%` : ''}`) : (I18N.lang === 'en' ? 'Log your first pumping sessions to get tailored coaching.' : 'Registra tus primeras extracciones para recibir consejos a tu medida.')}</div>
        ${tips.map(t => `<div class="tip-item"><span class="t-emoji">${t.emoji}</span><span>${t.texto}</span></div>`).join('')}
        <p class="disclaimer" style="margin-top:8px">Consejos generales de lactancia; una asesora certificada siempre es la mejor guía.</p>
      </div>
      <p class="disclaimer">La leche materna dura ~4 días en el refri y ~6 meses en el congelador. Usen primero la más antigua.</p>
      ${listaEntradas(grupos, m => {
        const info = NOMBRE_MOV[m.tipo] ? NOMBRE_MOV[m.tipo](m) : { emoji: '🥛', titulo: m.tipo };
        const delta = m.tipo === 'ajuste' ? (m.ml > 0 ? `+${m.ml}` : `${m.ml}`) :
          (m.tipo === 'consumo' || m.tipo === 'descarte') ? `−${m.ml}` : `${m.ml}`;
        return `
        <div class="entry">
          <span class="entry-emoji">${info.emoji}</span>
          <div class="entry-main">
            <div class="entry-title">${info.titulo} · ${delta} ml</div>
            ${m.duracionSeg || m.notas ? `<div class="entry-sub">${[
              m.duracionSeg && `⏱️ ${Math.max(1, Math.round(m.duracionSeg / 60))} min${m.modo && m.modo !== 'normal' ? ` · ${modoExt(m.modo).emoji} ${modoExt(m.modo).nombre}` : ''}`,
              m.notas && esc(m.notas),
            ].filter(Boolean).join(' · ')}</div>` : ''}
          </div>
          <span class="entry-time">${fmtHora(m.fecha)}</span>
          ${m.tomaId ? '<span style="font-size:11px;color:var(--text-2);padding:6px">desde la toma</span>' : `
          <div class="entry-actions"><button data-del="banco:${m.id}">🗑️</button></div>`}
        </div>`;
      }, { emoji: '🥛', texto: 'Registra una extracción para empezar su banco de leche' })}
    `;
    bindVolver();
    main.querySelectorAll('[data-mov]').forEach(b => b.onclick = () => hojaMovBanco(b.dataset.mov));
    const btnMetodo = $('#btn-elegir-metodo');
    if (btnMetodo) btnMetodo.onclick = hojaElegirMetodo;

    // gráfica: producción por día (últimos 10 días naturales)
    const cv = $('#chart-prod');
    if (cv) {
      const dias = [];
      for (let i = 9; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dias.push(fechaLocal(d));
      }
      new Chart(cv, {
        type: 'bar',
        data: {
          labels: dias.map(f => new Date(f + 'T12:00').toLocaleDateString(I18N.loc(), { day: 'numeric', month: 'short' })),
          datasets: [{
            label: 'ml extraídos por día',
            data: dias.map(f => s.porDia[f] || 0),
            backgroundColor: dias.map(f => (s.porDia[f] || 0) >= s.recordDia && s.recordDia > 0 ? '#f5b54a' : paletaCharts().pipi),
            borderRadius: 8,
          }],
        },
        options: { plugins: { legend: { display: false } } },
      });
    }
  }

  function hojaMovBanco(tipoMov) {
    const { refri, cong } = saldosBanco();
    const titulos = {
      extraccion: 'Agregar extracción 🥛', descongelar: 'Descongelar 🧊',
      congelar: 'Congelar del refri ❄️', descarte: 'Descartar leche 🗑️', ajuste: 'Corregir inventario ✏️',
    };

    if (tipoMov === 'ajuste') {
      abrirSheet(`
        <h2>${titulos.ajuste}</h2>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">Cuenten lo que hay físicamente y pongan los totales reales; la app ajusta la diferencia.</p>
        <div class="form-row">
          <div class="form-group"><label>En el refri (ml)</label>
            <input type="number" inputmode="numeric" id="aj-refri" value="${refri}">
          </div>
          <div class="form-group"><label>Congelados (ml)</label>
            <input type="number" inputmode="numeric" id="aj-cong" value="${cong}">
          </div>
        </div>
        <button class="btn-primary btn-block" id="f-guardar">Guardar corrección</button>
      `);
      $('#f-guardar').onclick = () => {
        const dRefri = (Number($('#aj-refri').value) || 0) - refri;
        const dCong = (Number($('#aj-cong').value) || 0) - cong;
        const ahora = new Date().toISOString();
        if (dRefri) Store.add('banco', { tipo: 'ajuste', lugar: 'refri', ml: dRefri, fecha: ahora, notas: 'Conteo físico' });
        if (dCong) Store.add('banco', { tipo: 'ajuste', lugar: 'congelador', ml: dCong, fecha: ahora, notas: 'Conteo físico' });
        cerrarSheet();
        toast(dRefri || dCong ? 'Inventario corregido ✏️' : 'Todo cuadraba ✅');
      };
      return;
    }

    const conLugar = tipoMov === 'extraccion' || tipoMov === 'descarte';
    abrirSheet(`
      <h2>${titulos[tipoMov]}</h2>
      ${tipoMov === 'descongelar' ? `<p style="font-size:13px;color:var(--text-2)">${I18N.lang === 'en' ? `Moves from the freezer (${cong} ml) to the fridge, ready to use in ~24 h.` : `Pasa del congelador (${cong} ml) al refri, lista para usar en ~24 h.`}</p>` : ''}
      ${tipoMov === 'congelar' ? `<p style="font-size:13px;color:var(--text-2)">${I18N.lang === 'en' ? `Moves from the fridge (${refri} ml) to the freezer for long-term storage.` : `Pasa del refri (${refri} ml) al congelador para reserva larga.`}</p>` : ''}
      <div class="ml-stepper">
        <button type="button" id="ml-menos">−</button>
        <div class="ml-value"><span id="ml-num">60</span> <small>ml</small></div>
        <button type="button" id="ml-mas">+</button>
      </div>
      <div class="ml-presets">
        ${[30, 60, 90, 120, 150].map(v => `<button type="button" data-ml="${v}">${v} ml</button>`).join('')}
      </div>
      ${conLugar ? `
      <div class="form-group"><label>${tipoMov === 'extraccion' ? '¿Dónde se guarda?' : '¿De dónde se descarta?'}</label>
        <div class="quien-chips" id="f-lugar">
          <button type="button" class="activo" data-lugar="refri">🥛 Refri</button>
          <button type="button" data-lugar="congelador">🧊 Congelador</button>
        </div>
      </div>` : ''}
      <div class="form-group"><label>Notas (opcional)</label>
        <input type="text" id="f-notas" placeholder="${tipoMov === 'descarte' ? 'Pasó de los 4 días…' : 'Extracción de la mañana…'}">
      </div>
      <button class="btn-primary btn-block" id="f-guardar">Guardar</button>
    `);

    let ml = 60, lugar = 'refri';
    const num = $('#ml-num');
    $('#ml-menos').onclick = () => { ml = Math.max(0, ml - 5); num.textContent = ml; };
    $('#ml-mas').onclick = () => { ml += 5; num.textContent = ml; };
    document.querySelectorAll('[data-ml]').forEach(b => b.onclick = () => { ml = Number(b.dataset.ml); num.textContent = ml; });
    if (conLugar) {
      $('#f-lugar').addEventListener('click', e => {
        const b = e.target.closest('[data-lugar]');
        if (!b) return;
        lugar = b.dataset.lugar;
        $('#f-lugar').querySelectorAll('button').forEach(x => x.classList.toggle('activo', x === b));
      });
    }
    $('#f-guardar').onclick = () => {
      if (!ml) { toast('Pon los mililitros'); return; }
      if (tipoMov === 'descongelar' && ml > cong) { toast(`Solo hay ${cong} ml congelados`); return; }
      if (tipoMov === 'congelar' && ml > refri) { toast(I18N.lang === 'en' ? `Only ${refri} ml in the fridge` : `Solo hay ${refri} ml en el refri`); return; }
      Store.add('banco', { tipo: tipoMov, lugar, ml, fecha: new Date().toISOString(), notas: $('#f-notas').value.trim() });
      cerrarSheet();
      toast('Movimiento guardado 🥛');
    };
  }

  /* ---------- análisis general ---------- */
  function renderAnalisis() {
    const r = Analisis.generar(Store.data, edadDias());
    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Análisis general 🤖</h2>
      <div class="analisis-estado" style="background:${r.estado.color}">
        <span class="ae-emoji">${r.estado.emoji}</span>
        <div>
          <div class="ae-titulo">${r.estado.titulo}</div>
          <div class="ae-sub">${r.estado.sub}</div>
        </div>
      </div>
      ${r.confianza === 'limitada' ? `<p style="font-size:12.5px;color:var(--text-2);margin:-6px 4px 12px">ℹ️ Hay pocos registros en las últimas 24 h, así que el análisis es parcial — entre más registren, más fino se pone.</p>` : ''}
      ${r.hallazgos.map(x => `
        <div class="hallazgo nivel-${x.nivel}">
          <span class="h-emoji">${x.emoji}</span>
          <div><b>${esc(x.titulo)}</b>${esc(x.texto)}
          ${x.dato ? `<div class="h-dato">📎 ${esc(x.dato)}</div>` : ''}</div>
        </div>`).join('') || '<div class="empty-state"><span class="big">🤖</span>Registra tomas y pañales para que pueda analizar cómo va.</div>'}
      ${(() => {
        const com = Analisis.comunes(edadDias());
        if (!com.length) return '';
        return `<h2 class="section-title" style="margin-top:20px">En esta etapa es común 🗓️</h2>` + com.map(e => `
          <div class="hallazgo nivel-info">
            <span class="h-emoji">${e.emoji}</span>
            <div><b>${esc(e.titulo)}</b>${esc(e.texto)}
              ${e.alivio ? `<ul class="h-lista">${e.alivio.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
              ${e.compra ? `<div class="h-dato">🛍️ ${esc(e.compra)}</div>` : ''}
            </div>
          </div>`).join('');
      })()}
      <p class="disclaimer">Análisis hecho aquí en el teléfono con sus propios registros y guías generales de pediatría. Orienta, pero nunca sustituye a su pediatra.</p>
    `;
    bindVolver();
  }

  /* pop-up una sola vez cuando el bebé entra a una etapa nueva */
  function avisoEtapaNueva() {
    const dias = edadDias();
    if (dias === null || !$('#sheet').classList.contains('hidden')) return;
    const clave = `maya.avisos-etapa.${Store.bebeActivo}`;
    let vistos = [];
    try { vistos = JSON.parse(localStorage.getItem(clave)) || []; } catch {}
    const pend = Analisis.comunes(dias).filter(e => !vistos.includes(e.key));
    if (!pend.length) return;
    const e = pend[pend.length - 1]; // la etapa más reciente primero
    abrirSheet(`
      <div style="text-align:center;font-size:52px;margin:4px 0 8px">${e.emoji}</div>
      <h2 style="text-align:center">${esc(e.titulo)}</h2>
      <p style="font-size:14.5px;line-height:1.5;color:var(--text-2);margin-bottom:12px">${esc(e.texto)}</p>
      ${e.alivio ? `<div class="care-box"><h4>💡 Para reducir las molestias</h4><ul>${e.alivio.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${e.compra ? `<div class="info-box" style="margin-top:10px"><h4>🛍️ Consejo de compras</h4>${esc(e.compra)}</div>` : ''}
      <p class="disclaimer">${I18N.lang === 'en' ? `Heads-up for her age (${Math.floor(dias / 7)} weeks). General guidance — her pediatrician always has the final say.` : `Aviso por su edad (${Math.floor(dias / 7)} semanas). Guía general — su pediatra siempre manda.`}</p>
      <button class="btn-primary btn-block" id="etapa-ok" style="margin-top:10px">Entendido 💗</button>
    `);
    $('#etapa-ok').onclick = () => {
      vistos.push(e.key);
      localStorage.setItem(clave, JSON.stringify(vistos));
      cerrarSheet();
    };
  }

  /* ============================================================
     MÁS (menú y subvistas)
  ============================================================ */
  function renderMas() {
    if (vistaMas === 'banco') return renderBanco();
    if (vistaMas === 'analisis') return renderAnalisis();
    if (vistaMas === 'citas') return renderCitas();
    if (vistaMas === 'salud') return renderSalud();
    if (vistaMas === 'intervenciones') return renderIntervenciones();
    if (vistaMas === 'medicamentos') return renderMedicamentos();
    if (vistaMas === 'crecimiento') return renderCrecimiento();
    if (vistaMas === 'fotos') return renderFotos();
    if (vistaMas === 'resumen') return renderResumen();
    if (vistaMas === 'ajustes') return renderAjustes();

    const d = Store.data;
    const item = (vista, emoji, bg, titulo, sub) => `
      <button class="menu-item" data-vista="${vista}">
        <span class="mi-emoji ${bg}">${emoji}</span>
        <span>${titulo}<span class="mi-sub">${sub}</span></span>
        <span class="mi-chev">›</span>
      </button>`;
    main.innerHTML = `
      <h2 class="section-title">Más</h2>
      <div class="menu-list">
        ${item('analisis', '🤖', 'bg-mint', 'Análisis general', 'Cómo va y qué observar, según sus datos')}
        ${(() => { const r = EPDS.resultados(); return `
        <button class="menu-item" data-accion="epds">
          <span class="mi-emoji bg-mint">💚</span>
          <span>Bienestar de mamá<span class="mi-sub">${r.length ? `Último chequeo: ${new Date(r[r.length - 1].fecha).toLocaleDateString(I18N.loc(), { day: 'numeric', month: 'short' })}` : 'Un chequeo para ti, no solo para la bebé'}</span></span>
          <span class="mi-chev">›</span>
        </button>`; })()}
        ${item('banco', '🥛', 'bg-blue', 'Banco de leche', (() => { const s = saldosBanco(); return `${s.refri} ml listos · ${s.cong} ml congelados`; })())}
        ${item('salud', '🩺', 'bg-pink', 'Condiciones médicas', d.condiciones.length ? d.condiciones.map(c => c.nombre).join(', ') : 'Ictericia, seguimiento de labs…')}
        ${item('citas', '📅', 'bg-peach', 'Citas médicas', (() => { const p = Store.data.citas.filter(c => !c.hecha && new Date(c.fecha) >= Date.now() - 3600000).sort((a, b) => a.fecha.localeCompare(b.fecha))[0]; return p ? `Próxima: ${new Date(p.fecha).toLocaleDateString(I18N.loc(), { day: 'numeric', month: 'short' })} · ${esc(p.titulo)}` : 'Consultas, vacunas y laboratorios'; })())}
        ${item('intervenciones', '💉', 'bg-peach', 'Intervenciones', d.intervenciones.length ? `${d.intervenciones.length} registradas` : 'Toma de sangre, vacunas, estudios…')}
        ${item('medicamentos', '💊', 'bg-mint', 'Medicamentos', d.medicamentos.filter(m => m.activo).length ? `${d.medicamentos.filter(m => m.activo).length} activos` : 'Tratamientos y vitaminas')}
        ${item('crecimiento', '📏', 'bg-blue', 'Crecimiento', d.crecimiento.length ? 'Peso, talla y perímetro' : 'Registra peso y talla')}
        ${item('fotos', '📸', 'bg-lav', 'Fotos', d.fotos.length ? `${d.fotos.length} recuerdos` : 'Momentos especiales')}
        ${item('resumen', '📄', 'bg-yellow', 'Resumen PDF', 'Descarga un reporte con gráficas')}
        ${(() => { const t = TEMAS.find(x => x.id === (localStorage.getItem(LS_TEMA) || '')) || TEMAS[0]; return `
        <button class="menu-item" data-accion="cambiar-tema">
          <span class="mi-emoji bg-lav">🎨</span>
          <span>Tema de color<span class="mi-sub">Actual: ${t.emoji} ${t.nombre}</span></span>
          <span class="mi-chev">›</span>
        </button>`; })()}
        ${item('ajustes', '⚙️', 'bg-pink', 'Ajustes', 'Sincronización, respaldo y sesión')}
      </div>
    `;
    main.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => { vistaMas = b.dataset.vista; render(); });
  }

  const volverMas = `<div class="back-row"><button data-volver="1">‹ Más</button></div>`;
  function bindVolver() {
    const b = main.querySelector('[data-volver]');
    if (b) b.onclick = () => { vistaMas = null; render(); };
  }

  /* ---------- Condiciones médicas ---------- */
  function renderSalud() {
    const conds = Store.data.condiciones.filter(c => !c.curada);
    const curadas = Store.data.condiciones.filter(c => c.curada);
    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Condiciones médicas 🩺</h2>
      <button class="btn-primary btn-block" id="btn-nueva-cond">＋ Agregar condición</button>
      <div id="conds" style="margin-top:14px">
        ${conds.length ? '' : '<div class="empty-state"><span class="big">🩺</span>Registra una condición (por ejemplo, ictericia) y la app buscará información y cuidados sugeridos.</div>'}
      </div>
      ${curadas.length ? `<details><summary class="day-label" style="cursor:pointer">Superadas 🎉 (${curadas.length})</summary>
        <div class="entry-list" style="margin-top:6px">${curadas.map(c => `
          <div class="entry">
            <span class="entry-emoji">🎉</span>
            <div class="entry-main">
              <div class="entry-title">${esc(c.nombre)}</div>
              <div class="entry-sub">${I18N.lang === 'en' ? 'Resolved on' : 'Superada el'} ${new Date(c.curada).toLocaleDateString(I18N.loc(), { dateStyle: 'long' })}</div>
            </div>
            <button class="btn-ghost" data-reabrir="${c.id}">Reabrir</button>
          </div>`).join('')}</div></details>` : ''}
    `;
    bindVolver();
    $('#btn-nueva-cond').onclick = hojaNuevaCondicion;

    const cont = $('#conds');
    for (const c of conds) {
      const div = document.createElement('div');
      div.className = 'card condition-card';
      const meds = [...(c.mediciones || [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
      div.innerHTML = `
        <div class="card-row">
          <h2 style="margin:0">${esc(c.nombre)}</h2>
          <div>
            <button class="btn-ghost" data-medir="${c.id}">＋ Medición</button>
            <button class="btn-ghost" data-curada="${c.id}" style="color:#2ea06d">✅</button>
            <button class="btn-ghost" data-borrar-cond="${c.id}" style="color:var(--danger)">🗑️</button>
          </div>
        </div>
        ${meds.length >= 2 && meds.filter(m => m.valor !== null && m.valor !== '').length >= 2 ? `<canvas class="chart" id="chart-${c.id}" height="170"></canvas>` : ''}
        ${meds.map(m => `
          <div class="measure-row">
            <span>${new Date(m.fecha).toLocaleString(I18N.loc(), { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${m.nota ? ` · <small>${esc(m.nota)}</small>` : ''}</span>
            <span>
              ${(m.valor === null || m.valor === '') ? '<span class="measure-pending">⏳ pendiente</span>' : `<span class="measure-val">${m.valor}${c.unidad ? ` ${esc(c.unidad)}` : ''}</span>`}
              <button class="btn-ghost" data-edit-med="${c.id}:${m.id}" style="padding:2px 4px">✏️</button>
            </span>
          </div>`).join('') || '<p style="color:var(--text-2);font-size:14px">Sin mediciones todavía.</p>'}
        ${c.info && c.info.resumen ? `
          <div class="info-box">
            <h4>📖 Información</h4>
            ${esc(c.info.resumen)}
            ${c.info.extraWiki ? `<br><br>${esc(c.info.extraWiki)}` : ''}
            ${(c.info.enlaces || []).map(l => `<br>🔗 <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.texto)}</a>`).join('')}
          </div>` : ''}
        ${c.info && c.info.cuidados ? `
          <div class="care-box">
            <h4>💚 Cuidados sugeridos</h4>
            <ul>${c.info.cuidados.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>` : ''}
        <p class="disclaimer">Esta información es orientativa y no sustituye la valoración de su pediatra.</p>
      `;
      cont.appendChild(div);

      const cv = div.querySelector(`#chart-${c.id}`);
      if (cv) {
        const datos = meds.filter(m => m.valor !== null && m.valor !== '').reverse();
        new Chart(cv, {
          type: 'line',
          data: {
            labels: datos.map(m => new Date(m.fecha).toLocaleString(I18N.loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
            datasets: [{
              label: `${c.nombre}${c.unidad ? ` (${c.unidad})` : ''}`,
              data: datos.map(m => Number(m.valor)),
              borderColor: paletaCharts().linea, backgroundColor: paletaCharts().linea + '22',
              fill: true, tension: .35, pointRadius: 4,
            }],
          },
          options: { plugins: { legend: { display: false } } },
        });
      }
    }

    cont.querySelectorAll('[data-medir]').forEach(b => b.onclick = () => hojaMedicion(b.dataset.medir));
    cont.querySelectorAll('[data-edit-med]').forEach(b => b.onclick = () => {
      const [cid, mid] = b.dataset.editMed.split(':');
      hojaMedicion(cid, mid);
    });
    cont.querySelectorAll('[data-curada]').forEach(b => b.onclick = () => {
      const c = Store.data.condiciones.find(x => x.id === b.dataset.curada);
      if (!c || !confirm(I18N.lang === 'en' ? `Mark "${c.nombre}" as resolved? It will stop appearing in the health check and goals.` : `¿Marcar "${c.nombre}" como superada? Dejará de aparecer en el análisis y los retos.`)) return;
      Store.update('condiciones', c.id, { curada: new Date().toISOString() });
      confeti(100);
      celebracion('🎉', I18N.lang === 'en' ? `${c.nombre} resolved!` : `¡${c.nombre} superada!`, I18N.lang === 'en' ? `${nb()} did it 💪` : `${nb()} lo logró 💪`);
    });
    main.querySelectorAll('[data-reabrir]').forEach(b => b.onclick = () => {
      Store.update('condiciones', b.dataset.reabrir, { curada: null });
      toast('Condición reabierta');
    });
    cont.querySelectorAll('[data-borrar-cond]').forEach(b => b.onclick = () => {
      if (confirm(I18N.t('¿Borrar esta condición y todas sus mediciones?'))) {
        Store.remove('condiciones', b.dataset.borrarCond);
        toast('Condición borrada');
      }
    });
  }

  function hojaNuevaCondicion() {
    abrirSheet(`
      <h2>Nueva condición 🩺</h2>
      <div class="form-group"><label>Nombre de la condición</label>
        <input type="text" id="f-nombre" placeholder="Ictericia, reflujo, cólicos…">
      </div>
      <div class="form-group"><label>Unidad de medición (opcional)</label>
        <input type="text" id="f-unidad" placeholder="mg/dL, °C…">
      </div>
      <button class="btn-primary btn-block" id="f-guardar">Agregar y buscar información ✨</button>
      <p class="disclaimer">Al guardarla, la app buscará un resumen y cuidados sugeridos automáticamente.</p>
    `);
    $('#f-guardar').onclick = async () => {
      const nombre = $('#f-nombre').value.trim();
      if (!nombre) { toast('Escribe el nombre'); return; }
      $('#f-guardar').textContent = 'Buscando información… 🔎';
      $('#f-guardar').disabled = true;
      const info = await InfoMedica.investigar(nombre);
      Store.add('condiciones', {
        nombre, unidad: $('#f-unidad').value.trim(),
        mediciones: [], info,
      });
      cerrarSheet();
      toast(info.resumen ? 'Condición agregada con información ✨' : 'Condición agregada');
    };
  }

  function hojaMedicion(condId, medId) {
    const c = Store.data.condiciones.find(x => x.id === condId);
    if (!c) return;
    const m = medId ? c.mediciones.find(x => x.id === medId) : null;
    abrirSheet(`
      <h2>${I18N.lang === 'en' ? (m ? 'Edit' : 'New') + ' reading' : (m ? 'Editar' : 'Nueva') + ' medición'} · ${esc(c.nombre)}</h2>
      <div class="form-group"><label>${I18N.lang === 'en' ? 'Value' : 'Valor'} ${c.unidad ? `(${esc(c.unidad)})` : ''} — ${I18N.lang === 'en' ? 'leave empty if the result is still pending' : 'déjalo vacío si aún esperan el resultado'}</label>
        <input type="number" step="any" id="f-valor" inputmode="decimal" value="${m && m.valor !== null ? m.valor : ''}" placeholder="Ej. 12">
      </div>
      <div class="form-group"><label>Fecha y hora</label>
        <input type="datetime-local" id="f-fecha" value="${aInputLocal(m ? m.fecha : null)}">
      </div>
      <div class="form-group"><label>Nota (opcional)</label>
        <input type="text" id="f-nota" value="${esc(m ? m.nota : '')}" placeholder="Lab del hospital, esperando resultado…">
      </div>
      <button class="btn-primary btn-block" id="f-guardar">Guardar</button>
      ${m ? '<button class="btn-danger btn-block" id="f-borrar" style="margin-top:8px">Borrar medición</button>' : ''}
    `);
    $('#f-guardar').onclick = () => {
      const v = $('#f-valor').value;
      const nueva = {
        id: m ? m.id : Store.uid(),
        valor: v === '' ? null : Number(v),
        fecha: deInputLocal($('#f-fecha').value),
        nota: $('#f-nota').value.trim(),
      };
      const meds = c.mediciones.filter(x => x.id !== nueva.id);
      meds.push(nueva);
      Store.update('condiciones', c.id, { mediciones: meds });
      cerrarSheet();
      toast(nueva.valor === null ? 'Guardado como pendiente ⏳' : 'Medición guardada');
    };
    const del = $('#f-borrar');
    if (del) del.onclick = () => {
      Store.update('condiciones', c.id, { mediciones: c.mediciones.filter(x => x.id !== m.id) });
      cerrarSheet();
      toast('Medición borrada');
    };
  }

  /* ---------- Intervenciones ---------- */
  function renderIntervenciones() {
    const grupos = porDia(Store.data.intervenciones, 'fecha');
    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Intervenciones 💉</h2>
      <button class="btn-primary btn-block" id="btn-nueva-int">＋ Registrar intervención</button>
      <div style="margin-top:10px">
      ${listaEntradas(grupos, i => `
        <div class="entry">
          <span class="entry-emoji">${({ 'Toma de sangre': '🩸', 'Vacuna': '💉', 'Estudio': '🔬', 'Consulta': '🩺' })[i.categoria] || '📋'}</span>
          <div class="entry-main">
            <div class="entry-title">${esc(i.titulo)}</div>
            <div class="entry-sub">${[i.categoria, i.notas].filter(Boolean).map(esc).join(' · ')}</div>
          </div>
          <span class="entry-time">${fmtHora(i.fecha)}</span>
          ${btnsEntrada('intervenciones', i.id)}
        </div>
      `, { emoji: '💉', texto: 'Registra procedimientos: toma de sangre, vacunas, estudios…' })}
      </div>
    `;
    bindVolver();
    $('#btn-nueva-int').onclick = () => hojaIntervencion();
  }

  function hojaIntervencion(existente) {
    abrirSheet(`
      <h2>${I18N.lang === 'en' ? (existente ? 'Edit' : 'New') + ' procedure 💉' : (existente ? 'Editar' : 'Nueva') + ' intervención 💉'}</h2>
      <div class="form-group"><label>¿Qué le hicieron?</label>
        <input type="text" id="f-titulo" value="${esc(existente ? existente.titulo : '')}" placeholder="Le sacaron sangre para bilirrubina">
      </div>
      <div class="form-group"><label>Categoría</label>
        <select id="f-cat">
          ${['Toma de sangre', 'Vacuna', 'Estudio', 'Consulta', 'Otro'].map(c =>
            `<option ${existente && existente.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Fecha y hora</label>
        <input type="datetime-local" id="f-fecha" value="${aInputLocal(existente ? existente.fecha : null)}">
      </div>
      <div class="form-group"><label>Notas (opcional)</label>
        <textarea id="f-notas" rows="2" placeholder="Dónde, quién, cómo reaccionó…">${esc(existente ? existente.notas : '')}</textarea>
      </div>
      <button class="btn-primary btn-block" id="f-guardar">Guardar</button>
    `);
    $('#f-guardar').onclick = () => {
      const reg = {
        titulo: $('#f-titulo').value.trim(),
        categoria: $('#f-cat').value,
        fecha: deInputLocal($('#f-fecha').value),
        notas: $('#f-notas').value.trim(),
      };
      if (!reg.titulo) { toast('Escribe qué le hicieron'); return; }
      if (existente) Store.update('intervenciones', existente.id, reg);
      else Store.add('intervenciones', reg);
      cerrarSheet();
      toast('Intervención guardada');
    };
  }

  /* ---------- Medicamentos ---------- */
  function renderMedicamentos() {
    const meds = [...Store.data.medicamentos].sort((a, b) => (b.activo - a.activo) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Medicamentos 💊</h2>
      ${(() => {
        const activos = Store.data.medicamentos.filter(m => m.activo);
        if (!activos.length) return '';
        const hoy = fechaLocal();
        return `<div class="card" style="border-left:5px solid #4cc38a"><h2>Dosis de hoy</h2>` + activos.map(m => {
          const hecha = Store.data.actividades.some(a => a.fecha === hoy && a.tarea === `med-${m.id}` && a.hecha);
          return `
          <div class="rutina-paso ${hecha ? 'hecho' : ''}">
            <span class="rp-emoji">💊</span>
            <span class="rp-titulo">${esc(m.nombre)}${m.dosis ? ` · ${esc(m.dosis)}` : ''}</span>
            <button class="entry-actions" data-ics-med="${m.id}" title="Recordatorio diario" style="background:none;border:none;font-size:16px;cursor:pointer;opacity:.6">🔔</button>
            <button class="rutina-check ${hecha ? 'lista' : ''}" data-med-check="${m.id}">✓</button>
          </div>`;
        }).join('') + `</div>`;
      })()}
      <button class="btn-primary btn-block" id="btn-nuevo-med">＋ Agregar medicamento</button>
      <div class="entry-list" style="margin-top:14px">
        ${meds.map(m => `
          <div class="entry" style="${m.activo ? '' : 'opacity:.55'}">
            <span class="entry-emoji">💊</span>
            <div class="entry-main">
              <div class="entry-title">${esc(m.nombre)} ${m.activo ? '' : '· terminado'}</div>
              <div class="entry-sub">${[m.dosis, m.frecuencia, m.notas].filter(Boolean).map(esc).join(' · ') || '—'}</div>
            </div>
            ${btnsEntrada('medicamentos', m.id)}
          </div>`).join('') || `<div class="empty-state"><span class="big">💊</span>${I18N.lang === 'en' ? `${nb()}'s vitamins, treatments and medications` : `Vitaminas, tratamientos y medicamentos de ${nb()}`}</div>`}
      </div>
    `;
    bindVolver();
    $('#btn-nuevo-med').onclick = () => hojaMedicamento();
    main.querySelectorAll('[data-med-check]').forEach(b => b.onclick = () => {
      const m = Store.data.medicamentos.find(x => x.id === b.dataset.medCheck);
      if (!m) return;
      const hoy = fechaLocal();
      const hecha = Store.data.actividades.some(a => a.fecha === hoy && a.tarea === `med-${m.id}` && a.hecha);
      Store.marcarActividad(hoy, `med-${m.id}`, `Dosis: ${m.nombre}`, !hecha);
      if (!hecha) { confeti(30); toast(`💊 ${m.nombre} ✓`); }
    });
    main.querySelectorAll('[data-ics-med]').forEach(b => b.onclick = () => {
      const m = Store.data.medicamentos.find(x => x.id === b.dataset.icsMed);
      if (!m) return;
      const hora = prompt(I18N.lang === 'en' ? 'What time do you want the daily reminder? (HH:MM)' : '¿A qué hora quieres el recordatorio diario? (HH:MM)', '09:00');
      if (!hora || !/^\d{1,2}:\d{2}$/.test(hora.trim())) return;
      descargarICS(`medicamento-${m.nombre.slice(0, 20)}`, icsMedicamento(m, hora.trim()));
    });
  }

  function hojaMedicamento(existente) {
    abrirSheet(`
      <h2>${existente ? 'Editar' : 'Nuevo'} medicamento 💊</h2>
      <div class="form-group"><label>Nombre</label>
        <input type="text" id="f-nombre" value="${esc(existente ? existente.nombre : '')}" placeholder="Vitamina D">
      </div>
      <div class="form-row">
        <div class="form-group"><label>Dosis</label>
          <input type="text" id="f-dosis" value="${esc(existente ? existente.dosis : '')}" placeholder="2 gotas">
        </div>
        <div class="form-group"><label>Frecuencia</label>
          <input type="text" id="f-frec" value="${esc(existente ? existente.frecuencia : '')}" placeholder="1 vez al día">
        </div>
      </div>
      <div class="form-group"><label>Notas (opcional)</label>
        <input type="text" id="f-notas" value="${esc(existente ? existente.notas : '')}" placeholder="Con la primera toma de la mañana">
      </div>
      <label class="checkbox-row"><input type="checkbox" id="f-activo" ${!existente || existente.activo ? 'checked' : ''}> Tratamiento activo</label>
      <button class="btn-primary btn-block" id="f-guardar">Guardar</button>
    `);
    $('#f-guardar').onclick = () => {
      const reg = {
        nombre: $('#f-nombre').value.trim(),
        dosis: $('#f-dosis').value.trim(),
        frecuencia: $('#f-frec').value.trim(),
        notas: $('#f-notas').value.trim(),
        activo: $('#f-activo').checked,
        inicio: existente ? existente.inicio : new Date().toISOString(),
      };
      if (!reg.nombre) { toast('Escribe el nombre'); return; }
      if (existente) Store.update('medicamentos', existente.id, reg);
      else Store.add('medicamentos', reg);
      cerrarSheet();
      toast('Medicamento guardado');
    };
  }

  /* ---------- Crecimiento ---------- */
  function renderCrecimiento() {
    const cre = [...Store.data.crecimiento].sort((a, b) => b.fecha.localeCompare(a.fecha));
    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Crecimiento 📏</h2>
      <button class="btn-primary btn-block" id="btn-nuevo-cre">＋ Registrar medidas</button>
      ${cre.length >= 2 ? '<div class="card" style="margin-top:14px"><canvas class="chart" id="chart-cre" height="180"></canvas></div>' : ''}
      <div class="entry-list" style="margin-top:14px">
        ${cre.map(c => `
          <div class="entry">
            <span class="entry-emoji">📏</span>
            <div class="entry-main">
              <div class="entry-title">${[c.pesoKg ? `${c.pesoKg} kg` : '', c.tallaCm ? `${c.tallaCm} cm` : '', c.perimetroCm ? `PC ${c.perimetroCm} cm` : ''].filter(Boolean).join(' · ')}</div>
              <div class="entry-sub">${new Date(c.fecha).toLocaleDateString(I18N.loc(), { dateStyle: 'long' })}</div>
            </div>
            ${btnsEntrada('crecimiento', c.id)}
          </div>`).join('') || '<div class="empty-state"><span class="big">📏</span>Registra el peso y talla de cada consulta</div>'}
      </div>
    `;
    bindVolver();
    $('#btn-nuevo-cre').onclick = () => hojaCrecimiento();
    const cv = $('#chart-cre');
    if (cv) {
      const datos = [...cre].reverse();
      new Chart(cv, {
        type: 'line',
        data: {
          labels: datos.map(c => new Date(c.fecha).toLocaleDateString(I18N.loc(), { day: 'numeric', month: 'short' })),
          datasets: [{
            label: 'Peso (kg)', data: datos.map(c => c.pesoKg || null),
            borderColor: '#4cc38a', backgroundColor: '#4cc38a22', fill: true, tension: .35,
          }],
        },
      });
    }
  }

  function hojaCrecimiento(existente) {
    abrirSheet(`
      <h2>${existente ? 'Editar' : 'Nuevas'} medidas 📏</h2>
      <div class="form-group"><label>Fecha</label>
        <input type="date" id="f-fecha" value="${(existente ? existente.fecha : new Date().toISOString()).slice(0, 10)}">
      </div>
      <div class="form-row">
        <div class="form-group"><label>Peso (kg)</label>
          <input type="number" step="0.01" inputmode="decimal" id="f-peso" value="${existente && existente.pesoKg ? existente.pesoKg : ''}" placeholder="3.20">
        </div>
        <div class="form-group"><label>Talla (cm)</label>
          <input type="number" step="0.1" inputmode="decimal" id="f-talla" value="${existente && existente.tallaCm ? existente.tallaCm : ''}" placeholder="50">
        </div>
      </div>
      <div class="form-group"><label>Perímetro cefálico (cm, opcional)</label>
        <input type="number" step="0.1" inputmode="decimal" id="f-pc" value="${existente && existente.perimetroCm ? existente.perimetroCm : ''}" placeholder="34">
      </div>
      <button class="btn-primary btn-block" id="f-guardar">Guardar</button>
    `);
    $('#f-guardar').onclick = () => {
      const reg = {
        fecha: $('#f-fecha').value + 'T12:00:00.000Z',
        pesoKg: Number($('#f-peso').value) || null,
        tallaCm: Number($('#f-talla').value) || null,
        perimetroCm: Number($('#f-pc').value) || null,
      };
      if (existente) Store.update('crecimiento', existente.id, reg);
      else Store.add('crecimiento', reg);
      cerrarSheet();
      toast('Medidas guardadas 📏');
    };
  }

  /* ---------- Fotos ---------- */
  function renderFotos() {
    // las fotos de pañal viven en su registro, no en la galería de recuerdos
    const fotos = Store.data.fotos.filter(f => f.categoria !== 'panal').sort((a, b) => b.fecha.localeCompare(a.fecha));
    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Fotos 📸</h2>
      <input type="file" id="foto-input" accept="image/*" capture="environment" style="display:none">
      <input type="file" id="foto-galeria" accept="image/*" style="display:none">
      <div class="form-row">
        <button class="btn-primary" style="flex:1" id="btn-camara">📷 Tomar foto</button>
        <button class="btn-secondary" style="flex:1" id="btn-galeria">🖼️ Subir foto</button>
      </div>
      <div class="photo-grid" style="margin-top:14px" id="grid-fotos">
        ${fotos.map(f => `<img class="foto-cargando" data-foto="${f.id}" alt="${esc(f.titulo || (I18N.lang === 'en' ? 'Baby photo' : 'Foto del bebé'))}" decoding="async">`).join('') ||
          `<div class="empty-state" style="grid-column:1/-1"><span class="big">📸</span>${I18N.t('Guarda fotos de momentos especiales o de cosas que quieras enseñarle al pediatra')}</div>`}
      </div>
    `;
    bindVolver();
    $('#btn-camara').onclick = () => $('#foto-input').click();
    $('#btn-galeria').onclick = () => $('#foto-galeria').click();
    $('#foto-input').onchange = e => procesarFoto(e.target.files[0]);
    $('#foto-galeria').onchange = e => procesarFoto(e.target.files[0]);
    // clic en cualquier miniatura → abre el visor (delegación: sobrevive re-render)
    const grid = $('#grid-fotos');
    if (grid) grid.onclick = e => { const im = e.target.closest('[data-foto]'); if (!im) return; const f = fotos.find(x => x.id === im.dataset.foto); if (f) verFoto(f); };

    fotos.forEach(async f => {
      // primero lo que ya tengamos en memoria (demo/caché) para pintar al instante
      let src = f.dataUrl;
      const pintar = () => {
        // re-consulta el <img> DESPUÉS del await: si un re-render lo reemplazó,
        // agarra el nodo vigente en vez de uno huérfano
        const img = main.querySelector(`[data-foto="${f.id}"]`);
        if (img && src) { img.src = src; img.classList.remove('foto-cargando'); }
      };
      if (src) { pintar(); return; }
      src = await Store.fetchPhoto(f);
      pintar();
    });
  }

  // lee y reduce una foto a un dataURL listo para guardar/sincronizar
  function leerFoto(file) {
    return new Promise((res, rej) => {
      if (!file) return rej(new Error('sin archivo'));
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1280;
          const escala = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * escala);
          canvas.height = Math.round(img.height * escala);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          res(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = rej;
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function procesarFoto(file, semana) {
    if (!file) return;
    const dataUrl = await leerFoto(file).catch(() => null);
    if (!dataUrl) { toast('No se pudo leer la foto'); return; }
    const titulo = semana != null ? `${I18N.lang === 'en' ? 'Week' : 'Semana'} ${semana} 💗` : (prompt(I18N.lang === 'en' ? 'Photo title (optional):' : 'Título de la foto (opcional):') || '');
    const id = Store.uid();
    Store.add('fotos', {
      id, fecha: new Date().toISOString(), titulo,
      archivo: `${new Date().toISOString().slice(0, 10)}-${id}.jpg`,
      dataUrl, sincronizada: false,
      ...(semana != null ? { semana } : {}),
    });
    if (semana != null) {
      confeti(80);
      celebracion('📸', I18N.lang === 'en' ? `Week ${semana} photo!` : `¡Foto de la semana ${semana}!`, I18N.lang === 'en' ? 'Their memory collection keeps growing' : 'Su colección de recuerdos va creciendo');
    } else {
      toast('Foto guardada 📸');
    }
  }

  // recorta al centro en cuadrado de 256 px para foto de perfil
  function recortarAvatar(dataUrl) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const lado = Math.min(img.width, img.height);
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => res(null);
      img.src = dataUrl;
    });
  }

  function elegirFotoPerfil(alTerminar) {
    abrirSheet(`
      <h2>📷 Foto de perfil del bebé</h2>
      <div class="form-row">
        <button class="btn-primary" style="flex:1" id="fp-camara">📷 Tomar foto</button>
        <button class="btn-secondary" style="flex:1" id="fp-carrete">🖼️ Del carrete</button>
      </div>
    `);
    const lanzar = conCamara => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      if (conCamara) input.capture = 'environment';
      input.onchange = async e => {
        cerrarSheet();
        const crudo = await leerFoto(e.target.files[0]).catch(() => null);
        if (!crudo) { toast('No se pudo leer la foto'); return; }
        const avatar = await recortarAvatar(crudo);
        if (avatar) alTerminar(avatar);
      };
      input.click();
    };
    $('#fp-camara').onclick = () => lanzar(true);
    $('#fp-carrete').onclick = () => lanzar(false);
  }

  function pedirFotoSemanal(semana) {
    abrirSheet(`
      <h2>${I18N.lang === 'en' ? `Photo of week ${semana} 📸` : `Foto de la semana ${semana} 📸`}</h2>
      <p style="font-size:14px;color:var(--text-2);margin-bottom:14px">
        ${semana === 0 ? 'Su primera semana de vida 💗' : `${semana * 7} días de vida cumplidos`}
        — pueden tomarla ahora o elegir una que ya tengan.
      </p>
      <div class="form-row">
        <button class="btn-primary" style="flex:1" id="fs-camara">📷 Tomar foto</button>
        <button class="btn-secondary" style="flex:1" id="fs-carrete">🖼️ Del carrete</button>
      </div>
    `);
    const lanzar = conCamara => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (conCamara) input.capture = 'environment';
      input.onchange = e => { cerrarSheet(); procesarFoto(e.target.files[0], semana); };
      input.click();
    };
    $('#fs-camara').onclick = () => lanzar(true);
    $('#fs-carrete').onclick = () => lanzar(false);
  }

  function verFoto(f) {
    const div = document.createElement('div');
    div.className = 'photo-viewer';
    div.innerHTML = `
      <img src="${f.dataUrl || ''}">
      <div class="pv-caption">${esc(f.titulo || '')}<br><small>${new Date(f.fecha).toLocaleString(I18N.loc())}</small></div>
      <div class="pv-actions">
        <button class="btn-danger" id="pv-del">${I18N.lang === 'en' ? 'Delete' : 'Borrar'}</button>
        <button class="btn-secondary" id="pv-close">${I18N.lang === 'en' ? 'Close' : 'Cerrar'}</button>
      </div>
    `;
    document.body.appendChild(div);
    div.querySelector('#pv-close').onclick = () => div.remove();
    div.querySelector('#pv-del').onclick = () => {
      if (confirm(I18N.lang === 'en' ? 'Delete this photo from the record?' : '¿Borrar esta foto del registro?')) {
        Store.remove('fotos', f.id);
        div.remove();
        toast(I18N.lang === 'en' ? 'Photo deleted' : 'Foto borrada');
      }
    };
  }

  /* ---------- Resumen PDF ---------- */
  function renderResumen() {
    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Resumen en PDF 📄</h2>
      <div class="card">
        <h2>Periodo</h2>
        <div class="segmented" id="seg-rango">
          <button data-dias="1">Hoy</button>
          <button data-dias="7" class="active">7 días</button>
          <button data-dias="30">30 días</button>
          <button data-dias="0">Todo</button>
        </div>
        <h2>¿Qué incluir?</h2>
        ${[
          ['tomas', '🍼 Alimentación'], ['panales', '💧 Pañales (con gráfica)'],
          ['suenos', '🌙 Sueño'], ['condiciones', '🩺 Condiciones médicas'],
          ['intervenciones', '💉 Intervenciones'], ['medicamentos', '💊 Medicamentos'],
          ['crecimiento', '📏 Crecimiento'],
        ].map(([k, n]) => `<label class="checkbox-row"><input type="checkbox" data-sec="${k}" checked> ${n}</label>`).join('')}
        <button class="btn-primary btn-block" id="btn-pdf" style="margin-top:12px">⬇️ Descargar PDF</button>
      </div>
    `;
    bindVolver();
    let dias = 7;
    $('#seg-rango').addEventListener('click', e => {
      const b = e.target.closest('button[data-dias]');
      if (!b) return;
      dias = Number(b.dataset.dias);
      $('#seg-rango').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    });
    $('#btn-pdf').onclick = async () => {
      const btn = $('#btn-pdf');
      btn.textContent = 'Generando… ⏳';
      btn.disabled = true;
      try {
        const hasta = new Date(); hasta.setHours(23, 59, 59);
        let desde;
        if (dias === 0) {
          const fechas = [
            ...Store.data.tomas.map(t => t.inicio),
            ...Store.data.panales.map(p => p.hora),
            ...Store.data.suenos.map(s => s.inicio),
          ].sort();
          desde = fechas.length ? new Date(fechas[0]) : new Date(Date.now() - 7 * 86400000);
        } else {
          desde = new Date(Date.now() - (dias - 1) * 86400000);
        }
        desde.setHours(0, 0, 0, 0);
        const secciones = {};
        main.querySelectorAll('[data-sec]').forEach(cb => secciones[cb.dataset.sec] = cb.checked);
        await PDFResumen.generar({ desde, hasta, secciones });
        toast('PDF descargado 📄');
      } catch (e) {
        console.error(e);
        toast('No se pudo generar el PDF');
      } finally {
        btn.textContent = '⬇️ Descargar PDF';
        btn.disabled = false;
      }
    };
  }

  /* ---------- Ajustes ---------- */
  function renderAjustes() {
    const cfg = Store.config;
    const d = Store.data;
    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Ajustes ⚙️</h2>

      <div class="card">
        <h2>👶 Bebé</h2>
        <div class="form-group"><label>Nombre</label>
          <input type="text" id="a-nombre" value="${esc(d.bebe.nombre)}">
        </div>
        <div class="form-row">
          <div class="form-group"><label>Fecha de nacimiento</label>
            <input type="date" id="a-nac" value="${d.bebe.nacimiento || ''}">
          </div>
          <div class="form-group"><label>Hora</label>
            <input type="time" id="a-hora-nac" value="${d.bebe.hora || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Mamá</label>
            <input type="text" id="a-mama" value="${esc(d.bebe.mama || '')}" placeholder="${I18N.lang === 'en' ? "Mom's name" : 'Nombre de mamá'}">
          </div>
          <div class="form-group"><label>Papá</label>
            <input type="text" id="a-papa" value="${esc(d.bebe.papa || '')}" placeholder="${I18N.lang === 'en' ? "Dad's name" : 'Nombre de papá'}">
          </div>
        </div>
        <div class="form-group"><label>Este teléfono lo usa</label>
          <select id="a-dispositivo">
            <option value="" ${!Store.getDispositivo() ? 'selected' : ''}>Sin definir</option>
            <option value="mama" ${Store.getDispositivo() === 'mama' ? 'selected' : ''}>👩 ${esc(d.bebe.mama || 'Mamá')}</option>
            <option value="papa" ${Store.getDispositivo() === 'papa' ? 'selected' : ''}>👨 ${esc(d.bebe.papa || 'Papá')}</option>
          </select>
        </div>
        <button class="btn-secondary btn-block" id="a-guardar-bebe">Guardar</button>
        <button class="btn-secondary btn-block" id="a-foto-perfil" style="margin-top:6px">📷 Foto de perfil del bebé</button>
        <button class="btn-ghost btn-block" data-accion="agregar-bebe" style="margin-top:6px">👶 ＋ Agregar otro bebé (gemelos, el que viene…)</button>
        <button class="btn-ghost btn-block" data-accion="cambiar-tema">🎨 Cambiar tema de color</button>
        <div class="form-group" style="margin-top:8px"><label>🌐 Idioma / Language</label>
          <select id="a-idioma">
            <option value="es" ${I18N.lang === 'es' ? 'selected' : ''}>Español</option>
            <option value="en" ${I18N.lang === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h2>👪 Cuentas de la familia</h2>
        <p style="font-size:12.5px;color:var(--text-2);margin-bottom:8px">${I18N.lang === 'en' ? `Accounts linked to ${esc((Store.getBebes()[0] || {}).nombre || 'this baby')} — everyone signs in with their own email and each entry is signed with their name.` : `Cuentas enlazadas a ${esc((Store.getBebes()[0] || {}).nombre || 'este bebé')} — cada quien entra con su correo y todo queda firmado con su nombre.`}</p>
        ${Store.cuentasDeFamilia().map(c => `
          <div class="measure-row"><span>${c.quien === 'mama' ? '👩' : c.quien === 'papa' ? '👨' : '👤'} ${esc(c.email)}</span>
          <span class="measure-val">${c.quien ? esc(nombreQuien(c.quien)) : ''}</span></div>`).join('') || '<p style="font-size:13px;color:var(--text-2)">Sin cuentas locales</p>'}
        <button class="btn-secondary btn-block" id="a-agregar-cuenta" style="margin-top:10px">＋ Agregar cuenta de familiar</button>
      </div>

      ${Store.modoDemo ? `
      <div class="card" style="border-left:5px solid #f5b54a">
        <h2>🧪 Modo demo</h2>
        <p style="font-size:13.5px;color:var(--text-2)">Estás en el demo con datos sintéticos: la sincronización está deshabilitada y nada se guarda en ningún servidor. Crea tu cuenta para tener tu propio registro.</p>
      </div>` : `
      <div class="card">
        <h2>☁️ Sincronización con GitHub</h2>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">
          Para que los dos celulares vean los mismos datos, la app los guarda en un
          repositorio de GitHub. <b>Usa un repositorio PRIVADO</b> para que los datos
          de la bebé no sean públicos.
        </p>
        <div class="form-row">
          <div class="form-group"><label>Usuario u organización</label>
            <input type="text" id="a-owner" value="${esc(cfg.owner)}" placeholder="${I18N.lang === 'en' ? 'your-github-user' : 'tu-usuario-github'}" autocapitalize="none">
          </div>
          <div class="form-group"><label>Repositorio</label>
            <input type="text" id="a-repo" value="${esc(cfg.repo)}" placeholder="${I18N.lang === 'en' ? 'baby-data' : 'datos-bebe'}" autocapitalize="none">
          </div>
        </div>
        <div class="form-group"><label>Token de acceso (fine-grained, con permiso Contents)</label>
          <input type="password" id="a-token" value="${esc(cfg.token)}" placeholder="github_pat_…" autocapitalize="none">
        </div>
        <label class="checkbox-row"><input type="checkbox" id="a-autosync" ${cfg.autoSync ? 'checked' : ''}> Sincronizar automáticamente</label>
        <div class="form-row" style="margin-top:8px">
          <button class="btn-secondary" style="flex:1" id="a-probar">Probar conexión</button>
          <button class="btn-primary" style="flex:1" id="a-sync">Sincronizar ahora</button>
        </div>
        <p style="font-size:12px;color:var(--text-2);margin-top:10px">
          ${cfg.lastSync ? `Última sincronización: ${new Date(cfg.lastSync).toLocaleString(I18N.loc())}` : 'Aún no se ha sincronizado.'}
        </p>
        <details style="margin-top:8px;font-size:13px;color:var(--text-2)">
          <summary style="font-weight:700;cursor:pointer">¿Cómo configurarlo? (una sola vez)</summary>
          <ol style="padding-left:18px;margin-top:8px;line-height:1.6">
            <li>En GitHub crea un repositorio <b>privado</b> nuevo, por ejemplo <b>maya-datos</b>.</li>
            <li>Ve a Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token.</li>
            <li>Dale acceso <b>solo a ese repositorio</b>, con permiso <b>Contents: Read and write</b>.</li>
            <li>Copia el token y pégalo aquí en los dos celulares.</li>
          </ol>
        </details>
      </div>

      <div class="card">
        <h2>💾 Respaldo</h2>
        <div class="form-row">
          <button class="btn-secondary" style="flex:1" id="a-exportar">Exportar JSON</button>
          <button class="btn-secondary" style="flex:1" id="a-importar">Importar JSON</button>
        </div>
        <input type="file" id="a-archivo" accept=".json" style="display:none">
      </div>`}

      <button class="btn-danger btn-block" id="a-logout">${Store.modoDemo ? 'Salir del demo' : 'Cerrar sesión'}</button>
    `;
    bindVolver();
    const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };

    on('#a-guardar-bebe', () => {
      d.bebe.nombre = $('#a-nombre').value.trim() || d.bebe.nombre || (I18N.lang === 'en' ? 'Baby' : 'Bebé');
      d.bebe.nacimiento = $('#a-nac').value;
      d.bebe.hora = $('#a-hora-nac').value;
      d.bebe.mama = $('#a-mama').value.trim();
      d.bebe.papa = $('#a-papa').value.trim();
      d.bebe.actualizado = new Date().toISOString();
      Store.setDispositivo($('#a-dispositivo').value);
      const idiomaSel = $('#a-idioma');
      if (idiomaSel && idiomaSel.value !== I18N.lang) { I18N.set(idiomaSel.value); setTimeout(() => location.reload(), 400); }
      Store.saveLocal();
      toast('Guardado 💗');
      actualizarHeader();
    });

    const leerCfg = () => {
      Store.config.owner = $('#a-owner').value.trim();
      Store.config.repo = $('#a-repo').value.trim();
      Store.config.token = $('#a-token').value.trim();
      Store.config.autoSync = $('#a-autosync').checked;
      Store.saveConfig();
    };
    on('#a-probar', async () => {
      leerCfg();
      if (!Store.canSync()) { toast('Llena usuario, repo y token'); return; }
      toast(await Store.testConnection() ? 'Conexión exitosa ✅' : 'No se pudo conectar ❌');
    });
    on('#a-sync', async () => {
      leerCfg();
      if (!Store.canSync()) { toast('Llena usuario, repo y token'); return; }
      toast('Sincronizando…');
      await Store.syncNow();
      toast(Store.syncState === 'ok' ? 'Sincronizado ✅' : 'Error al sincronizar ❌');
      render();
    });

    on('#a-exportar', () => {
      const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `respaldo-maya-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    });
    on('#a-importar', () => $('#a-archivo').click());
    if ($('#a-archivo')) $('#a-archivo').onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const imp = JSON.parse(fr.result);
          if (!imp.tomas) throw new Error('formato');
          Store.data = Object.assign(Store.emptyData(), imp);
          Store.saveLocal();
          toast('Respaldo importado ✅');
          render();
        } catch { toast('Archivo no válido'); }
      };
      fr.readAsText(file);
    };

    on('#a-foto-perfil', () => elegirFotoPerfil(avatar => {
      Store.data.bebe.avatar = avatar;
      Store.data.bebe.actualizado = new Date().toISOString();
      Store.saveLocal();
      cargarAvatar();
      toast('Foto de perfil actualizada 📷');
    }));

    on('#a-agregar-cuenta', () => {
      let rol = 'papa';
      abrirSheet(`
        <h2>Agregar cuenta de familiar 👪</h2>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">La nueva cuenta entra a ESTA familia con acceso a los mismos datos, y lo que registre quedará firmado con su nombre. (La cuenta vive en este dispositivo; en otro teléfono se crea igual y se conecta la misma nube en Ajustes.)</p>
        <div class="form-group"><label>Correo del familiar</label>
          <input type="text" id="fc-email" inputmode="email" autocapitalize="none" placeholder="familiar@correo.com">
        </div>
        <div class="form-group"><label>Contraseña (mínimo 8 caracteres)</label>
          <input type="password" id="fc-pass" placeholder="••••••••">
        </div>
        <div class="form-group"><label>Es</label>
          <div class="quien-chips" id="fc-rol">
            <button type="button" data-rol="mama">👩 Mamá</button>
            <button type="button" class="activo" data-rol="papa">👨 Papá</button>
          </div>
        </div>
        <button class="btn-primary btn-block" id="fc-crear">Agregar cuenta</button>
      `);
      $('#fc-rol').addEventListener('click', e => {
        const b = e.target.closest('[data-rol]');
        if (!b) return;
        rol = b.dataset.rol;
        $('#fc-rol').querySelectorAll('button').forEach(x => x.classList.toggle('activo', x === b));
      });
      $('#fc-crear').onclick = async () => {
        const r = await Store.crearCuenta({ email: $('#fc-email').value, pass: $('#fc-pass').value, quien: rol, familia: Store.familiaActiva });
        if (r.error) { toast(r.error); return; }
        cerrarSheet();
        toast('Cuenta agregada 👪');
        render();
      };
    });

    $('#a-logout').onclick = () => {
      Store.logout();
      sessionStorage.setItem('maya.ir-login', '1');
      location.reload();
    };
  }

  /* ============================================================
     timers activos (banner)
  ============================================================ */
  function renderTimers() {
    const timers = Store.getTimers();
    const cont = $('#active-timers');
    let html = '';
    if (timers.toma) {
      const seg = segundosToma(timers.toma);
      const enPausa = !!timers.toma.pausadoDesde;
      html += `
        <div class="timer-banner" style="${enPausa ? 'opacity:.75' : ''}">
          <div class="timer-info">🤱 ${timers.toma.lado === 'izq' ? (I18N.lang === 'en' ? 'Left' : 'Izquierda') : (I18N.lang === 'en' ? 'Right' : 'Derecha')}${enPausa ? (I18N.lang === 'en' ? ' · paused' : ' · en pausa') : ''}
            <span class="timer-clock">${fmtDur(seg)}</span></div>
          <div>
            <button data-accion="toma-cancelar">✕</button>
            <button data-accion="toma-pausa">${enPausa ? '▶' : '⏸'}</button>
            <button class="stop" data-accion="toma-terminar">■ Terminar</button>
          </div>
        </div>`;
    }
    if (timers.actividad) {
      const restante = Math.max(0, Math.round(timers.actividad.min * 60 - (Date.now() - new Date(timers.actividad.inicio)) / 1000));
      html += `
        <div class="timer-banner actividad">
          <div class="timer-info">${timers.actividad.emoji} ${esc(timers.actividad.titulo)}
            <span class="timer-clock">${fmtDur(restante)}</span></div>
          <div>
            <button data-accion="act-cancelar">✕</button>
            <button class="stop" data-accion="act-terminar">✓ Listo</button>
          </div>
        </div>`;
    }
    if (timers.sueno) {
      const seg = Math.floor((Date.now() - new Date(timers.sueno.inicio)) / 1000);
      html += `
        <div class="timer-banner sleep">
          <div class="timer-info">🌙 Dormida
            <span class="timer-clock">${fmtDur(seg)}</span></div>
          <div>
            <button data-accion="sueno-cancelar">✕</button>
            <button class="stop" data-accion="sueno-terminar">☀️ Despertó</button>
          </div>
        </div>`;
    }
    if (timers.extraccion) {
      const seg = Math.floor((Date.now() - new Date(timers.extraccion.inicio)) / 1000);
      const m = modoExt(timers.extraccion.modo);
      const fase = faseDe(timers.extraccion.modo, seg);
      let info;
      if (!fase) info = '🥛 Extrayendo';
      else if (fase.fin) info = `${m.emoji} ¡Sesión completa! 🏆`;
      else info = `${m.emoji} ${esc(fase.nombre)} <span class="fase-chip">${fase.i + 1}/${fase.total} · falta ${fmtDur(fase.restante)}</span>`;
      html += `
        <div class="timer-banner extraccion">
          <div class="timer-info">${info}
            <span class="timer-clock">${fmtDur(seg)}</span></div>
          <div>
            <button data-accion="ext-cancelar">✕</button>
            <button class="stop" data-accion="ext-terminar">■ Terminar</button>
          </div>
        </div>`;
    }
    if (timers.rutina) {
      const pasos = (Store.data.rutina && Store.data.rutina.pasos) || [];
      const hechos = (timers.rutina.hechos || []).length;
      html += `
        <div class="timer-banner rutina">
          <div class="timer-info">🌙 Rutina de dormir
            <span class="timer-clock">${hechos}/${pasos.length}</span></div>
          <div>
            <button data-accion="ir-sueno">Ver</button>
          </div>
        </div>`;
    }
    if (timers.vigilia) {
      const seg = Math.floor((Date.now() - new Date(timers.vigilia.inicio)) / 1000);
      html += `
        <div class="timer-banner vigilia">
          <div class="timer-info">👁️ Vigilia
            <span class="timer-clock">${fmtDur(seg)}</span></div>
          <div>
            <button data-accion="vigilia-cancelar">✕</button>
            <button data-accion="vigilia-nota">📝</button>
            <button class="stop" data-accion="vigilia-terminar">😴 Terminó</button>
          </div>
        </div>`;
    }
    cont.innerHTML = html;
    actualizarWakeLock();
  }

  // mantener la pantalla encendida mientras hay una toma en curso,
  // para que el contador siga visible y el teléfono no se bloquee solo
  let wakeLock = null;
  async function actualizarWakeLock() {
    const t = Store.getTimers();
    const necesita = !!t.toma && !t.toma.pausadoDesde;
    try {
      if (necesita && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!necesita && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch { /* sin soporte o sin permiso: la app funciona igual */ }
  }
  document.addEventListener('visibilitychange', actualizarWakeLock);

  /* ============================================================
     acciones globales y navegación
  ============================================================ */
  document.body.addEventListener('click', e => {
    const btn = e.target.closest('[data-accion]');
    if (btn) {
      const a = btn.dataset.accion;
      if (a === 'toma-izq') iniciarToma('izq');
      if (a === 'toma-der') iniciarToma('der');
      if (a === 'toma-pausa') pausarToma();
      if (a === 'toma-terminar') terminarToma(false);
      if (a === 'toma-cancelar') { if (confirm(I18N.t('¿Cancelar la toma sin guardar?'))) terminarToma(true); }
      if (a === 'toma-manual') hojaBiberon('materno');
      if (a === 'biberon') hojaTipoBiberon();
      if (a === 'biberon-tipo') hojaBiberon(tipoComida);
      if (a === 'dormir') iniciarSueno();
      if (a === 'sueno-terminar') terminarSueno(false);
      if (a === 'sueno-cancelar') { if (confirm(I18N.t('¿Cancelar sin guardar?'))) terminarSueno(true); }
      if (a === 'sueno-manual') hojaSuenoManual();
      if (a === 'rutina-editar') hojaEditarRutina();
      if (a === 'rutina-iniciar') iniciarRutina();
      if (a === 'rutina-cancelar') { if (confirm(I18N.t('¿Cancelar la rutina de esta noche?'))) terminarRutina(false); }
      if (a === 'rutina-dormir') terminarRutina(true);
      if (a === 'ir-sueno') {
        tabActual = 'sueno';
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'sueno'));
        render();
        window.scrollTo(0, 0);
      }
      if (a === 'vigilia') iniciarVigilia();
      if (a === 'vigilia-terminar') terminarVigilia(false);
      if (a === 'vigilia-cancelar') { if (confirm(I18N.t('¿Cancelar sin guardar?'))) terminarVigilia(true); }
      if (a === 'vigilia-nota') hojaNotaVigilia();
      if (a === 'panal-pipi') registrarPanal('pipi');
      if (a === 'panal-popo') registrarPanal('popo');
      if (a === 'panal-mixto') registrarPanal('mixto');
      if (a === 'panal-manual') hojaPanal(null);
      if (a === 'ver-banco') {
        tabActual = 'mas';
        vistaMas = 'banco';
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'mas'));
        render();
        window.scrollTo(0, 0);
      }
      if (a === 'agregar-bebe') hojaAgregarBebe();
      if (a === 'cambiar-tema') elegirTema(false);
      if (a === 'epds') hojaEPDS();
      if (a === 'ver-analisis') {
        tabActual = 'mas';
        vistaMas = 'analisis';
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'mas'));
        render();
        window.scrollTo(0, 0);
      }
      if (a === 'ext-terminar') terminarExtraccion(false);
      if (a === 'ext-cancelar') { if (confirm(I18N.t('¿Cancelar la extracción sin guardar?'))) terminarExtraccion(true); }
      if (a === 'act-terminar') terminarActividad(true);
      if (a === 'act-cancelar') { if (confirm(I18N.t('¿Cancelar la actividad sin marcarla?'))) terminarActividad(false); }
      if (a === 'foto-semanal') pedirFotoSemanal(Number(btn.dataset.sem));
      return;
    }

    const pasoBtn = e.target.closest('[data-paso]');
    if (pasoBtn) { marcarPasoRutina(pasoBtn.dataset.paso); return; }

    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      const [col, id] = editBtn.dataset.edit.split(':');
      const item = Store.data[col].find(x => x.id === id);
      if (!item) return;
      if (col === 'tomas') hojaBiberon(item.tipo, item);
      if (col === 'suenos') hojaSuenoManual(item);
      if (col === 'panales') hojaPanal(item);
      if (col === 'intervenciones') hojaIntervencion(item);
      if (col === 'medicamentos') hojaMedicamento(item);
      if (col === 'crecimiento') hojaCrecimiento(item);
      if (col === 'citas') hojaCita(item);
      return;
    }

    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      const [col, id] = delBtn.dataset.del.split(':');
      if (confirm(I18N.t('¿Borrar este registro?'))) {
        if (col === 'panales') {
          const p = Store.data.panales.find(x => x.id === id);
          if (p && p.fotoId) Store.remove('fotos', p.fotoId); // su foto se va con él
        }
        if (col === 'tomas') {
          const mov = Store.data.banco.find(m => m.tomaId === id);
          if (mov) Store.remove('banco', mov.id); // devolver la leche al refri
        }
        Store.remove(col, id);
        toast('Registro borrado');
      }
    }
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabActual = tab.dataset.tab;
      if (tabActual !== 'mas') vistaMas = null;
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
      render();
      window.scrollTo(0, 0);
    });
  });

  $('#btn-idioma').onclick = () => {
    I18N.set(I18N.lang === 'en' ? 'es' : 'en');
    // recargar reconstruye toda la app (textos, datos y gráficas) en el idioma nuevo
    location.reload();
  };

  $('#btn-settings').onclick = () => {
    tabActual = 'mas';
    vistaMas = 'ajustes';
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'mas'));
    render();
  };

  function actualizarHeader() {
    const d = Store.data;
    $('#header-title').textContent = d.bebe.nombre || (I18N.lang === 'en' ? 'Baby' : 'Bebé');
    let sub = fmtFechaLarga(new Date());
    if (d.bebe.nacimiento) {
      const dias = Math.floor((Date.now() - new Date(`${d.bebe.nacimiento}T${d.bebe.hora || '00:00'}`)) / 86400000);
      const enH = I18N.lang === 'en';
      sub += dias < 60
        ? (enH ? ` · ${dias} day${dias === 1 ? '' : 's'} old 💗` : ` · ${dias} días de vida 💗`)
        : (enH ? ` · ${Math.floor(dias / 7)} weeks 💗` : ` · ${Math.floor(dias / 7)} semanas 💗`);
    }
    $('#header-sub').textContent = sub;
  }

  function renderBebesBar() {
    const bar = $('#bebes-bar');
    const bebes = Store.getBebes();
    if (bebes.length <= 1) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
    bar.classList.remove('hidden');
    bar.innerHTML = bebes.map(b => `
      <button class="bebe-chip ${b.id === Store.bebeActivo ? 'activo' : ''}" data-bebe="${b.id}">👶 ${esc(b.nombre)}</button>`).join('')
      + (bebes.length < 5 ? '<button class="bebe-chip agregar" data-accion="agregar-bebe">＋</button>' : '');
    bar.querySelectorAll('[data-bebe]').forEach(ch => ch.onclick = async () => {
      if (ch.dataset.bebe === Store.bebeActivo) return;
      Store.cambiarBebe(ch.dataset.bebe);
      toast(`Viendo a ${ch.textContent.replace('👶', '').trim()} 💗`);
      render();
      cargarAvatar();
      if (Store.canSync()) { await Store.syncNow(); render(); }
    });
  }

  function hojaAgregarBebe() {
    if (Store.getBebes().length >= 5) { toast('Máximo 5 bebés'); return; }
    abrirSheet(`
      <h2>Agregar otro bebé 👶</h2>
      <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">Cada bebé tiene su propio registro completo (tomas, pañales, retos, banco de leche…) y podrán cambiar entre ellos con las pestañitas de arriba. Hasta 5.</p>
      <div class="form-group"><label>Nombre</label>
        <input type="text" id="f-nombre-bebe" placeholder="Nombre del bebé">
      </div>
      <button class="btn-primary btn-block" id="f-crear">Crear su registro</button>
    `);
    $('#f-crear').onclick = () => {
      const nombre = $('#f-nombre-bebe').value.trim();
      if (!nombre) { toast('Ponle nombre'); return; }
      Store.agregarBebe(nombre);
      cerrarSheet();
      confeti(80);
      celebracion('👶', I18N.lang === 'en' ? `Welcome ${nombre}!` : `¡Bienvenida ${nombre}!`, I18N.lang === 'en' ? 'Their journal is ready' : 'Su registro está listo');
      render();
      cargarAvatar();
      setTimeout(() => elegirFotoPerfil(avatar => {
        Store.data.bebe.avatar = avatar;
        Store.saveLocal();
        cargarAvatar();
        toast('¡Qué carita! 📷💗');
      }), 3600);
    };
  }

  let vistaAnterior = '';
  function render() {
    const vistaActual = `${tabActual}/${vistaMas || ''}`;
    if (vistaActual !== vistaAnterior) {
      vistaAnterior = vistaActual;
      main.classList.remove('cambio');
      void main.offsetWidth; // reiniciar la animación
      main.classList.add('cambio');
    }
    renderBebesBar();
    renderTimers();
    actualizarHeader();
    $('#sync-dot').className = `sync-dot ${Store.syncState !== 'off' ? Store.syncState : ''}`;
    if (tabActual === 'inicio') renderInicio();
    else if (tabActual === 'comida') renderComida();
    else if (tabActual === 'sueno') renderSueno();
    else if (tabActual === 'panal') renderPanal();
    else if (tabActual === 'retos') renderRetos();
    else renderMas();
    I18N.aplicar(main);
    pintarTabs();
  }

  const TABS_LABELS = { inicio: 'Inicio', comida: 'Comida', sueno: 'Sueño', panal: 'Pañal', retos: 'Retos', mas: 'Más' };
  function pintarTabs() {
    document.querySelectorAll('.tab').forEach(tb => {
      const span = tb.querySelector('span:last-child');
      const clave = TABS_LABELS[tb.dataset.tab];
      if (span && clave) span.textContent = I18N.t(clave);
    });
  }

  /* ---------- calendario nativo (.ics con alarma) ---------- */
  function descargarICS(nombre, vevent) {
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Maya//ES', vevent, 'END:VCALENDAR'].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${nombre}.ics`;
    a.click();
    toast('📅 Ábrelo para agregarlo a tu calendario con alarma');
  }
  const fechaICS = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  function icsCita(c) {
    return ['BEGIN:VEVENT',
      `UID:${c.id}@maya.app`,
      `DTSTART:${fechaICS(c.fecha)}`,
      `DTEND:${fechaICS(new Date(new Date(c.fecha).getTime() + 3600000))}`,
      `SUMMARY:${(c.titulo || (I18N.lang === 'en' ? 'Appointment' : 'Cita médica')).replace(/[,;]/g, ' ')} · ${Store.data.bebe.nombre || 'bebé'}`,
      c.lugar ? `LOCATION:${c.lugar.replace(/[,;]/g, ' ')}` : '',
      c.notas ? `DESCRIPTION:${c.notas.replace(/[,;\n]/g, ' ')}` : '',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${I18N.lang === 'en' ? 'Appointment tomorrow' : 'Cita mañana'}`, 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${I18N.lang === 'en' ? 'Appointment in 1 hour' : 'Cita en 1 hora'}`, 'END:VALARM',
      'END:VEVENT'].filter(Boolean).join('\r\n');
  }

  function icsMedicamento(m, hora) {
    const [hh, mm] = hora.split(':');
    const inicio = new Date(); inicio.setHours(Number(hh), Number(mm), 0, 0);
    if (inicio < new Date()) inicio.setDate(inicio.getDate() + 1);
    return ['BEGIN:VEVENT',
      `UID:med-${m.id}@maya.app`,
      `DTSTART:${fechaICS(inicio)}`,
      `DTEND:${fechaICS(new Date(inicio.getTime() + 600000))}`,
      'RRULE:FREQ=DAILY',
      `SUMMARY:💊 ${m.nombre.replace(/[,;]/g, ' ')}${m.dosis ? ` (${m.dosis.replace(/[,;]/g, ' ')})` : ''} · ${Store.data.bebe.nombre || 'bebé'}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${I18N.lang === 'en' ? 'Medication time' : 'Hora del medicamento'}`, 'END:VALARM',
      'END:VEVENT'].join('\r\n');
  }

  /* ---------- citas médicas ---------- */
  function renderCitas() {
    const ahora = Date.now();
    const citas = [...Store.data.citas].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const proximas = citas.filter(c => new Date(c.fecha) >= ahora - 3600000 && !c.hecha);
    const pasadas = citas.filter(c => new Date(c.fecha) < ahora - 3600000 || c.hecha).reverse();
    const pinta = c => `
      <div class="entry">
        <span class="entry-emoji">🩺</span>
        <div class="entry-main">
          <div class="entry-title">${esc(c.titulo)}${c.hecha ? ' ✅' : ''}</div>
          <div class="entry-sub">${new Date(c.fecha).toLocaleString(I18N.loc(), { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${c.lugar ? ` · 📍 ${esc(c.lugar)}` : ''}${c.notas ? ` · ${esc(c.notas)}` : ''}</div>
        </div>
        <div class="entry-actions">
          ${!c.hecha ? `<button data-ics-cita="${c.id}" title="Agregar al calendario">🔔</button>` : ''}
          <button data-edit="citas:${c.id}">✏️</button>
          <button data-del="citas:${c.id}">🗑️</button>
        </div>
      </div>`;
    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Citas médicas 📅</h2>
      <button class="btn-primary btn-block" id="btn-nueva-cita">＋ Agendar cita</button>
      <p style="text-align:center;font-size:12.5px;color:var(--text-2);margin:8px 0 2px">El 🔔 la agrega al calendario del teléfono con alarma (1 día y 1 hora antes)</p>
      ${proximas.length ? `<div class="day-label">Próximas</div><div class="entry-list">${proximas.map(pinta).join('')}</div>`
        : '<div class="empty-state"><span class="big">📅</span>Agenda su siguiente consulta, vacunas o laboratorio</div>'}
      ${pasadas.length ? `<details style="margin-top:14px"><summary class="day-label" style="cursor:pointer">Pasadas (${pasadas.length})</summary>
        <div class="entry-list" style="margin-top:6px">${pasadas.map(pinta).join('')}</div></details>` : ''}
    `;
    bindVolver();
    $('#btn-nueva-cita').onclick = () => hojaCita();
    main.querySelectorAll('[data-ics-cita]').forEach(b => b.onclick = () => {
      const c = Store.data.citas.find(x => x.id === b.dataset.icsCita);
      if (c) descargarICS(`cita-${(c.titulo || 'medica').slice(0, 20)}`, icsCita(c));
    });
  }

  function hojaCita(existente) {
    abrirSheet(`
      <h2>${existente ? 'Editar cita' : 'Agendar cita'} 🩺</h2>
      <div class="form-group"><label>Motivo</label>
        <input type="text" id="f-titulo" value="${esc(existente ? existente.titulo : '')}" placeholder="Control del mes, vacunas, laboratorio…">
      </div>
      <div class="form-group"><label>Fecha y hora</label>
        <input type="datetime-local" id="f-fecha" value="${aInputLocal(existente ? existente.fecha : null)}">
      </div>
      <div class="form-group"><label>Lugar (opcional)</label>
        <input type="text" id="f-lugar" value="${esc(existente ? existente.lugar : '')}" placeholder="Consultorio, hospital…">
      </div>
      <div class="form-group"><label>Notas (opcional)</label>
        <input type="text" id="f-notas" value="${esc(existente ? existente.notas : '')}" placeholder="Llevar cartilla, preguntas para el doctor…">
      </div>
      ${existente ? `<label class="checkbox-row"><input type="checkbox" id="f-hecha" ${existente.hecha ? 'checked' : ''}> Ya fuimos ✅</label>` : ''}
      <button class="btn-primary btn-block" id="f-guardar">Guardar</button>
    `);
    $('#f-guardar').onclick = () => {
      const reg = {
        titulo: $('#f-titulo').value.trim(),
        fecha: deInputLocal($('#f-fecha').value),
        lugar: $('#f-lugar').value.trim(),
        notas: $('#f-notas').value.trim(),
        hecha: existente ? $('#f-hecha').checked : false,
      };
      if (!reg.titulo) { toast('Escribe el motivo'); return; }
      if (existente) Store.update('citas', existente.id, reg);
      else Store.add('citas', reg);
      cerrarSheet();
      toast('Cita guardada 📅');
    };
  }

  /* ---------- bienestar de mamá (EPDS) ---------- */
  function hojaEPDS() {
    const respuestas = [];
    let i = 0;

    const en = I18N.lang === 'en';
    const pintar = () => {
      const q = EPDS.PREGUNTAS[i];
      $('#sheet-content').innerHTML = `
        <h2>${en ? 'About you 💚' : 'Sobre ti 💚'}</h2>
        <p style="font-size:12.5px;color:var(--text-2)">${en ? `In the past 7 days… · question ${i + 1} of 10` : `En los últimos 7 días… · pregunta ${i + 1} de 10`}</p>
        <div class="rutina-progreso"><div style="width:${Math.round((i / 10) * 100)}%"></div></div>
        <p style="font-size:16.5px;font-weight:800;margin:10px 0 14px">${esc(q.texto)}</p>
        ${q.ops.map(([txt, val], j) => `
          <button class="epds-op" data-val="${val}">${esc(txt)}</button>`).join('')}
        <p class="disclaimer">${en ? 'Your answers are saved only on YOUR phone; they are never uploaded and no one else sees them.' : 'Tus respuestas solo se guardan en TU teléfono; no se suben a la nube ni las ve nadie más.'}</p>
      `;
      document.querySelectorAll('.epds-op').forEach(b => b.onclick = () => {
        respuestas.push(Number(b.dataset.val));
        i++;
        if (i < EPDS.PREGUNTAS.length) pintar();
        else terminar();
      });
    };

    const terminar = () => {
      const total = respuestas.reduce((s, v) => s + v, 0);
      const q10 = respuestas[9];
      EPDS.guardarResultado(total, q10);
      const nivel = EPDS.interpretar(total, q10);
      const nombre = esc(Store.data.bebe.mama || (en ? 'mom' : 'mamá'));
      const beb = esc(Store.data.bebe.nombre || (en ? 'the baby' : 'la bebé'));
      const pareja = esc(Store.data.bebe.papa || (en ? 'your partner' : 'tu pareja'));
      const recursos = EPDS.RECURSOS.map(r => `
        <a class="epds-recurso" href="${r.url}" target="_blank" rel="noopener">${r.emoji} ${esc(r.texto)}</a>`).join('');

      let cuerpo = '';
      if (nivel === 'urgente') {
        cuerpo = `
          <div class="analisis-estado" style="background:linear-gradient(135deg,#e25555,#c73e3e)">
            <span class="ae-emoji">🫂</span>
            <div><div class="ae-titulo">${en ? `You are not alone, ${nombre}` : `No estás sola, ${nombre}`}</div>
            <div class="ae-sub">${en ? 'You noted thoughts of harming yourself. That deserves attention TODAY, not tomorrow.' : 'Indicaste pensamientos de hacerte daño. Eso merece atención HOY, no mañana.'}</div></div>
          </div>
          <p style="font-size:14.5px;line-height:1.5;margin-bottom:10px">${en ? `Please tell ${pareja} or someone you trust right now, and call a support line — it's free, confidential and they truly help. If you feel you might harm yourself this very moment, call <b>911</b>.` : `Por favor díselo ahora a ${pareja} o a alguien de confianza, y llama a una línea de apoyo — es gratis, es confidencial y ayudan de verdad. Si sientes que puedes hacerte daño en este momento, llama al <b>911</b>.`}</p>
          ${recursos}`;
      } else if (nivel === 'alto') {
        cuerpo = `
          <div class="analisis-estado" style="background:linear-gradient(135deg,#e2865e,#d06a3f)">
            <span class="ae-emoji">💛</span>
            <div><div class="ae-titulo">${en ? `You deserve support, ${nombre}` : `Mereces apoyo, ${nombre}`}</div>
            <div class="ae-sub">${en ? `Score ${total}/30 — suggests meaningful symptoms of postpartum depression.` : `Puntaje ${total}/30 — sugiere síntomas importantes de depresión posparto.`}</div></div>
          </div>
          <p style="font-size:14.5px;line-height:1.5;margin-bottom:10px">${en ? `Postpartum depression is <b>very common</b> (1 in 7 moms) and <b>very treatable</b>. It's not weakness and it doesn't mean you're a bad mom — it's a medical condition, like ${beb}'s jaundice. The best step is to talk with a perinatal specialist this week:` : `La depresión posparto es <b>muy común</b> (1 de cada 7 mamás) y <b>muy tratable</b>. No es debilidad ni significa que seas mala mamá — es una condición médica, como la ictericia de ${beb}. El mejor paso es hablar esta semana con un especialista perinatal:`}</p>
          ${recursos}`;
      } else if (nivel === 'medio') {
        cuerpo = `
          <div class="analisis-estado" style="background:linear-gradient(135deg,#f5b54a,#e79a1f)">
            <span class="ae-emoji">🌤️</span>
            <div><div class="ae-titulo">${en ? `You're carrying a lot, ${nombre}` : `Andas cargando bastante, ${nombre}`}</div>
            <div class="ae-sub">${en ? `Score ${total}/30 — some symptoms worth keeping an eye on.` : `Puntaje ${total}/30 — algunos síntomas que vale la pena vigilar.`}</div></div>
          </div>
          <div class="care-box"><h4>${en ? '💚 This week, on purpose' : '💚 Esta semana, con intención'}</h4><ul>
            <li>${en ? `Sleep when ${beb} sleeps at least once a day; the to-dos can wait.` : `Duerme cuando ${beb} duerma al menos una vez al día; los pendientes esperan.`}</li>
            <li>${en ? `Tell ${pareja} how you feel, using these words.` : `Cuéntale a ${pareja} cómo te sientes, con estas palabras.`}</li>
            <li>${en ? 'Get 15 min of daylight, even in the yard with the baby.' : 'Sal a la luz del día 15 min, aunque sea al patio con la bebé.'}</li>
            <li>${en ? "We'll check in again in a week. If this grows, seek support — there are options below." : 'Volveremos a preguntarte en una semana. Si esto crece, busca apoyo — abajo hay opciones.'}</li>
          </ul></div>
          ${recursos}`;
      } else {
        cuerpo = `
          <div class="analisis-estado" style="background:linear-gradient(135deg,#4cc38a,#2ea06d)">
            <span class="ae-emoji">💚</span>
            <div><div class="ae-titulo">${en ? `You seem well, ${nombre}` : `Te ves bien, ${nombre}`}</div>
            <div class="ae-sub">${en ? `Score ${total}/30 — no major signs this time.` : `Puntaje ${total}/30 — sin señales importantes esta vez.`}</div></div>
          </div>
          <p style="font-size:14px;line-height:1.5;color:var(--text-2)">${en ? `Thanks for taking these 2 minutes. Caring for yourself is also caring for ${beb}. We'll ask again later — and if one day you feel different, the test is always in More → Mom's wellbeing.` : `Gracias por tomarte estos 2 minutos. Cuidarte a ti también es cuidar a ${beb}. Te volveremos a preguntar más adelante — y si un día te sientes distinta, el test siempre está en Más → Bienestar de mamá.`}</p>`;
      }

      $('#sheet-content').innerHTML = `
        ${cuerpo}
        <p class="disclaimer">${en ? 'The Edinburgh Scale is a validated screening, not a diagnosis; only a professional can diagnose. Results saved only on your phone.' : 'La Escala de Edimburgo es un tamizaje validado, no un diagnóstico; solo un profesional puede diagnosticar. Resultados guardados únicamente en tu teléfono.'}</p>
        <button class="btn-primary btn-block" id="epds-cerrar" style="margin-top:10px">${en ? 'Close' : 'Cerrar'}</button>
      `;
      $('#epds-cerrar').onclick = cerrarSheet;
    };

    abrirSheet('');
    pintar();
  }

  function invitarEPDS() {
    if (!$('#sheet').classList.contains('hidden')) return;
    const en = I18N.lang === 'en';
    const nombre = esc(Store.data.bebe.mama || (en ? 'mom' : 'mamá'));
    const beb = esc(Store.data.bebe.nombre || (en ? 'the baby' : 'la bebé'));
    abrirSheet(`
      <div style="text-align:center;font-size:50px;margin:4px 0 8px">💚</div>
      <h2 style="text-align:center">${en ? `And how are you, ${nombre}?` : `¿Y tú cómo estás, ${nombre}?`}</h2>
      <p style="font-size:14.5px;line-height:1.5;color:var(--text-2);margin-bottom:14px">
        ${en
          ? `This app cares for ${beb}, but ${beb} needs you well too. Every so often we'll do a quick check-in (2 minutes, 10 questions) that doctors worldwide use to look after moms' mood. It's private: only you see the answers.`
          : `Esta app cuida a ${beb}, pero ${beb} te necesita bien a ti. Cada cierto tiempo te haremos un chequeo cortito (2 minutos, 10 preguntas) que usan los médicos de todo el mundo para cuidar el ánimo de las mamás. Es privado: solo tú ves las respuestas.`}</p>
      <button class="btn-primary btn-block" id="epds-si">${en ? "Sure — 2 minutes 💚" : 'Sí, va — 2 minutos 💚'}</button>
      <button class="btn-ghost btn-block" id="epds-luego">${en ? 'Not now, in a few days' : 'Ahora no, en unos días'}</button>
    `);
    $('#epds-si').onclick = () => hojaEPDS();
    $('#epds-luego').onclick = () => { EPDS.posponer(2); cerrarSheet(); toast(en ? "I'll ask again in a couple of days 💚" : 'Te pregunto en un par de días 💚'); };
  }

  /* ---------- temas de color ---------- */
  const TEMAS = [
    { id: '', nombre: I18N.lang === 'en' ? 'Original' : 'Original', emoji: '💗', colores: ['#fff5f8', '#f06a9b', '#ffffff'] },
    { id: 'noche', nombre: I18N.lang === 'en' ? 'Night' : 'Noche', emoji: '🌙', colores: ['#191420', '#f06a9b', '#262030'] },
    { id: 'menta', nombre: I18N.lang === 'en' ? 'Mint' : 'Menta', emoji: '🌿', colores: ['#f1faf5', '#2eb381', '#ffffff'] },
    { id: 'lavanda', nombre: I18N.lang === 'en' ? 'Lilac' : 'Lila', emoji: '💜', colores: ['#f5f2ff', '#8b6ef0', '#ffffff'] },
  ];
  const LS_TEMA = 'maya.tema.v1';

  function aplicarTema(id) {
    if (id) document.documentElement.dataset.tema = id;
    else delete document.documentElement.dataset.tema;
    if (typeof ajustarCharts === 'function') try { ajustarCharts(); } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = (TEMAS.find(t => t.id === id) || TEMAS[0]).colores[0];
  }

  function elegirTema(primeraVez) {
    if (primeraVez && !$('#sheet').classList.contains('hidden')) return; // no interrumpir
    const actual = localStorage.getItem(LS_TEMA) || '';
    abrirSheet(`
      <h2>${primeraVez ? '¿De qué color la quieren? 🎨' : 'Tema de color 🎨'}</h2>
      ${primeraVez ? '<p style="font-size:13px;color:var(--text-2);margin-bottom:12px">Cada teléfono puede tener el suyo, y se puede cambiar cuando quieran en Ajustes.</p>' : ''}
      <div class="temas-grid">
        ${TEMAS.map(t => `
          <button class="tema-opcion ${actual === t.id ? 'activo' : ''}" data-tema-op="${t.id}">
            <div class="bolitas">${t.colores.map(c => `<span style="background:${c}"></span>`).join('')}</div>
            ${t.emoji} ${t.nombre}
          </button>`).join('')}
      </div>
    `);
    document.querySelectorAll('[data-tema-op]').forEach(b => b.onclick = () => {
      const id = b.dataset.temaOp;
      localStorage.setItem(LS_TEMA, id);
      aplicarTema(id);
      cerrarSheet();
      const t = TEMAS.find(x => x.id === id);
      toast(`${t.emoji} Tema ${t.nombre} aplicado`);
    });
  }

  // colores de gráficas validados (accesibilidad CVD) por tema
  const PALETA_CHARTS = {
    claro: { pipi: '#3d8fe0', popo: '#a06a2c', linea: '#d94f84', texto: '#7d7185', rejilla: 'rgba(43,35,48,.07)' },
    noche: { pipi: '#4a97e8', popo: '#b8843c', linea: '#e4548c', texto: '#ab9db0', rejilla: 'rgba(255,255,255,.09)' },
  };
  function paletaCharts() {
    return document.documentElement.dataset.tema === 'noche' ? PALETA_CHARTS.noche : PALETA_CHARTS.claro;
  }
  function ajustarCharts() {
    if (typeof Chart === 'undefined') return;
    const p = paletaCharts();
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 11;
    Chart.defaults.color = p.texto;
    Chart.defaults.borderColor = p.rejilla;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(43,35,48,.92)';
    Chart.defaults.plugins.tooltip.cornerRadius = 10;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.legend.labels.boxWidth = 14;
    Chart.defaults.plugins.legend.labels.borderRadius = 4;
    Chart.defaults.plugins.legend.labels.useBorderRadius = true;
  }
  ajustarCharts();

  // aplicar el tema guardado desde el arranque (antes del login incluso)
  aplicarTema(localStorage.getItem(LS_TEMA) || '');

  /* ============================================================
     arranque
  ============================================================ */
  async function iniciarApp() {
    $('#login-screen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    Store.loadLocal();
    Store.onChange(render);
    render();

    clearInterval(tickInterval);
    tickInterval = setInterval(() => {
      const t = Store.getTimers();
      if (t.toma || t.sueno || t.actividad || t.vigilia || t.extraccion) renderTimers();
      // cuando el timer de la actividad llega a cero, se marca sola ✅
      if (t.actividad) {
        const fin = new Date(t.actividad.inicio).getTime() + t.actividad.min * 60000;
        if (Date.now() >= fin) terminarActividad(true);
      }
      // avisos de cambio de fase en métodos guiados
      if (t.extraccion && modoExt(t.extraccion.modo).fases) {
        const m = modoExt(t.extraccion.modo);
        const seg = Math.floor((Date.now() - new Date(t.extraccion.inicio)) / 1000);
        const fase = faseDe(t.extraccion.modo, seg);
        const idx = fase.fin ? m.fases.length : fase.i;
        if (idx !== (t.extraccion.faseAvisada || 0)) {
          t.extraccion.faseAvisada = idx;
          Store.setTimers(t);
          toast(fase.fin
            ? `${m.emoji} ¡${m.nombre} completo! Toca Terminar y registra tus ml 🏆`
            : `${m.emoji} ${fase.nombre} · ${fase.min} min`);
        }
      }
    }, 1000);

    cargarAvatar();

    // una sola vez por teléfono: ¿de quién es este dispositivo? (no en demo)
    if (!Store.getDispositivo() && !Store.modoDemo) {
      setTimeout(preguntarDispositivo, 600);
    }
    // primera vez en este teléfono: elegir tema de color (no en demo)
    if (localStorage.getItem(LS_TEMA) === null && !Store.modoDemo) {
      setTimeout(() => elegirTema(true), Store.getDispositivo() ? 700 : 1600);
    }
    // aviso de etapa nueva (cólicos, dientes…), uno por vez
    setTimeout(avisoEtapaNueva, 2600);
    // chequeo de bienestar de mamá (solo su teléfono, según calendario)
    if (Store.getDispositivo() === 'mama' && !Store.modoDemo) {
      setTimeout(() => { if (EPDS.tocaChequeo(edadDias())) invitarEPDS(); }, 4200);
    }

    if (Store.canSync()) {
      await Store.syncNow();
      render();
    }
  }

  function preguntarDispositivo() {
    // no interrumpir si ya tienen otra hoja abierta; se preguntará después
    if (!$('#sheet').classList.contains('hidden')) return;
    const b = Store.data.bebe;
    abrirSheet(`
      <h2>¿De quién es este teléfono? 📱</h2>
      <p style="font-size:14px;color:var(--text-2)">Así cada nota que escriban llevará una etiquetita
      de quién la escribió. Se pregunta una sola vez por teléfono (se puede cambiar en Ajustes).</p>
      <div class="dispositivo-botones">
        <button class="bg-pink" data-disp="mama"><span>👩</span>${esc(b.mama || 'Mamá')}</button>
        <button class="bg-blue" data-disp="papa"><span>👨</span>${esc(b.papa || 'Papá')}</button>
      </div>
    `);
    document.querySelectorAll('[data-disp]').forEach(btn => btn.onclick = () => {
      Store.setDispositivo(btn.dataset.disp);
      cerrarSheet();
      toast(I18N.lang === 'en' ? `${nombreQuien(btn.dataset.disp)}'s phone 💗` : `Teléfono de ${nombreQuien(btn.dataset.disp)} 💗`);
    });
  }

  /* ---------- avatar y actualizar con un toque ---------- */
  async function cargarAvatar() {
    const img = $('#header-avatar');
    img.classList.add('hidden');
    const propia = Store.data.bebe && Store.data.bebe.avatar;
    if (propia) { img.src = propia; img.classList.remove('hidden'); return; }
    const cache = Store.getAvatarCache();
    if (cache) { img.src = cache; img.classList.remove('hidden'); }
    const fresco = await Store.fetchAvatar();
    if (fresco) { img.src = fresco; img.classList.remove('hidden'); }
  }

  async function refrescar() {
    if (!Store.canSync()) { toast('Configura la sincronización en Ajustes'); return; }
    const img = $('#header-avatar');
    img.classList.add('girando');
    toast('Actualizando… 💗');
    await Store.syncNow();
    img.classList.remove('girando');
    toast(Store.syncState === 'ok' ? 'Al día ✅' : 'Sin conexión, se intentará después');
    render();
  }
  $('#header-refresh').addEventListener('click', refrescar);

  /* ---------- deslizar hacia abajo para actualizar ---------- */
  (() => {
    const ptr = $('#ptr');
    let inicioY = null, jalando = false;
    document.addEventListener('touchstart', e => {
      if (window.scrollY <= 0 && !$('#app').classList.contains('hidden')) {
        inicioY = e.touches[0].clientY;
        jalando = false;
      } else inicioY = null;
    }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (inicioY === null) return;
      const delta = e.touches[0].clientY - inicioY;
      if (delta > 70 && window.scrollY <= 0) {
        jalando = true;
        ptr.classList.add('visible');
      }
    }, { passive: true });
    document.addEventListener('touchend', async () => {
      if (jalando) {
        ptr.classList.add('girando');
        await refrescar();
        ptr.classList.remove('girando');
      }
      ptr.classList.remove('visible');
      inicioY = null;
      jalando = false;
    });
  })();

  function hojaCrearCuenta() {
    let rol = 'mama';
    abrirSheet(`
      <h2>Crear cuenta nueva ✨</h2>
      <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">Se crea una familia nueva con su propio bebé y registro completo. Los datos viven en este dispositivo; en Ajustes podrás conectar tu propia nube (repositorio privado de GitHub) para sincronizar con tu pareja.</p>
      <div class="form-group"><label>Tu correo</label>
        <input type="text" id="cc-email" inputmode="email" autocapitalize="none" placeholder="tu@correo.com">
      </div>
      <div class="form-group"><label>Contraseña (mínimo 8 caracteres)</label>
        <input type="password" id="cc-pass" placeholder="••••••••">
      </div>
      <div class="form-group"><label>Nombre de tu bebé</label>
        <input type="text" id="cc-bebe" placeholder="Nombre del bebé">
      </div>
      <div class="form-group"><label>Tú eres</label>
        <div class="quien-chips" id="cc-rol">
          <button type="button" class="activo" data-rol="mama">👩 Mamá</button>
          <button type="button" data-rol="papa">👨 Papá</button>
        </div>
      </div>
      <button class="btn-primary btn-block" id="cc-crear">Crear mi cuenta</button>
    `);
    $('#cc-rol').addEventListener('click', e => {
      const b = e.target.closest('[data-rol]');
      if (!b) return;
      rol = b.dataset.rol;
      $('#cc-rol').querySelectorAll('button').forEach(x => x.classList.toggle('activo', x === b));
    });
    $('#cc-crear').onclick = async () => {
      const email = $('#cc-email').value;
      const pass = $('#cc-pass').value;
      const bebe = $('#cc-bebe').value.trim();
      if (!bebe) { toast('Ponle nombre a tu bebé'); return; }
      const r = await Store.crearCuenta({ email, pass, quien: rol, nombreBebe: bebe });
      if (r.error) { toast(r.error); return; }
      // entrar DIRECTO a la familia recién creada (no por login(), que
      // podría chocar con una cuenta integrada y mandar a otra familia)
      Store.entrarAFamilia(r.familia, rol, email.trim().toLowerCase());
      cerrarSheet();
      $('#login-screen').classList.add('hidden');
      iniciarApp();
      confeti(90);
      celebracion('👶', I18N.lang === 'en' ? `Welcome ${bebe}!` : `¡Bienvenido ${bebe}!`, I18N.lang === 'en' ? 'Their journal is ready — time to fill it with memories' : 'Su registro está listo — a llenar de recuerdos');
    };
  }

  const btnCrear = $('#btn-crear-cuenta');
  if (btnCrear) btnCrear.onclick = hojaCrearCuenta;
  const btnDemo = $('#btn-ver-demo');
  if (btnDemo) btnDemo.onclick = () => { location.href = `${location.pathname}?demo=1`; };

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const ok = await Store.login($('#login-user').value, $('#login-pass').value);
    if (ok) iniciarApp();
    else {
      const err = $('#login-error');
      err.classList.remove('hidden');
      err.style.animation = 'none';
      requestAnimationFrame(() => err.style.animation = '');
    }
  });

  // service worker para que funcione sin internet y se pueda instalar
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  /* ---------- demo público (?demo=1): datos sintéticos, cero nube ---------- */
  function datosDemo() {
    const en = I18N.lang === 'en';
    const now = Date.now();
    const DIA = 86400000;
    const iso = ms => new Date(ms).toISOString();
    const nacimiento = new Date(now - 35 * DIA);
    const d = {
      version: 1,
      // hora 00:00 → la edad mostrada siempre cae en 35 días exactos, sin importar la hora del día
      bebe: { nombre: 'Emma', nacimiento: nacimiento.toISOString().slice(0, 10), hora: '00:00', mama: 'Ana', papa: 'Leo' },
      tomas: [], suenos: [], panales: [], condiciones: [], intervenciones: [], medicamentos: [],
      crecimiento: [], fotos: [], actividades: [], banco: [], citas: [], rutina: null, borrados: [],
    };
    let n = 0;
    const uid = () => 'demo' + (n++);
    for (let dia = 3; dia >= 0; dia--) {
      const base = now - dia * DIA;
      for (let t = 0; t < 7; t++) {
        const inicio = base - (21 - t * 3) * 3600000;
        if (inicio > now) continue;
        d.tomas.push(t % 3 === 2
          ? { id: uid(), tipo: 'donante', ml: 50 + (t % 2) * 15, lado: null, duracionSeg: null, inicio: iso(inicio), notas: '', autor: t % 2 ? 'mama' : 'papa', updatedAt: iso(inicio) }
          : { id: uid(), tipo: 'materno', ml: null, lado: t % 2 ? 'der' : 'izq', duracionSeg: 900 + (t % 3) * 240, inicio: iso(inicio), notas: '', autor: 'mama', updatedAt: iso(inicio) });
      }
      [20, 16, 12, 8, 4, 1].forEach((h, i) => {
        const hora = base - h * 3600000;
        if (hora > now) return;
        d.panales.push({ id: uid(), tipo: i % 3 === 0 ? 'popo' : i % 3 === 1 ? 'pipi' : 'mixto', hora: iso(hora), color: i % 3 === 0 ? 'mostaza' : null, consistencia: i % 3 === 0 ? 'grumitos' : null, notas: '', autor: i % 2 ? 'papa' : 'mama', updatedAt: iso(hora) });
      });
      [[22, 5.5], [13, 1.5], [9, 2]].forEach(([h, dur]) => {
        const ini = base - h * 3600000;
        if (ini + dur * 3600000 > now) return;
        d.suenos.push({ id: uid(), tipo: 'sueno', inicio: iso(ini), fin: iso(ini + dur * 3600000), notas: '', updatedAt: iso(ini) });
      });
      const ext = base - 10 * 3600000;
      if (ext < now) d.banco.push({ id: uid(), tipo: 'extraccion', lugar: dia % 2 ? 'refri' : 'congelador', ml: 70 + dia * 10, fecha: iso(ext), duracionSeg: 1080, modo: dia === 1 ? 'power' : 'normal', notas: '', updatedAt: iso(ext) });
    }
    d.banco.push({ id: uid(), tipo: 'consumo', lugar: 'refri', ml: 50, fecha: iso(now - 5 * 3600000), tomaId: d.tomas.find(t => t.tipo === 'donante').id, notas: '', updatedAt: iso(now) });
    d.crecimiento = [
      { id: uid(), fecha: nacimiento.toISOString(), pesoKg: 3.1, tallaCm: 50, perimetroCm: 34, updatedAt: iso(now) },
      { id: uid(), fecha: iso(now - 20 * DIA), pesoKg: 3.4, tallaCm: 52, perimetroCm: null, updatedAt: iso(now) },
      { id: uid(), fecha: iso(now - 5 * DIA), pesoKg: 4.0, tallaCm: 54, perimetroCm: 36, updatedAt: iso(now) },
    ];
    d.condiciones = [{
      id: uid(), nombre: en ? 'Jaundice' : 'Ictericia', unidad: 'mg/dL', curada: iso(now - 15 * DIA),
      mediciones: [
        { id: uid(), valor: 11, fecha: iso(now - 32 * DIA), nota: '' },
        { id: uid(), valor: 8, fecha: iso(now - 28 * DIA), nota: '' },
        { id: uid(), valor: 4, fecha: iso(now - 20 * DIA), nota: '' },
      ],
      info: null, updatedAt: iso(now),
    }];
    d.medicamentos = [{ id: uid(), nombre: en ? 'Vitamin D' : 'Vitamina D', dosis: '1 ml', frecuencia: en ? 'Once a day' : '1 vez al día', notas: '', activo: true, inicio: iso(now - 30 * DIA), updatedAt: iso(now) }];
    d.citas = [{ id: uid(), titulo: en ? '2-month check-up + vaccines' : 'Control de los 2 meses + vacunas', lugar: en ? 'Pediatric clinic' : 'Clínica pediátrica', fecha: iso(now + 6 * DIA), notas: en ? 'Bring health record' : 'Llevar cartilla', hecha: false, updatedAt: iso(now) }];
    d.rutina = { pasos: [
      { id: 'r1', emoji: '🛁', titulo: en ? 'Warm bath' : 'Baño tibio', min: 10 },
      { id: 'r2', emoji: '🍼', titulo: en ? 'Last feed with dim light' : 'Última toma con luz baja', min: 15 },
      { id: 'r3', emoji: '📖', titulo: en ? 'Quiet story' : 'Cuento bajito', min: 5 },
      { id: 'r4', emoji: '😴', titulo: en ? 'To the crib drowsy' : 'A la cuna somnolienta', min: 1 },
    ], hora: '20:00', updatedAt: iso(now) };
    return d;
  }

  /* ilustraciones sintéticas para el demo: carita y escenas dibujadas
     por la propia app con canvas — cero fotos reales, cero copyright */
  function ilustracionDemo(tipo) {
    const c = document.createElement('canvas');
    c.width = 480; c.height = 480;
    const x = c.getContext('2d');
    const fondos = { avatar: ['#ffe3ee', '#e9e2ff'], luna: ['#2b2a4a', '#4a3a6b'], osito: ['#fff2dd', '#ffdfc0'], globos: ['#e3f0ff', '#dff5ea'] };
    const g = x.createLinearGradient(0, 0, 480, 480);
    const [c1, c2] = fondos[tipo] || fondos.avatar;
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    x.fillStyle = g; x.fillRect(0, 0, 480, 480);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (tipo === 'avatar') {
      x.fillStyle = '#ffd9c4'; x.beginPath(); x.arc(240, 250, 130, 0, 7); x.fill();      // carita
      x.fillStyle = '#8a5a3b'; x.beginPath(); x.arc(240, 150, 70, Math.PI, 0); x.fill(); // pelito
      x.fillStyle = '#2b2330';
      x.beginPath(); x.arc(195, 235, 10, 0, 7); x.fill();
      x.beginPath(); x.arc(285, 235, 10, 0, 7); x.fill();                                 // ojitos
      x.strokeStyle = '#c0392b'; x.lineWidth = 8; x.lineCap = 'round';
      x.beginPath(); x.arc(240, 285, 28, .25 * Math.PI, .75 * Math.PI); x.stroke();       // sonrisa
      x.fillStyle = '#f5a9c0'; x.globalAlpha = .6;
      x.beginPath(); x.arc(175, 275, 16, 0, 7); x.fill();
      x.beginPath(); x.arc(305, 275, 16, 0, 7); x.fill();                                 // chapitas
      x.globalAlpha = 1;
    } else {
      const emoji = { luna: '🌙', osito: '🧸', globos: '🎈' }[tipo] || '💗';
      x.font = '200px serif'; x.fillText(emoji, 240, 250);
      x.font = '40px serif'; x.fillText('✨', 120, 120); x.fillText('✨', 370, 360);
    }
    return c.toDataURL('image/jpeg', 0.82);
  }

  const paramsURL = new URLSearchParams(location.search);
  const quiereLogin = paramsURL.has('login') || sessionStorage.getItem('maya.ir-login') === '1';
  sessionStorage.removeItem('maya.ir-login');
  const teniaSesionReal = Store.hasSession();
  if (paramsURL.has('demo') || (!teniaSesionReal && !quiereLogin)) {
    const seedDemo = datosDemo();
    // fotos reales libres de derechos para el demo; si el archivo no cargó,
    // se usan las ilustraciones de canvas como respaldo
    const DF = window.DEMO_FOTOS || {};
    seedDemo.bebe.avatar = DF.avatar || ilustracionDemo('avatar');
    const ahoraDemo = Date.now();
    seedDemo.fotos = [
      { id: 'demo-f1', fecha: new Date(ahoraDemo - 86400000).toISOString(), titulo: I18N.lang === 'en' ? 'Holding on tight 🤍' : 'Agarrada fuerte 🤍', archivo: '', dataUrl: DF.g1 || ilustracionDemo('luna'), sincronizada: true, semana: 4 },
      { id: 'demo-f2', fecha: new Date(ahoraDemo - 3 * 86400000).toISOString(), titulo: I18N.lang === 'en' ? 'Those little feet 👣' : 'Esos piecitos 👣', archivo: '', dataUrl: DF.g2 || ilustracionDemo('osito'), sincronizada: true },
      { id: 'demo-f3', fecha: new Date(ahoraDemo - 5 * 86400000).toISOString(), titulo: I18N.lang === 'en' ? 'Her first day 🏥' : 'Su primer día 🏥', archivo: '', dataUrl: DF.g3 || ilustracionDemo('globos'), sincronizada: true },
    ];
    Store.activarDemo(seedDemo);
    const listaDemo = document.createElement('button');
    listaDemo.className = 'demo-liston clickeable';
    listaDemo.innerHTML = (I18N.lang === 'en' ? '🧪 DEMO with synthetic data · <u>' + (teniaSesionReal ? 'back to my account' : 'sign in or create account') : '🧪 DEMO con datos sintéticos · <u>' + (teniaSesionReal ? 'volver a mi cuenta' : 'entrar o crear cuenta')) + '</u>';
    listaDemo.onclick = () => {
      if (!teniaSesionReal) {
        sessionStorage.setItem('maya.ir-login', '1');
        localStorage.removeItem('maya.session.v1');
      }
      location.href = location.pathname;
    };
    document.body.appendChild(listaDemo);
  }

  // enlace de configuración (#setup=...): deja lista la sincronización
  // con un solo toque, sin teclear el token en el celular
  try {
    const m = location.hash.match(/[#&]setup=([^&]+)/);
    if (m) {
      const cfg = JSON.parse(atob(decodeURIComponent(m[1])));
      Store.loadLocal();
      if (cfg.owner) Store.config.owner = cfg.owner;
      if (cfg.repo) Store.config.repo = cfg.repo;
      if (cfg.token) Store.config.token = cfg.token;
      Store.saveConfig();
      history.replaceState(null, '', location.pathname + location.search);
      toast('Sincronización configurada ✅');
    }
  } catch (e) { console.error('Enlace de configuración no válido', e); }

  if (Store.hasSession()) iniciarApp();
  else { const ls = $('#login-screen'); ls.classList.remove('hidden'); I18N.aplicar(ls); }
})();
