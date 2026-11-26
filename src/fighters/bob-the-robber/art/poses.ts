import { pointOf, reach, type Pose } from '../../../render/rig/author';
import type { BonePose, Key } from '../../../render/rig/types';
import { ANKLE } from './parts';
import { FOOT, HAND, rig } from './rig';

/**
 * Authoring vocabulary for Bob's clips: IK for feet and hands, aiming props, placing effects, and the swap sets
 * for his head views, faces, hands and props. Rig space: y down, feet at the origin, facing right; rot > 0 is
 * clockwise (a hanging limb swings backwards, the body leans forwards).
 */

export type Pt = readonly [number, number];

export function key(frame: number, pose?: Pose, extra: Omit<Key, 'frame' | 'pose'> = {}): Key {
  return pose ? { frame, pose, ...extra } : { frame, ...extra };
}

/** Keep equivalent limb and prop angles on the short side of the tween across an IK wrap. */
export function continuous(keys: Key[]): Key[] {
  const angles: Record<string, number> = {};
  return keys.map((k) => {
    if (!k.pose) return k;
    const pose = { ...k.pose };
    for (const { name } of rig.bones) {
      const prev = angles[name];
      let r = pose[name]?.rot ?? 0;
      if (name !== 'body' && prev !== undefined) r += 360 * Math.round((prev - r) / 360);
      if (r !== 0 || pose[name]?.rot !== undefined) pose[name] = { ...pose[name], rot: r };
      angles[name] = r;
    }
    return { ...k, pose };
  });
}

