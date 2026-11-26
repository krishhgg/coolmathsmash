import { ease } from '../../../render/rig/sample';
import type { AnimClip, BonePose, Ease, Key } from '../../../render/rig/types';
import { tipSpeed } from '../tipping';
import { HALF_H, HALF_W, bevelName } from './symbols';

/**
 * Authoring for Bloxorz block's clips. A clip is written as a function from frame to where the block is drawn
 * (`Place`) plus its effects, and baked into one key per frame, so a tip can follow the simulation exactly and
 * every frame gets the bevel drawn for its angle. Rig space: y down, feet at the origin, facing right; turns are
 * degrees, clockwise on screen (a forward tip is positive).
 */

export interface Form {
  /** The block's own turn in this form: 0 standing, 90 lying. */
  base: 0 | 90;
  /** Half its width and height on screen at rest. */
  hw: number;
  hh: number;
}

export const STAND: Form = { base: 0, hw: HALF_W, hh: HALF_H };
export const LIE: Form = { base: 90, hw: HALF_H, hh: HALF_W };
export const other = (form: Form): Form => (form === STAND ? LIE : STAND);

/** Where the block is drawn: a turn of `rot` about the pivot (px, py), the block's centre (ox, oy) from it. */
export interface Place {
  px: number;
  py: number;
  rot: number;
  ox: number;
  oy: number;
  /** The block's own turn (its form's base, plus any extra). */
  base: number;
  /** Squash and stretch along the block's own axes: sx across it, sy along its length. */
  sx: number;
  sy: number;
}

export interface Opts {
  x?: number;
  lift?: number;
  sx?: number;
  sy?: number;
}

/** Squash in screen terms for a block at rest in `form`: `h` across the screen, `v` up it. */
export function squash(form: Form, h: number, v: number): { sx: number; sy: number } {
  return form.base === 0 ? { sx: h, sy: v } : { sx: v, sy: h };
}

/** Half extents of `form` on screen with the given squash. */
function extents(form: Form, sx: number, sy: number): [number, number] {
  return form.base === 0 ? [HALF_W * sx, HALF_H * sy] : [HALF_H * sy, HALF_W * sx];
}

/**
 * The block of `form` turned `deg` about its bottom edge on `side` (1 its front edge, -1 its back edge), `deg`
 * >= 0 tipping it towards that side. This is how a block tips, rocks and topples.
 */
export function edge(form: Form, side: 1 | -1, deg: number, o: Opts = {}): Place {
  const sx = o.sx ?? 1;
  const sy = o.sy ?? 1;
  const [a, b] = extents(form, sx, sy);
  return {
    px: (o.x ?? 0) + side * a,
    py: -(o.lift ?? 0),
    rot: side * deg,
    ox: -side * a,
    oy: -b,
    base: form.base,
    sx,
    sy,
  };
}

/** Rocking: positive `deg` tips it onto its front edge, negative onto its back edge. */
export const rock = (form: Form, deg: number, o: Opts = {}): Place =>
  deg >= 0 ? edge(form, 1, deg, o) : edge(form, -1, -deg, o);

/** At rest in `form`, standing on the floor (or `lift` above it). */
export const rest = (form: Form, o: Opts = {}): Place => edge(form, 1, 0, o);

/** Turned `deg` about its own centre at (x, y). */
export function spin(form: Form, x: number, y: number, deg: number, o: Opts = {}): Place {
  return { px: x, py: y, rot: deg, ox: 0, oy: 0, base: form.base, sx: o.sx ?? 1, sy: o.sy ?? 1 };
}

/** Turned `deg` about its centre, standing on the floor with its centre at `x`: a turn in place. */
export function ground(form: Form, deg: number, o: Opts = {}): Place {
  const sx = o.sx ?? 1;
  const sy = o.sy ?? 1;
  const r = ((form.base + deg) * Math.PI) / 180;
  const low = HALF_W * sx * Math.abs(Math.sin(r)) + HALF_H * sy * Math.abs(Math.cos(r));
  return spin(form, o.x ?? 0, -low - (o.lift ?? 0), deg, { sx, sy });
}

