import type { FighterStats } from '../types';

/**
 * Red Ball (Red Ball 4): a light, slippery ball with a slow start and a high top speed, a floaty air game and four
 * jumps. Numbers from the roster sheet, each borrowed from an Ultimate fighter: weight from Falco/Rosalina (82),
 * initial dash from Jigglypuff, run speed from Charizard/Ridley, air speed from Lucario, air acceleration from
 * Peach, gravity from Yoshi, fall speeds from Steve, jump heights from Pac-Man with Charizard-height air jumps.
 */
export const stats: FighterStats = {
  weight: 82,
  height: 11,
  width: 10,

  walkSpeed: 1.0,
  walkAccelBase: 0.08,
  walkAccelAdd: 0.08,
  groundFriction: 0.08,
  dashInitialSpeed: 1.65,
  dashFrames: 11,
  runSpeed: 2.2,
  runAccelBase: 0.006,
  runAccelAdd: 0.0125,

  airSpeed: 1.281,
  airAccelBase: 0.015,
  airAccelAdd: 0.105,
  airFriction: 0.01,
  gravity: 0.08,
  fallSpeed: 1.4,
  fastFallSpeed: 2.24,

  jumpSquat: 3,
  fullHopHeight: 34,
  shortHopHeight: 16.5,
  doubleJumpHeight: 28,
  jumps: 4,
  ledgeJumpHeight: 34,

  softLandingLag: 1,
  hardLandingLag: 3,

  shieldSize: 10,
  rollDistance: 28,
  airDodgeSpeed: 2.8,
};
