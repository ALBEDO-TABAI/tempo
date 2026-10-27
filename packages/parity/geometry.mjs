// Geometry parity: compares element rects in Tempo against the reference capture JSON (research dir, not shipped).
import { chromium } from 'playwright';
import fs from 'node:fs';
const REF = process.env.REF_DIR || '/workspace/ncal-research/ref';
const BASE = process.env.TEMPO_URL || 'http://127.0.0.1:5300/index.html';
const Q = '&fixture=parity&tz=Asia/Shanghai&now=2026-10-28T01:00:00%2B08:00&freeze=1&locale=zh-TW&density=-2';
const CASES = [
  { name: 'week_dark', ref: 'b2_dark_week_events', q: '&theme=dark' },
  { name: 'week_light', ref: 'b2_light_week_events', q: '&theme=light' },
  { name: '3day_dark', ref: 'b2_dark_3day_events', q: '&theme=dark&days=3&date=2026-10-28' },
  { name: 'day_fri', ref: 'b2_dark_day_fri_events', q: '&theme=dark&days=1&date=2026-10-30' },
  { name: 'month_dark', ref: 'b2_dark_month_events', q: '&theme=dark&view=month' },
  { name: 'month_light', ref: 'b2_light_month_events', q: '&theme=light&view=month' },
];
const round = (r) => r.map((v) => Math.round(v * 10) / 10);
function refChips(j) {
  const els = j.els; const out = [];
  for (const e of els) if (e.sc.split(' ').includes('sc-1axd7p-15')) {
    const ttl = els.find((t) => t.sc.includes('sc-1axd7p-6') && t.r[0] >= e.r[0] && t.r[0] <= e.r[0] + 10 && t.r[1] >= e.r[1] - 3 && t.r[1] <= e.r[1] + 4);
    if (ttl && ttl.text.startsWith('REA')) out.push({ t: ttl.text.trim(), r: e.r });
  }
  return out;
}
function refCols(j) { return j.els.filter((e) => e.sc.split(' ').includes('sc-an92oj-3') && e.r[0] >= 240 && e.r[0] < 1156).map((e) => e.r); }
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const report = []; let worst = 0; let n = 0; let sum = 0;
for (const c of CASES) {
  const ref = JSON.parse(fs.readFileSync(`${REF}/${c.ref}.json`, 'utf8'));
  const page = await browser.newPage({ viewport: { width: ref.vw, height: ref.vh } });
  await page.goto(`${BASE}?harness=1&storage=memory&platform=mac${Q}${c.q}`); await page.waitForFunction(() => window.__tempoReady); await page.waitForTimeout(300);
  const mine = await page.evaluate(() => {
    const R = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
    return {
      chips: [...document.querySelectorAll('.chip')].filter((c) => !c.classList.contains('ghost')).map((c) => ({ t: c.querySelector('.ttl')?.textContent?.trim(), r: R(c) })),
      cols: [...document.querySelectorAll('.colhead')].map(R),
      grid: (() => { const g = document.querySelector('[data-testid=timegrid],[data-testid=month]'); return g ? { colw: +g.dataset.colw, hourh: +(g.dataset.hourh || g.dataset.rowh) } : null; })(),
      now: (() => { const b = document.querySelector('.nowbar'); return b ? R(b) : null; })(),
      pill: (() => { const b = document.querySelector('.nowpill'); return b ? R(b) : null; })(),
      btns: [...document.querySelectorAll('.topbar .btn, .topbar .ibtn')].map(R),
      mini: [...document.querySelectorAll('.mini-day')].slice(0, 3).map(R),
    };
  });
  const rc = refChips(ref); const rows = [];
  for (const r of rc) {
    const m = mine.chips.find((x) => x.t === r.t && Math.abs(x.r[1] - r.r[1]) < 60) ?? mine.chips.find((x) => x.t === r.t);
    if (!m) { rows.push({ el: r.t, ref: round(r.r), tempo: null }); continue; }
    const d = Math.max(...r.r.map((v, i) => Math.abs(v - m.r[i]))); worst = Math.max(worst, d); sum += d; n++;
    rows.push({ el: r.t, ref: round(r.r), tempo: round(m.r), maxErr: Math.round(d * 100) / 100 });
  }
  const g = ref.grid || {};
  const gridRow = { colWidth: [g.colWidth, mine.grid?.colw], rowHeight: [Math.round(g.rowHeight * 100) / 100, Math.round((mine.grid?.hourh ?? 0) * 100) / 100] };
  const nowRef = ref.els.find((e) => e.sc.split(' ').includes('sc-1k1busz-0'));
  const pillRef = ref.els.find((e) => e.sc.split(' ').includes('sc-7b0feo-1'));
  const btnRef = ref.els.filter((e) => e.tag === 'BUTTON' && e.sc.includes('sc-gfyskm-3') && e.r[1] < 40 && e.r[0] > 900 && e.r[0] < 1156).map((e) => round(e.r));
  report.push({ case: c.name, ref: c.ref, grid: gridRow, nowbar: [nowRef && round(nowRef.r), mine.now && round(mine.now)], nowpill: [pillRef && round(pillRef.r), mine.pill && round(mine.pill)],
    topbarButtons: { ref: btnRef, tempo: mine.btns.map(round) }, chips: rows });
  await page.close();
}
await browser.close();
fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./out/geometry.json', import.meta.url), JSON.stringify({ worst, mean: n ? sum / n : 0, n, report }, null, 1));
for (const r of report) {
  console.log(`\n## ${r.case}  colW ref/tempo ${r.grid.colWidth}  hour ${r.grid.rowHeight}`);
  console.log(`  nowbar ${JSON.stringify(r.nowbar)}  pill ${JSON.stringify(r.nowpill)}`);
  console.log(`  buttons ref ${JSON.stringify(r.topbarButtons.ref)}\n          tempo ${JSON.stringify(r.topbarButtons.tempo)}`);
  for (const c of r.chips) console.log(`  ${c.el.padEnd(12)} ref ${JSON.stringify(c.ref)} tempo ${JSON.stringify(c.tempo)} err ${c.maxErr ?? 'MISSING'}`);
}
console.log(`\nchips compared ${n}, max error ${worst.toFixed(2)} px, mean max-error ${(n ? sum / n : 0).toFixed(2)} px`);
