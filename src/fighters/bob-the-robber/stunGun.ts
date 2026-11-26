import type { MoveDef } from '../types';
import { spawnEntity } from '../../sim/entities/entities';
import type { Ctx } from '../../sim/fighter';
import { MUZZLE, SHOTS, STUN_GUN } from './entities';

/**
 * Stun Gun (neutral special): Zero Suit Samus's Paralyzer in Ultimate. Its frame data, shots and sources are in
 * entities.ts, the paralysis in statuses.ts.
 */

/** On the frame after the release, fire the full shot if the charge is full and the uncharged one otherwise. */
function fire(x: Ctx): void {
  const { m, f } = x;
  if (f.actionFrame !== STUN_GUN.shot) return;
  const name = f.charge >= STUN_GUN.chargeFrames ? 'stunShotFull' : 'stunShot';
  spawnEntity(m, {
    kind: `bob-the-robber/${name}`,
    owner: f.port,
    pos: { x: f.pos.x + MUZZLE.x * f.facing, y: f.pos.y + MUZZLE.y },
    vel: { x: SHOTS[name].speed * f.facing, y: 0 },
    facing: f.facing,
    move: f.move,
  });
}

/** The same move in the air (Ultimate's one Paralyzer); its own name gives it a clip with his legs tucked. */
const stunGun = (air?: string): MoveDef => ({
  kind: 'other',
  faf: STUN_GUN.faf,
  charge: STUN_GUN.charge,
  chargeFrames: STUN_GUN.chargeFrames,
  hits: [],
  script: fire,
  ...(air && { air }),
});

export const neutralB = stunGun('neutralBAir');
export const neutralBAir = stunGun();
