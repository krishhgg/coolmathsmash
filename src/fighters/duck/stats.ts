import type { FighterStats } from '../types';

/**
 * The Duck (Duck Life): a light duckling built for running and flying. Ground speed from Pikachu, air drift from
 * Cloud, a floaty Peach gravity with Kirby's fall speeds, and five jumps (four midair flaps) for the multi-jump the
 * video asks for. Values and their Ultimate templates are in the roster's "### 7. The Duck" sheet.
 */
export const stats: FighterStats = {
  weight: 76,
  height: 11,
  width: 8,

  walkSpeed: 1.1,
  walkAccelBase: 0.1,
  walkAccelAdd: 0.1,
  groundFriction: 0.09,
  dashInitialSpeed: 1.98,
  dashFrames: 11,
  runSpeed: 2.039,
  runAccelBase: 0.08,
  runAccelAdd: 0.1,

  airSpeed: 1.155,
  airAccelBase: 0.01,
  airAccelAdd: 0.09,
  airFriction: 0.01,
  gravity: 0.07,
  fallSpeed: 1.23,
  fastFallSpeed: 1.968,

  jumpSquat: 3,
  fullHopHeight: 32,
  shortHopHeight: 15,
  doubleJumpHeight: 21,
  jumps: 5,
  ledgeJumpHeight: 34,

  softLandingLag: 1,
  hardLandingLag: 3,

  shieldSize: 8.5,
  rollDistance: 28,
  airDodgeSpeed: 2.8,
};
