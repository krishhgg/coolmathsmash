import { pointOf, type Pose } from '../../../render/rig/author';
import { samplePose } from '../../../render/rig/sample';
import type { AnimClip, BonePose, FighterArt, Key } from '../../../render/rig/types';
import { BODY, EXHAUST, HORN, WHEEL_R, WHEEL_X, WHEEL_Y, type Pt } from './parts';
import { rig } from './rig';

/**
 * Authoring vocabulary for Wheely's clips. Rig space: y down, the ground between the wheels at the origin, facing
 * right; rot > 0 is clockwise (the nose dips), rot < 0 lifts the nose.
 */

export type { Pose };

export function key(frame: number, pose?: Pose, extra: Omit<Key, 'frame' | 'pose'> = {}): Key {
  return pose ? { frame, pose, ...extra } : { frame, ...extra };
}

/** Merges poses bone by bone (later wins per field). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) for (const [bone, bp] of Object.entries(p)) out[bone] = { ...out[bone], ...bp };
  return out;
}

/**
 * Tilts the car by `rot` degrees about rig point `p` (a tyre's contact patch for a wheelie or a nose dive), plus an
 * extra lift: the body bone is moved so that point stays put.
 */
export function tilt(rot: number, p: Pt = [0, BODY[1]], dx = 0, dy = 0): Pose {
  const r = (rot * Math.PI) / 180;
  const [qx, qy] = [p[0] - BODY[0], p[1] - BODY[1]];
  const x = qx - (qx * Math.cos(r) - qy * Math.sin(r)) + dx;
  const y = qy - (qx * Math.sin(r) + qy * Math.cos(r)) + dy;
  return { body: { rot, x, y } };
}

/** Both wheels spun to `deg` (keyed rotation; positive rolls forward). */
export const spin = (deg: number, front = deg): Pose => ({ spinB: { rot: deg }, spinF: { rot: front } });

/** Squash (sy < 1) or stretch from the ground up, keeping the volume roughly constant. */
export function squash(sy: number, sx = 1 + (1 - sy) * 0.6): Pose {
  return { car: { sx, sy } };
}

/** Suspension: the shell sinks (dy > 0) or rises over the wheels; the wheels hang lower in the air. */
export const bob = (dy: number, droop = 0): Pose => ({
  shell: { y: dy },
  wheelB: { y: droop },
  wheelF: { y: droop },
});

/** An effect bone pose: (x, y), uniform scale, rotation. */
export const at = (x: number, y: number, s = 1, rot = 0, sy = s): BonePose => ({ x, y, sx: s, sy, rot });

/** Loop keys spinning the wheels `turns` full turns over `length` frames, on top of `poses` spread evenly. */
export function rolling(length: number, turns: number, poses: Pose[]): Key[] {
  const q = length / poses.length;
  return [
    ...poses.map((p, i) => key(i * q, mix(p, spin((360 * turns * i) / poses.length)), { ease: 'linear' })),
    key(length, mix(poses[0]!, spin(360 * turns)), { ease: 'linear' }),
  ];
}

const face = (eyes: string) => ({ eyes });
export const IDLE_FACE = face('eyesIdle');
export const FOCUS = face('eyesFocusIdle');
export const ANGRY = face('eyesAngry');
export const SHOUT = face('eyesShout');
export const SURPRISED = face('eyesSurprised');
export const HURT = face('eyesHurt');
export const DIZZY = face('eyesDizzy');
export const UP = face('eyesUp');
export const DOWN = face('eyesDown');
export const BACK = face('eyesBack');
export const SCARED = face('eyesScared');
export const CLOSED = face('eyesClosed');

export const BLUR = { wheelB: 'wheelBlur', wheelF: 'wheelBlur' };
export const OPEN_DOOR = { door: 'door', doorGap: 'doorGap' };
/** The door swung open past square, so its inside shows (scale the door bone's x below zero). */
export const SCOOP = { door: 'doorInside', doorGap: 'doorGap' };
export const OPEN_HOOD = { hood: 'hood', hoodBay: 'hoodBay' };

export const DEG = Math.PI / 180;
/** Tyre contact patches: wheelies pivot on the rear one, nose dives on the front one. */
export const REAR: Pt = [-WHEEL_X, 0];
export const FRONT: Pt = [WHEEL_X, 0];
/** The front wheel's centre. */
export const WHEEL: Pt = [WHEEL_X, WHEEL_Y];

/** Degrees a tyre turns rolling `d` units. */
export const roll = (d: number) => d / WHEEL_R / DEG;

export const PARK: Pose = {};
/** Airborne: the shell rides up and the wheels hang on their springs. */
export const AIR = bob(-0.12, 0.45);
export const LOW = mix(squash(0.88), bob(0.5));
export const SQUAT = mix(squash(0.8), bob(0.55));
export const HOLD = mix(bob(0.15), tilt(1.5, FRONT), { door: { sx: -1.62, sy: 1.04 } });

/** Rotated `rot` degrees about the middle and lifted just clear of the ground, for flips near the floor. */
export function flip(rot: number, extra = 0): Pose {
  const r = rot * DEG;
  const up = Math.cos(r) >= 0 ? 5.2 : 5.45;
  const lift = Math.max(0, 9.3 * Math.abs(Math.sin(r)) + up * Math.abs(Math.cos(r)) - 5.2);
  return tilt(rot, BODY, 0, -lift - extra);
}

