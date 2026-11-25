import type { SimEvent } from '../../sim/events';
import { rand, seedOf, signed } from './random';
import { blade, clamp01, easeOut, lerp, star, TAU, twinkle, type Shape } from './shapes';

type HitEvent = Extract<SimEvent, { type: 'hit' }>;

export type SparkStyle = 'normal' | 'fire' | 'electric' | 'shield';

/** One hit spark, spawned from a `hit` (or `shieldHit`) event. Positions are world units, y up. */
export interface HitSpark {
  frame: number;
  x: number;
  y: number;
  /** 0 for the weakest poke, 1 for a strong launch: drives size, layers, streaks and debris. */
  power: number;
  /** Burst radius in world units. */
  size: number;
  life: number;
  style: SparkStyle;
  /** Direction the victim is sent (radians, y down); the streaks lean that way. */
  lean: number;
  seed: number;
}

interface SparkPalette {
  outer: number;
  mid: number;
  core: number;
  line: number;
  ring: number;
}

/** Ultimate's colours drawn as flat Flash fills: white-yellow stars, orange-red flame, blue-white shield clang. */
const PALETTES: Record<SparkStyle, SparkPalette> = {
  normal: { outer: 0xff9419, mid: 0xffe23c, core: 0xffffff, line: 0x5e2600, ring: 0xffffff },
  electric: { outer: 0xffd21c, mid: 0xfff8a0, core: 0xffffff, line: 0x24307a, ring: 0xf2fbff },
  fire: { outer: 0xe5321b, mid: 0xff8f1f, core: 0xffe44d, line: 0x4f0a00, ring: 0xfff0b0 },
  shield: { outer: 0x8fdcff, mid: 0xe4f8ff, core: 0xffffff, line: 0x1c4d8a, ring: 0xffffff },
};

/** Hit strength in [0, 1] from knockback and damage: ~0.1 for a jab, ~0.4 for a smash at 0%, 1 for a kill launch. */
export function hitPower(kb: number, damage: number): number {
  return clamp01(Math.max((kb - 30) / 170, (damage - 2) / 30));
}

export function spawnHitSpark(
  e: Pick<HitEvent, 'x' | 'y' | 'kb' | 'damage' | 'effect' | 'attacker' | 'victim'>,
  frame: number,
  lean: number,
  style: SparkStyle = e.effect,
): HitSpark {
  const power = hitPower(e.kb, e.damage);
  return {
    frame,
    x: e.x,
    y: e.y,
    power,
    size: lerp(3, 6.2, power),
    life: Math.round(lerp(10, 22, power)),
    style,
    lean,
    seed: seedOf(frame, e.attacker * 8 + e.victim, 1),
  };
}

/** Pop in past full size, settle, then shrink toward the end of the spark's life. */
function pop(age: number, life: number): number {
  if (age < 2) return 0.6 + 0.28 * age;
  if (age < 4) return 1.16 - 0.08 * (age - 2);
  return 1 - 0.75 * clamp01((age - 4) / Math.max(1, life - 4)) ** 0.9;
}

