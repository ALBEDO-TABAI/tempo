import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, PanelRight, Clock, ArrowRight, Users, Video, MapPin, Link2, AlignLeft, Bell, MoreHorizontal, Trash2, Globe, Repeat, X, ChevronDown } from 'lucide-react';
import { CalEvent, Occurrence, colorFamily, parseIsoDate, isoDate, startOfDayMs, toWall, fromWall, ymd, dayOf, describe as describeRule, parseRRule, Attendee } from '@tempo/core';
import { useStore, getState, setState, setPrefs, findOccurrence, updateOccurrence, deleteOccurrences, openMenu, calendarOf, isDark, occurrencesIn, select, goToDay } from '../store';
import { longDate, panelTime, durationLabel } from '../fmt';
import { t } from '../i18n';
import { MOD } from '../commands';
import { ShortcutList } from './Shortcuts';

export function Kbd({ keys }: { keys: string[] }) { return <span className="kbds">{keys.map((k, i) => <kbd key={i} className="kbd">{k}</kbd>)}</span>; }

export function Panel() {
  const s = useStore((x) => ({ editing: x.editing, overlay: x.overlay, q: x.searchQuery, n: x.selected.length }));
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
      <div className="panel-body">
        {s.overlay === 'shortcuts' ? <ShortcutList filter={s.q} /> : s.overlay === 'search' ? <SearchResults q={s.q} /> : s.editing ? <EventPanel key={s.editing} occKey={s.editing} /> : <Useful />}
      </div>
    </aside>
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
  const [desc, setDesc] = useState(occ?.event.description ?? ''); const [loc, setLoc] = useState(occ?.event.location ?? ''); const [guest, setGuest] = useState('');
  useEffect(() => { const el = titleRef.current; if (el && occ) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sl = getSelection(); sl?.removeAllRanges(); sl?.addRange(r); } }, [s.focus]); // eslint-disable-line
  if (!occ) return <Useful />;
  const ev = occ.event; const cal = calendarOf(ev.calendarId); const ro = !!cal?.readOnly; const tz = s.prefs.primaryTimeZone; const h24 = s.prefs.format24HourTime;
  const fam = colorFamily(ev.color || cal?.color || '#999', s.dark);
  const patch = (p: Partial<CalEvent>, scope?: 'this' | 'all') => updateOccurrence(occKey, p, { scope: scope ?? (occ.seriesId || ev.rrule ? undefined : 'this') });
  const saveTitle = () => { const v = titleRef.current?.textContent ?? ''; if (v !== ev.title) patch({ title: v }, 'all'); };
  const dur = Math.round((occ.end - occ.start) / 60000);
  const anchor = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).getBoundingClientRect();
  const series = occ.seriesId ? getState().events[occ.seriesId] : ev.rrule ? ev : undefined;
  const ruleText = series?.rrule ? describeRule(parseRRule(series.rrule)) : t('doesNotRepeat');
  const toggleAllDay = () => {
    if (ev.allDay) { const { y, m, d } = ymd(occ.startDay); const st = fromWall({ y, m, d, h: 9 }, tz); patch({ allDay: false, start: st, end: st + s.prefs.defaultEventDuration * 60000, timeZone: tz }); }
    else patch({ allDay: true, start: isoDate(occ.startDay), end: isoDate(occ.endDay + 1), timeZone: undefined });
  };
  const addGuest = () => {
    const em = guest.trim(); if (!/^\S+@\S+$/.test(em)) return; setGuest('');
    const list: Attendee[] = [...(ev.attendees ?? [])]; if (!list.some((a) => a.organizer)) list.unshift({ email: 'me@tempo.local', rsvp: 'accepted', organizer: true, self: true });
    if (!list.some((a) => a.email === em)) list.push({ email: em, rsvp: 'needsAction' }); patch({ attendees: list }, 'all');
  };
  return (
    <div className="ev" data-testid="eventpanel">
      <div className="ev-top"><span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('event')} <ChevronDown size={12} /></span>
        <button className="ibtn sm" onClick={(e) => { const r = anchor(e); openMenu({ kind: 'chip', x: r.left - 180, y: r.bottom + 4, data: { key: occKey } }); }}><MoreHorizontal size={16} /></button></div>
      <div ref={titleRef} className="ev-title" data-testid="ev-title" contentEditable={!ro} suppressContentEditableWarning data-ph={t('noTitle')}
        onBlur={saveTitle} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveTitle(); (e.target as HTMLElement).blur(); setState({ draftId: null }); } if (e.key === 'Escape') { (e.target as HTMLElement).textContent = ev.title; (e.target as HTMLElement).blur(); } e.stopPropagation(); }}>{ev.title}</div>
      <div className="ev-row"><Clock size={16} />
        {ev.allDay ? <span className="fld">{longDate(occ.startDay)}{occ.endDay > occ.startDay ? ` → ${longDate(occ.endDay)}` : ''}</span> : <>
          <button className="fld tnum" disabled={ro} onClick={(e) => { const r = anchor(e); openMenu({ kind: 'time', x: r.left, y: r.bottom + 4, data: { key: occKey, edge: 'start' } }); }}>{panelTime(occ.start, tz, h24)}</button>
          <ArrowRight size={14} style={{ color: 'var(--c-text2)' }} />
          <button className="fld tnum" disabled={ro} onClick={(e) => { const r = anchor(e); openMenu({ kind: 'time', x: r.left, y: r.bottom + 4, data: { key: occKey, edge: 'end' } }); }}>{panelTime(occ.end, tz, h24)}</button>
          <span className="dur">{durationLabel(dur, t)}</span></>}
      </div>
      {!ev.allDay && <div className="ev-row" style={{ paddingLeft: 42 }}><DateField occ={occ} disabled={ro} onChange={(d) => { const delta = startOfDayMs(d, tz) - startOfDayMs(occ.startDay, tz); patch({ start: occ.start + delta, end: occ.end + delta }); }} /></div>}
      <div className="ev-opts">
        <button className={ev.allDay ? 'on' : ''} disabled={ro} onClick={toggleAllDay}>{t('allDay')}</button>
        <button disabled={ro || ev.allDay} onClick={(e) => { const r = anchor(e); openMenu({ kind: 'tz', x: r.left, y: r.bottom + 4, data: { key: occKey } }); }} className={ev.timeZone && ev.timeZone !== tz ? 'on' : ''}>{ev.timeZone && ev.timeZone !== tz ? ev.timeZone.split('/').pop()!.replace(/_/g, ' ') : t('timeZone')}</button>
        <button disabled={ro} className={series ? 'on' : ''} onClick={(e) => { const r = anchor(e); openMenu({ kind: 'repeat', x: r.left, y: r.bottom + 4, data: { key: occKey } }); }}>{series ? ruleText : t('repeat')}</button>
      </div>
      <div className="ev-sep" />
      <div className="ev-row dim"><Users size={16} /><input className="fld" placeholder={t('addParticipants')} value={guest} disabled={ro} onChange={(e) => setGuest(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addGuest(); e.stopPropagation(); }} /></div>
      {ev.attendees?.map((a) => (
        <div key={a.email} className="ev-row" style={{ paddingLeft: 42, minHeight: 26 }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name || a.email}{a.organizer ? <span style={{ color: 'var(--c-text2)' }}> · {t('organizer')}</span> : null}</span>
          {!a.organizer && !ro && <button className="ibtn xs" onClick={() => patch({ attendees: ev.attendees!.filter((x) => x.email !== a.email) }, 'all')}><X size={12} /></button>}
        </div>
      ))}
      <div className="ev-row dim"><Video size={16} /><input className="fld" placeholder={t('conferencing')} defaultValue={ev.conferenceUrl ?? ''} disabled={ro} onBlur={(e) => { if (e.target.value !== (ev.conferenceUrl ?? '')) patch({ conferenceUrl: e.target.value || undefined }, 'all'); }} onKeyDown={(e) => e.stopPropagation()} /></div>
      <div className="ev-row dim"><MapPin size={16} /><input className="fld" placeholder={t('location')} value={loc} disabled={ro} onChange={(e) => setLoc(e.target.value)} onBlur={() => { if (loc !== (ev.location ?? '')) patch({ location: loc || undefined }, 'all'); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); e.stopPropagation(); }} /></div>
      <div className="ev-sep" />
      <div className="ev-row dim"><Link2 size={16} /><input className="fld" placeholder={t('addLink')} defaultValue={ev.url ?? ''} disabled={ro} onBlur={(e) => { if (e.target.value !== (ev.url ?? '')) patch({ url: e.target.value || undefined }, 'all'); }} onKeyDown={(e) => e.stopPropagation()} /></div>
      <div className="ev-sep" />
      <div className="ev-row dim" style={{ alignItems: 'flex-start', paddingTop: 6 }}><AlignLeft size={16} style={{ marginTop: 2 }} /><textarea className="fld" rows={Math.min(10, Math.max(2, desc.split('\n').length))} placeholder={t('description')} value={desc} disabled={ro} onChange={(e) => setDesc(e.target.value)} onBlur={() => { if (desc !== (ev.description ?? '')) patch({ description: desc || undefined }, 'all'); }} onKeyDown={(e) => e.stopPropagation()} /></div>
      <div className="ev-sep" />
      <div className="ev-row"><span className="swatch" style={{ ['--sw' as any]: fam.backgroundPrimary }} />
        <button className="fld" disabled={ro} onClick={(e) => { const r = anchor(e); openMenu({ kind: 'calendarPick', x: r.left, y: r.bottom + 4, data: { key: occKey } }); }}>{cal?.name}</button></div>
      <div className="ev-row" style={{ paddingLeft: 42, gap: 24 }}>
        <button className="fld" disabled={ro} onClick={(e) => { const r = anchor(e); openMenu({ kind: 'busy', x: r.left, y: r.bottom + 4, data: { key: occKey } }); }}>{ev.transparency === 'transparent' ? t('free') : t('busy')}</button>
        <button className="fld" disabled={ro} onClick={(e) => { const r = anchor(e); openMenu({ kind: 'visibility', x: r.left, y: r.bottom + 4, data: { key: occKey } }); }}>{ev.visibility === 'private' ? t('privateV') : ev.visibility === 'public' ? t('publicV') : t('defaultVisibility')}</button>
      </div>
      <div className="ev-row dim"><Bell size={16} /><span>{t('reminders')}</span></div>
      {(ev.reminders ?? []).map((r, i) => (
        <div key={i} className="ev-row" style={{ paddingLeft: 42, minHeight: 28 }}><span style={{ flex: 1 }}>{reminderLabel(r.minutes)}</span>
          {!ro && <button className="ibtn xs" onClick={() => patch({ reminders: ev.reminders!.filter((_, j) => j !== i) }, 'all')}><X size={12} /></button>}</div>
      ))}
      {!ro && <div className="ev-row dim" style={{ paddingLeft: 42, minHeight: 28 }}><button className="fld" onClick={(e) => { const r = anchor(e); openMenu({ kind: 'reminder', x: r.left, y: r.bottom + 4, data: { key: occKey } }); }}>{t('addReminder')}</button></div>}
      {!ro && <><div className="ev-sep" /><div className="ev-row dim"><Trash2 size={16} /><button className="fld" onClick={() => deleteOccurrences([occKey])}>{t('deleteEvent')}</button></div></>}
      <div style={{ display: 'none' }}><Globe /><Repeat /></div>
    </div>
  );
}

function DateField({ occ, disabled, onChange }: { occ: Occurrence; disabled?: boolean; onChange: (d: number) => void }) {
  return (
    <label className="fld" style={{ position: 'relative' }}>
      {longDate(occ.startDay)}
      <input type="date" disabled={disabled} value={isoDate(occ.startDay)} onChange={(e) => { if (e.target.value) onChange(parseIsoDate(e.target.value)); }}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'default' }} onKeyDown={(e) => e.stopPropagation()} />
    </label>
  );
}
void toWall; void dayOf;
