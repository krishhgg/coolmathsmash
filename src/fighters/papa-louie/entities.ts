import { destroyEntity } from '../../sim/entities/entities';
import type { EntityDef } from '../../sim/entities/types';

/**
 * Papa Louie's throwables. The pepper bomb is PL1's X weapon: lobbed in an arc, it bounces off the floor and walls,
 * bursts on whoever it touches, and bursts on its own after two bounces (Mario's fireball's bounce, at the roster's
 * 10%).
 */
export const entities: Record<string, EntityDef> = {
  pepperBomb: {
    radius: 1.5,
    lifetime: 160,
    gravity: 0.09,
    maxFall: 1.6,
    floor: 'bounce',
    wall: 'bounce',
    bounce: 1.25,
    hits: [
      {
        frames: [1, 160],
        boxes: [{ id: 0, x: 0, y: 0, radius: 2.4, damage: 10, angle: 45, kbg: 60, bkb: 70, effect: 'fire' }],
      },
    ],
    script(x) {
      const { e } = x;
      if (e.age < 2) return;
      const rising = Number(e.data.rising ?? 0) > 0;
      if (e.vel.y > 0 && !rising) e.data.bounces = ((e.data.bounces as number) ?? 0) + 1;
      e.data.rising = e.vel.y > 0 ? 1 : 0;
      if ((e.data.bounces as number) >= 2) destroyEntity(x.m, e, 'script');
    },
  },
};
