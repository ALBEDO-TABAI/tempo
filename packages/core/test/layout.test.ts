import { describe, it, expect } from 'vitest';
import { layoutDay, packSpans } from '../src/layout';
const px = (p: { leftPercent: number; widthPercent: number }) => ({ x: Math.round(p.leftPercent * 121), w: Math.round(p.widthPercent * 121 - 13) });
describe('overlap layout matches the measured reference (col 121px, margin-right 13)', () => {
  it('three staggered events', () => {
    const r = layoutDay([{ id: 'A', start: 540, end: 690 }, { id: 'B', start: 570, end: 630 }, { id: 'C', start: 600, end: 660 }]);
    const m = Object.fromEntries(r.map((p) => [p.item.id, px(p)]));
    expect(m.A).toEqual({ x: 0, w: 88 });
    expect(m.B).toEqual({ x: 40, w: 48 });
    expect(m.C.x).toBeGreaterThanOrEqual(80); expect(m.C.x).toBeLessThanOrEqual(81); expect(m.C.w).toBe(27);
  });
  it('non-overlapping events take full width', () => {
    const r = layoutDay([{ id: 'a', start: 0, end: 60 }, { id: 'b', start: 60, end: 120 }]);
    expect(r.every((p) => p.widthPercent === 1 && p.leftPercent === 0)).toBe(true);
  });
  it('long event with a later short one cascades', () => {
    const r = layoutDay([{ id: 'long', start: 0, end: 240 }, { id: 'late', start: 120, end: 180 }]);
    const late = r.find((p) => p.item.id === 'late')!;
    expect(late.leftPercent).toBeCloseTo(0.05, 5); expect(late.widthPercent).toBeCloseTo(0.95, 5);
  });
  it('spans pack into rows', () => {
    const r = packSpans([{ id: 'x', startDay: 3, endDay: 5 }, { id: 'y', startDay: 4, endDay: 4 }, { id: 'z', startDay: 6, endDay: 6 }], 0, 7);
    expect(r.find((p) => p.item.id === 'x')!.row).toBe(0);
    expect(r.find((p) => p.item.id === 'y')!.row).toBe(1);
    expect(r.find((p) => p.item.id === 'z')!.row).toBe(0);
  });
});
