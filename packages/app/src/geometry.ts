// Grid metrics — formulas and constants measured from the reference (see docs/SPEC-NOTES.md).
import { grid, chip } from '@tokens/tokens';
export const G = {
  topBar: 48, titleRow: 30, header: 78, colHeader: grid.colHeaderHeight, monthColHeader: grid.monthColHeaderHeight,
  allDayBase: grid.allDayRowHeight, allDayChip: grid.allDayChipHeight, allDaySpacing: grid.allDayChipSpacing, allDayPadTop: grid.allDayPaddingTop,
  gutterBase: grid.timeColumnLeftGutter, tzCol: grid.timeZoneColWidth, minCol: grid.minColWidth, sidebar: grid.sidebarWidth, panel: grid.contextPanelWidth,
  defaultHour: grid.defaultHourHeight, densityStep: grid.densityStep, maxHour: grid.maxHourHeight, monthPadTop: grid.monthCellPaddingTop,
  chipMarginBottom: chip.marginBottom, chipMarginRight: chip.marginRight, chipMinHeight: 10, chipTitleLH: chip.titleLineHeight, chipTimeLH: chip.timeLineHeight,
};
export const gutterWidth = (tzCount: number, gridWidth?: number) => {
  const w = G.gutterBase + G.tzCol * Math.max(1, tzCount);
  // very narrow windows shrink the gutter (measured: 61.7 at 500 px)
  return gridWidth !== undefined && gridWidth < 300 ? Math.max(48, Math.min(w, gridWidth * 0.2 + 48)) : w;
};
export const colWidth = (gridWidth: number, gutter: number, n: number) => Math.max(G.minCol, Math.ceil((gridWidth - gutter) / n));
/** Hour row height for a density level, never smaller than "24 hours fill the viewport". */
export const hourHeight = (level: number, available: number) => Math.max(G.defaultHour + G.densityStep * level, available / 24, 16);
export const minHourFor = (available: number) => Math.max(available / 24, 16);
export const minDensityLevel = (available: number) => -Math.ceil((G.defaultHour - minHourFor(available)) / G.densityStep - 1e-9);
export const allDayHeight = (rows: number) => Math.max(G.allDayBase, G.allDayPadTop + 1 + rows * (G.allDayChip + G.allDaySpacing));
