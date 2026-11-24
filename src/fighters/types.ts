/**
 * The fighter format. One directory per fighter under src/fighters/<id>/ whose index.ts exports
 * `fighter: FighterDef`; the registry discovers it automatically. All numbers use Smash Ultimate's units
 * (game units, units/frame, frames at 60 Hz) so reference data can be used as-is. See docs/fighters.md.
 */

export interface FighterStats {
  /** Ultimate weight (Mario 98). Heavier fighters take less knockback. */
  weight: number;
  /** Standing size in units: hurtbox and environment collision box (feet at the origin). */
  height: number;
  width: number;

  walkSpeed: number;
  walkAccelBase: number;
  walkAccelAdd: number;
  /** Traction: speed lost per frame on the ground when not accelerating. */
  groundFriction: number;
  dashInitialSpeed: number;
  /** Length of the initial dash (dash-dance window) in frames. */
  dashFrames: number;
  runSpeed: number;
  runAccelBase: number;
  runAccelAdd: number;

  airSpeed: number;
  airAccelBase: number;
  airAccelAdd: number;
  airFriction: number;
  gravity: number;
  fallSpeed: number;
  fastFallSpeed: number;

  jumpSquat: number;
  /** Apex heights in units above the take-off point. */
  fullHopHeight: number;
  shortHopHeight: number;
  doubleJumpHeight: number;
  /** Total jumps including the grounded one (2 for most fighters). */
  jumps: number;
  ledgeJumpHeight: number;

  softLandingLag: number;
  hardLandingLag: number;

  /** Shield bubble radius at full health. */
  shieldSize: number;
  /** Distance travelled by a roll. */
  rollDistance: number;
  /** Speed of a directional air dodge at its start. */
  airDodgeSpeed: number;
}

export interface FighterDef {
  id: string;
  name: string;
  /** Source game, e.g. "Fireboy and Watergirl (2009)". */
  series: string;
  stats: FighterStats;
  /** Art data for the renderer (src/render/rig). Plain data, no renderer imports. */
  art?: unknown;
}

export function defineFighter<T extends FighterDef>(def: T): T {
  return def;
}
