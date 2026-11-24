import { VIEW_HEIGHT, VIEW_WIDTH } from '../../config';
import type { CameraView } from '../camera';
import { rand, seedOf, signed } from './random';
import { blade, clamp01, easeOut, lerp, mix, star, TAU, twinkle, type Shape } from './shapes';

/** A KO: where the fighter crossed the blast zone (world units, y up) and whose colour the blast takes. */
export interface KoBlast {
  frame: number;
  port: number;
  x: number;
  y: number;
  seed: number;
}

export const KO_LIFE = 44;
/** The beam reaches 1.25 screen diagonals back across the stage. */
const BEAM_LENGTH = 1.25 * Math.hypot(VIEW_WIDTH, VIEW_HEIGHT);

export function spawnKoBlast(port: number, frame: number, x: number, y: number): KoBlast {
  return { frame, port, x, y, seed: seedOf(frame, port, 7) };
}

/**
 * Where the blast enters the screen (pixels, y down) and the unit direction it shoots: the KO point projected through
 * `view` and clamped to the screen edge, aimed at the screen centre.
 */
export function koAnchor(ko: KoBlast, view: CameraView): { x: number; y: number; ux: number; uy: number } {
  const sx = VIEW_WIDTH / 2 + (ko.x - view.x) * view.zoom;
  const sy = VIEW_HEIGHT / 2 - (ko.y - view.y) * view.zoom;
  const x = Math.min(VIEW_WIDTH, Math.max(0, sx));
  const y = Math.min(VIEW_HEIGHT, Math.max(0, sy));
  const dx = VIEW_WIDTH / 2 - x;
  const dy = VIEW_HEIGHT / 2 - y;
  const len = Math.hypot(dx, dy) || 1;
  return { x, y, ux: dx / len, uy: dy / len };
}

/**
 * Ultimate's KO blast in screen pixels: a port-coloured cone of light, widest where it bursts in at the screen edge
 * and tapering across the whole screen, with a white core, speed streaks, twinkling sparkles and a starburst at the
 * edge. It shoots across in 4 frames, holds until frame 24, then pinches thin and vanishes over 20.
 */
export function koBlastShapes(ko: KoBlast, color: number, frame: number, view: CameraView): Shape[] {
  const age = frame - ko.frame;
  if (age < 0 || age >= KO_LIFE) return [];
  const { x: ax, y: ay, ux, uy } = koAnchor(ko, view);
  const a = Math.atan2(uy, ux);
  const reach = easeOut(age / 4);
  const pinch = age < 24 ? 1 : 1 - clamp01((age - 24) / (KO_LIFE - 24)) ** 0.8;
  const width = 420 * (age < 3 ? 0.65 + 0.12 * age : 1) * pinch;
  const len = BEAM_LENGTH * reach;
  const ox = ax - ux * 120;
  const oy = ay - uy * 120;
  const light = mix(color, 0xffffff, 0.5);
  const dark = mix(color, 0x000000, 0.45);
  const out: Shape[] = [];
  if (width > 1) {
    const sway = signed(ko.seed, Math.floor(age / 2)) * 0.012;
    out.push({
      type: 'poly',
      points: blade(ox, oy, a + sway, len, width, 1.05),
      fill: { color, alpha: 0.72 },
    });
    out.push({
      type: 'poly',
      points: blade(ox, oy, a - sway, len * 0.9, width * 0.62, 1.05),
      fill: { color: light, alpha: 0.9 },
    });
    out.push({
      type: 'poly',
      points: blade(ox, oy, a, len * 0.78, width * 0.3, 1.05),
      fill: { color: 0xffffff },
    });
  }
  for (let i = 0; i < 12; i++) {
    const off = signed(ko.seed, 10 + i) * width * 0.42;
    const speed = 50 + 40 * rand(ko.seed, 20 + i);
    const start = 60 + ((age * speed + rand(ko.seed, 30 + i) * BEAM_LENGTH) % (BEAM_LENGTH * 0.85));
    const sl = (120 + 200 * rand(ko.seed, 40 + i)) * reach * pinch;
    if (sl < 8 || start > len) continue;
    const px = ox - uy * off + ux * start;
    const py = oy + ux * off + uy * start;
    out.push({
      type: 'poly',
      points: blade(px, py, a, sl, lerp(4, 9, rand(ko.seed, 50 + i)) * Math.max(pinch, 0.3), 1),
      fill: { color: i % 3 === 0 ? light : 0xffffff, alpha: 0.95 },
    });
  }
  for (let i = 0; i < 12; i++) {
    const cycle = 10 + Math.floor(rand(ko.seed, 60 + i) * 6);
    const phase = (age + Math.floor(rand(ko.seed, 70 + i) * cycle)) % cycle;
    const twk = Math.sin((Math.PI * phase) / cycle);
    const along = 80 + BEAM_LENGTH * 0.6 * rand(ko.seed, 80 + i) + age * 6;
    const off = signed(ko.seed, 90 + i) * width * 0.6;
    const size = (10 + 18 * rand(ko.seed, 100 + i)) * twk * Math.max(pinch, 0.25) * reach;
    if (size < 2) continue;
    const px = ox - uy * off + ux * along;
    const py = oy + ux * off + uy * along;
    out.push({
      type: 'poly',
      points: twinkle(px, py, size, size, size * 0.18, 0),
      fill: { color: 0xffffff },
      line: { color: dark, width: 2 },
    });
  }
  if (age < 16) {
    const k = age < 3 ? 0.6 + 0.2 * age : 1.2 * (1 - (age - 3) / 13);
    const rot = rand(ko.seed, 120) * TAU;
    const bx = ax + ux * 50;
    const by = ay + uy * 50;
    out.push({
      type: 'poly',
      points: star(
        bx,
        by,
        16,
        (i) => 170 * k * (i % 2 ? 0.6 : 1) * (0.8 + 0.2 * rand(ko.seed, 130 + i)),
        60 * k,
        rot,
      ),
      fill: { color: light },
      line: { color: dark, width: 3 },
    });
    out.push({
      type: 'poly',
      points: star(bx, by, 16, (i) => 110 * k * (i % 2 ? 0.6 : 1), 40 * k, rot + 0.1),
      fill: { color: 0xffffff },
    });
  }
  return out;
}
