// Synthetic first-run data (no real people or accounts).
import { CalEvent, Calendar, Account, DayNum, fromWall, ymd, isoDate, newId } from '@tempo/core';
export function seed(today: DayNum, tz: string): { accounts: Account[]; calendars: Calendar[]; events: CalEvent[] } {
  const acc: Account = { id: 'local', name: 'On this Mac', kind: 'local', email: 'me@tempo.local' };
  const cals: Calendar[] = [
    { id: 'cal_personal', accountId: 'local', name: 'Personal', color: '#9A9CFE', visible: true, primary: true, order: 0 },
    { id: 'cal_work', accountId: 'local', name: 'Work', color: '#4986E8', visible: true, order: 1 },
    { id: 'cal_family', accountId: 'local', name: 'Family', color: '#F4BE40', visible: true, order: 2 },
    { id: 'cal_holidays', accountId: 'local', name: 'Holidays', color: '#5ECC89', visible: true, readOnly: true, order: 3 },
  ];
  const now = Date.now();
  const at = (dd: number, h: number, mi = 0) => { const { y, m, d } = ymd(today + dd); return fromWall({ y, m, d, h, mi }, tz); };
  const ev = (calendarId: string, title: string, dd: number, h: number, mi: number, dur: number, extra: Partial<CalEvent> = {}): CalEvent => {
    const id = newId('ev'); const s = at(dd, h, mi);
    return { id, uid: `${id}@tempo.local`, calendarId, title, allDay: false, start: s, end: s + dur * 60000, timeZone: tz, status: 'confirmed', transparency: 'opaque', createdAt: now, updatedAt: now, ...extra };
  };
  const ad = (calendarId: string, title: string, dd: number, days: number, extra: Partial<CalEvent> = {}): CalEvent => {
    const id = newId('ev');
    return { id, uid: `${id}@tempo.local`, calendarId, title, allDay: true, start: isoDate(today + dd), end: isoDate(today + dd + days), status: 'confirmed', transparency: 'transparent', createdAt: now, updatedAt: now, ...extra };
  };
  const events: CalEvent[] = [
    ev('cal_work', 'Team standup', -3, 9, 30, 15, { rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', reminders: [{ minutes: 5, method: 'notification' }] }),
    ev('cal_work', 'Design review', 1, 10, 0, 90, { location: 'Room 4', description: 'Walk through the new grid spacing.' }),
    ev('cal_work', 'Roadmap sync', 1, 10, 30, 60),
    ev('cal_work', '1:1', 1, 11, 0, 30),
    ev('cal_personal', 'Lunch with Sam', 0, 12, 30, 60, { location: 'Corner café' }),
    ev('cal_personal', 'Gym', -1, 18, 0, 60, { rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' }),
    ev('cal_family', 'Piano lesson', 2, 16, 0, 45),
    ev('cal_work', 'Focus time', 3, 14, 0, 120, { transparency: 'transparent' }),
    ev('cal_personal', 'Dentist', 6, 8, 15, 30, { reminders: [{ minutes: 60, method: 'notification' }] }),
    ad('cal_family', 'Trip to the coast', 2, 3),
    ad('cal_holidays', 'Public holiday', 8, 1),
    ad('cal_personal', 'Mum’s birthday', 12, 1, { rrule: 'FREQ=YEARLY' }),
  ];
  return { accounts: [acc], calendars: cals, events };
}
