import type { StageHitbox } from '../../sim/stage';

export const BELT_SPEED = 0.35;
export const ONION_PERIOD = 1320;
export const ONION_ENTRY = 1200;
export const ONION_WARNING = ONION_ENTRY - 45;

export const rollingOnion: StageHitbox = {
  x: -82,
  y: 4.1,
  motion(frame) {
    const travel = Math.max(0, (frame % ONION_PERIOD) - ONION_ENTRY);
    const overhang = Math.max(0, travel - 106);
    return [travel * 1.48, -0.12 * overhang ** 2];
  },
  schedule: { period: ONION_PERIOD, off: [[0, ONION_ENTRY - 1]] },
  boxes: [{ id: 0, x: 0, y: 0, radius: 4.25, damage: 8, angle: 32, kbg: 42, bkb: 28 }],
  rehit: 120,
};
