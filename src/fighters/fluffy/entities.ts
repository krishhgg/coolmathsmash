import { destroyEntity } from '../../sim/entities/entities';
import type { EntityDef } from '../../sim/entities/types';

/** Forward speed the candy leaves at, and how much it slows each frame: it turns back after about 50 units. */
export const CANDY_SPEED = 3;
const CANDY_DRAG = 0.09;
const TURN_FRAME = 34;

/**
 * Fluffy's projectiles. The candy is Catch the Candy's goal, flung like a frisbee (the video: "he could fling the
 * candy like Frisbees"): it flies out, slows, turns back about 50 units away and curves home to Fluffy, who catches
 * it. It hits once on the way out (7%) and once on the way back (5%), pulling the target toward him.
 */
export const entities: Record<string, EntityDef> = {
  candy: {
    radius: 2.5,
    lifetime: 110,
    floor: 'pass',
    wall: 'pass',
    pierce: true,
    hits: [
      {
        frames: [1, TURN_FRAME - 1],
        boxes: [{ id: 0, x: 0, y: 0, radius: 3, damage: 7, angle: 361, kbg: 60, bkb: 35 }],
      },
      {
        frames: [TURN_FRAME, 110],
        rehit: true,
        boxes: [{ id: 0, x: 0, y: 0, radius: 3, damage: 5, angle: 50, kbg: 40, bkb: 30 }],
      },
    ],
    script({ m, e, owner }) {
      if (e.reflects > 0) return;
      if (e.age < TURN_FRAME) {
        e.vel.x -= CANDY_DRAG * e.facing;
        e.vel.y = 0.3 - 0.02 * e.age;
        return;
      }
      if (!owner) return;
      const dx = owner.pos.x - e.pos.x;
      const dy = owner.pos.y + 5.5 - e.pos.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 7) return destroyEntity(m, e, 'script');
      const speed = CANDY_DRAG * (e.age - TURN_FRAME + 1);
      e.vel.x = Math.max(-speed, Math.min(speed, dx));
      e.vel.y = Math.max(-1.5, Math.min(1.5, dy * 0.12));
      if (dx !== 0) e.facing = dx < 0 ? -1 : 1;
    },
  },
};
