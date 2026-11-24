import type { FighterState } from '../../sim/fighter';
import { rand, seedOf, signed } from './random';
import { blade, clamp01, lerp, type Shape } from './shapes';

/**
 * A cartoon smoke or dust puff. `born` is fractional: the puffs laid along one frame's stretch of a launch path
 * are born at the sub-frame times the fighter passed them, so a trail reads as one continuous stream.
 */
export interface Puff {
  born: number;
  /** World units, y up. */
  x: number;
  y: number;
  /** Drift in units per frame, slowing to a stop over the puff's life. */
  vx: number;
  vy: number;
  r: number;
  life: number;
  tone: PuffTone;
  seed: number;
}

export type PuffTone = 'smoke' | 'dust';

/** Flash-style two-tone clouds: dark rim, mid body, light top-left lobe. */
const TONES: Record<PuffTone, { rim: number; body: number; light: number }> = {
  smoke: { rim: 0x6c7387, body: 0xc0c6d3, light: 0xf8f9fc },
  dust: { rim: 0x7f7562, body: 0xd2c8b3, light: 0xf6f1e4 },
};

/** Launch speed (units per frame of knockback) where the smoke trail starts and where it is at its densest. */
export const TRAIL_MIN_SPEED = 2.4;
export const TRAIL_FULL_SPEED = 7;
/** Launch speed past which coloured speed lines streak behind the fighter. */
export const STREAK_SPEED = 5.5;
const MAX_PUFFS_PER_FRAME = 48;

export function launchSpeed(f: FighterState): number {
  return Math.hypot(f.kb.x, f.kb.y);
}

/** Is `f` flying from a strong launch this frame (tumbling, out of hitlag, fast enough to smoke)? */
export function launched(f: FighterState): boolean {
  return f.action === 'tumble' && f.hitlag === 0 && f.actionFrame >= 1 && launchSpeed(f) >= TRAIL_MIN_SPEED;
}

/**
 * Launch smoke left along this frame's path from `prevPos` to `pos` (at body height `mid`): denser, bigger and
 * longer-lived the faster the launch.
 */
export function trailPuffs(f: FighterState, mid: number, frame: number): Puff[] {
  if (!launched(f)) return [];
  const s = clamp01((launchSpeed(f) - TRAIL_MIN_SPEED) / (TRAIL_FULL_SPEED - TRAIL_MIN_SPEED));
  const r = lerp(2.3, 4.4, s);
  const dx = f.pos.x - f.prevPos.x;
  const dy = f.pos.y - f.prevPos.y;
  const dist = Math.hypot(dx, dy);
  const n = Math.min(MAX_PUFFS_PER_FRAME, Math.max(1, Math.ceil(dist / (r * lerp(0.75, 0.5, s)))));
  const nx = dist > 0 ? -dy / dist : 0;
  const ny = dist > 0 ? dx / dist : 1;
  const seed = seedOf(frame, f.port, 2);
  const puffs: Puff[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 1) / n;
    const side = signed(seed, i) * r * 0.5;
    const drift = signed(seed, 100 + i) * 0.04;
    puffs.push({
      born: frame - 1 + u,
      x: f.prevPos.x + dx * u + nx * side,
      y: f.prevPos.y + dy * u + mid + ny * side,
      vx: nx * drift,
      vy: ny * drift + 0.015,
      r: r * (0.65 + 0.6 * rand(seed, 200 + i)),
      life: Math.round(lerp(28, 54, s) * (0.85 + 0.3 * rand(seed, 300 + i))),
      tone: 'smoke',
      seed: seedOf(frame, f.port, 1000 + i),
    });
  }
  return puffs;
}

