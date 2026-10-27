// RFC 5545 recurrence rules: parse, serialise, expand. Original implementation.
// Expansion runs on wall-clock dates in the event's zone (or floating for all-day) and converts to instants.
import { DayNum, dayNum, ymd, weekday, daysInMonth, startOfWeek, isLeap } from './dates';
import { fromWall, toWall, UTC } from './tz';

export type Freq = 'SECONDLY' | 'MINUTELY' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export interface ByDay { wd: number; n?: number }
export interface RRule {
  freq: Freq; interval: number; count?: number;
  /** UNTIL as epoch ms (timed) or day number (all-day) */
  until?: number; untilIsDate?: boolean;
  byDay?: ByDay[]; byMonthDay?: number[]; byMonth?: number[]; byYearDay?: number[]; byWeekNo?: number[];
  bySetPos?: number[]; byHour?: number[]; byMinute?: number[]; bySecond?: number[]; wkst: number;
}

export function parseRRule(src: string): RRule {
  const s = src.replace(/^RRULE:/i, '').trim();
  const r: RRule = { freq: 'DAILY', interval: 1, wkst: 1 };
  const nums = (v: string) => v.split(',').filter(Boolean).map(Number);
  for (const part of s.split(';')) {
    const [k0, v = ''] = part.split('='); const k = k0.toUpperCase();
    switch (k) {
      case 'FREQ': r.freq = v.toUpperCase() as Freq; break;
      case 'INTERVAL': r.interval = Math.max(1, +v || 1); break;
      case 'COUNT': r.count = +v; break;
      case 'UNTIL': {
        const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
        if (m) {
          if (m[4] === undefined) { r.until = dayNum(+m[1], +m[2], +m[3]); r.untilIsDate = true; }
          else r.until = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        }
        break;
      }
      case 'BYDAY': r.byDay = v.split(',').filter(Boolean).map((x) => { const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(x.trim())!; return { wd: WD.indexOf(m[2].toUpperCase() as typeof WD[number]), n: m[1] ? +m[1] : undefined }; }); break;
      case 'BYMONTHDAY': r.byMonthDay = nums(v); break;
      case 'BYMONTH': r.byMonth = nums(v); break;
      case 'BYYEARDAY': r.byYearDay = nums(v); break;
      case 'BYWEEKNO': r.byWeekNo = nums(v); break;
      case 'BYSETPOS': r.bySetPos = nums(v); break;
      case 'BYHOUR': r.byHour = nums(v); break;
      case 'BYMINUTE': r.byMinute = nums(v); break;
      case 'BYSECOND': r.bySecond = nums(v); break;
      case 'WKST': r.wkst = Math.max(0, WD.indexOf(v.toUpperCase() as typeof WD[number])); break;
    }
  }
  return r;
}

const p2 = (n: number) => String(n).padStart(2, '0');
export function formatUntil(r: RRule): string | undefined {
  if (r.until === undefined) return undefined;
  if (r.untilIsDate) { const d = ymd(r.until); return `${d.y}${p2(d.m)}${p2(d.d)}`; }
  const d = new Date(r.until);
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
}
export function stringifyRRule(r: RRule): string {
  const out = [`FREQ=${r.freq}`];
  if (r.interval > 1) out.push(`INTERVAL=${r.interval}`);
  if (r.count !== undefined) out.push(`COUNT=${r.count}`);
  const u = formatUntil(r); if (u) out.push(`UNTIL=${u}`);
  if (r.byDay?.length) out.push(`BYDAY=${r.byDay.map((b) => (b.n ? b.n : '') + WD[b.wd]).join(',')}`);
  if (r.byMonthDay?.length) out.push(`BYMONTHDAY=${r.byMonthDay.join(',')}`);
  if (r.byMonth?.length) out.push(`BYMONTH=${r.byMonth.join(',')}`);
  if (r.byYearDay?.length) out.push(`BYYEARDAY=${r.byYearDay.join(',')}`);
  if (r.byWeekNo?.length) out.push(`BYWEEKNO=${r.byWeekNo.join(',')}`);
  if (r.bySetPos?.length) out.push(`BYSETPOS=${r.bySetPos.join(',')}`);
  if (r.byHour?.length) out.push(`BYHOUR=${r.byHour.join(',')}`);
  if (r.byMinute?.length) out.push(`BYMINUTE=${r.byMinute.join(',')}`);
  if (r.bySecond?.length) out.push(`BYSECOND=${r.bySecond.join(',')}`);
  if (r.wkst !== 1) out.push(`WKST=${WD[r.wkst]}`);
  return out.join(';');
}

