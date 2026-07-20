/* ============ Maya — análisis general del bebé ============
   Motor local y privado (nada sale del teléfono). Combina normas de
   pediatría para recién nacidos con la comparación del bebé contra su
   propia línea base de los días anteriores. Inspirado en el motor de
   insights de la revisión Build Week, reconstruido y ampliado. */

const Analisis = (() => {

  const DIA = 86400000;

  function enVentana(items, campo, horas) {
    const desde = Date.now() - horas * 3600000;
    return items.filter(x => x[campo] && new Date(x[campo]).getTime() >= desde);
  }

  /* línea base propia: promedio diario de los días -4 a -2 (3 días completos) */
  function lineaBase(items, campo, valorFn) {
    const fin = Date.now() - DIA;         // ayer hacia atrás
    const inicio = fin - 3 * DIA;
    const enRango = items.filter(x => {
      const t = x[campo] ? new Date(x[campo]).getTime() : 0;
      return t >= inicio && t < fin;
    });
    if (!enRango.length) return null;
    return enRango.reduce((s, x) => s + valorFn(x), 0) / 3;
  }

  /* genera el reporte: { estado, hallazgos:[{nivel, emoji, titulo, texto, dato}], confianza } */
  function generar(data, edadDias) {
    const en = typeof I18N !== 'undefined' && I18N.lang === 'en';
    const h = [];
    const hoy24 = 24;

    /* ---- hidratación: pañales de pipí en 24 h ---- */
    const pipi24 = enVentana(data.panales, 'hora', hoy24)
      .filter(p => p.tipo === 'pipi' || p.tipo === 'mixto').length;
    if (edadDias !== null && edadDias >= 5) {
      if (pipi24 >= 6) h.push({ nivel: 'bien', emoji: '💧', titulo: en ? 'Hydration on track' : 'Hidratación en orden', texto: en ? `${pipi24} wet diapers in 24 h — a sign she's eating and drinking enough.` : `${pipi24} pañales con pipí en 24 h — señal de que está comiendo y tomando suficiente.`, dato: en ? 'expected: 6+ per day from day 5' : 'esperado: 6 o más al día desde el día 5' });
      else if (pipi24 >= 4) h.push({ nivel: 'observar', emoji: '💧', titulo: en ? 'Pee running a bit low' : 'Pipí un poco baja', texto: en ? `${pipi24} wet diapers in 24 h. Worth watching the next few hours and offering frequent feeds.` : `${pipi24} pañales con pipí en 24 h. Vale la pena vigilar las próximas horas y ofrecer tomas frecuentes.`, dato: en ? 'expected: 6+ per day' : 'esperado: 6+ al día' });
      else h.push({ nivel: 'atencion', emoji: '💧', titulo: en ? 'Few wet diapers' : 'Pocos pañales mojados', texto: en ? `Only ${pipi24} in 24 h. If she's also drowsy or feeding little, call the pediatrician today.` : `Solo ${pipi24} en 24 h. Si además está adormilada o come poco, coméntenlo hoy mismo con el pediatra.`, dato: en ? 'under 4 a day warrants a call' : 'menos de 4 al día amerita consulta' });
    }

    /* ---- popó: frecuencia y colores de alerta ---- */
    const popo72 = enVentana(data.panales, 'hora', 72).filter(p => p.tipo === 'popo' || p.tipo === 'mixto');
    const horasSinPopo = (() => {
      const ult = data.panales.filter(p => p.tipo === 'popo' || p.tipo === 'mixto')
        .sort((a, b) => b.hora.localeCompare(a.hora))[0];
      return ult ? Math.floor((Date.now() - new Date(ult.hora)) / 3600000) : null;
    })();
    if (horasSinPopo !== null) {
      if (edadDias !== null && edadDias <= 42 && horasSinPopo >= 48) {
        h.push({ nivel: 'observar', emoji: '💩', titulo: en ? `${Math.floor(horasSinPopo / 24)} days without poop` : `${Math.floor(horasSinPopo / 24)} días sin popó`, texto: en ? 'In the first month there is usually poop almost daily. If it goes past 3 days, she seems uncomfortable or her belly is firm, check with the doctor.' : 'En el primer mes suele haber popó casi a diario. Si pasa de 3 días, se ve incómoda o el abdomen está duro, consúltenlo.', dato: en ? 'breastfed babies >6 weeks can space out days' : 'lactancia materna >6 semanas sí puede espaciar días' });
      } else if (horasSinPopo < 48) {
        h.push({ nivel: 'bien', emoji: '💩', titulo: en ? 'Poop on schedule' : 'Popó al corriente', texto: en ? `Last one ${horasSinPopo < 1 ? 'under an hour ago' : horasSinPopo + ' h ago'}${popo72.length ? `, ${popo72.length} in 3 days` : ''}.` : `Última hace ${horasSinPopo < 1 ? 'menos de una hora' : horasSinPopo + ' h'}${popo72.length ? `, ${popo72.length} en 3 días` : ''}.` });
      }
    }
    const colorAlerta = enVentana(data.panales, 'hora', 72).find(p => p.color === 'rojo' || p.color === 'gris');
    if (colorAlerta) h.push({ nivel: 'atencion', emoji: '🎨', titulo: en ? `${colorAlerta.color === 'rojo' ? 'Reddish' : 'White/gray'} stool logged` : `Popó ${colorAlerta.color === 'rojo' ? 'rojiza' : 'blanca/gris'} registrada`, texto: en ? 'That color deserves a prompt mention to the pediatrician (bring the photo if you saved it).' : 'Ese color amerita comentarlo con el pediatra pronto (llévenle la foto si la guardaron).' });

    /* ---- alimentación: frecuencia, hueco máximo y volumen vs su línea base ---- */
    const tomas24 = enVentana(data.tomas, 'inicio', hoy24);
    if (tomas24.length) {
      if (edadDias !== null && edadDias <= 60) {
        if (tomas24.length >= 8) h.push({ nivel: 'bien', emoji: '🍼', titulo: en ? 'Feeding at a great pace' : 'Comiendo con buena frecuencia', texto: en ? `${tomas24.length} feeds in 24 h.` : `${tomas24.length} tomas en 24 h.`, dato: en ? 'expected: 8–12 in the first two months' : 'esperado: 8–12 en los primeros dos meses' });
        else if (tomas24.length >= 6) h.push({ nivel: 'observar', emoji: '🍼', titulo: en ? 'Feeds a bit sparse' : 'Frecuencia de tomas justa', texto: en ? `${tomas24.length} feeds in 24 h; try to get closer to 8, waking her from long day naps if needed.` : `${tomas24.length} tomas en 24 h; intenten acercarse a 8, despertándola si duerme de más de día.`, dato: en ? 'expected: 8–12' : 'esperado: 8–12' });
        else h.push({ nivel: 'atencion', emoji: '🍼', titulo: en ? 'Few feeds logged' : 'Pocas tomas registradas', texto: en ? `${tomas24.length} in 24 h. If she truly ate that little (and it's not just missed logging), mention it to the pediatrician.` : `${tomas24.length} en 24 h. Si de verdad comió tan poco (y no es falta de registro), coméntenlo con el pediatra.` });
      }
      const orden = [...tomas24].sort((a, b) => a.inicio.localeCompare(b.inicio));
      let hueco = 0;
      for (let i = 1; i < orden.length; i++) hueco = Math.max(hueco, new Date(orden[i].inicio) - new Date(orden[i - 1].inicio));
      hueco = Math.max(hueco, Date.now() - new Date(orden[orden.length - 1].inicio));
      const huecoH = Math.round(hueco / 360000) / 10;
      if (edadDias !== null && edadDias <= 30 && huecoH >= 5) {
        h.push({ nivel: 'observar', emoji: '⏰', titulo: en ? `${huecoH} h gap between feeds` : `Hueco de ${huecoH} h entre tomas`, texto: en ? 'In the first month it is best not to go past ~4 hours without eating, even waking her.' : 'En el primer mes conviene no pasar de ~4 horas sin comer, incluso despertándola.' });
      }
    }
    const mlBase = lineaBase(data.tomas, 'inicio', t => Number(t.ml) || 0);
    const ml24 = tomas24.reduce((s, t) => s + (Number(t.ml) || 0), 0);
    if (mlBase && mlBase > 30) {
      const cambio = Math.round(((ml24 - mlBase) / mlBase) * 100);
      if (cambio <= -30) h.push({ nivel: 'observar', emoji: '📉', titulo: en ? `Bottles ${Math.abs(cambio)}% below her rhythm` : `Biberones ${Math.abs(cambio)}% abajo de su ritmo`, texto: en ? `${ml24} ml today vs ~${Math.round(mlBase)} ml daily from her own week. Could be a slow day or missed logging — watch the next feed.` : `${ml24} ml hoy contra ~${Math.round(mlBase)} ml diarios de su propia semana. Puede ser un día flojo o falta de registro — vigilen la siguiente toma.`, dato: en ? 'vs her own 3-day baseline' : 'comparado con su línea base de 3 días' });
      else if (cambio >= 30) h.push({ nivel: 'bien', emoji: '📈', titulo: en ? `Eating ${cambio}% above her rhythm` : `Comiendo ${cambio}% más que su ritmo`, texto: en ? `${ml24} ml today vs ~${Math.round(mlBase)} ml. Growth spurts look exactly like this.` : `${ml24} ml hoy vs ~${Math.round(mlBase)} ml. Los brotes de crecimiento se ven así.` });
    }

    /* ---- peso ---- */
    const pesos = [...data.crecimiento].filter(c => c.pesoKg).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (pesos.length >= 2) {
      const a = pesos[pesos.length - 2], b = pesos[pesos.length - 1];
      const dias = Math.max(1, Math.round((new Date(b.fecha) - new Date(a.fecha)) / DIA));
      const gxd = Math.round(((b.pesoKg - a.pesoKg) * 1000) / dias);
      if (gxd >= 20) h.push({ nivel: 'bien', emoji: '⚖️', titulo: en ? `Gaining ~${gxd} g per day` : `Subiendo ~${gxd} g por día`, texto: en ? `From ${a.pesoKg} to ${b.pesoKg} kg. Excellent pace.` : `De ${a.pesoKg} a ${b.pesoKg} kg. Excelente ritmo.`, dato: en ? 'expected: 20–40 g/day after the first week' : 'esperado: 20–40 g/día tras la primera semana' });
      else if (gxd >= 0) h.push({ nivel: 'observar', emoji: '⚖️', titulo: en ? `Gaining slowly (~${gxd} g/day)` : `Subiendo despacio (~${gxd} g/día)`, texto: en ? 'Have the pediatrician confirm the pace at the next visit; log every weigh-in here.' : 'Que el pediatra confirme el ritmo en la próxima consulta; registren cada pesada aquí.' });
      else h.push({ nivel: 'atencion', emoji: '⚖️', titulo: en ? 'Weight dropped between weigh-ins' : 'El peso bajó entre medidas', texto: en ? `From ${a.pesoKg} to ${b.pesoKg} kg. After the first week weight should be climbing — bring it up with the pediatrician.` : `De ${a.pesoKg} a ${b.pesoKg} kg. Después de la primera semana el peso debería subir — coméntenlo con el pediatra.` });
      const nac = pesos[0];
      if (edadDias !== null && edadDias >= 14 && b.pesoKg < nac.pesoKg) {
        h.push({ nivel: 'atencion', emoji: '⚖️', titulo: en ? 'Not back to birth weight yet' : 'Aún no recupera el peso de nacimiento', texto: en ? 'Most babies are back by day 14; worth a pediatric check.' : 'A los 14 días la mayoría ya lo recuperó; amerita revisión del pediatra.' });
      }
    }

    /* ---- condiciones: resultados pendientes y mediciones al alza ---- */
    for (const c of (data.condiciones || []).filter(x => !x.curada)) {
      const meds = [...(c.mediciones || [])].sort((a, b) => a.fecha.localeCompare(b.fecha));
      const pendiente = meds.find(m => m.valor === null || m.valor === '');
      if (pendiente) {
        const hrs = Math.floor((Date.now() - new Date(pendiente.fecha)) / 3600000);
        h.push({ nivel: 'observar', emoji: '🧪', titulo: en ? `${c.nombre}: result pending` : `${c.nombre}: resultado pendiente`, texto: en ? `Sample taken ${hrs < 24 ? hrs + ' h' : Math.floor(hrs / 24) + ' day(s)'} ago. Log it as soon as it arrives to see the trend.` : `La muestra fue hace ${hrs < 24 ? hrs + ' h' : Math.floor(hrs / 24) + ' día(s)'}. En cuanto llegue, captúrenlo para ver la tendencia.` });
      }
      const conValor = meds.filter(m => m.valor !== null && m.valor !== '');
      if (conValor.length >= 2) {
        const ult = conValor[conValor.length - 1], prev = conValor[conValor.length - 2];
        if (Number(ult.valor) > Number(prev.valor)) h.push({ nivel: 'observar', emoji: '🩺', titulo: en ? `${c.nombre} trending up` : `${c.nombre} al alza`, texto: en ? `Latest reading ${ult.valor}${c.unidad ? ' ' + c.unidad : ''} (was ${prev.valor}). Keep the follow-ups your pediatrician set.` : `Última medición ${ult.valor}${c.unidad ? ' ' + c.unidad : ''} (antes ${prev.valor}). Sigan los controles que indique el pediatra.` });
        else h.push({ nivel: 'bien', emoji: '🩺', titulo: en ? `${c.nombre} coming down` : `${c.nombre} bajando`, texto: en ? `From ${prev.valor} to ${ult.valor}${c.unidad ? ' ' + c.unidad : ''} — a good sign.` : `De ${prev.valor} a ${ult.valor}${c.unidad ? ' ' + c.unidad : ''} — buena señal.` });
      }
    }

    /* ---- sueño vs su línea base ---- */
    const msSueno = s => (s.fin && s.tipo !== 'vigilia') ? (new Date(s.fin) - new Date(s.inicio)) : 0;
    const sueno24 = enVentana(data.suenos, 'inicio', hoy24).reduce((t, s) => t + msSueno(s), 0) / 3600000;
    const suenoBase = lineaBase(data.suenos, 'inicio', msSueno);
    if (suenoBase && suenoBase > 2 * 3600000) {
      const baseH = suenoBase / 3600000;
      if (sueno24 < baseH * 0.6) h.push({ nivel: 'observar', emoji: '🌙', titulo: en ? 'Slept less than her rhythm' : 'Durmió menos que su ritmo', texto: en ? `${Math.round(sueno24 * 10) / 10} h logged today vs ~${Math.round(baseH * 10) / 10} h of her usual. Could be a busy day or missed logs.` : `${Math.round(sueno24 * 10) / 10} h registradas hoy vs ~${Math.round(baseH * 10) / 10} h diarias suyas. Puede ser un día movido o registros que faltaron.` });
    }

    /* ---- confianza según cuántos datos hay ---- */
    const registros24 = enVentana(data.tomas, 'inicio', hoy24).length + enVentana(data.panales, 'hora', hoy24).length;
    const confianza = registros24 >= 6 ? 'buena' : 'limitada';

    const niveles = { atencion: 3, observar: 2, bien: 1 };
    h.sort((a, b) => niveles[b.nivel] - niveles[a.nivel]);
    const peor = h[0] ? h[0].nivel : 'bien';
    const estado = {
      bien: { emoji: '🌟', color: 'linear-gradient(135deg,#4cc38a,#2ea06d)', titulo: en ? 'Doing great' : 'Va muy bien', sub: en ? 'Her numbers look healthy and steady.' : 'Sus números se ven sanos y constantes.' },
      observar: { emoji: '👀', color: 'linear-gradient(135deg,#f5b54a,#e79a1f)', titulo: en ? 'Good, with a few things to watch' : 'Bien, con cositas que observar', sub: en ? 'Nothing urgent; a few details for the radar.' : 'Nada urgente; hay detalles para tener en el radar.' },
      atencion: { emoji: '📞', color: 'linear-gradient(135deg,#e25555,#c73e3e)', titulo: en ? 'Something to raise with the pediatrician' : 'Hay algo que comentar al pediatra', sub: en ? 'Check the red items below.' : 'Revisen los puntos rojos de abajo.' },
    }[peor];

    return { estado, hallazgos: h, confianza };
  }

  /* ---------- lo común en cada etapa (guía anticipada) ----------
     Ventanas en semanas de vida. `compra` sugiere qué ir consiguiendo. */
  const ETAPAS_COMUNES = [
    {
      key: 'reflejos', desde: 0, hasta: 8, emoji: '🤧',
      titulo: 'Hipo, estornudos y respiración irregular',
      texto: 'A esta edad son normalísimos: su sistema nervioso está madurando. El hipo no le molesta tanto como parece.',
      alivio: ['No hace falta “quitarle” el hipo; pasa solo.', 'Estornudar seguido no es resfriado: es su forma de limpiar la nariz.'],
    },
    {
      key: 'brotes', desde: 1, hasta: 7, emoji: '📈',
      titulo: 'Brotes de crecimiento (≈10 días, 3 y 6 semanas)',
      texto: 'De repente pide comer a cada rato y anda inquieta 1–3 días. No es que falte leche: está "ordenando" más producción.',
      alivio: ['Ofrecer pecho/biberón a libre demanda esos días.', 'Suele normalizarse solo en 2–3 días.'],
    },
    {
      key: 'piel', desde: 2, hasta: 8, emoji: '🌸',
      titulo: 'Acné del bebé y costra láctea',
      texto: 'Granitos en cara y escamitas en la cabeza son comunes por las hormonas del embarazo. No duelen y se van solos.',
      alivio: ['No exprimir ni tallar; lavar solo con agua tibia.', 'Para la costra: aceite de bebé 15 min antes del baño y cepillo suave.'],
    },
    {
      key: 'colicos', desde: 2, hasta: 14, emoji: '🌆',
      titulo: 'Cólicos y la “hora bruja” (tarde-noche)',
      texto: 'Entre las semanas 2 y 12–14, muchos bebés lloran más al atardecer sin causa clara, con pico cerca de la semana 6. Es agotador pero normal y pasa.',
      alivio: ['Las 5 “S”: envolverla, de ladito en brazos, shhh fuerte (ruido blanco), mecerla suave, dejarla succionar.', 'Bicicleta con las piernas y masaje de pancita en círculos.', 'Turnarse — la bitácora de vigilia les dice qué funcionó.'],
      compra: 'Una app o bocina de ruido blanco ayuda mucho; gotas anticólico solo si el pediatra las indica.',
    },
    {
      key: 'vacunas2m', desde: 6, hasta: 9, emoji: '💉',
      titulo: 'Se acercan las vacunas de los 2 meses',
      texto: 'Ronda grande de vacunas. Puede haber molestia, fiebre baja y sueño extra 1–2 días después.',
      alivio: ['Pecho o leche durante/después del piquete calma de verdad.', 'Piel con piel esa tarde.', 'Medicamento para fiebre solo con dosis del pediatra.'],
    },
    {
      key: 'babas', desde: 8, hasta: 16, emoji: '🤤',
      titulo: 'Baba a mares y manos a la boca',
      texto: 'Alrededor de los 2–3 meses babean muchísimo y se comen las manos. Todavía no suelen ser los dientes: es exploración y glándulas madurando.',
      alivio: ['Baberos y cambiar la ropita húmeda para evitar rozaduras en el cuello.'],
    },
    {
      key: 'regresion4m', desde: 14, hasta: 22, emoji: '😵‍💫',
      titulo: 'La “regresión” del sueño de los 4 meses',
      texto: 'Su sueño madura a ciclos como los de adulto y puede despertar más seguido unas semanas. No es que algo esté mal.',
      alivio: ['Rutina corta y constante antes de dormir (baño, toma, canción).', 'Acostarla somnolienta pero despierta ayuda a que hile ciclos.', 'Ventanas de despierto de ~90–120 min a esta edad.'],
    },
    {
      key: 'dientes', desde: 16, hasta: 30, emoji: '🦷',
      titulo: 'Probablemente vienen los dientitos',
      texto: 'Entre los 4 y 7 meses suelen asomarse los primeros (los de abajo al frente). Señales: encías hinchadas, más baba, muerde todo, irritabilidad.',
      alivio: ['Mordedera refrigerada (fría, nunca congelada).', 'Masajear la encía con un dedo limpio o gasita fría.', 'Los geles con benzocaína NO se recomiendan; medicamento solo con el pediatra.'],
      compra: 'Ve comprando: mordedera refrigerable, baberos absorbentes y crema barrera para la barbilla.',
    },
    {
      key: 'solidos', desde: 21, hasta: 27, emoji: '🥑',
      titulo: 'Se acerca la comida sólida (≈6 meses)',
      texto: 'Cerca de los 6 meses, si ya se sienta con apoyo y muestra interés por tu plato, llega la alimentación complementaria.',
      alivio: ['La leche sigue siendo el alimento principal hasta el año.', 'Empezar con papillas o trozos blanditos (método que el pediatra recomiende).'],
      compra: 'Ve consiguiendo: silla alta estable, cucharas suaves y baberos con bolsillo.',
    },
    {
      key: 'separacion', desde: 30, hasta: 44, emoji: '🫣',
      titulo: 'Ansiedad de separación',
      texto: 'Entre los 7 y 10 meses muchos lloran cuando mamá o papá salen del cuarto: ya entiende que existen aunque no los vea. Es un avance, no un retroceso.',
      alivio: ['Despedidas cortas y alegres, sin escaparse a escondidas.', 'Jugar peekaboo ensaya justo esto (está en sus Retos).'],
    },
  ];


  /* traduccion EN de la guia de etapas (aplicada al cargar) */
  if (typeof I18N !== 'undefined' && I18N.lang === 'en') {
    const E_EN = {
      reflejos: ['Hiccups, sneezes & irregular breathing', 'Totally normal at this age: her nervous system is maturing. Hiccups bother her far less than they seem to.',
        ['No need to "cure" hiccups; they pass on their own.', 'Frequent sneezing is not a cold: it is how she clears her nose.']],
      brotes: ['Growth spurts (~10 days, 3 & 6 weeks)', 'Suddenly she wants to eat constantly and is fussy for 1-3 days. Milk is not lacking: she is "ordering" more supply.',
        ['Offer breast/bottle on demand those days.', 'Usually settles by itself in 2-3 days.']],
      piel: ['Baby acne & cradle cap', 'Little pimples on the face and flaky scalp are common from pregnancy hormones. Painless, and they clear on their own.',
        ['No squeezing or scrubbing; wash with warm water only.', 'For cradle cap: baby oil 15 min before bath and a soft brush.']],
      colicos: ['Colic & the "witching hour" (evenings)', 'Between weeks 2 and 12-14 many babies cry more at dusk for no clear reason, peaking near week 6. Exhausting, but normal - and it passes.',
        ['The 5 S\'s: swaddle, side-lying in arms, strong shhh (white noise), swing gently, let her suck.', 'Bicycle legs and clockwise tummy massage.', 'Take turns - your wake-window log tells you what worked.']],
      vacunas2m: ['2-month vaccines coming up', 'The big vaccine round. Mild soreness, low fever and extra sleepiness for 1-2 days are common after.',
        ['Nursing during/after the shot genuinely soothes.', 'Skin-to-skin that evening.', 'Fever medicine only with the pediatrician\'s dosing.']],
      babas: ['Drool everywhere & hands in mouth', 'Around 2-3 months they drool a lot and eat their fists. Usually not teeth yet: it is exploration plus maturing glands.',
        ['Bibs, and change damp clothes to avoid neck rash.']],
      regresion4m: ['The 4-month sleep "regression"', 'Her sleep matures into adult-like cycles and she may wake more often for a few weeks. Nothing is wrong.',
        ['Short, consistent bedtime routine (bath, feed, song).', 'Putting her down drowsy but awake helps her link cycles.', 'Wake windows of ~90-120 min at this age.']],
      dientes: ['Teeth are probably coming', 'Between 4 and 7 months the first ones usually appear (bottom front). Signs: swollen gums, extra drool, biting everything, crankiness.',
        ['Chilled teether (cold, never frozen).', 'Massage gums with a clean finger or cool gauze.', 'Benzocaine gels are NOT recommended; medicine only with the pediatrician.']],
      solidos: ['Solid food is near (~6 months)', 'Around 6 months, if she sits with support and eyes your plate, complementary feeding begins.',
        ['Milk remains the main food until age one.', 'Start with purees or soft pieces (whichever method your pediatrician prefers).']],
      separacion: ['Separation anxiety', 'Between 7 and 10 months many cry when mom or dad leaves the room: she now knows you exist out of sight. It is progress, not regression.',
        ['Short, cheerful goodbyes - no sneaking away.', 'Peekaboo practices exactly this (it is in her Goals).']],
    };
    const C_EN = {
      colicos: 'A white-noise app or speaker helps a lot; anti-colic drops only if the pediatrician prescribes them.',
      dientes: 'Stock up on: a refrigerable teether, absorbent bibs and barrier cream for her chin.',
      solidos: 'Start gathering: a stable high chair, soft spoons and pocket bibs.',
    };
    ETAPAS_COMUNES.forEach(e => {
      const tr = E_EN[e.key];
      if (tr) { e.titulo = tr[0]; e.texto = tr[1]; if (e.alivio) e.alivio = tr[2]; }
      if (C_EN[e.key]) e.compra = C_EN[e.key];
    });
  }

  function comunes(edadDias) {
    if (edadDias === null) return [];
    const sem = Math.floor(edadDias / 7);
    return ETAPAS_COMUNES.filter(e => sem >= e.desde && sem < e.hasta);
  }

  return { generar, comunes };
})();
