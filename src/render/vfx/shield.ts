import { rand, seedOf, signed } from './random';
import { arcBand, clamp01, easeOut, lerp, mix, star, TAU, type Shape } from './shapes';

/** A shield event's lasting effect: the bubble's flash and wobble after a hit, or the shatter of a break. */
export interface ShieldBurst {
  kind: 'hit' | 'break';
  frame: number;
  port: number;
  /** Break: the bubble's centre and full radius (world units, y up). */
  x: number;
  y: number;
  r: number;
  /** Hit: how hard the hit was (0 to 1). */
  power: number;
  seed: number;
}

export const SHIELD_HIT_LIFE = 12;
export const SHIELD_BREAK_LIFE = 36;

export const shieldLife = (b: ShieldBurst): number =>
  b.kind === 'hit' ? SHIELD_HIT_LIFE : SHIELD_BREAK_LIFE;

export function spawnShieldHit(port: number, frame: number, damage: number): ShieldBurst {
  return {
    kind: 'hit',
    frame,
    port,
    x: 0,
    y: 0,
    r: 0,
    power: clamp01(damage / 20),
    seed: seedOf(frame, port, 5),
  };
}

export function spawnShieldBreak(port: number, frame: number, x: number, y: number, r: number): ShieldBurst {
  return { kind: 'break', frame, port, x, y, r, power: 1, seed: seedOf(frame, port, 6) };
}

/**
 * Ultimate's shield bubble as flat Flash layers: a translucent port-coloured sphere that thickens toward a bright
 * rim, a dark outline, a white crescent highlight. A recent hit (`hit`, frames since it landed) flashes it white
 * and makes it wobble. Centre (`cx`, `cy`) in the fighter's space, y down.
 */
export function shieldBubbleShapes(
  cx: number,
  cy: number,
  r: number,
  color: number,
  frame: number,
  hit?: { age: number; power: number },
): Shape[] {
  const flash = hit && hit.age < SHIELD_HIT_LIFE ? 1 - hit.age / SHIELD_HIT_LIFE : 0;
  const wobble = hit ? 0.1 * (0.5 + hit.power) * Math.sin(hit.age * 1.9) * Math.exp(-hit.age / 4) : 0;
  const breathe = 0.012 * Math.sin(frame * 0.21);
  const rx = r * (1 + breathe + wobble);
  const ry = r * (1 + breathe - wobble * 0.8);
  const light = mix(color, 0xffffff, 0.45);
  const out: Shape[] = [
    { type: 'ellipse', x: cx, y: cy, rx, ry, fill: { color, alpha: 0.5 } },
    {
      type: 'ellipse',
      x: cx,
      y: cy,
      rx: rx * 0.87,
      ry: ry * 0.87,
      line: { color, width: r * 0.26, alpha: 0.6 },
    },
    {
      type: 'ellipse',
      x: cx,
      y: cy,
      rx: rx * 0.95,
      ry: ry * 0.95,
      line: { color: mix(light, 0xffffff, flash), width: r * 0.1, alpha: 0.95 },
    },
    {
      type: 'ellipse',
      x: cx,
      y: cy,
      rx,
      ry,
      line: { color: mix(color, 0x000000, 0.55), width: 0.28, alpha: 0.9 },
    },
    {
      type: 'poly',
      points: ellipseBand(cx, cy, rx, ry, 0.6, 0.76, -2.75, -1.75),
      fill: { color: 0xffffff, alpha: 0.85 },
    },
    {
      type: 'circle',
      x: cx + Math.cos(-2.95) * rx * 0.66,
      y: cy + Math.sin(-2.95) * ry * 0.66,
      r: r * 0.06,
      fill: { color: 0xffffff, alpha: 0.85 },
    },
    {
      type: 'poly',
      points: ellipseBand(cx, cy, rx, ry, 0.74, 0.9, 0.6, 2.5),
      fill: { color: 0xffffff, alpha: 0.5 },
    },
  ];
  if (flash > 0) {
    out.push({
      type: 'ellipse',
      x: cx,
      y: cy,
      rx,
      ry,
      fill: { color: 0xffffff, alpha: 0.7 * flash * flash },
    });
    const t = 1 - flash;
    out.push({
      type: 'ellipse',
      x: cx,
      y: cy,
      rx: rx * (1 + 0.35 * easeOut(t)),
      ry: ry * (1 + 0.35 * easeOut(t)),
      line: { color: 0xffffff, width: r * 0.12 * flash, alpha: flash },
    });
  }
  return out;
}

