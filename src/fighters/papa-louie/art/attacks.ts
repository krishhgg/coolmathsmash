import type { AnimClip } from '../../../render/rig/types';

/**
 * Papa Louie's move clips, one per move in ../moves.ts with the same name. Smash numbering (frame 1 is the move's
 * first frame) and length = FAF - 1; the paddle's face covers the far hitbox through each hit window.
 */
export const attacks: Record<string, AnimClip> = {};
