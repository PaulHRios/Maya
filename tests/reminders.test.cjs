const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/reminders.js');
const date = new Date(2026, 10, 24, 10);
const before = mins => new Date(+date - mins * 60000).toISOString();
const data = { tomas: [{ inicio: before(240) }, { inicio: before(-10) }],
  panales: [{ tipo: 'popo', hora: before(1000) }, { tipo: 'mixto', hora: before(355) }],
  suenos: [{ tipo: 'vigilia', fin: before(1) }, { fin: before(89) }], fotos: [] };
const prefs = { sleep: true, feed: true, poop: true, wet: true, photo: true };
const run = (x = {}) => R.due({ data, prefs, now: +date, week: 25, sleepMin: 90, ...x });
test('Enabled alerts use latest valid entry, mixed counts for both diaper types', () => {
  assert.deepEqual(run().map(a => a.type), ['feed', 'sleep', 'photo']);
  assert.deepEqual(run({ prefs: { ...prefs, wetHours: 5, poopHours: 5 } }).map(a => a.type), ['feed', 'poop', 'wet', 'sleep', 'photo']);
  assert.equal(run()[0].elapsed, 4 * 3600000);
});
test('Quiet window crosses midnight and ends at the selected local time', () => {
  for (const hour of [0, 7, 8, 21, 23]) assert.equal(R.isQuiet(R.settings(), new Date(2026, 10, 24, hour)), true);
  for (const hour of [9, 20]) assert.equal(R.isQuiet(R.settings(), new Date(2026, 10, 24, hour)), false);
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
  assert.equal(new Date(a.at).getHours(),9);
  assert.equal(new Date(a.at).getDate(),25);
  assert.ok(a.expires<=a.at+900000);
});

test('quiet hours default to 9 PM–9 AM but keep a saved 8 AM end', () => {
  assert.equal(R.settings().from,'21:00');
  assert.equal(R.settings().to,'09:00');
  assert.equal(R.settings({to:'08:00'}).to,'08:00');
});

test('age-based wind-down starts 15 minutes early and expires at its age-specific lower bound', () => {
  const data = { suenos: [{ fin: before(75) }] };
  const opt = {data,prefs:{quiet:false,sleep:true},sleepMin:90};
  assert.equal(R.due({...opt,now:+date-1}).length, 0);
  assert.equal(R.due({...opt,now:+date})[0].windDown, true);
  assert.deepEqual(R.due({...opt,now:+date+15*60000}), []);
  assert.deepEqual(R.due({...opt,sleepMin:undefined,now:+date}), []);
  const planned=R.pushPlan({...opt,now:+date-60000})[0];
  assert.equal(planned.at,+date);
  assert.equal(planned.deadline,+date+15*60000);
  assert.equal(planned.windDown,true);
  assert.deepEqual(R.pushPlan({...opt,now:+date+15*60000}),[]);
  assert.deepEqual(R.pushPlan({...opt,now:+date,timers:{sueno:{}}}),[]);
  const custom={...opt,prefs:{...opt.prefs,sleepMinutes:90}};
  assert.equal(R.pushPlan({...custom,now:+date})[0].at,+date+15*60000);
  assert.equal(R.due({...custom,now:+date+15*60000})[0].windDown,undefined);
});
test('quiet hours defer automatic wind-down only if it still precedes the wake-window limit', () => {
  const now=+new Date(2026,10,24,8,45), wake=new Date(2026,10,24,7,40).toISOString();
  const opt={data:{suenos:[{fin:wake}]},prefs:{sleep:true},sleepMin:90,now};
  assert.equal(R.pushPlan(opt)[0].at,+new Date(2026,10,24,9));
  const expired={...opt,sleepMin:80};
  assert.deepEqual(R.pushPlan(expired),[]);
  assert.deepEqual(R.due({...expired,now:+new Date(2026,10,24,9)}),[]);
});

test('pumping reminder is optional, measured from session start, and stops when the timer ends', () => {
  const now=+date, inicio=new Date(now).toISOString(), prefs={quiet:false};
  const chosen={extraccion:{inicio,reminderMinutes:15}};
  const opt={data:{},prefs,now};
  assert.deepEqual(R.pushPlan({...opt,timers:{extraccion:{inicio}}}),[]);
  assert.deepEqual(R.due({...opt,timers:chosen}),[]);
  const job=R.pushPlan({...opt,timers:chosen})[0];
  assert.equal(job.type,'pump');assert.equal(job.at,now+15*60000);
  assert.equal(R.due({...opt,now:job.at,timers:chosen})[0].type,'pump');
  assert.deepEqual(R.pushPlan({...opt,now:job.at,timers:{}}),[]);
  assert.deepEqual(R.due({...opt,now:job.at,timers:{}}),[]);
  assert.deepEqual(R.pushPlan({...opt,now:job.deadline,timers:chosen}),[]);
  assert.deepEqual(R.due({...opt,now:job.deadline,timers:chosen}),[]);
});
test('only the selected pumping reminder bypasses Maya quiet hours at midnight',()=>{
  const now=+new Date(2026,10,24,23,55), due=+new Date(2026,10,25,0,5);
  const opt={data:{tomas:[{inicio:new Date(now-6*3600000).toISOString()}]},
    prefs:{feed:true},timers:{extraccion:{inicio:new Date(now).toISOString(),reminderMinutes:10}}};
  const jobs=R.pushPlan({...opt,now});
  assert.equal(jobs.find(j=>j.type==='pump').at,due);
  assert.equal(new Date(jobs.find(j=>j.type==='feed').at).getHours(),9);
  assert.deepEqual(R.due({...opt,now:due}).map(j=>j.type),['pump']);
  assert.deepEqual(R.due({...opt,now:+new Date(2026,10,25,0,15)}),[]);
});
