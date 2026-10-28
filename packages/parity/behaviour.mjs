// Behaviour tests in Chromium against the Vite dev server (real pointer + keyboard input).
// node behaviour.mjs  → out/behaviour.json
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.TEMPO_URL || 'http://127.0.0.1:5300/index.html';
const Q = '?harness=1&fixture=empty&tz=Asia/Shanghai&now=2026-10-28T09:00:00%2B08:00&freeze=1&locale=zh-TW&theme=light';
const res = []; const ok = (name, pass, info = '') => { res.push({ name, pass: !!pass, info: String(info) }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${pass ? '' : info}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const st = (expr) => page.evaluate(`(()=>{const s=window.__tempo.getState(); return (${expr});})()`);
const evs = () => page.evaluate(() => Object.values(window.__tempo.getState().events));
const sleep = (ms) => page.waitForTimeout(ms);
async function load(q = Q, storage = 'memory') { await page.goto(`${BASE}${q}${storage ? `&storage=${storage}` : ''}`); await page.waitForFunction(() => window.__tempoReady); await sleep(250); }
async function geo() {
  return page.evaluate(() => { const g = document.querySelector('[data-testid=timegrid]'); const sc = g.querySelector('.scroller'); const r = sc.getBoundingClientRect();
    return { x: r.left, y: r.top, st: sc.scrollTop, gutter: +g.dataset.gutter, colW: +g.dataset.colw, hourH: +g.dataset.hourh }; });
}
async function pt(dayIdx, min) { const g = await geo(); return { x: g.x + g.gutter + dayIdx * g.colW + g.colW / 2, y: g.y + (min / 60) * g.hourH - g.st }; }
async function drag(a, b, steps = 8) { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps }); await page.mouse.up(); await sleep(150); }
const key = (k) => page.keyboard.press(process.platform === 'darwin' ? k.replace('Control+', 'Meta+') : k);
const SOD = Date.parse('2026-10-25T00:00:00+08:00'); // Sunday of the visible week
const at = (dayIdx, h, m = 0) => SOD + dayIdx * 86400000 + (h * 60 + m) * 60000;

await load();
// scroll so 9:00–15:00 is in view
await page.evaluate(() => { const sc = document.querySelector('[data-testid=timegrid] .scroller'); sc.scrollTop = 8 * (+document.querySelector('[data-testid=timegrid]').dataset.hourh); });
await sleep(100);

