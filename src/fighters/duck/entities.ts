import type { EntityDef } from '../../sim/entities/types';
import { finalEntities } from './finalSmash';

const lifetime = 24;
const radius = 1.3;

export const entities: Record<string, EntityDef> = {
  seed: {
    radius,
    lifetime,
    hits: [
      {
        frames: [1, lifetime],
        boxes: [{ id: 0, x: 0, y: 0, radius, damage: 1, angle: 361, kbg: 30, bkb: 22 }],
      },
    ],
  },
  ...finalEntities,
};
