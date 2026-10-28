// App state: a tiny observable store with actions. Original implementation.
import { useSyncExternalStore, useRef } from 'react';
import {
  CalEvent, Calendar, Account, Occurrence, DayNum, occurrences, newId, systemTimeZone, dayOf, startOfWeek, addMonths, startOfMonth,
  ymd, parseIsoDate, isoDate, importIcs, exportIcs, parseRRule, stringifyRRule, toWall, fromWall,
} from '@tempo/core';
import { bridge } from './platform';
import { seed } from './fixture';
import { parityFixture } from './fixtures-parity';
import { Q, HARNESS } from './harness';
import { Locale, setLocale, detectLocale, t } from './i18n';

export type GridView = 'default' | 'month';
export interface Prefs {
  gridView: GridView; daysPerPeriod: number; densityZoomLevel: number; weekStartsOn: number;
  showWeekends: boolean; showDeclined: boolean; showWeekNumbers: boolean; format24HourTime: boolean;
  interfaceTheme: 'system' | 'light' | 'dark'; sidebar: boolean; contextPanel: boolean;
  primaryTimeZone: string; additionalTimeZones: string[]; locale: Locale; defaultEventDuration: number;
  collapseAllDaySection: boolean; todayKey: 'today' | 'alignToday';
  upcomingHours: number; mapsProvider: 'google' | 'apple' | 'osm'; askTzUpdate: boolean; openAtLogin: boolean; showAdditionalTz: boolean;
  notifications: boolean; defaultReminder: number; defaultAllDayReminder: number; notifySound: boolean; menuBarNext: boolean; menuBarMaxLen: number;
  displayName: string; email: string; videoProvider: 'none' | 'meet' | 'zoom' | 'teams' | 'custom'; videoUrl: string; autoAddVideo: boolean;
}
export const defaultPrefs = (): Prefs => ({
  gridView: 'default', daysPerPeriod: 7, densityZoomLevel: 0, weekStartsOn: 0, showWeekends: true, showDeclined: true, showWeekNumbers: false,
  format24HourTime: false, interfaceTheme: 'system', sidebar: true, contextPanel: true, primaryTimeZone: systemTimeZone(), additionalTimeZones: [],
  locale: detectLocale(), defaultEventDuration: 30, collapseAllDaySection: false, todayKey: 'today',
  upcomingHours: 4, mapsProvider: 'google', askTzUpdate: true, openAtLogin: false, showAdditionalTz: true,
  notifications: true, defaultReminder: 10, defaultAllDayReminder: -1, notifySound: true, menuBarNext: true, menuBarMaxLen: 32,
  displayName: '', email: '', videoProvider: 'none', videoUrl: '', autoAddVideo: false,
});
export type Overlay = null | 'cmdk' | 'settings' | 'shortcuts' | 'search' | 'goto' | 'recurrence';
export interface MenuState { kind: 'view' | 'chip' | 'grid' | 'calendar' | 'repeat' | 'busy' | 'visibility' | 'reminder' | 'calendarPick' | 'time' | 'tz' | 'color' | 'evColor' | 'recurrence'; x: number; y: number; data?: any }
export interface Toast { id: number; text: string; undo?: () => void }
export interface ScopeAsk { kind: 'edit' | 'delete'; resolve: (s: 'this' | 'following' | 'all' | null) => void }
export interface State {
  ready: boolean; prefs: Prefs; accounts: Account[]; calendars: Calendar[]; events: Record<string, CalEvent>;
  anchor: DayNum; today: DayNum; now: number; systemDark: boolean;
  selected: string[]; editing: string | null; draftId: string | null; focusTitle: number;
  overlay: Overlay; menu: MenuState | null; toasts: Toast[]; scopeAsk: ScopeAsk | null; settingsPage: string; recKey: string | null; avail: { active: boolean; slots: { start: number; end: number }[]; duration: number };
  minDensity: number; cursorDay: DayNum; clipboard: CalEvent[]; searchQuery: string;
}
const tzNow = () => dayOf(Date.now(), systemTimeZone());
let state: State = {
  ready: false, prefs: defaultPrefs(), accounts: [], calendars: [], events: {}, anchor: tzNow(), today: tzNow(), now: Date.now(),
  systemDark: typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches,
  selected: [], editing: null, draftId: null, focusTitle: 0, overlay: null, menu: null, toasts: [], scopeAsk: null, settingsPage: 'general', recKey: null, avail: { active: false, slots: [], duration: 30 },
  minDensity: -4, cursorDay: tzNow(), clipboard: [], searchQuery: '',
};
const subs = new Set<() => void>();
export const getState = () => state;
export function setState(p: Partial<State> | ((s: State) => Partial<State>)) {
  const patch = typeof p === 'function' ? p(state) : p;
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
export function subscribe(f: () => void) { subs.add(f); return () => subs.delete(f); }
export function useStore<T>(sel: (s: State) => T): T {
  const ref = useRef<{ s: State; v: T } | null>(null);
  return useSyncExternalStore(subscribe, () => {
    if (ref.current && ref.current.s === state) return ref.current.v;
    const v = sel(state);
    if (ref.current && shallowEq(ref.current.v, v)) { ref.current.s = state; return ref.current.v; }
    ref.current = { s: state, v }; return v;
  });
}
function shallowEq(a: any, b: any) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is(a[k], b[k]));
}

