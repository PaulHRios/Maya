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
    const h = [];
    const hoy24 = 24;

    /* ---- hidratación: pañales de pipí en 24 h ---- */
    const pipi24 = enVentana(data.panales, 'hora', hoy24)
      .filter(p => p.tipo === 'pipi' || p.tipo === 'mixto').length;
    if (edadDias !== null && edadDias >= 5) {
      if (pipi24 >= 6) h.push({ nivel: 'bien', emoji: '💧', titulo: 'Hidratación en orden', texto: `${pipi24} pañales con pipí en 24 h — señal de que está comiendo y tomando suficiente.`, dato: 'esperado: 6 o más al día desde el día 5' });
      else if (pipi24 >= 4) h.push({ nivel: 'observar', emoji: '💧', titulo: 'Pipí un poco baja', texto: `${pipi24} pañales con pipí en 24 h. Vale la pena vigilar las próximas horas y ofrecer tomas frecuentes.`, dato: 'esperado: 6+ al día' });
      else h.push({ nivel: 'atencion', emoji: '💧', titulo: 'Pocos pañales mojados', texto: `Solo ${pipi24} en 24 h. Si además está adormilada o come poco, coméntenlo hoy mismo con el pediatra.`, dato: 'menos de 4 al día amerita consulta' });
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
        h.push({ nivel: 'observar', emoji: '💩', titulo: `${Math.floor(horasSinPopo / 24)} días sin popó`, texto: 'En el primer mes suele haber popó casi a diario. Si pasa de 3 días, se ve incómoda o el abdomen está duro, consúltenlo.', dato: 'lactancia materna >6 semanas sí puede espaciar días' });
      } else if (horasSinPopo < 48) {
        h.push({ nivel: 'bien', emoji: '💩', titulo: 'Popó al corriente', texto: `Última hace ${horasSinPopo < 1 ? 'menos de una hora' : horasSinPopo + ' h'}${popo72.length ? `, ${popo72.length} en 3 días` : ''}.` });
      }
    }
    const colorAlerta = enVentana(data.panales, 'hora', 72).find(p => p.color === 'rojo' || p.color === 'gris');
    if (colorAlerta) h.push({ nivel: 'atencion', emoji: '🎨', titulo: `Popó ${colorAlerta.color === 'rojo' ? 'rojiza' : 'blanca/gris'} registrada`, texto: 'Ese color amerita comentarlo con el pediatra pronto (llévenle la foto si la guardaron).' });

    /* ---- alimentación: frecuencia, hueco máximo y volumen vs su línea base ---- */
    const tomas24 = enVentana(data.tomas, 'inicio', hoy24);
    if (tomas24.length) {
      if (edadDias !== null && edadDias <= 60) {
        if (tomas24.length >= 8) h.push({ nivel: 'bien', emoji: '🍼', titulo: 'Comiendo con buena frecuencia', texto: `${tomas24.length} tomas en 24 h.`, dato: 'esperado: 8–12 en los primeros dos meses' });
        else if (tomas24.length >= 6) h.push({ nivel: 'observar', emoji: '🍼', titulo: 'Frecuencia de tomas justa', texto: `${tomas24.length} tomas en 24 h; intenten acercarse a 8, despertándola si duerme de más de día.`, dato: 'esperado: 8–12' });
        else h.push({ nivel: 'atencion', emoji: '🍼', titulo: 'Pocas tomas registradas', texto: `${tomas24.length} en 24 h. Si de verdad comió tan poco (y no es falta de registro), coméntenlo con el pediatra.` });
      }
      const orden = [...tomas24].sort((a, b) => a.inicio.localeCompare(b.inicio));
      let hueco = 0;
      for (let i = 1; i < orden.length; i++) hueco = Math.max(hueco, new Date(orden[i].inicio) - new Date(orden[i - 1].inicio));
      hueco = Math.max(hueco, Date.now() - new Date(orden[orden.length - 1].inicio));
      const huecoH = Math.round(hueco / 360000) / 10;
      if (edadDias !== null && edadDias <= 30 && huecoH >= 5) {
        h.push({ nivel: 'observar', emoji: '⏰', titulo: `Hueco de ${huecoH} h entre tomas`, texto: 'En el primer mes conviene no pasar de ~4 horas sin comer, incluso despertándola.' });
      }
    }
    const mlBase = lineaBase(data.tomas, 'inicio', t => Number(t.ml) || 0);
    const ml24 = tomas24.reduce((s, t) => s + (Number(t.ml) || 0), 0);
    if (mlBase && mlBase > 30) {
      const cambio = Math.round(((ml24 - mlBase) / mlBase) * 100);
      if (cambio <= -30) h.push({ nivel: 'observar', emoji: '📉', titulo: `Biberones ${Math.abs(cambio)}% abajo de su ritmo`, texto: `${ml24} ml hoy contra ~${Math.round(mlBase)} ml diarios de su propia semana. Puede ser un día flojo o falta de registro — vigilen la siguiente toma.`, dato: 'comparado con su línea base de 3 días' });
      else if (cambio >= 30) h.push({ nivel: 'bien', emoji: '📈', titulo: `Comiendo ${cambio}% más que su ritmo`, texto: `${ml24} ml hoy vs ~${Math.round(mlBase)} ml. Los brotes de crecimiento se ven así.` });
    }

    /* ---- peso ---- */
    const pesos = [...data.crecimiento].filter(c => c.pesoKg).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (pesos.length >= 2) {
      const a = pesos[pesos.length - 2], b = pesos[pesos.length - 1];
      const dias = Math.max(1, Math.round((new Date(b.fecha) - new Date(a.fecha)) / DIA));
      const gxd = Math.round(((b.pesoKg - a.pesoKg) * 1000) / dias);
      if (gxd >= 20) h.push({ nivel: 'bien', emoji: '⚖️', titulo: `Subiendo ~${gxd} g por día`, texto: `De ${a.pesoKg} a ${b.pesoKg} kg. Excelente ritmo.`, dato: 'esperado: 20–40 g/día tras la primera semana' });
      else if (gxd >= 0) h.push({ nivel: 'observar', emoji: '⚖️', titulo: `Subiendo despacio (~${gxd} g/día)`, texto: 'Que el pediatra confirme el ritmo en la próxima consulta; registren cada pesada aquí.' });
      else h.push({ nivel: 'atencion', emoji: '⚖️', titulo: 'El peso bajó entre medidas', texto: `De ${a.pesoKg} a ${b.pesoKg} kg. Después de la primera semana el peso debería subir — coméntenlo con el pediatra.` });
      const nac = pesos[0];
      if (edadDias !== null && edadDias >= 14 && b.pesoKg < nac.pesoKg) {
        h.push({ nivel: 'atencion', emoji: '⚖️', titulo: 'Aún no recupera el peso de nacimiento', texto: 'A los 14 días la mayoría ya lo recuperó; amerita revisión del pediatra.' });
      }
    }

    /* ---- condiciones: resultados pendientes y mediciones al alza ---- */
    for (const c of data.condiciones || []) {
      const meds = [...(c.mediciones || [])].sort((a, b) => a.fecha.localeCompare(b.fecha));
      const pendiente = meds.find(m => m.valor === null || m.valor === '');
      if (pendiente) {
        const hrs = Math.floor((Date.now() - new Date(pendiente.fecha)) / 3600000);
        h.push({ nivel: 'observar', emoji: '🧪', titulo: `${c.nombre}: resultado pendiente`, texto: `La muestra fue hace ${hrs < 24 ? hrs + ' h' : Math.floor(hrs / 24) + ' día(s)'}. En cuanto llegue, captúrenlo para ver la tendencia.` });
      }
      const conValor = meds.filter(m => m.valor !== null && m.valor !== '');
      if (conValor.length >= 2) {
        const ult = conValor[conValor.length - 1], prev = conValor[conValor.length - 2];
        if (Number(ult.valor) > Number(prev.valor)) h.push({ nivel: 'observar', emoji: '🩺', titulo: `${c.nombre} al alza`, texto: `Última medición ${ult.valor}${c.unidad ? ' ' + c.unidad : ''} (antes ${prev.valor}). Sigan los controles que indique el pediatra.` });
        else h.push({ nivel: 'bien', emoji: '🩺', titulo: `${c.nombre} bajando`, texto: `De ${prev.valor} a ${ult.valor}${c.unidad ? ' ' + c.unidad : ''} — buena señal.` });
      }
    }

    /* ---- sueño vs su línea base ---- */
    const msSueno = s => (s.fin && s.tipo !== 'vigilia') ? (new Date(s.fin) - new Date(s.inicio)) : 0;
    const sueno24 = enVentana(data.suenos, 'inicio', hoy24).reduce((t, s) => t + msSueno(s), 0) / 3600000;
    const suenoBase = lineaBase(data.suenos, 'inicio', msSueno);
    if (suenoBase && suenoBase > 2 * 3600000) {
      const baseH = suenoBase / 3600000;
      if (sueno24 < baseH * 0.6) h.push({ nivel: 'observar', emoji: '🌙', titulo: 'Durmió menos que su ritmo', texto: `${Math.round(sueno24 * 10) / 10} h registradas hoy vs ~${Math.round(baseH * 10) / 10} h diarias suyas. Puede ser un día movido o registros que faltaron.` });
    }

    /* ---- confianza según cuántos datos hay ---- */
    const registros24 = enVentana(data.tomas, 'inicio', hoy24).length + enVentana(data.panales, 'hora', hoy24).length;
    const confianza = registros24 >= 6 ? 'buena' : 'limitada';

    const niveles = { atencion: 3, observar: 2, bien: 1 };
    h.sort((a, b) => niveles[b.nivel] - niveles[a.nivel]);
    const peor = h[0] ? h[0].nivel : 'bien';
    const estado = {
      bien: { emoji: '🌟', color: 'linear-gradient(135deg,#4cc38a,#2ea06d)', titulo: 'Va muy bien', sub: 'Sus números se ven sanos y constantes.' },
      observar: { emoji: '👀', color: 'linear-gradient(135deg,#f5b54a,#e79a1f)', titulo: 'Bien, con cositas que observar', sub: 'Nada urgente; hay detalles para tener en el radar.' },
      atencion: { emoji: '📞', color: 'linear-gradient(135deg,#e25555,#c73e3e)', titulo: 'Hay algo que comentar al pediatra', sub: 'Revisen los puntos rojos de abajo.' },
    }[peor];

    return { estado, hallazgos: h, confianza };
  }

  return { generar };
})();
