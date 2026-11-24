import type { ButtonName } from './types';

export interface KeyboardBinding {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  /** Held: the stick moves at half tilt, for walking and tilt attacks on a keyboard. */
  walk: string[];
  buttons: Partial<Record<ButtonName, string[]>>;
}

/** Physical keys (KeyboardEvent.code), so layouts like AZERTY keep the same hand positions. */
export const KEYBOARD_BINDINGS: KeyboardBinding[] = [
  {
    up: ['KeyW'],
    down: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
    walk: ['ShiftLeft'],
    buttons: {
      attack: ['KeyF'],
      special: ['KeyG'],
      jump: ['KeyH'],
      shield: ['KeyR'],
      grab: ['KeyT'],
      taunt: ['KeyE'],
      start: ['Escape'],
    },
  },
  {
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    walk: ['ShiftRight', 'Numpad0'],
    buttons: {
      attack: ['KeyJ', 'Numpad1'],
      special: ['KeyK', 'Numpad2'],
      jump: ['KeyL', 'Numpad3'],
      shield: ['KeyU', 'Numpad4'],
      grab: ['KeyI', 'Numpad5'],
      taunt: ['KeyO', 'Numpad6'],
      start: ['Enter', 'NumpadEnter'],
    },
  },
];

/** Stick value a keyboard direction produces while the walk modifier is held. */
export const KEYBOARD_WALK_TILT = 0.5;

/** W3C "standard" gamepad mapping, laid out like Smash's default Pro Controller scheme. */
export const GAMEPAD_BUTTONS: Record<ButtonName, number[]> = {
  attack: [0],
  special: [1],
  jump: [2, 3],
  grab: [4, 5],
  shield: [6, 7],
  taunt: [12, 13, 14, 15],
  start: [9],
};
export const GAMEPAD_TRIGGER_THRESHOLD = 0.3;
