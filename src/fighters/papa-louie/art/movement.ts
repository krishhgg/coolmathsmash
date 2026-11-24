import type { AnimClip } from '../../../render/rig/types';
import { STAND, key, mix } from './poses';

/** Papa Louie's action clips: standing, moving, jumping, defending, ledge, hurt and grab states. */
export const movement: Record<string, AnimClip> = {
  idle: {
    length: 60,
    loop: true,
    keys: [key(0, STAND), key(30, mix(STAND, { body: { y: 0.12 }, torso: { sy: 0.985 } }))],
  },
};
