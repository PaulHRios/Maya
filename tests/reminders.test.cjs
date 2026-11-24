const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/reminders.js');
const date = new Date(2026, 10, 24, 10);
const before = mins => new Date(+date - mins * 60000).toISOString();
const data = { tomas: [{ inicio: before(240) }, { inicio: before(-10) }],
  panales: [{ tipo: 'popo', hora: before(1000) }, { tipo: 'mixto', hora: before(355) }],
  suenos: [{ tipo: 'vigilia', fin: before(1) }, { fin: before(91) }], fotos: [] };
const prefs = { sleep: true, feed: true, poop: true, wet: true, photo: true };
const run = (x = {}) => R.due({ data, prefs, now: +date, week: 25, sleepMin: 90, ...x });
test('Enabled alerts use latest valid entry, mixed counts for both diaper types', () => {
  assert.deepEqual(run().map(a => a.type), ['feed', 'sleep', 'photo']);
  assert.deepEqual(run({ prefs: { ...prefs, wetHours: 5, poopHours: 5 } }).map(a => a.type), ['feed', 'poop', 'wet', 'sleep', 'photo']);
  assert.equal(run()[0].elapsed, 4 * 3600000);
});
test('Quiet window crosses midnight and ends at the selected local time', () => {
  for (const hour of [0, 7, 21, 23]) assert.equal(R.isQuiet(R.settings(), new Date(2026, 10, 24, hour)), true);
  for (const hour of [8, 20]) assert.equal(R.isQuiet(R.settings(), new Date(2026, 10, 24, hour)), false);
  const p = R.settings({ from: '10:00', to: '13:00' });
  assert.equal(R.isQuiet(p, date), true);
  assert.equal(R.isQuiet(R.settings({ from: '10:00', to: '10:00' }), date), true);
  assert.deepEqual(run({ now: +new Date(2026, 10, 24, 22) }), []);
});
test('No records are not a medical event; active sessions cancel affected reminders', () => {
  assert.deepEqual(run({ data: {}, week: null }), []);
  const timers = { toma: {}, sueno: {} };
  assert.deepEqual(run({ timers }).map(a => a.type), ['photo']);
  assert.deepEqual(run({ data: { ...data, fotos: [{ semana: 25, categoria: 'panal' }] }, timers }).map(a => a.type), ['photo']);
  assert.deepEqual(run({ data: { ...data, fotos: [{ semana: 25 }] }, timers }), []);
});
test('A fresh wake log supersedes the earlier sleep end and stale wake logs are ignored', () => {
  assert.ok(!run({ timers: { vigilia: { inicio: before(12) } } }).some(a => a.type === 'sleep'));
  assert.ok(!run({ data: { ...data, suenos: [{ fin: before(1441) }] } }).some(a => a.type === 'sleep'));
  assert.ok(!run({ prefs: { ...prefs, sleepMinutes: 150 } }).some(a => a.type === 'sleep'));
});
test('Weekly photo reminder has one occurrence, does not backfill, and stops on the current photo', () => {
  const prefs = { photo:true, quiet:false };
  const one = run({prefs, week:25})[0];
  const nextDay = run({prefs, week:25, now:+date+24*3600000})[0];
  assert.equal(one.id,nextDay.id);
  assert.notEqual(one.id,run({prefs,week:26})[0].id);
  assert.equal(run({prefs,week:26,data:{ ...data,fotos:[{semana:25}] }})[0].id,'photo:26');
  assert.deepEqual(run({prefs,week:26,data:{ ...data,fotos:[{semana:26}] }}),[]);
});
test('Push photo job belongs only to the current age week and expires at rollover', () => {
  const weekStart=+new Date(2026,10,18,10), weekEnd=weekStart+7*86400000;
  const prefs={photo:true,quiet:true,from:'21:00',to:'08:00'};
  const upcoming=R.pushPlan({data:{fotos:[{semana:24}]},prefs,now:+date,week:25,weekStart,weekEnd});
  assert.equal(upcoming[0].id,'photo:25');
  assert.ok(upcoming[0].at<weekEnd && upcoming[0].expires<=weekEnd);
  assert.deepEqual(R.pushPlan({data:{fotos:[{semana:25}]},prefs,now:+date,week:25,weekStart,weekEnd}),[]);
  assert.deepEqual(R.pushPlan({data:{fotos:[]},prefs,now:weekEnd,week:25,weekStart,weekEnd}),[]);
  const nearEnd=+new Date(2026,10,24,22);
  assert.deepEqual(R.pushPlan({data:{fotos:[]},prefs,now:nearEnd,week:25,
    weekStart:nearEnd-7*86400000+3600000,weekEnd:nearEnd+3600000}),[]);
});
test('Quiet hours defer a pending feed reminder until silence ends', () => {
  const now=+new Date(2026,10,24,20);
  const a=R.pushPlan({data:{tomas:[{inicio:new Date(now-10*60000).toISOString()}]},
    prefs:{feed:true,feedHours:4},now})[0];
  assert.equal(new Date(a.at).getHours(),8);
  assert.equal(new Date(a.at).getDate(),25);
  assert.ok(a.expires<=a.at+900000);
});
