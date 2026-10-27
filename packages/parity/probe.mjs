// Usage: node probe.mjs "<query>" "<js>" "<rectFilter x0,y0,x1,y1>" — prints leaf-text rects + key styles
import { chromium } from 'playwright';
const [,, q, js, f = '0,0,99999,99999'] = process.argv;
const BASE = process.env.TEMPO_URL || 'http://127.0.0.1:5300/index.html';
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`${BASE}?harness=1&storage=memory${q}`);
await page.waitForFunction(() => window.__tempoReady); await page.waitForTimeout(300);
if (js) { await page.evaluate(js); await page.waitForTimeout(400); }
const [x0, y0, x1, y1] = f.split(',').map(Number);
const out = await page.evaluate(([x0, y0, x1, y1]) => {
  const r = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const t = n.textContent.trim(); if (!t) continue;
    const range = document.createRange(); range.selectNodeContents(n); const b = range.getBoundingClientRect();
    if (b.x < x0 || b.y < y0 || b.x > x1 || b.y > y1 || !b.width) continue;
    const st = getComputedStyle(n.parentElement);
    r.push(`${n.parentElement.tagName} [${b.x.toFixed(1)}, ${b.y.toFixed(1)}, ${b.width.toFixed(1)}, ${b.height.toFixed(1)}] ${JSON.stringify(t.slice(0, 24))} ${st.fontSize}/${st.lineHeight} w${st.fontWeight} ${st.color}`);
  }
  return r;
}, [x0, y0, x1, y1]);
console.log(out.join('\n'));
await browser.close();
