import type { StatusDef } from '../../sim/statuses';

/**
 * Squared, from Red Ball 4, where the Black Square's factory squares everything round. Sit-Squash (down throw)
 * squares whoever he sits on. Its numbers are Ultimate's flower (Lip's Stick; SmashWiki, "Flower (effect)"):
 * floor(20 + 40 x the % the hit added) frames, the 1v1 multiplier included, at most 3000; squaring a squared
 * fighter adds to it; 1% every 21 frames; each new stick direction cuts 16 frames and each button press 28.8.
 */
export const SQUARED: StatusDef = {
  frames: 20,
  perDamage: 40,
  max: 3000,
  stack: 'add',
  tick: { every: 21, damage: 1 },
  mash: { stick: 16, button: 28.8 },
  color: '#3b3b46',
};

export const statuses: Record<string, StatusDef> = { squared: SQUARED };
