// One-off: converts measured values from the research dumps into Tempo's own token source.
// Names are re-prefixed (design-system layer → --tp-*) so no upstream identifiers ship in the product.
import fs from 'node:fs';
const R = process.env.RESEARCH || '/workspace/ncal-research/tokens';
const nds = JSON.parse(fs.readFileSync(`${R}/nds.json`, 'utf8'));
const cal = JSON.parse(fs.readFileSync(`${R}/calendar.json`, 'utf8'));
const ren = (v) => String(v).replace(/--nds-/g, '--tp-');
const rk = (k) => k.replace(/^nds-/, 'tp-');
const map = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [rk(k), ren(v)]));
const out = {
  base: { light: map(nds.light), dark: map(nds.dark) },
  shadows: { light: map(cal.shadows['']), dark: map(cal.shadows['&.dark']) },
  calendar: {
    light: map(cal.calendar['']),
    dark: map(cal.calendar['&.dark']),
    freeBusy: map(cal.calendar['&.freeBusy'] || {}),
    freeBusyDark: map(cal.calendar['&.freeBusy.dark'] || {}),
    darkElevated: map(cal.calendar['&.dark[data-elevated]'] || {}),
  },
};
// drop marketing/public-site and database-only tokens we do not use
for (const k of Object.keys(out.calendar.light)) if (/^(public-|db-)/.test(k)) delete out.calendar.light[k];
for (const k of Object.keys(out.calendar.dark)) if (/^(public-|db-)/.test(k)) delete out.calendar.dark[k];
fs.writeFileSync(new URL('../packages/tokens/src/tokens.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('tokens:', Object.keys(out.base.light).length, Object.keys(out.calendar.light).length);
