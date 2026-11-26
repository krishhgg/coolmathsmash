import { reach, type Pose } from '../../../render/rig/author';
import { worldTransforms, type BoneTransform } from '../../../render/rig/sample';
import type { Key } from '../../../render/rig/types';
import { ANKLE, FOOT, HAND, rig } from './rig';

/**
 * Authoring vocabulary for the Runner's clips: IK for her stubby legs and arms, pose mixing, antenna lag and the
 * face swaps. Rig space: y down, feet at the origin, facing right; rot > 0 is clockwise.
 */

export type Pt = readonly [number, number];

/** World rotation (degrees) of every bone in `pose`. */
function worldRot(pose: Pose): Record<string, number> {
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
  return Object.fromEntries(
    Object.entries(worldTransforms(rig, local)).map(([k, m]) => [k, (Math.atan2(m.b, m.a) * 180) / Math.PI]),
  );
}

/** Turns the feet so their soles meet the world at `back` and `front` degrees (0: flat, toes forward). */
export function soles(pose: Pose, back = 0, front = 0): Pose {
  const w = worldRot(pose);
  return {
    ...pose,
    footB: { ...pose.footB, rot: back - (w.shinB ?? 0) },
    footF: { ...pose.footF, rot: front - (w.shinF ?? 0) },
  };
}

/** Plants the soles flat on rig points (the far leg on `back`, the near leg on `front`); knees bend forward. */
export function feet(pose: Pose, back: Pt, front: Pt, bendB: 1 | -1 = 1, bendF: 1 | -1 = 1): Pose {
  const p = reach(rig, pose, 'thighB', 'shinB', FOOT, [back[0], back[1] - ANKLE], bendB);
  return soles(reach(rig, p, 'thighF', 'shinF', FOOT, [front[0], front[1] - ANKLE], bendF));
}

/** Puts the hand nubs on rig points; null leaves that arm alone. Elbows bend down by default. */
export function hands(
  pose: Pose,
  back: Pt | null,
  front: Pt | null,
  bendB: 1 | -1 = -1,
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

/** Merges poses bone by bone (later wins per field). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) for (const [bone, bp] of Object.entries(p)) out[bone] = { ...out[bone], ...bp };
  return out;
}

/** Adds rotation to bones on top of a pose (antenna lag, a lean), keeping everything else. */
export function turn(pose: Pose, rots: Record<string, number>): Pose {
  const out: Pose = { ...pose };
  for (const [bone, r] of Object.entries(rots)) out[bone] = { ...out[bone], rot: (out[bone]?.rot ?? 0) + r };
  return out;
}

/** Antennae swung by `back` and `front` degrees from rest: positive trails them backwards when she moves right. */
export function ants(pose: Pose, back: number, front = back): Pose {
  return turn(pose, { antB: -back, antF: -front });
}

/** One pose, written compactly: body offsets, then soles and hands on rig points, then antenna swing. */
export interface Spec {
  x?: number;
  y?: number;
  rot?: number;
  sx?: number;
  sy?: number;
  /** Far sole, near sole (rig points). */
  legs?: [Pt, Pt];
  /** Knee directions for the far and near leg (1: forward). */
  knees?: [1 | -1, 1 | -1];
  /** Far hand, near hand (rig points); null leaves an arm at rest. */
  arms?: [Pt | null, Pt | null];
  elbows?: [1 | -1, 1 | -1];
  /** Antenna swing (back, front), degrees; positive trails them behind her. */
  ant?: [number, number];
  /** Extra bone offsets, applied before the IK (raw limb angles for airborne poses, stretches). */
  raw?: Pose;
}

export function P(s: Spec): Pose {
  let p: Pose = mix(
    { body: { x: s.x ?? 0, y: s.y ?? 0, rot: s.rot ?? 0, sx: s.sx ?? 1, sy: s.sy ?? 1 } },
    s.raw ?? {},
  );
  if (s.legs) p = feet(p, s.legs[0], s.legs[1], ...(s.knees ?? [1, 1]));
  if (s.arms) p = hands(p, s.arms[0], s.arms[1], ...(s.elbows ?? [-1, 1]));
  if (s.ant) p = ants(p, s.ant[0], s.ant[1]);
  return p;
}

/** Face swaps. */
export const FACE = { face: 'face' };
export const BLINK = { face: 'faceBlink' };
export const ANGRY = { face: 'faceAngry' };
export const SHOUT = { face: 'faceShout' };
export const HURT = { face: 'faceHurt' };
export const HAPPY = { face: 'faceHappy' };
export const FRONT = { face: 'faceFront' };
export const FRONT_HAPPY = { face: 'faceFrontHappy' };
export const DIZZY = { face: 'faceFrontDizzy' };
/** Facing away (rolls, the back half of a spin): no face. */
export const AWAY = { face: 'faceBack' };

/**
 * Draw orders. Slots: fxBack 0, antB 1, far arm 2-5, cane 6, far leg 7-12, near leg 13-18, antF 19, body 20,
 * crest 21, face 22, hat 23, near arm 24-27, fx 28-29, and fxUnder 30, which draws under every fighter (Slot.under).
 */
export const FAR_ARM_IN_FRONT = { armBLine: 27.1, foreBLine: 27.2, armB: 27.3, foreB: 27.4 };

/** Her standing pose from the front-view art: feet apart under the body, arms out a little at her sides. */
export const STAND = hands(feet({ body: { y: 0.3 } }, [1.6, 0], [-1.4, 0]), [5.0, -4.3], [-4.9, -4.2]);

/** Knees bent and body sunk, arms tucked. */
export const CROUCH = hands(
  feet({ body: { y: 1.55, sy: 0.9, sx: 1.08, rot: 6 } }, [2.1, 0], [-1.9, 0]),
  [4.8, -2.7],
  [-4.6, -2.6],
);

/** Airborne, legs tucked a little and arms out for balance. */
export const AIR: Pose = {
  thighB: { rot: -35 },
  shinB: { rot: 40 },
  thighF: { rot: 15 },
  shinF: { rot: 30 },
  armB: { rot: -40 },
  foreB: { rot: -20 },
  armF: { rot: 55 },
  foreF: { rot: 25 },
};