/** On his roof, rocking on the rack, with the eyes turned back upright. */
export const UPSIDE_DOWN = mix(tilt(180, BODY, 0, -0.25), { eyes: { rot: 180, y: 0.6 } });

/** `pose` plus effect bone `fx` pinned to rig point `p` of the car and turned with it. */
export function fxOn(pose: Pose, fx: string, p: Pt, s = 1, rot = 0, sy = Math.abs(s)): Pose {
  const [x, y] = pointOf(rig, pose, 'shell', p[0] - BODY[0], p[1] - BODY[1]);
  return mix(pose, { [fx]: at(x, y, s, rot + (pose.body?.rot ?? 0), sy) });
}

/** Exhaust smoke (fxBack) just behind the pipe. */
export const smoke = (pose: Pose, s = 0.5) => fxOn(pose, 'fx4', [EXHAUST[0] - 0.8 * s, EXHAUST[1] - 0.15], s);

/** Horn waves (fx1) opening forward from the horn. */
export const honk = (pose: Pose, s: number) => fxOn(pose, 'fx1', [HORN[0] + 0.5, HORN[1]], s);

/**
 * An effect bone for a smear (fxSwoosh, fxSwipe) of radius `r` round (cx, cy) with its head at `head` degrees
 * (counter-clockwise from +x), trailing behind a clockwise swing, or a counter-clockwise one (mirrored).
 */
export function trail(cx: number, cy: number, r: number, head: number, clockwise = true): BonePose {
  return clockwise ? at(cx, cy, r, -(head + 20)) : at(cx, cy, r, -(head - 20), -r);
}

/**
 * The most a wheel drawn plain may turn in a frame. Its five bolts repeat every 72 degrees, so past half that the eye
 * reads the wheel turning the other way.
 */
export const PLAIN_TURN = 36;

/** Each wheel's slot, under its spin bone. */
const WHEELS = [
  ['wheelB', 'spinB'],
  ['wheelF', 'spinF'],
] as const;

/**
 * Draws a wheel blurred (wheelBlur) on any frame it turns more than PLAIN_TURN degrees from the frame before, as the
 * clips do for driving. A clip that needs it is baked to a key a frame; the rest are returned as they are.
 */
export function blurFast(clip: AnimClip): AnimClip {
  const art = { rig, clips: { c: clip }, palettes: { default: {} }, height: 0, icon: '' } as FighterArt;
  const last = clip.loop ? clip.length - 1 : clip.length;
  const poses = Array.from({ length: last + 1 }, (_, f) => samplePose(art, 'c', f, f));
  const turn = (f: number, bone: string) => {
    let deg = 0;
    for (let b: string | undefined = bone; b; b = rig.bones.find((x) => x.name === b)!.parent)
      deg += poses[f]!.local[b]!.rot;
    return deg;
  };
  const blur = poses.map((p, f) =>
    WHEELS.filter(
      ([slot, bone]) =>
        f > 0 && p.symbols[slot] === 'wheel' && Math.abs(turn(f, bone) - turn(f - 1, bone)) > PLAIN_TURN,
    ).map(([slot]) => slot),
  );
  if (blur.every((b) => !b.length)) return clip;
  const keys = poses.map((p, f) => {
    const pose: Pose = Object.fromEntries(
      rig.bones.map(({ name, x, y, rot = 0, sx = 1, sy = 1 }) => {
        const b = p.local[name]!;
        return [name, { x: b.x - x, y: b.y - y, rot: b.rot - rot, sx: b.sx / sx, sy: b.sy / sy }];
      }),
    );
    let swaps: Key['swaps'];
    let z: Key['z'];
    for (const k of clip.keys) {
      if (k.frame > f) break;
      if (k.swaps) swaps = k.swaps;
      if (k.z) z = k.z;
    }
    if (blur[f]!.length)
      swaps = { ...swaps, ...Object.fromEntries(blur[f]!.map((slot) => [slot, 'wheelBlur'])) };
    // Every key states its swaps, an empty map where the clip has none, since a key without them keeps the last
    // key's: a blur would otherwise hold until the clip's next authored swap.
    return key(f, pose, { ease: 'linear', swaps: swaps ?? {}, ...(z ? { z } : {}) });
  });
  return { ...clip, keys };
}

const EFFECT_BONES = ['fx1', 'fx2', 'fx3', 'fx4', 'prop'];

/**
 * Effect bones hold their last keyed placement until a later key moves them, the way a Flash layer holds its
 * symbol, so an effect that is still showing never drifts back to the origin between keys.
 */
export function holdEffects(clip: AnimClip): AnimClip {
  let held: Pose = {};
  const keys = clip.keys.map((k) => {
    if (!k.pose) return k;
    const pose = { ...held, ...k.pose };
    held = Object.fromEntries(Object.entries(pose).filter(([bone]) => EFFECT_BONES.includes(bone)));
    return { ...k, pose };
  });
  return { ...clip, keys };
}
