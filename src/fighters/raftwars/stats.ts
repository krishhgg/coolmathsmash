import type { FighterStats } from '../types';

/**
 * Raft Wars kids: light, slow and floaty-ish kids on pool floats who would rather shoot from a high spot than fight
 * up close. Numbers follow the roster sheet (handoffs/research/roster.md, fighter 9), each from an Ultimate template:
 * Meta Knight's weight, Sephiroth's walk, Simon's initial dash, gravity and jump, Isabelle's run, Terry's air speed,
 * Min Min's air acceleration and Mii Gunner's fall speeds and short hop.
 */
export const stats: FighterStats = {
  weight: 80,
  height: 13,
  width: 9,

  walkSpeed: 0.9,
  walkAccelBase: 0.1,
  walkAccelAdd: 0.1,
  groundFriction: 0.1,
  dashInitialSpeed: 1.73,
  dashFrames: 11,
  runSpeed: 1.48,
  runAccelBase: 0.045,
  runAccelAdd: 0.09,

  airSpeed: 0.95,
  airAccelBase: 0.01,
  airAccelAdd: 0.05,
  airFriction: 0.01,
  gravity: 0.085,
  fallSpeed: 1.45,
  fastFallSpeed: 2.32,

  jumpSquat: 3,
  fullHopHeight: 30,
  shortHopHeight: 14.6,
  doubleJumpHeight: 30,
  jumps: 2,
  ledgeJumpHeight: 32,

  softLandingLag: 1,
  hardLandingLag: 3,

  shieldSize: 9,
  rollDistance: 28,
  airDodgeSpeed: 2.8,
};
