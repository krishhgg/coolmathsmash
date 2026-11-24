import { stats as fireboy } from '../fireboy/stats';
import type { FighterStats } from '../types';

/**
 * Watergirl: lighter, quicker and floatier than Fireboy, with higher jumps (roster balance table: Sheik and
 * Toon Link templates). Values the roster doesn't give are Fireboy's.
 */
export const stats: FighterStats = {
  ...fireboy,
  weight: 88,
  walkSpeed: 1.26,
  dashInitialSpeed: 2.09,
  runSpeed: 1.906,
  airSpeed: 1.1,
  airAccelBase: 0.01,
  airAccelAdd: 0.08,
  gravity: 0.075,
  fallSpeed: 1.38,
  fastFallSpeed: 2.208,
  fullHopHeight: 39,
  shortHopHeight: 18.75,
  doubleJumpHeight: 40,
};
