import { KEYBOARD_BINDINGS, type KeyboardBinding } from '../input/bindings';
import { BUTTON_NAMES, type ButtonName } from '../input/types';

/** Something a player can rebind: a direction, the keyboard walk modifier, or a fight button. */
export type ControlAction = 'up' | 'down' | 'left' | 'right' | 'walk' | ButtonName;

type MoveAction = Extract<ControlAction, 'up' | 'down' | 'left' | 'right' | 'walk'>;

/** In the order the controls screen lists them. */
export const CONTROL_ACTIONS: readonly ControlAction[] = [
  'up',
  'down',
  'left',
  'right',
  'walk',
  'attack',
  'special',
  'jump',
  'shield',
  'grab',
  'taunt',
  'start',
];

export const ACTION_LABELS: Record<ControlAction, string> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  walk: 'Walk',
  attack: 'Attack',
  special: 'Special',
  jump: 'Jump',
  shield: 'Shield',
  grab: 'Grab',
  taunt: 'Taunt',
  start: 'Pause',
};

export const isMoveAction = (a: ControlAction): a is MoveAction =>
  a === 'up' || a === 'down' || a === 'left' || a === 'right' || a === 'walk';

export function boundKeys(binding: KeyboardBinding, action: ControlAction): string[] {
  return (isMoveAction(action) ? binding[action] : binding.buttons[action]) ?? [];
}

function setKeys(binding: KeyboardBinding, action: ControlAction, keys: string[]): void {
  if (isMoveAction(action)) binding[action] = keys;
  else binding.buttons[action] = keys;
}

/** Where a rebind took a key or button away from. */
export interface Taken {
  keyboard: number;
  action: ControlAction;
}

/**
 * Make `code` the only key for `action` on keyboard `index`, taking it off every other action on both halves: they
 * share one physical keyboard, so a key left on two actions would press both. Returns where it was taken from.
 */
export function bindKey(
  keyboards: KeyboardBinding[],
  index: number,
  action: ControlAction,
  code: string,
): Taken[] {
  const taken: Taken[] = [];
  keyboards.forEach((binding, keyboard) => {
    for (const a of CONTROL_ACTIONS) {
      if (keyboard === index && a === action) continue;
      const keys = boundKeys(binding, a);
      if (!keys.includes(code)) continue;
      setKeys(
        binding,
        a,
        keys.filter((k) => k !== code),
      );
      taken.push({ keyboard, action: a });
    }
  });
  const target = keyboards[index];
  if (target) setKeys(target, action, [code]);
  return taken;
}

/**
 * Put keyboard `index` back to its default keys, taking those keys off the other half so no key ends up on both.
 */
export function resetKeyboard(keyboards: KeyboardBinding[], index: number): void {
  const defaults = structuredClone(KEYBOARD_BINDINGS[index]!);
  const codes = CONTROL_ACTIONS.flatMap((a) => boundKeys(defaults, a));
  keyboards.forEach((binding, keyboard) => {
    if (keyboard === index) return;
    for (const a of CONTROL_ACTIONS) {
      const keys = boundKeys(binding, a);
      if (keys.some((k) => codes.includes(k)))
        setKeys(
          binding,
          a,
          keys.filter((k) => !codes.includes(k)),
        );
    }
  });
  keyboards[index] = defaults;
}

/** Make `button` the only gamepad button for `action`, taking it off the other actions. Returns those actions. */
export function bindButton(
  pad: Record<ButtonName, number[]>,
  action: ButtonName,
  button: number,
): ButtonName[] {
  const taken = BUTTON_NAMES.filter((a) => a !== action && pad[a].includes(button));
  for (const a of taken) pad[a] = pad[a].filter((b) => b !== button);
  pad[action] = [button];
  return taken;
}

const KEY_NAMES: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'L-Shift',
  ShiftRight: 'R-Shift',
  ControlLeft: 'L-Ctrl',
  ControlRight: 'R-Ctrl',
  AltLeft: 'L-Alt',
  AltRight: 'R-Alt',
  MetaLeft: 'L-Meta',
  MetaRight: 'R-Meta',
  Escape: 'Esc',
  CapsLock: 'Caps Lock',
  ContextMenu: 'Menu',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Insert: 'Ins',
  Delete: 'Del',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  NumLock: 'Num Lock',
  NumpadEnter: 'Num Enter',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .',
  NumpadEqual: 'Num =',
};

/** A KeyboardEvent.code as players read it: KeyW → W, ArrowLeft → ←, ShiftLeft → L-Shift, Numpad1 → Num 1. */
export function keyLabel(code: string): string {
  const named = KEY_NAMES[code];
  if (named) return named;
  const key = /^(?:Key|Digit)(.)$/.exec(code);
  if (key) return key[1]!;
  const numpad = /^Numpad(\d)$/.exec(code);
  if (numpad) return `Num ${numpad[1]}`;
  return code;
}

/** Standard-mapping button names, Xbox-style face buttons (0 = bottom = A) and Switch-style shoulders. */
const PAD_NAMES = [
  'A',
  'B',
  'X',
  'Y',
  'L',
  'R',
  'ZL',
  'ZR',
  'Select',
  'Start',
  'L-Stick',
  'R-Stick',
  'D-pad ↑',
  'D-pad ↓',
  'D-pad ←',
  'D-pad →',
  'Home',
];

export const DPAD_BUTTONS: readonly number[] = [12, 13, 14, 15];

export const padButtonLabel = (button: number): string => PAD_NAMES[button] ?? `Button ${button}`;

/** A binding's buttons as labels, the four D-pad directions together as one "D-pad". */
export function padButtonLabels(buttons: readonly number[]): string[] {
  if (!DPAD_BUTTONS.every((b) => buttons.includes(b))) return buttons.map(padButtonLabel);
  return [...buttons.filter((b) => !DPAD_BUTTONS.includes(b)).map(padButtonLabel), 'D-pad'];
}
