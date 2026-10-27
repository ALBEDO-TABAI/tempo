// Settings modal: measured frame (954×650 at top 100, nav 253 with 28-px rows, content padding 24/32,
// 17-px section heads, 30-px rows, 24×14 toggles, 190×30 dropdowns). Pages and wording are Tempo's own.
import { useState } from 'react';
import { X, Settings2, Bell, PanelTop, CalendarDays, Plus, Download, Upload, Trash2, UserRound, Video } from 'lucide-react';
import { useStore, setState, setPrefs, updateCalendar, exportCalendar, importIcsFile, removeCalendar, addCalendar, getState } from '../store';
import { t, Locale } from '../i18n';
import { colorFamily, PALETTE } from '@tempo/core';
import { gmtLabel, timeOfFull } from '../fmt';
import { reminderLabel, REMINDER_OPTS, Kbd } from './Panel';
import { MOD } from '../commands';
import { bridge } from '../platform';

const ZONES = (() => { try { return (Intl as any).supportedValuesOf('timeZone') as string[]; } catch { return ['UTC', 'Asia/Tokyo', 'Asia/Shanghai', 'Europe/London', 'America/New_York', 'America/Los_Angeles']; } })();
const zoneLabel = (z: string) => `${gmtLabel(z)} ${z.split('/').pop()!.replace(/_/g, ' ')}`;
function Toggle({ on, onChange, label, testid }: { on: boolean; onChange: (v: boolean) => void; label: string; testid?: string }) {
  return <label className="set-tgl" data-testid={testid}><button role="switch" aria-checked={on} className={`toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)} /><span onClick={() => onChange(!on)}>{label}</span></label>;
}
function Drop<T extends string | number>({ value, opts, onChange, wide, testid }: { value: T; opts: [T, string][]; onChange: (v: T) => void; wide?: boolean; testid?: string }) {
  return <select data-testid={testid} className={`sdrop${wide ? ' wide' : ''}`} value={String(value)} onChange={(e) => { const o = opts.find(([v]) => String(v) === e.target.value); if (o) onChange(o[0]); }}>{opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}</select>;
}
const Radio = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => <label className="set-radio" onClick={onClick}><span className={`rd${on ? ' on' : ''}`} />{label}</label>;
const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="set-sec"><h2 className="set-h">{title}</h2>{children}</section>;

export function Settings() {
  const s = useStore((x) => ({ p: x.prefs, page: x.settingsPage, calendars: x.calendars, now: x.now }));
  const p = s.p; const page = ['general', 'profile', 'notifications', 'menubar', 'conferencing', 'calendars'].includes(s.page) ? s.page : 'general';
  const go = (id: string) => setState({ settingsPage: id });
  const NavRow = ({ id, icon, label }: { id: string; icon: React.ReactNode; label: string }) => <div className={`set-nav-row${page === id ? ' on' : ''}`} data-testid={`set-nav-${id}`} onClick={() => go(id)}><span className="ic">{icon}</span><span className="lbl">{label}</span></div>;
  return (
    <>
      <div className="scrim dim" onPointerDown={() => setState({ overlay: null })} />
      <div className="modal" data-testid="settings" role="dialog" onKeyDown={(e) => e.stopPropagation()}>
        <nav className="modal-nav">
          <div className="set-grp">{t('grpPrefs')}</div>
          <NavRow id="general" icon={<Settings2 size={18} />} label={t('general')} />
          <NavRow id="profile" icon={<UserRound size={18} />} label={t('profile')} />
          <NavRow id="notifications" icon={<Bell size={18} />} label={t('notifications')} />
          <NavRow id="menubar" icon={<PanelTop size={18} />} label={t('menuBar')} />
          <NavRow id="conferencing" icon={<Video size={18} />} label={t('conferencingPage')} />
          <div className="set-grp" style={{ marginTop: 12 }}>{t('grpCalendars')}</div>
          <NavRow id="calendars" icon={<CalendarDays size={18} />} label={t('onThisMac')} />
          <div className="set-nav-row" onClick={() => { go('calendars'); addCalendar(t('newCalendar'), PALETTE[(getState().calendars.length * 5) % PALETTE.length].hex); }}><span className="ic"><Plus size={18} /></span><span className="lbl">{t('addCalendarAcc')}</span></div>
        </nav>
        <div className="modal-body" key={page}>
          {page === 'general' && <>
            <Sec title={t('calendarView')}>
              <Toggle on={p.showWeekends} onChange={(v) => setPrefs({ showWeekends: v })} label={t('showWeekends')} testid="set-weekends" />
              <Toggle on={p.showDeclined} onChange={(v) => setPrefs({ showDeclined: v })} label={t('showDeclined')} />
              <Toggle on={p.showWeekNumbers} onChange={(v) => setPrefs({ showWeekNumbers: v })} label={t('showWeekNumbers')} />
              <div className="set-txt">{t('weekStartsOn')}：</div>
              <div className="set-line"><Drop value={p.weekStartsOn} opts={[[0, t('sun')], [1, t('mon')], [6, t('sat')]]} onChange={(v) => setPrefs({ weekStartsOn: v })} testid="set-weekstart" /></div>
              <div className="set-txt hint">{t('viewHint')}</div>
              <div className="set-txt hint"><a className="set-link" onClick={() => setState({ overlay: 'shortcuts' })}>{t('allViewsList')}</a></div>
            </Sec>
            <Sec title={t('calNav')}>
              <div className="set-txt">{t('press')} <Kbd keys={['T']} /> {t('toDo')}</div>
              <div className="set-line"><Drop value={p.todayKey} opts={[['today', t('goToday')], ['alignToday', t('alignToday')]]} onChange={(v) => setPrefs({ todayKey: v })} testid="set-tkey" /></div>
              <div className="set-txt hint">{t('alignHint', { k: '' })}<Kbd keys={['⌥', 'T']} /></div>
            </Sec>
            <Sec title={t('meetings')}>
              <div className="set-txt hint">{t('meetingsHint')}</div>
              <div className="set-txt">{t('showUpcoming')}</div>
              <div className="set-line"><Drop value={p.upcomingHours} opts={[1, 2, 4, 8, 12, 24].map((n) => [n, `${t('hoursN', { n })} ${t('before')}`])} onChange={(v) => setPrefs({ upcomingHours: v })} /></div>
            </Sec>
            <Sec title={t('language')}>
              <div className="set-line"><Drop<Locale> value={p.locale} opts={[['en', 'English'], ['zh-TW', '中文（繁體）'], ['zh-CN', '中文（简体）']]} onChange={(v) => setPrefs({ locale: v })} testid="set-locale" /></div>
              <div className="set-txt hint">{t('languageHint')}</div>
            </Sec>
            <Sec title={t('timeFormat')}>
              <div className="set-line"><Drop value={p.format24HourTime ? 1 : 0} opts={[[0, `${t('h12')}  ${timeOfFull(s.now, p.primaryTimeZone, false)}`], [1, `${t('h24')}  ${timeOfFull(s.now, p.primaryTimeZone, true)}`]]} onChange={(v) => setPrefs({ format24HourTime: v === 1 })} testid="set-timefmt" /></div>
            </Sec>
            <Sec title={t('timeZones')}>
              <div className="set-txt hint">{t('tzHint')}</div>
              <div className="set-txt hint">{t('tzTip', { k: '' })}<Kbd keys={['Z']} /></div>
              <div className="set-sub">{t('primaryTz')}</div>
              <div className="set-line"><Drop wide value={p.primaryTimeZone} opts={ZONES.map((z) => [z, zoneLabel(z)])} onChange={(v) => setPrefs({ primaryTimeZone: v })} testid="set-tz" /></div>
              <div className="set-sub">{t('otherTz')}</div>
              {p.additionalTimeZones.map((z, i) => <div key={z + i} className="set-line"><Drop wide value={z} opts={ZONES.map((x) => [x, zoneLabel(x)])} onChange={(v) => setPrefs({ additionalTimeZones: p.additionalTimeZones.map((y, j) => (j === i ? v : y)) })} />
                <button className="ibtn sm" onClick={() => setPrefs({ additionalTimeZones: p.additionalTimeZones.filter((_, j) => j !== i) })}><X size={14} /></button></div>)}
              {p.additionalTimeZones.length < 3 && <div className="set-line"><button className="btn sm" data-testid="set-addtz" onClick={() => setPrefs({ additionalTimeZones: [...p.additionalTimeZones, 'UTC'], showAdditionalTz: true })}><Plus size={12} />{t('addTz')}</button></div>}
              <label className="set-chk"><input type="checkbox" checked={p.askTzUpdate} onChange={(e) => setPrefs({ askTzUpdate: e.target.checked })} />{t('askTz')}</label>
            </Sec>
            <Sec title={t('locationTitle')}>
              <div className="set-txt">{t('openLocIn')}</div>
              <div className="set-line"><Drop value={p.mapsProvider} opts={[['google', 'Google Maps'], ['apple', 'Apple Maps'], ['osm', 'OpenStreetMap']]} onChange={(v) => setPrefs({ mapsProvider: v })} /></div>
            </Sec>
            <Sec title={t('theme')}>
              <Radio on={p.interfaceTheme === 'system'} label={t('themeAuto')} onClick={() => setPrefs({ interfaceTheme: 'system' })} />
              <Radio on={p.interfaceTheme === 'light'} label={t('themeLight')} onClick={() => setPrefs({ interfaceTheme: 'light' })} />
              <Radio on={p.interfaceTheme === 'dark'} label={t('themeDark')} onClick={() => setPrefs({ interfaceTheme: 'dark' })} />
            </Sec>
            <Sec title={t('defaultDuration')}>
              <div className="set-line"><Drop value={p.defaultEventDuration} opts={[15, 30, 45, 60, 90, 120].map((n) => [n, t('minutes', { n })])} onChange={(v) => setPrefs({ defaultEventDuration: v })} /></div>
            </Sec>
            <Sec title={t('startup')}>
              <label className="set-chk"><input type="checkbox" checked={p.openAtLogin} onChange={(e) => { setPrefs({ openAtLogin: e.target.checked }); bridge.send('login-item', e.target.checked); }} />{t('openAtLogin')}</label>
            </Sec>
          </>}
          {page === 'profile' && <>
            <Sec title={t('profile')}>
              <div className="set-sub">{t('displayName')}</div>
              <div className="set-line"><input className="set-in plain" data-testid="set-name" defaultValue={p.displayName} placeholder={t('displayName')} onBlur={(e) => setPrefs({ displayName: e.target.value.trim() })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></div>
              <div className="set-sub">{t('emailL')}</div>
              <div className="set-line"><input className="set-in plain" type="email" defaultValue={p.email} placeholder="you@example.com" onBlur={(e) => setPrefs({ email: e.target.value.trim() })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></div>
              <div className="set-txt hint">{t('profileHint')}</div>
            </Sec>
          </>}
          {page === 'conferencing' && <>
            <Sec title={t('conferencingPage')}>
              <div className="set-txt hint">{t('confHint')}</div>
              <div className="set-sub">{t('defaultVideo')}</div>
              <div className="set-line"><Drop value={p.videoProvider} opts={[['none', t('none')], ['meet', 'Google Meet'], ['zoom', 'Zoom'], ['teams', 'Microsoft Teams'], ['custom', t('customLink')]]} onChange={(v) => setPrefs({ videoProvider: v })} testid="set-video" /></div>
              {p.videoProvider !== 'none' && <><div className="set-sub">{t('personalLink')}</div>
              <div className="set-line"><input className="set-in plain" data-testid="set-video-url" defaultValue={p.videoUrl} placeholder={p.videoProvider === 'zoom' ? 'https://zoom.us/j/…' : p.videoProvider === 'meet' ? 'https://meet.google.com/…' : 'https://…'} onBlur={(e) => setPrefs({ videoUrl: e.target.value.trim() })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></div></>}
              <Toggle on={p.autoAddVideo} onChange={(v) => setPrefs({ autoAddVideo: v })} label={t('autoAddVideo')} />
            </Sec>
          </>}
          {page === 'notifications' && <>
            <Sec title={t('notifications')}>
              <Toggle on={p.notifications} onChange={(v) => setPrefs({ notifications: v })} label={t('notifyOn')} testid="set-notify" />
              <div className="set-txt hint">{t('notifyHint')}</div>
              <Toggle on={p.notifySound} onChange={(v) => setPrefs({ notifySound: v })} label={t('sound')} />
              <div className="set-sub">{t('defReminder')}</div>
              <div className="set-line"><Drop value={p.defaultReminder} opts={[[-1, t('none')], ...REMINDER_OPTS.map((m): [number, string] => [m, reminderLabel(m)])]} onChange={(v) => setPrefs({ defaultReminder: v })} testid="set-defrem" /></div>
              <div className="set-sub">{t('defAllDayReminder')}</div>
              <div className="set-line"><Drop value={p.defaultAllDayReminder} opts={[[-1, t('none')], [0, reminderLabel(0)], [1440, reminderLabel(1440)], [2880, reminderLabel(2880)]]} onChange={(v) => setPrefs({ defaultAllDayReminder: v })} /></div>
            </Sec>
          </>}
          {page === 'menubar' && <>
            <Sec title={t('menuBar')}>
              <Toggle on={p.menuBarNext} onChange={(v) => setPrefs({ menuBarNext: v })} label={t('menuNext')} testid="set-menubar" />
              <div className="set-sub">{t('menuLen')}</div>
              <div className="set-line"><Drop value={p.menuBarMaxLen} opts={[16, 24, 32, 48].map((n) => [n, String(n)])} onChange={(v) => setPrefs({ menuBarMaxLen: v })} /></div>
            </Sec>
          </>}
          {page === 'calendars' && <Calendars />}
        </div>
        <button className="modal-x" aria-label="close" onClick={() => setState({ overlay: null })}><X size={16} /></button>
      </div>
    </>
  );
}

function Calendars() {
  const cals = useStore((x) => x.calendars); const dark = useStore((x) => x.systemDark); const [edit, setEdit] = useState<string | null>(null);
  return <>
    <Sec title={t('onThisMac')}>
      <div className="set-txt hint">{t('calsHint')}</div>
      {cals.map((c) => <div key={c.id} className="set-cal" data-testid="set-cal">
        <span className="swatch" style={{ ['--sw' as any]: colorFamily(c.color, dark).backgroundPrimary }} />
        {edit === c.id ? <input autoFocus className="set-in" defaultValue={c.name} onBlur={(e) => { if (e.target.value.trim()) updateCalendar(c.id, { name: e.target.value.trim() }); setEdit(null); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(null); }} />
          : <span className="lbl" onDoubleClick={() => setEdit(c.id)}>{c.name}{c.primary ? <span className="dim"> · {t('defaultTag')}</span> : null}</span>}
        <select className="sdrop sm" title={t('colorL')} value={c.color} onChange={(e) => updateCalendar(c.id, { color: e.target.value })}>{PALETTE.map((x) => <option key={x.id} value={x.hex}>{x.name}</option>)}{!PALETTE.some((x) => x.hex === c.color) && <option value={c.color}>{c.color}</option>}</select>
        <button className="ibtn sm" title={t('rename')} onClick={() => setEdit(c.id)}>✎</button>
        <button className="ibtn sm" title={t('exportIcs')} onClick={() => exportCalendar(c.id)}><Upload size={14} /></button>
        {!c.primary && <button className="ibtn sm" title={t('deleteCalendar')} onClick={() => { if (confirm(`${t('deleteCalendar')}: ${c.name}?`)) removeCalendar(c.id); }}><Trash2 size={14} /></button>}
      </div>)}
      <div className="set-line" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn sm" onClick={() => addCalendar(t('newCalendar'), PALETTE[(cals.length * 5) % PALETTE.length].hex)}><Plus size={12} />{t('addCalendarAcc')}</button>
        <button className="btn sm" onClick={() => importIcsFile()}><Download size={12} />{t('importIcs')}</button>
        <button className="btn sm" onClick={() => exportCalendar()}><Upload size={12} />{t('exportIcs')}</button>
      </div>
    </Sec>
  </>;
}
void MOD;
