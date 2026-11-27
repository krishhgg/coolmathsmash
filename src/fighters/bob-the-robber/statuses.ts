import type { StatusDef } from '../../sim/statuses';

/**
 * Ultimate's paralysis: floor(1 + knockback x hitlag multiplier x crouch), at most 90 frames. A paralyzed fighter can't
 * be paralyzed again until it lands, grabs a ledge or can act; a paralyzing hit before then deals its damage and
 * knockback only (SmashWiki, "Paralyze (effect)").
 */
export const statuses: Record<string, StatusDef> = {
  paralyzed: {
    frames: 1,
    perKnockback: 1,
    max: 90,
    freeze: true,
    endOnHit: true,
    immuneUntilFree: true,
    color: '#f2c62a',
  },
};
