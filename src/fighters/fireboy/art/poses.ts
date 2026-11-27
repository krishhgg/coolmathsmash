import { reach, type Pose } from '../../../render/rig/author';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import type { AnimClip, BonePose, FighterArt, Key } from '../../../render/rig/types';
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
/** Mitten hands, for holding on. */
export const MITTENS = { foreF: 'mitten', foreFLine: 'mittenLine', foreB: 'mitten', foreBLine: 'mittenLine' };
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

/**
 * Draw orders. Slots: aura 0, fxBack 1, back arm 2-5, torso line 6, back leg 7-10, front leg 11-14, torso 15,
 * front arm 16-19, head 20, face 21, fx 22-24.
 */
export const HEAD_BEHIND = { head: 0.5, face: 0.6 };
export const ARMS_IN_FRONT = {
  armBLine: 21.1,
  foreBLine: 21.2,
  armB: 21.3,
  foreB: 21.4,
  armFLine: 21.5,
  foreFLine: 21.6,
  armF: 21.7,
  foreF: 21.8,
};
export const FRONT_ARM_IN_FRONT = { armFLine: 21.5, foreFLine: 21.6, armF: 21.7, foreF: 21.8 };
export const LEGS_IN_FRONT = {
  thighFLine: 21.1,
  shinFLine: 21.2,
  thighF: 21.3,
  shinF: 21.4,
  thighBLine: 21.05,
  shinBLine: 21.06,
  thighB: 21.07,
  shinB: 21.08,
};

/** Standing, relaxed, like the 2009 idle drawing. */
export const STAND = feet({ hip: { y: 0.02 } }, [-0.45, 0], [0.45, 0], true);

/** Knees bent, head squashed into the shoulders. */
export const CROUCH = hands(
  feet({ hip: { y: 1.0 }, neck: { y: 0.3 }, head: { sx: 1.1, sy: 0.86 } }, [-0.8, 0], [0.9, 0], true),
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

/**
 * Keeps every limb and effect turning the short way round between keys. The IK helpers return angles wrapped to
 * half a turn either way, so a limb passing straight up or down would otherwise tween the long way round.
 *
 * Bob's `continuous` takes the short way at each joint, or with `onScreen` the short way on screen. For Fireboy
 * neither is right everywhere. Short at each joint, an upper arm and forearm can each turn 150 degrees the same
 * way and swing the hand 300 degrees round. Short on screen, a forearm can turn back through its elbow while the
 * arm swings, or a limb can turn against the body in a flip. So each bone takes the whole turns that keep twice
 * its turn at the joint plus its turn against the body (its own turn plus its parents' below the body) smallest:
 * short at the joint unless that swings the limb much further round. The body is never wrapped, so a flip still
 * spins and carries the rest with it.
 */
export function continuous(keys: Key[]): Key[] {
  /** Each bone's turn at its joint, and against the body, at the last posed key. */
  const own: Record<string, number> = {};
  const held: Record<string, number> = {};
  return keys.map((k) => {
    if (!k.pose) return k;
    const pose = { ...k.pose };
    const now: Record<string, number> = {};
    for (const { name, parent } of rig.bones) {
      let r = pose[name]?.rot ?? 0;
      if (name !== 'body') {
        const above = parent && parent !== 'body' ? now[parent]! : 0;
        if (own[name] !== undefined) {
          const short = r + 360 * Math.round((own[name] - r) / 360);
          const cost = (t: number) => 2 * Math.abs(t - own[name]!) + Math.abs(above + t - held[name]!);
          r = [short - 360, short + 360].reduce((best, t) => (cost(t) < cost(best) ? t : best), short);
        }
        if (r !== 0 || pose[name]?.rot !== undefined) pose[name] = { ...pose[name], rot: r };
        now[name] = above + r;
      }
      own[name] = r;
    }
    Object.assign(held, now);
    return { ...k, pose };
  });
}

/** Slots that draw effects rather than Fireboy himself: `floorContact` leaves them out. */
const EFFECTS = new Set(['aura', 'fxBack', 'fx1', 'fx2', 'fx3']);

/**
 * Bakes a grounded clip into one key a frame, each lifted so no part of his body dips under the floor between the
 * keys that plant his feet (IK keys tween joint angles, so a planted foot sinks while the knee swings). Swaps, draw
 * order and the tween's timing are kept; a frame already on or above the floor stays where it is. Effects are left
 * out of the measure.
 */
export function floorContact(clip: AnimClip): AnimClip {
  const art: FighterArt = { rig, clips: { contact: clip }, palettes: { default: {} }, height: 0, icon: '' };
  const body: FighterArt = { ...art, rig: { ...rig, slots: rig.slots.filter((s) => !EFFECTS.has(s.name)) } };
  return {
    ...clip,
    keys: Array.from({ length: clip.length + 1 }, (_, frame) => {
      const sampled = samplePose(art, 'contact', frame, frame);
      const dip = Math.max(0, poseBounds(body, sampled)[3]);
      const pose: Pose = Object.fromEntries(
        rig.bones.map(({ name, x, y, rot = 0, sx = 1, sy = 1 }) => {
          const p = sampled.local[name]!;
          return [name, { x: p.x - x, y: p.y - y, rot: p.rot - rot, sx: p.sx / sx, sy: p.sy / sy }];
        }),
      );
      const here = clip.keys.filter((k) => k.frame === frame);
      const step = here.some((k) => k.pose && k.ease === 'step');
      const swaps = [...here].reverse().find((k) => k.swaps)?.swaps;
      const z = [...here].reverse().find((k) => k.z)?.z;
      return key(frame, mix(pose, { body: { y: pose.body!.y! - dip } }), {
        ease: step ? 'step' : 'linear',
        ...(swaps ? { swaps } : {}),
        ...(z ? { z } : {}),
      });
    }),
  };
}
