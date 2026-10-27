// Contrast popover menus: view switcher, chip & grid context menus, panel pickers, calendar menu.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Scissors, Copy, CopyPlus, Trash2, ClipboardPaste, Plus } from 'lucide-react';
import { PALETTE, colorFamily, parseRRule, stringifyRRule, weekday, ymd, startOfDayMs, toWall, fromWall, isoDate, dayOf } from '@tempo/core';
import { useStore, getState, setState, setView, setPrefs, openMenu, findOccurrence, updateOccurrence, deleteOccurrences, duplicateOccurrences, copyOccurrences, paste, createEvent, calendarOf, updateCalendar, removeCalendar, addCalendar, exportCalendar, isDark, MenuState } from '../store';
import { t } from '../i18n';
import { MOD } from '../commands';
import { wdShort, monthName, panelTime, ruleLabel } from '../fmt';
import { REMINDER_OPTS, reminderLabel } from './Panel';

function Item({ label, hint, checked, onClick, danger, disabled, sub, icon }: { label: string; hint?: string; checked?: boolean; onClick?: () => void; danger?: boolean; disabled?: boolean; sub?: boolean; icon?: React.ReactNode }) {
  return <div className={`mi${danger ? ' danger' : ''}${disabled ? ' disabled' : ''}`} onClick={() => { if (!disabled) onClick?.(); }}>
    {checked !== undefined && <span className="chk">{checked && <Check size={14} />}</span>}{icon}<span className="lbl">{label}</span>{hint && <span className="hint">{hint}</span>}{sub && <ChevronRight size={14} style={{ color: 'var(--m-text2)' }} />}
  </div>;
}
const close = () => openMenu(null);

export function Menus() {
  const m = useStore((x) => x.menu);
  const ref = useRef<HTMLDivElement>(null); const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!m || !ref.current) { setPos(null); return; }
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(m.x, innerWidth - r.width - 8)), y: m.y + r.height > innerHeight - 8 ? Math.max(8, m.y - r.height) : m.y });
  }, [m]);
  useEffect(() => {
    if (!m) return; const f = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const id = setTimeout(() => window.addEventListener('pointerdown', f, true)); return () => { clearTimeout(id); window.removeEventListener('pointerdown', f, true); };
  }, [m]);
  if (!m) return null;
  return <div ref={ref} className="pop" data-testid={`menu-${m.kind}`} style={{ left: pos?.x ?? m.x, top: pos?.y ?? m.y, visibility: pos ? 'visible' : 'hidden', minWidth: m.kind === 'view' ? 200 : m.kind === 'chip' ? 238 : 200 }}><MenuBody m={m} /></div>;
}

