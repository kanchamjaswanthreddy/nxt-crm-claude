// Time helpers for the shared calendar. Repeating events and booking slots are worked out in the
// organiser's own time zone, so "every Monday 9:00" stays at 9:00 when clocks change.

const partsIn = (date, tz) => {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
};

export function safeTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return 'America/New_York'; }
}

/** Wall-clock time in a zone (month 1-12; day may overflow, e.g. 32) -> the real instant. */
export function wallToUtc(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess;
  for (let i = 0; i < 2; i++) { const p = partsIn(new Date(t), tz); t = guess - (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - t); }
  return new Date(t);
}

export const wallParts = partsIn;
export const dateKey = (date, tz) => { const p = partsIn(date, tz); return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };

const STEP = { daily: { d: 1 }, weekly: { d: 7 }, biweekly: { d: 14 }, monthly: { m: 1 } };
export const REPEAT_FREQS = Object.keys(STEP);

/**
 * All occurrences of an event that touch [from, to]. A one-off event yields itself.
 * Each item: { start: Date, end: Date, occ: 'YYYY-MM-DD' } (occ = the occurrence's start date in the organiser's zone).
 */
export function occurrences(ev, from, to) {
  const start = new Date(ev.start); const end = new Date(ev.end); const dur = end - start;
  const tz = safeTz(ev.tz || 'America/New_York');
  const hit = (s) => s.getTime() <= to.getTime() && s.getTime() + dur >= from.getTime();
  if (!ev.repeat || !STEP[ev.repeat.freq]) return hit(start) ? [{ start, end, occ: dateKey(start, tz) }] : [];
  const step = STEP[ev.repeat.freq]; const base = partsIn(start, tz);
  const until = ev.repeat.until ? wallToUtc(+ev.repeat.until.slice(0, 4), +ev.repeat.until.slice(5, 7), +ev.repeat.until.slice(8, 10), 23, 59, tz) : new Date(start.getTime() + 366 * 864e5);
  const skip = new Set(ev.skipDates || []); const out = [];
  for (let i = 0; i < 400; i++) {
    let day = base.d + (step.d || 0) * i; const month = base.mo + (step.m || 0) * i;
    if (step.m) day = Math.min(base.d, new Date(Date.UTC(base.y, month, 0)).getUTCDate()); // the 31st becomes the last day of shorter months
    const s = wallToUtc(base.y, month, day, base.h, base.mi, tz);
    if (s > until || s > to) break;
    const occ = dateKey(s, tz);
    if (hit(s) && !skip.has(occ)) out.push({ start: s, end: new Date(s.getTime() + dur), occ });
  }
  return out;
}
