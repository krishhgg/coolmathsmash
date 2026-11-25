import type { Pose } from '../../../render/rig/author';
import type { BonePose, Key } from '../../../render/rig/types';
import { BODY, type Pt } from './parts';

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
