/**
 * Move timelines the art shares with the move data. A module of its own with no imports, so the art can read it
 * without importing the moves (and through them the simulation).
 */

/**
 * The kick flurry's timeline: a kick on each of these frames. Attack during [loop, loop + 1], after the last kick,
 * restarts it on frame 1, which kicks again, so mashing keeps a kick every other frame (presses buffer, so a press
 * anywhere in the cycle counts). Otherwise the shove comes out three frames after the window closes, on Kirby's
 * finisher timing (startup 3, 39 frames in all).
 */
export const RAPID_JAB = { kicks: [1, 3, 5, 7], loop: 9, shove: [13, 14] as [number, number], faf: 50 };
