import { pointOf, reach, type Pose } from '../../../render/rig/author';
import { flattenPath, poseBounds } from '../../../render/rig/geometry';
import { samplePose, worldTransforms, type Affine, type BoneTransform } from '../../../render/rig/sample';
import type { AnimClip, FighterArt, Key } from '../../../render/rig/types';
import { ANKLE, UPPER_ARM } from './parts';
import { FOOT, HAND, rig } from './rig';

/**
 * Authoring vocabulary for Johnny's clips: IK helpers, pose mixing and the swap sets for his mouths and hands.
 * Rig space: y down, feet at the origin, facing right; rot > 0 is clockwise.
 */

export type Pt = readonly [number, number];

/** Rig-space matrix of every bone in `pose`. */
function worldOf(pose: Pose): Record<string, Affine> {
  const local: Record<string, BoneTransform> = {};
  for (const bone of rig.bones) {
    const p = pose[bone.name] ?? {};
    local[bone.name] = {
      x: bone.x + (p.x ?? 0),
      y: bone.y + (p.y ?? 0),
      rot: (bone.rot ?? 0) + (p.rot ?? 0),
      sx: (bone.sx ?? 1) * (p.sx ?? 1),
      sy: (bone.sy ?? 1) * (p.sy ?? 1),
    };
  }
  return worldTransforms(rig, local);
}

/** World rotation (degrees) of every bone in `pose`. */
function worldRot(pose: Pose): Record<string, number> {
  return Object.fromEntries(
    Object.entries(worldOf(pose)).map(([k, m]) => [k, (Math.atan2(m.b, m.a) * 180) / Math.PI]),
  );
}

/** The lowest drawn point of `pose` in rig y (down), with each slot wearing its rest symbol. */
function lowest(pose: Pose): number {
  const world = worldOf(pose);
  let low = -Infinity;
  for (const slot of rig.slots) {
    const sym = slot.symbol ? rig.symbols[slot.symbol] : undefined;
    if (slot.decor || !Array.isArray(sym)) continue;
    const m = world[slot.bone]!;
    for (const shape of sym)
      for (const pts of flattenPath(shape.d, 4))
        for (let i = 0; i < pts.length; i += 2) low = Math.max(low, m.b * pts[i]! + m.d * pts[i + 1]! + m.ty);
  }
  return low;
}

/**
 * Lifts an airborne drawing (through `body`) until nothing hangs below the rig root, the floor he lands on, so he
 * never sinks into a platform in the air and pops up when he touches down.
 */
export function aloft(pose: Pose): Pose {
  const low = lowest(pose);
  return low <= 0 ? pose : mix(pose, { body: { y: (pose.body?.y ?? 0) - low } });
}

/** Moves a drawing (through `body`) up or down until its lowest point rests on the floor: rolls and lying poses. */
export function grounded(pose: Pose): Pose {
  return mix(pose, { body: { y: (pose.body?.y ?? 0) - lowest(pose) } });
}

/** Turns one boot so its sole meets the world at `deg` degrees (0: flat, toes forward; 90: toes down). */
export function sole(pose: Pose, side: 'B' | 'F', deg: number): Pose {
  const shin = worldRot(pose)[`shin${side}`] ?? 0;
  return { ...pose, [`foot${side}`]: { ...pose[`foot${side}`], rot: deg - shin } };
}

/** Turns both boots: the far one to `back` degrees, the near one to `front`. */
export function soles(pose: Pose, back = 0, front = 0): Pose {
  return sole(sole(pose, 'B', back), 'F', front);
}

/**
 * Puts one leg's ankle on a rig point with its sole at `deg`: `stretch` lengthens thigh and shin (Flash-style
 * rubber hose, for kicks), `bend` 1 puts the knee forward.
 */
