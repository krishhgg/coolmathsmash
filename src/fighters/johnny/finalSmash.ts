import type { Ctx } from '../../sim/fighter';
import type { HoldHitDef, MoveDef } from '../types';

/**
 * Johnny's Final Smash, Max Upgrade: he buys every upgrade in the shop at once, jets forward on fully upgraded boots
 * and traps the first opponent he meets, then works them over with a barrage of punches and point-blank laser shots
 * and finishes with an Upgraded Laser blast. It is Cloud's Omnislash in Ultimate 13.0.1, the Limit pairing: his Coin
 * Magnet is Limit Charge and his Upgraded Laser is Limit Blade Beam, so the meter's Final Smash is Limit's too.
 *
 * Taken from SmashWiki ("Cloud (SSBU)", Final Smash row of the moveset table, and "Omnislash / Omnislash Ver. 5"):
 *
 * - The shape. Cloud "charges forward and stops at the first opponent"; a hit traps them for a cinematic, and the
 *   last hit launches them. Here the dash is a command grab into the `finalSmashCinematic` trap (src/sim/finalSmash.ts).
 * - Damage, hit by hit: 1% (hit 1), 3% (hit 2), 2.2% (hits 3-16), 5% (hit 17), 4% (hit 18, falling) and 10% (hit 19,
 *   explosion), 53.8% when every hit connects. Hits 1-18 are the cinematic's hold hits and hit 19 its release.
 * - KO: "it can KO as low as 22%" (Cloud (SSBU)). The Omnislash article says "as early as 15%"; the Ultimate page's
 *   22 is the target.
 *
 * Not on SmashWiki or ultimateframedata.com (neither has a timing or hitbox table for Omnislash), so these are
 * estimates: the dash's frames, speed and reach, the cinematic's frames, and the release's angle, base knockback and
 * growth. The release is tuned so that koPercent puts its KO % 21.5 into the move at Battlefield's ledge, against
 * SmashWiki's 22.
 *
 * Unlike Omnislash, the dash traps one opponent (the trap framework holds the first it catches) and stops at a ledge
 * on the ground, as Johnny's Upgrade Dash does; Cloud dashes off it.
 */
export const OMNISLASH = {
  /** SmashWiki's hit-by-hit damage: hits 1 and 2, the fourteen hits 3-16, hits 17 and 18, and the hit-19 explosion. */
  damage: { catch: 1, tackle: 3, barrage: 2.2, charge: 5, fall: 4, explosion: 10 },
  barrageHits: 14,
  /** "53.8% (all hits connect)". */
  total: 53.8,
  /** "it can KO as low as 22%". */
  ko: 22,
} as const;

/** Max Upgrade's own frames and sizes: estimates (see above). */
export const MAX_UPGRADE = {
  /** The jet dash: the trap box is out and he flies forward on these frames, the first after the 40-frame freeze. */
  dash: { from: 42, to: 65, speed: 3.6 },
  /** The trap box, from the feet: his shoulder and lead fist as he flies in. */
  box: { x: 7, y: 9, radius: 6 },
  /** A whiffed dash can act again on this frame. */
  faf: 96,
  /** The cinematic's hold hits (move frames, before hitlag): the catch, the tackle, the barrage (first, every). */
  holds: { catch: 2, tackle: 12, barrage: { from: 24, every: 6 }, charge: 116, fall: 128 },
  /** The explosion: the cinematic's release. */
  release: 142,
  cinematicFaf: 172,
  /** The release's knockback: estimates tuned to SmashWiki's 22% KO. */
  explosion: { angle: 45, bkb: 85, kbg: 100 },
} as const;

/** How far ahead of his feet the dash can catch someone: the dash's travel plus the box's reach, for CPUs. */
export const MAX_UPGRADE_RANGE = 100;

const { dash, box, holds, explosion } = MAX_UPGRADE;
const { damage } = OMNISLASH;

/** Hits 1-18, in order. */
const holdHits: HoldHitDef[] = [
  { frame: holds.catch, damage: damage.catch },
  { frame: holds.tackle, damage: damage.tackle },
  ...Array.from({ length: OMNISLASH.barrageHits }, (_, i) => ({
    frame: holds.barrage.from + i * holds.barrage.every,
    damage: damage.barrage,
  })),
  { frame: holds.charge, damage: damage.charge },
  { frame: holds.fall, damage: damage.fall },
];

/**
 * The dash. Through the freeze he holds still; from the dash's first frame he flies level at its speed, then slows
 * and, in the air, starts to fall again (the move is `still`, so its gravity is off and the fall is scripted).
 */
function jetDash(x: Ctx): void {
  const { f, s } = x;
  if (f.actionFrame < dash.from) return;
  if (f.actionFrame <= dash.to) {
    f.vel.x = dash.speed * f.facing;
    if (!f.ground) f.vel.y = 0;
    return;
  }
  f.vel.x *= 0.7;
  if (!f.ground) f.vel.y = Math.max(f.vel.y - s.gravity, -s.fallSpeed);
}

/** Max Upgrade, grounded or in the air: the jet dash with the trap box out in front. */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: MAX_UPGRADE.faf,
  final: { still: true, range: MAX_UPGRADE_RANGE },
  commandGrab: 'finalSmashCinematic',
  hits: [
    {
      frames: [dash.from, dash.to],
      boxes: [{ id: 0, ...box, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true }],
    },
  ],
  script: jetDash,
};

/**
 * The cinematic: everyone else holds still while hits 1-18 land on the trapped opponent and the explosion launches
 * them. Johnny stays where he caught them; the dash's speed is dropped on the catch.
 */
export const finalSmashCinematic: MoveDef = {
  kind: 'other',
  faf: MAX_UPGRADE.cinematicFaf,
  final: { still: true },
  hits: [],
  holdHits,
  throw: {
    frame: MAX_UPGRADE.release,
    hit: { damage: damage.explosion, ...explosion },
  },
  script({ f }) {
    f.vel.x = 0;
  },
};

export const finalSmashMoves: Record<string, MoveDef> = { finalSmash, finalSmashCinematic };