/** nth weekday-of-period selection; days = ordered list of day numbers in period */
function nthWeekdays(days: DayNum[], byDay: ByDay[]): DayNum[] {
  const out: DayNum[] = [];
  for (const b of byDay) {
    const matching = days.filter((d) => weekday(d) === b.wd);
    if (b.n === undefined) out.push(...matching);
    else { const i = b.n > 0 ? b.n - 1 : matching.length + b.n; if (matching[i] !== undefined) out.push(matching[i]); }
  }
  return out;
}
function range(a: number, b: number): number[] { const r: number[] = []; for (let i = a; i <= b; i++) r.push(i); return r; }
function monthDays(y: number, m: number): DayNum[] { const s = dayNum(y, m, 1); return range(0, daysInMonth(y, m) - 1).map((i) => s + i); }
function resolveMonthDay(y: number, m: number, md: number): DayNum | null {
  const n = daysInMonth(y, m); const d = md > 0 ? md : n + md + 1;
  return d >= 1 && d <= n ? dayNum(y, m, d) : null;
}
/** ISO-style week number relative to wkst for BYWEEKNO */
function weekNo(d: DayNum, wkst: number): { year: number; week: number } {
  const { y } = ymd(d);
  const firstWeekStart = (yy: number) => { const jan4 = dayNum(yy, 1, 4); return startOfWeek(jan4, wkst); };
  let ys = firstWeekStart(y);
  let yr = y;
  if (d < ys) { yr = y - 1; ys = firstWeekStart(yr); } else { const next = firstWeekStart(y + 1); if (d >= next) { yr = y + 1; ys = next; } }
  return { year: yr, week: Math.floor((d - ys) / 7) + 1 };
}