/** Merges poses bone by bone (later wins per field). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) for (const [bone, bp] of Object.entries(p)) out[bone] = { ...out[bone], ...bp };
  return out;
}

/** World rotation of a bone in `pose` (degrees; 0 = its rest axes line up with the rig's). */
export function worldRot(pose: Pose, bone: string): number {
  const [x0, y0] = pointOf(rig, pose, bone, 0, 0);
  const [x1, y1] = pointOf(rig, pose, bone, 1, 0);
  return (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
}

/** Turns `bone` so its world rotation is `deg`: for props along +x, -90 points up, 0 forward, 90 down. */
export function aim(pose: Pose, bone: string, deg: number): Pose {
  const parent = rig.bones.find((b) => b.name === bone)?.parent;
  const base = parent ? worldRot(pose, parent) : 0;
  const rest = rig.bones.find((b) => b.name === bone)?.rot ?? 0;
  return mix(pose, { [bone]: { rot: Math.round((deg - base - rest) * 100) / 100 } });
}

/** A planted foot: the ankle's rig point for a sole at (x, y). */
export const floor = (x: number, y = 0): Pt => [x, y - ANKLE];

/**
 * Plants the ankles at rig points (knees bend forwards; `bowed` bends the back knee out instead) and turns
 * each shoe to `tilt` degrees (0 = sole flat, negative = toe up, positive = on tiptoe).
 */
export function feet(pose: Pose, back: Pt, front: Pt, bowed = false, tilt: [number, number] = [0, 0]): Pose {
  let p = reach(rig, pose, 'thighB', 'shinB', FOOT, back, bowed ? -1 : 1);
  p = reach(rig, p, 'thighF', 'shinF', FOOT, front, 1);
  p = aim(p, 'footB', tilt[0]);
  return aim(p, 'footF', tilt[1]);
}

/** Puts the wrists on rig points (null leaves an arm alone); `bend` -1 drops the elbows. */
export function hands(pose: Pose, back: Pt | null, front: Pt | null, bend: 1 | -1 = 1): Pose {
  let p = pose;
  if (back) p = reach(rig, p, 'armB', 'foreB', HAND, back, bend);
  if (front) p = reach(rig, p, 'armF', 'foreF', HAND, front, bend);
  return p;
}

/** Effect bone pose (fx bones hang from the root, so this is rig space): at (x, y), turned `rot`, scaled. */
export function fx(x: number, y: number, rot = 0, sx = 1, sy = sx): BonePose {
  return { x, y, rot, sx, sy };
}

/** Rig point of the baton's tip in `pose`. */
export const tipOf = (pose: Pose, along = 7.5): Pt => pointOf(rig, pose, 'baton', along, 0);

const look = (head: string, face: string, hat: string) => ({ head, face, hat });
/** Facing the camera, as in the game's own idle sprite. */
export const FRONT = {
  ...look('headFront', 'faceFront', 'hatFront'),
  footB: 'shoeFront',
  footF: 'shoeFront',
};
export const FRONT_BLINK = { ...FRONT, face: 'faceFrontBlink' };
export const FRONT_GRIN = { ...FRONT, face: 'faceFrontGrin' };
export const FRONT_HURT = { ...FRONT, face: 'faceFrontHurt' };
export const FRONT_STRAIN = { ...FRONT, face: 'faceFrontStrain' };
export const FRONT_DAZED = { ...FRONT, face: 'faceFrontDazed' };
export const FRONT_WIDE = { ...FRONT, face: 'faceFrontWide' };
/** Three-quarter view towards his facing, as in the official art. */
export const SIDE = look('head3q', 'face3q', 'hat3q');
export const BLINK = { ...SIDE, face: 'face3qBlink' };
export const ANGRY = { ...SIDE, face: 'face3qAngry' };
export const SHOUT = { ...SIDE, face: 'face3qShout' };
export const GRIN = { ...SIDE, face: 'face3qGrin' };
export const HURT = { ...SIDE, face: 'face3qHurt' };
export const WIDE = { ...SIDE, face: 'face3qWide' };

/** The night-stick out of his belt and in his front fist. */
export const BATON = { baton: 'baton', handF: 'fist' };
export const FISTS = { handF: 'fist', handB: 'fist' };
export const FIST_B = { handB: 'fist' };
/** The loot sack in his back fist. */
export const SACK = { sack: 'sack', handB: 'fist' };
/** The loot sack slung over his shoulder. */
export const SACK_ON_BACK = { sackBack: 'sack', handB: 'fist' };

const index = (slot: string) => rig.slots.findIndex((s) => s.name === slot);
/** Draw orders: the front arm (and what it holds) over the head, the back arm in front of the body, and so on. */
const above = (slot: string, names: string[]) =>
  Object.fromEntries(names.map((name, i) => [name, index(slot) + 0.05 + i * 0.01]));
export const FRONT_ARM_OVER_HEAD = above('gear', [
  'armFLine',
  'foreFLine',
  'armF',
  'foreF',
  'baton',
  'gun',
  'handF',
]);
export const BACK_ARM_IN_FRONT = above('torso', ['armBLine', 'foreBLine', 'armB', 'foreB', 'sack', 'handB']);
export const ARMS_OVER_HEAD = {
  ...above('gear', ['armBLine', 'foreBLine', 'armB', 'foreB', 'sack', 'handB']),
  ...above('handB', []),
  ...Object.fromEntries(
    ['armFLine', 'foreFLine', 'armF', 'foreF', 'baton', 'gun', 'handF'].map((n, i) => [
      n,
      index('gear') + 0.2 + i * 0.01,
    ]),
  ),
};
export const SACK_IN_FRONT = above('fx3', ['sack']);
export const HEAD_BEHIND = {
  head: index('fxBack') + 0.2,
  face: index('fxBack') + 0.21,
  hat: index('fxBack') + 0.22,
  gear: index('fxBack') + 0.23,
};

/** Standing at ease, facing the camera, arms hanging just off the shirt. */
export const STAND: Pose = feet({}, floor(-1.05), floor(1.05), true);

/** Breathing in: a little taller, shoulders up. */
export const BREATHE: Pose = feet(
  { hip: { y: -0.04 }, torso: { sy: 1.02 }, neck: { y: -0.05 }, armF: { rot: 3 }, armB: { rot: -3 } },
  floor(-1.05),
  floor(1.05),
  true,
);

/** The fighting stance: side-on, knees bent, weight forward, fists up. */
export const READY: Pose = hands(
  feet({ body: { rot: 4 }, hip: { y: 0.24 }, neck: { rot: -3 } }, floor(-1.6), floor(1.5), false),
  [-0.2, -4.37],
  [2.6, -4.55],
);

export const CROUCH: Pose = hands(
  feet({ hip: { y: 0.91 }, neck: { y: 0.3 }, body: { rot: 8 } }, floor(-1.5), floor(1.6), true),
  [-1.2, -2.46],
  [2.4, -2.62],
);

/** Airborne, limbs loose. */
export const AIR: Pose = {
  thighF: { rot: -30 },
  shinF: { rot: 45 },
  thighB: { rot: 14 },
  shinB: { rot: 30 },
  armF: { rot: -40 },
  foreF: { rot: -30 },
  armB: { rot: 35 },
  foreB: { rot: 25 },
};

/** Balled up: knees to the chest, arms hugging them. */
export const TUCK: Pose = {
  hip: { y: -0.42 },
  thighF: { rot: -100 },
  shinF: { rot: 125 },
  thighB: { rot: -75 },
  shinB: { rot: 125 },
  armF: { rot: -60 },
  foreF: { rot: -70 },
  armB: { rot: -20 },
  foreB: { rot: -60 },
  neck: { y: 0.45 },
};
