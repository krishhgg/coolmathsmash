import { pointOf, type Pose } from '../../../render/rig/author';
import type { Key } from '../../../render/rig/types';
import { R, TONGUE } from './parts';
import { rig } from './rig';

/**
 * Authoring vocabulary for Red Ball's clips. Rig space: y down, his bottom at the origin, facing right; rot > 0
 * is clockwise, so a positive `spin` rolls him forwards.
 */

export type Pt = readonly [number, number];
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

/** Squash (sx > 1, sy < 1) or stretch about the floor under him, his bottom planted; `x` slides, `lift` hops. */
export const ground = (sx = 1, sy = 1, x = 0, lift = 0): Pose => ({ base: { sx, sy, x, y: -lift } });

/** Squash or stretch about his centre, for the air; `x` and `y` move the ball off the base. */
export const body = (sx = 1, sy = 1, x = 0, y = 0): Pose => ({ core: { sx, sy, x, y } });

/**
 * `body` on the floor: a stretch about his centre would push his bottom through the floor, so a stretched ball
 * (sy > 1) is lifted by as much and stays standing on it. A squash still lifts his bottom off the floor, as `body`.
 */
export const stood = (sx = 1, sy = 1, x = 0): Pose => body(sx, sy, x, -Math.max(0, sy - 1) * R);

/** Turns the face: rolling, spinning and leaning (degrees, > 0 rolls forwards). */
export const roll = (deg: number): Pose => ({ spin: { rot: deg } });

/** Slides the face across the ball (turning towards or away), `sx` < 1 foreshortens it. */
export const look = (x: number, y = 0, sx = 1, sy = 1): Pose => ({ face: { x, y, sx, sy } });

type Fx = 'fx1' | 'fx2' | 'fx3' | 'fx4';

/** Effect bone pose: the bone's symbol at rig point (x, y), scaled by `s` (`sy` apart), turned by `rot`. */
export const fx = (bone: Fx, x: number, y: number, s = 1, rot = 0, sy = s): Pose => ({
  [bone]: { x, y, rot, sx: s, sy },
});

/** Degrees the face turns per unit rolled along the floor: a ball of radius 5.25 rolls without slipping. */
export const DEG_PER_UNIT = 180 / (Math.PI * 5.25);

/**
 * Sticks the tongue out of `pose`'s mouth to rig point `to`, so the round tip's centre lands on it. Works out the
 * angle and stretch from wherever the face is.
 */
export function lick(pose: Pose, to: Pt): Pose {
  const [mx, my] = pointOf(rig, pose, 'tongue');
  const [fx0, fy0] = pointOf(rig, pose, 'face');
  const [fx1, fy1] = pointOf(rig, pose, 'face', 1, 0);
  const faceAngle = Math.atan2(fy1 - fy0, fx1 - fx0);
  const faceScale = Math.hypot(fx1 - fx0, fy1 - fy0);
  const angle = Math.atan2(to[1] - my, to[0] - mx);
  const dist = Math.hypot(to[0] - mx, to[1] - my) / faceScale;
  const rot = Math.round(((angle - faceAngle) * 18000) / Math.PI) / 100;
  return mix(pose, { tongue: { rot, sx: Math.max(0.12, (dist - 0.35) / TONGUE) } });
}

/**
 * `lick` for a long tongue out of a squashed or stretched ball: the ball's uneven scale bends the tongue off the
 * line `lick` aims along, which shows at Tongue Lash's length, so this re-aims four times until the tip's centre
 * lands on `to`.
 */
export function lickAt(pose: Pose, to: Pt): Pose {
  let aim: Pt = to;
  let out = lick(pose, aim);
  for (let i = 0; i < 4; i++) {
    const [x, y] = pointOf(rig, out, 'tongueTip', 0.35, 0);
    aim = [aim[0] + to[0] - x, aim[1] + to[1] - y];
    out = lick(pose, aim);
  }
  return out;
}

/** A tongue pulled back into the mouth (still drawn, tiny). */
export const TONGUE_IN: Pose = { tongue: { sx: 0.12 } };

const face = (eyes: string, brow: string | null, mouth: string | null) => ({ eyes, brow, mouth });
/** His signature look: brow down, eyes on the opponent, sideways smirk. */
export const DETERMINED = face('eyesDetermined', 'browAngry', 'mouthSmirk');
export const DETERMINED_UP = face('eyesDeterminedUp', 'browAngry', 'mouthSmirk');
export const DETERMINED_DOWN = face('eyesDeterminedDown', 'browAngry', 'mouthSmirk');
export const GRIT = face('eyesDetermined', 'browAngry', 'mouthGrit');
export const GRIT_UP = face('eyesDeterminedUp', 'browAngry', 'mouthGrit');
export const GRIT_DOWN = face('eyesDeterminedDown', 'browAngry', 'mouthGrit');
export const SHOUT = face('eyesDetermined', 'browAngry', 'mouthOpen');
export const SMILE = face('eyesOpen', null, 'mouthSmile');
export const HAPPY = face('eyesUp', null, 'mouthHappy');
export const GRIN = face('eyesShut', null, 'mouthHappy');
export const WHEE = face('eyesUp', null, 'mouthGrin');
export const HURT = face('eyesHurt', 'browWorried', 'mouthHurt');
export const SHOCK = face('eyesWide', 'browRaised', 'mouthOpen');
export const DIZZY = face('eyesDizzy', null, 'mouthFrown');
export const WORRY = face('eyesOpen', 'browWorried', 'mouthFrown');
export const FLINCH = face('eyesHurt', 'browWorried', 'mouthGrit');
export const STRAIN = face('eyesUp', 'browWorried', null);
export const SPIT = face('eyesShut', 'browAngry', 'mouthSpit');
export const BLINK = { eyes: 'eyesBlink' };

const TONGUE_OUT = { tongue: 'tongue', tongueTip: 'tongueTip' };
/** Tongue out, eyes on the target. */
export const LICK_AIM = { ...face('eyesDetermined', 'browAngry', 'mouthLick'), ...TONGUE_OUT };
/** Tongue out, eyes shut with glee. */
export const LICK = { ...face('eyesShut', null, 'mouthLick'), ...TONGUE_OUT };
/** Mouth open, tongue back in. */
export const MOUTH_OPEN = {
  ...face('eyesDetermined', 'browAngry', 'mouthLick'),
  tongue: null,
  tongueTip: null,
};
