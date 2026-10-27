// iCalendar (RFC 5545) import/export for local events. Original implementation.
import { CalEvent, Attendee, Reminder, newId } from './model';
import { dayNum, isoDate, parseIsoDate } from './dates';
import { fromWall, isValidTimeZone, UTC } from './tz';

export interface IcsProp { name: string; params: Record<string, string>; value: string }
export interface IcsComp { type: string; props: IcsProp[]; children: IcsComp[] }

export function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n').filter((l) => l.length);
}
function parseLine(line: string): IcsProp {
  let i = 0, inQ = false; let colon = -1;
  for (; i < line.length; i++) { const c = line[i]; if (c === '"') inQ = !inQ; else if (c === ':' && !inQ) { colon = i; break; } }
  const head = colon < 0 ? line : line.slice(0, colon), value = colon < 0 ? '' : line.slice(colon + 1);
  const parts: string[] = []; let cur = ''; inQ = false;
  for (const c of head) { if (c === '"') inQ = !inQ; if (c === ';' && !inQ) { parts.push(cur); cur = ''; } else cur += c; }
  parts.push(cur);
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) { const k = p.indexOf('='); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ''); }
  return { name: parts[0].toUpperCase(), params, value };
}
export function parseIcs(text: string): IcsComp[] {
  const root: IcsComp = { type: 'ROOT', props: [], children: [] }; const stack = [root];
  for (const l of unfold(text)) {
    const p = parseLine(l);
    if (p.name === 'BEGIN') { const c: IcsComp = { type: p.value.toUpperCase(), props: [], children: [] }; stack[stack.length - 1].children.push(c); stack.push(c); }
    else if (p.name === 'END') { if (stack.length > 1) stack.pop(); }
    else stack[stack.length - 1].props.push(p);
  }
  return root.children;
}
export const unescapeText = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
export const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Common Windows zone names seen in Outlook exports → IANA
const WINDOWS_TZ: Record<string, string> = {
  'Tokyo Standard Time': 'Asia/Tokyo', 'China Standard Time': 'Asia/Shanghai', 'Taipei Standard Time': 'Asia/Taipei',
  'Pacific Standard Time': 'America/Los_Angeles', 'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver', 'GMT Standard Time': 'Europe/London', 'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris', 'Singapore Standard Time': 'Asia/Singapore', 'Korea Standard Time': 'Asia/Seoul', 'UTC': 'UTC',
};
function resolveTz(tzid: string | undefined, vtz: Map<string, number>): { tz: string; fixedOffsetMin?: number } {
  if (!tzid) return { tz: UTC };
  const clean = tzid.replace(/^\/+/, '');
  if (isValidTimeZone(clean)) return { tz: clean };
  if (WINDOWS_TZ[clean]) return { tz: WINDOWS_TZ[clean] };
  const off = vtz.get(tzid); if (off !== undefined) return { tz: UTC, fixedOffsetMin: off };
  return { tz: UTC };
}
interface DateVal { allDay: boolean; ms?: number; day?: number; tz?: string; floating?: boolean }
function parseDate(p: IcsProp, vtz: Map<string, number>, defaultTz: string): DateVal {
  const v = p.value.trim();
  if (p.params.VALUE === 'DATE' || /^\d{8}$/.test(v)) return { allDay: true, day: parseIsoDate(v) };
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!m) throw new Error('bad date ' + v);
  const wall = { y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] || 0) };
  if (m[7]) return { allDay: false, ms: Date.UTC(wall.y, wall.m - 1, wall.d, wall.h, wall.mi, wall.s), tz: UTC };
  if (p.params.TZID) {
    const r = resolveTz(p.params.TZID, vtz);
    if (r.fixedOffsetMin !== undefined) return { allDay: false, ms: Date.UTC(wall.y, wall.m - 1, wall.d, wall.h, wall.mi, wall.s) - r.fixedOffsetMin * 60000, tz: UTC };
    return { allDay: false, ms: fromWall(wall, r.tz), tz: r.tz };
  }
  return { allDay: false, ms: fromWall(wall, defaultTz), tz: defaultTz, floating: true };
}
function parseDuration(s: string): number {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s.trim());
  if (!m) return 0;
  const v = ((+(m[2] || 0)) * 7 * 86400 + (+(m[3] || 0)) * 86400 + (+(m[4] || 0)) * 3600 + (+(m[5] || 0)) * 60 + (+(m[6] || 0))) * 1000;
  return m[1] === '-' ? -v : v;
}
const offsetMin = (s: string) => { const m = /^([+-])(\d{2})(\d{2})/.exec(s); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0; };