// 1. drag-create Mon 10:00–11:00
await drag(await pt(1, 600 + 2), await pt(1, 660 - 2));
let list = await evs();
ok('drag on the grid creates a 10:00–11:00 draft', list.length === 1 && list[0].start === at(1, 10) && list[0].end === at(1, 11), JSON.stringify(list.map((e) => [new Date(e.start).toISOString(), new Date(e.end).toISOString()])));
ok('new draft opens the event panel with title focused', await page.evaluate(() => document.activeElement?.dataset?.testid === 'ev-title'));
await page.keyboard.type('行為測試'); await key('Enter'); await sleep(100);
list = await evs(); const id = list[0]?.id;
ok('typing + Enter saves the title', list[0]?.title === '行為測試');
// 2. move by +1 day, +30 min
const chip = async () => page.locator(`.chip[data-key="${id}"]`).first().boundingBox();
let b = await chip();
await drag({ x: b.x + b.width / 2, y: b.y + 12 }, { x: b.x + b.width / 2 + (await geo()).colW, y: b.y + 12 + (await geo()).hourH / 2 });
list = await evs();
ok('dragging a chip moves it (+1 day, +30 min, 15-min snap)', list[0].start === at(2, 10, 30) && list[0].end === at(2, 11, 30), new Date(list[0].start).toISOString());
// 3. resize bottom edge +30 min
b = await chip();
await drag({ x: b.x + b.width / 2, y: b.y + b.height - 2 }, { x: b.x + b.width / 2, y: b.y + b.height - 2 + (await geo()).hourH / 2 });
list = await evs();
ok('dragging the bottom edge resizes (end +30 min)', list[0].start === at(2, 10, 30) && list[0].end === at(2, 12), new Date(list[0].end).toISOString());
// 4. delete + undo + redo
b = await chip(); await page.mouse.click(b.x + 10, b.y + 8); await sleep(100);
await key('Backspace'); await sleep(150);
ok('Backspace deletes the selected event', (await evs()).length === 0);
ok('delete shows an undo toast', (await page.locator('[data-testid=toasts] .toast').count()) > 0);
await key('Control+z'); await sleep(150);
ok('⌘Z (Ctrl+Z) restores it', (await evs()).length === 1);
await key('Control+Shift+z'); await sleep(150);
ok('⇧⌘Z redoes the delete', (await evs()).length === 0);
await key('Control+z'); await sleep(150);
// 5. duplicate + copy/paste
b = await chip(); await page.mouse.click(b.x + 10, b.y + 8); await sleep(80);
await key('Control+d'); await sleep(150);
ok('⌘D duplicates', (await evs()).length === 2);
await key('Control+z'); await sleep(150);
// 6. repeat via panel → daily; then move one occurrence → scope dialog
b = await chip(); await page.mouse.click(b.x + 10, b.y + 8); await sleep(150);
await page.click('[data-testid=ev-opts]'); await page.click('[data-testid=ev-repeat]'); await sleep(100);
await page.locator('.mi', { hasText: '每天' }).first().click(); await sleep(150);
let ev = (await evs()).find((e) => e.id === id);
ok('Repeat ▸ Every day sets RRULE', ev.rrule === 'FREQ=DAILY', ev.rrule);
ok('series renders on following days', (await page.locator(`.chip[data-key^="${id}|"]`).count()) >= 4);
const occ = page.locator(`.chip[data-key="${id}|${at(4, 10, 30)}"]`).first(); b = await occ.boundingBox();
await drag({ x: b.x + b.width / 2, y: b.y + 12 }, { x: b.x + b.width / 2, y: b.y + 12 + (await geo()).hourH });
ok('moving one occurrence asks for scope', await page.locator('[data-testid=scope]').isVisible());
await page.locator('[data-testid=scope] .btn').first().click(); await sleep(150);
list = await evs();
const ov = list.find((e) => e.recurringEventId === id);
ok('“This event” creates an override 1 h later', ov && ov.start === at(4, 11, 30) && String(ov.originalStart) === String(at(4, 10, 30)), JSON.stringify(ov && { s: new Date(ov.start).toISOString(), o: ov.originalStart }));
// 7. custom recurrence dialog
await page.evaluate((id) => window.__tempo.setState({ selected: [id], editing: id, overlay: 'recurrence', recKey: id }), id); await sleep(150);
await page.selectOption('[data-testid=rec-freq]', 'WEEKLY');
await page.fill('[data-testid=rec-interval]', '2');
await page.click('[data-testid=rec-day-1]'); // add Monday (Tuesday preselected)
await page.click('[data-testid=rec-end-count]'); await page.fill('[data-testid=rec-count]', '5');
const summary = await page.textContent('[data-testid=rec-summary]');
await page.click('[data-testid=rec-done]'); await sleep(150);
ev = (await evs()).find((e) => e.id === id);
ok('custom recurrence builds FREQ=WEEKLY;INTERVAL=2;COUNT=5;BYDAY=MO,TU', ev.rrule === 'FREQ=WEEKLY;INTERVAL=2;COUNT=5;BYDAY=MO,TU', ev.rrule);
ok('custom recurrence summary is localised', /每 2 週/.test(summary) && /共 5 次/.test(summary), summary);
// 8. delete series (all events)
await page.evaluate(() => window.__tempo.setState({ overlay: null }));
await page.evaluate((id) => window.__tempo.setState({ selected: [`${id}|${Date.parse('2026-10-27T10:30:00+08:00')}`], editing: null }), id);
await key('Backspace'); await sleep(100);
ok('deleting a recurring occurrence asks for scope', await page.locator('[data-testid=scope]').isVisible());
await page.locator('[data-testid=scope] .btn').nth(2).click(); await sleep(150);
ok('“All events” removes the series and its overrides', (await evs()).length === 0);

