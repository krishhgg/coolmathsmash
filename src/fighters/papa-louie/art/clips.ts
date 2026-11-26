import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip } from '../../../render/rig/types';
import { GETUP_ROLL } from '../../../sim/constants';
import { attacks } from './attacks';
import { movement } from './movement';

export const clips: Record<string, AnimClip> = {
  ...movement,
  ...attacks,
  /**
   * The tech roll on the getup roll's timeline: the roll itself (frames 3-24) stays inside the sim's travel window,
   * and only the rise to standing is shortened, to 35 frames in all.
   */
  getupRoll: retimeClip(movement.techRoll!, GETUP_ROLL.faf - 1, [[24, 24]]),
};
