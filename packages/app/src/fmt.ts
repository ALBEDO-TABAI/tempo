// Date/time display formatting (locale-aware, original).
import { locale, t } from './i18n';
import { toWall, ymd, weekday as wdOf, DayNum, dayOf } from '@tempo/core';

const TH = '\u2009', HAIR = '\u200a';
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_EN2 = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WD_TW = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const WD_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const zh = () => locale() !== 'en';
export const wdShort = (wd: number) => (locale() === 'en' ? WD_EN[wd] : locale() === 'zh-TW' ? WD_TW[wd] : WD_CN[wd]);
export const wdMini = (wd: number) => (locale() === 'en' ? WD_EN2[wd] : wdShort(wd));
export const monthName = (m: number) => (zh() ? MON_ZH[m - 1] : MON_EN[m - 1]);
export const monthShort = (m: number) => (zh() ? MON_ZH[m - 1] : MON_EN[m - 1].slice(0, 3));
export function titleFor(day: DayNum) { const { y, m } = ymd(day); return `${monthName(m)} ${y}`; }
export function miniTitle(day: DayNum) { const { y, m } = ymd(day); return zh() ? `${y}${monthName(m)}` : `${monthName(m)} ${y}`; }
export function longDate(day: DayNum) {
  const { y, m, d } = ymd(day); const wd = wdOf(day);
  if (zh()) return `${monthName(m)} ${d} 日 ${wdShort(wd)}`;
  return `${WD_EN[wd]}, ${MON_EN[m - 1].slice(0, 3)} ${d}${y !== new Date().getFullYear() ? `, ${y}` : ''}`;
}
/** Grid hour label: 1 AM … 11 PM (or 13:00 in 24 h). */
export function hourLabel(h: number, h24: boolean) {
  if (h24) return `${String(h).padStart(2, '0')}:00`;
  const ap = h < 12 ? 'AM' : 'PM'; const hh = h % 12 || 12;
  return zh() ? `${ap}${hh}` : `${hh}${TH}${ap}`;
}
function hm(h: number, mi: number, h24: boolean, withAp = true) {
  if (h24) return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  const hh = h % 12 || 12; const s = mi ? `${hh}:${String(mi).padStart(2, '0')}` : `${hh}`;
  return withAp ? `${s}${TH}${h < 12 ? 'AM' : 'PM'}` : s;
}
export function timeOf(ms: number, tz: string, h24: boolean) { const w = toWall(ms, tz); return hm(w.h, w.mi, h24); }
export function timeOfFull(ms: number, tz: string, h24: boolean) {
  const w = toWall(ms, tz); if (h24) return hm(w.h, w.mi, true);
  return `${w.h % 12 || 12}:${String(w.mi).padStart(2, '0')}${TH}${w.h < 12 ? 'AM' : 'PM'}`;
}
/** Chip range: "9 – 11:30 AM", "11 AM – 12 PM". */
export function rangeOf(s: number, e: number, tz: string, h24: boolean) {
  const a = toWall(s, tz), b = toWall(e, tz);
  const sameAp = (a.h < 12) === (b.h < 12) && !h24;
  return `${hm(a.h, a.mi, h24, !sameAp)}${HAIR}–${HAIR}${hm(b.h, b.mi, h24)}`;
}
export function panelTime(ms: number, tz: string, h24: boolean) {
  const w = toWall(ms, tz); if (h24) return hm(w.h, w.mi, true);
  const ap = w.h < 12 ? 'AM' : 'PM'; const hh = w.h % 12 || 12; const s = w.mi ? `${hh}:${String(w.mi).padStart(2, '0')}` : `${hh}`;
  return zh() ? `${ap} ${s}` : `${s} ${ap}`;
}
export function durationLabel(min: number, tk: (k: any, v?: any) => string) {
  if (min < 60) return tk('durationMin', { n: min });
  const h = Math.floor(min / 60), m = min % 60;
  return m ? tk('durationHM', { h, m }) : tk('durationH', { n: h });
}
export function gmtLabel(tz: string, ms = Date.now()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(ms).find((x) => x.type === 'timeZoneName')?.value || 'GMT';
  return p.toUpperCase();
}

/** Localised one-line description of an RRULE (panel + repeat menu). */
export function ruleLabel(r: import('@tempo/core').RRule): string {
  const units: Record<string, [string, string]> = { DAILY: [t('uDay'), t('uDays')], WEEKLY: [t('uWeek'), t('uWeeks')], MONTHLY: [t('uMonth'), t('uMonths')], YEARLY: [t('uYear'), t('uYears')] };
  const [one, many] = units[r.freq] ?? [r.freq.toLowerCase(), r.freq.toLowerCase()];
  const zhL = locale() !== 'en';
  let s: string;
  if (r.freq === 'DAILY' && r.interval === 1 && !r.byDay?.length) s = t('daily');
  else if (r.freq === 'WEEKLY' && r.interval === 1 && r.byDay?.length === 5 && [1, 2, 3, 4, 5].every((d) => r.byDay!.some((b) => b.wd === d))) s = t('weekdays');
  else {
    s = r.interval === 1 ? (zhL ? `${t('every')}${one}` : `${t('every')} ${one}`) : t('ruleEvery', { n: r.interval, u: many });
    if (r.byDay?.length) {
      const ord = t('ordN').split('|');
      const ds = r.byDay.map((b) => (b.n ? (b.n === -1 ? ord[4] : ord[b.n - 1] ?? `${b.n}`) + (zhL ? '' : ' ') : '') + wdShort(b.wd)).join(zhL ? '、' : ', ');
      s += t('ruleOn', { d: ds });
    } else if (r.byMonthDay?.length) s += zhL ? ` ${r.byMonthDay.join('、')} 日` : ` on day ${r.byMonthDay.join(', ')}`;
  }
  if (r.count) s += t('ruleCount', { n: r.count });
  else if (r.until !== undefined) s += t('ruleUntil', { d: r.untilIsDate ? longDate(r.until) : longDate(dayOf(r.until, Intl.DateTimeFormat().resolvedOptions().timeZone)) });
  return s;
}
