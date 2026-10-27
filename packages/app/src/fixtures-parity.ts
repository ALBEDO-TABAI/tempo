// Parity fixture: the same event geometry as the reference capture (week of 2026-10-25, Asia/Shanghai).
import { CalEvent, Calendar, Account, fromWall } from '@tempo/core';
export function parityFixture(): { accounts: Account[]; calendars: Calendar[]; events: CalEvent[] } {
  const tz = 'Asia/Shanghai'; const now = Date.parse('2026-10-28T00:00:00+08:00');
  const accounts: Account[] = [{ id: 'local', name: 'On this Mac', kind: 'local' }];
  const calendars: Calendar[] = [
    { id: 'p', accountId: 'local', name: 'Personal', color: '#9A9CFE', visible: true, primary: true, order: 0 },
    { id: 'f', accountId: 'local', name: 'Family', color: '#F4BE40', visible: true, order: 1 },
    { id: 'h1', accountId: 'local', name: 'Holidays', color: '#5ECC89', visible: true, readOnly: true, order: 2 },
    { id: 'h2', accountId: 'local', name: 'Holidays 2', color: '#5ECC89', visible: true, readOnly: true, order: 3 },
  ];
  let n = 0;
  const T = (title: string, d: number, h: number, mi: number, dur: number): CalEvent => { const s = fromWall({ y: 2026, m: 10, d, h, mi }, tz); return { id: `ev_p${++n}`, uid: `p${n}@t`, calendarId: 'p', title, allDay: false, start: s, end: s + dur * 60000, timeZone: tz, status: 'confirmed', transparency: 'opaque', createdAt: now, updatedAt: now }; };
  const A = (title: string, s: string, e: string): CalEvent => ({ id: `ev_p${++n}`, uid: `p${n}@t`, calendarId: 'p', title, allDay: true, start: s, end: e, status: 'confirmed', transparency: 'transparent', createdAt: now, updatedAt: now });
  const events = [
    A('REA 測試 8', '2026-10-29', '2026-11-01'), A('REA 測試 7', '2026-10-30', '2026-10-31'),
    T('REA 測試 6', 26, 13, 0, 120), T('REA 測試 5', 27, 9, 0, 60), T('REA 測試 3', 29, 10, 0, 15), T('REA 測試', 29, 11, 0, 60),
    T('REA 測試 12', 30, 9, 0, 150), T('REA 測試 11', 30, 9, 30, 60), T('REA 測試 10', 30, 10, 0, 60), T('REA 測試 4', 30, 14, 0, 30), T('REA 測試 9', 31, 20, 0, 45),
  ];
  return { accounts, calendars, events };
}
