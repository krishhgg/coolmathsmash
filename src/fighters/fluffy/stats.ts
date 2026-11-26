import type { FighterStats } from '../types';

/**
 * Fluffy (IQ Ball / Catch the Candy): a heavy fuzzy ball that is miserable to move on foot, as the roster video
 * asks ("it would absolutely suck to move around"), and carried by his grabber's reach. Roster sheet 8 in the
 * research handoff gives each value's Ultimate template: Ganondorf's weight (118), Incineroar's walk and run (the
 * slowest), Steve's initial dash, King Dedede's air speed, Ganondorf's air acceleration and Jigglypuff's gravity,
 * fall speeds and jump arc.
 */
export const stats: FighterStats = {
  weight: 118,
  height: 11,
  width: 10,

  walkSpeed: 0.62,
  walkAccelBase: 0.08,
  walkAccelAdd: 0.06,
  groundFriction: 0.09,
  dashInitialSpeed: 1.45,
  dashFrames: 11,
  runSpeed: 1.18,
  runAccelBase: 0.04,
  runAccelAdd: 0.06,

  airSpeed: 0.735,
  airAccelBase: 0.01,
  airAccelAdd: 0.03,
  airFriction: 0.0075,
  gravity: 0.053,
  fallSpeed: 0.98,
  fastFallSpeed: 1.568,

  jumpSquat: 3,
  fullHopHeight: 18,
  shortHopHeight: 10,
  doubleJumpHeight: 20,
  jumps: 2,
  ledgeJumpHeight: 22,

  softLandingLag: 1,
  hardLandingLag: 3,

  shieldSize: 11,
  rollDistance: 27,
};
