// Parse loose date input: 2026-11-03, 11/3, 3 Nov, "tomorrow", "next friday", "+3".
import { DayNum, dayNum, ymd, weekday } from '@tempo/core';
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function parseDateInput(src: string, today: DayNum): DayNum | null {
  const s = src.trim().toLowerCase(); if (!s) return null;
  const { y } = ymd(today);
  if (/^(today|今天|今日)$/.test(s)) return today;
  if (/^(tomorrow|明天|明日)$/.test(s)) return today + 1;
  if (/^(yesterday|昨天|昨日)$/.test(s)) return today - 1;
  let m = /^([+-])\s*(\d+)\s*(d|w|day|days|week|weeks)?$/.exec(s);
  if (m) { const k = +m[2] * (m[3]?.startsWith('w') ? 7 : 1); return today + (m[1] === '-' ? -k : k); }
  m = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(s); if (m) return dayNum(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.月](\d{1,2})日?$/.exec(s); if (m) return dayNum(y, +m[1], +m[2]);
  m = /^(\d{1,2})\s+([a-z]{3})[a-z]*\.?(?:\s+(\d{4}))?$/.exec(s); if (m && MON.includes(m[2])) return dayNum(m[3] ? +m[3] : y, MON.indexOf(m[2]) + 1, +m[1]);
  m = /^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/.exec(s); if (m && MON.includes(m[1])) return dayNum(m[3] ? +m[3] : y, MON.indexOf(m[1]) + 1, +m[2]);
  m = /^(next\s+)?([a-z]{3})[a-z]*$/.exec(s);
  if (m && WD.includes(m[2])) { const w = WD.indexOf(m[2]); let d = today + ((w - weekday(today) + 7) % 7 || 7); if (m[1] && d - today < 7) d += 0; return d; }
  return null;
}
