import { reach, type Pose } from '../../../render/rig/author';
import type { BonePose, Key } from '../../../render/rig/types';
import { FOOT, HAND, rig } from './rig';

/**
 * Authoring vocabulary for Fireboy's clips: IK helpers, effect placement and the swap sets for his heads and
 * faces. Rig space: y down, feet at the origin, facing right; rot > 0 is clockwise (a limb hanging down swings
 * backwards, the body leans forwards).
 */

export type Pt = readonly [number, number];

/** Plants the feet at rig points. Knees bend forwards; `bowed` bends the back knee outwards instead. */
export function feet(pose: Pose, back: Pt, front: Pt, bowed = false): Pose {
  const p = reach(rig, pose, 'thighB', 'shinB', FOOT, back, bowed ? -1 : 1);
  return reach(rig, p, 'thighF', 'shinF', FOOT, front, 1);
}

/** Puts the hands on rig points (null leaves an arm alone); `bend` -1 drops the elbows. */
export function hands(pose: Pose, back: Pt | null, front: Pt | null, bend: 1 | -1 = 1): Pose {
  let p = pose;
  if (back) p = reach(rig, p, 'armB', 'foreB', HAND, back, bend);
  if (front) p = reach(rig, p, 'armF', 'foreF', HAND, front, bend);
  return p;
}

export function key(frame: number, pose?: Pose, extra: Omit<Key, 'frame' | 'pose'> = {}): Key {
  return pose ? { frame, pose, ...extra } : { frame, ...extra };
}

/** Radius of the fire ball in the head symbols at scale 1. */
export const BALL = 3.6;

/** Effect bone pose: a fireball of radius `r` centred on rig point (x, y), flying towards `dir` (deg, -90 = up). */
export function ball(x: number, y: number, r: number, dir = 0): BonePose {
  return { x, y, rot: dir, sx: r / BALL, sy: r / BALL };
}

/** Effect bone pose: a three-tipped flame whose ball (radius `r`) is centred on (x, y), tips towards `dir`. */
export function flame(x: number, y: number, r: number, dir = -90, stretch = 1): BonePose {
  return { x, y, rot: dir + 90, sx: r / BALL, sy: (r / BALL) * stretch };
}

const face = (head: string, face: string) => ({ head, face });
export const FRONT = face('headFront', 'faceFront');
export const BLINK = face('headFront', 'faceFrontBlink');
export const ANGRY = face('headFront', 'faceFrontAngry');
export const SHOUT = face('headFront', 'faceFrontShout');
export const HURT = face('headFront', 'faceFrontHurt');
export const SIDE = face('headSide', 'faceSide');
export const SIDE_ANGRY = face('headSide', 'faceSideAngry');
export const SIDE_SHOUT = face('headSide', 'faceSideShout');
export const SIDE_HURT = face('headSide', 'faceSideHurt');
export const UP = face('headUp', 'faceUp');

export const FIST_F = { foreF: 'fist', foreFLine: 'fistLine' };
export const FIST_B = { foreB: 'fist', foreBLine: 'fistLine' };
export const FISTS = { ...FIST_F, ...FIST_B };

const LIMBS = ['armB', 'foreB', 'thighB', 'shinB', 'thighF', 'shinF', 'armF', 'foreF', 'torso'];
/** Hides the body: Fireboy rolled up into a fireball. */
export const NO_BODY: Record<string, null> = Object.fromEntries(
  LIMBS.flatMap((s) => [
    [s, null],
    [`${s}Line`, null],
  ]),
);

/** Draw orders. Slots: fxBack 0, back arm 1-4, torso line 5, back leg 6-9, front leg 10-13, torso 14, front arm 15-18, head 19, face 20, fx 21-23. */
export const HEAD_BEHIND = { head: 0.5, face: 0.6 };
export const ARMS_IN_FRONT = {
  armBLine: 20.1,
  foreBLine: 20.2,
  armB: 20.3,
  foreB: 20.4,
  armFLine: 20.5,
  foreFLine: 20.6,
  armF: 20.7,
  foreF: 20.8,
};
export const FRONT_ARM_IN_FRONT = { armFLine: 20.5, foreFLine: 20.6, armF: 20.7, foreF: 20.8 };
export const LEGS_IN_FRONT = {
  thighFLine: 20.1,
  shinFLine: 20.2,
  thighF: 20.3,
  shinF: 20.4,
  thighBLine: 20.05,
  shinBLine: 20.06,
  thighB: 20.07,
  shinB: 20.08,
};

/** Standing, relaxed, like the 2009 idle drawing. */
export const STAND = hands(
  feet({ hip: { y: 0.02 } }, [-0.45, 0], [0.45, 0], true),
  [-1.55, -1.75],
  [1.55, -1.75],
);

/** Knees bent, head squashed into the shoulders. */
export const CROUCH = hands(
  feet({ hip: { y: 1.0 }, neck: { y: 0.3 }, head: { sx: 1.06, sy: 0.92 } }, [-0.8, 0], [0.9, 0], true),
  [-1.35, -1.0],
  [1.5, -1.1],
);

/** Airborne, limbs loose. */
export const AIR: Pose = {
  thighF: { rot: -28 },
  shinF: { rot: 40 },
  thighB: { rot: 12 },
  shinB: { rot: 30 },
  armF: { rot: -35 },
  foreF: { rot: -25 },
  armB: { rot: 30 },
  foreB: { rot: 25 },
};

/** Balled up: knees to the chest, arms hugging them. */
export const TUCK: Pose = {
  hip: { y: -0.5 },
  thighF: { rot: -95 },
  shinF: { rot: 125 },
  thighB: { rot: -70 },
  shinB: { rot: 130 },
  armF: { rot: -50 },
  foreF: { rot: -60 },
  armB: { rot: -10 },
  foreB: { rot: -40 },
  neck: { y: 0.35 },
};

/** Merges poses bone by bone (later wins per field). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) for (const [bone, bp] of Object.entries(p)) out[bone] = { ...out[bone], ...bp };
  return out;
}