function MenuBody({ m }: { m: MenuState }) {
  const p = useStore((x) => x.prefs); const [sub, setSub] = useState<string | null>(null);
  switch (m.kind) {
    case 'view': {
      const cur = p.gridView === 'month' ? 'm' : p.daysPerPeriod === 1 ? 'd' : p.daysPerPeriod === 7 ? 'w' : 'n';
      if (sub === 'days') return <div className="pop-sec">{[2, 3, 4, 5, 6, 7, 8, 9].map((n) => <Item key={n} label={t('nDays', { n })} hint={String(n)} checked={p.gridView === 'default' && p.daysPerPeriod === n} onClick={() => setView('default', n)} />)}</div>;
      if (sub === 'settings') return <div className="pop-sec">
        <Item label={t('showWeekends')} checked={p.showWeekends} onClick={() => setPrefs({ showWeekends: !p.showWeekends })} />
        <Item label={t('showDeclined')} checked={p.showDeclined} onClick={() => setPrefs({ showDeclined: !p.showDeclined })} />
        <Item label={t('showWeekNumbers')} checked={p.showWeekNumbers} onClick={() => setPrefs({ showWeekNumbers: !p.showWeekNumbers })} /></div>;
      return <>
        <div className="pop-sec">
          <Item label={t('day')} hint={`1 ${t('or')} D`} checked={cur === 'd'} onClick={() => setView('default', 1)} />
          <Item label={t('week')} hint={`0 ${t('or')} W`} checked={cur === 'w'} onClick={() => setView('default', 7)} />
          <Item label={t('month')} hint="M" checked={cur === 'm'} onClick={() => setView('month')} />
        </div>
        <div className="pop-sec"><Item label={t('days')} checked={cur === 'n' ? true : false} sub onClick={() => setSub('days')} /></div>
        <div className="pop-sec"><Item label={t('viewSettings')} checked={false} sub onClick={() => setSub('settings')} /></div>
      </>;
    }
    case 'chip': {
      const occ = findOccurrence(m.data.key); if (!occ) return null; const ro = !!calendarOf(occ.event.calendarId)?.readOnly;
      const keys = getState().selected.includes(m.data.key) ? getState().selected : [m.data.key];
      const dark = isDark();
      return <>
        {!ro && <div className="colors">{PALETTE.map((c) => <button key={c.id} title={c.name} style={{ background: colorFamily(c.hex, dark).backgroundPrimary }} onClick={() => { updateOccurrence(m.data.key, { color: c.hex }, { scope: 'all' }); close(); }}>{(occ.event.color ?? calendarOf(occ.event.calendarId)?.color)?.toUpperCase() === c.hex ? <Check size={10} /> : null}</button>)}</div>}
        <div className="pop-sec">
          <Item icon={<Scissors size={14} />} label={t('cut')} hint={`${MOD} X`} disabled={ro} onClick={() => { copyOccurrences(keys, true); close(); }} />
          <Item icon={<Copy size={14} />} label={t('copy')} hint={`${MOD} C`} onClick={() => { copyOccurrences(keys); close(); }} />
          <Item icon={<CopyPlus size={14} />} label={t('duplicate')} hint={`${MOD} D`} disabled={ro} onClick={() => { duplicateOccurrences(keys); close(); }} />
        </div>
        <div className="pop-sec"><Item icon={<Trash2 size={14} />} label={t('del')} hint={t('deleteKey')} danger disabled={ro} onClick={() => { close(); deleteOccurrences(keys); }} /></div>
      </>;
    }
    case 'grid': {
      const { day, min, allDay } = m.data;
      return <div className="pop-sec">
        <Item icon={<Plus size={14} />} label={t('newEvent')} hint="C" onClick={() => { close(); if (allDay) createEvent({ allDay: true, start: isoDate(day), end: isoDate(day + 1) }, { draft: true }); else { const st = startOfDayMs(day, p.primaryTimeZone) + min * 60000; createEvent({ allDay: false, start: st, end: st + p.defaultEventDuration * 60000 }, { draft: true }); } }} />
        <Item icon={<ClipboardPaste size={14} />} label={t('paste')} hint={`${MOD} V`} disabled={!getState().clipboard.length} onClick={() => { setState({ cursorDay: day }); paste(); close(); }} />
      </div>;
    }
    case 'calendar': return <CalendarMenu m={m} />;
    case 'calendarPick': {
      const occ = findOccurrence(m.data.key); const cals = getState().calendars.filter((c) => !c.readOnly);
      return <div className="pop-sec">{cals.map((c) => <Item key={c.id} label={c.name} checked={occ?.event.calendarId === c.id} icon={<span className="swatch" style={{ ['--sw' as any]: colorFamily(c.color, isDark()).backgroundPrimary }} />} onClick={() => { updateOccurrence(m.data.key, { calendarId: c.id }, { scope: 'all' }); close(); }} />)}</div>;
    }
    case 'busy': { const occ = findOccurrence(m.data.key); return <div className="pop-sec">
      <Item label={t('busy')} checked={occ?.event.transparency !== 'transparent'} onClick={() => { updateOccurrence(m.data.key, { transparency: 'opaque' }, { scope: 'all' }); close(); }} />
      <Item label={t('free')} checked={occ?.event.transparency === 'transparent'} onClick={() => { updateOccurrence(m.data.key, { transparency: 'transparent' }, { scope: 'all' }); close(); }} /></div>; }
    case 'visibility': { const occ = findOccurrence(m.data.key); const v = occ?.event.visibility ?? 'default'; return <div className="pop-sec">
      {(['default', 'public', 'private'] as const).map((k) => <Item key={k} label={k === 'default' ? t('defaultVisibility') : k === 'public' ? t('publicV') : t('privateV')} checked={v === k} onClick={() => { updateOccurrence(m.data.key, { visibility: k }, { scope: 'all' }); close(); }} />)}</div>; }
    case 'reminder': { const occ = findOccurrence(m.data.key); return <div className="pop-sec">
      {REMINDER_OPTS.map((r) => <Item key={r} label={reminderLabel(r)} onClick={() => { const cur = occ?.event.reminders ?? []; if (!cur.some((x) => x.minutes === r)) updateOccurrence(m.data.key, { reminders: [...cur, { minutes: r, method: 'notification' as const }].sort((a, b) => a.minutes - b.minutes) }, { scope: 'all' }); close(); }} />)}</div>; }
    case 'repeat': return <RepeatMenu m={m} />;
    case 'evColor': { const occ = findOccurrence(m.data.key); if (!occ) return null; const dk = isDark(); const calc = calendarOf(occ.event.calendarId)?.color;
      return <div className="pop-sec" style={{ width: 200 }}>
        <Item label={t('calendarColor')} checked={!occ.event.color} icon={<span className="swatch" style={{ ['--sw' as any]: colorFamily(calc || '#999', dk).backgroundPrimary }} />} onClick={() => { updateOccurrence(m.data.key, { color: undefined }, { scope: 'all' }); close(); }} />
        {PALETTE.map((c) => <Item key={c.id} label={c.name} checked={occ.event.color?.toUpperCase() === c.hex} icon={<span className="swatch" style={{ ['--sw' as any]: colorFamily(c.hex, dk).backgroundPrimary }} />} onClick={() => { updateOccurrence(m.data.key, { color: c.hex }, { scope: 'all' }); close(); }} />)}</div>; }
    case 'time': return <TimeMenu m={m} />;
    case 'tz': { const zones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney'];
      const occ = findOccurrence(m.data.key);
      return <div className="pop-sec" style={{ maxHeight: 320, overflowY: 'auto' }}>{Array.from(new Set([p.primaryTimeZone, ...zones])).map((z) => <Item key={z} label={z.replace(/_/g, ' ')} checked={(occ?.event.timeZone ?? p.primaryTimeZone) === z} onClick={() => { updateOccurrence(m.data.key, { timeZone: z }, { scope: 'all' }); close(); }} />)}</div>; }
    default: return null;
  }
}

