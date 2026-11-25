import type { EntityDef } from '../../sim/entities/types';

/**
 * Water Stream's pumps are Mario's F.L.U.D.D. pumps in Ultimate (SmashWiki, Mario (SSBU)/Down special, hitbox and
 * pump parameters): a 0% windbox at 55 degrees, 70 set knockback, 100 KBG, radius 4.0 scaled 0.8x-1.2x, living
 * 12 frames, gravity 0.17, falling speed 3. Charge adds up to 55 BKB; hitboxes are fixed data, so each tenth of a
 * full charge gets its own kind, `pump0` (uncharged) to `pump8` (full).
 */
export const PUMP = {
  tiers: 8,
  lifetime: 12,
  radius: 4,
  minSize: 0.8,
  maxSize: 1.2,
  maxBkb: 55,
};

function pump(tier: number): EntityDef {
  const t = tier / PUMP.tiers;
  const radius = PUMP.radius * (PUMP.minSize + (PUMP.maxSize - PUMP.minSize) * t);
  const bkb = PUMP.maxBkb * t;
  return {
    radius,
    lifetime: PUMP.lifetime,
    gravity: 0.17,
    maxFall: 3,
    hits: [
      {
        frames: [1, PUMP.lifetime],
        boxes: [{ id: 0, x: 0, y: 0, radius, damage: 0, angle: 55, kbg: 100, bkb, wbkb: 70, pushOnly: true }],
      },
    ],
  };
}

export const entities: Record<string, EntityDef> = Object.fromEntries(
  Array.from({ length: PUMP.tiers + 1 }, (_, tier) => [`pump${tier}`, pump(tier)]),
);