/** Candidate dates of one period, before BYSETPOS. */
function periodDates(r: RRule, period: DayNum, dt: { d: DayNum; md: number; m: number; wd: number }): DayNum[] {
  const { y, m } = ymd(period);
  let days: DayNum[] = [];
  switch (r.freq) {
    case 'YEARLY': {
      if (r.byMonth?.length) {
        for (const mm of [...r.byMonth].sort((a, b) => a - b)) {
          const md = monthDays(y, mm);
          if (r.byMonthDay?.length || r.byDay?.length) {
            let sel = md;
            if (r.byMonthDay?.length) sel = r.byMonthDay.map((x) => resolveMonthDay(y, mm, x)).filter((x): x is number => x !== null);
            if (r.byDay?.length) sel = r.byMonthDay?.length ? sel.filter((d) => r.byDay!.some((b) => weekday(d) === b.wd)) : nthWeekdays(md, r.byDay);
            days.push(...sel);
          } else { const d = resolveMonthDay(y, mm, dt.md); if (d !== null) days.push(d); }
        }
      } else {
        const yearDays = range(0, (isLeap(y) ? 366 : 365) - 1).map((i) => dayNum(y, 1, 1) + i);
        if (r.byYearDay?.length) days = r.byYearDay.map((n) => (n > 0 ? yearDays[n - 1] : yearDays[yearDays.length + n])).filter((x) => x !== undefined);
        else if (r.byWeekNo?.length) {
          days = yearDays.concat(range(1, 7).map((i) => yearDays[yearDays.length - 1] + i), range(1, 7).map((i) => yearDays[0] - 8 + i)).filter((d) => {
            const w = weekNo(d, r.wkst); return w.year === y && r.byWeekNo!.includes(w.week);
          });
          if (r.byDay?.length) days = days.filter((d) => r.byDay!.some((b) => weekday(d) === b.wd));
          else days = days.filter((d) => weekday(d) === dt.wd);
        } else if (r.byMonthDay?.length) {
          for (let mm = 1; mm <= 12; mm++) for (const x of r.byMonthDay) { const d = resolveMonthDay(y, mm, x); if (d !== null) days.push(d); }
          if (r.byDay?.length) days = days.filter((d) => r.byDay!.some((b) => weekday(d) === b.wd));
        } else if (r.byDay?.length) days = nthWeekdays(yearDays, r.byDay);
        else { const d = resolveMonthDay(y, dt.m, dt.md); if (d !== null) days.push(d); }
      }
      break;
    }
    case 'MONTHLY': {
      if (r.byMonth?.length && !r.byMonth.includes(m)) return [];
      const md = monthDays(y, m);
      if (r.byMonthDay?.length) {
        days = r.byMonthDay.map((x) => resolveMonthDay(y, m, x)).filter((x): x is number => x !== null);
        if (r.byDay?.length) days = days.filter((d) => r.byDay!.some((b) => weekday(d) === b.wd));
      } else if (r.byDay?.length) days = nthWeekdays(md, r.byDay);
      else { const d = resolveMonthDay(y, m, dt.md); if (d !== null && dt.md <= daysInMonth(y, m)) days.push(d); }
      break;
    }
    case 'WEEKLY': {
      const wk = range(0, 6).map((i) => period + i);
      days = r.byDay?.length ? wk.filter((d) => r.byDay!.some((b) => weekday(d) === b.wd)) : wk.filter((d) => weekday(d) === dt.wd);
      if (r.byMonth?.length) days = days.filter((d) => r.byMonth!.includes(ymd(d).m));
      break;
    }
    default: { // DAILY and sub-daily periods are a single day here
      days = [period];
      if (r.byMonth?.length) days = days.filter((d) => r.byMonth!.includes(ymd(d).m));
      if (r.byMonthDay?.length) days = days.filter((d) => { const q = ymd(d); return r.byMonthDay!.some((x) => resolveMonthDay(q.y, q.m, x) === d); });
      if (r.byDay?.length) days = days.filter((d) => r.byDay!.some((b) => weekday(d) === b.wd));
    }
  }
  return [...new Set(days)].sort((a, b) => a - b);
}

function nextPeriod(r: RRule, p: DayNum): DayNum {
  const { y, m } = ymd(p);
  switch (r.freq) {
    case 'YEARLY': return dayNum(y + r.interval, 1, 1);
    case 'MONTHLY': { const t = y * 12 + (m - 1) + r.interval; return dayNum(Math.floor(t / 12), (t % 12) + 1, 1); }
    case 'WEEKLY': return p + 7 * r.interval;
    default: return p + r.interval;
  }
}
function firstPeriod(r: RRule, d: DayNum): DayNum {
  const { y, m } = ymd(d);
  switch (r.freq) {
    case 'YEARLY': return dayNum(y, 1, 1);
    case 'MONTHLY': return dayNum(y, m, 1);
    case 'WEEKLY': return startOfWeek(d, r.wkst);
    default: return d;
  }
}

export interface ExpandInput {
  rule: RRule | string;
  /** first occurrence: epoch ms for timed events, day number for all-day */
  dtstart: number;
  allDay: boolean;
  timeZone?: string;
  exdates?: number[]; rdates?: number[];
}
/**
 * Occurrence starts (ms for timed, day numbers for all-day) within [from, to). COUNT is honoured from the
 * series start regardless of the window. `limit` caps work for open-ended rules.
 */
