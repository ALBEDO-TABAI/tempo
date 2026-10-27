// Pixel + layout parity vs the reference captures, with redacted side-by-sides for docs/parity/.
//   pixel  = % of pixels within pixelmatch threshold 0.1 at 2x (text rasterisation differs: SF vs Linux fonts)
//   layout = % of 8×8 blocks whose mean colour is within 10/255 (geometry + colour, glyph-shape independent)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
const REF = '/workspace/ncal-research/ref';
const DOC = '/workspace/tempo/docs/parity';
const OUT = new URL('./out/pixel/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(DOC, { recursive: true });
const BASE = process.env.TEMPO_URL || 'http://127.0.0.1:5300/index.html';
const Q = '&fixture=parity&tz=Asia/Shanghai&now=2026-10-28T01:00:00%2B08:00&freeze=1&locale=zh-TW&density=-2';
const sel9 = "(()=>{const s=window.__tempo;const e=Object.values(s.getState().events).find(e=>e.title==='REA 測試 9');s.setState({selected:[e.id],editing:e.id})})()";
const CASES = [];
for (const th of ['dark', 'light']) CASES.push(
  { name: `week_${th}`, ref: `b2_${th}_week_events`, q: `&theme=${th}` },
  { name: `3day_${th}`, ref: `b2_${th}_3day_events`, q: `&theme=${th}&days=3&date=2026-10-28` },
  { name: `day_fri_${th}`, ref: `b2_${th}_day_fri_events`, q: `&theme=${th}&days=1&date=2026-10-30` },
  { name: `month_${th}`, ref: `b2_${th}_month_events`, q: `&theme=${th}&view=month` },
  { name: `cmdk_${th}`, ref: `b3_${th}_cmdk`, q: `&theme=${th}`, js: "window.__tempo.setState({overlay:'cmdk'})" },
  { name: `view_menu_${th}`, ref: `b3_${th}_view_menu`, q: `&theme=${th}`, js: "document.querySelector('[data-testid=viewbtn]').click()" },
  { name: `settings_${th}`, ref: `b3_${th}_settings`, q: `&theme=${th}`, js: "window.__tempo.setState({overlay:'settings'})" },
  { name: `shortcuts_${th}`, ref: `b3_${th}_shortcuts`, q: `&theme=${th}`, js: "window.__tempo.setState({overlay:'shortcuts'})" },
  { name: `search_${th}`, ref: `b3_${th}_search`, q: `&theme=${th}`, js: "window.__tempo.setState({overlay:'search'})" },
  { name: `sidebar_hidden_${th}`, ref: `b3_${th}_sidebar_hidden`, q: `&theme=${th}` },
  { name: `panel_event_${th}`, ref: `b4_${th}_panel_event`, q: `&theme=${th}`, js: sel9 },
);
const readPng = (f) => PNG.sync.read(fs.readFileSync(f));
function layoutScore(a, b, B = 16) { // 2x images → 8 css px blocks
  const W = a.width, H = a.height; let okb = 0, tot = 0;
  for (let by = 0; by + B <= H; by += B) for (let bx = 0; bx + B <= W; bx += B) {
    let d = 0; const s = [0, 0, 0, 0, 0, 0];
    for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) { const i = (y * W + x) * 4; for (let c = 0; c < 3; c++) { s[c] += a.data[i + c]; s[3 + c] += b.data[i + c]; } }
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(s[c] - s[3 + c]) / (B * B));
    tot++; if (d <= 10) okb++;
  }
  return (100 * okb) / tot;
}
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const rows = [];
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
for (const c of CASES.filter((c) => !ONLY || ONLY.test(c.name))) {
  if (!fs.existsSync(`${REF}/${c.ref}.png`)) { console.log('skip', c.ref); continue; }
  const refJ = JSON.parse(fs.readFileSync(`${REF}/${c.ref}.json`, 'utf8'));
  const side = refJ.els.some((e) => e.text.trim() === '2026十月' && e.r[0] >= 0 && e.r[0] < 240); // the reference run left the sidebar toggled in some states
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}?harness=1&storage=memory${Q}${c.q}${/sidebar=/.test(c.q) ? '' : `&sidebar=${side ? 1 : 0}`}`); await page.waitForFunction(() => window.__tempoReady); await page.waitForTimeout(350);
  if (c.js) { await page.evaluate(c.js); await page.waitForTimeout(450); }
  await page.mouse.move(1439, 899);
  const mineF = `${OUT}${c.name}_tempo.png`; await page.screenshot({ path: mineF }); await page.close();
  const refF = `${OUT}${c.name}_ref.png`; fs.copyFileSync(`${REF}/${c.ref}.png`, refF);
  const a = readPng(refF), b = readPng(mineF);
  if (a.width !== b.width || a.height !== b.height) { console.log('size mismatch', c.name, a.width, a.height, b.width, b.height); continue; }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1, alpha: 0.25, diffColor: [255, 40, 90] });
  fs.writeFileSync(`${OUT}${c.name}_diff.png`, PNG.sync.write(diff));
  const pixel = 100 - (100 * n) / (a.width * a.height); const layout = layoutScore(a, b);
  // redacted side-by-side: ref | tempo | diff at 1x
  execFileSync('python3', [new URL('./redact.py', import.meta.url).pathname, c.ref, `${OUT}${c.name}_ref_redacted.png`]);
  execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw
ps=[Image.open(p).convert('RGB').resize((1440,900)) for p in ['${OUT}${c.name}_ref_redacted.png','${OUT}${c.name}_tempo.png','${OUT}${c.name}_diff.png']]
im=Image.new('RGB',(1440*3+40,930),(255,255,255)); d=ImageDraw.Draw(im)
for i,p in enumerate(ps): im.paste(p,(i*(1440+20),30))
for i,l in enumerate(['reference (redacted)','Tempo','diff  pixel ${pixel.toFixed(1)}%  layout ${layout.toFixed(1)}%']): d.text((i*1460+6,8),l,fill=(0,0,0))
im=im.resize((im.width//2, im.height//2)); im.save('${DOC}/${c.name}.png', optimize=True)`]);
  rows.push({ name: c.name, ref: c.ref, pixel: +pixel.toFixed(2), layout: +layout.toFixed(2) });
  console.log(`${c.name.padEnd(20)} pixel ${pixel.toFixed(1).padStart(5)}%  layout ${layout.toFixed(1).padStart(5)}%`);
}
await browser.close();
const avg = (k) => (rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(1);
console.log(`\nmean pixel ${avg('pixel')}%  layout ${avg('layout')}%  (${rows.length} states)`);
if (!ONLY) {
fs.writeFileSync(`${OUT}../pixel.json`, JSON.stringify(rows, null, 1));
fs.writeFileSync(`${DOC}/PIXEL.md`, `# Pixel / layout parity\n\nGenerated by \`packages/parity/pixel.mjs\` against the reference captures (kept outside the repo).\nThe reference half of every side-by-side is redacted (account, calendar list, other people's / real event titles).\n\n- **pixel**: share of pixels matching within pixelmatch threshold 0.1 at 2×. Text is rasterised with different fonts (macOS system font vs. Linux fallbacks), so this is a lower bound.\n- **layout**: share of 8×8 css-px blocks whose mean colour is within 10/255 — geometry + colour, independent of glyph shapes.\n\n| state | pixel | layout | side-by-side |\n|---|---:|---:|---|\n${rows.map((r) => `| ${r.name} | ${r.pixel}% | ${r.layout}% | [png](${r.name}.png) |`).join('\n')}\n| **mean** | **${avg('pixel')}%** | **${avg('layout')}%** | |\n`);
}
