import { destroyEntity, spawnEntity } from '../../sim/entities/entities';
import type { EntityDef } from '../../sim/entities/types';
import type { MoveDef } from '../types';

const FUSE = 90;

export const grenade: MoveDef = {
  kind: 'other',
  faf: 40,
  continuesOnLanding: true,
  hits: [],
  spawn: [{ frame: 16, entity: 'grenade', x: 7, y: 8, vx: 2.1, vy: 2.8, max: 2 }],
};

export const grenadeEntities: Record<string, EntityDef> = {
  grenade: {
    radius: 1.8,
    gravity: 0.18,
    maxFall: 3.5,
    floor: 'bounce',
    wall: 'bounce',
    bounce: 0.9,
    script({ m, e }) {
      if (e.age <= FUSE) {
        e.vel.x *= 0.98;
        return;
      }
      spawnEntity(m, {
        kind: 'raftwars/grenadeBurst',
        owner: e.owner,
        pos: e.pos,
        facing: e.facing,
        move: e.move,
      });
      destroyEntity(m, e, 'script');
    },
  },
  grenadeBurst: {
    radius: 12,
    lifetime: 3,
    floor: 'pass',
    wall: 'pass',
    pierce: true,
    transcendent: true,
    reflectable: false,
    absorbable: false,
    hits: [
      {
        frames: [1, 3],
        boxes: [
          {
            id: 0,
            x: 0,
            y: 0,
            radius: 12,
            damage: 13,
            angle: 80,
            kbg: 69,
            bkb: 60,
            direction: 'away',
            effect: 'fire',
          },
        ],
      },
    ],
  },
};
