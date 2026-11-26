/**
 * Move timelines the art and the capture scenarios share with the move data. A module of its own with no imports,
 * so they can read it without importing the moves (and through them the simulation). scenarios.ts must not import
 * the moves: the harness loads it before the registry, which would then define Runner with her moves unset.
 */

/**
 * The kick flurry's timeline: a kick on each of these frames. Attack during [loop, loop + 1], after the last kick,
 * restarts it on frame 1, which kicks again, so mashing keeps a kick every other frame (presses buffer, so a press
 * anywhere in the cycle counts). Otherwise the shove comes out three frames after the window closes, on Kirby's
 * finisher timing (startup 3, 39 frames in all).
 */
export const RAPID_JAB = { kicks: [1, 3, 5, 7], loop: 9, shove: [13, 14] as [number, number], faf: 50 };

/**
 * Box Drop's timeline (Kirby's Stone, box-drop.ts). The crate lands its impact and starts armoring on `impact`; the
 * aerial's spike is out from `impact` to `airEnd`. Special opens the crate from `cancelFrom` (18 frames in, Kirby's
 * minimum), and it opens by itself on `release` (150 frames in, Kirby's maximum). Either way the move jumps to
 * `release` and she climbs out for 31 frames, Kirby's, so `groundedFaf` is `release` + 31.
 */
export const BOX_DROP = {
  impact: 12,
  airEnd: 16,
  cancelFrom: 12 + 18,
  release: 12 + 150,
  groundedFaf: 12 + 150 + 31,
  aerialFaf: 90,
};

/**
 * Gravity Switch's timeline. She falls upward through RISE, speeding up to riseSpeed. Touching a ceiling or the
 * underside of a platform jumps to CLING, where she runs along it upside down; running off its end jumps to POP,
 * a short upward fall that carries her past the edge (onto a ledge, from under the stage). Running out of RISE or
 * CLING, or pressing Special again, ends it in helpless fall.
 */
export const GRAVITY_SWITCH = {
  rise: [4, 53] as [number, number],
  riseAccel: 0.2,
  riseSpeed: 2,
  cling: [60, 119] as [number, number],
  clingSpeed: 2.31,
  pop: [120, 127] as [number, number],
  faf: 128,
  /** Special ends it from this frame. */
  cancelFrom: 10,
};
