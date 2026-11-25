export const TIDE_HEIGHT = 14;

const TIDE_PERIOD = 40 * 60;
const RAMP = 3 * 60;
const HOLD = 8 * 60;
const BOB_PERIOD = 4 * 60;

export function tideHeight(frame: number): number {
  if (frame < TIDE_PERIOD) return 0;

  const phase = frame % TIDE_PERIOD;
  const fraction = phase < RAMP ? phase / RAMP : Math.max(0, 1 - Math.max(0, phase - RAMP - HOLD) / RAMP);
  return TIDE_HEIGHT * fraction * fraction * (3 - 2 * fraction);
}

export function boatMotion(frame: number): [number, number] {
  return [0, tideHeight(frame) + 3 * Math.sin((2 * Math.PI * (frame % BOB_PERIOD)) / BOB_PERIOD)];
}
