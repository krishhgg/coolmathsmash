import { rand, seedOf } from './random';
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
 * Smash-charge sparkle for a fighter whose body centre is (`cx`, `cy`) (y down), half `w` wide and half `h` tall,
 * facing `facing`, after `charge` frames of 60: a two-tone sparkle at the leading hand that pulses faster as the
 * charge builds, motes drawn in toward it, and 4-point glints popping on the body outline every 6 frames (never
 * below the feet).
 */
export function chargeShapes(
  cx: number,
  cy: number,
  w: number,
  h: number,
  facing: number,
  port: number,
  frame: number,
  charge: number,
): Shape[] {
  const out: Shape[] = [];
  const full = clamp01(charge / 60);
  const hx = cx + facing * (w + 1);
  const hy = cy - h * 0.15;
  for (let i = 0; i < 5; i++) {
    const cycle = 10;
    const t = (frame + i * 2) % cycle;
    const seed = seedOf(Math.floor((frame + i * 2) / cycle), port, 40 + i);
    const a = -Math.PI / 2 + facing * (0.2 + 2.2 * rand(seed, 0)) * (rand(seed, 3) < 0.5 ? 1 : -0.6);
    const d = (6 + 3 * rand(seed, 1)) * (1 - t / cycle);
    const size = 0.45 + 0.25 * rand(seed, 2);
    out.push({
      type: 'circle',
      x: hx + Math.cos(a) * d,
      y: hy + Math.sin(a) * d,
      r: size,
      fill: { color: i % 2 ? 0xfff3a0 : 0xffffff },
      line: { color: 0x7a4b00, width: 0.15 },
    });
  }
  const period = Math.round(8 - 4 * full);
  const beat = Math.sin((Math.PI * (frame % period)) / period);
  const s = (1.6 + 1.2 * full) * (0.75 + 0.35 * beat);
  out.push({
    type: 'poly',
    points: twinkle(hx, hy, s * 1.6, s * 1.6, s * 0.3, Math.PI / 4),
    fill: { color: 0xffd23c },
    line: { color: 0x7a4b00, width: 0.22 },
  });
  out.push({
    type: 'poly',
    points: twinkle(hx, hy, s * 1.9, s * 1.9, s * 0.22, 0),
    fill: { color: 0xffffff },
    line: { color: 0x7a4b00, width: 0.22 },
  });
  for (let i = 0; i < 3; i++) {
    const cycle = 6;
    const phase = (frame + i * 2) % cycle;
    const seed = seedOf(Math.floor((frame + i * 2) / cycle), port, 9 + i * 31);
    const a = -Math.PI - 0.35 + rand(seed, 0) * (Math.PI + 0.7);
    const k = phase < 2 ? (phase + 1) / 2 : 1 - (phase - 2) / 4;
    const size = (1 + 0.8 * rand(seed, 1)) * k;
    if (size < 0.2) continue;
    out.push({
      type: 'poly',
      points: twinkle(cx + Math.cos(a) * w, cy + Math.sin(a) * h, size, size, size * 0.2, 0),
      fill: { color: i % 2 ? 0xfff3a0 : 0xffffff },
      line: { color: 0x7a4b00, width: 0.18 },
    });
  }
  return out;
}

/** The release of a charged smash: a short white-gold flash bursting out from the leading hand (`x`, `y`, y down). */
export function chargeReleaseShapes(x: number, y: number, age: number, seed: number): Shape[] {
  if (age < 0 || age >= 4) return [];
  const k = age < 1 ? 0.7 : 1 - (age - 1) / 4;
  return [
    {
      type: 'poly',
      points: star(
        x,
        y,
        10,
        (i) => (i % 2 ? 2.6 : 4.2) * k * (0.85 + 0.3 * rand(seed, i)),
        1.4 * k,
        rand(seed, 20) * TAU,
      ),
      fill: { color: 0xffe066 },
      line: { color: 0x7a4b00, width: 0.25 },
    },
    {
      type: 'poly',
      points: star(x, y, 10, (i) => (i % 2 ? 1.6 : 2.6) * k, 0.9 * k, rand(seed, 21) * TAU),
      fill: { color: 0xffffff },
    },
  ];
}

/**
 * Ultimate's respawn platform under the fighter's feet (`x`, `y`, y down), scaled by `k` (0 to 1) as it appears and
 * fades: a soft glow, a half-clear port-coloured disc with a bright rim and a pulsing white edge accent, light
 * falling from it, and two sparkles at the feet.
 */
export function haloShapes(x: number, y: number, color: number, frame: number, k: number): Shape[] {
  const s = clamp01(k);
  if (s <= 0) return [];
  const rx = 8.5 * s;
  const ry = 2 * s;
  const cy = y + 1.3;
  const light = mix(color, 0xffffff, 0.6);
  const dark = mix(color, 0x000000, 0.55);
  const pulse = 0.5 + 0.5 * Math.sin((frame * TAU) / 16);
  const out: Shape[] = [
    { type: 'ellipse', x, y: cy, rx: rx * 1.35, ry: ry * 2, fill: { color: light, alpha: 0.25 * s } },
  ];
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * rx * 0.55;
    const len = 7 + 2 * Math.sin(frame * 0.15 + i * 2);
    out.push({
      type: 'poly',
      points: [x + off - 1.6 * s, cy, x + off + 1.6 * s, cy, x + off * 1.3, cy + len * s],
      fill: { color: light, alpha: 0.55 },
      line: { color: dark, width: 0.12, alpha: 0.35 },
    });
  }
  out.push({
    type: 'ellipse',
    x,
    y: cy,
    rx,
    ry,
    fill: { color, alpha: 0.5 },
    line: { color: dark, width: 0.3 },
  });
  out.push({
    type: 'poly',
    points: ellipseArc(x, cy, rx * 0.92, ry * 0.75, 0.05, Math.PI - 0.05),
    open: true,
    line: { color: light, width: 0.45 },
  });
  out.push({
    type: 'poly',
    points: ellipseArc(x, cy, rx * 0.92, ry * 0.75, Math.PI + 0.25, TAU - 0.25),
    open: true,
    line: { color: 0xeafcff, width: 0.35 + 0.2 * pulse, alpha: 0.6 + 0.4 * pulse },
  });
  for (const side of [-1, 1]) {
    const phase = (frame + (side > 0 ? 6 : 0)) % 12;
    const z = Math.sin((Math.PI * phase) / 12) * s;
    if (z < 0.15) continue;
    out.push({
      type: 'poly',
      points: twinkle(x + side * rx * 0.55, cy - 1.2, 1.5 * z, 1.5 * z, 0.25 * z, 0),
      fill: { color: 0xffffff },
      line: { color: dark, width: 0.18 },
    });
  }
  return out;
}

function ellipseArc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  steps = 12,
): number[] {
  const pts: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return pts;
}
