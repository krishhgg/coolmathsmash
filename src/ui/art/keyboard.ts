import { keyLabel } from '../../session/controls';

/** A key on the keyboard picture, in key units (1 = one letter key). */
export interface KeyCap {
  code: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Rows as "code[:width[xheight]]" tokens, "_" for a gap. Row 0 is the function row; the rows below it start a
 * quarter key lower, like a real keyboard.
 */
const BLOCKS: { x: number; rows: string[] }[] = [
  {
    x: 0,
    rows: [
      'Escape _:1 F1 F2 F3 F4 _:0.5 F5 F6 F7 F8 _:0.5 F9 F10 F11 F12',
      'Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal Backspace:2',
      'Tab:1.5 KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight Backslash:1.5',
      'CapsLock:1.75 KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote Enter:2.25',
      'ShiftLeft:2.25 KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash ShiftRight:2.75',
      'ControlLeft:1.25 MetaLeft:1.25 AltLeft:1.25 Space:6.25 AltRight:1.25 MetaRight:1.25 ContextMenu:1.25 ControlRight:1.25',
    ],
  },
  {
    x: 15.5,
    rows: [
      '',
      'Insert Home PageUp',
      'Delete End PageDown',
      '',
      '_:1 ArrowUp',
      'ArrowLeft ArrowDown ArrowRight',
    ],
  },
  {
    x: 19,
    rows: [
      '',
      'NumLock NumpadDivide NumpadMultiply NumpadSubtract',
      'Numpad7 Numpad8 Numpad9 NumpadAdd:1x2',
      'Numpad4 Numpad5 Numpad6',
      'Numpad1 Numpad2 Numpad3 NumpadEnter:1x2',
      'Numpad0:2 NumpadDecimal',
    ],
  },
];

/** A full-size keyboard (main block, arrows and numpad): 23 x 6.25 keys. */
export const KEYBOARD_SIZE = { w: 23, h: 6.25 };

export const KEYBOARD_KEYS: readonly KeyCap[] = BLOCKS.flatMap(({ x: x0, rows }) =>
  rows.flatMap((row, r) => {
    let x = x0;
    const y = r === 0 ? 0 : r + 0.25;
    return row
      .split(' ')
      .filter(Boolean)
      .flatMap((token) => {
        const [code = '', size = '1'] = token.split(':');
        const [w = 1, h = 1] = size.split('x').map(Number);
        const key = { code, x, y, w, h };
        x += w;
        return code === '_' ? [] : [key];
      });
  }),
);

const CAPS: Record<string, string> = {
  Backspace: '⌫',
  CapsLock: 'Caps',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  MetaLeft: '',
  MetaRight: '',
  ContextMenu: '',
  Space: '',
  NumLock: 'Num',
  NumpadEnter: '⏎',
  Enter: 'Enter',
};

/** The short legend printed on a key cap: the numpad keys drop their "Num" since the picture shows where they are. */
export function capLabel(code: string): string {
  return CAPS[code] ?? keyLabel(code).replace(/^Num /, '');
}