export function leg(
  pose: Pose,
  side: 'B' | 'F',
  ankle: Pt,
  deg: number,
  stretch = 1,
  bend: 1 | -1 = 1,
): Pose {
  const s = mix(pose, { [`thigh${side}`]: { sy: stretch }, [`shin${side}`]: { sy: stretch } });
  return sole(reach(rig, s, `thigh${side}`, `shin${side}`, FOOT, ankle, bend), side, deg);
}

/** `leg` with the knee bent whichever way keeps it higher: knees up when sitting, lying or chambering a kick. */
export function tuck(pose: Pose, side: 'B' | 'F', ankle: Pt, deg: number, stretch = 1): Pose {
  const [up, down] = [leg(pose, side, ankle, deg, stretch, 1), leg(pose, side, ankle, deg, stretch, -1)];
  return pointOf(rig, up, `shin${side}`)[1] <= pointOf(rig, down, `shin${side}`)[1] ? up : down;
}

/** Puts one fist on a rig point; `stretch` lengthens the arm for big punches. */
export function fist(pose: Pose, side: 'B' | 'F', at: Pt, stretch = 1, bend: 1 | -1 = -1): Pose {
  const s = mix(pose, { [`arm${side}`]: { sy: stretch }, [`fore${side}`]: { sy: stretch } });
  return reach(rig, s, `arm${side}`, `fore${side}`, HAND, at, bend);
}

/**
 * Plants the boots with their soles on rig points (the far leg `back`, the near leg `front`), soles flat.
 * Knees bow outwards, as in his stance; `bend` flips the near knee for strides.
 */
export function feet(pose: Pose, back: Pt, front: Pt, bend: 1 | -1 = -1): Pose {
  const p = reach(rig, pose, 'thighB', 'shinB', FOOT, [back[0], back[1] - ANKLE], 1);
  return soles(reach(rig, p, 'thighF', 'shinF', FOOT, [front[0], front[1] - ANKLE], bend));
}

/**
 * `extra` (a lean, a shift, a sink) mixed into a standing `base`, with each boot planted again where `base` had it:
 * same ankle point, same angle to the floor, the knee on the side that turns the leg least. Mixing a lean in after
 * the feet were placed tips one boot into the floor and lifts the other.
 */
export function stanceWith(base: Pose, extra: Pose): Pose {
  let p = mix(base, extra);
  for (const side of ['B', 'F'] as const) {
    const [thigh, shin, foot] = [`thigh${side}`, `shin${side}`, `foot${side}`];
    const ankle = pointOf(rig, base, foot);
    const was = worldRot(base);
    const [forward, back] = ([1, -1] as const).map((bend) =>
      reach(rig, p, thigh, shin, FOOT, ankle, bend),
    ) as [Pose, Pose];
    const off = (q: Pose) => Math.abs(nearest(worldRot(q)[thigh]! - was[thigh]!, 0));
    const legs = off(forward) <= off(back) ? forward : back;
    const turned = worldRot(legs)[shin]! - was[shin]!;
    p = mix(legs, { [foot]: { rot: (base[foot]?.rot ?? 0) - nearest(turned, 0) } });
  }
  return p;
}

/** Puts the hands (fist or palm centres) on rig points; null leaves an arm alone. */
export function hands(
  pose: Pose,
  back: Pt | null,
  front: Pt | null,
  bendB: 1 | -1 = 1,
  bendF: 1 | -1 = 1,
): Pose {
  let p = pose;
  if (back) p = reach(rig, p, 'armB', 'foreB', HAND, back, bendB);
  if (front) p = reach(rig, p, 'armF', 'foreF', HAND, front, bendF);
  return p;
}

export function key(frame: number, pose?: Pose, extra: Omit<Key, 'frame' | 'pose'> = {}): Key {
  return pose ? { frame, pose, ...extra } : { frame, ...extra };
}

/** Each leg's slots (outlines and fills of thigh, shin and boot). */
const LEG_SLOTS = {
  B: rig.slots.filter((s) => /^(thigh|shin|foot)B/.test(s.name)),
  F: rig.slots.filter((s) => /^(thigh|shin|foot)F/.test(s.name)),
};

