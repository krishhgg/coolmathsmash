import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';

/** One cell of a fighter lab contact sheet, and the layout of the whole sheet. */
export interface SheetLayout {
  cols: number;
  rows: number;
  /** Cell size in pixels. */
  w: number;
  h: number;
  /** Pixels per rig unit that fits a standing pose in a cell, before any per-sheet fitting. */
  zoom: number;
}

/** Up to five cells across, as many rows as the states need; cell `i` sits at (w * i % cols, h * floor(i / cols)). */
export function sheetLayout(count: number, width = VIEW_WIDTH, height = VIEW_HEIGHT): SheetLayout {
  const cols = Math.min(5, Math.max(1, count));
  const rows = Math.ceil(Math.max(1, count) / cols);
  const w = width / cols;
  const h = height / rows;
  return { cols, rows, w, h, zoom: Math.min(w / 22, h / 19) };
}
