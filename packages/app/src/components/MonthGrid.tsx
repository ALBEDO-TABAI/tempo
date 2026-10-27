// Month view: 6 week rows, chips 19px at 21px pitch below the date number.
import { useMemo, useRef, useState } from 'react';
import { packSpans, weekday, ymd, isoDate, Occurrence, DayNum, isoWeek } from '@tempo/core';
import { useStore, getState, setState, monthRange, occurrencesIn, select, clearSelection, createEvent, updateOccurrence, openMenu, setPrefs, calendarOf } from '../store';
import { useSize } from '../hooks';
import { G } from '../geometry';
import { wdShort, monthName } from '../fmt';
import { t } from '../i18n';
import { Chip } from './Chip';

export function MonthGrid() {
  const wrap = useRef<HTMLDivElement>(null); const size = useSize(wrap);
  const s = useStore((x) => ({ prefs: x.prefs, anchor: x.anchor, events: x.events, calendars: x.calendars, today: x.today, selected: x.selected, now: x.now, systemDark: x.systemDark }));
  const { first, month } = monthRange(getState()); const weeks = 6;
  const gutter = s.prefs.showWeekNumbers ? 24 : 0;
  const cols = s.prefs.showWeekends ? 7 : 5;
  const colDays = (w: number) => Array.from({ length: 7 }, (_, i) => first + w * 7 + i).filter((d) => s.prefs.showWeekends || (weekday(d) !== 0 && weekday(d) !== 6));
  const cw = (size.w - gutter) / cols; const rh = size.h / weeks;
  const occs = useMemo(() => occurrencesIn(first, first + weeks * 7), [first, s.events, s.calendars, s.prefs.showDeclined]); // eslint-disable-line
  const perRow = Math.max(0, Math.floor((rh - 1 - G.monthPadTop - 2 - 16) / (G.allDayChip + G.allDaySpacing)));
  const [drag, setDrag] = useState<{ key?: string; a: DayNum; b: DayNum; delta?: number } | null>(null);
  const dragRef = useRef(drag); dragRef.current = drag;
  const sel = new Set(s.selected);

  const dayAt = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect(); const x = e.clientX - r.left - gutter, y = e.clientY - r.top;
    const w = Math.max(0, Math.min(weeks - 1, Math.floor(y / rh))); const c = Math.max(0, Math.min(cols - 1, Math.floor(x / cw)));
    return colDays(w)[c];
  };
  const track = (mv: (e: PointerEvent) => void, up: (moved: boolean) => void, x0: number, y0: number) => {
    let moved = false;
    const m = (e: PointerEvent) => { if (!moved && Math.hypot(e.clientX - x0, e.clientY - y0) < 3) return; moved = true; mv(e); };
    const u = () => { window.removeEventListener('pointermove', m); window.removeEventListener('pointerup', u); up(moved); };
    window.addEventListener('pointermove', m); window.addEventListener('pointerup', u);
  };
  const last = useRef({ t: 0, x: 0, y: 0 });
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; const d0 = dayAt(e);
    const now = Date.now(); const dbl = now - last.current.t < 350 && Math.hypot(e.clientX - last.current.x, e.clientY - last.current.y) < 5; last.current = { t: now, x: e.clientX, y: e.clientY };
    setState({ cursorDay: d0 });
    if (dbl) { createEvent({ allDay: true, start: isoDate(d0), end: isoDate(d0 + 1) }, { draft: true }); return; }
    track((ev) => setDrag({ a: d0, b: dayAt(ev) }), (moved) => { const d = dragRef.current; setDrag(null); if (!moved || !d) { clearSelection(); return; } const lo = Math.min(d.a, d.b), hi = Math.max(d.a, d.b); createEvent({ allDay: true, start: isoDate(lo), end: isoDate(hi + 1) }, { draft: true }); }, e.clientX, e.clientY);
  };
  const onChipDown = (e: React.PointerEvent, o: Occurrence) => {
    if (e.button !== 0) return; const d0 = dayAt(e); const add = e.shiftKey || e.metaKey;
    if (!add && !getState().selected.includes(o.key)) select([o.key]);
    if (calendarOf(o.event.calendarId)?.readOnly) return;
    track((ev) => { const d1 = dayAt(ev); setDrag({ key: o.key, a: o.startDay + d1 - d0, b: o.endDay + d1 - d0, delta: d1 - d0 }); }, (moved) => {
      const d = dragRef.current; setDrag(null); if (!moved) { select([o.key], { additive: add }); return; }
      if (!d?.delta) return;
      if (o.allDay) updateOccurrence(o.key, { start: isoDate(o.startDay + d.delta), end: isoDate(o.endDay + 1 + d.delta) }, { label: t('moved') });
      else updateOccurrence(o.key, { start: o.start + d.delta * 86400000, end: o.end + d.delta * 86400000 }, { label: t('moved') });
    }, e.clientX, e.clientY);
  };

  const rowsOut: React.ReactNode[] = [];
  for (let w = 0; w < weeks; w++) {
    const ds = colDays(w); const top = w * rh;
    const rowOccs = occs.filter((o) => o.endDay >= ds[0] && o.startDay <= ds[ds.length - 1]);
    // spans first (packed as bars), then single-day timed events in the first free slot of their day
    const spanOccs = rowOccs.filter((o) => o.allDay || o.isMultiDay);
    const placedSp = packSpans(spanOccs.map((o) => ({ id: o.key, startDay: o.startDay, endDay: o.endDay, o })), ds[0], ds[ds.length - 1] - ds[0] + 1);
    const used = ds.map(() => new Set<number>());
    for (const p of placedSp) { const o = (p.item as any).o as Occurrence; for (let c = 0; c < ds.length; c++) if (ds[c] >= o.startDay && ds[c] <= o.endDay) used[c].add(p.row); }
    const placed: { row: number; o: Occurrence; clippedStart: boolean; clippedEnd: boolean }[] = placedSp.map((p) => ({ row: p.row, o: (p.item as any).o, clippedStart: p.clippedStart, clippedEnd: p.clippedEnd }));
    for (const o of rowOccs.filter((x) => !x.allDay && !x.isMultiDay).sort((a, b) => a.start - b.start)) {
      const c = ds.indexOf(o.startDay); if (c < 0) continue; let r = 0; while (used[c].has(r)) r++; used[c].add(r); placed.push({ row: r, o, clippedStart: false, clippedEnd: false });
    }
    const need = ds.map((_, c) => (used[c].size ? Math.max(...used[c]) + 1 : 0));
    const hiddenPerDay = new Map<number, number>();
    ds.forEach((d, c) => {
      const wk = weekday(d) === 0 || weekday(d) === 6; const { m, d: dd } = ymd(d); const isToday = d === s.today; const out = m !== month;
      rowsOut.push(<div key={`c${d}`} className={`mcell${wk ? ' wknd' : ''}${out ? ' out' : ''}`} style={{ left: gutter + c * cw, top, width: cw, height: rh }}>
        <div className={`mnum tnum${isToday ? ' today' : ''}`} style={dd === 1 && !isToday ? { fontWeight: 600 } : undefined}
          onPointerDown={(e) => e.stopPropagation()} onClick={() => { setState({ anchor: d }); setPrefs({ gridView: 'default', daysPerPeriod: 1 }); }}>
          {dd === 1 ? <><strong>{monthName(m)}</strong>{dd}</> : dd}</div>
      </div>);
    });
    for (const p of placed) {
      const o = p.o;
      const fi = ds.indexOf(Math.max(o.startDay, ds[0])), ti = ds.indexOf(Math.min(o.endDay, ds[ds.length - 1]));
      if (fi < 0 || ti < 0) continue;
      const cap = (c: number) => (need[c] > perRow ? perRow - 1 : perRow);
      let hidden = false; for (let c = fi; c <= ti; c++) if (p.row >= cap(c)) hidden = true;
      if (hidden) { for (let c = fi; c <= ti; c++) if (p.row >= cap(c)) hiddenPerDay.set(c, (hiddenPerDay.get(c) ?? 0) + 1); continue; }
      const timedOne = !o.allDay && !o.isMultiDay;
      const moving = drag?.key === o.key;
      rowsOut.push(<Chip key={`${o.key}w${w}`} occ={o} kind={timedOne ? 'dot' : 'allday'} x={gutter + fi * cw + 2} y={top + 1 + G.monthPadTop + 2 + p.row * (G.allDayChip + G.allDaySpacing)} w={(ti - fi + 1) * cw - 15} h={G.allDayChip}
        selected={sel.has(o.key)} ghost={moving} clipL={p.clippedStart} clipR={p.clippedEnd} onDown={(e, oc) => onChipDown(e, oc)}
        onContext={(e, oc) => { if (!getState().selected.includes(oc.key)) select([oc.key]); openMenu({ kind: 'chip', x: e.clientX, y: e.clientY, data: { key: oc.key } }); }} onDbl={() => setState((x) => ({ focusTitle: x.focusTitle + 1 }))} />);
    }
    for (const [c, k] of hiddenPerDay) rowsOut.push(<button key={`m${w}${c}`} className="mmore" style={{ left: gutter + c * cw + 8, top: top + 1 + G.monthPadTop + 2 + (perRow - 1) * 21 + 1 }}
      onPointerDown={(e) => e.stopPropagation()} onClick={() => { setState({ anchor: ds[c] }); setPrefs({ gridView: 'default', daysPerPeriod: 1 }); }}>{t("more", { n: k })}</button>);
    if (gutter) rowsOut.push(<div key={`wn${w}`} className="weekno" style={{ top, height: rh }}>{isoWeek(ds[0] + 1)}</div>);
    if (drag && !drag.key) {
      const lo = Math.min(drag.a, drag.b), hi = Math.max(drag.a, drag.b);
      const fi = ds.findIndex((d) => d >= lo), ti = ds.length - 1 - [...ds].reverse().findIndex((d) => d <= hi);
      if (fi >= 0 && ti >= fi && ds[fi] <= hi && ds[ti] >= lo) rowsOut.push(<div key={`pv${w}`} className="preview" style={{ left: gutter + fi * cw + 2, top: top + 1 + G.monthPadTop + 2, width: (ti - fi + 1) * cw - 15, height: 19, background: 'var(--c-blue)', opacity: .25 }} />);
    } else if (drag?.key) {
      const o = occs.find((x) => x.key === drag.key);
      const fi = ds.findIndex((d) => d >= drag.a && d <= drag.b); const lastIdx = ds.length - 1 - [...ds].reverse().findIndex((d) => d >= drag.a && d <= drag.b);
      if (o && fi >= 0) rowsOut.push(<Chip key={`mv${w}`} occ={o} kind="allday" x={gutter + fi * cw + 2} y={top + 1 + G.monthPadTop + 2} w={(lastIdx - fi + 1) * cw - 15} h={19} layer={100} moving />);
    }
  }
  return (
    <div className="month" data-testid="month" data-colw={cw} data-rowh={rh}>
      <div className="month-heads" style={{ paddingLeft: gutter }}>
        {colDays(0).map((d) => <div key={d} className={`colhead${weekday(d) === weekday(s.today) && s.today >= first && s.today < first + 42 ? ' today' : ''}`} style={{ width: cw, height: 29 }}>{wdShort(weekday(d))}</div>)}
      </div>
      <div className="month-body" ref={wrap} onPointerDown={onDown} onContextMenu={(e) => { e.preventDefault(); openMenu({ kind: 'grid', x: e.clientX, y: e.clientY, data: { day: dayAt(e), allDay: true } }); }}>
        {size.w > 0 && rowsOut}
      </div>
    </div>
  );
}
