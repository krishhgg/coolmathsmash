/**
 * Bloxorz block's Final Smash, Split Switch, on Donkey Kong's Jungle Rush in Ultimate 13.0.1 (SmashWiki, "Donkey Kong
 * (SSBU)/Final Smash" and "Jungle Rush"). Jungle Rush is a lunging punch that traps the opponent it connects with,
 * "a barrage of 31 more rapid punches" from both fists, and an uppercut "for 33 total hits". The block does the same
 * with its own Bloxorz tricks: it stands on a split switch, topples onto the opponent in front (the punch), the
 * level's tiles flip up across the floor, it splits into its two cubes, which take turns rocking into the opponent
 * from either side (the barrage, one cube a fist), and the cubes rejoin and slam a heavy switch whose bridge tile
 * flips up under the opponent and flings it (the uppercut).
 *
 * - Timing table. Detection: hitbox 29-34, animation length 99. Hit: hits 1-18 on 6-7, 10-11, ..., 74-75 (every 4
 *   frames), hits 19-31 on 79, 83, ..., 127, the final hit on 139-140, animation length 209.
 * - Hitbox table. The punch: 12%, angle 361, BK 0, KS 0, radius 13 on bone `top` at 10 up, stretched from 8 to 28
 *   forward, hitlag x5.0. Hits 1-18: 1.2% each, hits 19-31: 1.1%, hitlag x0.4; their four autolink boxes (135, 45,
 *   225, 315 at KS 100, FKV 40) and a 140-degree one (BK 40, KS 80) only keep DK's victims in place, which the
 *   trap's hold does here. The final hit: 14%, angle 70, BK 90, KS 96, hitlag x1.0.
 * - Every hit adds up to 61.9%: 12 + 18 x 1.2 + 13 x 1.1 + 14.
 *
 * These numbers live apart from the moves (finalSmash.ts) so the art can read them without loading sim code.
 */

/** The activation (Jungle Rush's Detection motion). */
export const SPLIT = {
  /**
   * Frames everyone else holds still from activation: 27, so the punch's frame 29 is the first after the hold
   * (FINAL_SMASH.freeze, 40, would hold them past it).
   */
  freeze: 27,
  /** The catching box's frames: Jungle Rush's punch, 29-34. */
  catch: [29, 34] as [number, number],
  /** First actionable frame after a miss: Detection's animation length 99, plus 1. */
  faf: 100,
  /** The punch's box: radius 13 at 10 up, stretched from 8 to 28 in front (circles every 10 units along it). */
  reach: { from: 8, to: 28, y: 10, radius: 13 },
  /** Lying, the block stands up on this frame (as Heavy Switch and Switch Bridge do). */
  standUp: 4,
} as const;

/** The trapped opponent's cinematic (Jungle Rush's Hit motion), in its own frames from the catch. */
export const BARRAGE = {
  /** The punch's 12% lands as the cinematic starts, with its x5 hitlag. */
  punch: 1,
  /** Hits 1-18 at 1.2%: the first frame of each 2-frame window, 6 to 74. */
  fast: Array.from({ length: 18 }, (_, i) => 6 + 4 * i),
  /** Hits 19-31 at 1.1%: 79 to 127. */
  late: Array.from({ length: 13 }, (_, i) => 79 + 4 * i),
  /** The final hit, the bridge tile's fling: 139. */
  finish: 139,
  /** First actionable frame: Hit's animation length 209, plus 1. */
  faf: 210,
  /**
   * Units a frame the catch slides in to the block's hold point (MoveDef.pull) instead of jumping there. The
   * farthest catch on the roster is 35 units away (the Duck 43 out and 15 up), so at 1.5 it arrives in 24 frames,
   * inside the punch's 30 frames of hitlag (12% at x5): every catch is in place when the hitlag ends, before the
   * cubes come apart on frame 3.
   */
  pull: 1.5,
} as const;

/** How far in front the punch reaches (finalReach): its far circle's edge. */
export const REACH = SPLIT.reach.to + SPLIT.reach.radius;
