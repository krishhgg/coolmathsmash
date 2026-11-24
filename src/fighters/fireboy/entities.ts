import type { EntityDef } from '../../sim/entities/types';

/**
 * Fireboy's projectiles. The fireball is Mario's (Ultimate: 2.4-unit radius, angle 361, 35 growth / 20 base,
 * 70 frames of life, bouncing to the same height every time and back off walls) at the roster's 5.5%.
 */
export const entities: Record<string, EntityDef> = {
  fireball: {
    radius: 2.4,
    lifetime: 70,
    gravity: 0.1,
    maxFall: 1.6,
    floor: 'bounce',
    wall: 'bounce',
    bounce: 1.1,
    hits: [
      {
        frames: [1, 70],
        boxes: [
          { id: 0, x: 0, y: 0, radius: 2.4, damage: 5.5, angle: 361, kbg: 35, bkb: 20, effect: 'fire' },
        ],
      },
    ],
  },
};
