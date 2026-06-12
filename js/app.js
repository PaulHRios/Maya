/* ============ Maya — interfaz ============ */

(() => {
  const $ = sel => document.querySelector(sel);
  const main = $('#main');

  let tabActual = 'inicio';
  let vistaMas = null; // subvista dentro de "Más"
  let tickInterval = null;

  /* ---------- formato ---------- */
  const fmtHora = iso => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fmtFechaLarga = d => d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  function fmtDia(iso) {
    const d = new Date(iso), hoy = new Date();
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function hace(iso) {
    const min = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (min < 1) return 'ahora mismo';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h ${min % 60} min`;
    return `hace ${Math.floor(h / 24)} día(s)`;
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

  /* ---------- toast y hoja modal ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  function abrirSheet(html) {
    $('#sheet-content').innerHTML = html;
    $('#sheet').classList.remove('hidden');
    $('#sheet-backdrop').classList.remove('hidden');
  }
  function cerrarSheet() {
    $('#sheet').classList.add('hidden');
    $('#sheet-backdrop').classList.add('hidden');
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

    const nombreTipo = { materno: 'Leche materna', donante: 'Leche extraída', formula: 'Fórmula' };
    const descToma = t => {
      if (!t) return 'Aún sin registros';
      const partes = [nombreTipo[t.tipo]];
      if (t.lado) partes.push(t.lado === 'izq' ? 'izquierda' : 'derecha');
      if (t.duracionSeg) partes.push(`${Math.round(t.duracionSeg / 60)} min`);
      if (t.ml) partes.push(`${t.ml} ml`);
      return partes.join(' · ');
    };

    main.innerHTML = `
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
          <span class="stat-label">${mlHoy ? `${mlHoy} ml` : ''}${mlHoy && minPechoHoy ? ' · ' : ''}${minPechoHoy ? `${minPechoHoy} min pecho` : (mlHoy ? '' : 'hoy')}</span>
          <span class="stat-ago">${ultToma ? `última ${hace(ultToma.inicio)}` : ''}</span>
        </div>
        <div class="stat-card bg-yellow">
          <span class="stat-emoji">🧷</span>
          <span class="stat-value">${panalesHoy} pañal${panalesHoy === 1 ? '' : 'es'}</span>
          <span class="stat-label">gastados hoy</span>
          <span class="stat-ago">${ultPanal ? `último ${hace(ultPanal.hora)}` : ''}</span>
        </div>
        <div class="stat-card bg-blue">
          <span class="stat-emoji">💧</span>
          <span class="stat-value">${pipiHoy} pipí</span>
          <span class="stat-label">hoy</span>
        </div>
        <div class="stat-card bg-mint">
          <span class="stat-emoji">💩</span>
          <span class="stat-value">${popoHoy} popó</span>
          <span class="stat-label">hoy</span>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <h2>Última toma</h2>
        <div class="card-row">
          <div>
            <div style="font-weight:700">${descToma(ultToma)}</div>
            ${ultToma ? `<div style="font-size:13px;color:var(--text-2);margin-top:2px">${fmtDia(ultToma.inicio)} a las ${fmtHora(ultToma.inicio)} · ${hace(ultToma.inicio)}</div>` : ''}
          </div>
        </div>
      </div>
      ${condicionesResumen()}
    `;
  }

  function condicionesResumen() {
    const conds = Store.data.condiciones;
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
    const nombreTipo = { materno: 'Materna', donante: 'Extraída', formula: 'Fórmula' };

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
      panel = `<button class="btn-primary btn-block" data-accion="biberon-tipo">＋ Registrar ${tipoComida === 'donante' ? 'leche extraída' : 'fórmula'}</button>`;
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
            <div class="entry-title">${nombreTipo[t.tipo]}${t.lado ? ` · ${t.lado === 'izq' ? 'izquierda' : 'derecha'}` : ''}</div>
            <div class="entry-sub">${[t.duracionSeg ? `${Math.round(t.duracionSeg / 60)} min` : '', t.ml ? `${t.ml} ml` : '', t.notas ? esc(t.notas) : ''].filter(Boolean).join(' · ') || '—'}</div>
          </div>
          <span class="entry-time">${fmtHora(t.inicio)}</span>
          ${btnsEntrada('tomas', t.id)}
        </div>
      `, { emoji: '🍼', texto: 'Aquí aparecerán las tomas de Maya' })}
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
      <h2>${existente ? 'Editar toma' : tipo === 'donante' ? 'Leche extraída 🥛' : tipo === 'formula' ? 'Fórmula 🍼' : 'Toma de pecho 🤱'}</h2>
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
      if (existente) Store.update('tomas', existente.id, registro);
      else Store.add('tomas', registro);
      cerrarSheet();
      toast(existente ? 'Toma actualizada' : 'Toma guardada 🍼');
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
    toast(`Timer iniciado · pecho ${lado === 'izq' ? 'izquierdo' : 'derecho'} ▶`);
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
    toast(`Toma guardada · ${fmtDur(dur)} 🤱`);
  }

  /* ============================================================
     SUEÑO Y VIGILIA
  ============================================================ */
  const esVigilia = s => s.tipo === 'vigilia';

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
            <div class="entry-sub">${fmtHora(s.inicio)} → ${fmtHora(s.fin)}${s.quien ? ` · ${esc(nombreQuien(s.quien))}` : ''}${s.notas ? ` · ${esc(s.notas)}` : ''}</div>
            ${bit.length ? `<div class="entry-bitacora">${bit.map(n => `<div><b>${fmtHora(n.hora)}</b> ${esc(n.texto)}${etiquetaAutor(n)}</div>`).join('')}</div>` : ''}
          </div>
          ${btnsEntrada('suenos', s.id)}
        </div>`;
      }, { emoji: '🌙', texto: 'Aquí aparecerán los sueños y vigilias de Maya' })}
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
      <div class="form-group"><label>Inicio</label>
        <input type="datetime-local" id="f-inicio" value="${aInputLocal(existente ? existente.inicio : null)}">
      </div>
      <div class="form-group"><label>Fin</label>
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

  function avisoColor(colorId) {
    if (colorId === 'rojo' || colorId === 'gris') {
      setTimeout(() => toast('💡 Ese color vale la pena comentarlo al pediatra'), 1300);
    }
  }

  function renderPanal() {
    const grupos = porDia(Store.data.panales, 'hora');
    const nombre = { pipi: 'Pipí', popo: 'Popó', mixto: 'Pipí + Popó' };
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
            <div class="entry-title">${nombre[p.tipo] || p.tipo}${col ? ` <span class="color-dot" style="background:${col.hex}"></span>` : ''}</div>
            ${col || cons || p.notas ? `<div class="entry-sub">${[col && col.nombre, cons && cons.nombre.toLowerCase(), p.notas && esc(p.notas)].filter(Boolean).join(' · ')}</div>` : ''}
          </div>
          ${p.fotoId ? `<img class="entry-thumb" data-foto-panal="${p.fotoId}" alt="">` : ''}
          <span class="entry-time">${fmtHora(p.hora)}</span>
          ${btnsEntrada('panales', p.id)}
        </div>`;
      }, { emoji: '💧', texto: 'Aquí aparecerán los cambios de pañal' })}
    `;

    main.querySelectorAll('[data-foto-panal]').forEach(async img => {
      const f = Store.data.fotos.find(x => x.id === img.dataset.fotoPanal);
      if (!f) { img.remove(); return; }
      const p = Store.data.panales.find(x => x.fotoId === f.id);
      const src = f.dataUrl || await Store.fetchPhoto(f);
      if (src) { img.src = src; img.onclick = () => hojaAnalisisPanal(p); }
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
      <h2>${tipo === 'mixto' ? 'Pipí + Popó 🌊' : 'Popó 💩'}</h2>
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
          titulo: `Pañal ${new Date().toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
          archivo: `${new Date().toISOString().slice(0, 10)}-${fotoId}.jpg`,
          dataUrl: fotoPend, sincronizada: false, categoria: 'panal',
        });
      }
      Store.add('panales', { tipo, hora: new Date().toISOString(), color: colorEf, consistencia: consEf, notas: '', fotoId });
      cerrarSheet();
      toast(`${tipo === 'mixto' ? 'Pañal completo 🌊' : 'Popó 💩'} registrado${fotoPend ? ' con foto 📸' : ''}`);
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
      if (!confirm('¿Borrar la foto? El registro del pañal se conserva.')) return;
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
    return Actividades.tareasDeHoy(dias, Store.data.condiciones, fechaLocal());
  }

  function renderRetos() {
    const info = tareasHoy();
    if (!info) {
      main.innerHTML = `
        <h2 class="section-title">Retos del día 🏆</h2>
        <div class="empty-state"><span class="big">🎂</span>
          Para sugerirle actividades a su medida, pon la fecha de nacimiento de Maya en
          <b>Más → Ajustes</b>.</div>`;
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
          <div class="hero-sub">Etapa: ${info.etapa.nombre} · semana ${sem} de vida</div>
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
            ${t.porCondicion ? `<span class="t-cond">por ${esc(t.porCondicion)}</span><br>` : ''}
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
    toast(`${t.emoji} ¡${t.titulo} lista!`);
    // ¿día perfecto?
    setTimeout(() => {
      const info = tareasHoy();
      const hoy = fechaLocal();
      const todas = info.tareas.every(x => Store.data.actividades.some(a => a.fecha === hoy && a.tarea === x.key && a.hecha));
      if (todas) {
        confeti(120);
        celebracion('🌟', '¡Día perfecto!', `Completaron todos los retos de hoy con ${Store.data.bebe.nombre || 'Maya'}`);
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
     MÁS (menú y subvistas)
  ============================================================ */
  function renderMas() {
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
        ${item('salud', '🩺', 'bg-pink', 'Condiciones médicas', d.condiciones.length ? d.condiciones.map(c => c.nombre).join(', ') : 'Ictericia, seguimiento de labs…')}
        ${item('intervenciones', '💉', 'bg-peach', 'Intervenciones', d.intervenciones.length ? `${d.intervenciones.length} registradas` : 'Toma de sangre, vacunas, estudios…')}
        ${item('medicamentos', '💊', 'bg-mint', 'Medicamentos', d.medicamentos.filter(m => m.activo).length ? `${d.medicamentos.filter(m => m.activo).length} activos` : 'Tratamientos y vitaminas')}
        ${item('crecimiento', '📏', 'bg-blue', 'Crecimiento', d.crecimiento.length ? 'Peso, talla y perímetro' : 'Registra peso y talla')}
        ${item('fotos', '📸', 'bg-lav', 'Fotos', d.fotos.length ? `${d.fotos.length} recuerdos` : 'Momentos especiales')}
        ${item('resumen', '📄', 'bg-yellow', 'Resumen PDF', 'Descarga un reporte con gráficas')}
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
    const conds = Store.data.condiciones;
    main.innerHTML = `
      ${volverMas}
      <h2 class="section-title">Condiciones médicas 🩺</h2>
      <button class="btn-primary btn-block" id="btn-nueva-cond">＋ Agregar condición</button>
      <div id="conds" style="margin-top:14px">
        ${conds.length ? '' : '<div class="empty-state"><span class="big">🩺</span>Registra una condición (por ejemplo, ictericia) y la app buscará información y cuidados sugeridos.</div>'}
      </div>
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
            <button class="btn-ghost" data-borrar-cond="${c.id}" style="color:var(--danger)">🗑️</button>
          </div>
        </div>
        ${meds.length >= 2 && meds.filter(m => m.valor !== null && m.valor !== '').length >= 2 ? `<canvas class="chart" id="chart-${c.id}" height="170"></canvas>` : ''}
        ${meds.map(m => `
          <div class="measure-row">
            <span>${new Date(m.fecha).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${m.nota ? ` · <small>${esc(m.nota)}</small>` : ''}</span>
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
            labels: datos.map(m => new Date(m.fecha).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
            datasets: [{
              label: `${c.nombre}${c.unidad ? ` (${c.unidad})` : ''}`,
              data: datos.map(m => Number(m.valor)),
              borderColor: '#f06a9b', backgroundColor: '#f06a9b22',
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
    cont.querySelectorAll('[data-borrar-cond]').forEach(b => b.onclick = () => {
      if (confirm('¿Borrar esta condición y todas sus mediciones?')) {
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
      <h2>${m ? 'Editar' : 'Nueva'} medición · ${esc(c.nombre)}</h2>
      <div class="form-group"><label>Valor ${c.unidad ? `(${esc(c.unidad)})` : ''} — déjalo vacío si aún esperan el resultado</label>
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
      <h2>${existente ? 'Editar' : 'Nueva'} intervención 💉</h2>
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
          </div>`).join('') || '<div class="empty-state"><span class="big">💊</span>Vitaminas, tratamientos y medicamentos de Maya</div>'}
      </div>
    `;
    bindVolver();
    $('#btn-nuevo-med').onclick = () => hojaMedicamento();
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
              <div class="entry-sub">${new Date(c.fecha).toLocaleDateString('es-MX', { dateStyle: 'long' })}</div>
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
          labels: datos.map(c => new Date(c.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })),
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
        ${fotos.map(f => `<img data-foto="${f.id}" alt="${esc(f.titulo || 'Foto de Maya')}" loading="lazy">`).join('') ||
          '<div class="empty-state" style="grid-column:1/-1"><span class="big">📸</span>Guarda fotos de momentos especiales o de cosas que quieras enseñarle al pediatra</div>'}
      </div>
    `;
    bindVolver();
    $('#btn-camara').onclick = () => $('#foto-input').click();
    $('#btn-galeria').onclick = () => $('#foto-galeria').click();
    $('#foto-input').onchange = e => procesarFoto(e.target.files[0]);
    $('#foto-galeria').onchange = e => procesarFoto(e.target.files[0]);

    fotos.forEach(async f => {
      const img = main.querySelector(`[data-foto="${f.id}"]`);
      if (!img) return;
      const src = f.dataUrl || await Store.fetchPhoto(f);
      if (src) img.src = src;
      img.onclick = () => verFoto(f);
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
    const titulo = semana != null ? `Semana ${semana} 💗` : (prompt('Título de la foto (opcional):') || '');
    const id = Store.uid();
    Store.add('fotos', {
      id, fecha: new Date().toISOString(), titulo,
      archivo: `${new Date().toISOString().slice(0, 10)}-${id}.jpg`,
      dataUrl, sincronizada: false,
      ...(semana != null ? { semana } : {}),
    });
    if (semana != null) {
      confeti(80);
      celebracion('📸', `¡Foto de la semana ${semana}!`, 'Su colección de recuerdos va creciendo');
    } else {
      toast('Foto guardada 📸');
    }
  }

  function pedirFotoSemanal(semana) {
    abrirSheet(`
      <h2>Foto de la semana ${semana} 📸</h2>
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
      <div class="pv-caption">${esc(f.titulo || '')}<br><small>${new Date(f.fecha).toLocaleString('es-MX')}</small></div>
      <div class="pv-actions">
        <button class="btn-danger" id="pv-del">Borrar</button>
        <button class="btn-secondary" id="pv-close">Cerrar</button>
      </div>
    `;
    document.body.appendChild(div);
    div.querySelector('#pv-close').onclick = () => div.remove();
    div.querySelector('#pv-del').onclick = () => {
      if (confirm('¿Borrar esta foto del registro?')) {
        Store.remove('fotos', f.id);
        div.remove();
        toast('Foto borrada');
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
            <input type="text" id="a-mama" value="${esc(d.bebe.mama || '')}" placeholder="Rubi">
          </div>
          <div class="form-group"><label>Papá</label>
            <input type="text" id="a-papa" value="${esc(d.bebe.papa || '')}" placeholder="Paul">
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
      </div>

      <div class="card">
        <h2>☁️ Sincronización con GitHub</h2>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">
          Para que los dos celulares vean los mismos datos, la app los guarda en un
          repositorio de GitHub. <b>Usa un repositorio PRIVADO</b> para que los datos
          de la bebé no sean públicos.
        </p>
        <div class="form-row">
          <div class="form-group"><label>Usuario u organización</label>
            <input type="text" id="a-owner" value="${esc(cfg.owner)}" placeholder="PaulHRios" autocapitalize="none">
          </div>
          <div class="form-group"><label>Repositorio</label>
            <input type="text" id="a-repo" value="${esc(cfg.repo)}" placeholder="maya_datos" autocapitalize="none">
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
          ${cfg.lastSync ? `Última sincronización: ${new Date(cfg.lastSync).toLocaleString('es-MX')}` : 'Aún no se ha sincronizado.'}
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
      </div>

      <button class="btn-danger btn-block" id="a-logout">Cerrar sesión</button>
    `;
    bindVolver();

    $('#a-guardar-bebe').onclick = () => {
      d.bebe.nombre = $('#a-nombre').value.trim() || 'Maya';
      d.bebe.nacimiento = $('#a-nac').value;
      d.bebe.hora = $('#a-hora-nac').value;
      d.bebe.mama = $('#a-mama').value.trim();
      d.bebe.papa = $('#a-papa').value.trim();
      d.bebe.actualizado = new Date().toISOString();
      Store.setDispositivo($('#a-dispositivo').value);
      Store.saveLocal();
      toast('Guardado 💗');
      actualizarHeader();
    };

    const leerCfg = () => {
      Store.config.owner = $('#a-owner').value.trim();
      Store.config.repo = $('#a-repo').value.trim();
      Store.config.token = $('#a-token').value.trim();
      Store.config.autoSync = $('#a-autosync').checked;
      Store.saveConfig();
    };
    $('#a-probar').onclick = async () => {
      leerCfg();
      if (!Store.canSync()) { toast('Llena usuario, repo y token'); return; }
      toast(await Store.testConnection() ? 'Conexión exitosa ✅' : 'No se pudo conectar ❌');
    };
    $('#a-sync').onclick = async () => {
      leerCfg();
      if (!Store.canSync()) { toast('Llena usuario, repo y token'); return; }
      toast('Sincronizando…');
      await Store.syncNow();
      toast(Store.syncState === 'ok' ? 'Sincronizado ✅' : 'Error al sincronizar ❌');
      render();
    };

    $('#a-exportar').onclick = () => {
      const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `respaldo-maya-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    };
    $('#a-importar').onclick = () => $('#a-archivo').click();
    $('#a-archivo').onchange = e => {
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

    $('#a-logout').onclick = () => {
      Store.logout();
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
          <div class="timer-info">🤱 ${timers.toma.lado === 'izq' ? 'Izquierda' : 'Derecha'}${enPausa ? ' · en pausa' : ''}
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
      if (a === 'toma-cancelar') { if (confirm('¿Cancelar la toma sin guardar?')) terminarToma(true); }
      if (a === 'toma-manual') hojaBiberon('materno');
      if (a === 'biberon') hojaTipoBiberon();
      if (a === 'biberon-tipo') hojaBiberon(tipoComida);
      if (a === 'dormir') iniciarSueno();
      if (a === 'sueno-terminar') terminarSueno(false);
      if (a === 'sueno-cancelar') { if (confirm('¿Cancelar sin guardar?')) terminarSueno(true); }
      if (a === 'sueno-manual') hojaSuenoManual();
      if (a === 'vigilia') iniciarVigilia();
      if (a === 'vigilia-terminar') terminarVigilia(false);
      if (a === 'vigilia-cancelar') { if (confirm('¿Cancelar sin guardar?')) terminarVigilia(true); }
      if (a === 'vigilia-nota') hojaNotaVigilia();
      if (a === 'panal-pipi') registrarPanal('pipi');
      if (a === 'panal-popo') registrarPanal('popo');
      if (a === 'panal-mixto') registrarPanal('mixto');
      if (a === 'panal-manual') hojaPanal(null);
      if (a === 'act-terminar') terminarActividad(true);
      if (a === 'act-cancelar') { if (confirm('¿Cancelar la actividad sin marcarla?')) terminarActividad(false); }
      if (a === 'foto-semanal') pedirFotoSemanal(Number(btn.dataset.sem));
      return;
    }

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
      return;
    }

    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      const [col, id] = delBtn.dataset.del.split(':');
      if (confirm('¿Borrar este registro?')) {
        if (col === 'panales') {
          const p = Store.data.panales.find(x => x.id === id);
          if (p && p.fotoId) Store.remove('fotos', p.fotoId); // su foto se va con él
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

  $('#btn-settings').onclick = () => {
    tabActual = 'mas';
    vistaMas = 'ajustes';
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'mas'));
    render();
  };

  function actualizarHeader() {
    const d = Store.data;
    $('#header-title').textContent = d.bebe.nombre || 'Maya';
    let sub = fmtFechaLarga(new Date());
    if (d.bebe.nacimiento) {
      const dias = Math.floor((Date.now() - new Date(`${d.bebe.nacimiento}T${d.bebe.hora || '00:00'}`)) / 86400000);
      sub += dias < 60 ? ` · ${dias} días de vida 💗` : ` · ${Math.floor(dias / 7)} semanas 💗`;
    }
    $('#header-sub').textContent = sub;
  }

  function render() {
    renderTimers();
    actualizarHeader();
    $('#sync-dot').className = `sync-dot ${Store.syncState !== 'off' ? Store.syncState : ''}`;
    if (tabActual === 'inicio') renderInicio();
    else if (tabActual === 'comida') renderComida();
    else if (tabActual === 'sueno') renderSueno();
    else if (tabActual === 'panal') renderPanal();
    else if (tabActual === 'retos') renderRetos();
    else renderMas();
  }

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
      if (t.toma || t.sueno || t.actividad || t.vigilia) renderTimers();
      // cuando el timer de la actividad llega a cero, se marca sola ✅
      if (t.actividad) {
        const fin = new Date(t.actividad.inicio).getTime() + t.actividad.min * 60000;
        if (Date.now() >= fin) terminarActividad(true);
      }
    }, 1000);

    cargarAvatar();

    // una sola vez por teléfono: ¿de quién es este dispositivo?
    if (!Store.getDispositivo()) {
      setTimeout(preguntarDispositivo, 600);
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
      toast(`Teléfono de ${nombreQuien(btn.dataset.disp)} 💗`);
    });
  }

  /* ---------- avatar y actualizar con un toque ---------- */
  async function cargarAvatar() {
    const img = $('#header-avatar');
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
  else $('#login-screen').classList.remove('hidden');
})();