/** The spark's shapes at `frame` (world units, y down); empty outside its life. */
export function hitSparkShapes(s: HitSpark, frame: number): Shape[] {
  const age = frame - s.frame;
  if (age < 0 || age >= s.life) return [];
  const p = PALETTES[s.style];
  const cx = s.x - Math.cos(s.lean) * s.size * 0.2;
  const cy = -s.y - Math.sin(s.lean) * s.size * 0.2;
  const R = s.size * pop(age, s.life);
  const lw = lerp(0.2, 0.38, s.power);
  const out: Shape[] = [];
  if (age < 2) {
    contact(out, s, age, cx, cy, p, lw);
    return out;
  }

  if (s.power >= 0.45) streaks(out, s, age, cx, cy, p, lw);
  if (s.style === 'fire') flames(out, s, age, cx, cy, R, p, lw);
  else burst(out, s, age, cx, cy, R, p, lw);
  debris(out, s, age, cx, cy, p, lw);

  const ringLife = 6 + Math.round(4 * s.power);
  if (s.style !== 'shield' && s.power >= 0.4 && age - 2 < ringLife) {
    const t = (age - 2) / ringLife;
    const r = s.size * (0.7 + 0.8 * easeOut(t));
    for (const side of [1, -1]) {
      const mid = s.lean + (side * Math.PI) / 2;
      const pts: number[] = [];
      for (let k = 0; k <= 8; k++) {
        const a = mid + ((k - 4) / 4) * 0.8;
        pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      out.push({
        type: 'poly',
        points: pts,
        open: true,
        line: { color: p.ring, width: s.size * lerp(0.1, 0.02, t), alpha: 0.6 * (1 - t * t) },
      });
    }
  }
  return out;
}

/**
 * The first two frames of contact: one white (then cream) 8-point star with only an outer outline, and short white
 * streaks bursting out along the launch direction. The burst takes over on frame 2.
 */
function contact(
  out: Shape[],
  s: HitSpark,
  age: number,
  cx: number,
  cy: number,
  p: SparkPalette,
  lw: number,
) {
  const R = s.size * (1 + 0.15 * age);
  for (let i = 0; i < 7; i++) {
    const a = s.lean + signed(s.seed, 120 + i) * 0.9;
    const from = R * (0.55 + 0.1 * age);
    out.push({
      type: 'poly',
      points: blade(
        cx + Math.cos(a) * from,
        cy + Math.sin(a) * from,
        a,
        R * (0.6 + 0.5 * rand(s.seed, 130 + i)) * (1 + 0.5 * age),
        s.size * 0.14,
        1,
      ),
      fill: { color: 0xffffff },
      line: { color: p.line, width: lw * 0.5 },
    });
  }
  out.push({
    type: 'poly',
    points: star(cx, cy, 8, (i) => R * (i % 2 ? 0.6 : 1), R * 0.38, s.lean),
    fill: { color: age === 0 ? 0xffffff : 0xfff6c8 },
    line: { color: p.line, width: lw },
  });
}

/** Layered star: outlined outer spikes, a lighter middle star and a white core (one layer fewer for weak hits). */
function burst(
  out: Shape[],
  s: HitSpark,
  age: number,
  cx: number,
  cy: number,
  R: number,
  p: SparkPalette,
  lw: number,
) {
  const n = 8 + Math.round(5 * s.power);
  const rot = rand(s.seed, 1) * TAU + age * 0.02;
  const spike = (i: number) => (i % 2 === 0 ? 1 : 0.72) * (0.82 + 0.18 * rand(s.seed, 10 + i));
  const strong = s.power >= 0.3;
  const layers: [scale: number, inner: number, color: number][] = strong
    ? [
        [1, 0.42, p.outer],
        [0.74, 0.32, p.mid],
        [0.44, 0.2, p.core],
      ]
    : [
        [0.9, 0.38, p.mid],
        [0.5, 0.22, p.core],
      ];
  layers.forEach(([k, inner, color], j) => {
    out.push({
      type: 'poly',
      points: star(cx, cy, n, (i) => R * k * spike(i), R * inner, rot + j * 0.08),
      fill: { color },
      ...(j === 0 ? { line: { color: p.line, width: lw } } : {}),
    });
  });
}

/** Fire: curling flame tongues around a hot core, outlined only on the silhouette, with rising embers. */
function flames(
  out: Shape[],
  s: HitSpark,
  age: number,
  cx: number,
  cy: number,
  R: number,
  p: SparkPalette,
  lw: number,
) {
  const n = 7 + Math.round(4 * s.power);
  const rot = rand(s.seed, 1) * TAU + age * 0.05;
  const flicker = Math.floor(age / 2);
  const tongue = (i: number, k: number) => {
    const a = rot + (i / n) * TAU + signed(s.seed, 20 + i) * 0.2;
    const len =
      R * k * (0.78 + 0.22 * rand(s.seed, 30 + i)) * (0.9 + 0.1 * rand(s.seed, 200 + i * 31 + flicker));
    return blade(cx + Math.cos(a) * R * 0.1, cy + Math.sin(a) * R * 0.1, a, len, R * k * 0.62, 1.25, 0.32);
  };
  const layer = (k: number, core: number, fill: number, line?: number) => {
    const shapes: Shape[] = [];
    for (let i = 0; i < n; i++) shapes.push({ type: 'poly', points: tongue(i, k), fill: { color: fill } });
    shapes.push({ type: 'circle', x: cx, y: cy, r: R * core, fill: { color: fill } });
    if (line !== undefined)
      for (const sh of shapes)
        out.push({ ...sh, fill: { color: line }, line: { color: line, width: lw * 2 } });
    out.push(...shapes);
  };
  layer(1, 0.46, p.outer, p.line);
  layer(0.7, 0.34, p.mid);
  layer(0.42, 0.22, p.core);
  out.push({ type: 'circle', x: cx, y: cy, r: R * 0.13, fill: { color: 0xffffff } });
}

/** Long streaks shooting out of strong hits, leaning toward the launch, their tails chasing their heads. */
function streaks(
  out: Shape[],
  s: HitSpark,
  age: number,
  cx: number,
  cy: number,
  p: SparkPalette,
  lw: number,
) {
  const n = 4 + Math.round(5 * s.power);
  for (let i = 0; i < n; i++) {
    const a = i < n / 2 ? s.lean + signed(s.seed, 50 + i) * 0.75 : rand(s.seed, 50 + i) * TAU;
    const reach = s.size * (1.3 + 0.8 * rand(s.seed, 60 + i));
    const head = reach * easeOut(age / 4);
    const tail = s.size * 0.3 + Math.max(0, age - 2) * reach * 0.16;
    if (tail >= head - 0.5) continue;
    const width = s.size * lerp(0.16, 0.24, rand(s.seed, 70 + i));
    out.push({
      type: 'poly',
      points: blade(cx + Math.cos(a) * tail, cy + Math.sin(a) * tail, a, head - tail, width, 1.1),
      fill: { color: s.style === 'fire' ? p.core : p.mid },
      line: { color: p.line, width: lw * 0.7 },
    });
  }
}

/** Small diamonds (embers for fire) flung outward, slowing down. */
function debris(out: Shape[], s: HitSpark, age: number, cx: number, cy: number, p: SparkPalette, lw: number) {
  const n = 3 + Math.round(7 * s.power);
  const life = s.life * 0.85;
  if (age >= life) return;
  const t = age / life;
  for (let i = 0; i < n; i++) {
    const a = rand(s.seed, 80 + i) * TAU;
    const dist = s.size * (0.5 + (0.8 + 0.9 * rand(s.seed, 90 + i)) * easeOut(t * 1.4));
    const x = cx + Math.cos(a) * dist;
    const y = cy + Math.sin(a) * dist - (s.style === 'fire' ? s.size * 0.5 * t * t : 0);
    const len = Math.max(0.7, s.size * lerp(0.14, 0.24, rand(s.seed, 100 + i))) * (1 - t * t);
    if (len < 0.3) continue;
    out.push({
      type: 'poly',
      points: twinkle(x, y, len, len * 0.42, len * 0.16, a),
      fill: { color: i % 2 ? p.mid : p.core },
      line: { color: p.line, width: Math.min(lw * 0.55, len * 0.14) },
    });
  }
}
