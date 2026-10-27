/**
 * Tempo desktop main process. One BrowserWindow (sized from the work area like the reference shell),
 * local SQLite store, native menus that forward ids to the renderer, a menu-bar tray showing the
 * next event, .ics file opening and the tempo:// protocol.
 */
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, protocol, net, shell, dialog, screen, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { openStore, type Store, type Kind } from './db';
import { labels, type Labels } from './labels';
import { TRAY_1X, TRAY_2X } from './tray-icon';

const NAME = 'Tempo', SCHEME = 'tempo';
const DEV_URL = process.env.TEMPO_DEV_URL;
const APP_DIST = [path.join(process.resourcesPath || '', 'renderer'), path.resolve(__dirname, '../../app/dist')].find((d) => fs.existsSync(path.join(d, 'index.html'))) || path.resolve(__dirname, '../../app/dist');
const BG = { dark: '#262626', light: '#FFFFFF' };
const MIN_W = 500, MIN_H = 376;

app.setName(NAME);
app.setPath('userData', process.env.TEMPO_USER_DATA ? path.resolve(process.env.TEMPO_USER_DATA) : path.join(app.getPath('appData'), NAME));
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let db: Store;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let L: Labels = labels(app.getLocale?.() || 'en');
let quitting = false;
let rendererReady = false;
const pending: { ch: string; payload: unknown }[] = [];
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

/** Reference sizing: whole work area, or (wide screens) centred 1440×900 cap with 12 % / 8 % margins. */
export function optimalBounds(wa: { x: number; y: number; width: number; height: number }) {
  if (wa.width <= 1280) return { ...wa };
  const w = Math.min(1440, wa.width - 2 * Math.round(0.12 * wa.width)), h = Math.min(900, wa.height - 2 * Math.round(0.08 * wa.height));
  return { x: wa.x + Math.round((wa.width - w) / 2), y: wa.y + Math.round((wa.height - h) / 2), width: w, height: h };
}
function savedBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const ok = screen.getAllDisplays().some((d) => b.x < d.workArea.x + d.workArea.width - 40 && b.x + b.width > d.workArea.x + 40 && b.y >= d.workArea.y - 10 && b.y < d.workArea.y + d.workArea.height - 40);
    return ok ? b : null;
  } catch { return null; }
}
function saveBounds() { if (win && !win.isDestroyed() && !win.isFullScreen() && !win.isMinimized()) fs.writeFileSync(stateFile(), JSON.stringify(win.getNormalBounds())); }

function emit(ch: string, payload?: unknown) {
  if (win && rendererReady) win.webContents.send('tempo:evt', ch, payload); else pending.push({ ch, payload });
}

