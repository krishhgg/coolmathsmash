import type { FighterStats } from '../types';

/**
 * Bloxorz block: a 1x1x2 block of two 12-unit cubes, a super-heavy that only moves by tipping end over end.
 * Every number comes from its roster sheet's Ultimate templates: King Dedede's weight, run, air speed and fall
 * speeds, Ganondorf's gravity, air acceleration and jump heights, Sephiroth's walk. It stands upright (12 wide,
 * 24 tall) at rest.
 */
export const stats: FighterStats = {
  weight: 127,
  height: 24,
  width: 12,

  walkSpeed: 0.9,
  walkAccelBase: 0.1,
  walkAccelAdd: 0.1,
  groundFriction: 0.11,
  dashInitialSpeed: 1.5,
  dashFrames: 12,
  runSpeed: 1.496,
  runAccelBase: 0.06,
  runAccelAdd: 0.08,

  airSpeed: 0.735,
  airAccelBase: 0.01,
  airAccelAdd: 0.03,
  airFriction: 0.0075,
  gravity: 0.108,
  fallSpeed: 1.95,
  fastFallSpeed: 3.12,

  jumpSquat: 3,
  fullHopHeight: 25.49,
  shortHopHeight: 12.24,
  doubleJumpHeight: 26,
  jumps: 2,
  ledgeJumpHeight: 30,

  softLandingLag: 2,
  hardLandingLag: 5,

  shieldSize: 15,
  rollDistance: 27,
  airDodgeSpeed: 2.6,
};
