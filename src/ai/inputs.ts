import { Btn, neutralInput, type InputFrame } from '../input/types';

/**
 * Input frames the CPU sends, written facing right (`x > 0` and `cx > 0` mean forward) and mirrored with
 * `facing` when used. Tilts hold the stick at half (under the smash and dash thresholds, over the direction
 * threshold), smash attacks and aerials use the C-stick so the main stick stays free for drift, and up special uses
 * a stick height under the tap-jump threshold so it never jumps instead.
 */
export const STICK = { tilt: 50, special: 60, walkMax: 59, full: 100 } as const;

export interface Press {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  buttons?: number;
}

export function press(p: Press, facing: 1 | -1 = 1): InputFrame {
  const i = neutralInput();
  i.x = (p.x ?? 0) * facing;
  i.y = p.y ?? 0;
  i.cx = (p.cx ?? 0) * facing;
  i.cy = p.cy ?? 0;
  i.buttons = p.buttons ?? 0;
  return i;
}

/** Grounded inputs for each move name (see docs/fighters.md for the input → move table). */
export const GROUND_INPUTS: Record<string, Press> = {
  jab: { buttons: Btn.Attack },
  ftilt: { x: STICK.tilt, buttons: Btn.Attack },
  utilt: { y: STICK.tilt, buttons: Btn.Attack },
  dtilt: { y: -STICK.tilt, buttons: Btn.Attack },
  fsmash: { cx: STICK.full },
  usmash: { cy: STICK.full },
  dsmash: { cy: -STICK.full },
  neutralB: { buttons: Btn.Special },
  sideB: { x: STICK.special, buttons: Btn.Special },
  upB: { y: STICK.special, buttons: Btn.Special },
  downB: { y: -STICK.special, buttons: Btn.Special },
};

/** Airborne inputs for each move name. */
export const AIR_INPUTS: Record<string, Press> = {
  nair: { buttons: Btn.Attack },
  fair: { cx: STICK.full },
  bair: { cx: -STICK.full },
  uair: { cy: STICK.full },
  dair: { cy: -STICK.full },
  neutralB: { buttons: Btn.Special },
  sideB: { x: STICK.special, buttons: Btn.Special },
  upB: { y: STICK.special, buttons: Btn.Special },
  downB: { y: -STICK.special, buttons: Btn.Special },
};

/** Moves whose input turns the fighter around when the stick points backwards. */
export const TURNING_MOVES = new Set(['ftilt', 'fsmash', 'sideB']);

export const AERIALS = ['nair', 'fair', 'bair', 'uair', 'dair'] as const;
export const GROUND_MOVES = [
  'jab',
  'ftilt',
  'utilt',
  'dtilt',
  'fsmash',
  'usmash',
  'dsmash',
  'neutralB',
  'sideB',
  'upB',
  'downB',
] as const;
export const SPECIALS = ['neutralB', 'sideB', 'upB', 'downB'] as const;
