import type { FighterStats } from '../types';

/**
 * Snail Bob: a slow, heavy snail (the shell is heavy) with low, floaty jumps and an excellent hover recovery.
 * Templates from the roster (handoffs/research/roster.md, "5. Snail Bob"): Captain Falcon's weight, Jigglypuff's
 * ground speeds, Olimar's gravity and fall speeds, Kirby's jump heights and Donkey Kong's air acceleration.
 */
export const stats: FighterStats = {
  weight: 104,
  height: 13,
  width: 12,

  walkSpeed: 0.735,
  walkAccelBase: 0.08,
  walkAccelAdd: 0.08,
  groundFriction: 0.1,
  dashInitialSpeed: 1.65,
  dashFrames: 13,
  runSpeed: 1.271,
  runAccelBase: 0.06,
  runAccelAdd: 0.06,

  airSpeed: 0.86,
  airAccelBase: 0.01,
  airAccelAdd: 0.05,
  airFriction: 0.01,
  gravity: 0.068,
  fallSpeed: 1.35,
  fastFallSpeed: 2.16,

  jumpSquat: 3,
  fullHopHeight: 25.37,
  shortHopHeight: 12.24,
  doubleJumpHeight: 25,
  jumps: 2,
  ledgeJumpHeight: 30,

  softLandingLag: 2,
  hardLandingLag: 4,

  shieldSize: 11.5,
  rollDistance: 24,
};