export interface ImportResult { events: CalEvent[]; calendarName?: string; calendarColor?: string; warnings: string[] }
export function importIcs(text: string, calendarId: string, defaultTz: string): ImportResult {
  const comps = parseIcs(text); const warnings: string[] = []; const events: CalEvent[] = [];
  let calendarName: string | undefined, calendarColor: string | undefined;
  const now = Date.now();
  for (const cal of comps.filter((c) => c.type === 'VCALENDAR')) {
    calendarName ??= cal.props.find((p) => p.name === 'X-WR-CALNAME')?.value;
    calendarColor ??= cal.props.find((p) => p.name === 'X-APPLE-CALENDAR-COLOR' || p.name === 'COLOR')?.value;
    const vtz = new Map<string, number>();
    for (const t of cal.children.filter((c) => c.type === 'VTIMEZONE')) {
      const id = t.props.find((p) => p.name === 'TZID')?.value; const std = t.children.find((c) => c.type === 'STANDARD') ?? t.children[0];
      const to = std?.props.find((p) => p.name === 'TZOFFSETTO')?.value; if (id && to) vtz.set(id, offsetMin(to));
    }
    const uidToId = new Map<string, string>();
    const vevents = cal.children.filter((c) => c.type === 'VEVENT');
    // masters first so overrides can reference them
    vevents.sort((a, b) => Number(!!a.props.find((p) => p.name === 'RECURRENCE-ID')) - Number(!!b.props.find((p) => p.name === 'RECURRENCE-ID')));
    for (const ve of vevents) {
      try {
        const g = (n: string) => ve.props.find((p) => p.name === n);
        const ga = (n: string) => ve.props.filter((p) => p.name === n);
        const ds = g('DTSTART'); if (!ds) { warnings.push('VEVENT without DTSTART skipped'); continue; }
        const s = parseDate(ds, vtz, defaultTz);
        let e: DateVal | undefined; const de = g('DTEND'), du = g('DURATION');
        if (de) e = parseDate(de, vtz, defaultTz);
        else if (du) e = s.allDay ? { allDay: true, day: s.day! + Math.max(1, Math.round(parseDuration(du.value) / 86400000)) } : { allDay: false, ms: s.ms! + parseDuration(du.value), tz: s.tz };
        else e = s.allDay ? { allDay: true, day: s.day! + 1 } : { ...s };
        const uid = g('UID')?.value || newId('uid');
        const rid = g('RECURRENCE-ID');
        const id = rid ? newId('ev') : (uidToId.get(uid) ?? newId('ev'));
        const attendees: Attendee[] = ga('ATTENDEE').map((p) => ({
          email: p.value.replace(/^mailto:/i, ''), name: p.params.CN,
          rsvp: ({ ACCEPTED: 'accepted', DECLINED: 'declined', TENTATIVE: 'tentative' } as Record<string, Attendee['rsvp']>)[(p.params.PARTSTAT || '').toUpperCase()] ?? 'needsAction',
          optional: p.params.ROLE === 'OPT-PARTICIPANT',
        }));
        const org = g('ORGANIZER'); if (org) { const em = org.value.replace(/^mailto:/i, ''); const a = attendees.find((x) => x.email === em); if (a) a.organizer = true; else attendees.unshift({ email: em, name: org.params.CN, rsvp: 'accepted', organizer: true }); }
        const reminders: Reminder[] = ve.children.filter((c) => c.type === 'VALARM').map((a) => {
          const tr = a.props.find((p) => p.name === 'TRIGGER'); const act = a.props.find((p) => p.name === 'ACTION')?.value;
          return { minutes: tr ? Math.round(-parseDuration(tr.value) / 60000) : 0, method: act === 'EMAIL' ? 'email' : 'notification' } as Reminder;
        });
        const ex: (number | string)[] = [];
        for (const p of ga('EXDATE')) for (const v of p.value.split(',')) { const d = parseDate({ ...p, value: v }, vtz, defaultTz); ex.push(d.allDay ? isoDate(d.day!) : d.ms!); }
        const status = (g('STATUS')?.value || 'CONFIRMED').toLowerCase();
        const ev: CalEvent = {
          id, uid, calendarId, title: unescapeText(g('SUMMARY')?.value ?? ''),
          description: g('DESCRIPTION') ? unescapeText(g('DESCRIPTION')!.value) : undefined,
          location: g('LOCATION') ? unescapeText(g('LOCATION')!.value) : undefined, url: g('URL')?.value,
          allDay: s.allDay, start: s.allDay ? isoDate(s.day!) : s.ms!, end: e.allDay ? isoDate(e.day!) : e.ms!,
          timeZone: s.allDay ? undefined : s.tz, rrule: g('RRULE')?.value, exdates: ex.length ? ex : undefined,
          status: status === 'cancelled' ? 'cancelled' : status === 'tentative' ? 'tentative' : 'confirmed',
          transparency: g('TRANSP')?.value === 'TRANSPARENT' ? 'transparent' : 'opaque',
          visibility: g('CLASS')?.value === 'PRIVATE' ? 'private' : g('CLASS')?.value === 'PUBLIC' ? 'public' : 'default',
          attendees: attendees.length ? attendees : undefined, reminders: reminders.length ? reminders : undefined,
          createdAt: now, updatedAt: now, sequence: +(g('SEQUENCE')?.value || 0),
        };
        if (rid) {
          const master = uidToId.get(uid);
          if (!master) { warnings.push(`override for unknown series ${uid}`); }
          else { const r = parseDate(rid, vtz, defaultTz); ev.recurringEventId = master; ev.originalStart = r.allDay ? isoDate(r.day!) : r.ms!; }
        } else uidToId.set(uid, id);
        events.push(ev);
      } catch (err) { warnings.push(String(err)); }
    }
  }
  return { events, calendarName, calendarColor, warnings };
}

