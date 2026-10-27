import { describe, it, expect } from 'vitest';
import { importIcs, exportIcs, fold, occurrences, dayNum, toWall } from '../src';
const SAMPLE = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Team\r\nBEGIN:VEVENT\r\nUID:a@x\r\nDTSTART;TZID=America/New_York:20261026T090000\r\nDTEND;TZID=America/New_York:20261026T093000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE\r\nEXDATE;TZID=America/New_York:20261028T090000\r\nSUMMARY:Stand\\, up\r\nDESCRIPTION:line1\\nline2\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT10M\r\nEND:VALARM\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:a@x\r\nRECURRENCE-ID;TZID=America/New_York:20261102T090000\r\nDTSTART;TZID=America/New_York:20261102T110000\r\nDTEND;TZID=America/New_York:20261102T113000\r\nSUMMARY:Stand up (moved)\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:b@x\r\nDTSTART;VALUE=DATE:20261029\r\nDTEND;VALUE=DATE:20261101\r\nSUMMARY:Off-site\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
describe('ics', () => {
  it('imports series, override, exdate, all-day span, alarm', () => {
    const r = importIcs(SAMPLE, 'cal1', 'Asia/Tokyo');
    expect(r.calendarName).toBe('Team'); expect(r.events.length).toBe(3); expect(r.warnings).toEqual([]);
    const s = r.events.find((e) => e.title === 'Stand, up')!;
    expect(s.description).toBe('line1\nline2'); expect(s.reminders).toEqual([{ minutes: 10, method: 'notification' }]);
    const occ = occurrences(r.events, dayNum(2026, 10, 25), dayNum(2026, 11, 8), 'America/New_York');
    const titles = occ.map((o) => `${o.event.title}@${toWall(o.start, 'America/New_York').d}`);
    expect(titles).toContain('Stand, up@26'); expect(titles).not.toContain('Stand, up@28');
    expect(titles).toContain('Stand up (moved)@2'); expect(titles).toContain('Stand, up@4');
    const off = occ.find((o) => o.event.title === 'Off-site')!; expect(off.isMultiDay).toBe(true); expect(off.endDay - off.startDay).toBe(2);
  });
  it('round-trips through export', () => {
    const r = importIcs(SAMPLE, 'cal1', 'Asia/Tokyo');
    const back = importIcs(exportIcs(r.events, { calendarName: 'Team' }), 'cal1', 'Asia/Tokyo');
    expect(back.events.length).toBe(3);
    const a = r.events.map((e) => [e.title, e.start, e.end, !!e.recurringEventId]).sort();
    const b = back.events.map((e) => [e.title, e.start, e.end, !!e.recurringEventId]).sort();
    expect(b).toEqual(a);
  });
  it('folds long UTF-8 lines at 75 octets', () => {
    const f = fold('SUMMARY:' + '測試'.repeat(40));
    for (const l of f.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});