function CalendarMenu({ m }: { m: MenuState }) {
  const [name, setName] = useState(''); const dark = isDark();
  if (m.data?.create) {
    return <div className="pop-sec" style={{ padding: 8, width: 240 }}>
      <input autoFocus placeholder={t('newCalendar')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && name.trim()) { addCalendar(name.trim(), PALETTE[(getState().calendars.length * 5) % PALETTE.length].hex); close(); } if (e.key === 'Escape') close(); }}
        style={{ width: '100%', height: 28, borderRadius: 6, border: 0, outline: 0, padding: '0 8px', background: 'rgba(255,255,255,.06)', color: 'var(--m-text)', fontSize: 13 }} />
    </div>;
  }
  const c = calendarOf(m.data.id); if (!c) return null;
  return <>
    <div className="colors">{PALETTE.map((p) => <button key={p.id} title={p.name} style={{ background: colorFamily(p.hex, dark).backgroundPrimary }} onClick={() => { updateCalendar(c.id, { color: p.hex }); close(); }}>{c.color.toUpperCase() === p.hex ? <Check size={10} /> : null}</button>)}</div>
    <div className="pop-sec">
      <Item label={c.visible ? t('hideCal') : t('showCal')} onClick={() => { updateCalendar(c.id, { visible: !c.visible }); close(); }} />
      <Item label={t('onlyThis')} onClick={() => { for (const x of getState().calendars) updateCalendar(x.id, { visible: x.id === c.id }); close(); }} />
      {!c.readOnly && <Item label={t('rename')} onClick={() => { const n = prompt(t('rename'), c.name); if (n?.trim()) updateCalendar(c.id, { name: n.trim() }); close(); }} />}
      <Item label={t('exportIcs')} onClick={() => { exportCalendar(c.id); close(); }} />
    </div>
    {!c.primary && <div className="pop-sec"><Item label={t('deleteCalendar')} danger onClick={() => { close(); if (confirm(`${t('deleteCalendar')}: ${c.name}?`)) removeCalendar(c.id); }} /></div>}
  </>;
}