/**
 * `clip` with a passing key (`clearLeg`) on the deepest frame of each run of frames where a tween sweeps a leg
 * `depth` or more under the floor, on that leg, repeated until no run is left or `rounds` run out. Frames that
 * already have a posed key are left alone.
 */
export function autoPasses(clip: AnimClip, depth = 0.45, rounds = 3): AnimClip {
  let out = clip;
  for (let round = 0; round < rounds; round++) {
    const art: FighterArt = { rig, clips: { c: out }, palettes: { default: {} }, height: 0, icon: '' };
    const keyed = new Set(out.keys.filter((k) => k.pose).map((k) => k.frame));
    const dips = Array.from({ length: out.length + 1 }, (_, f) => {
      const pose = samplePose(art, 'c', f, f);
      const under = (side: 'B' | 'F') =>
        poseBounds({ ...art, rig: { ...rig, slots: LEG_SLOTS[side] } }, pose)[3];
      const [b, front] = [under('B'), under('F')];
      const side: 'B' | 'F' = b >= front ? 'B' : 'F';
      return { f, side, depth: Math.max(b, front) };
    });
    const at: [number, 'B' | 'F'][] = [];
    for (let i = 0; i < dips.length;) {
      if (dips[i]!.depth < depth) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < dips.length && dips[j + 1]!.depth >= depth) j++;
      const run = dips.slice(i, j + 1).filter((d) => !keyed.has(d.f));
      const deepest = run.reduce<(typeof run)[number] | undefined>(
        (a, d) => (!a || d.depth > a.depth ? d : a),
        undefined,
      );
      if (deepest) at.push([deepest.f, deepest.side]);
      i = j + 1;
    }
    if (!at.length) break;
    const passed = passes(out, at);
    out = { ...passed, keys: shortTurns(passed.keys) };
  }
  return out;
}

/**
 * Effect slots, left out when a pose is measured against the floor: smears, stars, swooshes, the Max Upgrade aura
 * and the boot jets cross it freely.
 */
const FX_SLOTS = new Set(['fxAura', 'jetB', 'jetF', 'fxBack', 'fx1', 'fx2']);

/** `clip`'s drawing on `frame`, as a pose (offsets from the rig's rest). */
function poseAt(clip: AnimClip, frame: number): Pose {
  const art: FighterArt = { rig, clips: { clip }, palettes: { default: {} }, height: 0, icon: '' };
  const sampled = samplePose(art, 'clip', frame, frame);
  return Object.fromEntries(
    rig.bones.map(({ name, x, y, rot = 0, sx = 1, sy = 1 }) => {
      const p = sampled.local[name]!;
      return [name, { x: p.x - x, y: p.y - y, rot: p.rot - rot, sx: p.sx / sx, sy: p.sy / sy }];
    }),
  );
}

/** How far one leg's drawings (thigh, shin, boot) reach under the floor in `pose`. */
function legUnder(pose: Pose, side: 'B' | 'F'): number {
  const art: FighterArt = {
    rig: { ...rig, slots: LEG_SLOTS[side] },
    clips: { c: { length: 0, keys: [key(0, pose)] } },
    palettes: { default: {} },
    height: 0,
    icon: '',
  };
  return poseBounds(art, samplePose(art, 'c', 0, 0))[3];
}

/**
 * `pose` with one leg lifted to clear the floor by `clear`: its ankle raised (only) as far as the leg's lowest point
 * reaches under the floor, the knee on the side that turns the leg least, the boot at the angle it had.
 */
