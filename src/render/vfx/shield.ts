import { rand, seedOf, signed } from './random';
import { arcBand, blade, clamp01, easeOut, lerp, mix, TAU, type Shape } from './shapes';

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

export const SHIELD_HIT_LIFE = 6;
export const SHIELD_BREAK_LIFE = 22;
/** A shield at 0 HP keeps this share of its full size, cracked and blinking, until it shatters from there. */
export const CRACKED_SHIELD = 0.45;

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
 * Ultimate's shield bubble as flat Flash layers: a port-coloured tint that deepens toward the edge, a soft glow
 * outside it, a bright rim in a lighter tint inside a dark port-shade outline, and one white highlight at 10-11 o'clock. A recent hit (`hit`, frames since it landed) fills it
 * white for 5 frames and sends one ripple out from the rim; a `cracked` (empty) shield blinks its rim and shows
 * two cracks. Centre (`cx`, `cy`) in the fighter's space, y down.
 */
export function shieldBubbleShapes(
  cx: number,
  cy: number,
  r: number,
  color: number,
  frame: number,
  hit?: { age: number; power: number },
  cracked = false,
): Shape[] {
  const rr = r * (1 + 0.012 * Math.sin(frame * 0.21));
  const rim = Math.max(0.3, r * 0.08);
  const dark = mix(color, 0x000000, 0.45);
  const rimColor = cracked && frame % 4 < 2 ? 0xffffff : mix(color, 0xffffff, 0.55);
  const out: Shape[] = [
    { type: 'ellipse', x: cx, y: cy, rx: rr, ry: rr, fill: { color, alpha: 0.34 } },
    { type: 'circle', x: cx, y: cy, r: rr + 0.45, line: { color, width: 0.9, alpha: 0.25 } },
    { type: 'circle', x: cx, y: cy, r: rr * 0.9, line: { color, width: rr * 0.2, alpha: 0.35 } },
    { type: 'circle', x: cx, y: cy, r: rr - rim / 2, line: { color: rimColor, width: rim, alpha: 0.9 } },
    { type: 'circle', x: cx, y: cy, r: rr, line: { color: dark, width: 0.22 } },
    {
      type: 'poly',
      points: arcBand(cx, cy, rr * 0.64, rr * 0.76, -2.75, -2.0),
      fill: { color: 0xffffff, alpha: 0.9 },
    },
  ];
  if (cracked)
    for (const a of [-0.7, 2.2]) {
      const pts: number[] = [];
      for (let k = 0; k < 4; k++) {
        const d = rr * (1 - 0.16 * k);
        const ak = a + (k % 2 ? 0.14 : -0.04);
        pts.push(cx + Math.cos(ak) * d, cy + Math.sin(ak) * d);
      }
      out.push({ type: 'poly', points: pts, open: true, line: { color: dark, width: 0.3 } });
    }
  if (hit && hit.age < 5)
    out.push({
      type: 'ellipse',
      x: cx,
      y: cy,
      rx: rr,
      ry: rr,
      fill: { color: 0xffffff, alpha: 0.8 * (1 - hit.age / 5) },
    });
  if (hit && hit.age < SHIELD_HIT_LIFE) {
    const t = hit.age / SHIELD_HIT_LIFE;
    out.push({
      type: 'circle',
      x: cx,
      y: cy,
      r: rr * (1 + 0.3 * easeOut(t)),
      line: { color: 0xffffff, width: rim * (1 - t) + 0.1, alpha: 1 - t },
    });
  }
  return out;
}

/**
 * A broken shield shattering from its cracked size: a white core that gives way within 3 frames to curved rim
 * shards and glassy splinters flung out and falling, spikes around (never over) the fighter, and a shockwave.
 */
