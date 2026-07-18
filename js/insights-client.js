/* Optional copy enhancement for the public synthetic demo.
   Private baby data never crosses this boundary. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MayaInsightsClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_ENDPOINT = './api/brief';
  const MAX_COPY = 500;
  const CLINICAL_CLAIM = /\b(diagn[oó]stic|dosis|medicamento|tratamiento|recetar|urgente|emergencia|est[aá]\s+(?:sana|normal)|es\s+normal|sin\s+riesgo|enfermedad)\w*/i;

  function cleanCopy(value, max = MAX_COPY) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function allowedIds(snapshot, key) {
    const values = key === 'observation'
      ? (snapshot && snapshot.observations || []).map(x => x && x.id)
      : (snapshot && snapshot.allowed_action_ids || []);
    return new Set(values.filter(x => typeof x === 'string'));
  }

  function validateResponse(candidate, snapshot) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
    const observations = allowedIds(snapshot, 'observation');
    const actions = allowedIds(snapshot, 'action');
    const headline = cleanCopy(candidate.headline, 140);
    const overview = cleanCopy(candidate.overview, 400);
    if (!headline || !overview || CLINICAL_CLAIM.test(`${headline} ${overview}`)) return null;

    const highlights = Array.isArray(candidate.highlights) ? candidate.highlights.slice(0, 4).map(item => ({
      observation_id: cleanCopy(item && item.observation_id, 100),
      copy: cleanCopy(item && item.copy, 300),
    })).filter(item => observations.has(item.observation_id) && item.copy && !CLINICAL_CLAIM.test(item.copy)) : [];

    const suggestions = Array.isArray(candidate.suggestions) ? candidate.suggestions.slice(0, 3).map(item => ({
      action_id: cleanCopy(item && item.action_id, 100),
      copy: cleanCopy(item && item.copy, 300),
    })).filter(item => actions.has(item.action_id) && item.copy && !CLINICAL_CLAIM.test(item.copy)) : [];

    if (highlights.length !== (candidate.highlights || []).slice(0, 4).length) return null;
    if (suggestions.length !== (candidate.suggestions || []).slice(0, 3).length) return null;
    return {
      schema_version: 'baby_brief_copy.v1',
      source: 'gpt',
      headline,
      overview,
      highlights,
      suggestions,
      confidence: candidate.confidence === 'sufficient' ? 'sufficient' : 'limited',
      disclaimer_key: 'observational_not_medical',
      generatedBy: 'gpt-5.6-sol',
    };
  }

  async function enhance(snapshot, options = {}) {
    if (!options.demo || !options.synthetic) throw new Error('AI_DEMO_ONLY');
    if (options.offline || (typeof navigator !== 'undefined' && navigator.onLine === false)) throw new Error('AI_OFFLINE');
    if (!snapshot || snapshot.schema_version !== 'baby_brief_input.v1') throw new Error('AI_INVALID_SNAPSHOT');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(15000, Math.max(1000, options.timeoutMs || 9000)));
    if (options.signal) options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    try {
      const response = await fetch(options.endpoint || DEFAULT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify(snapshot),
      });
      if (!response.ok) throw new Error(`AI_HTTP_${response.status}`);
      const raw = await response.text();
      if (raw.length > 20000) throw new Error('AI_RESPONSE_TOO_LARGE');
      const validated = validateResponse(JSON.parse(raw), snapshot);
      if (!validated) throw new Error('AI_INVALID_RESPONSE');
      return validated;
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({ DEFAULT_ENDPOINT, validateResponse, enhance });
});