export function clearLeg(pose: Pose, side: 'B' | 'F', clear = 0.1): Pose {
  const raise = legUnder(pose, side) + clear;
  if (raise <= 0) return pose;
  const [thigh, shin, foot] = [`thigh${side}`, `shin${side}`, `foot${side}`];
  const [ax, ay] = pointOf(rig, pose, foot);
  const was = worldRot(pose);
  const [one, other] = ([1, -1] as const).map((bend) =>
    reach(rig, pose, thigh, shin, FOOT, [ax, ay - raise], bend),
  ) as [Pose, Pose];
  const off = (q: Pose) => Math.abs(nearest(worldRot(q)[thigh]! - was[thigh]!, 0));
  const legs = off(one) <= off(other) ? one : other;
  return mix(legs, {
    [foot]: { rot: (pose[foot]?.rot ?? 0) - nearest(worldRot(legs)[shin]! - was[shin]!, 0) },
  });
}

/**
 * A step `t` of the way from `a` to `b`: `between` them, with the stepping leg's ankle on the straight line between
 * where the two put it, lifted to clear the floor by `clear`, so the boot travels over the floor and the shin swings
 * evenly.
 */
export function stepping(a: Pose, b: Pose, t: number, side: 'B' | 'F', clear = 0.1): Pose {
  const p = between(a, b, t);
  const [thigh, shin, foot] = [`thigh${side}`, `shin${side}`, `foot${side}`];
  const [[x0, y0], [x1, y1]] = [pointOf(rig, a, foot), pointOf(rig, b, foot)];
  const ankle: Pt = [x0 + (x1 - x0) * t, Math.min(y0 + (y1 - y0) * t, -ANKLE - clear)];
  const was = worldRot(p);
  const [one, other] = ([1, -1] as const).map((bend) => reach(rig, p, thigh, shin, FOOT, ankle, bend)) as [
    Pose,
    Pose,
  ];
  const off = (q: Pose) => Math.abs(nearest(worldRot(q)[thigh]! - was[thigh]!, 0));
  const legs = off(one) <= off(other) ? one : other;
  return mix(legs, { [foot]: { rot: (p[foot]?.rot ?? 0) - nearest(worldRot(legs)[shin]! - was[shin]!, 0) } });
}

/**
 * `clip` with an in-between key on each of `at`'s frames: the clip's own drawing there with that leg passing over
 * the floor (`clearLeg`, clearing it by the entry's third number when given), for a tween that would sweep the boot
 * through it.
 */
export function passes(clip: AnimClip, at: [number, 'B' | 'F', number?][]): AnimClip {
  const frames = [...new Set(at.map(([frame]) => frame))];
  const added = frames.map((frame) => {
    const legs = at.filter(([f]) => f === frame);
    return key(
      frame,
      legs.reduce((pose, [, side, clear]) => clearLeg(pose, side, clear), poseAt(clip, frame)),
      { ease: 'linear' },
    );
  });
  const keys = [...clip.keys, ...added].sort((a, b) => a.frame - b.frame);
  return { ...clip, keys };
}

/**
 * `clip` keyed on every frame, each one moved up or down (through `body`) so its lowest drawn part (effects left
 * out) rests on the floor. A tween between two planted poses can bend a knee through the floor or lift the boots
 * off it; keying every frame on the floor stops that. With `settle` false a frame is only ever lifted, never
 * lowered, for clips that leave the floor on purpose, and a leg a tween sweeps through the floor first gets a
 * passing key (`autoPasses`), so the lift that's left is small. Swaps, draw orders and step keys stay on their
 * frames.
 */
