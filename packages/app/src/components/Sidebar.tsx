import { useState } from 'react';
import { ChevronUp, ChevronDown, PanelLeft, Search, SquarePen, Eye, EyeOff, MoreHorizontal, Plus, CalendarSearch, Download, HelpCircle } from 'lucide-react';
import { startOfWeek, startOfMonth, addMonths, weekday, ymd, parseIsoDate, DayNum, colorFamily } from '@tempo/core';
import { useStore, getState, setState, goToDay, setPrefs, updateCalendar, openMenu, openOverlay, createEvent, importIcsFile, isDark, tz } from '../store';
import { miniTitle, wdMini } from '../fmt';
import { t } from '../i18n';
import { parseDateInput } from '../dateinput';

export function MiniMonth() {
  const s = useStore((x) => ({ anchor: x.anchor, today: x.today, wso: x.prefs.weekStartsOn, view: x.prefs.gridView, days: x.prefs.daysPerPeriod }));
  const [page, setPage] = useState<DayNum | null>(null);
  const month = page ?? startOfMonth(s.anchor);
  const first = startOfWeek(month, s.wso); const { m } = ymd(month);
  const visFirst = s.view === 'month' ? startOfWeek(startOfMonth(s.anchor), s.wso) : s.days === 7 ? startOfWeek(s.anchor, s.wso) : s.anchor;
  const visLast = s.view === 'month' ? visFirst + 41 : visFirst + s.days - 1;
  const rows = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => first + w * 7 + i));
  return (
    <div className="mini" data-testid="minimonth">
      <div className="mini-head">
        <div className="mini-title">{miniTitle(month)}</div>
        <button className="ibtn sm" onClick={() => setPage(addMonths(month, -1))}><ChevronUp size={16} /></button>
        <button className="ibtn sm" style={{ marginLeft: 8 }} onClick={() => setPage(addMonths(month, 1))}><ChevronDown size={16} /></button>
      </div>
      <div className="mini-grid">
        {Array.from({ length: 7 }, (_, i) => <div key={i} className="mini-wd">{wdMini((i + s.wso) % 7)}</div>)}
        {rows.map((r, w) => {
          const cur = r.some((d) => d >= visFirst && d <= visLast) && (s.view === 'month' || s.days >= 7);
          return <div key={w} className={`mini-row${cur ? ' cur' : ''}`}>
            {r.map((d) => {
              const dm = ymd(d).m; const wd = weekday(d);
              const sel = s.view !== 'month' && s.days < 7 && d >= visFirst && d <= visLast;
              return <button key={d} className={`mini-day tnum${dm !== m ? ' out' : ''}${d === s.today ? ' today' : ''}${wd === 0 || wd === 6 ? '' : ''}`}
                style={sel ? { background: 'var(--c-week-row)' } : undefined} onClick={() => { goToDay(d); setPage(null); }}><span>{ymd(d).d}</span></button>;
            })}
          </div>;
        })}
      </div>
    </div>
  );
}

export function Sidebar() {
  const s = useStore((x) => ({ calendars: x.calendars, accounts: x.accounts, dark: isDark(x) }));
  const [q, setQ] = useState('');
  const go = () => { const d = parseDateInput(q, getState().today); if (d !== null) { goToDay(d); setQ(''); } };
  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-top">
        <button className="ibtn sm" title={t('toggleSidebar')} onClick={() => setPrefs({ sidebar: false })}><PanelLeft size={16} /></button>
        <div style={{ flex: 1 }} />
        <button className="ibtn sm" title={t('search')} onClick={() => openOverlay('search')}><Search size={16} /></button>
        <button className="ibtn sm" title={t('newEvent')} onClick={() => newEventNow()}><SquarePen size={16} /></button>
      </div>
      <div className="sidebar-scroll">
        <MiniMonth />
        <div style={{ padding: '0 0 0' }}>
          <div style={{ position: 'relative' }}>
            <CalendarSearch size={16} style={{ position: 'absolute', left: 18, top: 15, color: 'var(--c-text3)' }} />
            <input className="side-input" placeholder={t('goToDate')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); e.stopPropagation(); }} />
          </div>
        </div>
        <div className="sidebar-sep" />
        {s.accounts.map((a) => (
          <div key={a.id} className="side-sec">
            <div className="side-head"><span style={{ flex: 1 }}>{a.kind === 'local' ? t('local') : a.name}</span></div>
            {s.calendars.filter((c) => c.accountId === a.id).map((c) => {
              const fam = colorFamily(c.color, s.dark);
              return (
                <div key={c.id} className={`side-row${c.visible ? '' : ' hidden'}`} data-cal={c.id}
                  onClick={() => updateCalendar(c.id, { visible: !c.visible })}
                  onContextMenu={(e) => { e.preventDefault(); openMenu({ kind: 'calendar', x: e.clientX, y: e.clientY, data: { id: c.id } }); }}>
                  <span className={`swatch${c.visible ? '' : ' off'}`} style={{ ['--sw' as any]: fam.backgroundPrimary }} />
                  <span className="lbl">{c.name}</span>
                  {c.primary && <span className="tag">{t('defaultTag')}</span>}
                  <span className="tools">
                    <button className="ibtn xs" onClick={(e) => { e.stopPropagation(); updateCalendar(c.id, { visible: !c.visible }); }}>{c.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                    <button className="ibtn xs" onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); openMenu({ kind: 'calendar', x: r.left, y: r.bottom + 4, data: { id: c.id } }); }}><MoreHorizontal size={14} /></button>
                  </span>
                </div>
              );
            })}
            <div className="side-row" onClick={() => openMenu({ kind: 'calendar', x: 16, y: 300, data: { create: true } })} style={{ color: 'var(--c-text2)' }}><Plus size={14} style={{ marginLeft: 0 }} /><span className="lbl">{t('addCalendar')}</span></div>
          </div>
        ))}
        <div className="sidebar-sep" />
        <div className="side-sec">
          <div className="side-row" style={{ color: 'var(--c-text2)' }} onClick={() => importIcsFile()}><Download size={14} /><span className="lbl">{t('importIcs')}</span></div>
        </div>
      </div>
      <div className="sidebar-foot">
        <button className="ibtn sm" title={t('allShortcuts')} onClick={() => openOverlay('shortcuts')}><HelpCircle size={16} /></button>
      </div>
    </aside>
  );
}

export function newEventNow() {
  const s = getState(); const now = Date.now(); const step = 15 * 60000;
  const start = Math.ceil(now / step) * step; const inView = s.prefs.gridView === 'month' || true;
  void inView; void parseIsoDate; void tz;
  createEvent({ allDay: false, start, end: start + s.prefs.defaultEventDuration * 60000 }, { draft: true });
  setState({ anchor: s.today });
}
