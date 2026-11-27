import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip } from '../../../render/rig/types';
import { GETUP_ROLL, TECH_ROLL } from '../../../sim/constants';
import { attacks } from './attacks';
import { finalSmashClips } from './finalSmash';
import { movement } from './movement';
import { onFloor } from './poses';

export const clips: Record<string, AnimClip> = {
  ...movement,
  ...attacks,
  ...finalSmashClips,
  /**
   * The tech roll on the getup roll's timeline: the roll itself (frames 3-24) stays inside the sim's travel window,
   * and only the rise to standing is shortened, to 35 frames in all.
   */
  getupRoll: retimeClip(movement.techRoll!, GETUP_ROLL.faf - 1, [[24, 24]]),
  /** Tech and getup rolls away from the facing: the back roll with its frames moved onto each action's travel. */
  techRollBack: retimeClip(movement.rollBack!, TECH_ROLL.faf - 1, [
    [4, 4],
    [20, 30],
  ]),
  getupRollBack: retimeClip(movement.rollBack!, GETUP_ROLL.faf - 1, [
    [4, 4],
    [20, 28],
  ]),
};

/**
 * Clips whose crouches would sink the apron's hem below the floor, baked with it tucked up against the floor
 * (`onFloor`), and the back rolls, where his toque or a shoe would dip below it as he rolls.
 */
for (const name of [
  'turn',
  'spotDodge',
  'dtilt',
  'dashAttack',
  'fsmash',
  'usmash',
  'dsmash',
  'getupAttack',
  'grab',
  'dashGrab',
  'pivotGrab',
  'bthrow',
  'uthrow',
  'dthrow',
  'finalSmash',
  'techRollBack',
  'getupRollBack',
])
  clips[name] = onFloor(clips[name]!);
