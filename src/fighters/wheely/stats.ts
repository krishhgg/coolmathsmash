import type { FighterStats } from '../types';

/**
 * Wheely: a little red car (Wheely, Pegas Games, 2012). Heavy and slow off the line, very fast at top speed: the
 * initial dash is near the cast's slowest and the run then ramps up to Little Mac's top speed over 40 frames.
 * Template values are from the roster sheet (handoffs/research/roster.md, "13. Wheely").
 */
export const stats: FighterStats = {
  /** Charizard / Incineroar. */
  weight: 116,
  height: 11,
  width: 12,

  /** Sephiroth's walk; a slow roll that takes a while to get going. */
  walkSpeed: 0.9,
  walkAccelBase: 0.04,
  walkAccelAdd: 0.04,
  /** Low traction: he skids. */
  groundFriction: 0.08,
  /** Between Steve and Kazuya: a slow start. */
  dashInitialSpeed: 1.5,
  dashFrames: 11,
  /** Little Mac's top speed, reached 40 frames into the run (0.024 units/frame²). */
  runSpeed: 2.464,
  runAccelBase: 0.004,
  runAccelAdd: 0.02,

  /** Ganondorf's air speed and acceleration. */
  airSpeed: 0.83,
  airAccelBase: 0.01,
  airAccelAdd: 0.03,
  airFriction: 0.01,
  /** Captain Falcon's gravity, Pichu's fall and Link's fast fall: he drops like a car. */
  gravity: 0.12,
  fallSpeed: 1.9,
  fastFallSpeed: 3.04,

  jumpSquat: 3,
  /** Little Mac's low jumps. */
  fullHopHeight: 26,
  shortHopHeight: 12.53,
  doubleJumpHeight: 24,
  jumps: 2,
  ledgeJumpHeight: 28,

  softLandingLag: 2,
  hardLandingLag: 4,

  shieldSize: 11,
  rollDistance: 28,
  airDodgeSpeed: 2.6,
};