// ---------- derived ----------
export const tz = () => state.prefs.primaryTimeZone;
export const isDark = (s = state) => (s.prefs.interfaceTheme === 'system' ? s.systemDark : s.prefs.interfaceTheme === 'dark');
export function periodDays(s = state): DayNum[] {
  const p = s.prefs;
  if (p.gridView === 'month') return [];
  const n = p.daysPerPeriod;
  const first = n === 7 ? startOfWeek(s.anchor, p.weekStartsOn) : s.anchor;
  const out: DayNum[] = [];
  for (let d = first; out.length < n; d++) { const wd = ((d % 7) + 11) % 7; if (!p.showWeekends && n === 7 && (wd === 0 || wd === 6)) { if (out.length + (d - first) > 30) break; continue; } out.push(d); }
  return out;
}
export function monthRange(s = state): { first: DayNum; weeks: number; month: number } {
  const m0 = startOfMonth(s.anchor); const first = startOfWeek(m0, s.prefs.weekStartsOn);
  const { y, m } = ymd(m0); const last = parseIsoDate(`${y}-${String(m).padStart(2, '0')}-01`) + new Date(Date.UTC(y, m, 0)).getUTCDate() - 1;
  const weeks = Math.ceil((last - first + 1) / 7);
  return { first, weeks: Math.max(weeks, 5), month: m };
}
export function visibleCalendars(s = state) { return new Set(s.calendars.filter((c) => c.visible).map((c) => c.id)); }
export function calendarOf(id: string) { return state.calendars.find((c) => c.id === id); }
export function occurrencesIn(from: DayNum, to: DayNum, s = state): Occurrence[] {
  const vis = visibleCalendars(s);
  const evs = Object.values(s.events).filter((e) => vis.has(e.calendarId));
  return occurrences(evs, from, to, s.prefs.primaryTimeZone).filter((o) => s.prefs.showDeclined || !o.event.attendees?.some((a) => a.self && a.rsvp === 'declined'));
}
export function findOccurrence(key: string, s = state): Occurrence | undefined {
  const [id, orig] = splitKey(key); const ev = s.events[id]; if (!ev) return undefined;
  if (!orig || !ev.rrule) { const os = occurrences([ev], -1e7, 1e7, s.prefs.primaryTimeZone); return os[0]; }
  const day = orig.includes('-') ? parseIsoDate(orig) : dayOf(Number(orig), s.prefs.primaryTimeZone);
  const rel = Object.values(s.events).filter((e) => e.id === id || e.recurringEventId === id);
  return occurrences(rel, day - 2, day + 3, s.prefs.primaryTimeZone).find((o) => o.key === key)
    ?? occurrences(rel, day - 400, day + 400, s.prefs.primaryTimeZone).find((o) => o.key === key);
}
export const splitKey = (k: string): [string, string | undefined] => { const j = k.indexOf('|'); return j < 0 ? [k, undefined] : [k.slice(0, j), k.slice(j + 1)]; };

// ---------- persistence ----------
let prefsTimer: number | undefined;
function persistPrefs() { clearTimeout(prefsTimer); prefsTimer = window.setTimeout(() => bridge.putPrefs(state.prefs as any), 150); }
const putEv = (e: CalEvent) => bridge.put('event', e);
const delEv = (id: string) => bridge.del('event', id);