// 9. ⌘K command menu
await key('Control+k'); await sleep(100);
ok('⌘K opens the command menu', await page.locator('[data-testid=cmdk]').isVisible());
await page.keyboard.type('月'); await sleep(100); await key('Enter'); await sleep(150);
ok('⌘K → “月” → Enter switches to month view', (await st('s.prefs.gridView')) === 'month' && !(await st('s.overlay')));
// 10. single-key shortcuts
const views = [];
for (const [k, want] of [['w', 'default/7'], ['d', 'default/1'], ['4', 'default/4'], ['0', 'default/7'], ['m', 'month'], ['1', 'default/1'], ['w', 'default/7']]) {
  await key(k); await sleep(60); const v = await st("s.prefs.gridView === 'month' ? 'month' : s.prefs.gridView + '/' + s.prefs.daysPerPeriod"); views.push(v === want);
}
ok('view keys d / w / m / 0 / 1 / 2–9', views.every(Boolean), JSON.stringify(views));
const first = () => page.evaluate(() => +document.querySelector('[data-testid=timegrid] .colhead')?.textContent.replace(/\D+/g, ''));
const f0 = await first(); await key('j'); await sleep(80); const f1 = await first(); await key('k'); await key('k'); await sleep(80); const f2 = await first(); await key('t'); await sleep(80); const f3 = await first();
ok('j / k step by a week, t returns to today', f0 === 25 && f1 === 1 && f2 === 18 && f3 === 25, [f0, f1, f2, f3].join());
await key('Backslash'); await sleep(80); const sb = await st('s.prefs.sidebar'); await key('Backslash'); await sleep(80);
ok('\\ toggles the sidebar', sb === false && (await st('s.prefs.sidebar')) === true);
await key('Control+Backslash'); await sleep(80); const pn = await st('s.prefs.contextPanel'); await key('Control+Backslash'); await sleep(80);
ok('⌘\\ toggles the context panel', pn === false && (await st('s.prefs.contextPanel')) === true);
await key('Shift+Slash'); await sleep(80); ok('? opens all shortcuts', (await st('s.overlay')) === 'shortcuts'); await key('Escape'); await sleep(50);
await key('Period'); await sleep(80); ok('. opens go-to-date', await page.locator('[data-testid=goto]').isVisible());
await page.keyboard.type('2026-12-25'); await key('Enter'); await sleep(100);
ok('go-to-date accepts an ISO date', (await st('s.anchor')) === (await page.evaluate(() => Math.round(Date.UTC(2026, 11, 25) / 86400000))), await st('s.anchor'));
await key('t');
await key('g'); await key('s'); await sleep(100); ok('g s opens settings', (await st('s.overlay')) === 'settings'); await key('Escape'); await sleep(50);
const d0 = await st('s.prefs.densityZoomLevel'); await key('Control+Shift+Period'); await sleep(50); const d1 = await st('s.prefs.densityZoomLevel'); await key('Control+Shift+Comma'); await key('Control+Shift+Comma'); await sleep(50); const d2 = await st('s.prefs.densityZoomLevel'); await key('Control+Shift+Digit0'); await sleep(50);
ok('⇧⌘. / ⇧⌘, / ⇧⌘0 zoom hours', d1 === d0 + 1 && d2 === d0 - 1 && (await st('s.prefs.densityZoomLevel')) === 0, [d0, d1, d2].join());
const hh0 = (await geo()).hourH; await key('Control+Shift+Period'); await key('Control+Shift+Period'); await sleep(100); const hh1 = (await geo()).hourH; await key('Control+Shift+Digit0');
ok('zoom changes the hour height by 8 px per level', Math.abs(hh1 - Math.max(hh0, 48) - 16) < 0.01 || hh1 === 64, `${hh0} → ${hh1}`);
await key('Control+Shift+e'); await sleep(60); const we = await st('s.prefs.showWeekends'); await key('Control+Shift+e'); await sleep(60);
ok('⇧⌘E hides weekends (5 columns)', we === false);
await key('Control+Shift+l'); await sleep(80); const dark = await page.evaluate(() => document.documentElement.classList.contains('dark')); await key('Control+Shift+l'); await sleep(80);
ok('⇧⌘L toggles dark theme', dark && !(await page.evaluate(() => document.documentElement.classList.contains('dark'))));
// c creates at the next slot; e l focuses location; ⌘⏎ blurs
await key('c'); await sleep(150);
ok('c creates an event now-ish with the panel open', (await evs()).length === 1 && (await page.locator('[data-testid=eventpanel]').isVisible()));
await key('Escape'); await sleep(50);
await page.keyboard.type(''); await key('e'); await key('l'); await sleep(150);
ok('e l focuses the location field', await page.evaluate(() => document.activeElement?.dataset?.field === 'l'));
await page.keyboard.type('會議室 A'); await key('Control+Enter'); await sleep(100);
ok('⌘⏎ commits the field', (await evs())[0].location === '會議室 A', (await evs())[0].location);
await page.evaluate(() => window.__tempo.setState({ selected: [], editing: null }));
// 11. availability
await key('s'); await sleep(100);
ok('s enters share-availability mode', await page.locator('[data-testid=availpanel]').isVisible());
await page.evaluate(() => { const sc = document.querySelector('[data-testid=timegrid] .scroller'); sc.scrollTop = 8 * (+document.querySelector('[data-testid=timegrid]').dataset.hourh); });
await drag(await pt(4, 14 * 60 + 2), await pt(4, 15 * 60 - 2));
ok('dragging adds an availability slot (not an event)', (await st('s.avail.slots.length')) === 1 && (await evs()).length === 1);
await page.click('[data-testid=av-copy]'); await sleep(150);
const txt = await st('s.lastCopied');
ok('copy-as-text lists the slot with time zone', /十月 29 日/.test(txt) && /PM 2/.test(txt) && /GMT\+8/.test(txt), JSON.stringify(txt));
await page.click('[data-testid=av-fill]'); await sleep(100);
ok('fill free time suggests slots around busy events', (await st('s.avail.slots.length')) >= 3, await st('s.avail.slots.length'));
const nSlots = await st('s.avail.slots.length');
await page.click('[data-testid=av-holds]'); await sleep(150);
list = await evs();
ok('create holds → tentative free events', list.filter((e) => e.status === 'tentative' && e.transparency === 'transparent').length === nSlots && !(await st('s.avail.active')));
// 12. ICS import (file chooser) + export (download)
await load();
const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:b1@test', 'DTSTART;TZID=America/New_York:20261028T090000', 'DTEND;TZID=America/New_York:20261028T100000', 'SUMMARY:紐約會議', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:b2@test', 'DTSTART;VALUE=DATE:20261030', 'DTEND;VALUE=DATE:20261101', 'SUMMARY:兩天活動', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
fs.writeFileSync('/tmp/tempo-b.ics', ics);
const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.side-row', { hasText: '匯入' }).first().click()]);
await fc.setFiles('/tmp/tempo-b.ics'); await sleep(300);
list = await evs();
const ny = list.find((e) => e.title === '紐約會議');
ok('ICS import via the sidebar file picker', list.length === 2 && ny && ny.start === Date.parse('2026-10-28T13:00:00Z'), JSON.stringify(list.map((e) => e.title)));
ok('imported TZID event renders at 21:00 Shanghai', (await page.locator('.chip', { hasText: '紐約會議' }).count()) > 0);
ok('imported 2-day all-day event spans 2 columns', await page.evaluate(() => { const c = [...document.querySelectorAll('.chip.allday')].find((x) => x.textContent.includes('兩天活動')); return c && c.getBoundingClientRect().width > 1.5 * +document.querySelector('[data-testid=timegrid]').dataset.colw; }));
const [dl] = await Promise.all([page.waitForEvent('download'), key('Control+k')
  .then(async () => { await sleep(100); await page.keyboard.type('匯出'); await sleep(100); await key('Enter'); })]);