export function onFloor(clip: AnimClip, settle = true): AnimClip {
  if (!settle && !clip.loop) clip = autoPasses(clip);
  const body = rig.slots.filter((s) => !FX_SLOTS.has(s.name));
  const art: FighterArt = { rig, clips: { clip }, palettes: { default: {} }, height: 0, icon: '' };
  const measure: FighterArt = { ...art, rig: { ...rig, slots: body } };
  const keys = Array.from({ length: clip.length + 1 }, (_, frame) => {
    const sampled = samplePose(art, 'clip', frame, frame);
    const low = poseBounds(measure, sampled)[3];
    const bottom = settle ? low : Math.max(0, low);
    const pose: Pose = Object.fromEntries(
      rig.bones.map(({ name, x, y, rot = 0, sx = 1, sy = 1 }) => {
        const p = sampled.local[name]!;
        const lift = name === 'body' ? bottom : 0;
        return [name, { x: p.x - x, y: p.y - y - lift, rot: p.rot - rot, sx: p.sx / sx, sy: p.sy / sy }];
      }),
    );
    const authored = clip.keys.filter((k) => k.frame === frame).reverse();
    const swaps = authored.find((k) => k.swaps)?.swaps;
    const z = authored.find((k) => k.z)?.z;
    const step = authored.find((k) => k.pose)?.ease === 'step';
    return key(frame, pose, {
      ease: step ? 'step' : 'linear',
      ...(swaps && { swaps }),
      ...(z && { z }),
    });
  });
  return { ...clip, keys };
}

const PARENT = Object.fromEntries(rig.bones.map((b) => [b.name, b.parent]));
const REST = Object.fromEntries(rig.bones.map((b) => [b.name, b.rot ?? 0]));

/** `deg` taken by whole turns to the nearest of `near`. */
const nearest = (deg: number, near: number) => deg - 360 * Math.round((deg - near) / 360);

/**
 * Turns every part the short way from one posed key to the next (a bone a key leaves out tweens from rest), so a
 * leg swung across the body goes over the top instead of sweeping through the floor. Each part is measured with
 * the parts it hangs from (its own turn plus its parents'), so a forearm and upper arm that each turn the short way
 * can't add up to the long way round. A lean of the body counts; a turn of the body past 90 degrees (a flip)
 * carries the limbs round with it, and `body` keeps its authored angles, so spins still turn as far as they are
 * keyed.
 */
export function shortTurns(keys: Key[]): Key[] {
  const last: Record<string, number> = {};
  let body: number | undefined;
  return keys.map((k) => {
    if (!k.pose) return k;
    const pose = { ...k.pose };
    const now: Record<string, number> = {};
    const turned = pose.body?.rot ?? 0;
    const lean = body === undefined ? 0 : nearest(turned - body, 0);
    now.body = (last.body ?? 0) + (Math.abs(lean) > 90 ? 0 : lean);
    body = turned;
    for (const { name } of rig.bones) {
      if (name === 'root' || name === 'body') continue;
      const parent = PARENT[name];
      const above = parent && parent !== 'root' ? now[parent]! : 0;
      let rot = pose[name]?.rot ?? 0;
      const was = last[name];
      if (was !== undefined) rot = nearest(above + rot, was) - above;
      if (rot !== 0 || pose[name]?.rot !== undefined) pose[name] = { ...pose[name], rot };
      now[name] = above + rot;
    }
    Object.assign(last, now);
    return { ...k, pose };
  });
}

/** An arm's upper and lower turns (rest included, in the torso's frame) and its two segments' lengths. */
function armOf(pose: Pose, side: 'B' | 'F') {
  const [arm, fore] = [`arm${side}`, `fore${side}`];
  const a = REST[arm]! + (pose[arm]?.rot ?? 0);
  return {
    a,
    b: a + (pose[fore]?.rot ?? 0),
    l1: UPPER_ARM * (pose[arm]?.sy ?? 1),
    l2: HAND * (pose[fore]?.sy ?? 1),
  };
}

/**
 * The same arm with its elbow on the other side of the line from shoulder to hand: the hand stays put and the
 * elbow swings to its mirror image, as `reach` with the other `bend` would put it.
 */
