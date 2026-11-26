import type { EntityDef } from '../../sim/entities/types';
import { blast } from './finalSmash';

/**
 * Fireboy's projectiles. The fireball is Mario's Fire Ball (Ultimate: 2.4-unit radius, angle 361, 70 frames of life,
 * bouncing to the same height every time and back off walls) at the roster's 5.5%. Knockback is the clean hit's:
 * base 35, growth 20 (SmashWiki, Mario (SSBU)/Neutral special, Hitboxes: BK 35, KS 20).
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
          { id: 0, x: 0, y: 0, radius: 2.4, damage: 5.5, angle: 361, kbg: 20, bkb: 35, effect: 'fire' },
        ],
      },
    ],
  },
  /** Fire Blast's fire, Mario Finale's fireballs (finalSmash.ts). */
  blast,
};