function createWindow() {
  const b = savedBounds() || optimalBounds(screen.getPrimaryDisplay().workArea);
  const isMac = process.platform === 'darwin';
  rendererReady = false;
  win = new BrowserWindow({
    ...b, minWidth: MIN_W, minHeight: MIN_H, show: false, title: NAME,
    titleBarStyle: isMac ? 'customButtonsOnHover' : 'hidden', trafficLightPosition: { x: 12, y: 15 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? BG.dark : BG.light,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, backgroundThrottling: false, spellcheck: false },
  });
  const show = () => { if (win && !win.isVisible() && process.env.TEMPO_HIDDEN !== '1') win.show(); };
  const fallback = setTimeout(show, 5000);
  win.once('ready-to-show', () => { clearTimeout(fallback); show(); });
  win.on('close', (e) => {
    saveBounds();
    if (quitting || process.platform !== 'darwin') return;
    e.preventDefault();
    if (win!.isFullScreen()) { win!.once('leave-full-screen', () => win?.hide()); win!.setFullScreen(false); } else win!.hide();
  });
  win.on('resized', saveBounds); win.on('moved', saveBounds);
  win.on('closed', () => { win = null; });
  win.webContents.on('render-process-gone', () => { const old = win; win = null; old?.destroy(); createWindow(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto):/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(DEV_URL || `${SCHEME}://app/`)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  const q = process.env.TEMPO_QUERY ? `?${process.env.TEMPO_QUERY}` : '';
  win.loadURL(DEV_URL ? `${DEV_URL}/${q}` : `${SCHEME}://app/index.html${q}`);
}
function showWindow() { if (!win) createWindow(); else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } }

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const send = (id: string) => () => { showWindow(); emit('menu', id); };
  const item = (label: string, id: string, accelerator?: string): MenuItemConstructorOptions => ({ id, label, accelerator, click: send(id) });
  const tpl: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ label: NAME, submenu: [
      { label: L.about, role: 'about' }, { type: 'separator' },
      item(L.settings, 'settings', 'Cmd+,'), { type: 'separator' },
      { label: L.services, role: 'services' }, { type: 'separator' },
      { label: L.hide, role: 'hide' }, { label: L.hideOthers, role: 'hideOthers' }, { label: L.showAll, role: 'unhide' }, { type: 'separator' },
      { label: L.quit, accelerator: 'Cmd+Q', click: () => { quitting = true; app.quit(); } },
    ] } as MenuItemConstructorOptions] : []),
    { label: L.file, submenu: [
      item(L.newEvent, 'create', 'CmdOrCtrl+N'), { type: 'separator' },
      item(L.importIcs, 'import', 'CmdOrCtrl+O'), item(L.exportIcs, 'export', 'CmdOrCtrl+Shift+S'), { type: 'separator' },
      { label: L.closeWindow, role: 'close' },
      ...(isMac ? [] : [{ type: 'separator' } as MenuItemConstructorOptions, { label: L.quit, click: () => { quitting = true; app.quit(); } }]),
    ] },
    { label: L.edit, submenu: [
      // Undo/Redo/Cut/Copy/Paste go to the renderer, which uses the native editing command inside text fields
      // and the event-level command (undo stack, event clipboard) on the grid.
      item(L.undo, 'undo', 'CmdOrCtrl+Z'), item(L.redo, 'redo', 'Shift+CmdOrCtrl+Z'), { type: 'separator' },
      item(L.cut, 'cut', 'CmdOrCtrl+X'), item(L.copy, 'copy', 'CmdOrCtrl+C'), item(L.paste, 'paste', 'CmdOrCtrl+V'),
      { label: L.pasteMatch, role: 'pasteAndMatchStyle' },
      item(L.del, 'delete', 'Backspace'), item(L.selectAll, 'selectAll', 'CmdOrCtrl+A'), item(L.duplicate, 'duplicate', 'CmdOrCtrl+D'),
      ...(isMac ? [{ type: 'separator' } as MenuItemConstructorOptions, { label: L.speech, submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }] } as MenuItemConstructorOptions] : []),
    ] },
    { label: L.view, submenu: [
      item(L.dayView, 'day'), item(L.weekView, 'week'), item(L.monthView, 'month'), item(L.today, 'today'), item(L.commandMenu, 'cmdk'), { type: 'separator' },
      item(L.zoomReset, 'zoomReset', 'Shift+CmdOrCtrl+0'), item(L.zoomIn, 'zoomIn', 'Shift+CmdOrCtrl+.'), item(L.zoomOut, 'zoomOut', 'Shift+CmdOrCtrl+,'), { type: 'separator' },
      { label: L.scale, submenu: [{ label: L.actual, role: 'resetZoom' }, { label: L.scaleIn, role: 'zoomIn' }, { label: L.scaleOut, role: 'zoomOut' }] },
      { label: L.reload, role: 'reload' }, { label: L.forceReload, role: 'forceReload' }, { label: L.devtools, role: 'toggleDevTools' }, { type: 'separator' },
      { label: L.fullscreen, role: 'togglefullscreen' },
    ] },
    { label: L.window, submenu: [
      { label: L.minimize, role: 'minimize' }, { label: L.closeWindow, role: 'close' }, { label: L.zoom, role: 'zoom' }, { type: 'separator' },
      { id: 'showWindow', label: L.main, accelerator: 'CmdOrCtrl+1', click: showWindow },
      ...(isMac ? [{ type: 'separator' } as MenuItemConstructorOptions, { label: L.front, role: 'front' } as MenuItemConstructorOptions] : []),
    ] },
    { label: L.help, role: 'help', submenu: [
      item(L.shortcuts, 'shortcuts'),
      { label: L.debug, submenu: [{ label: L.reset, click: resetData }] },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

async function resetData() {
  const r = await dialog.showMessageBox(win ?? undefined as never, { type: 'warning', message: L.resetQ, detail: L.resetD, buttons: [L.reset.replace('…', ''), L.cancel], defaultId: 1, cancelId: 1 });
  if (r.response !== 0) return;
  db.clear(); rendererReady = false; win?.webContents.reload();
}

let trayKey: string | null = null;
let lastTray: unknown = null;
function updateTray(p: { title: string; tooltip: string; key: string | null }) {
  if (!tray) {
    const img = nativeImage.createFromDataURL(TRAY_1X);
    img.addRepresentation({ scaleFactor: 2, dataURL: TRAY_2X });
    img.setTemplateImage(true);
    tray = new Tray(img);
    tray.on('click', () => { if (process.platform !== 'darwin') showWindow(); });
  }
  trayKey = p.key; lastTray = p;
  if (process.platform === 'darwin') tray.setTitle(p.title ? ` ${p.title}` : '');
  tray.setToolTip(p.tooltip || NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: p.key ? p.tooltip : L.none, enabled: !!p.key, click: () => { showWindow(); emit('tray-open', trayKey); } },
    { type: 'separator' },
    { label: L.open, click: showWindow },
    { label: L.settings, click: () => { showWindow(); emit('menu', 'settings'); } },
    { type: 'separator' },
    { label: L.quit, click: () => { quitting = true; app.quit(); } },
  ]));
}

