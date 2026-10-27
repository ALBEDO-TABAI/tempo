// Week / day / N-day time grid. Geometry follows the measured reference.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { addSlot, removeSlot } from '../availability';
import { layoutDay, packSpans, startOfDayMs, minutesOfDay, weekday, ymd, Occurrence, isoDate, DayNum } from '@tempo/core';
import { useStore, getState, setState, periodDays, occurrencesIn, select, clearSelection, createEvent, updateOccurrence, openMenu, setPrefs, calendarOf } from '../store';
import { useSize } from '../hooks';
import { G, gutterWidth, colWidth, hourHeight, minDensityLevel, allDayHeight } from '../geometry';
import { hourLabel, timeOfFull, wdShort, gmtLabel, panelTime } from '../fmt';
import { t } from '../i18n';
import { Chip } from './Chip';

const TICK = 15;
type Drag =
  | { kind: 'create'; day: number; a: number; b: number }
  | { kind: 'move'; key: string; day: number; start: number; dur: number; moved: boolean }
  | { kind: 'resize'; key: string; edge: 'n' | 's'; day: number; start: number; end: number }
  | { kind: 'adCreate'; a: number; b: number }
  | { kind: 'adMove'; key: string; from: number; to: number; moved: boolean };

export function TimeGrid() {
  const wrap = useRef<HTMLDivElement>(null); const scroller = useRef<HTMLDivElement>(null);
  const size = useSize(wrap);
  const s = useStore((x) => ({ prefs: x.prefs, anchor: x.anchor, events: x.events, calendars: x.calendars, now: x.now, today: x.today, selected: x.selected, systemDark: x.systemDark, minDensity: x.minDensity, avail: x.avail }));
  const tz = s.prefs.primaryTimeZone; const h24 = s.prefs.format24HourTime;
  const days = useMemo(() => periodDays(getState()), [s.prefs, s.anchor]); // eslint-disable-line
  const n = days.length;
  // one overscan day each side (clipped), so bars and lines continue past the visible edge like the reference
  const cols = useMemo(() => (n ? [days[0] - 1, ...days, days[n - 1] + 1] : []), [days, n]);
  const xOf = (d: DayNum) => gutter + (cols.indexOf(d) - 1) * cw;
  const gutter = gutterWidth(1 + (s.prefs.showAdditionalTz ? s.prefs.additionalTimeZones.length : 0), size.w);
  const cw = colWidth(size.w, gutter, n);
  const available = Math.max(0, size.h - G.colHeader - G.allDayBase);
  const hourH = hourHeight(s.prefs.densityZoomLevel, available);
  useEffect(() => { if (size.h) { const m = minDensityLevel(available); if (m !== getState().minDensity) setState({ minDensity: m }); if (s.prefs.densityZoomLevel < m) setPrefs({ densityZoomLevel: m }); } }, [available, size.h]); // eslint-disable-line

  const occs = useMemo(() => (n ? occurrencesIn(days[0] - 1, days[n - 1] + 2) : []), [days, s.events, s.calendars, s.prefs.showDeclined]); // eslint-disable-line
  const spans = useMemo(() => occs.filter((o) => o.allDay || o.isMultiDay), [occs]);
  const timed = useMemo(() => occs.filter((o) => !o.allDay && !o.isMultiDay), [occs]);
  const dayIdx = (d: DayNum) => days.indexOf(d);
  // all-day rows (contiguous days only; with hidden weekends spans are split per visible run)
  const placedSpans = useMemo(() => packSpans(spans.map((o) => ({ id: o.key, startDay: o.startDay, endDay: o.endDay, o })), (days[0] ?? 0) - 1, (days[n - 1] ?? 0) - (days[0] ?? 0) + 3), [spans, days, n]);
  const rows = placedSpans.reduce((m, p) => Math.max(m, p.row + 1), 0);
  const collapsed = s.prefs.collapseAllDaySection && rows > 1;
  const adH = allDayHeight(collapsed ? 1 : rows);

  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null); dragRef.current = drag;

  // initial vertical position: 8 AM (or now) near the top
  const scrolledFor = useRef('');
  useLayoutEffect(() => {
    const el = scroller.current; if (!el || !hourH) return; const key = `${s.prefs.gridView}`;
    if (scrolledFor.current === key) return; scrolledFor.current = key;
    const nowMin = minutesOfDay(Date.now(), tz); el.scrollTop = Math.max(0, Math.min(nowMin - 120, 8 * 60) / 60 * hourH);
  }, [hourH]); // eslint-disable-line
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const f = () => { const nowMin = minutesOfDay(Date.now(), tz); el.scrollTo({ top: Math.max(0, (nowMin - 120) / 60 * hourH), behavior: 'smooth' }); };
    el.addEventListener('tempo-scroll-now', f); return () => el.removeEventListener('tempo-scroll-now', f);
  }, [hourH, tz]);

  // ---------- pointer helpers ----------
  const point = (e: { clientX: number; clientY: number }) => {
    const el = scroller.current!; const r = el.getBoundingClientRect();
    const col = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left - gutter) / cw)));
    const min = Math.max(0, Math.min(1440, ((e.clientY - r.top + el.scrollTop) / hourH) * 60));
    return { col, min, day: days[col] };
  };
  const adPoint = (e: { clientX: number }) => { const r = wrap.current!.getBoundingClientRect(); return days[Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left - gutter) / cw)))]; };
  const snapF = (m: number) => Math.floor(m / TICK) * TICK, snapR = (m: number) => Math.round(m / TICK) * TICK;
  const autoScroll = useRef<{ dy: number; raf: number }>({ dy: 0, raf: 0 });
  const runAuto = (last: { clientX: number; clientY: number }, onMove: (e: any) => void) => {
    const el = scroller.current!; const r = el.getBoundingClientRect(); const zone = 30, stepPx = 12;
    const dy = last.clientY < r.top + zone ? -stepPx : last.clientY > r.bottom - zone ? stepPx : 0;
    autoScroll.current.dy = dy;
    if (dy && !autoScroll.current.raf) {
      const loop = () => { if (!autoScroll.current.dy) { autoScroll.current.raf = 0; return; } el.scrollTop += autoScroll.current.dy; onMove(last); autoScroll.current.raf = requestAnimationFrame(loop); };
      autoScroll.current.raf = requestAnimationFrame(loop);
    }
  };
  const track = (onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent, moved: boolean) => void, start: { x: number; y: number }) => {
    let moved = false; let last: PointerEvent | null = null;
    const mv = (e: PointerEvent) => { last = e; if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 3) return; moved = true; onMove(e); runAuto(e, onMove); };
    const up = (e: PointerEvent) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); autoScroll.current.dy = 0; onUp(e, moved); void last; };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const toMs = (day: DayNum, min: number) => startOfDayMs(day, tz) + min * 60000;

  // ---------- grid body ----------
  const lastClick = useRef({ t: 0, x: 0, y: 0 });
  const onGridDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = point(e); const a = snapF(p.min);
    const now = Date.now(); const lc = lastClick.current; const dbl = now - lc.t < 350 && Math.hypot(e.clientX - lc.x, e.clientY - lc.y) < 5;
    lastClick.current = { t: now, x: e.clientX, y: e.clientY };
    setState({ cursorDay: p.day });
    if (dbl && getState().avail.active) { const st = toMs(p.day, a); addSlot({ start: st, end: st + getState().avail.duration * 60000 }); return; }
    if (dbl) { const st = toMs(p.day, a); createEvent({ allDay: false, start: st, end: st + getState().prefs.defaultEventDuration * 60000 }, { draft: true }); return; }
    track((ev) => { const q = point(ev); setDrag({ kind: 'create', day: p.day, a, b: q.min >= a ? Math.max(a + TICK, Math.ceil(q.min / TICK) * TICK) : snapF(q.min) }); },
      (_ev, moved) => {
        const d = dragRef.current; setDrag(null);
        if (!moved || !d || d.kind !== 'create') { if (!getState().avail.active) clearSelection(); return; }
        const lo = Math.min(d.a, d.b), hi = Math.max(d.a, d.b, lo + TICK);
        if (getState().avail.active) { addSlot({ start: toMs(d.day, lo), end: toMs(d.day, hi) }); return; }
        createEvent({ allDay: false, start: toMs(d.day, lo), end: toMs(d.day, hi) }, { draft: true });
      }, { x: e.clientX, y: e.clientY });
  };
  const onChipDown = (e: React.PointerEvent, occ: Occurrence, part: 'body' | 'n' | 's' | 'w' | 'e') => {
    if (e.button !== 0) return;
    const readOnly = calendarOf(occ.event.calendarId)?.readOnly;
    const p = point(e); const sod = startOfDayMs(occ.startDay, tz); const sMin = (occ.start - sod) / 60000; const eMin = (occ.end - sod) / 60000;
    const additive = e.shiftKey || e.metaKey;
    if (!additive && !getState().selected.includes(occ.key)) select([occ.key]);
    if (readOnly) { if (additive) select([occ.key], { additive: true }); return; }
    if (part === 'n' || part === 's') {
      track((ev) => { const q = point(ev); const m = snapR(q.min);
        setDrag(part === 's' ? { kind: 'resize', key: occ.key, edge: 's', day: occ.startDay, start: sMin, end: Math.max(sMin + TICK, m) } : { kind: 'resize', key: occ.key, edge: 'n', day: occ.startDay, start: Math.min(eMin - TICK, m), end: eMin }); },
      () => { const d = dragRef.current; setDrag(null); if (d?.kind === 'resize') updateOccurrence(occ.key, { start: toMs(d.day, d.start), end: toMs(d.day, d.end) }, { label: t('updated') }); }, { x: e.clientX, y: e.clientY });
      return;
    }
    const grab = p.min - sMin; const dur = eMin - sMin;
    track((ev) => { const q = point(ev); setDrag({ kind: 'move', key: occ.key, day: q.day, start: Math.max(0, Math.min(1440 - TICK, snapR(q.min - grab))), dur, moved: true }); },
      (_ev, moved) => {
        const d = dragRef.current; setDrag(null);
        if (!moved) { if (additive) select([occ.key], { additive: true }); else select([occ.key]); return; }
        if (d?.kind === 'move') { const st = toMs(d.day, d.start); if (st !== occ.start) updateOccurrence(occ.key, { start: st, end: st + d.dur * 60000 }, { label: t('moved') }); }
      }, { x: e.clientX, y: e.clientY });
  };
  const onChipContext = (e: React.MouseEvent, occ: Occurrence) => { if (!getState().selected.includes(occ.key)) select([occ.key]); openMenu({ kind: 'chip', x: e.clientX, y: e.clientY, data: { key: occ.key } }); };
  const onChipDbl = (_occ: Occurrence) => setState((x) => ({ focusTitle: x.focusTitle + 1 }));
  const onGridContext = (e: React.MouseEvent) => { e.preventDefault(); const p = point(e); setState({ cursorDay: p.day }); openMenu({ kind: 'grid', x: e.clientX, y: e.clientY, data: { day: p.day, min: snapF(p.min), allDay: false } }); };

  // ---------- all-day ----------
  const onAdDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; const d0 = adPoint(e);
    const nowT = Date.now(); const lc = lastClick.current; const dbl = nowT - lc.t < 350 && Math.hypot(e.clientX - lc.x, e.clientY - lc.y) < 5;
    lastClick.current = { t: nowT, x: e.clientX, y: e.clientY };
    if (dbl) { createEvent({ allDay: true, start: isoDate(d0), end: isoDate(d0 + 1) }, { draft: true }); return; }
    track((ev) => setDrag({ kind: 'adCreate', a: d0, b: adPoint(ev) }), (_e, moved) => {
      const d = dragRef.current; setDrag(null); if (!moved || d?.kind !== 'adCreate') { clearSelection(); return; }
      const lo = Math.min(d.a, d.b), hi = Math.max(d.a, d.b); createEvent({ allDay: true, start: isoDate(lo), end: isoDate(hi + 1) }, { draft: true });
    }, { x: e.clientX, y: e.clientY });
  };
  const onAdChipDown = (e: React.PointerEvent, occ: Occurrence, part: 'body' | 'n' | 's' | 'w' | 'e') => {
    if (e.button !== 0) return; const d0 = adPoint(e); const additive = e.shiftKey || e.metaKey;
    if (!additive && !getState().selected.includes(occ.key)) select([occ.key]);
    if (calendarOf(occ.event.calendarId)?.readOnly) return;
    track((ev) => {
      const d1 = adPoint(ev);
      if (part === 'w') setDrag({ kind: 'adMove', key: occ.key, from: Math.min(d1, occ.endDay), to: occ.endDay, moved: true });
      else if (part === 'e') setDrag({ kind: 'adMove', key: occ.key, from: occ.startDay, to: Math.max(d1, occ.startDay), moved: true });
      else setDrag({ kind: 'adMove', key: occ.key, from: occ.startDay + d1 - d0, to: occ.endDay + d1 - d0, moved: true });
    }, (_e, moved) => {
      const d = dragRef.current; setDrag(null);
      if (!moved) { select([occ.key], { additive }); return; }
      if (d?.kind !== 'adMove') return;
      if (occ.allDay) updateOccurrence(occ.key, { start: isoDate(d.from), end: isoDate(d.to + 1) }, { label: t('moved') });
      else { const delta = (d.from - occ.startDay) * 86400000; updateOccurrence(occ.key, { start: occ.start + delta, end: occ.end + delta + (d.to - d.from - (occ.endDay - occ.startDay)) * 86400000 }, { label: t('moved') }); }
    }, { x: e.clientX, y: e.clientY });
  };

  // ---------- render ----------
  const totalH = 24 * hourH;
  const todayIdx = dayIdx(s.today);
  const nowMin = minutesOfDay(s.now, tz); const nowY = (nowMin / 60) * hourH;
  const sel = new Set(s.selected);
  const moving = drag && (drag.kind === 'move' || drag.kind === 'resize') ? drag.key : drag?.kind === 'adMove' ? drag.key : null;

  const dayCols = cols.map((d) => {
    const wd = weekday(d); const wk = wd === 0 || wd === 6;
    const segs = timed.filter((o) => o.startDay <= d && o.endDay >= d).map((o) => {
      const sod = startOfDayMs(d, tz); const a = Math.max(0, (o.start - sod) / 60000), b = Math.min(1440, (o.end - sod) / 60000);
      return { id: o.key, start: a, end: b, o };
    });
    const minDur = ((G.chipMinHeight + G.chipMarginBottom) / hourH) * 60;
    const placed = layoutDay(segs, { minDur });
    return (
      <div key={d} className={`daycol${wk ? ' wknd' : ''}`} style={{ left: xOf(d), width: cw, height: totalH }}>
        {Array.from({ length: 23 }, (_, h) => <div key={h} className="hline" style={{ top: (h + 1) * hourH }} />)}
        {placed.map((p) => {
          const o = p.item.o; const isMv = moving === o.key;
          const y = (p.item.start / 60) * hourH; const h = Math.max(G.chipMinHeight, ((p.item.end - p.item.start) / 60) * hourH - G.chipMarginBottom);
          return <Chip key={o.key + d} occ={o} kind="timed" x={p.leftPercent * cw} y={y} w={p.widthPercent * cw - G.chipMarginRight} h={h} layer={p.layer}
            selected={sel.has(o.key)} ghost={isMv} onDown={onChipDown} onContext={onChipContext} onDbl={onChipDbl} />;
        })}
        {s.avail.active && s.avail.slots.map((x, i) => { const sod = startOfDayMs(d, tz); if (x.end <= sod || x.start >= sod + 86400000) return null;
          const a = Math.max(0, (x.start - sod) / 60000), b = Math.min(1440, (x.end - sod) / 60000);
          return <div key={'av' + i} className="avslot" data-testid="avslot" style={{ top: (a / 60) * hourH, height: Math.max(10, ((b - a) / 60) * hourH - 2) }} onPointerDown={(e) => e.stopPropagation()}>
            <span className="tnum">{panelTime(x.start, tz, h24)} – {panelTime(x.end, tz, h24)}</span><button onClick={() => removeSlot(i)}><X size={12} /></button></div>; })}
        {d !== s.today && <div className="nowfaint" style={{ top: nowY, left: 0, right: 0 }} />}
      </div>
    );
  });

  // drag preview
  let preview: React.ReactNode = null;
  if (drag?.kind === 'create') {
    const i = dayIdx(drag.day); const lo = Math.min(drag.a, drag.b), hi = Math.max(drag.a, drag.b);
    const fake = { key: '__new', event: { id: '__new', title: '', calendarId: (calendarOf(getState().calendars.find((c) => c.primary)?.id || '')?.id) || getState().calendars[0]?.id, status: 'confirmed', transparency: 'opaque' } as any, allDay: false, start: toMs(drag.day, lo), end: toMs(drag.day, hi), startDay: drag.day, endDay: drag.day, isMultiDay: false } as Occurrence;
    preview = <div style={{ position: 'absolute', left: gutter + i * cw, top: 0, width: cw }}><Chip occ={fake} kind="timed" x={0} y={(lo / 60) * hourH} w={cw - G.chipMarginRight} h={((hi - lo) / 60) * hourH - G.chipMarginBottom} layer={100} moving /></div>;
  } else if (drag?.kind === 'move' || drag?.kind === 'resize') {
    const o = timed.find((x) => x.key === drag.key) ?? spans.find((x) => x.key === drag.key);
    if (o) {
      const day = drag.day; const st = drag.kind === 'move' ? drag.start : drag.start; const en = drag.kind === 'move' ? drag.start + drag.dur : drag.end;
      const i = dayIdx(day);
      if (i >= 0) preview = <div style={{ position: 'absolute', left: gutter + i * cw, top: 0, width: cw }}><Chip occ={o} kind="timed" x={0} y={(st / 60) * hourH} w={cw - G.chipMarginRight} h={Math.max(G.chipMinHeight, ((en - st) / 60) * hourH - G.chipMarginBottom)} layer={100} moving startOverride={toMs(day, st)} endOverride={toMs(day, en)} /></div>;
    }
  }

  const adChips = placedSpans.filter((p) => !collapsed || p.row === 0).map((p) => {
    const o = (p.item as any).o as Occurrence; const isMv = moving === o.key;
    const fromI = cols.indexOf(Math.max(o.startDay, cols[0])) - 1; const toI = cols.indexOf(Math.min(o.endDay, cols[cols.length - 1])) - 1;
    if (fromI < -1 || toI < -1) return null;
    return <Chip key={o.key} occ={o} kind="allday" x={gutter + fromI * cw} y={G.allDayPadTop + p.row * (G.allDayChip + G.allDaySpacing)} w={(toI - fromI + 1) * cw - G.chipMarginRight} h={G.allDayChip}
      selected={sel.has(o.key)} ghost={isMv} clipL={p.clippedStart} clipR={p.clippedEnd} onDown={onAdChipDown} onContext={onChipContext} onDbl={onChipDbl} />;
  });
  let adPreview: React.ReactNode = null;
  if (drag?.kind === 'adCreate' || drag?.kind === 'adMove') {
    const lo = drag.kind === 'adCreate' ? Math.min(drag.a, drag.b) : drag.from, hi = drag.kind === 'adCreate' ? Math.max(drag.a, drag.b) : drag.to;
    const fi = Math.max(0, dayIdx(Math.max(lo, days[0]))), ti = dayIdx(Math.min(hi, days[n - 1]));
    const o = drag.kind === 'adMove' ? spans.find((x) => x.key === drag.key) : ({ key: '__new', event: { id: '__new', title: '', calendarId: getState().calendars.find((c) => c.primary)?.id, status: 'confirmed', transparency: 'opaque' }, allDay: true, start: 0, end: 0, startDay: lo, endDay: hi, isMultiDay: false } as any);
    if (o && ti >= 0) adPreview = <Chip occ={o} kind="allday" x={gutter + fi * cw} y={G.allDayPadTop} w={(ti - fi + 1) * cw - G.chipMarginRight} h={G.allDayChip} layer={100} moving />;
  }

  const tzs = [tz, ...(s.prefs.showAdditionalTz ? s.prefs.additionalTimeZones : [])];
  return (
    <div className="gridwrap" ref={wrap} data-testid="timegrid" data-colw={cw} data-hourh={hourH} data-gutter={gutter}>
      <div className="colheads" style={{ height: G.colHeader }}>
        <div className="gutterhead" style={{ width: gutter, justifyContent: 'space-between', paddingLeft: 6 }}>
          <button className="ibtn xs" style={{ width: 16, height: 16, padding: 0 }} title={t('addTz')} onClick={() => setState({ overlay: 'settings', settingsPage: 'general' })}><Plus size={10} /></button>
          {tzs.slice().reverse().map((z) => <span key={z}>{gmtLabel(z, s.now)}</span>)}
        </div>
        {days.map((d) => {
          const isToday = d === s.today; const { d: dd } = ymd(d);
          return <div key={d} className={`colhead${isToday ? ' today' : ''}`} style={{ width: cw }} onClick={() => { if (n > 1) { setState({ anchor: d }); setPrefs({ daysPerPeriod: 1 }); } }}>
            {cw >= 50 ? <>{wdShort(weekday(d))} <span className="num tnum">{dd}</span></> : <span className="num tnum">{dd}</span>}
          </div>;
        })}
      </div>
      <div className="allday" style={{ height: adH }} onPointerDown={onAdDown} onContextMenu={(e) => { e.preventDefault(); openMenu({ kind: 'grid', x: e.clientX, y: e.clientY, data: { day: adPoint(e), allDay: true } }); }}>
        <div className="allday-gutter" style={{ width: gutter }} onPointerDown={(e) => e.stopPropagation()}>
          {rows > 1 ? <button className="ibtn xs" style={{ position: 'absolute', right: 8, top: 2 }} onClick={() => setPrefs({ collapseAllDaySection: !s.prefs.collapseAllDaySection })}>{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
            : <span>{t('allDay')}</span>}
          {collapsed && <div style={{ position: 'absolute', right: 6, top: 22, fontSize: 10 }}>+{placedSpans.filter((p) => p.row > 0).length}</div>}
        </div>
        {cols.map((d) => { const wd = weekday(d); return <div key={d} className={`allday-col${wd === 0 || wd === 6 ? ' wknd' : ''}`} style={{ position: 'absolute', top: 0, left: xOf(d), width: cw }} />; })}
        <div className="allday-chips" style={{ left: 0, right: 0 }}>{adChips}{adPreview}</div>
      </div>
      <div className="scroller" ref={scroller} onPointerDown={onGridDown} onContextMenu={onGridContext}>
        <div style={{ position: 'relative', height: totalH }}>
          <div className="timecol" style={{ width: gutter, height: totalH }} onPointerDown={(e) => e.stopPropagation()}>
            {Array.from({ length: 23 }, (_, k) => k + 1).map((h) => {
              const y = h * hourH; const hide = Math.abs(y - nowY) < 12;
              return <div key={h} className="hourlabel tnum" style={{ top: y, opacity: hide ? 0 : 1 }}>{hourLabel(h, h24)}</div>;
            })}
            <div className="nowpill tnum" style={{ top: nowY }}>{timeOfFull(s.now, tz, h24)}</div>
          </div>
          {dayCols}
          {todayIdx >= 0 && <div className="nowbar" style={{ top: nowY, left: gutter + todayIdx * cw + 3, width: cw - 5 }} />}
          {preview}
        </div>
      </div>
    </div>
  );
}
