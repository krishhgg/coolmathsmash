/**
 * The Duck's Final Smash, Evolved Stomp: he grows into his fully trained form, three times his size, and stomps the
 * stage twice. The first stomp's burst pins everyone in front, and the second sends a shockwave along the floor to
 * its edge. It is Ganondorf's Ganon, The Demon King in Ultimate 13.0.1 (SmashWiki, "Ganondorf (SSBU)/Final Smash" and
 * "Ganon, The Demon King"; the game scripts of the Ganon article, rubendal/ssbu 2e8f0d2,
 * public/data/patch/13.0.1/character/Ganondorf/data.json, `ganon_ganond` Start and Attack). Ganondorf turns into a
 * giant beast that brings his swords down in front of him, meteor smashing and paralysing those there "into the
 * resulting charge", then charges to the edge of the stage. SmashWiki notes that Ultimate's Ganon swings the swords
 * down "instead of stomping", as the beast did in Brawl and Smash 4.
 *
 * - Timing. Ganon is an article spawned on Ganondorf's frame 5, so its frame 1 is the Duck's frame 5. The slam is
 *   out on its frames 50 to 54 (the Duck's 54 to 58). Its Start motion then runs frames 96 to 104 at half speed
 *   (FT_MOTION_RATE 2) and puts out a 0% push on frame 105, its 114th, for 10 frames. The scripts give neither the
 *   Start motion's length nor the charge's speed, so the charge (the Attack motion) is taken to start as the push
 *   ends, on the article's 124th frame: the Duck's 128.
 * - The slam (the first stomp): 10%, angle 270, KS 100, set knockback 250, BK 0, radius 25, stretched from 18 to 50
 *   units in front at 25 up, hitlag x2, paralyse. The paralysis is Ultimate's (Bob's Stun Gun status): floor(1 +
 *   knockback x2) frames, at most 90, so it holds every fighter for 90 frames.
 * - The charge (the shockwave): 45% in front (radius 10, 25 forward and 12 up) and 35% behind it (radius 15 from 5
 *   forward to 20 back, 12 up; radius 18 from 13 forward to 18 back, 30 up), all at angle 42, KS 25, BK 122, hitlag x0,
 *   launching forward.
 * - Left out: the 0% push at the charge's start (angle 20, set knockback 220), which throws anyone beside Ganon into
 *   the charge. The shockwave's rear boxes already reach 38 units behind him there.
 * - Speed, an estimate. A fighter the slam catches on its first frame is held until frame 144. At WAVE.speed the
 *   front box reaches the slam's far edge (75 units in front) on that frame, so the shockwave meets everyone the slam
 *   pinned before they can drop out, and only someone further away slips through, as SmashWiki says of Ganon's.
 * - Length, an estimate. The Duck can act again on frame 226: the shockwave's run from Battlefield's middle to its
 *   edge (80 units, 32 frames after the second stomp) and then Ganondorf's FinalEnd motion through its last scripted
 *   frame (75, at its motion rates: 66 frames).
 * - SmashWiki's table marks Ganon's hitboxes blockable. Here every Final Smash hit goes through shields
 *   (src/sim/finalSmash.ts), as its Final Smash article says.
 *
 * Both stomps are entities, as Ganon is an article: the Duck never freezes in hitlag, so his timeline stays Ganon's.
 * The moves and entities are in finalSmash.ts; these numbers live apart from them so the art can read them without
 * loading sim code.
 */
export const STOMP = {
  /** Move frame of the first stomp: the slam, on the Ganon article's frame 50. */
  frame: 54,
  /** Frames the slam's hitbox is out (its frames 50 to 54). */
  active: 5,
  /**
   * Frames the burst stays drawn after it lands: its six drawings at 15 a second, the first for three frames (a prop's
   * loop counts from age 1) and the rest for four.
   */
  lifetime: 23,
  /** The slam's stretch: from 18 to 50 units in front, 25 up, radius 25. */
  from: 18,
  to: 50,
  y: 25,
  radius: 25,
};

export const WAVE = {
  /** Move frame of the second stomp, when the shockwave leaves his feet: the charge's start, on Ganon's frame 124. */
  frame: 128,
  /** Units a frame forward: an estimate (see the notes above). */
  speed: 2.5,
  /** Frames it runs at most: Battlefield's width (160 units) at WAVE.speed. */
  lifetime: 64,
  /** Its body circle, resting on the floor; the hitboxes are placed from the floor under it. */
  radius: 2,
};

/**
 * The charge's boxes, the shockwave's hitboxes, from the floor under its centre (x forward, y up): Ganon's 45% front
 * box, then each 35% capsule as three circles along it. The art draws the shockwave inside them.
 */
export const WAVE_BOXES: { x: number; y: number; radius: number; damage: number }[] = [
  { x: 25, y: 12, radius: 10, damage: 45 },
  ...[5, -7.5, -20].map((x) => ({ x, y: 12, radius: 15, damage: 35 })),
  ...[13, -2.5, -18].map((x) => ({ x, y: 30, radius: 18, damage: 35 })),
];

/** The Duck can act again on this frame (an estimate, see above). */
export const FAF = 226;

/** How far in front the slam reaches: CPUs use it once someone is inside (finalReach). */
export const REACH = STOMP.to + STOMP.radius;
