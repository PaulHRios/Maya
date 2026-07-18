import assert from 'node:assert/strict';
import test from 'node:test';

import DemoData from '../js/demo-data.js';
import Insights from '../js/insights-engine.js';

const CLOCK = '2026-07-17T18:00:00.000Z';

test('los fixtures se regeneran de forma determinista alrededor del reloj indicado', () => {
  const first = DemoData.createScenario('steady', CLOCK);
  const second = DemoData.rebaseScenario('steady', CLOCK);
  assert.deepEqual(first, second);
  assert.equal(first.demo.clock, CLOCK);

  const later = DemoData.createScenario('steady', '2026-07-18T18:00:00.000Z');
  const delta = Date.parse(later.tomas[0].inicio) - Date.parse(first.tomas[0].inicio);
  assert.equal(delta, 24 * 60 * 60 * 1000);
});

test('steady produce un snapshot comparable y un fallback fundamentado', () => {
  const data = DemoData.createScenario('steady', CLOCK);
  const snapshot = Insights.buildSnapshot(data, {
    now: CLOCK,
    ageBand: data.demo.ageBand,
  });

  assert.equal(snapshot.pattern_state, 'steady');
  assert.equal(snapshot.data_quality, 'sufficient');
  assert.ok(snapshot.observations.some(item => item.id === 'feed_count_similar_to_recent_pattern'));

  const brief = Insights.createDeterministicBrief(snapshot);
  const result = Insights.validateBriefContract(brief, snapshot);
  assert.equal(result.valid, true, result.errors.join(', '));
  assert.equal(brief.source, 'local_fallback');
  assert.ok(brief.evidence.length > 0);
  assert.ok(brief.suggestions.every(item => snapshot.allowed_action_ids.includes(item.action_id)));
});

test('shift describe cambios contra el propio historial sin hacer juicio clínico', () => {
  const data = DemoData.createScenario('shift', CLOCK);
  const snapshot = Insights.buildSnapshot(data, { now: CLOCK, ageBand: '1_2m' });
  assert.equal(snapshot.pattern_state, 'changed');
  assert.ok(snapshot.observations.some(item => item.direction === 'lower'));

  const brief = Insights.createDeterministicBrief(snapshot);
  assert.match(brief.headline, /cambios/i);
  assert.doesNotMatch(JSON.stringify(brief), /diagn[oó]st|dosis|tratamiento|está normal/i);
  assert.equal(Insights.validateBriefContract(brief, snapshot).valid, true);
});

test('sparse reconoce que no existe evidencia suficiente', () => {
  const data = DemoData.createScenario('sparse', CLOCK);
  const snapshot = Insights.buildSnapshot(data, { now: CLOCK, ageBand: '1_2m' });
  assert.equal(snapshot.pattern_state, 'sparse');
  assert.equal(snapshot.data_quality, 'limited');
  assert.equal(snapshot.observations[0].id, 'insufficient_history');

  const brief = Insights.createDeterministicBrief(snapshot);
  assert.equal(brief.confidence, 'limited');
  assert.match(`${brief.headline} ${brief.overview}`, /faltan|suficiente/i);
});

test('offline conserva el contrato y declara que usa cálculo local', () => {
  const data = DemoData.createScenario('offline', CLOCK);
  const snapshot = Insights.buildSnapshot(data, { now: CLOCK, ageBand: '1_2m' });
  const brief = Insights.createDeterministicBrief(snapshot, { offline: data.demo.offline });
  assert.match(brief.overview, /Sin conexión/i);
  assert.equal(Insights.validateBriefContract(brief, snapshot).valid, true);
});

test('el contrato GPT está listo para transportar el snapshot pero no ejecuta red', () => {
  const snapshot = Insights.buildSnapshot(DemoData.createScenario('steady', CLOCK), {
    now: CLOCK,
    ageBand: '1_2m',
  });
  const request = Insights.buildGptRequestContract(snapshot);
  assert.equal(request.endpoint, '/v1/responses');
  assert.equal(request.body.model, 'gpt-5.6-sol');
  assert.equal(request.body.store, false);
  assert.equal(request.body.text.format.strict, true);
  assert.deepEqual(JSON.parse(request.body.input[1].content[0].text), snapshot);
});
