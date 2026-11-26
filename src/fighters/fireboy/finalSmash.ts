import type { EntityDef } from '../../sim/entities/types';
import type { HitboxDef, HitWindow, MoveDef } from '../types';

/**
 * Fireboy's Final Smash, Fire Blast: a huge blast of fire thrown across the stage, on Mario Finale in Ultimate 13.0.1
 * (SmashWiki, "Mario (SSBU)/Final Smash"; the roster plan's "fire and water blasts"). Mario's two fireballs are
 * articles that outlive his own animation, so the blast is an entity that keeps burning after Fireboy can act again:
 *
 * - Timing table: early hits 65-104, mid hits 105-154, late hits 155-224, each at a rehit rate of 7; interruptible
 *   on frame 157 grounded and 147 aerial.
 * - Hitbox table: two fireballs (bones fire1 and fire2), radius 16.0, each stretched from Y -3 to 3. Early 2.5%,
 *   BK 25, KS 40 at angles 50 and 48, hitting anyone. Mid 3.0%: BK 20, KS 90 at 23 and 20 against airborne
 *   fighters, BK 15, KS 100 at 50 and 48 against grounded ones. Late 3.5%: BK 10, KS 120 at 23 and 20 airborne, BK 5,
 *   KS 130 at 50 and 48 grounded. Angle type Forward, hitlag x0.0, Flame effect; unblockable, unreflectable,
 *   unabsorbable, no clang. The angles are the numbers in the table's angle icons (AngleIcon50.png and so on), and
 *   the grounded and aerial flags its GroundedTrue/AerialFalse icons (HitboxDef.targets).
 * - Every window landed adds up to 74%: SmashWiki's Mario Finale article puts Ultimate's at "about 75%".
 *
 * SmashWiki gives no speed for the fireballs. At BLAST.speed the blast lands the most hits on a Mario-weight fighter
 * standing 30 units in front of Fireboy, summed over 0 to 150% (a sweep from 0.9 to 1.6 units a frame), and burns
 * 176 units, past the far ledge of Battlefield (160 wide). SmashWiki says opponents at low percents "may fall out" of
 * Mario Finale; here they don't, since the blast's lower half runs along the floor under them.
 */
export const BLAST = {
  /** Move frame the blast leaves the hands: Mario Finale's first hit. */
  frame: 65,
  /** Frames it burns: Mario Finale's hits run from frame 65 to 224. */
  lifetime: 160,
  /** Mario Finale's rehit rate. */
  rehit: 7,
  /** Units a frame, forward: an estimate, SmashWiki gives none. */
  speed: 1.1,
  /** Where its centre appears, from the feet: its tail at the thrust hands, its fireballs at 7 and 13 units up. */
  x: 20,
  y: 10,
  radius: 16,
  /** Each fireball is stretched from -3 to 3 about the blast's centre line. */
  stretch: 3,
};

/** One row of Mario Finale's hitbox table: both fireballs' values, and which fighters they hit. */
export interface MarioFinaleRow {
  damage: number;
  bkb: number;
  kbg: number;
  /** fire1's angle, then fire2's. */
  angles: [number, number];
  targets: HitboxDef['targets'];
}
type Row = MarioFinaleRow;

/**
 * Mario Finale's three windows, in move frames, with their rows. The mid and late windows each have an aerial-only row
 * (ids 0 and 1) and a grounded-only row (ids 2 and 3); the early window's one row hits both. Watergirl's Tidal Wave
 * (src/fighters/watergirl/finalSmash.ts) takes the same table.
 */
export const MARIO_FINALE: { frames: [number, number]; rows: Row[] }[] = [
  { frames: [65, 104], rows: [{ damage: 2.5, bkb: 25, kbg: 40, angles: [50, 48], targets: 'both' }] },
  {
    frames: [105, 154],
    rows: [
      { damage: 3, bkb: 20, kbg: 90, angles: [23, 20], targets: 'air' },
      { damage: 3, bkb: 15, kbg: 100, angles: [50, 48], targets: 'ground' },
    ],
  },
  {
    frames: [155, 224],
    rows: [
      { damage: 3.5, bkb: 10, kbg: 120, angles: [23, 20], targets: 'air' },
      { damage: 3.5, bkb: 5, kbg: 130, angles: [50, 48], targets: 'ground' },
    ],
  },
];

/** A row's two fireballs: fire1 above the centre line, fire2 below. */
const fireballs = (row: Row, id: number): HitboxDef[] =>
  [BLAST.stretch, -BLAST.stretch].map((y, i) => ({
    id: id + i,
    x: 0,
    y,
    radius: BLAST.radius,
    damage: row.damage,
    angle: row.angles[i]!,
    kbg: row.kbg,
    bkb: row.bkb,
    hitlag: 0,
    effect: 'fire',
    ...(row.targets !== 'both' && { targets: row.targets }),
  }));

/**
 * Mario Finale's windows cut into 7-frame rehit windows over the age of an entity spawned on its first hit frame (age
 * 1 = move frame BLAST.frame), with `boxes` drawing each row's two hitboxes from its first id.
 */
export function marioFinaleHits(boxes: (row: Row, id: number) => HitboxDef[]): HitWindow[] {
  const out: HitWindow[] = [];
  for (const w of MARIO_FINALE) {
    const all = w.rows.flatMap((row, i) => boxes(row, i * 2));
    for (let f = w.frames[0]; f <= w.frames[1]; f += BLAST.rehit) {
      const end = Math.min(f + BLAST.rehit - 1, w.frames[1]);
      out.push({ frames: [f - BLAST.frame + 1, end - BLAST.frame + 1], rehit: true, boxes: all });
    }
  }
  return out;
}

/** The blast: it burns through everything in its way and leaves the stage behind. */
export const blast: EntityDef = {
  radius: BLAST.radius,
  lifetime: BLAST.lifetime,
  floor: 'pass',
  wall: 'pass',
  pierce: true,
  transcendent: true,
  reflectable: false,
  absorbable: false,
  kind: 'other',
  hits: marioFinaleHits(fireballs),
};

const spawn = [{ frame: BLAST.frame, entity: 'blast', x: BLAST.x, y: BLAST.y, vx: BLAST.speed }];

/**
 * In the air Mario Finale "pushes Mario backwards a little, as well as give him a little jump upwards" (SmashWiki):
 * Fireboy holds still in the air through the move, and the release kicks him back and up by about 3 and 5 units.
 */
const RECOIL = { x: -0.3, y: 0.5, decay: 0.9 };

/** Fire Blast, grounded: interruptible on Mario Finale's frame 157. */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: 157,
  final: { range: 120 },
  air: 'finalSmashAir',
  hits: [],
  spawn,
};

/** Fire Blast in the air: interruptible on Mario Finale's aerial frame 147. */
export const finalSmashAir: MoveDef = {
  kind: 'other',
  faf: 147,
  final: { still: true, range: 120 },
  hits: [],
  spawn,
  script(x) {
    const { f } = x;
    // Only in the air: a platform rising under him can land him mid-move, which then plays on, grounded.
    if (f.ground) return;
    if (f.actionFrame === BLAST.frame) f.vel = { x: RECOIL.x * f.facing, y: RECOIL.y };
    else if (f.actionFrame > BLAST.frame) f.vel = { x: f.vel.x * RECOIL.decay, y: f.vel.y * RECOIL.decay };
  },
};
