import { pointOf, reach, type Pose } from '../../../render/rig/author';
import { flattenPath } from '../../../render/rig/geometry';
import { worldTransforms, type Affine, type BoneTransform } from '../../../render/rig/sample';
import type { BonePose, Key } from '../../../render/rig/types';
import { GRIP_FRONT, GRIP_REAR, MUZZLE, shoes } from './parts';
import { FOOT, HAND, rig } from './rig';

/**
 * Authoring vocabulary for the kids' clips: IK for the big kid's legs and arms, the launcher's aim with both hands
 * on its grips, pose mixing and the swap sets for faces and hands. Rig space: y down, feet at the origin, facing
 * right; rot > 0 is clockwise (leaning forwards).
 */

export type Pt = readonly [number, number];
const DEG = 180 / Math.PI;

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

/** World rotation of a bone in `pose`, degrees. */
export function rotOf(pose: Pose, bone: string): number {
  const m = worldOf(pose)[bone]!;
  return Math.atan2(m.b, m.a) * DEG;
}

/** Rig point of a bone's origin, or of a point in its space, in `pose`. */
export function at(pose: Pose, bone: string, x = 0, y = 0): [number, number] {
  return pointOf(rig, pose, bone, x, y);
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** Merges poses bone by bone (later wins per field). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) for (const [bone, bp] of Object.entries(p)) out[bone] = { ...out[bone], ...bp };
  return out;
}

export function key(frame: number, pose?: Pose, extra: Omit<Key, 'frame' | 'pose'> = {}): Key {
  return pose ? { frame, pose, ...extra } : { frame, ...extra };
}

/** An effect bone: its symbol centred on rig point (x, y), scaled by `s` and turned by `rot`. */
export function fx(x: number, y: number, s: number, rot = 0, sy = s): BonePose {
  return { x, y, rot, sx: s, sy };
}

/** The lowest drawn point of `pose` (rig y, down positive) and the slot that reaches it. */
export function lowest(pose: Pose): [number, string] {
  const world = worldOf(pose);
  let low = -Infinity;
  let which = '';
  for (const slot of rig.slots) {
    const sym = slot.symbol ? rig.symbols[slot.symbol] : undefined;
    if (slot.decor || !Array.isArray(sym)) continue;
    const m = world[slot.bone]!;
    for (const shape of sym)
      for (const pts of flattenPath(shape.d, 4))
        for (let i = 0; i < pts.length; i += 2) {
          const y = m.b * pts[i]! + m.d * pts[i + 1]! + m.ty;
          if (y > low) [low, which] = [y, slot.name];
        }
  }
  return [low, which];
}

/**
 * Lifts an airborne drawing (through `body`) until nothing hangs below the rig root, the floor they land on, so the
 * kids never sink into a platform in the air and pop up when they touch down.
 */
export function aloft(pose: Pose, clearance = 0): Pose {
  const lift = lowest(pose)[0] + clearance;
  return lift <= 0 ? pose : mix(pose, { body: { y: round((pose.body?.y ?? 0) - lift) } });
}

/** Moves a drawing on the ground (through `body`) up or down until its lowest point rests on the floor. */
export function grounded(pose: Pose): Pose {
  const low = lowest(pose)[0];
  return mix(pose, { body: { y: round((pose.body?.y ?? 0) - low) } });
}

/** Turns one sneaker so its sole meets the world at `deg` degrees (0: flat, toes forward; 90: toes down). */
export function sole(pose: Pose, side: 'B' | 'F', deg: number): Pose {
  const shin = rotOf(pose, `shin${side}`);
  return { ...pose, [`foot${side}`]: { ...pose[`foot${side}`], rot: round(deg - shin) } };
}

/** Puts one ankle on a rig point with its sole at `deg`; `bend` 1 puts the knee forward. */
export function leg(pose: Pose, side: 'B' | 'F', ankle: Pt, deg = 0, bend: 1 | -1 = 1): Pose {
  return sole(reach(rig, pose, `thigh${side}`, `shin${side}`, FOOT, ankle, bend), side, deg);
}

/** Outline points of the sneaker, ink included, in foot space (ankle at the origin). */
const SHOE_PTS: [number, number][] = shoes.shoe.flatMap((shape) =>
  flattenPath(shape.d, 4).flatMap((pts) =>
    pts.flatMap((_, i) => (i % 2 ? [] : [[pts[i]!, pts[i + 1]!] as [number, number]])),
  ),
);

/** How far the sneaker's lowest point hangs below the ankle with its sole turned `deg` degrees toes-down. */
export function drop(deg: number): number {
  const t = deg / DEG;
  return Math.max(...SHOE_PTS.map(([x, y]) => x * Math.sin(t) + y * Math.cos(t)));
}

