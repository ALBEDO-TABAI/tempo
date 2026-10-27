// Local reminders (HTML5 notifications) and the menu-bar summary sent to the native shell.
import { getState, occurrencesIn, tz } from './store';
import { bridge, isElectron } from './platform';
import { t } from './i18n';
import { timeOf } from './fmt';
const fired = new Set<string>();
export function startReminders() {
  const check = () => {
    const s = getState(); if (!s.ready || !s.prefs.notifications) return; const now = Date.now();
    for (const o of occurrencesIn(s.today - 1, s.today + 2)) {
      if (o.allDay) continue;
      for (const r of o.event.reminders ?? []) {
        const at = o.start - r.minutes * 60000; const id = `${o.key}:${r.minutes}`;
        if (at <= now && now - at < 60000 && !fired.has(id)) {
          fired.add(id);
          const body = (r.minutes > 0 ? t('startsIn', { n: r.minutes }) : t('startsNow')) + ' · ' + timeOf(o.start, tz(), s.prefs.format24HourTime) + (o.event.location ? ` · ${o.event.location}` : '');
          if (isElectron) { bridge.send('notify', { id, key: o.key, title: o.event.title || t('noTitle'), body, url: o.event.conferenceUrl || null, color: o.event.color || s.calendars.find((c) => c.id === o.event.calendarId)?.color || '#9A9CFE', silent: !s.prefs.notifySound, labels: { join: t('cardJoin'), open: t('cardOpen'), later: t('cardDismiss') } }); continue; }
          try { if ('Notification' in window && Notification.permission !== 'denied') new Notification(o.event.title || t('noTitle'), { body: timeOf(o.start, tz(), s.prefs.format24HourTime) + (o.event.location ? ` · ${o.event.location}` : ''), silent: !s.prefs.notifySound }); } catch { /* ignore */ }
        }
      }
    }
  };
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  const id = window.setInterval(check, 15000); check();
  return () => clearInterval(id);
}
export function trayTick() {
  const s = getState(); if (!s.ready) return; const now = Date.now();
  const next = occurrencesIn(s.today, s.today + 2).filter((o) => !o.allDay && o.end > now).sort((a, b) => a.start - b.start)[0];
  const title = next ? `${timeOf(next.start, tz(), s.prefs.format24HourTime)} · ${next.event.title || t('noTitle')}` : '';
  const max = s.prefs.menuBarMaxLen || 32;
  bridge.send('tray', { title: !s.prefs.menuBarNext ? '' : title.length > max ? title.slice(0, max - 1) + '…' : title, tooltip: next ? t('nextEvent', { t: title }) : t('noUpcoming'), key: next?.key ?? null, labels: { open: 'Tempo', quit: t('quit'), none: t('noUpcoming') } });
}
