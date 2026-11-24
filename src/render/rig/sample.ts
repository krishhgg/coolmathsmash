import type { AnimClip, ArtSymbol, Bone, BonePose, Ease, FighterArt, Key, Rig } from './types';

/** A bone's local transform: rest plus the sampled key offsets. */
export interface BoneTransform {
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
}

/** 2D affine matrix mapping bone space to rig space: x' = a x + c y + tx, y' = b x + d y + ty. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export interface RigPose {
  local: Record<string, BoneTransform>;
  world: Record<string, Affine>;
  /** Leaf symbol per slot (movie-clip loops resolved), null when hidden. */
  symbols: Record<string, string | null>;
  z: Record<string, number>;
}

export function ease(kind: Ease, t: number): number {
  switch (kind) {
    case 'linear':
      return t;
    case 'step':
      return 0;
    case 'in':
      return t * t;
    case 'out':
      return 1 - (1 - t) * (1 - t);
    case 'inOut':
      return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    case 'outBack': {
      const s = 1.70158;
      const u = t - 1;
      return 1 + (s + 1) * u * u * u + s * u * u;
    }
  }
}

/** The clip for `name`, falling back to `idle`. */
export function getClip(art: FighterArt, name: string): AnimClip {
  const clip = art.clips[name] ?? art.clips.idle;
  if (!clip) throw new Error('fighter art has no idle clip');
  return clip;
}

/** Clip-local time: looping clips wrap, others clamp to [0, length]. */
export function clipTime(clip: AnimClip, frame: number): number {
  if (clip.loop) return ((frame % clip.length) + clip.length) % clip.length;
  return Math.min(Math.max(frame, 0), clip.length);
}

interface Segment {
  from: Key;
  to: Key | null;
  u: number;
}

const posedKeys = new WeakMap<AnimClip, Key[]>();

/** The posed keys around clip time `t` (keys without a pose only switch swaps and draw order). */
function segment(clip: AnimClip, t: number): Segment {
  let keys = posedKeys.get(clip);
  if (!keys) posedKeys.set(clip, (keys = clip.keys.filter((k) => k.pose)));
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return { from: { frame: 0 }, to: null, u: 0 };
  let i = keys.length - 1;
  while (i > 0 && keys[i]!.frame > t) i--;
  const from = keys[i]!;
  if (t < from.frame) {
    if (!clip.loop || keys.length === 1) return { from, to: null, u: 0 };
    const span = first.frame + clip.length - last.frame;
    return { from: last, to: first, u: span > 0 ? (t + clip.length - last.frame) / span : 0 };
  }
  const next = keys[i + 1];
  if (next) return { from, to: next, u: (t - from.frame) / (next.frame - from.frame || 1) };
  if (!clip.loop || keys.length === 1) return { from, to: null, u: 0 };
  return { from, to: first, u: (t - from.frame) / (first.frame + clip.length - from.frame || 1) };
}

const NO_POSE: BonePose = {};

/** Follows movie-clip loops on the match clock until a drawable symbol is reached. */
export function resolveSymbol(
  symbols: Record<string, ArtSymbol>,
  name: string | null,
  globalFrame: number,
): string | null {
  for (let depth = 0; name !== null && depth < 8; depth++) {
    const sym = symbols[name];
    if (!sym) throw new Error(`unknown symbol ${name}`);
    if (Array.isArray(sym)) return name;
    const n = sym.loop.length;
    name = sym.loop[((Math.floor((globalFrame * sym.fps) / 60) % n) + n) % n] ?? null;
  }
  return name;
}

function compose(p: Affine, l: Affine): Affine {
  return {
    a: p.a * l.a + p.c * l.b,
    b: p.b * l.a + p.d * l.b,
    c: p.a * l.c + p.c * l.d,
    d: p.b * l.c + p.d * l.d,
    tx: p.a * l.tx + p.c * l.ty + p.tx,
    ty: p.b * l.tx + p.d * l.ty + p.ty,
  };
}

