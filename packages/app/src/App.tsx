import { useEffect } from 'react';
import { useStore, isDark, getState, setState, importIcsText, findOccurrence, select, goToDay, setPrefs, zoom, openOverlay } from './store';
import { handleKey, runCommand, selectAllVisible, joinNext } from './commands';
import { bridge } from './platform';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TimeGrid } from './components/TimeGrid';
import { MonthGrid } from './components/MonthGrid';
import { Panel } from './components/Panel';
import { Menus } from './components/Menus';
import { CommandMenu } from './components/CommandMenu';
import { Settings } from './components/Settings';
import { Toasts, ScopeDialog, GotoDialog, RecurrenceDialog } from './components/Overlays';
import { startReminders, trayTick } from './notify';
import { undo, redo, copyOccurrences, paste, duplicateOccurrences, deleteOccurrences } from './store';

export function App() {
  const s = useStore((x) => ({ ready: x.ready, dark: isDark(x), themeSrc: x.prefs.interfaceTheme, view: x.prefs.gridView, sidebar: x.prefs.sidebar, panel: x.prefs.contextPanel, overlay: x.overlay, locale: x.prefs.locale }));
  useEffect(() => { document.documentElement.classList.toggle('dark', s.dark); bridge.send('theme', { dark: s.dark, source: s.themeSrc }); }, [s.dark, s.themeSrc]);
  useEffect(() => { bridge.send('locale', s.locale); }, [s.locale]);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (handleKey(e)) { e.preventDefault(); e.stopPropagation(); } };
    window.addEventListener('keydown', kd);
    // Give the calendar room in compact windows; panes can still be opened as overlays.
    const rs = () => { if (innerWidth < 1050) setState((x) => ({ prefs: { ...x.prefs, contextPanel: false, sidebar: innerWidth < 680 ? false : x.prefs.sidebar } })); };
    window.addEventListener('resize', rs); rs();
    const offs = [
      bridge.on('menu', (id: string) => {
        // inside a text field the Edit menu keeps its native meaning
        const ae = document.activeElement as HTMLElement | null;
        const inText = !!ae && (ae.isContentEditable || /^(INPUT|TEXTAREA)$/.test(ae.tagName));
        const native: Record<string, string> = { undo: 'undo', redo: 'redo', cut: 'cut', copy: 'copy', paste: 'paste', selectAll: 'selectAll', delete: 'delete' };
        if (inText && native[id]) { if (id === 'paste') navigator.clipboard.readText().then((t) => document.execCommand('insertText', false, t)).catch(() => {}); else document.execCommand(native[id]); return; }
        switch (id) {
          case 'cmdk': openOverlay('cmdk'); break;
          case 'undo': undo(); break; case 'redo': redo(); break; case 'selectAll': selectAllVisible(); break;
          case 'copy': copyOccurrences(getState().selected); break; case 'cut': copyOccurrences(getState().selected, true); break; case 'paste': paste(); break;
          case 'duplicate': duplicateOccurrences(getState().selected); break; case 'delete': deleteOccurrences(getState().selected); break;
          case 'joinNext': joinNext(); break;
          case 'zoomIn': zoom(1); break; case 'zoomOut': zoom(-1); break; case 'zoomReset': zoom(0); break;
          default: runCommand(id);
        }
      }),
      bridge.on('open-file', (f: { name: string; text: string }) => importIcsText(f.text, f.name)),
      bridge.on('deep-link', (url: string) => {
        const m = /tempo:\/\/(?:open\/)?(event|day)\/([^/?#]+)/.exec(url); if (!m) return;
        if (m[1] === 'event') { const o = findOccurrence(decodeURIComponent(m[2])); if (o) { goToDay(o.startDay); select([o.key]); } }
      }),
      bridge.on('tray-open', (key: string) => { const o = findOccurrence(key); if (o) { goToDay(o.startDay); select([o.key]); } }),
    ];
    bridge.send('ready');
    const stop = startReminders(); const tt = window.setInterval(trayTick, 30000); trayTick();
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('resize', rs); offs.forEach((f) => f()); stop(); clearInterval(tt); };
  }, []);
  if (!s.ready) return null;
  void setPrefs;
  return (
    <div className="app" data-view={s.view}>
      {s.sidebar && <Sidebar />}
      <main className="main">
        <TopBar />
        {s.view === 'month' ? <MonthGrid /> : <TimeGrid />}
      </main>
      {s.panel && <Panel />}
      <Menus />
      {s.overlay === 'cmdk' && <CommandMenu />}
      {s.overlay === 'settings' && <Settings />}
      {s.overlay === 'goto' && <GotoDialog />}
      {s.overlay === 'recurrence' && <RecurrenceDialog />}
      <ScopeDialog />
      <Toasts />
    </div>
  );
}
