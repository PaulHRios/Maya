/* ============ Maya — datos sintéticos para demo ============
   Módulo UMD: expone `MayaDemoData` en navegador y `module.exports` en Node.
   No contiene ni deriva datos reales. Todos los timestamps se generan de
   forma determinista alrededor del reloj que proporciona el consumidor. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MayaDemoData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FIXTURE_VERSION = 'demo-fixtures.v1';
  const DEFAULT_CLOCK = '2026-07-17T18:00:00.000Z';
  const SCENARIO_NAMES = Object.freeze(['steady', 'shift', 'sparse', 'offline']);

  function clockDate(value) {
    const date = value === undefined ? new Date(DEFAULT_CLOCK) : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('El reloj de demo no es válido');
    return date;
  }

  function hoursAgo(now, hours) {
    return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
  }

  function dateOnlyDaysAgo(now, days) {
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  function baseData(name, now) {
    return {
      version: 1,
      demo: {
        fixtureVersion: FIXTURE_VERSION,
        scenario: name,
        clock: now.toISOString(),
        offline: name === 'offline',
        ageBand: '1_2m',
        synthetic: true,
      },
      bebe: {
        nombre: 'Bebé Demo',
        nacimiento: dateOnlyDaysAgo(now, 45),
        hora: '09:20',
        mama: 'Alex Demo',
        papa: 'Sam Demo',
      },
      tomas: [],
      suenos: [],
      panales: [],
      condiciones: [{
        id: 'demo-condition-1',
        nombre: 'Seguimiento completamente ficticio',
        unidad: 'unidad-demo',
        mediciones: [],
        info: { resumen: 'Contenido ficticio que no debe salir del dispositivo.' },
      }],
      intervenciones: [],
      medicamentos: [{
        id: 'demo-med-1',
        nombre: 'Producto ficticio de demostración',
        dosis: 'dato que el snapshot debe descartar',
        activo: false,
      }],
      crecimiento: [{
        id: 'demo-growth-1',
        fecha: hoursAgo(now, 72),
        pesoKg: 4.2,
        tallaCm: 54,
      }],
      fotos: [{
        id: 'demo-photo-1',
        fecha: hoursAgo(now, 48),
        titulo: 'Foto ficticia que nunca entra al snapshot',
        archivo: 'demo-only.jpg',
        dataUrl: 'data:image/jpeg;base64,REVNT19PTkxZ',
      }],
      actividades: [],
      banco: [],
      borrados: [],
    };
  }

  function addFeed(data, now, hours, index) {
    const types = ['materno', 'materno', 'formula', 'materno', 'donante'];
    const tipo = types[index % types.length];
    data.tomas.push({
      id: `demo-feed-${data.demo.scenario}-${index}-${Math.round(hours * 10)}`,
      tipo,
      inicio: hoursAgo(now, hours),
      ml: tipo === 'materno' ? null : (tipo === 'formula' ? 90 : 75),
      duracionSeg: tipo === 'materno' ? 14 * 60 : null,
      lado: tipo === 'materno' ? (index % 2 ? 'izq' : 'der') : null,
      notas: '',
    });
  }

  function addDiaper(data, now, hours, index) {
    const types = ['pipi', 'pipi', 'mixto', 'pipi', 'popo', 'pipi'];
    data.panales.push({
      id: `demo-diaper-${data.demo.scenario}-${index}-${Math.round(hours * 10)}`,
      tipo: types[index % types.length],
      hora: hoursAgo(now, hours),
      color: index % 3 === 2 ? 'mostaza' : null,
      consistencia: index % 3 === 2 ? 'cremosa' : null,
      notas: '',
      fotoId: null,
    });
  }

  function addSleep(data, now, startHoursAgo, durationMinutes, index) {
    const endHoursAgo = Math.max(0, startHoursAgo - durationMinutes / 60);
    data.suenos.push({
      id: `demo-sleep-${data.demo.scenario}-${index}-${Math.round(startHoursAgo * 10)}`,
      tipo: 'sueno',
      inicio: hoursAgo(now, startHoursAgo),
      fin: hoursAgo(now, endHoursAgo),
      notas: '',
    });
  }

  function addFullBaseline(data, now) {
    const feedHours = [2, 5, 8, 11, 14, 17, 20, 23];
    const diaperHours = [4, 8, 12, 16, 20, 23];
    const sleeps = [
      [5, 120],
      [10, 90],
      [16, 120],
      [23, 390],
    ];

    for (let day = 1; day <= 7; day++) {
      feedHours.forEach((hour, i) => addFeed(data, now, day * 24 + hour, day * 100 + i));
      diaperHours.forEach((hour, i) => addDiaper(data, now, day * 24 + hour, day * 100 + i));
      sleeps.forEach(([hour, minutes], i) => addSleep(data, now, day * 24 + hour, minutes, day * 100 + i));
    }
  }

  function addSteadyCurrentDay(data, now) {
    [2, 5, 8, 11, 14, 17, 20, 23].forEach((hour, i) => addFeed(data, now, hour, i));
    [4, 8, 12, 16, 20, 23].forEach((hour, i) => addDiaper(data, now, hour, i));
    [[5, 120], [10, 90], [16, 120], [23, 390]]
      .forEach(([hour, minutes], i) => addSleep(data, now, hour, minutes, i));
  }

  function addShiftCurrentDay(data, now) {
    [3, 9, 16, 22].forEach((hour, i) => addFeed(data, now, hour, i));
    [7, 19].forEach((hour, i) => addDiaper(data, now, hour, i));
    [[6, 90], [14, 120], [23, 270]]
      .forEach(([hour, minutes], i) => addSleep(data, now, hour, minutes, i));
  }

  function addSparseData(data, now) {
    [4, 17].forEach((hour, i) => addFeed(data, now, hour, i));
    addDiaper(data, now, 8, 0);
    addSleep(data, now, 12, 90, 0);

    // Un único día histórico: deliberadamente insuficiente para inferir patrón.
    [28, 37].forEach((hour, i) => addFeed(data, now, hour, 100 + i));
    addDiaper(data, now, 31, 100);
  }

  function createScenario(name, clock) {
    if (!SCENARIO_NAMES.includes(name)) {
      throw new RangeError(`Escenario desconocido: ${String(name)}`);
    }
    const now = clockDate(clock);
    const data = baseData(name, now);

    if (name === 'sparse') {
      addSparseData(data, now);
      return data;
    }

    addFullBaseline(data, now);
    if (name === 'shift') addShiftCurrentDay(data, now);
    else addSteadyCurrentDay(data, now);
    return data;
  }

  // Regenera el fixture alrededor del nuevo reloj. No desplaza fechas reales
  // ni acepta un objeto arbitrario, de modo que siempre produce datos sintéticos.
  function rebaseScenario(name, clock) {
    return createScenario(name, clock);
  }

  return Object.freeze({
    FIXTURE_VERSION,
    DEFAULT_CLOCK,
    SCENARIO_NAMES,
    createScenario,
    rebaseScenario,
  });
});