export function shieldBreakShapes(b: ShieldBurst, color: number, frame: number): Shape[] {
  const age = frame - b.frame;
  if (b.kind !== 'break' || age < 0 || age >= SHIELD_BREAK_LIFE) return [];
  const cx = b.x;
  const cy = -b.y;
  const rim = b.r * CRACKED_SHIELD;
  const dark = mix(color, 0x000000, 0.55);
  const light = mix(color, 0xffffff, 0.5);
  const t = age / SHIELD_BREAK_LIFE;
  const fall = 0.04 * age * age;
  const out: Shape[] = [];
  if (age < 6) {
    const k = age < 2 ? 0.7 + 0.15 * age : 1 - (age - 2) / 4;
    const rot = rand(b.seed, 99) * TAU;
    for (let i = 0; i < 12; i++) {
      const a = rot + (i / 12) * TAU;
      const len = b.r * (i % 2 ? 0.45 : 0.75) * k * (0.85 + 0.3 * rand(b.seed, i));
      out.push({
        type: 'poly',
        points: blade(cx + Math.cos(a) * rim, cy + Math.sin(a) * rim, a, len, b.r * 0.22 * k, 1),
        fill: { color: i % 2 ? 0xffffff : light },
        line: { color: dark, width: 0.25 },
      });
    }
  }
  if (age < 3)
    out.push({
      type: 'circle',
      x: cx,
      y: cy,
      r: rim * (1 + 0.15 * age),
      fill: { color: 0xffffff, alpha: 0.95 - 0.3 * age },
    });
  const pieces = 7;
  const spin0 = rand(b.seed, 70) * TAU;
  for (let i = 0; i < pieces; i++) {
    const span = (TAU / pieces) * (0.7 + 0.2 * rand(b.seed, 60 + i));
    const a0 = spin0 + (i / pieces) * TAU;
    const mid = a0 + span / 2;
    const dist = b.r * (0.12 + 0.08 * rand(b.seed, 20 + i)) * age * (1 - age / (2 * SHIELD_BREAK_LIFE));
    const thick = Math.max(0.3, rim * 0.28) * (1 - clamp01((t - 0.5) / 0.5));
    if (thick < 0.08) continue;
    const turn = signed(b.seed, 40 + i) * 0.03 * age;
    out.push({
      type: 'poly',
      points: arcBand(
        cx + Math.cos(mid) * dist,
        cy + Math.sin(mid) * dist + fall,
        rim - thick,
        rim,
        a0 + turn,
        a0 + span + turn,
        6,
      ),
      fill: { color: light, alpha: 0.95 },
      line: { color: dark, width: 0.22 },
    });
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + signed(b.seed, 10 + i) * 0.3;
    const dist = rim + b.r * (0.16 + 0.1 * rand(b.seed, 30 + i)) * age * (1 - age / (2 * SHIELD_BREAK_LIFE));
    const x = cx + Math.cos(a) * dist;
    const y = cy + Math.sin(a) * dist + fall;
    const size = b.r * lerp(0.1, 0.2, rand(b.seed, 50 + i)) * (1 - clamp01((t - 0.55) / 0.45));
    if (size < 0.1) continue;
    const spin = a + age * signed(b.seed, 80 + i) * 0.3;
    const pts: number[] = [];
    for (let k = 0; k < 3; k++) {
      const ang = spin + (k / 3) * TAU + signed(b.seed, 90 + i * 3 + k) * 0.5;
      const d = size * (k === 0 ? 1.4 : 0.8);
      pts.push(x + Math.cos(ang) * d, y + Math.sin(ang) * d);
    }
    out.push({
      type: 'poly',
      points: pts,
      fill: { color: i % 3 ? light : color, alpha: 0.9 },
      line: { color: dark, width: 0.2 },
    });
  }
  if (age < 8) {
    const k = age / 8;
    out.push({
      type: 'circle',
      x: cx,
      y: cy,
      r: rim + b.r * 1.3 * easeOut(k),
      line: { color: 0xffffff, width: b.r * 0.08 * (1 - k), alpha: 0.8 * (1 - k) },
    });
  }
  return out;
}