const p2 = (n: number) => String(n).padStart(2, '0');
const utcStamp = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`; };
const dateStamp = (iso: string) => iso.replace(/-/g, '');
/** Fold to 75 octets (UTF-8 aware). */
export function fold(line: string): string {
  const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
  const out: string[] = []; let cur = ''; let n = 0; let limit = 75;
  for (const ch of line) { const b = enc.encode(ch).length; if (n + b > limit) { out.push(cur); cur = ''; n = 0; limit = 74; } cur += ch; n += b; }
  out.push(cur); return out.join('\r\n ');
}
export function exportIcs(events: CalEvent[], opt: { calendarName?: string; prodId?: string } = {}): string {
  const L: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${opt.prodId ?? '-//Tempo//Tempo Calendar//EN'}`, 'CALSCALE:GREGORIAN'];
  if (opt.calendarName) L.push(`X-WR-CALNAME:${escapeText(opt.calendarName)}`);
  const byId = new Map(events.map((e) => [e.id, e]));
  const dt = (name: string, v: number | string, allDay: boolean) => (allDay ? `${name};VALUE=DATE:${dateStamp(String(v))}` : `${name}:${utcStamp(v as number)}`);
  for (const e of events) {
    L.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${utcStamp(e.updatedAt || Date.now())}`);
    L.push(dt('DTSTART', e.start, e.allDay), dt('DTEND', e.end, e.allDay));
    if (e.recurringEventId && e.originalStart !== undefined) {
      const m = byId.get(e.recurringEventId); if (m) { L[L.indexOf(`UID:${e.uid}`)] = `UID:${m.uid}`; }
      L.push(dt('RECURRENCE-ID', e.originalStart, e.allDay));
    }
    if (e.title) L.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.description) L.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) L.push(`LOCATION:${escapeText(e.location)}`);
    if (e.url) L.push(`URL:${e.url}`);
    if (e.rrule) L.push(`RRULE:${e.rrule.replace(/^RRULE:/i, '')}`);
    for (const x of e.exdates ?? []) L.push(dt('EXDATE', x, e.allDay));
    if (e.status !== 'confirmed') L.push(`STATUS:${e.status.toUpperCase()}`);
    if (e.transparency === 'transparent') L.push('TRANSP:TRANSPARENT');
    if (e.visibility === 'private') L.push('CLASS:PRIVATE'); else if (e.visibility === 'public') L.push('CLASS:PUBLIC');
    if (e.sequence) L.push(`SEQUENCE:${e.sequence}`);
    for (const a of e.attendees ?? []) {
      if (a.organizer) L.push(`ORGANIZER${a.name ? `;CN=${a.name}` : ''}:mailto:${a.email}`);
      const ps = { accepted: 'ACCEPTED', declined: 'DECLINED', tentative: 'TENTATIVE', needsAction: 'NEEDS-ACTION' }[a.rsvp];
      L.push(`ATTENDEE${a.name ? `;CN=${a.name}` : ''};PARTSTAT=${ps}${a.optional ? ';ROLE=OPT-PARTICIPANT' : ''}:mailto:${a.email}`);
    }
    for (const r of e.reminders ?? []) L.push('BEGIN:VALARM', `ACTION:${r.method === 'email' ? 'EMAIL' : 'DISPLAY'}`, `TRIGGER:-PT${r.minutes}M`, 'DESCRIPTION:Reminder', 'END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
export { dayNum };
