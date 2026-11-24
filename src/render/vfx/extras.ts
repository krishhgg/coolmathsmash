import { rand, seedOf, signed } from './random';
import { clamp01, mix, star, TAU, twinkle, type Shape } from './shapes';

/** The respawn platform after its fighter stepped off, shrinking away. World units, y up (the feet). */
export interface HaloFade {
  frame: number;
  port: number;
  x: number;
  y: number;
}

export const HALO_FADE_LIFE = 18;

/**
 * Smash-charge glow behind the charging fighter (body centre `cx`, `cy`, y down): a pale gold starburst that
 * pulses every 6 frames and grows with the charge (`charge` frames of 60).
 */
export function chargeAuraShapes(cx: number, cy: number, frame: number, charge: number): Shape[] {
  const k = (0.88 + 0.12 * Math.sin((frame * TAU) / 6)) * (0.75 + 0.25 * clamp01(charge / 60));
  const rot = frame * 0.04;
  return [
    {
      type: 'poly',
      points: star(cx, cy, 14, (i) => 10.5 * k * (i % 2 ? 0.72 : 1), 6 * k, rot),
      fill: { color: 0xffe45c, alpha: 0.4 },
    },
    {
      type: 'poly',
      points: star(cx, cy, 14, (i) => 7.5 * k * (i % 2 ? 0.72 : 1), 4.5 * k, -rot),
      fill: { color: 0xffffff, alpha: 0.45 },
    },
  ];
}

/**
 * Smash-charge sparkle: white-gold twinkles popping in and out around the charging fighter's body centre
 * (`cx`, `cy`, y down), more of them the longer the charge. Each twinkle lives one short cycle, then reappears
 * somewhere else.
 */
export function chargeShapes(cx: number, cy: number, port: number, frame: number, charge: number): Shape[] {
  const out: Shape[] = [];
  const count = 3 + Math.min(3, Math.floor(charge / 15));
  for (let i = 0; i < count; i++) {
    const cycle = 8;
    const t = frame + i * 3;
    const phase = t % cycle;
    const seed = seedOf(Math.floor(t / cycle), port, 9 + i * 31);
    const a = rand(seed, 0) * TAU;
    const d = 4.5 + 4 * rand(seed, 1);
    const size = (1.8 + 1.2 * rand(seed, 2)) * Math.sin((Math.PI * (phase + 0.5)) / cycle);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 1.2;
    out.push({
      type: 'poly',
      points: twinkle(x, y, size, size, size * 0.2, 0),
      fill: { color: i % 2 ? 0xfff3a0 : 0xffffff },
      line: { color: 0x7a4b00, width: 0.22 },
    });
  }
  const glint = frame % 6 < 3;
  if (glint)
    out.push({
      type: 'circle',
      x: cx + signed(seedOf(frame, port, 10), 0) * 3,
      y: cy - 4,
      r: 0.6,
      fill: { color: 0xffffff },
    });
  return out;
}

/**
 * Ultimate's respawn platform: a glowing port-coloured halo disc under the fighter's feet (`x`, `y`, y down) with
 * light falling from it, scaled by `k` (0 to 1) as it appears and fades.
 */
export function haloShapes(x: number, y: number, color: number, frame: number, k: number): Shape[] {
  const s = clamp01(k);
  if (s <= 0) return [];
  const rx = 8.5 * s;
  const ry = 2 * s;
  const cy = y + 1.3;
  const light = mix(color, 0xffffff, 0.55);
  const dark = mix(color, 0x000000, 0.55);
  const out: Shape[] = [];
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * rx * 0.55;
    const len = 7 + 2 * Math.sin(frame * 0.15 + i * 2);
    out.push({
      type: 'poly',
      points: [x + off - 1.6 * s, cy, x + off + 1.6 * s, cy, x + off * 1.3, cy + len * s],
      fill: { color: light, alpha: 0.35 },
    });
  }
  out.push({ type: 'ellipse', x, y: cy + 0.5, rx, ry, fill: { color }, line: { color: dark, width: 0.3 } });
  out.push({ type: 'ellipse', x, y: cy - 0.2, rx: rx * 0.86, ry: ry * 0.6, fill: { color: light } });
  out.push({
    type: 'ellipse',
    x,
    y: cy - 0.35,
    rx: rx * 0.5,
    ry: ry * 0.28,
    fill: { color: 0xffffff, alpha: 0.9 },
  });
  const phase = frame % 20;
  if (phase < 10) {
    const z = Math.sin((Math.PI * phase) / 10) * s;
    const side = Math.floor(frame / 20) % 2 ? 1 : -1;
    out.push({
      type: 'poly',
      points: twinkle(x + side * rx * 0.7, cy - 0.5, 1.4 * z, 1.4 * z, 0.25 * z, 0),
      fill: { color: 0xffffff },
    });
  }
  return out;
}
