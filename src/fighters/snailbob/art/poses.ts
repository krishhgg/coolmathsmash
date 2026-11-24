import { pointOf, reach, type Pose } from '../../../render/rig/author';
import type { BonePose, Key } from '../../../render/rig/types';
import { FORE_ARM } from './parts';
import { rig } from './rig';
import type { Pt } from './shapes';

/**
 * Authoring vocabulary for Snail Bob's clips: keys, pose mixing, arm IK, and swap sets for his expressions, his
 * arms and his shell. Rig space: y down, feet at the origin, facing right; rot > 0 turns clockwise (the shell
 * leans forward, a stalk tips forward).
 */

export type { Pt };
export type Swaps = Record<string, string | null>;

export function key(frame: number, pose?: Pose, extra: Omit<Key, 'frame' | 'pose'> = {}): Key {
  return pose ? { frame, pose, ...extra } : { frame, ...extra };
}

/** Merges poses bone by bone (later wins per field). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) for (const [bone, bp] of Object.entries(p)) out[bone] = { ...out[bone], ...bp };
  return out;
}

/** Adds poses bone by bone: offsets add, scales multiply (for layering a sway on top of a pose). */
export function add(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses)
    for (const [bone, bp] of Object.entries(p)) {
      const o = (out[bone] ??= {});
      for (const k of ['x', 'y', 'rot'] as const) if (bp[k] !== undefined) o[k] = (o[k] ?? 0) + bp[k];
      for (const k of ['sx', 'sy'] as const) if (bp[k] !== undefined) o[k] = (o[k] ?? 1) * bp[k];
    }
  return out;
}

/** The fist (or hand) centre, this far down the forearm. */
export const HAND = FORE_ARM - 0.1;

/** Puts the fists on rig points (null leaves an arm alone); `bend` -1 drops the elbows. Arms stretch to reach. */
export function hands(pose: Pose, back: Pt | null, front: Pt | null, bend: 1 | -1 = -1): Pose {
  let p = pose;
  for (const [arm, fore, target] of [
    ['armB', 'foreB', back],
    ['armF', 'foreF', front],
  ] as const) {
    if (!target) continue;
    const [sx, sy] = pointOf(rig, p, arm);
    const s = Math.max(1, (Math.hypot(target[0] - sx, target[1] - sy) * 1.02) / 2 / HAND);
    p = reach(rig, mix(p, { [arm]: { sy: s }, [fore]: { sy: s } }), arm, fore, HAND, target, bend);
  }
  return p;
}

/** A free bone placed at rig point (x, y), turned `rot` and scaled `s` (or [sx, sy]). */
export function at(x: number, y: number, rot = 0, s: number | [number, number] = 1): BonePose {
  const [sx, sy] = typeof s === 'number' ? [s, s] : s;
  return { x, y, rot, sx, sy };
}

/* ---------------------------------------------------------------- expressions */

const face = (eye: string | null, pupil: string | null, lid: string | null, mouth: string | null): Swaps => ({
  eyeF: eye,
  eyeB: eye,
  pupilF: pupil,
  pupilB: pupil,
  lidF: lid,
  lidB: lid,
  mouth,
});
export const HAPPY = face('eye', 'pupil', 'lid', 'smile');
export const BLINK = face('eye', null, 'lidShut', 'grinClosed');
export const CALM = face('eye', 'pupil', 'lid', 'grinClosed');
export const DETERMINED = face('eye', 'pupil', 'lidAngry', 'grin');
/** Determined, mouth open in a yell. */
export const FIERCE = face('eye', 'pupil', 'lidAngry', 'gasp');
export const HURT = face('eyeWide', 'pupilSmall', 'lidUp', 'ouch');
export const STARTLED = face('eyeWide', 'pupilSmall', 'lidUp', 'gasp');
export const DAZED = face('eye', 'pupilSmall', 'lidHalf', 'ouch');
/** Wide-eyed and grinning (falling, the top of a jump). */
export const WIDE = face('eyeWide', 'pupil', 'lidUp', 'smile');

/* ---------------------------------------------------------------- arms and shell */

const arm = (side: 'F' | 'B', hand: string): Swaps => ({
  [`arm${side}`]: 'upperArm',
  [`arm${side}Line`]: 'upperArmLine',
  [`fore${side}`]: hand,
  [`fore${side}Line`]: `${hand}Line`,
});
export const FIST_F = arm('F', 'fist');
export const FIST_B = arm('B', 'fist');
export const FISTS = { ...FIST_F, ...FIST_B };
export const HANDS = { ...arm('F', 'hand'), ...arm('B', 'hand') };

const BODY_SLOTS = ['foot', 'neck', 'head', 'stalkB1', 'stalkB2', 'stalkF1', 'stalkF2'];
const FACE_SLOTS = ['eyeB', 'pupilB', 'lidB', 'eyeF', 'pupilF', 'lidF', 'mouth'];
/** Pulled into the shell: body and face hidden, eyes peeking out of the shell's mouth. */
export const IN_SHELL: Swaps = {
  ...Object.fromEntries(
    BODY_SLOTS.flatMap((s) => [
      [s, null],
      [`${s}Line`, null],
    ]),
  ),
  ...Object.fromEntries(FACE_SLOTS.map((s) => [s, null])),
  lip: 'lipPeek',
};
/** Spinning in the shell: the gloss and the peeking eyes go. */
export const SPINNING: Swaps = { ...IN_SHELL, lip: 'lipHole', gloss: null };

/** Shell pose offsets for sitting on the ground pulled in: the shell drops so its rim touches the floor. */
export const SHELL_DOWN: Pose = { shell: { x: 1.0, y: 2.1 } };
/** Centre of the dropped shell (rig space). */
export const SHELL_C: Pt = [-0.3, -4.4];

/* ---------------------------------------------------------------- base poses */

/** Standing (crawling) at rest. */
export const STAND: Pose = {};

/** The eyestalks offset as a whole: back pair and front pair turned by these (lower, upper) degrees. */
export function stalks(b1: number, b2: number, f1 = b1, f2 = b2, s = 1): Pose {
  return {
    stalkB1: { rot: b1, sy: s },
    stalkB2: { rot: b2, sy: s },
    stalkF1: { rot: f1, sy: s },
    stalkF2: { rot: f2, sy: s },
  };
}

/** Pupils shifted (eye space units; +x looks ahead, +y looks down). */
export function look(x: number, y: number): Pose {
  return { pupilF: { x, y }, pupilB: { x, y } };
}

/** Squashed low: shell sinks, foot spreads, head tucked and stalks shortened. */
export const CROUCH: Pose = mix(
  {
    shell: { y: 1.0, sx: 1.05, sy: 0.92 },
    foot: { sx: 1.08 },
    neck: { rot: 12, sy: 0.85 },
    head: { y: 0.4 },
  },
  stalks(-14, 10, -4, 8, 0.72),
);

/** Airborne: the body tilts nose-up a little, the tail droops, stalks trail. */
export const AIR: Pose = mix(
  { foot: { rot: -8 }, shell: { rot: -4 }, neck: { rot: -6 } },
  stalks(-12, -10, -8, -8),
);

/** Merges a pose for spinning: the whole snail turns around its middle by `deg`. */
export const turned = (pose: Pose, deg: number): Pose => mix(pose, { body: { ...pose.body, rot: deg } });
