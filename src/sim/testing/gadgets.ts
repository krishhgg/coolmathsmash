import { defineFighter } from '../../fighters/types';
import { marioReference } from './reference';

const hit = (damage: number) => ({ id: 0, x: 0, y: 0, radius: 2, damage, angle: 361, kbg: 50, bkb: 20 });

/**
 * A test-only fighter (Mario's stats) whose moves and entities exercise the entity system: a straight bolt, a
 * 60% cannonball, a piercing beam, a reflector and an absorber with Ultimate's default multipliers, a hittable crate and an
 * owner-controlled minion. Not playable; tests register it.
 */
export const gadgets = defineFighter({
  id: 'test-gadgets',
  name: 'Test gadgets',
  series: 'tests',
  stats: marioReference.stats,
  moves: {
    shoot: {
      kind: 'other',
      faf: 20,
      hits: [],
      spawn: [{ frame: 3, entity: 'bolt', x: 6, y: 8, vx: 2, max: 2 }],
    },
    reflect: { kind: 'other', faf: 40, hits: [], reflectors: [{ frames: [1, 30], x: 4, y: 8, radius: 8 }] },
    absorb: { kind: 'other', faf: 40, hits: [], absorbers: [{ frames: [1, 30], x: 0, y: 8, radius: 9 }] },
    strike: {
      kind: 'other',
      faf: 30,
      hits: [
        {
          frames: [1, 3],
          boxes: [{ id: 0, x: 8, y: 6, radius: 6, damage: 12, angle: 45, kbg: 100, bkb: 30 }],
        },
      ],
    },
  },
  entities: {
    /** A straight 6% shot, destroyed by the stage. */
    bolt: { radius: 1.5, lifetime: 120, hits: [{ frames: [1, 120], boxes: [hit(6)] }] },
    /** A 60% shot, too strong for reflectors (50%) and absorbers (30%). */
    cannon: { radius: 3, lifetime: 120, hits: [{ frames: [1, 120], boxes: [hit(60)] }] },
    /** A 4% shot that goes through everyone it hits. */
    beam: { radius: 1.5, lifetime: 120, pierce: true, hits: [{ frames: [1, 120], boxes: [hit(4)] }] },
    /** A 30 HP crate that sits on the stage and is knocked around by hits. */
    crate: { radius: 4, hp: 30, weight: 100, gravity: 0.1, maxFall: 2, floor: 'land', wall: 'stop' },
    /** A 10 HP minion that walks where its owner holds the stick. */
    minion: {
      radius: 3,
      hp: 10,
      gravity: 0.1,
      maxFall: 2,
      floor: 'land',
      wall: 'stop',
      script(x) {
        if (x.c) x.e.vel.x = (x.c.cur.x / 100) * 1.2;
      },
    },
  },
});
