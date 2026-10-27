// Calendar colour families derived in CIECAM02 JCh (values measured from the reference).
// @ts-expect-error no types
import { jch } from 'd3-cam02';
import { rgb } from 'd3-color';

export interface ColorFamily {
  hex: string; dark: boolean;
  backgroundPrimary: string; backgroundPrimaryDimmed: string;
  backgroundSecondary: string; backgroundSecondaryDimmed: string;
  foregroundPrimary: string; foregroundPrimaryDimmed: string;
  foregroundSecondary: string; foregroundSecondaryDimmed: string;
}
export const PALETTE: { id: string; name: string; hex: string }[] = [
  { id: 'red', name: 'Red', hex: '#ED201D' }, { id: 'coral', name: 'Coral', hex: '#D06B65' },
  { id: 'orange', name: 'Orange', hex: '#FD7941' }, { id: 'yellow', name: 'Yellow', hex: '#F4BE40' },
  { id: 'lime', name: 'Lime', hex: '#B3DC6D' }, { id: 'grass', name: 'Grass', hex: '#7BD149' },
  { id: 'green', name: 'Green', hex: '#5ECC89' }, { id: 'mint', name: 'Mint', hex: '#92E1C1' },
  { id: 'blue', name: 'Blue', hex: '#4CA8DF' }, { id: 'sapphire', name: 'Sapphire', hex: '#4986E8' },
  { id: 'indigo', name: 'Indigo', hex: '#9A9CFE' }, { id: 'violet', name: 'Violet', hex: '#B99AFE' },
  { id: 'purple', name: 'Purple', hex: '#985DF6' }, { id: 'pink', name: 'Pink', hex: '#F691B3' },
  { id: 'blush', name: 'Blush', hex: '#CCA6AD' }, { id: 'brown', name: 'Brown', hex: '#AC725F' },
  { id: 'gray', name: 'Gray', hex: '#B8B8B8' },
];
const toCss = (c: { rgb(): { r: number; g: number; b: number } }) => {
  const q = c.rgb(); const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${cl(q.r)}, ${cl(q.g)}, ${cl(q.b)})`;
};
const cache = new Map<string, ColorFamily>();
export function colorFamily(hex: string, dark = false): ColorFamily {
  const key = hex.toUpperCase() + (dark ? ':d' : ':l');
  const hit = cache.get(key); if (hit) return hit;
  const n = jch(rgb(hex)); const J = n.J, C = n.C, h = n.h; const r = C >= 5;
  const J_ = (j: number, c: number) => toCss(jch(j, c, h));
  const f: ColorFamily = dark ? {
    hex, dark,
    backgroundPrimary: J_(J * 1.03, C), backgroundPrimaryDimmed: J_(25, C * 0.5),
    backgroundSecondary: J_(20, C * 0.4), backgroundSecondaryDimmed: J_(20, C * 0.4),
    foregroundPrimary: J_(100, r ? 30 : C), foregroundPrimaryDimmed: J_(45, r ? 15 : C),
    foregroundSecondary: J_(55, r ? 35 : C), foregroundSecondaryDimmed: J_(35, r ? 20 : C),
  } : {
    hex, dark,
    backgroundPrimary: J_(J * 0.97, C * 1.1), backgroundPrimaryDimmed: J_(84, C * 0.5),
    backgroundSecondary: J_(95, C * 0.4), backgroundSecondaryDimmed: J_(95, C * 0.4),
    foregroundPrimary: J_(30, r ? 70 : C), foregroundPrimaryDimmed: J_(60, r ? 25 : C),
    foregroundSecondary: J_(35, r ? 60 : C), foregroundSecondaryDimmed: J_(70, r ? 20 : C),
  };
  cache.set(key, f); return f;
}
/** Deterministic default colour for a calendar id (stable hash into the palette). */
export function defaultColorFor(id: string): string {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length].hex;
}