const out = fs.readFileSync(await dl.path(), 'utf8');
ok('⌘K → export downloads a valid .ics', /BEGIN:VCALENDAR/.test(out) && /SUMMARY:紐約會議/.test(out) && /DTSTART;VALUE=DATE:20261030/.test(out), dl.suggestedFilename());
// 13. locale + theme + time zones
await page.evaluate(() => window.__tempo.setPrefs({ locale: 'en' })); await sleep(150);
ok('locale switch to English re-renders the UI', /October/.test(await page.textContent('[data-testid=title]')), await page.textContent('[data-testid=title]'));
await page.evaluate(() => window.__tempo.setPrefs({ locale: 'zh-TW', additionalTimeZones: ['America/New_York'] })); await sleep(150);
ok('a second time zone widens the gutter to 26 + 46·2 = 118', (await geo()).gutter === 118, (await geo()).gutter);
const labels = await page.evaluate(() => [...document.querySelectorAll('.gutterhead span')].map((x) => x.textContent));
ok('gutter header lists both zones', labels.length === 2 && labels.some((l) => /GMT-4|GMT-5/.test(l)), JSON.stringify(labels));
await page.evaluate(() => window.__tempo.setPrefs({ additionalTimeZones: [], primaryTimeZone: 'America/New_York' })); await sleep(200);
ok('changing the primary zone moves the event to 9 AM', await page.evaluate(() => { const c = [...document.querySelectorAll('.chip')].find((x) => x.textContent.includes('紐約會議')); return c && /^紐約會議9\s?–\s?10\sAM/.test(c.textContent); }), await page.evaluate(() => [...document.querySelectorAll('.chip')].map((x) => x.textContent).join('|')));
// 14. persistence (localStorage)
await page.goto(`${BASE}${Q.replace('fixture=empty', 'fixture=none')}`); await page.waitForFunction(() => window.__tempoReady);
await page.evaluate(() => localStorage.removeItem('tempo.v1')); await page.reload(); await page.waitForFunction(() => window.__tempoReady); await sleep(200);
const n0 = (await evs()).length;
await key('c'); await sleep(100); await page.keyboard.type('持久'); await key('Enter'); await sleep(400);
await page.reload(); await page.waitForFunction(() => window.__tempoReady); await sleep(200);
ok('events persist across reload (browser store)', (await evs()).length === n0 + 1 && (await evs()).some((e) => e.title === '持久'));
ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./out/behaviour.json', import.meta.url), JSON.stringify(res, null, 1));
const pass = res.filter((r) => r.pass).length; console.log(`\n${pass}/${res.length} behaviour checks passed`);
process.exit(pass === res.length ? 0 : 1);
