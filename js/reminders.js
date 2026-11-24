/* Foreground, device-local logging reminders. No medical inference or background timers. */
const MayaReminders = (() => {
  const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
  const defaults = Object.freeze({
    sleep: false, feed: false, poop: false, wet: false, photo: false,
    sleepMinutes: 0, feedHours: 4, poopHours: 24, wetHours: 6,
    quiet: true, from: '21:00', to: '08:00', system: false,
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
  function due({ data, timers = {}, prefs: raw, now = Date.now(), sleepMin, week }) {
    const prefs = settings(raw);
    if (!data || isQuiet(prefs, new Date(now))) return [];
    const r = [];
    function event(type, when, span) {
      // No records, no reminder. Prevents interpreting missing history as a health event.
      if (prefs[type] && Number.isFinite(when) && Number.isFinite(span) && span > 0 && now - when >= span)
        r.push({ type, id: type + ':' + when, elapsed: now - when });
    }
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
      if (now - since < DAY) event('sleep', since, (prefs.sleepMinutes || sleepMin) * MINUTE);
    }
    if (prefs.photo && Number.isInteger(week) && week >= 0 &&
      !(data.fotos || []).some(p => p.categoria !== 'panal' && Number.isInteger(p.semana) && p.semana === week)) {
      r.push({ type: 'photo', id: 'photo:' + week });
    }
    return r;
  }
  return { settings, isQuiet, due };
})();
if (typeof module !== 'undefined') module.exports = MayaReminders;
