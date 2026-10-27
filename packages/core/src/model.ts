// Local-first data model: calendars, events (with recurrence/overrides), occurrences.
import { DayNum, parseIsoDate, isoDate } from './dates';
import { expand } from './rrule';
import { dayOf, startOfDayMs, UTC } from './tz';

export type Rsvp = 'accepted' | 'declined' | 'tentative' | 'needsAction';
export interface Attendee { email: string; name?: string; rsvp: Rsvp; organizer?: boolean; self?: boolean; optional?: boolean }
export interface Reminder { minutes: number; method: 'notification' | 'email' }
export interface Calendar { id: string; accountId: string; name: string; color: string; visible: boolean; primary?: boolean; readOnly?: boolean; timeZone?: string; order?: number }
export interface Account { id: string; name: string; kind: 'local' | 'ics' | 'caldav'; email?: string }
export interface CalEvent {
  id: string; uid: string; calendarId: string;
  title: string; description?: string; location?: string; url?: string; conferenceUrl?: string;
  allDay: boolean;
  /** timed: epoch ms. all-day: ISO date (YYYY-MM-DD) */
  start: number | string; end: number | string;
  timeZone?: string;
  rrule?: string; exdates?: (number | string)[]; rdates?: (number | string)[];
  /** set on an override of one instance of a series */
  recurringEventId?: string; originalStart?: number | string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  transparency: 'opaque' | 'transparent';
  visibility?: 'default' | 'public' | 'private';
  attendees?: Attendee[]; reminders?: Reminder[]; color?: string;
  createdAt: number; updatedAt: number; sequence?: number;
}
export interface Occurrence {
  key: string; event: CalEvent; seriesId?: string;
  allDay: boolean;
  /** timed: ms instants */
  start: number; end: number;
  /** all-day & per-day placement: inclusive day numbers in the display zone */
  startDay: DayNum; endDay: DayNum;
  isMultiDay: boolean;
}

const toDay = (v: number | string) => (typeof v === 'string' ? parseIsoDate(v) : v);
export const dayStr = isoDate;

/** Expand a set of events into occurrences overlapping [fromDay, toDay) in `tz`. */
export function occurrences(events: CalEvent[], fromDay: DayNum, toDayExcl: DayNum, tz: string): Occurrence[] {
  const from = startOfDayMs(fromDay, tz), to = startOfDayMs(toDayExcl, tz);
  const overrides = new Map<string, Map<string, CalEvent>>();
  for (const e of events) if (e.recurringEventId && e.originalStart !== undefined) {
    let m = overrides.get(e.recurringEventId); if (!m) overrides.set(e.recurringEventId, (m = new Map()));
    m.set(String(e.originalStart), e);
  }
  const out: Occurrence[] = [];
  const push = (ev: CalEvent, s: number, e: number, key: string, seriesId?: string) => {
    if (ev.status === 'cancelled') return;
    if (ev.allDay) {
      const sd = s, ed = Math.max(sd, e - 1);
      if (ed < fromDay || sd >= toDayExcl) return;
      out.push({ key, event: ev, seriesId, allDay: true, start: startOfDayMs(sd, tz), end: startOfDayMs(e, tz), startDay: sd, endDay: ed, isMultiDay: ed > sd });
    } else {
      if (e <= from || s >= to) return;
      const sd = dayOf(s, tz), ed = dayOf(Math.max(s, e - 1), tz);
      out.push({ key, event: ev, seriesId, allDay: false, start: s, end: e, startDay: sd, endDay: ed, isMultiDay: e - s >= 86400000 || (ed > sd && e - s >= 86400000) });
    }
  };
  for (const ev of events) {
    if (ev.recurringEventId) continue;
    const s0 = ev.allDay ? toDay(ev.start) : (ev.start as number);
    const e0 = ev.allDay ? toDay(ev.end) : (ev.end as number);
    const dur = e0 - s0;
    if (!ev.rrule) { push(ev, s0, e0, ev.id); continue; }
    const ov = overrides.get(ev.id);
    const pad = ev.allDay ? Math.ceil(dur) + 1 : dur + 86400000;
    const winFrom = ev.allDay ? fromDay - pad : from - pad, winTo = ev.allDay ? toDayExcl : to;
    const starts = expand({ rule: ev.rrule, dtstart: s0, allDay: ev.allDay, timeZone: ev.timeZone || tz || UTC,
      exdates: (ev.exdates ?? []).map((x) => (ev.allDay ? toDay(x) : (x as number))), rdates: (ev.rdates ?? []).map((x) => (ev.allDay ? toDay(x) : (x as number))) }, winFrom, winTo);
    for (const st of starts) {
      const origKey = ev.allDay ? isoDate(st) : String(st);
      const o = ov?.get(origKey) ?? ov?.get(String(st));
      if (o) {
        const os = o.allDay ? toDay(o.start) : (o.start as number), oe = o.allDay ? toDay(o.end) : (o.end as number);
        push(o, os, oe, `${ev.id}_${origKey}`, ev.id);
      } else push(ev, st, st + dur, `${ev.id}_${origKey}`, ev.id);
    }
    // overrides moved into the window from outside
    if (ov) for (const [k, o] of ov) if (!out.some((x) => x.key === `${ev.id}_${k}`)) {
      const os = o.allDay ? toDay(o.start) : (o.start as number), oe = o.allDay ? toDay(o.end) : (o.end as number);
      push(o, os, oe, `${ev.id}_${k}`, ev.id);
    }
  }
  return out.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
}

let seq = 0;
export function newId(prefix = 'ev'): string {
  seq = (seq + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