/**
 * Rig-space matrices for every bone, parents first. A bone's scale stretches its own drawing; children inherit
 * it unless the bone has `localScale`, in which case they are only pushed out along the stretched bone.
 */
export function worldTransforms(rig: Rig, local: Record<string, BoneTransform>): Record<string, Affine> {
  const world: Record<string, Affine> = {};
  const frame: Record<string, Affine> = {};
  const bones: Record<string, Bone> = {};
  for (const bone of rig.bones) {
    bones[bone.name] = bone;
    const t = local[bone.name]!;
    const parent = bone.parent ? bones[bone.parent] : undefined;
    const p = parent?.localScale ? local[parent.name]! : undefined;
    const r = (t.rot * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const x = t.x * (p?.sx ?? 1);
    const y = t.y * (p?.sy ?? 1);
    const base: Affine = { a: cos, b: sin, c: -sin, d: cos, tx: x, ty: y };
    const scaled: Affine = { a: cos * t.sx, b: sin * t.sx, c: -sin * t.sy, d: cos * t.sy, tx: x, ty: y };
    const parentFrame = bone.parent ? frame[bone.parent]! : undefined;
    const w = parentFrame ? compose(parentFrame, scaled) : scaled;
    world[bone.name] = w;
    frame[bone.name] = bone.localScale ? (parentFrame ? compose(parentFrame, base) : base) : w;
  }
  return world;
}

/** Inverse-maps a rig-space point into a bone's space. */
export function toLocal(m: Affine, x: number, y: number): [number, number] {
  const det = m.a * m.d - m.b * m.c;
  const px = x - m.tx;
  const py = y - m.ty;
  return [(m.d * px - m.c * py) / det, (m.a * py - m.b * px) / det];
}

/**
 * The pose of `clipName` at `frame` (frames since the action began; unknown clips fall back to idle), with
 * movie-clip symbols advanced by `globalFrame`, dressed in `costume` (a palette name: its `costumeSwaps` replace
 * slot defaults). Pure: the same inputs always give the same pose.
 */
export function samplePose(
  art: FighterArt,
  clipName: string,
  frame: number,
  globalFrame: number,
  costume = 'default',
): RigPose {
  const clip = getClip(art, clipName);
  const { from, to, u } = segment(clip, clipTime(clip, frame));

  const k = to ? ease(from.ease ?? 'inOut', Math.min(Math.max(u, 0), 1)) : 0;
  const local: Record<string, BoneTransform> = {};
  for (const bone of art.rig.bones) {
    const a = from.pose?.[bone.name] ?? NO_POSE;
    const b = (to ? to.pose?.[bone.name] : a) ?? NO_POSE;
    local[bone.name] = {
      x: bone.x + lerp(a.x ?? 0, b.x ?? 0, k),
      y: bone.y + lerp(a.y ?? 0, b.y ?? 0, k),
      rot: (bone.rot ?? 0) + lerp(a.rot ?? 0, b.rot ?? 0, k),
      sx: (bone.sx ?? 1) * lerp(a.sx ?? 1, b.sx ?? 1, k),
      sy: (bone.sy ?? 1) * lerp(a.sy ?? 1, b.sy ?? 1, k),
    };
  }
  const t = clipTime(clip, frame);
  let swaps: Key['swaps'];
  let order: Key['z'];
  for (const key of clip.keys) {
    if (key.frame > t) break;
    if (key.swaps) swaps = key.swaps;
    if (key.z) order = key.z;
  }
  const symbols: Record<string, string | null> = {};
  const z: Record<string, number> = {};
  const dress = art.costumeSwaps?.[costume];
  art.rig.slots.forEach((slot, i) => {
    const swap = swaps?.[slot.name] !== undefined ? swaps[slot.name] : clip.swaps?.[slot.name];
    const own = dress?.[slot.name];
    const fallback = own !== undefined ? own : slot.symbol;
    symbols[slot.name] = resolveSymbol(art.rig.symbols, swap !== undefined ? swap : fallback, globalFrame);
    z[slot.name] = order?.[slot.name] ?? i;
  });
  return { local, world: worldTransforms(art.rig, local), symbols, z };
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}
