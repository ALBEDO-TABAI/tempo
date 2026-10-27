// Electron shell harness: real Electron under Xvfb, driven over CDP (port 9344).
// Window rules, preload bridge, SQLite persistence across restarts, native menus -> renderer,
// tray next-event title, .ics open via argv / second instance, tempo:// deep link, theme sync.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { targets, connect, sleep } from './cdp-lite.mjs';
const DESK = new URL('../desktop/', import.meta.url).pathname;
const OUT = new URL('./out/', import.meta.url).pathname;
const UD = '/tmp/tempo-e2e';
const PORT = 9344;
const res = [];
const ok = (name, pass, info = '') => { res.push({ name, pass: !!pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${info}`); };
const env = { ...process.env, TEMPO_USER_DATA: UD, TEMPO_TEST: '1', TEMPO_QUERY: 'harness=1&locale=zh-TW&tz=Asia/Shanghai' };
let display;
function launch(extra = []) {
  const p = spawn('npx', ['electron', '.', '--no-sandbox', `--remote-debugging-port=${PORT}`, ...extra], { cwd: DESK, env: { ...env, DISPLAY: display }, detached: true });
  p.log = ''; p.stdout.on('data', (d) => (p.log += d)); p.stderr.on('data', (d) => (p.log += d));
  return p;
}
async function page(ms = 20000) {
  const t0 = Date.now();
  for (;;) {
    try { const t = (await targets(PORT)).find((x) => /index\.html/.test(x.url)); if (t) { const c = await connect(t.webSocketDebuggerUrl); for (let i = 0; i < 80; i++) { if (await c.evaluate('!!window.__tempoReady').catch(() => false)) return c; await sleep(250); } return c; } } catch {}
    if (Date.now() - t0 > ms) { console.log(proc?.log); throw new Error('timeout waiting for window'); }
    await sleep(300);
  }
}
async function stop(p) { try { process.kill(-p.pid, 'SIGTERM'); } catch {} for (let i = 0; i < 40 && fs.existsSync(`/proc/${p.pid}`); i++) await sleep(250); await sleep(400); }
const run = (cmd, args) => new Promise((r) => { const p = spawn(cmd, args, { cwd: DESK, env: { ...env, DISPLAY: display } }); p.on('exit', r); setTimeout(() => { try { p.kill(); } catch {} r(-1); }, 15000); });

// private X server
const xv = spawn('Xvfb', [':93', '-screen', '0', '1600x1000x24', '-nolisten', 'tcp'], { detached: true, stdio: 'ignore' }); display = ':93'; await sleep(800);
fs.rmSync(UD, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const ICS = '/tmp/tempo-e2e-import.ics';
fs.writeFileSync(ICS, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tempo test//EN', 'BEGIN:VEVENT', 'UID:e2e-1@tempo', 'DTSTAMP:20261001T000000Z', 'DTSTART;TZID=Asia/Shanghai:20261029T140000', 'DTEND;TZID=Asia/Shanghai:20261029T150000', 'SUMMARY:匯入測試', 'RRULE:FREQ=WEEKLY;COUNT=3', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n'));

// ---- run 1: fresh profile
let proc = launch();
let c = await page();
await sleep(800);
ok('storage backend is sqlite', /storage=sqlite/.test(proc.log), (proc.log.match(/storage=\S+/) || [''])[0]);
ok('bridge exposed', (await c.evaluate('window.tempo && window.tempo.platform')) === 'linux');
let info = await c.evaluate('window.tempo.test("info")');
// workArea 1600x1000 -> min(1440, 1600-2*192)=1216 x min(900, 1000-2*80)=840, centred
ok('window sized from work area (1216x840 centred)', info.bounds.width === 1216 && info.bounds.height === 840 && info.bounds.x === 192 && info.bounds.y === 80, JSON.stringify(info.bounds));
ok('minimum size 500x376', JSON.stringify(info.min) === '[500,376]');
ok('window visible after ready', info.visible);
const n0 = await c.evaluate('Object.keys(window.__tempo.getState().events).length');
ok('first-run seed loaded', n0 > 0, `events=${n0}`);
// create an event through the store, wait for persistence
await c.evaluate(`(async()=>{const s=window.__tempo; s.createEventAt ? 0 : 0; document.dispatchEvent(new KeyboardEvent('keydown',{key:'c',bubbles:true})); })()`);
await sleep(600);
const n1 = await c.evaluate('Object.keys(window.__tempo.getState().events).length');
ok('C creates an event', n1 === n0 + 1, `events=${n1}`);
await c.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
// menus -> renderer
const labels = await c.evaluate('window.tempo.test("menuLabels")');
ok('application menu built (zh-TW labels)', labels.length >= 5 && labels.some((m) => m[0] === '編輯' && m[1].includes('全選可見活動')), labels.map((m) => m[0]).join(' / '));
await c.evaluate('window.tempo.test("menu","month")'); await sleep(300);
ok('View ▸ Month menu switches view', (await c.evaluate('window.__tempo.getState().prefs.gridView')) === 'month');
await c.evaluate('window.tempo.test("menu","week")'); await sleep(300);
ok('View ▸ Week menu switches view', (await c.evaluate('[window.__tempo.getState().prefs.gridView, window.__tempo.getState().prefs.daysPerPeriod].join()')) === 'default,7');
const d0 = await c.evaluate('window.__tempo.getState().prefs.densityZoomLevel');
await c.evaluate('window.tempo.test("menu","zoomIn")'); await sleep(200);
ok('Zoom Hours In menu bumps density', (await c.evaluate('window.__tempo.getState().prefs.densityZoomLevel')) === d0 + 1);
await c.evaluate('window.tempo.test("menu","zoomReset")'); await sleep(200);
await c.evaluate('window.tempo.test("menu","settings")'); await sleep(300);
ok('Settings… menu opens settings', (await c.evaluate('window.__tempo.getState().overlay')) === 'settings');
await c.evaluate('window.__tempo.setState({overlay:null})');
// theme sync
await c.evaluate(`window.__tempo.setPrefs({interfaceTheme:'dark'})`); await sleep(400);
info = await c.evaluate('window.tempo.test("info")');
ok('dark theme -> nativeTheme + #262626 window bg', info.themeSource === 'dark' && /262626/i.test(info.bg), `${info.themeSource} ${info.bg}`);
await c.shot(`${OUT}E01_window_dark.png`);
await c.evaluate(`window.__tempo.setPrefs({interfaceTheme:'light'})`); await sleep(400);
info = await c.evaluate('window.tempo.test("info")');
ok('light theme -> #FFFFFF window bg', info.themeSource === 'light' && /FFFFFF/i.test(info.bg), info.bg);
await c.shot(`${OUT}E01_window_light.png`);
// tray
ok('tray built with next-event tooltip', info.tray && typeof info.tray.tooltip === 'string' && info.tray.tooltip.length > 0, JSON.stringify(info.tray && { title: info.tray.title, tooltip: info.tray.tooltip }));
// second instance: open .ics + deep link
const anyKey = await c.evaluate(`(()=>{const e=Object.values(window.__tempo.getState().events).find(e=>!e.rrule&&!e.recurringEventId);return e.id})()`);
await run('npx', ['electron', '.', '--no-sandbox', ICS]);
await sleep(1200);
const imported = await c.evaluate(`Object.values(window.__tempo.getState().events).filter(e=>e.title==='匯入測試').length`);
ok('.ics passed to a second instance is imported', imported === 1, `found=${imported}`);
const occKey = await c.evaluate(`(()=>{const e=Object.values(window.__tempo.getState().events).find(e=>e.id===${JSON.stringify(anyKey)}); return e.id+'|'+String(e.start)})()`);
await run('npx', ['electron', '.', '--no-sandbox', `tempo://event/${encodeURIComponent(occKey)}`]);
await sleep(1000);
const sel = await c.evaluate('window.__tempo.getState().selected');
ok('tempo://event deep link selects the event', sel.length === 1 && sel[0].startsWith(anyKey + '|'), JSON.stringify(sel));
await c.evaluate(`window.__tempo.setPrefs({gridView:'month'})`); await sleep(800);
await stop(proc);
// ---- run 2: same profile, state restored from SQLite
proc = launch(); c = await page(); await sleep(600);
const n2 = await c.evaluate('Object.keys(window.__tempo.getState().events).length');
ok('events persisted across restart (SQLite)', n2 === n1 + 1, `events=${n2}`);
ok('prefs persisted across restart', (await c.evaluate('window.__tempo.getState().prefs.gridView')) === 'month');
ok('db file on disk', fs.existsSync(`${UD}/tempo.db`));
await stop(proc);
// ---- run 3: JSON fallback
fs.rmSync(UD, { recursive: true, force: true });
proc = launch(); proc.log = ''; await stop(proc);
const pj = spawn('npx', ['electron', '.', '--no-sandbox', `--remote-debugging-port=${PORT}`], { cwd: DESK, env: { ...env, DISPLAY: display, TEMPO_FORCE_JSON: '1' }, detached: true });
pj.log = ''; pj.stdout.on('data', (d) => (pj.log += d)); pj.stderr.on('data', (d) => (pj.log += d));
c = await page(); await sleep(1200);
ok('JSON fallback store works', /storage=json/.test(pj.log) && (await c.evaluate('Object.keys(window.__tempo.getState().events).length')) > 0);
await stop(pj);
try { process.kill(-xv.pid); } catch {}
fs.writeFileSync(`${OUT}electron.json`, JSON.stringify(res, null, 1));
const pass = res.filter((r) => r.pass).length;
console.log(`\n${pass}/${res.length} electron checks passed`);
process.exit(pass === res.length ? 0 : 1);
