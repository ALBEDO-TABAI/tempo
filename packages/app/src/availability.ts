// Share-availability mode: pick free slots on the grid (drag), auto-suggest free time, copy as text, or turn into holds.
import { dayOf, startOfDayMs, weekday, ymd } from '@tempo/core';
import { getState, setState, occurrencesIn, periodDays, tz, createEvent, toast } from './store';
import { t, locale } from './i18n';
import { panelTime, wdShort, monthName, gmtLabel } from './fmt';

type Slot = { start: number; end: number };
const merge = (xs: Slot[]) => {
  const a = [...xs].filter((x) => x.end > x.start).sort((p, q) => p.start - q.start); const out: Slot[] = [];
  for (const x of a) { const l = out[out.length - 1]; if (l && x.start <= l.end) l.end = Math.max(l.end, x.end); else out.push({ ...x }); }
  return out;
};
const set = (p: Partial<ReturnType<typeof getState>['avail']>) => setState((s) => ({ avail: { ...s.avail, ...p } }));
export const toggleAvailability = () => { const a = getState().avail; set({ active: !a.active, slots: a.active ? [] : a.slots }); if (!a.active) setState({ selected: [], editing: null }); };
export const stopAvailability = () => set({ active: false, slots: [] });
export const addSlot = (x: Slot) => set({ slots: merge([...getState().avail.slots, x]) });
export const removeSlot = (i: number) => set({ slots: getState().avail.slots.filter((_, j) => j !== i) });
export const clearSlots = () => set({ slots: [] });

/** Free time in the visible days between work hours, minus busy (opaque, non-declined) events and the past. */
export function suggestFree(fromH = 9, toH = 18, minMin = 30): Slot[] {
  const s = getState(); const z = tz(); const days = s.prefs.gridView === 'month' ? Array.from({ length: 7 }, (_, i) => s.today + i) : periodDays(s);
  const busy = occurrencesIn(days[0], days[days.length - 1] + 1).filter((o) => !o.allDay && o.event.transparency !== 'transparent' && o.event.status !== 'cancelled');
  const out: Slot[] = [];
  for (const d of days) {
    const wd = weekday(d); if (!s.prefs.showWeekends && (wd === 0 || wd === 6)) continue;
    const sod = startOfDayMs(d, z); let a = Math.max(sod + fromH * 3600000, Math.ceil(Date.now() / 1800000) * 1800000); const b = sod + toH * 3600000;
    const bs = busy.filter((o) => o.end > a && o.start < b).sort((p, q) => p.start - q.start);
    for (const o of bs) { if (o.start - a >= minMin * 60000) out.push({ start: a, end: o.start }); a = Math.max(a, o.end); }
    if (b - a >= minMin * 60000) out.push({ start: a, end: b });
  }
  return out;
}
export const fillFree = () => set({ slots: merge(suggestFree()) });

export function availabilityText(slots = getState().avail.slots): string {
  const z = tz(); const h24 = getState().prefs.format24HourTime; const zh = locale() !== 'en';
  const byDay = new Map<number, Slot[]>();
  for (const x of merge(slots)) { const d = dayOf(x.start, z); byDay.set(d, [...(byDay.get(d) ?? []), x]); }
  const lines = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([d, xs]) => {
    const { m, d: dd } = ymd(d); const head = zh ? `${monthName(m)} ${dd} 日 ${wdShort(weekday(d))}` : `${wdShort(weekday(d))}, ${monthName(m)} ${dd}`;
    return `${head}: ${xs.map((x) => `${panelTime(x.start, z, h24)} – ${panelTime(x.end, z, h24)}`).join(', ')}`;
  });
  return [t('availIntro', { tz: `${gmtLabel(z)} ${z.split('/').pop()!.replace(/_/g, ' ')}` }), ...lines.map((l) => `• ${l}`)].join('\n');
}
export async function copyAvailability() {
  const txt = availabilityText(); try { await navigator.clipboard.writeText(txt); } catch { /* clipboard blocked; still keep it in state */ }
  setState({ lastCopied: txt } as never); toast(t('availCopied'));
  return txt;
}
/** Turn the chosen slots into tentative, free "hold" events on the primary calendar. */
export function createHolds(title = t('holdTitle')) {
  for (const x of merge(getState().avail.slots)) createEvent({ allDay: false, start: x.start, end: x.end, title, status: 'tentative', transparency: 'transparent' }, { select: false });
  const n = getState().avail.slots.length; stopAvailability(); toast(t('holdsCreated', { n }));
}