export async function init() {
  const snap = await bridge.load();
  const prefs = { ...defaultPrefs(), ...(snap.prefs as Partial<Prefs> | null ?? {}) };
  if (HARNESS) {
    const g = (k: string) => Q.get(k);
    if (g('tz')) prefs.primaryTimeZone = g('tz')!; if (g('locale')) prefs.locale = g('locale') as Locale; if (g('theme')) prefs.interfaceTheme = g('theme') as any;
    if (g('density')) prefs.densityZoomLevel = +g('density')!; if (g('days')) prefs.daysPerPeriod = +g('days')!; if (g('view')) prefs.gridView = g('view') as GridView;
    if (g('sidebar')) prefs.sidebar = g('sidebar') === '1'; if (g('panel')) prefs.contextPanel = g('panel') === '1';
    if (g('fixture') === 'parity') { const f = parityFixture(); snap.accounts = f.accounts; snap.calendars = f.calendars; snap.events = f.events; }
  }
  setLocale(prefs.locale);
  let { accounts, calendars, events } = snap;
  if (!calendars.length) {
    const s = seed(dayOf(Date.now(), prefs.primaryTimeZone), prefs.primaryTimeZone);
    accounts = s.accounts; calendars = s.calendars; events = HARNESS && Q.get('fixture') === 'empty' ? [] : s.events;
    for (const a of accounts) bridge.put('account', a); for (const c of calendars) bridge.put('calendar', c); for (const e of events) putEv(e);
  }
  const today = dayOf(Date.now(), prefs.primaryTimeZone);
  setState({ ready: true, prefs, accounts, calendars: [...calendars].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), events: Object.fromEntries(events.map((e) => [e.id, e])), today, anchor: today, cursorDay: today });
  if (HARNESS && Q.get('date')) setState({ anchor: parseIsoDate(Q.get('date')!) });
  (window as any).__tempo = { getState, setState, setPrefs, findOccurrence: (k: string) => findOccurrence(k) };
  if (typeof matchMedia !== 'undefined') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => setState({ systemDark: e.matches }));
  window.setInterval(tick, 15000);
}
function tick() { const now = Date.now(); const today = dayOf(now, tz()); setState({ now, today }); }

// ---------- prefs / navigation ----------
export function setPrefs(p: Partial<Prefs>) {
  if (p.locale) setLocale(p.locale);
  setState((s) => ({ prefs: { ...s.prefs, ...p } })); persistPrefs();
}
export function setView(gridView: GridView, days?: number) {
  setPrefs({ gridView, ...(days ? { daysPerPeriod: days } : {}) }); setState({ menu: null });
}
export function goToday() { setState((s) => ({ anchor: s.today, cursorDay: s.today })); }
export function goToDay(d: DayNum) { setState({ anchor: d, cursorDay: d }); }
export function step(dir: 1 | -1) {
  const s = state, p = s.prefs;
  if (p.gridView === 'month') { setState({ anchor: addMonths(startOfMonth(s.anchor), dir) }); return; }
  const n = p.daysPerPeriod; const base = n === 7 ? startOfWeek(s.anchor, p.weekStartsOn) : s.anchor;
  setState({ anchor: base + dir * n });
}
export function zoom(d: 1 | -1 | 0) {
  const s = state; const lvl = d === 0 ? 0 : Math.max(s.minDensity, Math.min(20, s.prefs.densityZoomLevel + d));
  setPrefs({ densityZoomLevel: lvl });
}
export function toggleTheme() { setPrefs({ interfaceTheme: isDark() ? 'light' : 'dark' }); }
export function openOverlay(o: Overlay) { setState({ overlay: o, menu: null, prefs: { ...state.prefs, contextPanel: o === 'search' || o === 'shortcuts' || state.prefs.contextPanel } }); }
export function openMenu(m: MenuState | null) { setState({ menu: m }); }

// ---------- toasts / undo ----------
let toastSeq = 0; const undoStack: { label: string; undo: () => void; redo: () => void }[] = []; const redoStack: typeof undoStack = [];
export function toast(text: string, undo?: () => void) {
  const id = ++toastSeq; setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, undo }] }));
  window.setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5000);
}
function record(label: string, before: CalEvent[], after: CalEvent[], removedIds: string[] = [], addedIds: string[] = []) {
  const undo = () => { apply(before, addedIds.filter((id) => !before.some((b) => b.id === id))); };
  const redo = () => { apply(after, removedIds); };
  undoStack.push({ label, undo, redo }); if (undoStack.length > 100) undoStack.shift(); redoStack.length = 0;
  return undo;
}
function apply(put: CalEvent[], remove: string[]) {
  setState((s) => { const ev = { ...s.events }; for (const id of remove) { delete ev[id]; delEv(id); } for (const e of put) { ev[e.id] = e; putEv(e); } return { events: ev }; });
}
export function undo() { const u = undoStack.pop(); if (u) { u.undo(); redoStack.push(u); toast(`${t('undo')}: ${u.label}`); } }
export function redo() { const u = redoStack.pop(); if (u) { u.redo(); undoStack.push(u); } }

