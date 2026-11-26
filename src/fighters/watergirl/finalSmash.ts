import type { EntityDef } from '../../sim/entities/types';
import { BLAST, marioFinaleHits, type MarioFinaleRow } from '../fireboy/finalSmash';
import type { HitboxDef, MoveDef } from '../types';

/**
 * Watergirl's Final Smash, Tidal Wave: she raises a wave out of the floor and sends it rolling across the stage, the
 * water half of the twins' "fire and water blasts" (roster plan). Her whole kit is on Mario's frames, and Fireboy's
 * Fire Blast is on Mario Finale, so hers is on Mario Finale too, in Ultimate 13.0.1 (SmashWiki, "Mario
 * (SSBU)/Final Smash", whose overview calls it "a large wave of fire to push opponents off the stage"):
 *
 * - Timing table: early hits 65-104, mid hits 105-154, late hits 155-224, each at a rehit rate of 7; interruptible
 *   on frame 157 grounded and 147 aerial. The wave is an entity that keeps rolling after she can act, as Mario's
 *   fireballs are articles that outlive his animation.
 * - Hitbox table: fire1 and fire2, radius 16.0, each stretched from Y -3 to 3, with the early 2.5%, mid 3% and late
 *   3.5% rows, grounded and aerial rows apart (MARIO_FINALE, src/fighters/fireboy/finalSmash.ts). Hitlag x0.0;
 *   unblockable, unreflectable, unabsorbable, no clang. Here fire1 is the wave's curling crest and fire2 its body
 *   along the floor. The Flame effect becomes the plain one: this is water, and the engine has no water effect.
 * - Every window landed adds up to 74%: SmashWiki's Mario Finale article puts Ultimate's at "about 75%".
 * - Mario Finale has no finishing hitbox; it KOs by carrying. Its strongest hits, the late rows, KO a Mario at
 *   Battlefield's ledge from 243.7% (aerial row, 23 degrees) and 288.5% (grounded row, 50 degrees) on SSBU-Calculator's
 *   KO calculator (rubendal/SSBU-Calculator 233590e, run headless on these values, fresh, no rage, no DI).
 *
 * SmashWiki gives no speed for the fireballs. Her wave sits higher than Fireboy's fire, its body on the floor, and
 * rolls at WAVE.speed (finalSmash.test.ts has the sweep).
 */
export const WAVE = {
  /** Move frame the wave breaks forward: Mario Finale's first hit. */
  frame: BLAST.frame,
  /** Frames it rolls: Mario Finale's hits run from frame 65 to 224. */
  lifetime: BLAST.lifetime,
  rehit: BLAST.rehit,
  /** Units a frame, forward: an estimate, SmashWiki gives none. */
  speed: 1.1,
  /** Where its centre rises, from the feet: in front of her sweeping hands, its body's lowest edge under the floor. */
  x: 20,
  y: 13,
  radius: 16,
  /** fire1 (the crest) and fire2 (the body) sit this far above and below the wave's centre line. */
  stretch: 3,
};

/** A row's two boxes: the crest (fire1) above the centre line, the body (fire2) below it. */
const waterBoxes = (row: MarioFinaleRow, id: number): HitboxDef[] =>
  [WAVE.stretch, -WAVE.stretch].map((y, i) => ({
    id: id + i,
    x: 0,
    y,
    radius: WAVE.radius,
    damage: row.damage,
    angle: row.angles[i]!,
    kbg: row.kbg,
    bkb: row.bkb,
    hitlag: 0,
    ...(row.targets !== 'both' && { targets: row.targets }),
  }));

/** The wave: it rolls through everything in its way and on past the ledge. */
export const wave: EntityDef = {
  radius: WAVE.radius,
  lifetime: WAVE.lifetime,
  floor: 'pass',
  wall: 'pass',
  pierce: true,
  transcendent: true,
  reflectable: false,
  absorbable: false,
  kind: 'other',
  hits: marioFinaleHits(waterBoxes),
};

const spawn = [{ frame: WAVE.frame, entity: 'wave', x: WAVE.x, y: WAVE.y, vx: WAVE.speed }];

/**
 * In the air Mario Finale "pushes Mario backwards a little, as well as give him a little jump upwards" (SmashWiki):
 * Watergirl holds still in the air through the move, and the release kicks her back and up by about 3 and 5 units.
 */
const RECOIL = { x: -0.3, y: 0.5, decay: 0.9 };

/** Tidal Wave, grounded: interruptible on Mario Finale's frame 157. */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: 157,
  final: { range: 120 },
  air: 'finalSmashAir',
  hits: [],
  spawn,
};

/** Tidal Wave in the air: interruptible on Mario Finale's aerial frame 147. */
export const finalSmashAir: MoveDef = {
  kind: 'other',
  faf: 147,
  final: { still: true, range: 120 },
  hits: [],
  spawn,
  script(x) {
    const { f } = x;
    // Only in the air: a platform rising under her can land her mid-move, which then plays on, grounded.
    if (f.ground) return;
    if (f.actionFrame === WAVE.frame) f.vel = { x: RECOIL.x * f.facing, y: RECOIL.y };
    else if (f.actionFrame > WAVE.frame) f.vel = { x: f.vel.x * RECOIL.decay, y: f.vel.y * RECOIL.decay };
  },
};