function ellipseBand(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  k0: number,
  k1: number,
  a0: number,
  a1: number,
): number[] {
  const pts = arcBand(0, 0, k0, k1, a0, a1);
  for (let i = 0; i < pts.length; i += 2) {
    pts[i] = cx + pts[i]! * rx;
    pts[i + 1] = cy + pts[i + 1]! * ry;
  }
  return pts;
}

/** A broken shield shattering: a white flash and shockwave, a spiky burst, and glassy shards flung out and falling. */
export function shieldBreakShapes(b: ShieldBurst, color: number, frame: number): Shape[] {
  const age = frame - b.frame;
  if (b.kind !== 'break' || age < 0 || age >= SHIELD_BREAK_LIFE) return [];
  const cx = b.x;
  const cy = -b.y;
  const dark = mix(color, 0x000000, 0.55);
  const light = mix(color, 0xffffff, 0.55);
  const out: Shape[] = [];
  if (age < 12) {
    const k = age < 3 ? 0.7 + 0.15 * age : 1.15 * (1 - (age - 3) / 9);
    out.push({
      type: 'poly',
      points: star(
        cx,
        cy,
        14,
        (i) => b.r * 1.5 * k * (i % 2 ? 0.7 : 1) * (0.85 + 0.15 * rand(b.seed, i)),
        b.r * 0.5 * k,
        rand(b.seed, 99) * TAU,
      ),
      fill: { color: light },
      line: { color: dark, width: 0.35 },
    });
    out.push({
      type: 'poly',
      points: star(
        cx,
        cy,
        14,
        (i) => b.r * 0.95 * k * (i % 2 ? 0.7 : 1),
        b.r * 0.35 * k,
        rand(b.seed, 98) * TAU,
      ),
      fill: { color: 0xffffff },
    });
  }
  const n = 14;
  const t = age / SHIELD_BREAK_LIFE;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + signed(b.seed, 10 + i) * 0.25;
    const speed = b.r * (0.09 + 0.08 * rand(b.seed, 20 + i));
    const dist = b.r * 0.55 + speed * age * (1 - age / (2.4 * SHIELD_BREAK_LIFE));
    const x = cx + Math.cos(a) * dist;
    const y = cy + Math.sin(a) * dist + 0.018 * age * age;
    const size = b.r * lerp(0.16, 0.3, rand(b.seed, 30 + i)) * (1 - clamp01((t - 0.55) / 0.45));
    if (size < 0.1) continue;
    const spin = a + age * signed(b.seed, 40 + i) * 0.3;
    const pts: number[] = [];
    for (let k = 0; k < 3; k++) {
      const ang = spin + (k / 3) * TAU + signed(b.seed, 50 + i * 3 + k) * 0.5;
      const rr = size * (k === 0 ? 1.4 : 0.8);
      pts.push(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    out.push({
      type: 'poly',
      points: pts,
      fill: { color: i % 3 ? light : color, alpha: 0.9 },
      line: { color: dark, width: 0.22 },
    });
  }
  if (age < 3)
    out.push({
      type: 'circle',
      x: cx,
      y: cy,
      r: b.r * (1 + 0.2 * age),
      fill: { color: 0xffffff, alpha: 0.9 - 0.25 * age },
    });
  if (age < 14) {
    const k = age / 14;
    out.push({
      type: 'circle',
      x: cx,
      y: cy,
      r: b.r * (1 + 1.4 * easeOut(k)),
      line: { color: 0xffffff, width: b.r * 0.2 * (1 - k), alpha: 1 - k * k },
    });
  }
  return out;
}