// ---------- events ----------
export function primaryCalendar() { return state.calendars.find((c) => c.primary && !c.readOnly) ?? state.calendars.find((c) => !c.readOnly) ?? state.calendars[0]; }
export function createEvent(p: Partial<CalEvent> & { start: number | string; end: number | string; allDay: boolean }, opts: { select?: boolean; draft?: boolean } = {}) {
  const now = Date.now(); const id = newId('ev'); const cal = p.calendarId ?? primaryCalendar()?.id ?? 'cal_personal';
  const e: CalEvent = { id, uid: `${id}@tempo.local`, calendarId: cal, title: '', status: 'confirmed', transparency: p.allDay ? 'transparent' : 'opaque', timeZone: p.allDay ? undefined : tz(), createdAt: now, updatedAt: now, reminders: p.allDay ? (state.prefs.defaultAllDayReminder >= 0 ? [{ minutes: state.prefs.defaultAllDayReminder, method: 'notification' as const }] : []) : (state.prefs.defaultReminder >= 0 ? [{ minutes: state.prefs.defaultReminder, method: 'notification' as const }] : []), ...p } as CalEvent;
  apply([e], []);
  const undoFn = record(t('created'), [], [e], [], [id]);
  if (opts.select !== false) setState((s) => ({ selected: [id], editing: id, draftId: opts.draft ? id : null, focusTitle: s.focusTitle + 1, overlay: null, menu: null, prefs: { ...s.prefs, contextPanel: true } }));
  void undoFn; return id;
}
/** Discard an untouched draft (no title) when it loses focus. */
export function settleDraft(nextKey: string | null) {
  const d = state.draftId; if (!d || d === nextKey) return;
  const e = state.events[d]; setState({ draftId: null });
  if (e && !e.title.trim()) { apply([], [d]); undoStack.pop(); }
}
export function select(keys: string[], opts: { additive?: boolean; edit?: boolean } = {}) {
  const next = opts.additive ? Array.from(new Set([...state.selected, ...keys])) : keys;
  settleDraft(next[0] ?? null);
  setState({ selected: next, editing: opts.edit === false ? state.editing : next.length === 1 ? next[0] : next.length ? state.editing : null, menu: null, prefs: { ...state.prefs, contextPanel: (opts.edit !== false && next.length === 1) || state.prefs.contextPanel } });
}
export function clearSelection() { settleDraft(null); setState({ selected: [], editing: null, menu: null }); }

async function askScope(kind: 'edit' | 'delete'): Promise<'this' | 'following' | 'all' | null> {
  return new Promise((resolve) => setState({ scopeAsk: { kind, resolve: (v) => { setState({ scopeAsk: null }); resolve(v); } } }));
}
const toMs = (v: number | string) => (typeof v === 'string' ? parseIsoDate(v) : v);