function mirrorArm(pose: Pose, side: 'B' | 'F'): Pose {
  const { a, b, l1, l2 } = armOf(pose, side);
  const r = Math.PI / 180;
  const [wx, wy] = [
    -l1 * Math.sin(a * r) - l2 * Math.sin(b * r),
    l1 * Math.cos(a * r) + l2 * Math.cos(b * r),
  ];
  const line = Math.atan2(-wx, wy) / r;
  const [a2, b2] = [2 * line - a, 2 * line - b];
  return mix(pose, {
    [`arm${side}`]: { rot: a2 - REST[`arm${side}`]! },
    [`fore${side}`]: { rot: b2 - a2 },
  });
}

/** The most either part of an arm turns from `from` to `to`, each the short way. */
function armTurn(from: Pose, to: Pose, side: 'B' | 'F'): number {
  const [p, q] = [armOf(from, side), armOf(to, side)];
  return Math.max(Math.abs(nearest(q.a - p.a, 0)), Math.abs(nearest(q.b - p.b, 0)));
}

/**
 * Keeps each elbow on the side it was on: at every posed key, an arm whose elbow flipped across the line from
 * shoulder to hand since the key before (an IK target that crossed the shoulder) takes its mirror image instead,
 * with the hand in the same place, when that turns the arm less. Use it on a clip's keys before `shortTurns`.
 * `sides` names the arms to keep (an arm holding a gun lined up with its forearm is left alone).
 */
export function elbows(keys: Key[], sides: ('B' | 'F')[] = ['B', 'F']): Key[] {
  let prev: Pose | undefined;
  return keys.map((k) => {
    if (!k.pose) return k;
    let pose = k.pose;
    for (const side of sides) {
      const flipped = mirrorArm(pose, side);
      if (prev && armTurn(prev, flipped, side) + 20 < armTurn(prev, pose, side)) pose = flipped;
    }
    prev = pose;
    return pose === k.pose ? k : { ...k, pose };
  });
}

/**
 * `a` moved `t` of the way to `b`, bone by bone, each part turning the short way on screen as `shortTurns` tweens
 * it: an in-between drawing for a key that turns too far in one go.
 */
export function between(a: Pose, b: Pose, t: number): Pose {
  const [ka, kb] = shortTurns([key(0, a), key(1, b)]).map((k) => k.pose!);
  const out: Pose = {};
  const at = (u: number, v: number) => u + (v - u) * t;
  for (const bone of new Set([...Object.keys(ka!), ...Object.keys(kb!)])) {
    const [p, q] = [ka![bone] ?? {}, kb![bone] ?? {}];
    out[bone] = {
      x: at(p.x ?? 0, q.x ?? 0),
      y: at(p.y ?? 0, q.y ?? 0),
      rot: at(p.rot ?? 0, q.rot ?? 0),
      sx: at(p.sx ?? 1, q.sx ?? 1),
      sy: at(p.sy ?? 1, q.sy ?? 1),
    };
  }
  return out;
}

/** Merges poses bone by bone (later wins per field). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) for (const [bone, bp] of Object.entries(p)) out[bone] = { ...out[bone], ...bp };
  return out;
}

export const GRIT = { face: 'grit' };
export const SHOUT = { face: 'shout' };
export const SMIRK = { face: 'smirk' };
export const HURT = { face: 'hurt' };

export const FIST_F = { foreF: 'fist', foreFLine: 'fistLine' };
export const FIST_B = { foreB: 'fistFar', foreBLine: 'fistFarLine' };
export const PALM_F = { foreF: 'palm', foreFLine: 'palmLine' };
export const PALM_B = { foreB: 'palmFar', foreBLine: 'palmFarLine' };
/** The idle's hands: open guard in front, fist cocked behind. */
export const GUARD = { ...PALM_F, ...FIST_B };
export const FISTS = { ...FIST_F, ...FIST_B };

/** Draw orders that move `slots` (in order) just above slot `over`; slot i draws at z = i. */
function above(over: string, slots: string[]): Record<string, number> {
  const z = rig.slots.findIndex((s) => s.name === over);
  return Object.fromEntries(slots.map((name, i) => [name, z + (i + 1) / 10]));
}

