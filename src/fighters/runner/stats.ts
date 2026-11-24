import type { FighterStats } from '../types';

/**
 * The Runner from Run (2008): a light grey alien with Sonic's ground speed (the roster video: "he will have Sonic's
 * speed") on Kirby's weight. Values follow handoffs/research/roster.md, with the Ultimate template of each in its
 * comment.
 */
export const stats: FighterStats = {
  /** Kirby 79. */
  weight: 79,
  height: 13,
  width: 7,

  /** Sonic 1.444. */
  walkSpeed: 1.444,
  walkAccelBase: 0.105,
  walkAccelAdd: 0.105,
  /** Sonic 0.138, the best traction in Ultimate: she stops on a dime after a run. */
  groundFriction: 0.138,
  /** Sonic 2.31. */
  dashInitialSpeed: 2.31,
  dashFrames: 11,
  /** Sonic 3.85: ties him as the fastest runner in the cast. */
  runSpeed: 3.85,
  runAccelBase: 0.08,
  runAccelAdd: 0.08,

  /** Sheik 1.155 (in Run, air speed is about 94% of ground strafe speed). */
  airSpeed: 1.155,
  /** Cloud 0.07 in total. */
  airAccelBase: 0.01,
  airAccelAdd: 0.06,
  airFriction: 0.01,
  /** Sonic 0.09, 1.65 and 2.64. */
  gravity: 0.09,
  fallSpeed: 1.65,
  fastFallSpeed: 2.64,

  jumpSquat: 3,
  /** Sonic 35, 16.89 and 35; two jumps, not Kirby's multi-jump (the video). */
  fullHopHeight: 35,
  shortHopHeight: 16.89,
  doubleJumpHeight: 35,
  jumps: 2,
  ledgeJumpHeight: 37,

  softLandingLag: 1,
  hardLandingLag: 3,

  shieldSize: 8.8,
  rollDistance: 30,
  airDodgeSpeed: 2.8,
};
