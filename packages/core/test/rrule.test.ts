import { describe, it, expect } from 'vitest';
import { expand, parseRRule, stringifyRRule } from '../src/rrule';
import { fromWall, toWall } from '../src/tz';
import { dayNum, isoDate } from '../src/dates';
const NY = 'America/New_York';
const w = (ms: number, tz = NY) => { const x = toWall(ms, tz); return `${x.y}-${String(x.m).padStart(2, '0')}-${String(x.d).padStart(2, '0')} ${String(x.h).padStart(2, '0')}:${String(x.mi).padStart(2, '0')}`; };
const big = [Date.UTC(1990, 0, 1), Date.UTC(2040, 0, 1)] as const;
describe('rrule', () => {
  it('round-trips', () => {
    const s = 'FREQ=MONTHLY;INTERVAL=2;COUNT=10;BYDAY=1FR,-1MO;BYSETPOS=1;WKST=SU';
    expect(stringifyRRule(parseRRule(s))).toBe(s);
  });
  it('daily x10 (RFC 5545 example)', () => {
    const s = fromWall({ y: 1997, m: 9, d: 2, h: 9 }, NY);
    const r = expand({ rule: 'FREQ=DAILY;COUNT=10', dtstart: s, allDay: false, timeZone: NY }, ...big);
    expect(r.length).toBe(10); expect(w(r[9])).toBe('1997-09-11 09:00');
  });
  it('weekly on Tue,Thu for 5 weeks keeps 9:00 local across DST end', () => {
    const s = fromWall({ y: 1997, m: 9, d: 2, h: 9 }, NY);
    const r = expand({ rule: 'FREQ=WEEKLY;UNTIL=19971007T000000Z;WKST=SU;BYDAY=TU,TH', dtstart: s, allDay: false, timeZone: NY }, ...big);
    expect(r.map((x) => w(x).slice(5))).toEqual(['09-02 09:00', '09-04 09:00', '09-09 09:00', '09-11 09:00', '09-16 09:00', '09-18 09:00', '09-23 09:00', '09-25 09:00', '09-30 09:00', '10-02 09:00']);
    const s2 = fromWall({ y: 2026, m: 10, d: 30, h: 9 }, NY);
    const r2 = expand({ rule: 'FREQ=WEEKLY;COUNT=3', dtstart: s2, allDay: false, timeZone: NY }, ...big);
    expect(r2.map((x) => w(x))).toEqual(['2026-10-30 09:00', '2026-11-06 09:00', '2026-11-13 09:00']);
    expect(r2[1] - r2[0]).toBe(7 * 86400000 + 3600000); // 25-hour gap at fall-back
  });
  it('monthly first Friday x10', () => {
    const s = fromWall({ y: 1997, m: 9, d: 5, h: 9 }, NY);
    const r = expand({ rule: 'FREQ=MONTHLY;COUNT=10;BYDAY=1FR', dtstart: s, allDay: false, timeZone: NY }, ...big);
    expect(r.map((x) => w(x).slice(0, 10))).toEqual(['1997-09-05', '1997-10-03', '1997-11-07', '1997-12-05', '1998-01-02', '1998-02-06', '1998-03-06', '1998-04-03', '1998-05-01', '1998-06-05']);
  });
  it('last weekday of month via BYSETPOS', () => {
    const s = fromWall({ y: 1997, m: 9, d: 30, h: 9 }, NY);
    const r = expand({ rule: 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=4', dtstart: s, allDay: false, timeZone: NY }, ...big);
    expect(r.map((x) => w(x).slice(0, 10))).toEqual(['1997-09-30', '1997-10-31', '1997-11-28', '1997-12-31']);
  });
  it('monthly on 31st skips short months; yearly Feb 29', () => {
    const r = expand({ rule: 'FREQ=MONTHLY;COUNT=4', dtstart: dayNum(2026, 1, 31), allDay: true }, -1e9, 1e9);
    expect(r.map(isoDate)).toEqual(['2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31']);
    const y = expand({ rule: 'FREQ=YEARLY;COUNT=3', dtstart: dayNum(2024, 2, 29), allDay: true }, -1e9, 1e9);
    expect(y.map(isoDate)).toEqual(['2024-02-29', '2028-02-29', '2032-02-29']);
  });
  it('every other week MO,WE,FR with exdate, windowed', () => {
    const s = dayNum(2026, 10, 5);
    const r = expand({ rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR', dtstart: s, allDay: true, exdates: [dayNum(2026, 10, 7)] }, dayNum(2026, 10, 1), dayNum(2026, 11, 1));
    expect(r.map(isoDate)).toEqual(['2026-10-05', '2026-10-09', '2026-10-19', '2026-10-21', '2026-10-23']);
  });
  it('yearly thanksgiving (4th Thu of Nov)', () => {
    const r = expand({ rule: 'FREQ=YEARLY;BYMONTH=11;BYDAY=4TH;COUNT=3', dtstart: dayNum(2026, 11, 26), allDay: true }, -1e9, 1e9);
    expect(r.map(isoDate)).toEqual(['2026-11-26', '2027-11-25', '2028-11-23']);
  });
});
describe('tz', () => {
  it('spring-forward gap and fall-back overlap', () => {
    const gap = fromWall({ y: 2026, m: 3, d: 8, h: 2, mi: 30 }, NY);
    expect(w(gap)).toBe('2026-03-08 03:30');
    const amb = fromWall({ y: 2026, m: 11, d: 1, h: 1, mi: 30 }, NY);
    expect(new Date(amb).toISOString()).toBe('2026-11-01T05:30:00.000Z'); // earlier (EDT) instance
  });
  it('Asia/Tokyo round trip', () => {
    const t = fromWall({ y: 2026, m: 10, d: 28, h: 1, mi: 50 }, 'Asia/Tokyo');
    expect(new Date(t).toISOString()).toBe('2026-10-27T16:50:00.000Z');
  });
});
