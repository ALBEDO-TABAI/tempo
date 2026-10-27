import { describe, it, expect } from 'vitest';
import { colorFamily } from '../src/color';
const parse = (s: string) => s.match(/\d+/g)!.map(Number);
const near = (a: string, b: number[], tol = 3) => parse(a).forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThanOrEqual(tol));
describe('colour families (measured reference, indigo #9A9CFE)', () => {
  it('dark secondary background / foreground', () => {
    const f = colorFamily('#9A9CFE', true);
    near(f.backgroundSecondary, [63, 64, 91]);
    near(f.foregroundPrimary, [250, 251, 255]);
    near(f.foregroundSecondaryDimmed, [105, 106, 132], 1); // past events (dimmed)
    near(f.backgroundSecondary, [63, 64, 91], 0);
  });
});
