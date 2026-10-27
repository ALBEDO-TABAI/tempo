// Usage: node shot.mjs "<query>" out.png [w h] [js]
import { chromium } from 'playwright';
const [,, q, out, w = '1440', h = '900', js] = process.argv;
const BASE = process.env.TEMPO_URL || 'http://127.0.0.1:5300/index.html';
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('ERR', e.message)); page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(`${BASE}?harness=1&storage=memory${q}`);
await page.waitForFunction(() => window.__tempoReady); await page.waitForTimeout(400);
if (js) { await page.evaluate(js); await page.waitForTimeout(500); }
await page.screenshot({ path: out });
await browser.close();
