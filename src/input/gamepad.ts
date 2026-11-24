import { GAMEPAD_BUTTONS, GAMEPAD_TRIGGER_THRESHOLD } from './bindings';
import { BUTTON_NAMES, buttonBit, neutralInput, quantizeAxis, type InputFrame } from './types';

export interface PadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

/** Reads a standard-mapping gamepad. Dead zones are applied by the simulation, not here, so replays keep raw values. */
export function readGamepad(pad: PadLike): InputFrame {
  const out = neutralInput();
  out.x = quantizeAxis(pad.axes[0] ?? 0);
  out.y = quantizeAxis(-(pad.axes[1] ?? 0));
  out.cx = quantizeAxis(pad.axes[2] ?? 0);
  out.cy = quantizeAxis(-(pad.axes[3] ?? 0));
  for (const name of BUTTON_NAMES) {
    for (const index of GAMEPAD_BUTTONS[name]) {
      const b = pad.buttons[index];
      if (b && (b.pressed || b.value > GAMEPAD_TRIGGER_THRESHOLD)) out.buttons |= buttonBit(name);
    }
  }
  return out;
}

export function connectedPads(): PadLike[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  return navigator.getGamepads().filter((p): p is Gamepad => !!p && p.connected && p.mapping === 'standard');
}