/** The block's centre in rig space. */
export function centre(p: Place): [number, number] {
  const r = (p.rot * Math.PI) / 180;
  return [p.px + p.ox * Math.cos(r) - p.oy * Math.sin(r), p.py + p.ox * Math.sin(r) + p.oy * Math.cos(r)];
}

/** Moves the whole place. */
export const shift = (p: Place, dx: number, dy = 0): Place => ({ ...p, px: p.px + dx, py: p.py + dy });

/** Turns the whole place `deg` about the point (qx, qy). */
export function about(p: Place, qx: number, qy: number, deg: number): Place {
  const r = (deg * Math.PI) / 180;
  const dx = p.px - qx;
  const dy = p.py - qy;
  return {
    ...p,
    px: qx + dx * Math.cos(r) - dy * Math.sin(r),
    py: qy + dx * Math.sin(r) + dy * Math.cos(r),
    rot: p.rot + deg,
  };
}

/** In between two places, by their centres, turns and squash (for moves that change pivot). */
export function blend(a: Place, b: Place, u: number): Place {
  const [ax, ay] = centre(a);
  const [bx, by] = centre(b);
  const lerp = (x: number, y: number) => x + (y - x) * u;
  const turn = lerp(a.rot + a.base, b.rot + b.base);
  return {
    px: lerp(ax, bx),
    py: lerp(ay, by),
    rot: turn - a.base,
    ox: 0,
    oy: 0,
    base: a.base,
    sx: lerp(a.sx, b.sx),
    sy: lerp(a.sy, b.sy),
  };
}

/** Value at frame `f` of a keyed track: [frame, value, ease to the next key]. */
export type Track = [number, number, Ease?][];
export function tl(f: number, keys: Track): number {
  const first = keys[0]!;
  if (f <= first[0]) return first[1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0, e = 'inOut'] = keys[i]!;
    const [f1, v1] = keys[i + 1]!;
    if (f <= f1) return v0 + (v1 - v0) * ease(e, (f - f0) / (f1 - f0 || 1));
  }
  return keys[keys.length - 1]![1];
}

/** How far the simulation has moved the block `t` frames into a tip lasting `frames` (tip.ts's tipFrame). */
export function tipOffset(t: number, frames: number): number {
  let x = 0;
  for (let k = 0; k <= Math.min(t, frames - 1); k++) x += tipSpeed(k, frames);
  return x;
}

/**
 * A block of `from` tipping forward over its leading bottom edge, drawn relative to the fighter's origin once the
 * simulation has moved it `offset` units from where the tip began. The pivot stays on the floor where the tip
 * began and the turn is solved so the block's centre sits on the origin: a - a cos t + b sin t = offset.
 */
export function tip(from: Form, offset: number): Place {
  const { hw: a, hh: b } = from;
  let lo = 0;
  let hi = Math.PI / 2;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (a - a * Math.cos(mid) + b * Math.sin(mid) < offset) lo = mid;
    else hi = mid;
  }
  return edge(from, 1, (((lo + hi) / 2) * 180) / Math.PI, { x: -offset });
}

/**
 * Frame `t` (from 0) of a tip lasting `frames`, drawn by `form`'s art: the simulation flips the form at the
 * balance point, so the first half is `form` tipping away and the second half the other form tipping onto it.
 */
export function tipFrame(form: Form, t: number, frames: number): Place {
  const from = t < Math.floor(frames / 2) ? form : other(form);
  return tip(from, tipOffset(t, frames));
}

/** The settle after a heavy landing, `k` frames after it: squash, overshoot, rest. */
export function settle(form: Form, k: number, o: Opts = {}, amount = 1): Place {
  const v =
    1 -
    amount *
      tl(k, [
        [0, 0.1, 'out'],
        [2, -0.025, 'inOut'],
        [5, 0.008],
        [7, 0],
      ]);
  return rest(form, { ...o, ...squash(form, 1 + (1 - v) * 0.45, v) });
}

export interface Fx {
  sym: string;
  x: number;
  y: number;
  rot?: number;
  sx?: number;
  sy?: number;
}

