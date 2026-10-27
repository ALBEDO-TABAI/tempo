import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, PanelRight, Clock, ArrowRight, Users, Video, MapPin, Link2, AlignLeft, Bell, MoreHorizontal, Globe, Palette, Repeat, X, ChevronDown } from 'lucide-react';
import { CalEvent, Occurrence, colorFamily, PALETTE, parseIsoDate, isoDate, startOfDayMs, toWall, fromWall, ymd, dayOf, parseRRule, Attendee } from '@tempo/core';
import { useStore, getState, setState, setPrefs, findOccurrence, updateOccurrence, openMenu, calendarOf, isDark, occurrencesIn, select, goToDay } from '../store';
import { longDate, panelTime, durationLabel, gmtLabel, ruleLabel } from '../fmt';
import { t } from '../i18n';
import { MOD } from '../commands';
import { ShortcutList } from './Shortcuts';
import { stopAvailability, removeSlot, fillFree, copyAvailability, createHolds, clearSlots } from '../availability';

export function Kbd({ keys }: { keys: string[] }) { return <span className="kbds">{keys.map((k, i) => <kbd key={i} className="kbd">{k}</kbd>)}</span>; }

export function Panel() {
  const s = useStore((x) => ({ editing: x.editing, overlay: x.overlay, q: x.searchQuery, n: x.selected.length, avail: x.avail.active }));
  const inp = useRef<HTMLInputElement>(null);
  const searching = s.overlay === 'search' || s.overlay === 'shortcuts';
  useEffect(() => { if (searching) inp.current?.focus(); }, [searching]);
  return (
    <aside className="panel" data-testid="panel">
      <div className="panel-head">
        <div className={`search${searching ? ' active' : ''}`}>
          <Search size={18} />
          <input ref={inp} data-testid="search" placeholder={s.overlay === 'shortcuts' ? t('searchShortcuts') : t('search')} value={s.q}
            onFocus={() => { if (!searching) setState({ overlay: 'search' }); }}
            onChange={(e) => setState({ searchQuery: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Escape') { setState({ overlay: null, searchQuery: '' }); inp.current?.blur(); } e.stopPropagation(); }} />
          {searching && <button className="ibtn xs" style={{ position: 'absolute', right: 5, top: 5 }} onClick={() => setState({ overlay: null, searchQuery: '' })}><X size={14} /></button>}
        </div>
        <button className="ibtn" onClick={() => setPrefs({ contextPanel: false })}><PanelRight size={18} /></button>
      </div>
      <div style={{ height: 21, flex: 'none' }} />
      <div className="panel-body">
        {s.overlay === 'shortcuts' ? <ShortcutList filter={s.q} /> : s.overlay === 'search' ? <SearchResults q={s.q} /> : s.avail ? <AvailabilityPanel /> : s.editing ? <EventPanel key={s.editing} occKey={s.editing} /> : <Useful />}
      </div>
    </aside>
  );
}

function AvailabilityPanel() {
  const a = useStore((x) => x.avail); const z = getState().prefs.primaryTimeZone; const h24 = getState().prefs.format24HourTime;
  return (
    <div className="ps avail" data-testid="availpanel">
      <div className="ps-title" style={{ display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>{t('shareAvail')}</span><button className="btn sm" onClick={stopAvailability}>{t('exitAvail')}</button></div>
      <div className="set-note" style={{ padding: '0 8px 8px' }}>{t('availHint')}</div>
      {a.slots.length ? <ul className="av-list">{a.slots.map((x, i) => <li key={i}><span className="tnum">{longDate(dayOf(x.start, z))} · {panelTime(x.start, z, h24)} – {panelTime(x.end, z, h24)}</span><button className="ibtn xs" onClick={() => removeSlot(i)}><X size={12} /></button></li>)}</ul>
        : <div className="set-note" style={{ padding: '4px 8px' }}>{t('noSlots')}</div>}
      <div className="av-actions">
        <button className="btn" data-testid="av-fill" onClick={fillFree}>{t('fillFree')}</button>
        <button className="btn primary" data-testid="av-copy" disabled={!a.slots.length} onClick={() => { void copyAvailability(); }}>{t('copyText')}</button>
        <button className="btn" data-testid="av-holds" disabled={!a.slots.length} onClick={() => createHolds()}>{t('createHolds')}</button>
        <button className="btn" disabled={!a.slots.length} onClick={clearSlots}>{t('clearAll')}</button>
      </div>
    </div>
  );
}

function Useful() {
  const rows: [string, string[]][] = [[t('commandMenu'), [MOD, 'K']], [t('toggleSidebar'), ['\\']], [t('goToDate'), ['.']], [t('sPanel'), [MOD, '\\']], [t('allShortcuts'), ['?']]];
  return (
    <div className="ps">
      <div className="ps-title">{t('usefulShortcuts')}</div>
      <ul className="ps-list">{rows.map(([l, k]) => <li key={l} onClick={() => { if (k[0] === '?') setState({ overlay: 'shortcuts' }); }}><span>{l}</span><Kbd keys={k} /></li>)}</ul>
    </div>
  );
}

function SearchResults({ q }: { q: string }) {
  const s = useStore((x) => ({ events: x.events, today: x.today }));
  const res = useMemo(() => {
    const qq = q.trim().toLowerCase(); if (!qq) return [] as Occurrence[];
    return occurrencesIn(s.today - 365, s.today + 365).filter((o) => `${o.event.title} ${o.event.location ?? ''} ${o.event.description ?? ''}`.toLowerCase().includes(qq)).slice(0, 200);
  }, [q, s.events, s.today]);
  if (!q.trim()) return null;
  if (!res.length) return <div className="ps"><div className="set-note" style={{ padding: '0 8px' }}>{t('noResults')}</div></div>;
  const up = res.filter((o) => o.end >= Date.now()), past = res.filter((o) => o.end < Date.now()).reverse();
  const tz = getState().prefs.primaryTimeZone, h24 = getState().prefs.format24HourTime;
  const row = (o: Occurrence) => (
    <div key={o.key} className="side-row" style={{ height: 'auto', padding: '6px 8px', alignItems: 'flex-start' }} onClick={() => { goToDay(o.startDay); select([o.key]); setState({ overlay: null }); }}>
      <span className="swatch" style={{ ['--sw' as any]: colorFamily(calendarOf(o.event.calendarId)?.color || '#999', isDark()).backgroundPrimary, marginTop: 2 }} />
      <span className="lbl"><div>{o.event.title || t('noTitle')}</div><div style={{ fontSize: 12, color: 'var(--c-text2)', fontWeight: 400 }}>{longDate(o.startDay)}{o.allDay ? '' : ` · ${panelTime(o.start, tz, h24)}`}</div></span>
    </div>
  );
  return <div className="ps">{up.length > 0 && <><div className="ps-sec">{t('upcoming')}</div>{up.map(row)}</>}{past.length > 0 && <><div className="ps-sec">{t('past')}</div>{past.map(row)}</>}</div>;
}

const REMINDER_OPTS = [0, 5, 10, 15, 30, 60, 120, 1440];
export const reminderLabel = (m: number) => (m === 0 ? t('atStart') : m % 1440 === 0 ? t('daysBefore', { n: m / 1440 }) : m % 60 === 0 ? t('hoursBefore', { n: m / 60 }) : t('minutesBefore', { n: m }));
export { REMINDER_OPTS };

function EventPanel({ occKey }: { occKey: string }) {
  const s = useStore((x) => ({ events: x.events, focus: x.focusTitle, prefs: x.prefs, calendars: x.calendars, dark: isDark(x) }));
  const occ = findOccurrence(occKey); const titleRef = useRef<HTMLDivElement>(null);
  const [desc, setDesc] = useState(occ?.event.description ?? ''); const [loc, setLoc] = useState(occ?.event.location ?? ''); const [guest, setGuest] = useState(''); const [optsOpen, setOptsOpen] = useState(false);
  const firstFocus = useRef(s.focus); useEffect(() => { const el = titleRef.current; if (s.focus === firstFocus.current && getState().draftId !== occKey && occ?.event.title) return; if (el && occ) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sl = getSelection(); sl?.removeAllRanges(); sl?.addRange(r); } }, [s.focus]); // eslint-disable-line
  if (!occ) return <Useful />;
  const ev = occ.event; const cal = calendarOf(ev.calendarId); const ro = !!cal?.readOnly; const tz = s.prefs.primaryTimeZone; const h24 = s.prefs.format24HourTime;
  const fam = colorFamily(ev.color || cal?.color || '#999', s.dark);
  const patch = (p: Partial<CalEvent>, scope?: 'this' | 'all') => updateOccurrence(occKey, p, { scope: scope ?? (occ.seriesId || ev.rrule ? undefined : 'this') });
  const saveTitle = () => { const v = titleRef.current?.textContent ?? ''; if (v !== ev.title) patch({ title: v }, 'all'); };
  const dur = Math.round((occ.end - occ.start) / 60000);
  const anchor = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).getBoundingClientRect();
  const series = occ.seriesId ? getState().events[occ.seriesId] : ev.rrule ? ev : undefined;
  const ruleText = series?.rrule ? ruleLabel(parseRRule(series.rrule)) : t('doesNotRepeat');
  const toggleAllDay = () => {
    if (ev.allDay) { const { y, m, d } = ymd(occ.startDay); const st = fromWall({ y, m, d, h: 9 }, tz); patch({ allDay: false, start: st, end: st + s.prefs.defaultEventDuration * 60000, timeZone: tz }); }
    else patch({ allDay: true, start: isoDate(occ.startDay), end: isoDate(occ.endDay + 1), timeZone: undefined });
  };
  const addGuest = () => {
    const em = guest.trim(); if (!/^\S+@\S+$/.test(em)) return; setGuest('');
    const list: Attendee[] = [...(ev.attendees ?? [])]; const pr = getState().prefs; if (!list.some((a) => a.organizer)) list.unshift({ email: pr.email || 'me@tempo.local', name: pr.displayName || undefined, rsvp: 'accepted', organizer: true, self: true });
    if (!list.some((a) => a.email === em)) list.push({ email: em, rsvp: 'needsAction' });
    const addVideo = pr.autoAddVideo && pr.videoProvider !== 'none' && pr.videoUrl && !ev.conferenceUrl;
    patch(addVideo ? { attendees: list, conferenceUrl: pr.videoUrl } : { attendees: list }, 'all');
  };
  const showOpts = optsOpen || ev.allDay || !!series || (!!ev.timeZone && ev.timeZone !== tz);
  const menuAt = (kind: any, data: Record<string, unknown> = {}) => (e: React.MouseEvent) => { const r = anchor(e); openMenu({ kind, x: r.left, y: r.bottom + 4, data: { key: occKey, ...data } }); };
  const evTz = ev.timeZone || tz;
  return (
    <div className="ev" data-testid="eventpanel">
      <div className="ev-top"><button className="ev-kind">{t('event')} <ChevronDown size={14} /></button><span style={{ flex: 1 }} />
        <button className="ibtn ev-more" onClick={(e) => { const r = anchor(e); openMenu({ kind: 'chip', x: r.left - 180, y: r.bottom + 4, data: { key: occKey } }); }}><MoreHorizontal size={16} /></button></div>
      <div className="ev-sec first"><div className="ev-r">
        <div ref={titleRef} className="ev-title" data-testid="ev-title" contentEditable={!ro} suppressContentEditableWarning data-ph={t('noTitle')}
          onBlur={saveTitle} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveTitle(); (e.target as HTMLElement).blur(); setState({ draftId: null }); } if (e.key === 'Escape') { (e.target as HTMLElement).textContent = ev.title; (e.target as HTMLElement).blur(); } e.stopPropagation(); }}>{ev.title}</div></div></div>
      <div className="ev-sec">
        {ev.allDay ? <div className="ev-r"><div className="ev-f"><Clock size={18} /><DateField occ={occ} disabled={ro} label={`${longDate(occ.startDay)}${occ.endDay > occ.startDay ? ` → ${longDate(occ.endDay)}` : ''}`} onChange={(d) => { const len = occ.endDay - occ.startDay; patch({ start: isoDate(d), end: isoDate(d + len + 1) }); }} /></div></div> : <>
          <div className="ev-r">
            <button className="ev-f ev-t1 tnum" data-testid="ev-start" data-field="s" disabled={ro} onClick={menuAt('time', { edge: 'start' })}><Clock size={18} /><span>{panelTime(occ.start, tz, h24)}</span></button>
            <button className="ev-f ev-t2 tnum" data-testid="ev-end" data-field="e" disabled={ro} onClick={menuAt('time', { edge: 'end' })}><ArrowRight size={16} /><span>{panelTime(occ.end, tz, h24)}</span><span className="dur">{durationLabel(dur, t)}</span></button>
          </div>
          <div className="ev-r ind"><DateField occ={occ} disabled={ro} onChange={(d) => { const delta = startOfDayMs(d, tz) - startOfDayMs(occ.startDay, tz); patch({ start: occ.start + delta, end: occ.end + delta }); }} /></div></>}
        {!showOpts ? <div className="ev-r ind"><button className="ev-f ev-opts" data-testid="ev-opts" data-field="x" disabled={ro} onClick={() => setOptsOpen(true)}><span>{t('allDay')}</span><span>{t('timeZone')}</span><span>{t('repeat')}</span></button></div> : <>
          <div className="ev-r"><button className="ev-f" data-testid="ev-allday" data-field="a" disabled={ro} onClick={toggleAllDay}><span className={`tgl${ev.allDay ? ' on' : ''}`}><i /></span><span className={ev.allDay ? '' : 'dim'}>{t('allDay')}</span></button></div>
          {!ev.allDay && <div className="ev-r"><button className="ev-f" data-testid="ev-tz" data-field="z" disabled={ro} onClick={menuAt('tz')}><Globe size={18} /><span className="dim">{gmtLabel(evTz)}</span><span>&nbsp;{evTz.split('/').pop()!.replace(/_/g, ' ')}</span></button></div>}
          <div className="ev-r"><button className="ev-f" data-testid="ev-repeat" data-field="r" disabled={ro} onClick={menuAt('repeat')}><Repeat size={18} /><span className={series ? '' : 'dim'}>{series ? ruleText : t('repeat')}</span></button></div></>}
      </div>
      <div className="ev-sec">
        <div className="ev-r"><div className="ev-f"><Users size={18} /><input data-field="p" placeholder={t('addParticipants')} value={guest} disabled={ro} onChange={(e) => setGuest(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addGuest(); e.stopPropagation(); }} /></div></div>
        {ev.attendees?.map((a) => (
          <div key={a.email} className="ev-r ind"><div className="ev-f"><span className="att">{a.name || a.email}{a.organizer ? <span className="dim"> · {t('organizer')}</span> : null}</span>
            {!a.organizer && !ro && <button className="ibtn xs" onClick={() => patch({ attendees: ev.attendees!.filter((x) => x.email !== a.email) }, 'all')}><X size={12} /></button>}</div></div>
        ))}
        <div className="ev-r"><div className="ev-f"><Video size={18} /><input data-field="v" placeholder={t('conferencing')} defaultValue={ev.conferenceUrl ?? ''} disabled={ro} onBlur={(e) => { if (e.target.value !== (ev.conferenceUrl ?? '')) patch({ conferenceUrl: e.target.value || undefined }, 'all'); }} onKeyDown={(e) => e.stopPropagation()} /></div></div>
        <div className="ev-r"><button className="ev-f" data-testid="ev-color" data-field="o" disabled={ro} onClick={menuAt('evColor')}><Palette size={18} /><span className={ev.color ? '' : 'dim'}>{ev.color ? (PALETTE.find((c) => c.hex === ev.color?.toUpperCase())?.name ?? ev.color) : t('eventColor')}</span>{ev.color && <span className="ev-sw" style={{ ['--sw' as any]: fam.backgroundPrimary, marginLeft: 2 }} />}</button></div>
        <div className="ev-r"><div className="ev-f"><MapPin size={18} /><input data-field="l" placeholder={t('location')} value={loc} disabled={ro} onChange={(e) => setLoc(e.target.value)} onBlur={() => { if (loc !== (ev.location ?? '')) patch({ location: loc || undefined }, 'all'); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); e.stopPropagation(); }} /></div></div>
      </div>
      <div className="ev-sec"><div className="ev-r"><div className="ev-f"><Link2 size={18} /><input data-field="u" placeholder={t('addLink')} defaultValue={ev.url ?? ''} disabled={ro} onBlur={(e) => { if (e.target.value !== (ev.url ?? '')) patch({ url: e.target.value || undefined }, 'all'); }} onKeyDown={(e) => e.stopPropagation()} /></div></div></div>
      <div className="ev-sec"><div className="ev-r auto"><div className="ev-f noicon"><textarea data-field="n" rows={Math.min(12, Math.max(1, desc.split('\n').length))} placeholder={t('description')} value={desc} disabled={ro} onChange={(e) => setDesc(e.target.value)} onBlur={() => { if (desc !== (ev.description ?? '')) patch({ description: desc || undefined }, 'all'); }} onKeyDown={(e) => e.stopPropagation()} /></div></div></div>
      <div className="ev-sec">
        <div className="ev-r"><button className="ev-f" data-field="c" disabled={ro} onClick={menuAt('calendarPick')}><span className="ev-sw" style={{ ['--sw' as any]: fam.backgroundPrimary }} /><span>{cal?.name}</span></button></div>
        <div className="ev-r ind" style={{ gap: 0 }}>
          <button className="ev-f" data-field="f" style={{ minWidth: 94 }} disabled={ro} onClick={menuAt('busy')}>{ev.transparency === 'transparent' ? t('free') : t('busy')}</button>
          <button className="ev-f" data-field="y" disabled={ro} onClick={menuAt('visibility')}>{ev.visibility === 'private' ? t('privateV') : ev.visibility === 'public' ? t('publicV') : t('defaultVisibility')}</button>
        </div>
        <div className="ev-r"><button className="ev-f" data-field="m" disabled={ro} onClick={menuAt('reminder')}><Bell size={18} /><span className="dim">{t('reminders')}</span></button></div>
        {(ev.reminders ?? []).map((r, i) => (
          <div key={i} className="ev-r ind"><div className="ev-f"><span style={{ flex: 1 }}>{reminderLabel(r.minutes)}</span>
            {!ro && <button className="ibtn xs" onClick={() => patch({ reminders: ev.reminders!.filter((_, j) => j !== i) }, 'all')}><X size={12} /></button>}</div></div>
        ))}
        {!ro && !(ev.reminders ?? []).length && <div className="ev-r ind"><button className="ev-f dim" onClick={menuAt('reminder')}>{t('addReminder')}</button></div>}
      </div>
    </div>
  );
}

function DateField({ occ, disabled, onChange, label }: { occ: Occurrence; disabled?: boolean; label?: string; onChange: (d: number) => void }) {
  return (
    <label data-field="d" className="ev-f ev-date" style={{ position: 'relative' }}>
      {label ?? longDate(occ.startDay)}
      <input type="date" disabled={disabled} value={isoDate(occ.startDay)} onChange={(e) => { if (e.target.value) onChange(parseIsoDate(e.target.value)); }}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'default' }} onKeyDown={(e) => e.stopPropagation()} />
    </label>
  );
}
void toWall; void dayOf;
