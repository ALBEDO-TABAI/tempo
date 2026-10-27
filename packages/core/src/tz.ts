// Time-zone conversion built on Intl (no tz database bundled). All instants are epoch milliseconds.
import { DayNum, dayNum, ymd } from './dates';

export interface Wall { y: number; m: number; d: number; h: number; mi: number; s: number }

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    fmtCache.set(tz, f);
  }
  return f;
}
export const UTC = 'UTC';
export function isValidTimeZone(tz: string): boolean {
  try { fmt(tz); return true; } catch { return false; }
}
export function systemTimeZone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone || UTC; }

/** Wall-clock fields of an instant in a zone. */
export function toWall(ms: number, tz: string): Wall {
  if (tz === UTC) {
    const d = new Date(ms);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
  }
  const p: Record<string, number> = {};
  for (const part of fmt(tz).formatToParts(new Date(ms))) if (part.type !== 'literal') p[part.type] = +part.value;
  return { y: p.year, m: p.month, d: p.day, h: p.hour === 24 ? 0 : p.hour, mi: p.minute, s: p.second };
}
/** Offset of zone from UTC at an instant, in minutes (east positive). */
export function offsetMinutes(ms: number, tz: string): number {
  const w = toWall(ms, tz);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}
/**
 * Instant for a wall-clock time in a zone. Ambiguous times (DST fall-back) resolve to the earlier
 * instant; non-existent times (spring-forward gap) are shifted forward by the gap, like RFC 5545.
 */
export function fromWall(w: Partial<Wall> & { y: number; m: number; d: number }, tz: string): number {
  const naive = Date.UTC(w.y, w.m - 1, w.d, w.h ?? 0, w.mi ?? 0, w.s ?? 0);
  if (tz === UTC) return naive;
  const oBefore = offsetMinutes(naive - 86400000, tz);
  const oAfter = offsetMinutes(naive + 86400000, tz);
  const want = (x: number) => { const r = toWall(x, tz); return Date.UTC(r.y, r.m - 1, r.d, r.h, r.mi, r.s) === naive; };
  const c1 = naive - oBefore * 60000, c2 = naive - oAfter * 60000;
  const ok1 = want(c1), ok2 = want(c2);
  if (ok1 && ok2) return Math.min(c1, c2);
  if (ok1) return c1;
  if (ok2) return c2;
  // inside a spring-forward gap: interpret with the pre-transition offset (shifts later by the gap)
  return c1;
}
/** Calendar date (day number) of an instant in a zone. */
export function dayOf(ms: number, tz: string): DayNum { const w = toWall(ms, tz); return dayNum(w.y, w.m, w.d); }
/** Instant of local midnight starting a day in a zone. */
export function startOfDayMs(day: DayNum, tz: string): number { const { y, m, d } = ymd(day); return fromWall({ y, m, d }, tz); }
/** Minutes since local midnight. */
export function minutesOfDay(ms: number, tz: string): number { const w = toWall(ms, tz); return w.h * 60 + w.mi + w.s / 60; }

/** Short zone label like "GMT+9" / "EST" using the platform. */
export function zoneAbbrev(tz: string, ms = Date.now(), locale = 'en-US'): string {
  try {
    const p = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(ms));
    return p.find((x) => x.type === 'timeZoneName')?.value ?? tz;
  } catch { return tz; }
}
export function zoneCity(tz: string): string { return (tz.split('/').pop() || tz).replace(/_/g, ' '); }
