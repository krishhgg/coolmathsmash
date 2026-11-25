import type { Pose } from '../../../render/rig/author';
import type { BonePose, Key } from '../../../render/rig/types';
import { FACE } from './parts';
import { CENTRE } from './rig';

/**
 * Authoring vocabulary for Fluffy's clips. Rig space: y down, feet (the bottom of the ball) at the origin, facing
 * right; rot > 0 is clockwise, so a ball rolling forwards spins positive.
 */

export type Pt = readonly [number, number];

/** The grabber, aimed from one rig point to another. `near` picks the turn (deg) closest to it, for sweeps. */
export interface Aim {
  from: Pt;
  to: Pt;
  near?: number;
}

export interface Ball {
  /** Body offset from rest, in units. */
  x?: number;
  y?: number;
  /** Lean in degrees (positive leans forwards). */
  tilt?: number;
  /** Squash and stretch. The ball stays on the floor unless `float` squashes it about its centre. */
  sx?: number;
  sy?: number;
  float?: boolean;
  /** Fur only: turn (degrees, for rolling) and puff (scale). */
  spin?: number;
  puff?: number;
  /** Moves or turns the eyes over the ball (`sx: -1` looks back). */
  face?: BonePose;
  /** Pupil offset inside the eyes. */
  look?: Pt;
  /** The grabber line (shown by the GRAB swaps). Without it, it waits coiled inside the ball. */
  grab?: Aim;
  /** Effect and prop bones, in rig space. */
  fx1?: BonePose;
  fx2?: BonePose;
  fx3?: BonePose;
}

const DEG = 180 / Math.PI;

/** Where the ball's centre is in a pose built by `ball` (rig space). */
export function centreOf(b: Ball): [number, number] {
  const sy = b.sy ?? 1;
  return [b.x ?? 0, -CENTRE + (b.y ?? 0) + (b.float ? 0 : CENTRE * (1 - sy))];
}

/** Grab bone pose for a line from `from` to `to` (rig space). */
export function aim({ from, to, near = 0 }: Aim): BonePose {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  let rot = Math.atan2(dy, dx) * DEG;
  rot += Math.round((near - rot) / 360) * 360;
  return {
    x: from[0],
    y: from[1] + CENTRE,
    rot: Math.round(rot * 100) / 100,
    sx: Math.max(0.05, Math.round(Math.hypot(dx, dy) * 1000) / 1000),
  };
}

/** A full pose of the ball. */
export function ball(b: Ball = {}): Pose {
  const sx = b.sx ?? 1;
  const sy = b.sy ?? 1;
  const [cx, cy] = centreOf(b);
  const pose: Pose = {
    body: { x: cx, y: cy + CENTRE, rot: b.tilt ?? 0, sx, sy },
    grab: aim(b.grab ?? { from: [cx, cy], to: [cx + 0.6, cy] }),
  };
  if (b.spin !== undefined || b.puff !== undefined)
    pose.fur = { rot: b.spin ?? 0, sx: b.puff ?? 1, sy: b.puff ?? 1 };
  if (b.face) pose.face = b.face;
  if (b.look) pose.pupils = { x: b.look[0], y: b.look[1] };
  if (b.fx1) pose.fx1 = b.fx1;
  if (b.fx2) pose.fx2 = b.fx2;
  if (b.fx3) pose.fx3 = b.fx3;
  return pose;
}

export function key(frame: number, pose?: Pose, extra: Omit<Key, 'frame' | 'pose'> = {}): Key {
  return pose ? { frame, pose, ...extra } : { frame, ...extra };
}

/** Face offset that turns the eyes to look behind him (the face mirrored across the ball). */
export const LOOK_BACK: BonePose = { x: -2 * FACE[0], sx: -1 };

/** Effect bone pose: a drawing at rig point (x, y), scaled. */
export const at = (x: number, y: number, s = 1, rot = 0): BonePose => ({ x, y, sx: s, sy: s, rot });

/** Swap sets: the grabber, the fur and the expressions. */
export const GRAB = { grabLine: 'line', tip: 'tip' };
export const WHIP = { grabLine: 'lineWave', tip: 'tip' };
export const BLINK = { lids: 'blink' };
export const HALF = { lids: 'lidsHalf' };
/** Wide-eyed and intent, pupils narrowed on the target: his look for most attacks. */
export const FOCUS = { pupils: 'pupilsFocus' };
export const SAD = { lids: 'lidsSad' };
export const EFFORT = { pupils: 'pupilsFocus', mouth: 'mouthEffort' };
/** Brows down: kept for the forward smash charge and Stick Tight. */
export const FIERCE = { lids: 'lidsAngry', mouth: 'mouthEffort' };
export const SHOCK = { pupils: 'pupilsSmall', mouth: 'mouthO' };
export const HURT = { lids: 'squeeze', mouth: 'mouthO' };
export const DIZZY = { pupils: 'pupilsDizzy', lids: 'lidsHalf', fur: 'furFlat' };
export const HAPPY = { lids: 'blink', mouth: 'mouthSmile' };
export const RUN_FUR = { fur: 'furRun' };
export const FALL_FUR = { fur: 'furFall' };
export const FLAT_FUR = { fur: 'furFlat' };
export const PUFF = { fur: 'furPuff' };
export const BRISTLE = { fur: 'furBristle' };
export const DUST = { fx: 'dust' };
