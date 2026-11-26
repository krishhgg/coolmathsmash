import type { HitboxDef, MoveDef } from '../types';

/**
 * Snail Bob's Final Smash, Shell Ship: he presses his crane remote and his spaceship, a rocket with a snail-shell
 * dome, swoops through the stage in front of him. Whoever it hits is trapped while it banks round, lasers them and
 * blasts them away. The roster plan's "spaceship final", read as a spaceship that swoops in, on Captain Falcon's
 * Blue Falcon in Ultimate 13.0.1 (SmashWiki, "Captain Falcon (SSBU)/Final Smash"): Falcon calls in the Blue Falcon,
 * "which flies through the stage in front of him", and anyone it hits is taken into a cutscene where Falcon drives it
 * into them and "sends them flying". It is the same shape as Team Star Fox (Arwings fly in, those hit go into a
 * cutscene where they are fired on and launched), which SmashWiki has no Ultimate frame or hitbox data for.
 *
 * - Timing table: "Hitboxes 28-30", "Animation length 97". A whiff ends there, so its FAF is 98.
 * - Hitbox table: three boxes on the top bone at Y 12 and Z (forward) 13, 30 and 45, radius 16, 18 and 16, each
 *   10%, 80°, BK 0, KS 100, FKV 200, hitlag x0.0 (FF 0.0), unblockable, no clang or rebound.
 * - Throw table: "Blue Falcon hit" 20%, 361°, BK 90, KS 80, FKV 1 (a set knockback of 1, so it doesn't launch), then
 *   "Final launch" 10%, 361°, BK 100, KS 135, FKV 0, hitlag x0.0.
 * - "Deals 40% if all hits connect": 10 + 20 + 10.
 *
 * The swoop's boxes catch as a trap's do (docs/fighters.md, "Final Smash"): the first fighter they touch is held in
 * front of Bob for the cinematic, and its three hits are the analogue's: the swoop's 10% as the first hold hit (the
 * engine has no hit that both damages and traps), the 20% as the second (FKV 1 never launches) and the 10% launch as
 * the throw. SmashWiki gives no length for the cutscene, so the cinematic's frames are estimates.
 */
export const SHIP = {
  /** The swoop's catching frames ("Hitboxes 28-30"). */
  catch: [28, 30] as [number, number],
  /** The first actionable frame of a whiff ("Animation length 97"). */
  faf: 98,
  /**
   * Activation freeze: the others hold still on frames 2 to 27, so the swoop can catch on frame 28. The engine's
   * default (FINAL_SMASH.freeze, 40) is an estimate, and it would hold them past the Blue Falcon's hitbox.
   */
  freeze: 26,
  /** The swoop's three boxes, x forward and y up from the feet: the Blue Falcon's Z and Y offsets and radii. */
  boxes: [
    { x: 13, y: 12, radius: 16 },
    { x: 30, y: 12, radius: 18 },
    { x: 45, y: 12, radius: 16 },
  ],
  /** Cinematic frames, estimates (SmashWiki has no cutscene timing): the swoop's hit lands on the first. */
  swoop: 1,
  /** The ship has banked round over the victim and fires its laser: the "Blue Falcon hit". */
  laser: 52,
  /** The ship dives back and blasts them: the "Final launch". */
  launch: 84,
  /** Bob is free again once the ship has climbed away. */
  cinematicFaf: 112,
  /** Damage: the swoop, the laser (the "Blue Falcon hit") and the launch. */
  damage: { swoop: 10, laser: 20, launch: 10 },
} as const;

const grab = (id: number, b: (typeof SHIP.boxes)[number]): HitboxDef => ({
  id,
  ...b,
  damage: 0,
  angle: 0,
  kbg: 0,
  bkb: 0,
  grab: true,
});

/**
 * Shell Ship's activation: Bob calls the ship with the remote through the freeze, and it swoops through on frames
 * 28-30. In the air he holds still, as Fireboy does in Fire Blast (SmashWiki gives no aerial version of its own).
 */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: SHIP.faf,
  final: { freeze: SHIP.freeze, still: true },
  commandGrab: 'finalSmashCinematic',
  hits: [{ frames: SHIP.catch, boxes: SHIP.boxes.map((b, i) => grab(i, b)) }],
};

/** The cinematic: the swoop's and the laser's hits on the held victim, then the blast that launches them. */
export const finalSmashCinematic: MoveDef = {
  kind: 'other',
  faf: SHIP.cinematicFaf,
  final: { still: true },
  hits: [],
  holdHits: [
    { frame: SHIP.swoop, damage: SHIP.damage.swoop, hitlag: 0 },
    { frame: SHIP.laser, damage: SHIP.damage.laser, hitlag: 0 },
  ],
  throw: {
    frame: SHIP.launch,
    hit: { damage: SHIP.damage.launch, angle: 361, kbg: 135, bkb: 100, hitlag: 0 },
  },
};

export const shellShip: Record<string, MoveDef> = { finalSmash, finalSmashCinematic };
