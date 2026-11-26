import type { StatusDef } from '../../sim/statuses';

/** Ultimate's paralysis: floor(1 + knockback x hitlag multiplier x crouch), at most 90 frames. */
export const statuses: Record<string, StatusDef> = {
  paralyzed: {
    frames: 1,
    perKnockback: 1,
    max: 90,
    freeze: true,
    endOnHit: true,
    color: '#f2c62a',
  },
};
