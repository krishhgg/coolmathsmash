import type { HitboxDef, HoldHitDef, MoveDef, ThrowHitDef } from '../types';

/**
 * Fluffy's Final Smash, Fuzz Frenzy: he lashes the grabber out in front, and the foe it catches is tangled in the line,
 * battered by a frenzy of fuzzy bumps and a grinding roll, and launched by the Spiked Ball. It is a trapping Final
 * Smash on Donkey Kong's Jungle Rush in Ultimate 13.0.1 (SmashWiki, "Donkey Kong (SSBU)/Final Smash" for the timing and
 * hitbox tables, "Jungle Rush" for the rest; ultimateframedata.com lists no Final Smashes). Jungle Rush is a reach in
 * front that catches, a barrage of 31 hits on the catch held in place, and a launching uppercut, "33 total hits": the
 * catch, tangle, frenzy and Spiked Ball here. Ultimate has no Spider-style swings, and SmashWiki has no frame data for
 * the other trapping dashes (Sheik's, Greninja's Secret Ninja Attack) or for Olimar's End of Day.
 *
 * - The lash (Jungle Rush's detection box): frames 29-34, animation length 99, so a whiff is actionable on frame 100.
 *   ID 0, 12%, angle 361, BK 0, KS 0, radius 13.0 on bone top at Y 10.0, stretched from Z 8.0 to 28.0 (forward), hitlag
 *   x5.0. Here the stretched box is five radius-13 grab circles 5 apart from 8 to 28 forward (their union falls short of
 *   the capsule by under 0.25 units between circles), so it reaches 41 units ahead, from 3 below the feet to 23 up.
 *   Its 12% lands as the cinematic's first hold hit, on frame 1, with its x5 hitlag (30 frames, HITLAG.max).
 * - The barrage (the cinematic, animation length 209, actionable on 210): hits 1-18 on frames 6-7, 10-11, ..., 74-75,
 *   1.2% each, and hits 19-31 on frames 79, 83, ..., 127, 1.1% each, all at hitlag x0.4. Each hit is five boxes, four
 *   of them set-knockback boxes (FKV 40, angles 135, 45, 225 and 315) round a point in front of him that push the
 *   catch back into it, so it stays put; the trap holds the catch here, so each lands as a hold hit on its first frame:
 *   damage and hitlag only.
 * - The release (Jungle Rush's final hit, frames 139-140): 14%, angle 70, BK 90, KS 96, hitlag x1.0.
 * - Total: 12 + 18 x 1.2 + 13 x 1.1 + 14 = 61.9%, before staleness and the 1v1 multiplier.
 *
 * The punch comes out on frame 29, so the activation holds everyone else for 27 frames (final.freeze), the longest
 * hold that lets it out on its own frame; FINAL_SMASH.freeze's 40 is an estimate, SmashWiki gives none. SmashWiki says
 * nothing of Jungle Rush in the air, so in the air Fluffy holds still through it (final.still), and a five-second
 * cinematic can't carry him and his catch off the stage. Ultimate's trap catches every foe its box touches; the
 * engine's holds the nearest one (docs/fighters.md, "Final Smash"), and Jungle Rush's own article speaks of "the
 * opponent".
 */
export const FUZZ_FRENZY = {
  /** The lash's active frames: Jungle Rush's detection hitbox. */
  lash: [29, 34] as [number, number],
  /** First actionable frame after a whiff: Jungle Rush's detection animation is 99 frames. */
  whiffFaf: 100,
  /** First actionable frame of the cinematic: its animation is 209 frames. */
  cinematicFaf: 210,
  /** Frames everyone else holds still on activation: the lash opens on freeze + 2. */
  freeze: 27,
  /** The catch's hit: the detection box's 12% at x5 hitlag, on the cinematic's frame 1. */
  catch: { frame: 1, damage: 12, hitlag: 5 } satisfies HoldHitDef,
  /** The barrage: 18 bumps from frame 6 and 13 rolls from frame 79, one every 4 frames, at x0.4 hitlag. */
  bumps: { from: 6, count: 18, damage: 1.2 },
  rolls: { from: 79, count: 13, damage: 1.1 },
  every: 4,
  barrageHitlag: 0.4,
  /** The release on frame 139: Jungle Rush's final hit. */
  release: 139,
};

/** Jungle Rush's final hit (SmashWiki, Donkey Kong (SSBU)/Final Smash): the Spiked Ball's launch. */
export const SPIKED_BALL_HIT: ThrowHitDef = { damage: 14, angle: 70, kbg: 96, bkb: 90, hitlag: 1 };

/** The lash: Jungle Rush's detection capsule (radius 13 at Y 10, Z 8 to 28) as five grab circles, 5 apart. */
export const LASH: HitboxDef[] = [8, 13, 18, 23, 28].map((x, id) => ({
  id,
  x,
  y: 10,
  radius: 13,
  damage: 0,
  angle: 0,
  kbg: 0,
  bkb: 0,
  grab: true,
}));

/** `count` hold hits of `damage` every FUZZ_FRENZY.every frames from frame `from`, at the barrage's hitlag. */
const barrage = ({ from, count, damage }: { from: number; count: number; damage: number }): HoldHitDef[] =>
  Array.from({ length: count }, (_, i) => ({
    frame: from + FUZZ_FRENZY.every * i,
    damage,
    hitlag: FUZZ_FRENZY.barrageHitlag,
  }));

/** Fuzz Frenzy's activation: puffs up through the freeze and lashes the grabber out on 29-34. */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: FUZZ_FRENZY.whiffFaf,
  final: { freeze: FUZZ_FRENZY.freeze, still: true },
  commandGrab: 'finalSmashCinematic',
  hits: [{ frames: FUZZ_FRENZY.lash, boxes: LASH }],
};

/** Fuzz Frenzy's cinematic: the catch, 31 barrage hits on it, and the Spiked Ball's launch on frame 139. */
export const finalSmashCinematic: MoveDef = {
  kind: 'other',
  faf: FUZZ_FRENZY.cinematicFaf,
  final: { still: true },
  hits: [],
  holdHits: [FUZZ_FRENZY.catch, ...barrage(FUZZ_FRENZY.bumps), ...barrage(FUZZ_FRENZY.rolls)],
  throw: { frame: FUZZ_FRENZY.release, hit: SPIKED_BALL_HIT },
};
