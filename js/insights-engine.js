/* ============ Maya — motor local de insights ============
   Módulo puro, sin red y sin dependencias. Expone `MayaInsights` en navegador
   y `module.exports` en Node. El snapshot se construye por lista blanca: nunca
   copia objetos de Store ni texto proporcionado por usuarios. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MayaInsights = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const INPUT_SCHEMA_VERSION = 'baby_brief_input.v1';
  const OUTPUT_SCHEMA_VERSION = 'baby_brief_copy.v1';
  const MODEL_ID = 'gpt-5.6-sol';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const AGE_BANDS = Object.freeze(['unspecified', '0_4w', '1_2m', '2_4m', '4_6m', '6_9m', '9_12m']);
  const LOCALES = Object.freeze(['es-MX', 'es-ES', 'en-US']);

  // Son identificadores del contrato, no identificadores de una persona o evento.
  const ACTION_COPY = Object.freeze({
    continue_logging: 'Sigue registrando para conservar una vista clara del día.',
    review_timeline: 'Revisa la línea de tiempo para confirmar que no falte ningún registro.',
    check_missing_entries: 'Completa cualquier registro que haya quedado pendiente.',
    prepare_visit_note: 'Si algo te preocupa, prepara una nota con los registros para comentarla con un profesional.',
  });

  const ACTION_IDS = Object.freeze(Object.keys(ACTION_COPY));

  const METRIC_META = Object.freeze({
    feed_count: { unit: 'count', domain: 'feeding', label: 'alimentación' },
    bottle_ml: { unit: 'ml', domain: 'feeding', label: 'leche registrada en biberón' },
    nursing_minutes: { unit: 'minutes', domain: 'feeding', label: 'tiempo de lactancia registrado' },
    wet_diaper_count: { unit: 'count', domain: 'diapers', label: 'pañales con pipí' },
    stool_diaper_count: { unit: 'count', domain: 'diapers', label: 'pañales con popó' },
    sleep_minutes: { unit: 'minutes', domain: 'sleep', label: 'sueño registrado' },
  });

  const OUTPUT_JSON_SCHEMA = Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: [
      'schema_version', 'source', 'headline', 'overview', 'highlights',
      'suggestions', 'confidence', 'disclaimer_key', 'evidence',
    ],
    properties: {
      schema_version: { type: 'string', enum: [OUTPUT_SCHEMA_VERSION] },
      source: { type: 'string', enum: ['gpt', 'local_fallback'] },
      headline: { type: 'string', minLength: 1, maxLength: 90 },
      overview: { type: 'string', minLength: 1, maxLength: 280 },
      highlights: {
        type: 'array', maxItems: 3,
        items: {
          type: 'object', additionalProperties: false,
          required: ['observation_id', 'copy'],
          properties: {
            observation_id: { type: 'string' },
            copy: { type: 'string', minLength: 1, maxLength: 180 },
          },
        },
      },
      suggestions: {
        type: 'array', maxItems: 3,
        items: {
          type: 'object', additionalProperties: false,
          required: ['action_id', 'copy'],
          properties: {
            action_id: { type: 'string' },
            copy: { type: 'string', minLength: 1, maxLength: 180 },
          },
        },
      },
      confidence: { type: 'string', enum: ['sufficient', 'limited'] },
      disclaimer_key: { type: 'string', enum: ['observational_not_medical'] },
      evidence: {
        type: 'array', maxItems: 3,
        items: {
          type: 'object', additionalProperties: false,
          required: ['observation_id', 'metric_ids'],
          properties: {
            observation_id: { type: 'string' },
            metric_ids: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          },
        },
      },
    },
  });

  function validDateMs(value) {
    const ms = typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }

  function finiteNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(max, Math.max(min, number));
  }

  function round(value, decimals) {
    const factor = 10 ** (decimals || 0);
    return Math.round(value * factor) / factor;
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function inWindow(ms, start, end) {
    return ms !== null && ms > start && ms <= end;
  }

  function overlapMinutes(startValue, endValue, windowStart, windowEnd) {
    const start = validDateMs(startValue);
    const end = validDateMs(endValue);
    if (start === null || end === null || end <= start) return 0;
    const overlap = Math.min(end, windowEnd) - Math.max(start, windowStart);
    if (overlap <= 0) return 0;
    return Math.min(24 * 60, overlap / 60000);
  }

  function summarizeWindow(data, start, end) {
    const summary = {
      feed_count: 0,
      bottle_ml: 0,
      nursing_minutes: 0,
      wet_diaper_count: 0,
      stool_diaper_count: 0,
      sleep_minutes: 0,
    };

    for (const feed of Array.isArray(data && data.tomas) ? data.tomas : []) {
      const at = validDateMs(feed && feed.inicio);
      if (!inWindow(at, start, end)) continue;
      const type = feed && feed.tipo;
      if (!['materno', 'donante', 'formula'].includes(type)) continue;
      summary.feed_count++;
      if (type === 'donante' || type === 'formula') {
        summary.bottle_ml += finiteNumber(feed.ml, 0, 1000);
      }
      if (type === 'materno') {
        summary.nursing_minutes += finiteNumber(feed.duracionSeg, 0, 8 * 60 * 60) / 60;
      }
    }

    for (const diaper of Array.isArray(data && data.panales) ? data.panales : []) {
      const at = validDateMs(diaper && diaper.hora);
      if (!inWindow(at, start, end)) continue;
      const type = diaper && diaper.tipo;
      if (type === 'pipi' || type === 'mixto') summary.wet_diaper_count++;
      if (type === 'popo' || type === 'mixto') summary.stool_diaper_count++;
    }

    for (const sleep of Array.isArray(data && data.suenos) ? data.suenos : []) {
      if (sleep && sleep.tipo === 'vigilia') continue;
      summary.sleep_minutes += overlapMinutes(sleep && sleep.inicio, sleep && sleep.fin, start, end);
    }

    for (const key of Object.keys(summary)) summary[key] = round(summary[key], 1);
    return summary;
  }

  function coverageFor(days) {
    return {
      days_with_feeding: days.filter(day => day.feed_count > 0).length,
      days_with_sleep: days.filter(day => day.sleep_minutes > 0).length,
      days_with_diapers: days.filter(day => day.wet_diaper_count + day.stool_diaper_count > 0).length,
    };
  }

  function coverageByDomain(coverage, domain) {
    if (domain === 'feeding') return coverage.days_with_feeding;
    if (domain === 'sleep') return coverage.days_with_sleep;
    return coverage.days_with_diapers;
  }

  function directionFor(value, baseline, coverageDays) {
    if (coverageDays < 3 || baseline === null || baseline <= 0) {
      return { direction: 'not_comparable', changePercent: null };
    }
    const changePercent = round(((value - baseline) / baseline) * 100, 0);
    if (changePercent <= -30) return { direction: 'lower', changePercent };
    if (changePercent >= 30) return { direction: 'higher', changePercent };
    return { direction: 'similar', changePercent };
  }

  function observationId(metricId, direction) {
    if (direction === 'similar') return `${metricId}_similar_to_recent_pattern`;
    if (direction === 'higher') return `${metricId}_higher_than_recent_pattern`;
    if (direction === 'lower') return `${metricId}_lower_than_recent_pattern`;
    return null;
  }

  function buildSnapshot(data, options) {
    const opts = options || {};
    const now = validDateMs(opts.now === undefined ? Date.now() : opts.now);
    if (now === null) throw new TypeError('El reloj del snapshot no es válido');

    const baselineDays = Math.min(14, Math.max(3, Math.trunc(finiteNumber(opts.baselineDays || 7, 3, 14))));
    const locale = LOCALES.includes(opts.locale) ? opts.locale : 'es-MX';
    const ageBand = AGE_BANDS.includes(opts.ageBand) ? opts.ageBand : 'unspecified';
    const current = summarizeWindow(data || {}, now - DAY_MS, now);
    const historical = [];

    for (let day = 1; day <= baselineDays; day++) {
      const end = now - day * DAY_MS;
      const start = end - DAY_MS;
      historical.push(summarizeWindow(data || {}, start, end));
    }

    const coverage = coverageFor(historical);
    const comparableDomains = [
      coverage.days_with_feeding,
      coverage.days_with_sleep,
      coverage.days_with_diapers,
    ].filter(days => days >= 3).length;
    const dataQuality = comparableDomains >= 2 ? 'sufficient' : 'limited';

    const metrics = Object.keys(METRIC_META).map(id => {
      const meta = METRIC_META[id];
      const domainDays = coverageByDomain(coverage, meta.domain);
      const baselineValues = historical
        .filter(day => {
          if (meta.domain === 'feeding') return day.feed_count > 0;
          if (meta.domain === 'sleep') return day.sleep_minutes > 0;
          return day.wet_diaper_count + day.stool_diaper_count > 0;
        })
        .map(day => day[id]);
      const baseline = median(baselineValues);
      const comparison = directionFor(current[id], baseline, domainDays);
      return {
        id,
        value: current[id],
        unit: meta.unit,
        baseline: baseline === null ? null : round(baseline, 1),
        direction: comparison.direction,
        change_percent: comparison.changePercent,
        coverage_days: domainDays,
      };
    });

    const observations = [];
    if (dataQuality === 'limited') {
      observations.push({
        id: 'insufficient_history',
        kind: 'data_quality',
        direction: 'not_comparable',
        metric_ids: [],
      });
    }

    const primaryMetrics = ['feed_count', 'wet_diaper_count', 'sleep_minutes'];
    for (const metric of metrics.filter(item => primaryMetrics.includes(item.id))) {
      const id = observationId(metric.id, metric.direction);
      if (!id) continue;
      observations.push({
        id,
        kind: 'pattern',
        direction: metric.direction,
        metric_ids: [metric.id],
      });
    }

    const changed = observations.some(item => item.direction === 'higher' || item.direction === 'lower');
    const patternState = dataQuality === 'limited' ? 'sparse' : (changed ? 'changed' : 'steady');
    const allowedActions = patternState === 'steady'
      ? ['continue_logging', 'review_timeline']
      : patternState === 'changed'
        ? ['review_timeline', 'continue_logging', 'prepare_visit_note']
        : ['continue_logging', 'check_missing_entries'];

    // Se crea un objeto nuevo de forma explícita. No hay spread de `data`,
    // timestamps, IDs de eventos ni texto libre en esta frontera.
    return {
      schema_version: INPUT_SCHEMA_VERSION,
      locale,
      age_band: ageBand,
      period: { current_hours: 24, baseline_days: baselineDays },
      coverage,
      data_quality: dataQuality,
      pattern_state: patternState,
      metrics,
      observations,
      allowed_action_ids: allowedActions,
    };
  }

  function metricLabel(metricId) {
    return METRIC_META[metricId] ? METRIC_META[metricId].label : 'registro';
  }

  function copyForObservation(observation) {
    if (observation.id === 'insufficient_history') {
      return 'Todavía no hay suficiente historial para describir un patrón reciente.';
    }
    const label = metricLabel(observation.metric_ids[0]);
    if (observation.direction === 'higher') return `El registro de ${label} fue mayor que en los días recientes.`;
    if (observation.direction === 'lower') return `El registro de ${label} fue menor que en los días recientes.`;
    return `El registro de ${label} se parece al de los días recientes.`;
  }

  function createDeterministicBrief(snapshot, options) {
    const opts = options || {};
    if (!snapshot || snapshot.schema_version !== INPUT_SCHEMA_VERSION) {
      throw new TypeError('Snapshot incompatible');
    }
    const offline = opts.offline === true;
    const selectedObservations = snapshot.observations.slice(0, 3);
    let headline;
    let overview;

    if (snapshot.pattern_state === 'sparse') {
      headline = 'Aún faltan registros para comparar';
      overview = 'Continúa registrando para construir un historial que permita describir cambios.';
    } else if (snapshot.pattern_state === 'changed') {
      headline = 'Hay cambios frente al historial reciente';
      overview = 'El resumen señala diferencias en los registros, sin hacer una evaluación médica.';
    } else {
      headline = 'Un día parecido al ritmo reciente';
      overview = 'Los registros de hoy se parecen al patrón observado en los últimos días.';
    }

    if (offline) overview = `Sin conexión, se muestra un cálculo local. ${overview}`;

    const highlights = selectedObservations.map(observation => ({
      observation_id: observation.id,
      copy: copyForObservation(observation),
    }));
    const suggestions = snapshot.allowed_action_ids.slice(0, 3).map(actionId => ({
      action_id: actionId,
      copy: ACTION_COPY[actionId],
    }));
    const evidence = selectedObservations.map(observation => ({
      observation_id: observation.id,
      metric_ids: observation.metric_ids.slice(),
    }));

    return {
      schema_version: OUTPUT_SCHEMA_VERSION,
      source: 'local_fallback',
      headline,
      overview,
      highlights,
      suggestions,
      confidence: snapshot.data_quality === 'sufficient' ? 'sufficient' : 'limited',
      disclaimer_key: 'observational_not_medical',
      evidence,
    };
  }

  function allText(brief) {
    return [
      brief && brief.headline,
      brief && brief.overview,
      ...(Array.isArray(brief && brief.highlights) ? brief.highlights.map(item => item.copy) : []),
      ...(Array.isArray(brief && brief.suggestions) ? brief.suggestions.map(item => item.copy) : []),
    ].filter(Boolean).join(' ');
  }

  function validateBriefContract(brief, snapshot) {
    const errors = [];
    if (!brief || brief.schema_version !== OUTPUT_SCHEMA_VERSION) errors.push('schema_version');
    if (!brief || !['gpt', 'local_fallback'].includes(brief.source)) errors.push('source');
    if (!brief || !['sufficient', 'limited'].includes(brief.confidence)) errors.push('confidence');
    if (!brief || brief.disclaimer_key !== 'observational_not_medical') errors.push('disclaimer_key');
    if (!Array.isArray(brief && brief.highlights) || brief.highlights.length > 3) errors.push('highlights');
    if (!Array.isArray(brief && brief.suggestions) || brief.suggestions.length > 3) errors.push('suggestions');
    if (!Array.isArray(brief && brief.evidence) || brief.evidence.length > 3) errors.push('evidence');

    const observationIds = new Set((snapshot && snapshot.observations || []).map(item => item.id));
    const actionIds = new Set(snapshot && snapshot.allowed_action_ids || []);
    const metricIds = new Set((snapshot && snapshot.metrics || []).map(item => item.id));

    for (const item of brief && brief.highlights || []) {
      if (!observationIds.has(item.observation_id)) errors.push(`unknown_observation:${item.observation_id}`);
    }
    for (const item of brief && brief.suggestions || []) {
      if (!actionIds.has(item.action_id)) errors.push(`unknown_action:${item.action_id}`);
    }
    for (const item of brief && brief.evidence || []) {
      if (!observationIds.has(item.observation_id)) errors.push(`unknown_evidence:${item.observation_id}`);
      for (const id of Array.isArray(item.metric_ids) ? item.metric_ids : []) {
        if (!metricIds.has(id)) errors.push(`unknown_metric:${id}`);
      }
    }

    // Defensa adicional para respuestas GPT futuras. No sustituye revisión
    // profesional, pero impide aceptar vocabulario clínico no autorizado.
    const forbidden = /\b(diagn[oó]stic\w*|dosis|medicamento|tratamiento|enfermedad|urgencia|saludable|est[aá]\s+sana|est[aá]\s+normal)\b/i;
    if (forbidden.test(allText(brief))) errors.push('medical_claim');
    return { valid: errors.length === 0, errors };
  }

  function buildGptRequestContract(snapshot) {
    if (!snapshot || snapshot.schema_version !== INPUT_SCHEMA_VERSION) {
      throw new TypeError('Snapshot incompatible');
    }
    return {
      endpoint: '/v1/responses',
      body: {
        model: MODEL_ID,
        store: false,
        reasoning: { effort: 'low' },
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'baby_brief_copy',
            strict: true,
            schema: OUTPUT_JSON_SCHEMA,
          },
        },
        input: [
          {
            role: 'developer',
            content: [{
              type: 'input_text',
              text: [
                'Redacta un resumen observacional para cuidadores usando solo las observaciones proporcionadas.',
                'No diagnostiques, no evalúes normalidad o salud, no indiques tratamiento, dosis ni urgencia.',
                'Referencia únicamente observation_id y action_id presentes en la entrada.',
                'Devuelve source="gpt" y cumple exactamente el esquema JSON.',
              ].join(' '),
            }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: JSON.stringify(snapshot) }],
          },
        ],
      },
    };
  }

  return Object.freeze({
    INPUT_SCHEMA_VERSION,
    OUTPUT_SCHEMA_VERSION,
    MODEL_ID,
    AGE_BANDS,
    ACTION_IDS,
    OUTPUT_JSON_SCHEMA,
    buildSnapshot,
    createDeterministicBrief,
    validateBriefContract,
    buildGptRequestContract,
  });
});