/** Patch an occurrence; for recurring events asks for a scope when the change is not trivial. */
export async function updateOccurrence(key: string, patch: Partial<CalEvent>, opts: { scope?: 'this' | 'following' | 'all'; label?: string } = {}) {
  const occ = findOccurrence(key); if (!occ) return;
  const ev = occ.event; const series = occ.seriesId ? state.events[occ.seriesId] : ev.rrule ? ev : undefined;
  const label = opts.label ?? t('updated');
  if (!series || (!occ.seriesId && !ev.rrule)) {
    const after = { ...ev, ...patch, updatedAt: Date.now(), sequence: (ev.sequence ?? 0) + 1 };
    apply([after], []); const u = record(label, [ev], [after]); return u;
  }
  const timeChange = 'start' in patch || 'end' in patch || 'allDay' in patch;
  let scope = opts.scope ?? (timeChange || 'rrule' in patch ? await askScope('edit') : await askScope('edit'));
  if (!scope) return;
  const origKey = key.slice(series.id.length + 1);
  if (scope === 'this') {
    if (occ.seriesId && ev.id !== series.id) { const after = { ...ev, ...patch, updatedAt: Date.now() }; apply([after], []); return record(label, [ev], [after]); }
    const oid = newId('ev');
    const override: CalEvent = { ...series, id: oid, rrule: undefined, exdates: undefined, rdates: undefined, recurringEventId: series.id, originalStart: origKey.includes('-') ? origKey : Number(origKey),
      start: series.allDay ? isoDate(occ.startDay) : occ.start, end: series.allDay ? isoDate(occ.endDay + 1) : occ.end, ...patch, updatedAt: Date.now() };
    apply([override], []); return record(label, [], [override], [], [oid]);
  }
  if (scope === 'all') {
    const dS = 'start' in patch ? toMs(patch.start!) - (series.allDay ? occ.startDay : occ.start) : 0;
    const dE = 'end' in patch ? toMs(patch.end!) - (series.allDay ? occ.endDay + 1 : occ.end) : dS;
    const sS = toMs(series.start), sE = toMs(series.end);
    const nS = series.allDay ? isoDate(sS + dS) : sS + dS; const nE = series.allDay ? isoDate(sE + dE) : sE + dE;
    const { start: _s, end: _e, ...rest } = patch;
    const after = { ...series, ...rest, start: 'start' in patch ? nS : series.start, end: 'end' in patch || 'start' in patch ? nE : series.end, updatedAt: Date.now() };
    apply([after], []); return record(label, [series], [after]);
  }
  // following: end the original series before this occurrence and start a new one here
  const r = parseRRule(series.rrule!); const occStart = series.allDay ? occ.startDay : occ.start;
  const until = series.allDay ? occStart - 1 : occStart - 1000;
  const before = { ...series, rrule: stringifyRRule({ ...r, count: undefined, until: series.allDay ? (untilDay(until)) : until, untilIsDate: series.allDay } as any), updatedAt: Date.now() };
  const nid = newId('ev');
  const dur = toMs(series.end) - toMs(series.start);
  const fresh: CalEvent = { ...series, id: nid, uid: `${nid}@tempo.local`, start: series.allDay ? isoDate(occStart) : occStart, end: series.allDay ? isoDate(occStart + dur) : occStart + dur, rrule: stringifyRRule({ ...r, count: undefined } as any), ...patch, updatedAt: Date.now() };
  apply([before, fresh], []); return record(label, [series], [before, fresh], [], [nid]);
}
const untilDay = (d: DayNum) => d;

export async function deleteOccurrences(keys: string[], opts: { scope?: 'this' | 'following' | 'all'; silent?: boolean } = {}) {
  const before: CalEvent[] = [], after: CalEvent[] = [], removed: string[] = [];
  let scope = opts.scope;
  for (const key of keys) {
    const occ = findOccurrence(key); if (!occ) continue;
    if (calendarOf(occ.event.calendarId)?.readOnly) continue;
    const series = occ.seriesId ? state.events[occ.seriesId] : occ.event.rrule ? occ.event : undefined;
    if (!series) { before.push(occ.event); removed.push(occ.event.id); continue; }
    if (!scope) { scope = (await askScope('delete')) ?? undefined; if (!scope) return; }
    if (scope === 'all') { before.push(series); removed.push(series.id); for (const e of Object.values(state.events)) if (e.recurringEventId === series.id) { before.push(e); removed.push(e.id); } continue; }
    const origKey = key.slice(series.id.length + 1);
    if (scope === 'this') {
      if (occ.event.id !== series.id) { before.push(occ.event); removed.push(occ.event.id); }
      const ex = [...(series.exdates ?? []), series.allDay ? origKey : Number(origKey)];
      const s2 = { ...series, exdates: ex, updatedAt: Date.now() }; before.push(series); after.push(s2); continue;
    }
    const r = parseRRule(series.rrule!); const occStart = series.allDay ? occ.startDay : occ.start;
    const s2 = { ...series, rrule: stringifyRRule({ ...r, count: undefined, until: series.allDay ? occStart - 1 : occStart - 1000, untilIsDate: series.allDay } as any), updatedAt: Date.now() };
    before.push(series); after.push(s2);
  }
  if (!before.length) return;
  const keep = after.filter((a) => !removed.includes(a.id));
  apply(keep, removed);
  const u = record(t('deleted'), before, keep, removed);
  setState({ selected: [], editing: null, draftId: null });
  if (!opts.silent) toast(t('deleted'), () => { undoStack.pop(); u(); });
}
export function duplicateOccurrences(keys: string[]) {
  const made: string[] = [];
  for (const key of keys) {
    const o = findOccurrence(key); if (!o) continue;
    const { id: _i, uid: _u, rrule: _r, exdates: _x, recurringEventId: _ri, originalStart: _os, ...rest } = o.event;
    made.push(createEvent({ ...rest, start: o.allDay ? isoDate(o.startDay) : o.start, end: o.allDay ? isoDate(o.endDay + 1) : o.end }, { select: false }));
  }
  if (made.length) select(made);
}
export function copyOccurrences(keys: string[], cut = false) {
  const evs = keys.map((k) => findOccurrence(k)).filter(Boolean).map((o) => ({ ...o!.event, start: o!.allDay ? isoDate(o!.startDay) : o!.start, end: o!.allDay ? isoDate(o!.endDay + 1) : o!.end, rrule: undefined }));
  setState({ clipboard: evs as CalEvent[] });
  if (cut) deleteOccurrences(keys, { scope: 'this', silent: true });
}
export function paste() {
  const clip = state.clipboard; if (!clip.length) return;
  const first = Math.min(...clip.map((e) => (e.allDay ? startOfDayMsLocal(parseIsoDate(e.start as string)) : (e.start as number))));
  const day0 = dayOf(first, tz()); const delta = state.cursorDay - day0;
  const made: string[] = [];
  for (const e of clip) {
    const { id: _i, uid: _u, ...rest } = e;
    if (e.allDay) made.push(createEvent({ ...rest, start: isoDate(parseIsoDate(e.start as string) + delta), end: isoDate(parseIsoDate(e.end as string) + delta) }, { select: false }));
    else { const w = toWall(e.start as number, tz()); const { y, m, d } = ymd(dayOf(e.start as number, tz()) + delta); const ns = fromWall({ y, m, d, h: w.h, mi: w.mi }, tz()); made.push(createEvent({ ...rest, start: ns, end: ns + ((e.end as number) - (e.start as number)) }, { select: false })); }
  }
  select(made);
}
const startOfDayMsLocal = (d: DayNum) => { const { y, m, dd } = { ...ymd(d), dd: ymd(d).d }; return fromWall({ y, m, d: dd }, tz()); };

