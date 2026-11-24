/* Foreground, device-local logging reminders. No medical inference or background timers. */
const MayaReminders = (() => {
  const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
  const defaults = Object.freeze({
    sleep: false, feed: false, poop: false, wet: false, photo: false,
    sleepMinutes: 0, feedHours: 4, poopHours: 24, wetHours: 6,
    quiet: true, from: '21:00', to: '09:00', system: false,
  });
  const bound = (n, min, max, fallback) => n !== '' && n != null && Number.isFinite(+n)
    ? Math.max(min, Math.min(max, +n)) : fallback;
  const validTime = v => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v || '');
  function settings(raw = {}) {
    if (!raw || typeof raw !== 'object') raw = {};
    const out = { ...defaults };
    for (const k of ['sleep', 'feed', 'poop', 'wet', 'photo', 'quiet', 'system']) {
      if (typeof raw[k] === 'boolean') out[k] = raw[k];
    }
    out.sleepMinutes = bound(raw.sleepMinutes, 0, 720, 0);
    out.feedHours = bound(raw.feedHours, 0.5, 48, 4);
    out.poopHours = bound(raw.poopHours, 1, 168, 24);
    out.wetHours = bound(raw.wetHours, 1, 48, 6);
    for (const k of ['from', 'to']) if (validTime(raw[k])) out[k] = raw[k];
    return out;
  }
  function isQuiet(prefs, date) {
    if (!prefs.quiet) return false;
    const time = date.getHours() * 60 + date.getMinutes();
    const asMin = s => +s.slice(0, 2) * 60 + +s.slice(3);
    const from = asMin(prefs.from), to = asMin(prefs.to);
    if (from === to) return true; // identical limits mean silence all day
    return from < to ? time >= from && time < to : time >= from || time < to;
  }
  const timestamp = value => value ? Date.parse(value) : NaN;
  function latest(items, field, limit, filter = () => true) {
    return (items || []).reduce((max, e) => {
      const t = timestamp(e[field]);
      return filter(e) && t <= limit && (!Number.isFinite(max) || t > max) ? t : max;
    }, NaN);
  }
  const windDownLead = 15 * MINUTE;
  const automaticLimit = sleepMin => Number.isFinite(sleepMin) && sleepMin > 0 && sleepMin < 1440 ? sleepMin * MINUTE : NaN;
  function pumpingReminder(timer) {
    const start = timestamp(timer?.inicio), minutes = timer?.reminderMinutes;
    if (!Number.isFinite(start) || !Number.isInteger(minutes) || minutes < 1 || minutes > 120) return null;
    const dueAt = start + minutes * MINUTE;
    return {id:'pump:'+start+':'+minutes, since:start, dueAt, deadline:dueAt+10*MINUTE};
  }
  function due({ data, timers = {}, prefs: raw, now = Date.now(), sleepMin, week }) {
    const prefs = settings(raw);
    if (!data) return [];
    const r = [];
    function event(type, when, span) {
      // No records, no reminder. Prevents interpreting missing history as a health event.
      if (prefs[type] && Number.isFinite(when) && Number.isFinite(span) && span > 0 && now - when >= span)
        r.push({ type, id: type + ':' + when, elapsed: now - when });
    }
    const pump = pumpingReminder(timers.extraccion);
    if (pump && pump.since <= now && pump.dueAt <= now && now < pump.deadline) r.push({id:pump.id,type:'pump'});
    if (isQuiet(prefs, new Date(now))) return r;
    if (!timers.toma) event('feed', latest(data.tomas, 'inicio', now), prefs.feedHours * HOUR);
    const diaper = (type, span) => event(type, latest(data.panales, 'hora', now,
      p => p.tipo === ({ poop: 'popo', wet: 'pipi' })[type] || p.tipo === 'mixto'), span * HOUR);
    diaper('poop', prefs.poopHours);
    diaper('wet', prefs.wetHours);
    if (!timers.sueno) {
      const wake = timestamp(timers.vigilia?.inicio);
      const previous = latest(data.suenos, 'fin', now, s => s.tipo !== 'vigilia');
      const since = Math.max(wake <= now ? wake : -Infinity, Number.isFinite(previous) ? previous : -Infinity);
      // Snooze stale wake-window alerts if the last logged wake was ages ago.
      if (prefs.sleepMinutes > 0) {
        if (now - since < DAY) event('sleep', since, prefs.sleepMinutes * MINUTE);
      } else {
        const limit = automaticLimit(sleepMin), elapsed = now - since;
        if (prefs.sleep && Number.isFinite(since) && elapsed >= Math.max(0, limit - windDownLead) && elapsed < limit)
          r.push({type:'sleep',id:'sleep:'+since,elapsed,windDown:true});
      }
    }
    if (prefs.photo && Number.isInteger(week) && week >= 0 &&
      !(data.fotos || []).some(p => p.categoria !== 'panal' && Number.isInteger(p.semana) && p.semana === week)) {
      r.push({ type: 'photo', id: 'photo:' + week });
    }
    return r;
  }
  function nextAllowed(prefs, earliest) {
    if (!isQuiet(prefs, new Date(earliest))) return earliest;
    if (prefs.from === prefs.to) return null;
    const [hour, minute] = prefs.to.split(':').map(Number);
    const target = new Date(earliest);
    target.setHours(hour, minute, 0, 0);
    if (+target <= earliest) target.setDate(target.getDate() + 1);
    return isQuiet(prefs, target) ? null : +target;
  }

  function pushPlan({data, timers = {}, prefs:raw, now = Date.now(), sleepMin, week, weekStart, weekEnd}) {
    const prefs = settings(raw), out = [];
    if (!data) return out;
    function add(type, key, dueAt, deadline, windDown = false) {
      if (!prefs[type] || !Number.isFinite(dueAt) || !Number.isFinite(deadline) || deadline <= now) return;
      const at = nextAllowed(prefs, Math.max(dueAt, now + 15000));
      if (at === null || at >= deadline || at > now + 14*DAY) return;
      out.push({...(windDown ? {windDown:true} : {}),id:type + ':' + key, type, since:type === 'photo' ? null : key,
        week:type === 'photo' ? key : null, dueAt, at, deadline, expires:Math.min(at + 15*MINUTE, deadline)});
    }
    const span = (type, since, elapsed, stale) => {
      if (Number.isFinite(since) && Number.isFinite(elapsed) && elapsed > 0)
        add(type, since, since + elapsed, since + elapsed + stale);
    };
    const pump = pumpingReminder(timers.extraccion);
    if (pump && pump.since <= now && now < pump.deadline) {
      const at = Math.max(pump.dueAt, now+15000);
      if (at < pump.deadline)
        out.push({...pump,type:'pump',at,expires:pump.deadline});
    }
    if (!timers.toma) span('feed', latest(data.tomas,'inicio',now), prefs.feedHours*HOUR, DAY);
    const diaper = (type, hours, kind) => span(type, latest(data.panales,'hora',now,
      p => p.tipo === kind || p.tipo === 'mixto'), hours*HOUR, DAY);
    diaper('poop',prefs.poopHours,'popo'); diaper('wet',prefs.wetHours,'pipi');
    if (!timers.sueno) {
      const wake = timestamp(timers.vigilia?.inicio);
      const previous = latest(data.suenos,'fin',now,s => s.tipo !== 'vigilia');
      const since = Math.max(wake <= now ? wake : -Infinity, Number.isFinite(previous) ? previous : -Infinity);
      if (prefs.sleepMinutes > 0) {
        const duration = prefs.sleepMinutes * MINUTE;
        if (duration < DAY) span('sleep',since,duration,DAY-duration);
      } else {
        const limit = automaticLimit(sleepMin);
        add('sleep',since,since+Math.max(0,limit-windDownLead),since+limit,true);
      }
    }
    if (Number.isInteger(week) && week >= 0 && weekStart <= now && now < weekEnd &&
      !(data.fotos || []).some(p => p.categoria !== 'panal' && p.semana === week)) {
      add('photo',week,weekStart + 4*DAY,weekEnd);
    }
    return out;
  }
  return { settings, isQuiet, due, pushPlan };
})();
if (typeof module !== 'undefined') module.exports = MayaReminders;
