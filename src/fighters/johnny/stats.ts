import type { FighterStats } from '../types';

/**
 * Johnny Upgrade: a burly cartoon superhero on Captain Falcon's attributes (the roster's template), with a run a
 * step below Falcon's because he is still buying his speed upgrades. Values are Ultimate's; the roster sheet
 * (handoffs/research/roster.md, fighter 12) names the template for each.
 */
export const stats: FighterStats = {
  weight: 104,
  height: 17,
  width: 9,

  walkSpeed: 0.987,
  walkAccelBase: 0.1,
  walkAccelAdd: 0.1,
  groundFriction: 0.08,
  dashInitialSpeed: 1.98,
  dashFrames: 11,
  runSpeed: 2.4,
  runAccelBase: 0.06,
  runAccelAdd: 0.12,

  airSpeed: 1.218,
  airAccelBase: 0.01,
  airAccelAdd: 0.065,
  airFriction: 0.01,
  gravity: 0.12,
  fallSpeed: 1.865,
  fastFallSpeed: 2.984,

  jumpSquat: 3,
  fullHopHeight: 37.31,
  shortHopHeight: 17.98,
  doubleJumpHeight: 37.31,
  jumps: 2,
  ledgeJumpHeight: 38,

  softLandingLag: 1,
  hardLandingLag: 3,

  shieldSize: 10.5,
  rollDistance: 28,
};