// ---------- calendars ----------
export function updateCalendar(id: string, patch: Partial<Calendar>) {
  setState((s) => ({ calendars: s.calendars.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const c = state.calendars.find((x) => x.id === id); if (c) bridge.put('calendar', c);
}
export function addCalendar(name: string, color: string) {
  const c: Calendar = { id: newId('cal'), accountId: 'local', name, color, visible: true, order: state.calendars.length };
  setState((s) => ({ calendars: [...s.calendars, c] })); bridge.put('calendar', c); return c.id;
}
export function removeCalendar(id: string) {
  const c = state.calendars.find((x) => x.id === id); if (!c || c.primary) return;
  const evs = Object.values(state.events).filter((e) => e.calendarId === id);
  apply([], evs.map((e) => e.id)); setState((s) => ({ calendars: s.calendars.filter((x) => x.id !== id) })); bridge.del('calendar', id);
}
export async function importIcsText(text: string, name = 'Imported') {
  const calId = newId('cal'); const r = importIcs(text, calId, tz());
  if (!r.events.length) { toast(t('imported', { n: 0 })); return; }
  const cal: Calendar = { id: calId, accountId: 'local', name: r.calendarName || name.replace(/\.(ics|vcs)$/i, ''), color: r.calendarColor?.slice(0, 7) || '#4CA8DF', visible: true, order: state.calendars.length };
  setState((s) => ({ calendars: [...s.calendars, cal] })); bridge.put('calendar', cal);
  apply(r.events, []);
  toast(t('imported', { n: r.events.length }));
  const first = r.events.map((e) => (e.allDay ? parseIsoDate(e.start as string) : dayOf(e.start as number, tz()))).sort((a, b) => a - b)[0];
  if (first !== undefined && Math.abs(first - state.today) > 60) goToDay(first);
}
export async function importIcsFile() { const f = await bridge.openIcs(); if (f) await importIcsText(f.text, f.name); }
export async function exportCalendar(id?: string) {
  const cal = id ? calendarOf(id) : undefined;
  const evs = Object.values(state.events).filter((e) => !id || e.calendarId === id);
  await bridge.saveIcs(`${(cal?.name || 'Tempo').replace(/[^\w\- ]+/g, '')}.ics`, exportIcs(evs, { calendarName: cal?.name ?? 'Tempo' }));
}
