import type { FighterStats } from '../types';

/**
 * Fireboy: a light, quick fighter with high jumps (he leaps a long way in Fireboy and Watergirl).
 * Tuned around Ultimate's middleweights; see the reference fighter in src/sim/testing for Mario's values.
 */
export const stats: FighterStats = {
  weight: 84,
  height: 15,
  width: 8,

  walkSpeed: 1.1,
  walkAccelBase: 0.1,
  walkAccelAdd: 0.1,
  groundFriction: 0.1,
  dashInitialSpeed: 1.95,
  dashFrames: 11,
  runSpeed: 1.85,
  runAccelBase: 0.05,
  runAccelAdd: 0.1,

  airSpeed: 1.15,
  airAccelBase: 0.01,
  airAccelAdd: 0.065,
  airFriction: 0.015,
  gravity: 0.09,
  fallSpeed: 1.55,
  fastFallSpeed: 2.48,

  jumpSquat: 3,
  fullHopHeight: 34,
  shortHopHeight: 16,
  doubleJumpHeight: 33,
  jumps: 2,
  ledgeJumpHeight: 36,

  softLandingLag: 1,
  hardLandingLag: 3,

  shieldSize: 9,
  rollDistance: 28,
};
