/**
 * Air mobility beyond plain jumps: Brawl-style glide, Peach-style float and fuel-limited hover (R.O.B.'s Robo
 * Burner). Each one is opt-in per fighter through FighterDef (`glide`, `float`, `hover`); the actions that play
 * them live in src/sim/actions/mobility.ts. Per-jump heights for multi-jumpers are FighterStats.airJumpHeights.
 * See docs/fighters.md, "Air mobility".
 */

import type { FighterDef } from '../fighters/types';

/**
 * Glide (Brawl's glide, Papa Louie): hold Jump after the last midair jump, or at the end of a move with
 * `glide: true`. The glider flies along its pitch: diving gains speed, climbing trades it for height until it
 * stalls. Up/down tilt the pitch, holding back brakes and then turns the glide around, Attack does `attack`,
 * releasing Jump drops to a normal fall. One glide per airtime.
 */
export interface GlideDef {
  /** Top horizontal speed, which a glide at the neutral pitch settles at and never exceeds (Papa Louie 1.2). */
  speed: number;
  /** Top sink speed: a dive never falls faster (Papa Louie 0.6). */
  fallSpeed: number;
  /** Pitch in degrees (nose up positive) with the stick neutral, held fully down and held fully up. */
  angles?: [neutral: number, down: number, up: number];
  /** Degrees per frame the pitch turns toward the stick. */
  turnRate?: number;
  /** Speed gained per frame diving straight down (scaled by -sin(pitch); climbing loses it the same way). */
  accel?: number;
  /** Move played by Attack (or the C-stick) out of a glide. */
  attack?: string;
}

/** Glide defaults: a shallow neutral glide like Brawl's Pit, steep dives, a climb that stalls in about 25 frames. */
export const GLIDE_DEFAULTS: Required<Omit<GlideDef, 'speed' | 'fallSpeed'>> = {
  angles: [-20, -60, 40],
  turnRate: 3,
  accel: 0.06,
  attack: 'nair',
};

/**
 * Float (Peach in Ultimate, Balloon Boy): holding Jump while falling (from the apex of a jump on) stops all
 * vertical motion for up to `frames` frames. Aerials started from the float keep floating; releasing Jump,
 * fast-falling, a jump, a dodge or a hit end it. One float per airtime.
 */
export interface FloatDef {
  /** Longest float in frames (Balloon Boy 120; Peach 150, "up to 2.5 seconds at a time"). */
  frames: number;
}

/**
 * Fuel-limited hover (R.O.B.'s Robo Burner, Snail Bob's Rocket Hover): a move with `action: 'hover'` thrusts
 * upward while Special stays held and fuel lasts. Releasing ends it in a normal fall (not helpless), and the move
 * can be used again on the fuel that is left. Fuel refills only while standing on the ground.
 */
export interface HoverDef {
  /** Frames of thrust in a full tank (Snail Bob 120). */
  fuel: number;
  /** Rising speed the thrust tops out at (units/frame). */
  rise: number;
  /** Vertical acceleration toward `rise` while thrusting (units/frame²). */
  accel: number;
  /** Frames on the ground that refill an empty tank (default HOVER_REFILL_FRAMES). */
  refillFrames?: number;
}

/** R.O.B.'s fuel refills in "a little less than 1.5 seconds" on the ground (Smash Bros. DOJO!!, via SmashWiki). */
export const HOVER_REFILL_FRAMES = 90;

/** Glide, float and hover bookkeeping, part of FighterState. Landing resets everything except hover fuel. */
export interface MobilityState {
  /** A glide was used this airtime. */
  glideUsed: boolean;
  /** The current glide came out of a helpless move, so it ends in helpless fall. */
  glideHelpless: boolean;
  /** Glide pitch in degrees (nose up positive) and speed along the glide path. */
  glideAngle: number;
  glideSpeed: number;
  /** Floating now, including during aerials started from the float. */
  floating: boolean;
  /** Frames floated this airtime; set to the float's limit when a float ends, so it is spent. */
  floatFrames: number;
  /** Hover fuel left, in frames of thrust. */
  hoverFuel: number;
}

export function createMobility(def: FighterDef): MobilityState {
  return {
    glideUsed: false,
    glideHelpless: false,
    glideAngle: 0,
    glideSpeed: 0,
    floating: false,
    floatFrames: 0,
    hoverFuel: def.hover?.fuel ?? 0,
  };
}

/**
 * Touching the ground gives back the glide and the float (hover fuel refills gradually instead). A float cut
 * short by landing is ended, and reported, by the next tickMobility.
 */
export function resetMobility(m: MobilityState): void {
  m.glideUsed = false;
  m.glideHelpless = false;
  m.floatFrames = 0;
}
