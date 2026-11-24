/**
 * The fighter format. One directory per fighter under src/fighters/<id>/ whose index.ts exports
 * `fighter: FighterDef`; the registry discovers it automatically. All numbers use Smash Ultimate's units
 * (game units, units/frame, frames at 60 Hz) so reference data can be used as-is. See docs/fighters.md.
 */

import type { Ctx } from '../sim/fighter';

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

/** One hitbox: a circle relative to the fighter's feet, x forward (in the facing direction) and y up. */
export interface HitboxDef {
  /** Lower ids win when several hitboxes of one move touch the same target on the same frame. */
  id: number;
  x: number;
  y: number;
  radius: number;
  damage: number;
  /** Launch angle in degrees from the attacker's facing direction; 361 is the Sakurai angle. */
  angle: number;
  /** Knockback growth and base knockback, as in Ultimate's frame data. */
  kbg: number;
  bkb: number;
  /** Set (weight-based) knockback; replaces the % part of the formula. */
  wbkb?: number;
  /** Hitlag multiplier (default 1). */
  hitlag?: number;
  /** Extra shield damage on top of the move's damage. */
  shieldDamage?: number;
  effect?: 'normal' | 'fire' | 'electric';
  /**
   * Which way the hit launches (Ultimate's LR check): along the attacker's facing (default), against it for hits
   * behind him, or away from his centre for hits that surround him.
   */
  direction?: 'forward' | 'back' | 'away';
}

/** A window of frames (inclusive) during which a set of hitboxes is out. */
export interface HitWindow {
  frames: [number, number];
  boxes: HitboxDef[];
  /** Forget who this move has already hit when the window opens, so it can hit them again (multi-hit moves). */
  rehit?: boolean;
}

/** Shieldstun and staleness categories (Ultimate treats smash attacks and aerials differently on shield). */
export type MoveKind = 'smash' | 'aerial' | 'projectile' | 'other';

export interface MoveDef {
  kind: MoveKind;
  /** First actionable frame (frame data convention: total frames + 1). */
  faf: number;
  hits: HitWindow[];
  /**
   * Aerials: landing lag, and frames on which landing cancels the move with only normal landing lag. Helpless
   * moves: also the landing lag out of the helpless fall (default HELPLESS_LANDING_LAG).
   */
  landingLag?: number;
  autoCancel?: [number, number][];
  /** Smash attacks: holding the input pauses the move on this frame for up to 60 frames, for up to 1.4x damage. */
  charge?: number;
  /** Specials that take off (recoveries): a grounded start leaves the ground and plays as an aerial. */
  leavesGround?: boolean;
  /** Recoveries: the move ends in helpless fall instead of a normal fall. */
  helpless?: boolean;
  /** Airborne moves that may grab a ledge from this frame. */
  ledgeFrom?: number;
  /**
   * Scripted behaviour (specials): runs every frame of the move before physics, after actionFrame advances.
   * It may set velocity or facing. Keep it deterministic: no Math.random, no clocks.
   */
  script?: (x: Ctx) => void;
}

export interface FighterDef {
  id: string;
  name: string;
  /** Source game, e.g. "Fireboy and Watergirl (2009)". */
  series: string;
  stats: FighterStats;
  /**
   * Moves by name. Normals use Smash's names: jab, ftilt, utilt, dtilt, dashAttack, fsmash, usmash, dsmash,
   * nair, fair, bair, uair, dair. The name is also the animation clip name.
   */
  moves?: Record<string, MoveDef>;
  /** Art data for the renderer (src/render/rig). Plain data, no renderer imports. */
  art?: unknown;
}

export function defineFighter<T extends FighterDef>(def: T): T {
  return def;
}
