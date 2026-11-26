import type { StatusDef, StatusState } from '../../sim/statuses';

/**
 * Cheesed: coated in grated Parmesan by Parmesan Shaker (his side special). Its numbers are Inkling's ink (SmashWiki,
 * "Ink (status)"): the coat builds to 300 units; a coated fighter takes 1 + coat x 0.5 / 180 times the % from any
 * source, at most 1.5x (from 180 units), without any hit's knockback changing; the coat holds for 120 frames after the
 * last coating hit, then wears off 0.25 units a frame (180 units last 14 seconds, 300 last 22, as the page says); a KO
 * takes it off, and mashing, water and being hit don't. Each shot adds 12 units, the ink per hit of Splattershot (the
 * same page's table), Inkling's own spray.
 */
export const CHEESE = { perShot: 12, max: 300, hold: 120, decay: 0.25, full: 180, maxMul: 1.5 };

/** The damage multiplier a Cheesed fighter takes at its coat level. */
export const cheeseMul = (s: StatusState): number =>
  1 + ((CHEESE.maxMul - 1) * Math.min(s.level ?? 0, CHEESE.full)) / CHEESE.full;

export const CHEESED: StatusDef = {
  frames: CHEESE.hold,
  coat: { add: CHEESE.perShot, max: CHEESE.max, decay: CHEESE.decay },
  damageTaken: cheeseMul,
  color: '#f2cf5b',
};

export const statuses: Record<string, StatusDef> = { cheesed: CHEESED };
