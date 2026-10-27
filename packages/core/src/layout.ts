// Grid layout: overlap columns for timed items in a day, row packing for all-day/multi-day bars.
// Behaviour matched to measured reference output; implementation is original.

export interface TimedItem { id: string; start: number; end: number } // minutes (or ms) on one axis
export interface Placed<T extends TimedItem = TimedItem> { item: T; leftPercent: number; widthPercent: number; layer: number; col: number; cols: number }

/** Items closer than this (same units as start) share a column split half-and-half when stacking. */
export const STACK_HALF = 30;

function overlaps(a: TimedItem, b: TimedItem, minDur: number): boolean {
  const ae = Math.max(a.end, a.start + minDur), be = Math.max(b.end, b.start + minDur);
  return a.start < be && b.start < ae;
}

/** Groups of transitively overlapping items. */
export function clusters<T extends TimedItem>(items: T[], minDur = 0): T[][] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const out: T[][] = []; let cur: T[] = []; let curEnd = -Infinity;
  for (const it of sorted) {
    const e = Math.max(it.end, it.start + minDur);
    if (cur.length && it.start >= curEnd) { out.push(cur); cur = []; curEnd = -Infinity; }
    cur.push(it); curEnd = Math.max(curEnd, e);
  }
  if (cur.length) out.push(cur);
  return out;
}

export function layoutDay<T extends TimedItem>(items: T[], opt: { minDur?: number; halfWithin?: number } = {}): Placed<T>[] {
  const minDur = opt.minDur ?? 0, half = opt.halfWithin ?? STACK_HALF;
  const out: Placed<T>[] = [];
  for (const group of clusters(items, minDur)) {
    // 1. greedy column packing in start order
    const cols: T[][] = [];
    for (const it of group) {
      const c = cols.find((col) => !col.some((o) => overlaps(o, it, minDur)));
      if (c) c.push(it); else cols.push([it]);
    }
    const n = cols.length, f = 1 / n;
    const colOf = new Map<T, number>(); cols.forEach((c, i) => c.forEach((it) => colOf.set(it, i)));
    const cascaded = new Set<T>();
    for (const it of group) {
      const c0 = colOf.get(it)!;
      let left = c0 * f, width = f;
      // 2. extend to the right through free columns; a neighbour starting within `half` takes half
      for (let k = c0 + 1; k < n; k++) {
        const hit = cols[k].find((o) => overlaps(o, it, minDur));
        if (hit) { width += hit.start - it.start <= half ? f * 0.5 : f; }
        else width += f;
        if (hit) continue;
      }
      // 3. cascade under a single earlier neighbour that began well before
      for (let k = c0 - 1; k >= 0; k--) {
        const hits = cols[k].filter((o) => overlaps(o, it, minDur));
        if (hits.length === 1 && (!(it.start - hits[0].start <= half) || cascaded.has(hits[0]))) {
          const t = f - 0.05; left -= t; width += t; cascaded.add(it);
        }
        if (hits.length) break;
      }
      out.push({ item: it, leftPercent: left, widthPercent: width, layer: c0 + 1, col: c0, cols: n });
    }
  }
  return out;
}

export interface SpanItem { id: string; startDay: number; endDay: number } // inclusive day numbers
export interface PlacedSpan<T extends SpanItem = SpanItem> { item: T; row: number; fromCol: number; toCol: number; clippedStart: boolean; clippedEnd: boolean }
/** Packs multi-day bars into rows across a visible range of days [firstDay, firstDay + days). Longer items first. */
export function packSpans<T extends SpanItem>(items: T[], firstDay: number, days: number): PlacedSpan<T>[] {
  const last = firstDay + days - 1;
  const vis = items.filter((i) => i.endDay >= firstDay && i.startDay <= last)
    .sort((a, b) => a.startDay - b.startDay || (b.endDay - b.startDay) - (a.endDay - a.startDay) || a.id.localeCompare(b.id));
  const rows: [number, number][][] = [];
  const out: PlacedSpan<T>[] = [];
  for (const it of vis) {
    const from = Math.max(it.startDay, firstDay) - firstDay, to = Math.min(it.endDay, last) - firstDay;
    let r = rows.findIndex((row) => row.every(([a, b]) => to < a || from > b));
    if (r < 0) { rows.push([]); r = rows.length - 1; }
    rows[r].push([from, to]);
    out.push({ item: it, row: r, fromCol: from, toCol: to, clippedStart: it.startDay < firstDay, clippedEnd: it.endDay > last });
  }
  return out;
}
