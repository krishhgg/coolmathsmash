import { destroyEntity, spawnEntity } from '../../sim/entities/entities';
import type { EntityDef } from '../../sim/entities/types';
import type { HitboxDef } from '../types';

const pepperHit: HitboxDef = {
  id: 0,
  x: 0,
  y: 0,
  radius: 2.4,
  damage: 10,
  angle: 45,
  kbg: 60,
  bkb: 70,
  effect: 'fire',
};

export const entities: Record<string, EntityDef> = {
  pepperBomb: {
    radius: 1.5,
    lifetime: 160,
    gravity: 0.15,
    maxFall: 1.6,
    floor: 'bounce',
    wall: 'stop',
    bounce: 1.05,
    hits: [{ frames: [1, 160], boxes: [pepperHit] }],
    script({ e, m }) {
      const rising = e.vel.y > 0;
      const landed = e.data.rising === false && rising;
      e.data.rising = rising;
      if (!landed) return;
      const bounces = Number(e.data.bounces ?? 0) + 1;
      e.data.bounces = bounces;
      if (bounces < 3) return;
      destroyEntity(m, e, 'script');
      const burst = spawnEntity(m, {
        kind: 'papa-louie/pepperBurst',
        owner: e.owner,
        pos: e.pos,
        facing: e.facing,
        move: e.move,
      });
      burst.damageMul = e.damageMul;
    },
  },
  pepperBurst: {
    radius: 3.8,
    lifetime: 1,
    floor: 'pass',
    wall: 'pass',
    reflectable: false,
    absorbable: false,
    hits: [{ frames: [1, 1], boxes: [{ ...pepperHit, radius: 3.8 }] }],
  },
};
