/* Runtime mode for the static PWA. Demo state is deliberately isolated from
   private account storage and only contains synthetic fixtures. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MayaRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEMO_SCENARIOS = Object.freeze(['steady', 'shift', 'sparse', 'offline']);
  const DEMO_STORAGE_PREFIX = 'maya.demo.v2.';

  function cleanScenario(value) {
    const scenario = String(value || '').trim().toLowerCase();
    return DEMO_SCENARIOS.includes(scenario) ? scenario : null;
  }

  function scenarioFromLocation(locationLike) {
    try {
      const params = new URLSearchParams(locationLike && locationLike.search || '');
      return cleanScenario(params.get('demo'));
    } catch {
      return null;
    }
  }

  function demoStorageKey(scenario) {
    return `${DEMO_STORAGE_PREFIX}${cleanScenario(scenario) || 'steady'}`;
  }

  function isDemo(locationLike) {
    return !!scenarioFromLocation(locationLike || (typeof location !== 'undefined' ? location : null));
  }

  function demoUrl(scenario, locationLike) {
    const selected = cleanScenario(scenario) || 'steady';
    const current = locationLike || (typeof location !== 'undefined' ? location : null);
    const base = current && current.href ? new URL(current.href) : new URL('https://example.invalid/');
    base.searchParams.set('demo', selected);
    base.hash = '';
    return current && current.href ? `${base.pathname}${base.search}` : base.toString();
  }

  return Object.freeze({
    DEMO_SCENARIOS,
    DEMO_STORAGE_PREFIX,
    cleanScenario,
    scenarioFromLocation,
    demoStorageKey,
    demoUrl,
    isDemo,
  });
});
