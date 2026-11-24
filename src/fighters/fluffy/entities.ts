import { destroyEntity } from '../../sim/entities/entities';
import type { EntityDef } from '../../sim/entities/types';

/** Forward speed the candy leaves at, and how much it slows each frame: it turns back after about 50 units. */
export const CANDY_SPEED = 3;
export const CANDY_DRAG = 0.09;

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
        frames: [1, 33],
        boxes: [{ id: 0, x: 0, y: 0, radius: 3, damage: 7, angle: 361, kbg: 60, bkb: 35 }],
      },
      {
        frames: [34, 110],
        rehit: true,
        boxes: [{ id: 0, x: 0, y: 0, radius: 3, damage: 5, angle: 50, kbg: 40, bkb: 30 }],
      },
    ],
    script({ m, e, owner }) {
      const out = (e.data.dir as number | undefined) ?? e.facing;
      e.data.dir = out;
      e.vel.x -= CANDY_DRAG * out;
      if (Math.sign(e.vel.x) === -out) e.facing = -out as 1 | -1;
      if (e.facing === out) {
        e.vel.y = 0.3 - 0.02 * e.age;
        return;
      }
      if (!owner) return;
      const home = { x: owner.pos.x, y: owner.pos.y + 5.5 };
      e.vel.y = Math.max(-1.5, Math.min(1.5, (home.y - e.pos.y) * 0.12));
      if (Math.abs(home.x - e.pos.x) < 5 && Math.abs(home.y - e.pos.y) < 7) destroyEntity(m, e, 'script');
    },
  },
};