/** Puts one sneaker's lowest point `lift` above the floor at x, its sole at `deg`; `bend` 1 puts the knee forward. */
export function plant(pose: Pose, side: 'B' | 'F', x: number, lift = 0, deg = 0, bend: 1 | -1 = 1): Pose {
  return leg(pose, side, [x, -lift - drop(deg)], deg, bend);
}

/** Plants both sneakers on rig points (far leg `back`, near leg `front`), soles at `degB` and `degF`. */
export function feet(pose: Pose, back: Pt, front: Pt, degB = 0, degF = 0): Pose {
  return plant(plant(pose, 'B', back[0], -back[1], degB), 'F', front[0], -front[1], degF);
}

/** Puts the hands (fist or mitten centres) on rig points; null leaves an arm alone. Elbows bend back by default. */
export function hands(
  pose: Pose,
  back: Pt | null,
  front: Pt | null,
  bendB: 1 | -1 = -1,
  bendF: 1 | -1 = -1,
): Pose {
  let p = pose;
  if (back) p = reach(rig, p, 'armB', 'foreB', HAND, back, bendB);
  if (front) p = reach(rig, p, 'armF', 'foreF', HAND, front, bendF);
  return p;
}

/** Both hands on the launcher's grips where it sits in `pose`: the near hand on the trigger, the far on the handle. */
export function grip(pose: Pose, bendB: 1 | -1 = -1, bendF: 1 | -1 = -1): Pose {
  return hands(pose, at(pose, 'gun', ...GRIP_FRONT), at(pose, 'gun', ...GRIP_REAR), bendB, bendF);
}

/**
 * Points the launcher at world angle `deg` (0 forwards, -90 straight up, 90 down, 180 back) and grips it. `dx` and
 * `dy` shift it from its rest spot on the chest.
 */
export function aim(pose: Pose, deg: number, dx = 0, dy = 0, bendB: 1 | -1 = -1, bendF: 1 | -1 = -1): Pose {
  const torso = rotOf(pose, 'torso');
  const p = mix(pose, { gun: { rot: round(deg - torso), x: dx, y: dy } });
  return grip(p, bendB, bendF);
}

/** Rig point of the launcher's muzzle in `pose`. */
export function muzzle(pose: Pose): [number, number] {
  return at(pose, 'gun', ...MUZZLE);
}

/** Merges limb rotations so every keyed limb turns the short way from the previous posed key. */
const LIMBS = [
  'armB',
  'foreB',
  'armF',
  'foreF',
  'thighB',
  'shinB',
  'footB',
  'thighF',
  'shinF',
  'footF',
  'gun',
];
export function shortTurns(keys: Key[]): Key[] {
  const last: Record<string, number> = {};
  return keys.map((k) => {
    if (!k.pose) return k;
    const pose = { ...k.pose };
    for (const bone of LIMBS) {
      const rot = pose[bone]?.rot ?? 0;
      const turned = rot - 360 * Math.round((rot - (last[bone] ?? rot)) / 360);
      if (pose[bone]) pose[bone] = { ...pose[bone], rot: turned };
      last[bone] = pose[bone] ? turned : 0;
    }
    return { ...k, pose };
  });
}

/** Draw orders that move `slots` (in order) just above slot `over`; slot i draws at z = i. */
export function above(over: string, slots: string[]): Record<string, number> {
  const z = rig.slots.findIndex((s) => s.name === over);
  return Object.fromEntries(slots.map((name, i) => [name, z + (i + 1) / 20]));
}

/** Faces: the big kid's (`face`) and his brother's (`broFace`). */
export const GRIN = { face: 'face', broFace: 'broFace' };
export const BLINK = { face: 'faceBlink', broFace: 'broBlink' };
export const SMILE = { face: 'faceSmile' };
export const HAPPY = { face: 'faceHappy', broFace: 'broCheer' };
export const SHOUT = { face: 'faceShout', broFace: 'broShout' };
export const GRIT = { face: 'faceGrit', broFace: 'broShout' };
export const HURT = { face: 'faceHurt', broFace: 'broHurt' };
export const SCARED = { face: 'faceScared', broFace: 'broScared' };
export const DIZZY = { face: 'faceDizzy', broFace: 'broHurt' };
export const LOOK_UP = { face: 'faceUp', broFace: 'broUp' };

/** Hands. The rig's defaults are a fist in front and behind; mittens are the open hands. */
export const OPEN_F = { foreF: 'mitten', foreFLine: 'mittenLine' };
export const OPEN_B = { foreB: 'mittenFar', foreBLine: 'mittenFarLine' };
export const OPEN = { ...OPEN_F, ...OPEN_B };

/** The rocket and the effect symbols switched on by name. */
export const ROCKET = { rocket: 'rocket' };
