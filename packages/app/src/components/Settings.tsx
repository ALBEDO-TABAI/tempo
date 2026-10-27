import { X, Settings2, Bell, Palette, Globe, CalendarDays } from 'lucide-react';
import { useStore, setState, setPrefs, updateCalendar, exportCalendar, importIcsFile, removeCalendar } from '../store';
import { t, Locale } from '../i18n';
import { colorFamily, PALETTE } from '@tempo/core';
import { gmtLabel } from '../fmt';

const ZONES = (() => { try { return (Intl as any).supportedValuesOf('timeZone') as string[]; } catch { return ['UTC', 'Asia/Tokyo', 'Asia/Shanghai', 'Europe/London', 'America/New_York', 'America/Los_Angeles']; } })();
function Toggle({ on, onChange, testid }: { on: boolean; onChange: (v: boolean) => void; testid?: string }) { return <button data-testid={testid} className={`toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)} />; }
function Sel<T extends string | number>({ value, opts, onChange }: { value: T; opts: [T, string][]; onChange: (v: T) => void }) {
  return <select className="select" value={String(value)} onChange={(e) => { const o = opts.find(([v]) => String(v) === e.target.value); if (o) onChange(o[0]); }}>{opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}</select>;
}
export function Settings() {
  const s = useStore((x) => ({ p: x.prefs, page: x.settingsPage, calendars: x.calendars, dark: x.systemDark }));
  const p = s.p; const nav: [string, string, React.ReactNode][] = [['general', t('general'), <Settings2 size={16} />], ['appearance', t('appearance'), <Palette size={16} />], ['timezones', t('timeZones'), <Globe size={16} />], ['notifications', t('notifications'), <Bell size={16} />], ['calendars', t('calendars'), <CalendarDays size={16} />]];
  return (
    <>
      <div className="scrim dim" onPointerDown={() => setState({ overlay: null })} />
      <div className="modal" data-testid="settings" role="dialog">
        <div className="modal-nav">
          <div className="side-head">{t('settings')}</div>
          {nav.map(([id, l, ic]) => <div key={id} className={`side-row${s.page === id ? ' on' : ''}`} onClick={() => setState({ settingsPage: id })}>{ic}<span className="lbl">{l}</span></div>)}
        </div>
        <div className="modal-body">
          {s.page === 'general' && <>
            <div className="set-sec"><div className="set-h">{t('calendarView')}</div>
              <div className="set-row"><Toggle on={p.showWeekends} onChange={(v) => setPrefs({ showWeekends: v })} /><span className="lbl">{t('showWeekends')}</span></div>
              <div className="set-row"><Toggle on={p.showDeclined} onChange={(v) => setPrefs({ showDeclined: v })} /><span className="lbl">{t('showDeclined')}</span></div>
              <div className="set-row"><Toggle on={p.showWeekNumbers} onChange={(v) => setPrefs({ showWeekNumbers: v })} /><span className="lbl">{t('showWeekNumbers')}</span></div>
              <div className="set-note">{t('weekStartsOn')}</div>
              <div className="set-row"><Sel value={p.weekStartsOn} opts={[[0, t('sun')], [1, t('mon')], [6, t('sat')]]} onChange={(v) => setPrefs({ weekStartsOn: v })} /></div>
              <div className="set-note">{t('timeFormat')}</div>
              <div className="set-row"><Sel value={p.format24HourTime ? 1 : 0} opts={[[0, t('h12')], [1, t('h24')]]} onChange={(v) => setPrefs({ format24HourTime: v === 1 })} /></div>
              <div className="set-note">{t('defaultDuration')}</div>
              <div className="set-row"><Sel value={p.defaultEventDuration} opts={[15, 30, 45, 60, 90, 120].map((n) => [n, t('minutes', { n })])} onChange={(v) => setPrefs({ defaultEventDuration: v })} /></div>
            </div>
            <div className="set-sec"><div className="set-h">{t('language')}</div>
              <div className="set-row"><Sel<Locale> value={p.locale} opts={[['en', 'English'], ['zh-TW', '繁體中文'], ['zh-CN', '简体中文']]} onChange={(v) => setPrefs({ locale: v })} /></div></div>
          </>}
          {s.page === 'appearance' && <div className="set-sec"><div className="set-h">{t('theme')}</div>
            <div className="set-row"><Sel value={p.interfaceTheme} opts={[['system', t('themeSystem')], ['light', t('themeLight')], ['dark', t('themeDark')]]} onChange={(v) => setPrefs({ interfaceTheme: v as any })} /></div></div>}
          {s.page === 'timezones' && <div className="set-sec"><div className="set-h">{t('timeZones')}</div>
            <div className="set-note">{t('primaryTz')}</div>
            <div className="set-row"><Sel value={p.primaryTimeZone} opts={ZONES.map((z) => [z, `${z.replace(/_/g, ' ')} (${gmtLabel(z)})`])} onChange={(v) => setPrefs({ primaryTimeZone: v })} /></div>
            {p.additionalTimeZones.map((z, i) => <div key={z} className="set-row"><Sel value={z} opts={ZONES.map((x) => [x, `${x.replace(/_/g, ' ')} (${gmtLabel(x)})`])} onChange={(v) => setPrefs({ additionalTimeZones: p.additionalTimeZones.map((y, j) => (j === i ? v : y)) })} />
              <button className="ibtn sm" onClick={() => setPrefs({ additionalTimeZones: p.additionalTimeZones.filter((_, j) => j !== i) })}><X size={14} /></button></div>)}
            {p.additionalTimeZones.length < 3 && <div className="set-row"><button className="btn" onClick={() => setPrefs({ additionalTimeZones: [...p.additionalTimeZones, 'UTC'] })}>{t('addTz')}</button></div>}
          </div>}
          {s.page === 'notifications' && <div className="set-sec"><div className="set-h">{t('notifications')}</div><div className="set-note">{t('reminders')}: {t('minutesBefore', { n: 10 })}</div></div>}
          {s.page === 'calendars' && <div className="set-sec"><div className="set-h">{t('calendars')}</div>
            {s.calendars.map((c) => <div key={c.id} className="set-row">
              <span className="swatch" style={{ ['--sw' as any]: colorFamily(c.color, false).backgroundPrimary }} /><span className="lbl">{c.name}{c.primary ? ` · ${t('defaultTag')}` : ''}</span>
              <select className="select" style={{ minWidth: 110 }} value={c.color} onChange={(e) => updateCalendar(c.id, { color: e.target.value })}>{PALETTE.map((x) => <option key={x.id} value={x.hex}>{x.name}</option>)}{!PALETTE.some((x) => x.hex === c.color) && <option value={c.color}>{c.color}</option>}</select>
              <button className="btn" onClick={() => exportCalendar(c.id)}>{t('exportIcs')}</button>
              {!c.primary && <button className="ibtn sm" onClick={() => { if (confirm(`${t('deleteCalendar')}: ${c.name}?`)) removeCalendar(c.id); }}><X size={14} /></button>}
            </div>)}
            <div className="set-row"><button className="btn" onClick={() => importIcsFile()}>{t('importIcs')}</button></div>
          </div>}
        </div>
        <button className="ibtn sm modal-x" onClick={() => setState({ overlay: null })}><X size={16} /></button>
      </div>
    </>
  );
}