/** Dust kicked out sideways at the feet (`x`, `y`): `n` puffs per side, `spread` units per frame. */
export function dustPuffs(
  x: number,
  y: number,
  frame: number,
  port: number,
  n: number,
  spread: number,
  r: number,
): Puff[] {
  const seed = seedOf(frame, port, 3);
  const puffs: Puff[] = [];
  for (let i = 0; i < n * 2; i++) {
    const side = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    puffs.push({
      born: frame,
      x: x + side * (2 + k * 1.8),
      y: y + 0.6,
      vx: side * spread * (0.7 + 0.5 * rand(seed, i)) * (1 - k * 0.25),
      vy: 0.04 + 0.05 * rand(seed, 50 + i),
      r: r * (1 - k * 0.2) * (0.85 + 0.3 * rand(seed, 100 + i)),
      life: Math.round(18 + 8 * rand(seed, 150 + i)),
      tone: 'dust',
      seed: seedOf(frame, port, 2000 + i),
    });
  }
  return puffs;
}

/** Puff radius over its life: swell quickly, hold, then shrink away to nothing (cartoon smoke breaks up, never fades). */
function puffRadius(p: Puff, age: number): number {
  const t = age / p.life;
  if (t < 0.18) return p.r * (0.65 + 0.35 * (t / 0.18));
  return p.r * (1 + 0.15 * (t - 0.18)) * (1 - clamp01((t - 0.35) / 0.65) ** 1.6);
}

/**
 * Every live puff at `frame` in three passes (rims, bodies, light lobes), so overlapping puffs merge into one cloud
 * with a single outline around the whole silhouette.
 */
export function puffShapes(puffs: readonly Puff[], frame: number): Shape[] {
  const live: { x: number; y: number; r: number; tone: PuffTone }[] = [];
  for (const p of puffs) {
    const age = frame - p.born;
    if (age < 0 || age >= p.life) continue;
    const r = puffRadius(p, age);
    if (r < 0.08) continue;
    const slow = age * (1 - age / (2 * p.life));
    live.push({ x: p.x + p.vx * slow, y: -(p.y + p.vy * slow), r, tone: p.tone });
  }
  const out: Shape[] = [];
  for (const q of live)
    out.push({ type: 'circle', x: q.x, y: q.y, r: q.r + 0.32, fill: { color: TONES[q.tone].rim } });
  for (const q of live)
    out.push({ type: 'circle', x: q.x, y: q.y, r: q.r, fill: { color: TONES[q.tone].body } });
  for (const q of live)
    out.push({
      type: 'circle',
      x: q.x - q.r * 0.2,
      y: q.y - q.r * 0.26,
      r: q.r * 0.68,
      fill: { color: TONES[q.tone].light },
    });
  return out;
}

/**
 * Ultimate's speed lines on a very fast launch: thin port-coloured and white streaks trailing the fighter drawn at
 * (`x`, `y`) (y down, body centre), flickering every other frame.
 */
export function speedLineShapes(
  f: FighterState,
  x: number,
  y: number,
  color: number,
  frame: number,
): Shape[] {
  if (!launched(f) || launchSpeed(f) < STREAK_SPEED) return [];
  const sp = launchSpeed(f);
  const back = Math.atan2(f.kb.y, -f.kb.x);
  const seed = seedOf(frame >> 1, f.port, 4);
  const out: Shape[] = [];
  for (let i = 0; i < 6; i++) {
    const off = signed(seed, i) * 6;
    const start = 2 + 4 * rand(seed, 10 + i);
    const len = (14 + 22 * rand(seed, 20 + i)) * clamp01(sp / TRAIL_FULL_SPEED + 0.3);
    const px = x - Math.sin(back) * off + Math.cos(back) * start;
    const py = y + Math.cos(back) * off + Math.sin(back) * start;
    out.push({
      type: 'poly',
      points: blade(px, py, back, len, i % 3 === 0 ? 0.9 : 0.55, 1),
      fill: { color: i % 2 ? 0xffffff : color },
      line: { color: 0x1d1d2b, width: 0.12, alpha: 0.6 },
    });
  }
  return out;
}
