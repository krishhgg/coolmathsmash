import type { FighterStats } from '../types';

/**
 * Bob the Robber: a stocky middleweight burglar (research roster, fighter 4). Weight of Lucario / Villager, Wolf's
 * walk, Hero's run, Toon Link's air speed, Sonic's gravity and Link's fall speed; each number names its Ultimate
 * template in the roster's stat table.
 */
export const stats: FighterStats = {
  weight: 92,
  height: 14.5,
  width: 8.5,

  walkSpeed: 1.208,
  walkAccelBase: 0.1,
  walkAccelAdd: 0.1,
  groundFriction: 0.1,
  dashInitialSpeed: 2.0,
  dashFrames: 11,
  runSpeed: 1.84,
  runAccelBase: 0.05,
  runAccelAdd: 0.1,

  airSpeed: 1.05,
  airAccelBase: 0.01,
  airAccelAdd: 0.07,
  airFriction: 0.015,
  gravity: 0.09,
  fallSpeed: 1.6,
  fastFallSpeed: 2.56,

  jumpSquat: 3,
  fullHopHeight: 33,
  shortHopHeight: 16,
  doubleJumpHeight: 33,
  jumps: 2,
  ledgeJumpHeight: 35,

  softLandingLag: 1,
  hardLandingLag: 3,

  shieldSize: 9.5,
  rollDistance: 28,
  airDodgeSpeed: 2.8,
};