export const BACK_ARM_IN_FRONT = above('foreF', ['armBLine', 'foreBLine', 'armB', 'foreB']);
export const FRONT_ARM_BEHIND = above('fxBack', ['armFLine', 'foreFLine', 'armF', 'foreF']);
export const HEAD_IN_FRONT = above('foreF', ['', '', '', '', 'head', 'face']);
/** The far arm drawn over his head and torso but under the near arm, for guards held across the face. */
export const BACK_ARM_OVER_HEAD = above('face', ['armBLine', 'foreBLine', 'armB', 'foreB']);
/** The far leg drawn over the torso but under the head and near arm (the knee). */
export const BACK_LEG_IN_FRONT = above('torso', ['thighBLine', 'shinBLine', 'thighB', 'shinB', 'footB']);
/** The near leg drawn over the torso, for kicks and knees raised across it. */
export const FRONT_LEG_IN_FRONT = above('torso', ['thighFLine', 'shinFLine', 'thighF', 'shinF', 'footF']);

/** His fighting stance from the game's idle: wide bow-legged feet, fist up by the chin, open hand guarding. */
export const STANCE = hands(
  mix(feet({ hip: { y: 0.25 }, body: { rot: 2 } }, [3.0, 0], [-2.4, 0]), { footF: { sx: -1 } }),
  [5.7, -9.0],
  [-3.7, -8.9],
  -1,
  1,
);

/** Turnaround pivot: squared up to the camera, fists on his hips, boots splayed; nearly the same drawing either way round. */
export const PIVOT = hands(
  mix(
    feet({ hip: { y: 0.45 }, armF: { x: -0.35 }, armB: { x: 0.35 }, neck: { y: 0.15 } }, [3.5, 0], [-3.1, 0]),
    { footF: { sx: -1 } },
  ),
  [4.3, -4.6],
  [-3.6, -4.7],
  -1,
  1,
);

/** Standing tall, arms at his sides (turnarounds and getups pass through it). */
export const STAND = hands(feet({}, [2.0, 0], [-1.6, 0]), [4.6, -4.9], [-3.6, -4.9], 1, -1);

/** Knees bent, head pulled into the shoulders. */
export const CROUCH = hands(
  feet({ hip: { y: 1.6 }, body: { rot: 8 }, neck: { y: 0.4 } }, [3.0, 0], [-3.0, 0]),
  [4.6, -5.6],
  [-2.4, -5.4],
  1,
  -1,
);

/** Airborne, limbs loose. */
export const AIR: Pose = {
  thighF: { rot: -40 },
  shinF: { rot: 55 },
  thighB: { rot: 20 },
  shinB: { rot: 35 },
  armF: { rot: -50 },
  foreF: { rot: -70 },
  armB: { rot: 45 },
  foreB: { rot: 40 },
};

/**
 * Rolled up for a somersault: chin on his chest, knees hugged in, fists wrapped round his shins. `somersault` turns
 * it through `body` and rests it on the floor.
 */
export const TUCK = hands(
  {
    hip: { y: -0.6 },
    torso: { rot: 20 },
    neck: { y: 0.9, rot: 24 },
    thighF: { rot: -100 },
    shinF: { rot: 120 },
    thighB: { rot: -86 },
    shinB: { rot: 112 },
    footF: { rot: 30 },
    footB: { rot: 30 },
  },
  [3.6, -7.4],
  [2.0, -7.0],
  1,
  1,
);

/** One key a frame from `start` to `end`, the tuck turning from `from` to `to` degrees as it rolls on the floor. */
export function somersault(start: number, end: number, from: number, to: number): Key[] {
  const keys: Key[] = [];
  for (let f = start; f <= end; f++) {
    const rot = from + ((to - from) * (f - start)) / (end - start);
    keys.push(key(f, grounded(mix(TUCK, { body: { rot } })), { ease: 'linear' }));
  }
  return keys;
}