export type FxSlot = 'back' | 'dustA' | 'dustB' | 'hitA' | 'hitB' | 'starA' | 'starB';
const FX_BONES: Record<FxSlot, string> = {
  back: 'fx1',
  dustA: 'fx2',
  dustB: 'fx3',
  hitA: 'fx4',
  hitB: 'fx5',
  starA: 'fx6',
  starB: 'fx7',
};

/** A cube of the split block (taunt): centre, turn and squash. */
export interface Cube {
  x: number;
  y: number;
  rot: number;
  sx?: number;
  sy?: number;
}

export interface Frame {
  block: Place;
  fx?: Partial<Record<FxSlot, Fx | undefined>>;
  /** Shown instead of the block: the two cubes it splits into. */
  cubes?: [Cube, Cube];
  /** Bones and slots outside the block and its effects (the Final Smash's level tiles), posed as given. */
  extra?: { pose: Record<string, BonePose>; swaps: Record<string, string | null> };
}

/** A dust puff `age` frames old, lasting `life`: it swells, drifts away along `dir` and shrinks to nothing. */
export function puff(x: number, y: number, age: number, dir: 1 | -1, size = 1, life = 12): Fx | undefined {
  if (age < 0 || age >= life) return undefined;
  const s = size * (age < 3 ? 0.55 + age * 0.2 : 1.15 * (1 - (age - 3) / (life - 3)) + 0.05);
  return { sym: 'dust', x: x + dir * age * 0.35, y: y - age * 0.12, sx: dir * s, sy: s };
}

/** Puffs out from both bottom corners of a block that just slammed down, half-width `hw` either side of `x`. */
export function landing(x: number, hw: number, age: number, size = 1, life = 12): Frame['fx'] {
  return { dustA: puff(x + hw, 0, age, 1, size, life), dustB: puff(x - hw, 0, age, -1, size, life) };
}

const unwrap = (prev: number | undefined, v: number) => {
  if (prev === undefined) return v;
  while (v - prev > 180) v -= 360;
  while (prev - v > 180) v += 360;
  return v;
};

/** Bakes `at` into one key per frame (0 to `length`, or to `length - 1` for loops). */
export function bake(length: number, loop: boolean, at: (frame: number) => Frame): AnimClip {
  const keys: Key[] = [];
  let pivotRot: number | undefined;
  for (let f = 0; f <= (loop ? length - 1 : length); f++) {
    const { block: p, fx = {}, cubes, extra } = at(f);
    pivotRot = unwrap(pivotRot, p.rot);
    const pose: Record<string, BonePose> = {
      pivot: { x: p.px, y: p.py, rot: pivotRot },
      block: { x: p.ox, y: p.oy, rot: p.base, sx: p.sx, sy: p.sy },
    };
    const swaps: Record<string, string | null> = {
      bevel: cubes ? null : bevelName('bevel', p.rot + p.base),
      face: cubes ? null : 'face',
      cubeBevelA: null,
      cubeA: null,
      cubeBevelB: null,
      cubeB: null,
    };
    cubes?.forEach((c, i) => {
      const id = i ? 'B' : 'A';
      pose[`cube${id}`] = { x: c.x, y: c.y, rot: c.rot, sx: c.sx ?? 1, sy: c.sy ?? 1 };
      swaps[`cubeBevel${id}`] = bevelName('cubeBevel', c.rot);
      swaps[`cube${id}`] = 'cube';
    });
    for (const [slot, bone] of Object.entries(FX_BONES) as [FxSlot, string][]) {
      const e = fx[slot];
      swaps[slot] = e ? e.sym : null;
      if (e) pose[bone] = { x: e.x, y: e.y, rot: e.rot ?? 0, sx: e.sx ?? 1, sy: e.sy ?? 1 };
    }
    if (extra) {
      Object.assign(pose, extra.pose);
      Object.assign(swaps, extra.swaps);
    }
    keys.push({ frame: f, pose, ease: 'linear', swaps });
  }
  return { length, loop, keys };
}
