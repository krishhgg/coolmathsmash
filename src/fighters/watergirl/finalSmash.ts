import type { EntityDef } from '../../sim/entities/types';
import { marioFinaleHits, type MarioFinaleRow } from '../fireboy/finalSmash';
import type { HitboxDef, MoveDef } from '../types';
import { WAVE, WAVE_BOXES } from './finalSmashData';

/** Tidal Wave, Watergirl's Final Smash, on Mario Finale: the numbers and their sources are in finalSmashData.ts. */

/** A row's two boxes, WAVE_BOXES: the crest (fire1) above the centre line, the body (fire2) below it. */
const waterBoxes = (row: MarioFinaleRow, id: number): HitboxDef[] =>
  WAVE_BOXES.map(({ x, y, radius }, i) => ({
    id: id + i,
    x,
    y,
    radius,
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
