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
 *   BK 25, KS 40 at angles 50 and 48. Mid 3.0%, BK 20, KS 90 at 23 and 20. Late 3.5%, BK 10, KS 120 at 23 and 20.
 *   Angle type Forward, hitlag x0.0, Flame effect; unblockable, unreflectable, unabsorbable, no clang. The angles
 *   are the numbers in the table's angle icons (AngleIcon50.png and so on).
 * - Every window landed adds up to 74%: SmashWiki's Mario Finale article puts Ultimate's at "about 75%".
 *
 * The table also gives the mid and late windows grounded-only rows (BK 15, KS 100 and BK 5, KS 130, at 50 and 48)
 * beside the aerial-only ones above. Hitboxes here can't target only grounded or only airborne fighters until
 * HitboxDef.targets lands (#230), so every target takes the aerial rows, which are what a fighter carried in the
 * blast meets.
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

/** Mario Finale's three windows, in move frames, with its two fireballs' boxes (fire1 above, fire2 below). */
const WINDOWS: {
  frames: [number, number];
  damage: number;
  bkb: number;
  kbg: number;
  angles: [number, number];
}[] = [
  { frames: [65, 104], damage: 2.5, bkb: 25, kbg: 40, angles: [50, 48] },
  { frames: [105, 154], damage: 3, bkb: 20, kbg: 90, angles: [23, 20] },
  { frames: [155, 224], damage: 3.5, bkb: 10, kbg: 120, angles: [23, 20] },
];

const fireball = (id: number, y: number, w: (typeof WINDOWS)[number]): HitboxDef => ({
  id,
  x: 0,
  y,
  radius: BLAST.radius,
  damage: w.damage,
  angle: w.angles[id]!,
  kbg: w.kbg,
  bkb: w.bkb,
  hitlag: 0,
  effect: 'fire',
});

/** Each window cut into 7-frame rehit windows over the blast's age (age 1 = move frame BLAST.frame). */
function blastHits(): HitWindow[] {
  const out: HitWindow[] = [];
  for (const w of WINDOWS) {
    const boxes = [fireball(0, BLAST.stretch, w), fireball(1, -BLAST.stretch, w)];
    for (let f = w.frames[0]; f <= w.frames[1]; f += BLAST.rehit) {
      const end = Math.min(f + BLAST.rehit - 1, w.frames[1]);
      out.push({ frames: [f - BLAST.frame + 1, end - BLAST.frame + 1], rehit: true, boxes });
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
  hits: blastHits(),
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
    if (f.actionFrame === BLAST.frame) f.vel = { x: RECOIL.x * f.facing, y: RECOIL.y };
    else if (f.actionFrame > BLAST.frame) f.vel = { x: f.vel.x * RECOIL.decay, y: f.vel.y * RECOIL.decay };
  },
};