export function expand(inp: ExpandInput, from: number, to: number, limit = 5000): number[] {
  const r = typeof inp.rule === 'string' ? parseRRule(inp.rule) : inp.rule;
  const tz = inp.timeZone || UTC;
  const startDay = inp.allDay ? inp.dtstart : (() => { const w = toWall(inp.dtstart, tz); return dayNum(w.y, w.m, w.d); })();
  const wall = inp.allDay ? null : toWall(inp.dtstart, tz);
  const sd = ymd(startDay);
  const dt = { d: startDay, md: sd.d, m: sd.m, wd: weekday(startDay) };
  const times: [number, number, number][] = [];
  if (!inp.allDay) {
    const hs = r.byHour?.length ? r.byHour : [wall!.h];
    const ms = r.byMinute?.length ? r.byMinute : [wall!.mi];
    const ss = r.bySecond?.length ? r.bySecond : [wall!.s];
    for (const h of hs) for (const mi of ms) for (const s of ss) times.push([h, mi, s]);
    times.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  }
  const ex = new Set(inp.exdates ?? []);
  const out: number[] = [];
  let emitted = 0; let p = firstPeriod(r, startDay); let guard = 0;
  const instantOf = (d: DayNum, t?: [number, number, number]) => {
    if (inp.allDay) return d;
    const q = ymd(d); return fromWall({ y: q.y, m: q.m, d: q.d, h: t![0], mi: t![1], s: t![2] }, tz);
  };
  const pastEnd = (v: number) => {
    if (r.until === undefined) return false;
    if (inp.allDay) return v > (r.untilIsDate ? r.until : Math.floor(r.until / 86400000));
    if (r.untilIsDate) { const w = toWall(v, tz); return dayNum(w.y, w.m, w.d) > r.until; }
    return v > r.until;
  };
  outer: while (guard++ < 100000) {
    let cands: number[] = [];
    for (const d of periodDates(r, p, dt)) {
      if (inp.allDay) cands.push(d); else for (const t of times) cands.push(instantOf(d, t));
    }
    if (r.bySetPos?.length) {
      const n = cands.length;
      cands = [...new Set(r.bySetPos.map((i) => (i > 0 ? cands[i - 1] : cands[n + i])).filter((x) => x !== undefined))].sort((a, b) => a - b);
    }
    for (const v of cands) {
      if (v < inp.dtstart) continue;
      if (pastEnd(v)) break outer;
      emitted++;
      if (r.count !== undefined && emitted > r.count) break outer;
      if (v >= to) break outer;
      if (v >= from && !ex.has(v)) { out.push(v); if (out.length >= limit) break outer; }
    }
    p = nextPeriod(r, p);
    // stop when period start already beyond the window and no COUNT bookkeeping is needed
    const pStart = inp.allDay ? p : instantOf(p, [0, 0, 0]);
    if (pStart >= to + 86400000 * 2) break;
  }
  // first occurrence is always DTSTART even if it does not match the rule (RFC 5545 §3.8.5.3)
  if (inp.dtstart >= from && inp.dtstart < to && !ex.has(inp.dtstart) && !out.includes(inp.dtstart)) out.unshift(inp.dtstart);
  for (const rd of inp.rdates ?? []) if (rd >= from && rd < to && !ex.has(rd) && !out.includes(rd)) out.push(rd);
  return out.sort((a, b) => a - b);
}

/** Human description used in the repeat picker ("Every week on Mon, Wed"). */
export function describe(r: RRule, names = { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }): string {
  const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year', HOURLY: 'hour', MINUTELY: 'minute', SECONDLY: 'second' }[r.freq];
  let s = r.interval > 1 ? `Every ${r.interval} ${unit}s` : `Every ${unit}`;
  if (r.byDay?.length) s += ' on ' + r.byDay.map((b) => (b.n ? `${b.n === -1 ? 'last' : ordinal(b.n)} ` : '') + names.day[b.wd]).join(', ');
  if (r.byMonthDay?.length) s += ' on day ' + r.byMonthDay.join(', ');
  if (r.count) s += `, ${r.count} times`;
  return s;
}
function ordinal(n: number): string { return ['', '1st', '2nd', '3rd', '4th', '5th'][n] ?? `${n}th`; }
