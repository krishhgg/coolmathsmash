/**
 * Full Arsenal's numbers, in a module of plain data so the art can read them in any load order (the move file loads
 * sim code, which loads the fighter registry, which loads this fighter's art). The moves and entities are in
 * fullArsenal.ts.
 *
 * Full Arsenal, the Raft Wars kids' Final Smash: the little brother climbs up with his spyglass and spots targets
 * while a crosshair hunts across the stage, then the big kid lobs everything they have at the marked foes in one
 * barrage (a tennis ball, two grenades and two rockets) that comes down on them, as they defend their treasure in
 * Raft Wars.
 *
 * Analogue: Snake's Covering Fire in Ultimate 13.0.1, the targeted missile barrage. SmashWiki, "Covering Fire": a
 * crosshair the player guides locks on to opponents, and "after five targets are acquired or about five seconds have
 * passed, homing missiles will launch"; "the same player can be targeted two or more times"; "if no players were
 * targeted in a lock, the missile will fire at where the crosshair was last positioned"; Snake is invincible during
 * the crosshair phase, in the air "will remain in place for the duration of the crosshair phase", and "after the
 * missiles begin launching, the player will have full control". SmashWiki, "Snake (SSBU)", Final Smash: "15% (per
 * missile)", and a bar of 5 segments for the missiles. ultimateframedata.com lists no Final Smashes, and SmashWiki has
 * no hitbox table for this one, so the rest is from the game scripts (rubendal/ssbu 2e8f0d2,
 * public/data/patch/13.0.1/character/Snake/data.json):
 *
 * - The missile (`snake_missile`, Explosion): 15%, angle 55, KBG 80, BKB 100, size 23, hitlag and SDI x1.0, launching
 *   away from the explosion (FacingRestrict ATTACK_LR_CHECK_POS), unreflectable and unabsorbable, rehit 0 (each
 *   missile hits each fighter once). The hitbox is set once and never cleared in the script, so how long it stays out
 *   isn't given: BLAST.active is an estimate.
 * - Snake's FinalEnd motion, which plays from the launch, is interruptible on its frame 35 (CancelFrame 35), so the
 *   kids act 35 frames after the first shot leaves: ARSENAL.faf.
 * - FinalStart's flare grenade (out on frame 2, thrown on 11) is "completely aesthetic"; the kids have no flare.
 *
 * Estimates, since neither source gives them: how fast the crosshair moves, how often it can lock, how long a
 * missile flies and how high it arcs. Covering Fire's missiles launch together "from the foreground"; the kids have
 * one launcher, so their five shots leave three frames apart, and each lands inside the hitlag of the one before it
 * on the same target, as missiles launched together would. Ultimate's crosshair stays put when the stick is let go;
 * here it seeks the nearest foe with the fewest marks, as the brother spots for his brother (and CPUs aim it that
 * way).
 */
export const ARSENAL = {
  /** Move frame the crosshair appears: the first after the 40-frame activation freeze. */
  reticle: 42,
  /** Move frame held while the crosshair hunts; the clip shows the frame before it for the whole hunt. */
  hold: 43,
  /** Locks, and shots: Covering Fire's five. */
  locks: 5,
  /** Frames the crosshair hunts at most: "about five seconds". */
  aimFrames: 300,
  /** Frames between two locks (an estimate). */
  lockEvery: 15,
  /** Crosshair speed in units a frame, steered or seeking (an estimate). */
  speed: 3,
  /** Its radius: a lock needs it to touch a fighter's body. */
  radius: 4,
  /** Where it appears, from the feet (x forward, y up). */
  start: { x: 30, y: 12 },
  /** Move frames the five shots leave the launcher on. */
  fire: [44, 47, 50, 53, 56],
  /** Frames a shot flies, from the muzzle to its mark (an estimate). */
  flight: 30,
  /** Height of the shot's arc: its control point this far above the higher of the muzzle and the mark. */
  arc: 40,
  /** The kids act again on this frame: Snake's FinalEnd, interruptible on its frame 35, from the first shot. */
  faf: 44 + 34,
  /**
   * Where each shot leaves, from the feet (x forward, y up), standing and in the air: a unit out of the drawn
   * launcher's muzzle along the barrel, which points 48 degrees up as it fires (art/fullArsenal.ts).
   */
  muzzle: { x: 5.1, y: 7.6 },
  airMuzzle: { x: 5.1, y: 9.1 },
} as const;

/** What each shot is, in firing order: the drawing it flies as (art.projectiles); they all hit the same. */
export const SHOTS = [
  'volleyBall',
  'volleyGrenade',
  'volleyRocket',
  'volleyGrenade',
  'volleyRocket',
] as const;

/** Covering Fire's missile explosion (see above). */
export const BLAST = {
  damage: 15,
  angle: 55,
  kbg: 80,
  bkb: 100,
  radius: 23,
  /** Frames its hitbox is out (an estimate). */
  active: 2,
  /**
   * Frames the burst is drawn: its four drawings at 12 fps, five frames each, the first one four frames long because
   * a prop's loop runs on the entity's age, which starts at 1.
   */
  lifetime: 19,
} as const;

/** How far ahead it reaches, for CPUs: the crosshair covers the stage, so Battlefield's width. */
export const REACH = 160;
