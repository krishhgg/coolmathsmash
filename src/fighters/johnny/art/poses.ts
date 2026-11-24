import { reach, type Pose } from '../../../render/rig/author';
import { worldTransforms, type BoneTransform } from '../../../render/rig/sample';
import type { Key } from '../../../render/rig/types';
import { ANKLE } from './parts';
import { FOOT, HAND, rig } from './rig';

/**
 * Authoring vocabulary for Johnny's clips: IK helpers, pose mixing and the swap sets for his mouths and hands.
 * Rig space: y down, feet at the origin, facing right; rot > 0 is clockwise.
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
  const world = worldTransforms(rig, local);
  return Object.fromEntries(
    Object.entries(world).map(([k, m]) => [k, (Math.atan2(m.b, m.a) * 180) / Math.PI]),
  );
}

/** Turns the boots so their soles meet the world at `back` and `front` degrees (0: flat, toes forward). */
export function soles(pose: Pose, back = 0, front = 0): Pose {
  const w = worldRot(pose);
  return {
    ...pose,
    footB: { ...pose.footB, rot: back - (w.shinB ?? 0) },
    footF: { ...pose.footF, rot: front - (w.shinF ?? 0) },
  };
}

/**
 * Plants the boots with their soles on rig points (the far leg `back`, the near leg `front`), soles flat.
 * Knees bow outwards, as in his stance; `bend` flips the near knee for strides.
 */
export function feet(pose: Pose, back: Pt, front: Pt, bend: 1 | -1 = -1): Pose {
  const p = reach(rig, pose, 'thighB', 'shinB', FOOT, [back[0], back[1] - ANKLE], 1);
  return soles(reach(rig, p, 'thighF', 'shinF', FOOT, [front[0], front[1] - ANKLE], bend));
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

/**
 * Draw orders. Slots: fxBack 0, back arm 1-4, back leg 5-8, front leg 9-12, torso 13, head 14, face 15,
 * front arm 16-19, fx 20-21.
 */
export const BACK_ARM_IN_FRONT = { armBLine: 19.1, foreBLine: 19.2, armB: 19.3, foreB: 19.4 };
export const FRONT_ARM_BEHIND = { armFLine: 0.1, foreFLine: 0.2, armF: 0.3, foreF: 0.4 };
export const HEAD_IN_FRONT = { head: 19.5, face: 19.6 };

/** His fighting stance from the game's idle: wide bow-legged feet, fist up by the chin, open hand guarding. */
export const STANCE = hands(
  mix(feet({ hip: { y: 0.25 }, body: { rot: 2 } }, [3.0, 0], [-2.4, 0]), { footF: { sx: -1 } }),
  [5.7, -9.0],
  [-3.7, -8.9],
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
