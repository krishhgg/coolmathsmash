import type { FighterStats } from '../types';

/**
 * Papa Louie (roster: handoffs/research/roster.md, "1. Papa Louie"): a round, slightly heavy all-rounder who
 * floats like his glide in Papa Louie: When Pizzas Attack!. Templates from Ultimate's tables: Mario's weight and
 * air acceleration, Ness's walk and run, Peach's initial dash and air speed, Samus's gravity and Zelda's fall
 * speeds and jump heights.
 */
export const stats: FighterStats = {
  weight: 100,
  height: 15,
  width: 9,

  walkSpeed: 1.0,
  walkAccelBase: 0.1,
  walkAccelAdd: 0.1,
  groundFriction: 0.1,
  dashInitialSpeed: 1.826,
  dashFrames: 11,
  runSpeed: 1.6,
  runAccelBase: 0.05,
  runAccelAdd: 0.08,

  airSpeed: 1.03,
  airAccelBase: 0.01,
  airAccelAdd: 0.07,
  airFriction: 0.015,
  gravity: 0.075,
  fallSpeed: 1.35,
  fastFallSpeed: 2.16,

  jumpSquat: 3,
  fullHopHeight: 32,
  shortHopHeight: 15.5,
  doubleJumpHeight: 32,
  jumps: 2,
  ledgeJumpHeight: 34,

  softLandingLag: 1,
  hardLandingLag: 3,

  shieldSize: 10,
  rollDistance: 28,
  airDodgeSpeed: 2.8,
};