function openIcsPath(p: string) {
  try { const text = fs.readFileSync(p, 'utf8'); showWindow(); emit('open-file', { name: path.basename(p), text }); } catch (e) { console.error('[tempo] open-file', e); }
}

function registerIpc() {
  ipcMain.handle('tempo:load', () => db.load());
  ipcMain.handle('tempo:put', (_e, kind: Kind, obj: { id: string }) => db.put(kind, obj));
  ipcMain.handle('tempo:del', (_e, kind: Kind, id: string) => db.del(kind, id));
  ipcMain.handle('tempo:prefs', (_e, p) => db.putPrefs(p));
  ipcMain.handle('tempo:open-ics', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'iCalendar', extensions: ['ics', 'vcs'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    return { name: path.basename(r.filePaths[0]), text: fs.readFileSync(r.filePaths[0], 'utf8') };
  });
  ipcMain.handle('tempo:save-ics', async (_e, name: string, text: string) => {
    const r = await dialog.showSaveDialog(win!, { defaultPath: name, filters: [{ name: 'iCalendar', extensions: ['ics'] }] });
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, text); return true;
  });
  ipcMain.on('tempo:msg', (_e, ch: string, payload: any) => {
    switch (ch) {
      case 'ready': rendererReady = true; for (const m of pending.splice(0)) win?.webContents.send('tempo:evt', m.ch, m.payload); break;
      case 'theme': {
        const src = payload?.source as string | undefined;
        nativeTheme.themeSource = src === 'dark' || src === 'light' ? src : 'system';
        win?.setBackgroundColor(payload?.dark ? BG.dark : BG.light); break;
      }
      case 'locale': L = labels(String(payload || 'en')); buildMenu(); break;
      case 'tray': updateTray(payload); break;
    }
  });
  if (process.env.TEMPO_TEST === '1') {
    // test-only introspection, used by packages/parity/electron.mjs
    ipcMain.handle('tempo:test', (_e, op: string, arg?: string) => {
      if (op === 'menu') { const it = Menu.getApplicationMenu()?.getMenuItemById(arg!); if (!it) return false; it.click(); return true; }
      if (op === 'menuLabels') return Menu.getApplicationMenu()?.items.map((m) => [m.label, m.submenu?.items.map((x) => (x.type === 'separator' ? '—' : x.label))]);
      return { bounds: win?.getBounds(), min: win?.getMinimumSize(), tray: lastTray, themeSource: nativeTheme.themeSource, bg: win?.getBackgroundColor(), storage: db.kind, visible: win?.isVisible() };
    });
  }
  nativeTheme.on('updated', () => emit('native-theme', nativeTheme.shouldUseDarkColors));
}

// deep links + files can arrive before ready
const deepLinks: string[] = [];
const filesToOpen: string[] = [];
app.on('open-url', (e, url) => { e.preventDefault(); if (app.isReady()) { showWindow(); emit('deep-link', url); } else deepLinks.push(url); });
app.on('open-file', (e, p) => { e.preventDefault(); if (app.isReady()) openIcsPath(p); else filesToOpen.push(p); });

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_e, argv) => {
    showWindow();
    for (const a of argv.slice(1)) { if (a.startsWith(`${SCHEME}://`)) emit('deep-link', a); else if (/\.(ics|vcs)$/i.test(a)) openIcsPath(a); }
  });
  app.whenReady().then(() => {
    db = openStore(app.getPath('userData'));
    console.log(`[tempo] storage=${db.kind} file=${db.file}`);
    if (!app.isDefaultProtocolClient(SCHEME) && app.isPackaged) app.setAsDefaultProtocolClient(SCHEME);
    protocol.handle(SCHEME, (req) => {
      const u = new URL(req.url);
      if (u.host !== 'app') return new Response('not found', { status: 404 });
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.normalize(path.join(APP_DIST, rel));
      if (!file.startsWith(APP_DIST)) return new Response('forbidden', { status: 403 });
      return net.fetch(pathToFileURL(fs.existsSync(file) ? file : path.join(APP_DIST, 'index.html')).toString());
    });
    registerIpc(); buildMenu(); createWindow();
    for (const u of deepLinks.splice(0)) emit('deep-link', u);
    for (const p of [...filesToOpen.splice(0), ...process.argv.slice(1).filter((a) => /\.(ics|vcs)$/i.test(a))]) openIcsPath(p);
    for (const a of process.argv.slice(1)) if (a.startsWith(`${SCHEME}://`)) emit('deep-link', a);
  });
  app.on('activate', showWindow);
  app.on('before-quit', () => { quitting = true; saveBounds(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('will-quit', () => { try { db?.close(); } catch { /* ignore */ } });
}