function RepeatMenu({ m }: { m: MenuState }) {
  const occ = findOccurrence(m.data.key); if (!occ) return null;
  const day = occ.startDay; const wd = weekday(day); const { m: mo, d } = ymd(day);
  const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const opts: [string, string | undefined][] = [
    [t('doesNotRepeat'), undefined], [t('daily'), 'FREQ=DAILY'], [t('weekly', { d: wdShort(wd) }), `FREQ=WEEKLY;BYDAY=${WD[wd]}`],
    [t('weekdays'), 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'], [t('monthly', { n: d }), `FREQ=MONTHLY;BYMONTHDAY=${d}`], [t('yearly', { d: `${monthName(mo)} ${d}` }), `FREQ=YEARLY;BYMONTH=${mo};BYMONTHDAY=${d}`],
  ];
  const series = occ.seriesId ? getState().events[occ.seriesId] : occ.event.rrule ? occ.event : undefined;
  const cur = series?.rrule ? stringifyRRule(parseRRule(series.rrule)) : undefined;
  const known = opts.some(([, r]) => (r ? stringifyRRule(parseRRule(r)) : undefined) === cur);
  return <div className="pop-sec">{opts.map(([l, r]) => <Item key={l} label={l} checked={(cur ?? undefined) === (r ? stringifyRRule(parseRRule(r)) : undefined)} onClick={() => {
    close();
    if (series) updateOccurrence(m.data.key, { rrule: r }, { scope: 'all' });
    else updateOccurrence(m.data.key, { rrule: r });
  }} />)}
    {!known && cur && <Item label={ruleLabel(parseRRule(cur))} checked onClick={close} />}
    <div className="pop-div" />
    <Item label={t('custom')} onClick={() => { close(); setState({ overlay: 'recurrence', recKey: m.data.key }); }} /></div>;
}

function TimeMenu({ m }: { m: MenuState }) {
  const occ = findOccurrence(m.data.key); const p = getState().prefs; const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector('.act')?.scrollIntoView({ block: 'center' }); }, []);
  if (!occ) return null; const tz = p.primaryTimeZone; const day = occ.startDay; const sod = startOfDayMs(day, tz);
  const isEnd = m.data.edge === 'end'; const base = isEnd ? occ.start : sod;
  const slots = Array.from({ length: 96 }, (_, i) => base + (isEnd ? (i + 1) : i) * 15 * 60000).filter((x) => !isEnd || x - occ.start <= 24 * 3600000);
  const cur = isEnd ? occ.end : occ.start;
  return <div ref={ref} className="pop-sec" style={{ maxHeight: 280, overflowY: 'auto', width: 190 }}>{slots.map((x) => {
    const mins = Math.round((x - occ.start) / 60000);
    return <div key={x} className={`mi tnum${x === cur ? ' act' : ''}`} onClick={() => {
      close(); if (isEnd) updateOccurrence(m.data.key, { end: x }); else updateOccurrence(m.data.key, { start: x, end: x + (occ.end - occ.start) });
    }}><span className="lbl">{panelTime(x, tz, p.format24HourTime)}</span>{isEnd && <span className="hint">{mins < 60 ? `${mins}m` : `${(mins / 60).toFixed(mins % 60 ? 1 : 0)}h`}</span>}</div>;
  })}</div>;
}
void toWall; void fromWall; void dayOf;
