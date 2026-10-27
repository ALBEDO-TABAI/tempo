import { useEffect } from 'react';
import { useStore, isDark, getState, setState, importIcsText, findOccurrence, select, goToDay, setPrefs, zoom } from './store';
import { handleKey, runCommand, selectAllVisible } from './commands';
import { bridge } from './platform';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TimeGrid } from './components/TimeGrid';
import { MonthGrid } from './components/MonthGrid';
import { Panel } from './components/Panel';
import { Menus } from './components/Menus';
import { CommandMenu } from './components/CommandMenu';
import { Settings } from './components/Settings';
import { Toasts, ScopeDialog, GotoDialog } from './components/Overlays';
import { startReminders, trayTick } from './notify';
import { undo, redo, copyOccurrences, paste, duplicateOccurrences, deleteOccurrences } from './store';

export function App() {
  const s = useStore((x) => ({ ready: x.ready, dark: isDark(x), view: x.prefs.gridView, sidebar: x.prefs.sidebar, panel: x.prefs.contextPanel, overlay: x.overlay, locale: x.prefs.locale }));
  useEffect(() => { document.documentElement.classList.toggle('dark', s.dark); bridge.send('theme', { dark: s.dark, source: getState().prefs.interfaceTheme }); }, [s.dark]);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (handleKey(e)) { e.preventDefault(); e.stopPropagation(); } };
    window.addEventListener('keydown', kd);
    // narrow windows auto-collapse the side panes (reference behaviour at 500 px)
    const rs = () => { if (innerWidth < 700 && getState().prefs.contextPanel) setState((x) => ({ prefs: { ...x.prefs, contextPanel: false } })); };
    window.addEventListener('resize', rs); rs();
    const offs = [
      bridge.on('menu', (id: string) => {
        switch (id) {
          case 'undo': undo(); break; case 'redo': redo(); break; case 'selectAll': selectAllVisible(); break;
          case 'copy': copyOccurrences(getState().selected); break; case 'cut': copyOccurrences(getState().selected, true); break; case 'paste': paste(); break;
          case 'duplicate': duplicateOccurrences(getState().selected); break; case 'delete': deleteOccurrences(getState().selected); break;
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
      <ScopeDialog />
      <Toasts />
    </div>
  );
}
