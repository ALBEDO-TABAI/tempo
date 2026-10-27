// Calendar-date arithmetic on "day numbers" (days since 1970-01-01, proleptic Gregorian).
// Day numbers are time-zone free; they name a wall-calendar date.
export type DayNum = number;
export interface YMD { y: number; m: number; d: number } // m: 1-12

export function dayNum(y: number, m: number, d: number): DayNum {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
export function ymd(n: DayNum): YMD {
  const dt = new Date(n * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
/** 0 = Sunday … 6 = Saturday */
export function weekday(n: DayNum): number { return ((n % 7) + 7 + 4) % 7; }
export function daysInMonth(y: number, m: number): number { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
export function isLeap(y: number): boolean { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
export function startOfWeek(n: DayNum, weekStartsOn = 0): DayNum { return n - ((weekday(n) - weekStartsOn + 7) % 7); }
export function startOfMonth(n: DayNum): DayNum { const { y, m } = ymd(n); return dayNum(y, m, 1); }
export function addMonths(n: DayNum, k: number): DayNum {
  const { y, m, d } = ymd(n);
  const t = y * 12 + (m - 1) + k; const ny = Math.floor(t / 12), nm = (t % 12) + 1;
  return dayNum(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}
export function isoDate(n: DayNum): string {
  const { y, m, d } = ymd(n);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function parseIsoDate(s: string): DayNum {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s);
  if (!m) throw new Error(`bad date ${s}`);
  return dayNum(+m[1], +m[2], +m[3]);
}
/** ISO-8601 week number (weeks start Monday, week 1 contains Jan 4). */
export function isoWeek(n: DayNum): number {
  const thursday = n - ((weekday(n) + 6) % 7) + 3;
  const { y } = ymd(thursday);
  return Math.floor((thursday - dayNum(y, 1, 1)) / 7) + 1;
}
