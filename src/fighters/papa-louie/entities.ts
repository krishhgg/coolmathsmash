import { destroyEntity, spawnEntity } from '../../sim/entities/entities';
import type { EntityDef, EntityState } from '../../sim/entities/types';
import type { MatchState } from '../../sim/match';
import type { HitboxDef } from '../types';

/**
 * Pepper Bomb's hit. Its Ultimate analogue is Snake's Hand Grenade, the lobbed bomb that bounces and goes off on a
 * fuse. The grenade's explosion (SmashWiki, Snake (SSBU)/Neutral special) is 9% at 80 degrees, 60 base and 69 growth,
 * -4.5 shield damage and flame, and the pepper's hit takes all of them. It sends away from the bomb's centre, as an
 * explosion does.
 */
export const PEPPER_HIT: HitboxDef = {
  id: 0,
  x: 0,
  y: 0,
  radius: 2.4,
  damage: 9,
  angle: 80,
  kbg: 69,
  bkb: 60,
  shieldDamage: -4.5,
  effect: 'fire',
  direction: 'away',
};

/** Landings before the bomb bursts: it bounces twice and bursts on the third. */
export const PEPPER_LANDINGS = 3;

/**
 * The burst is out for two frames, as the grenade's explosion is (hits on frames 1 and 2, radius 12 then 20), and like
 * it never clanks. The pepper is smaller than a grenade, so it keeps the preview branch's 3.8 radius on frame 1 and
 * grows by the grenade's 20/12 on frame 2.
 */
const BURST_RADIUS = 3.8;
const BURST_GROWTH = 20 / 12;

/** Replace the bomb with its burst where it is, keeping its owner, move and any reflection's damage boost. */
function burst(m: MatchState, e: EntityState): void {
  destroyEntity(m, e, 'script');
  const b = spawnEntity(m, {
    kind: 'papa-louie/pepperBurst',
    owner: e.owner,
    pos: e.pos,
    facing: e.facing,
    move: e.move,
  });
  b.damageMul = e.damageMul;
}

/**
 * Papa Louie's projectiles. The bomb's lob (gravity 0.15, 1.05 bounce, 1.6 max fall) is the preview branch's; its
 * 150-frame fuse is the Hand Grenade's (it explodes on its own after 150 frames), so a bomb that has not landed
 * three times by then still goes off.
 */
export const entities: Record<string, EntityDef> = {
  pepperBomb: {
    radius: 1.5,
    lifetime: 150,
    gravity: 0.15,
    maxFall: 1.6,
    floor: 'bounce',
    wall: 'stop',
    bounce: 1.05,
    hits: [{ frames: [1, 150], boxes: [PEPPER_HIT] }],
    script({ e, m }) {
      if (e.age >= e.lifetime) return burst(m, e);
      // The script runs before movement, so a floor bounce shows here the next frame as a fall turned into a rise.
      const rising = e.vel.y > 0;
      const landed = e.data.rising === false && rising;
      e.data.rising = rising;
      if (!landed) return;
      e.data.landings = Number(e.data.landings ?? 0) + 1;
      if (Number(e.data.landings) >= PEPPER_LANDINGS) burst(m, e);
    },
  },
  pepperBurst: {
    radius: BURST_RADIUS,
    lifetime: 2,
    floor: 'pass',
    wall: 'pass',
    reflectable: false,
    absorbable: false,
    transcendent: true,
    // An area blast: it hits every opponent and hittable entity it overlaps, each once, like the grenade's explosion.
    pierce: true,
    hits: [
      { frames: [1, 1], boxes: [{ ...PEPPER_HIT, radius: BURST_RADIUS }] },
      { frames: [2, 2], boxes: [{ ...PEPPER_HIT, radius: BURST_RADIUS * BURST_GROWTH }] },
    ],
  },
};
