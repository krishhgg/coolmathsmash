import { GAMEPAD_BUTTONS, KEYBOARD_BINDINGS, type KeyboardBinding } from '../input/bindings';
import type { ButtonName } from '../input/types';

/** Player-facing settings kept in localStorage: control bindings and options. */
export interface Settings {
  /** Keyboard 1 (left hand) and Keyboard 2 (right hand). */
  keyboard: KeyboardBinding[];
  /** Standard-mapping button indices per action, shared by every gamepad. */
  gamepad: Record<ButtonName, number[]>;
  /** Flicking up jumps (Smash's default). */
  tapJump: boolean;
}

export const SETTINGS_KEY = 'coolmathsmash.settings.v1';

export function defaultSettings(): Settings {
  return {
    keyboard: structuredClone(KEYBOARD_BINDINGS),
    gamepad: structuredClone(GAMEPAD_BUTTONS),
    tapJump: true,
  };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const browserStorage = (): StorageLike | null => (typeof localStorage === 'undefined' ? null : localStorage);

/** Saved settings over the defaults; anything missing or malformed falls back to its default. */
export function loadSettings(storage: StorageLike | null = browserStorage()): Settings {
  const defaults = defaultSettings();
  let saved: Partial<Settings> = {};
  try {
    saved = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>;
  } catch {
    return defaults;
  }
  const keyboard = defaults.keyboard.map((d, i) => {
    const s = saved.keyboard?.[i];
    if (!s) return d;
    const keys = (v: unknown, fallback: string[]) =>
      Array.isArray(v) && v.every((k) => typeof k === 'string') ? v : fallback;
    return {
      up: keys(s.up, d.up),
      down: keys(s.down, d.down),
      left: keys(s.left, d.left),
      right: keys(s.right, d.right),
      walk: keys(s.walk, d.walk),
      buttons: Object.fromEntries(
        Object.entries(d.buttons).map(([name, codes]) => [
          name,
          keys((s.buttons as Record<string, unknown> | undefined)?.[name], codes),
        ]),
      ),
    };
  });
  const gamepad = Object.fromEntries(
    Object.entries(defaults.gamepad).map(([name, indices]) => {
      const v = (saved.gamepad as Record<string, unknown> | undefined)?.[name];
      return [name, Array.isArray(v) && v.every((n) => Number.isInteger(n)) ? (v as number[]) : indices];
    }),
  ) as Settings['gamepad'];
  return {
    keyboard,
    gamepad,
    tapJump: typeof saved.tapJump === 'boolean' ? saved.tapJump : defaults.tapJump,
  };
}

export function saveSettings(settings: Settings, storage: StorageLike | null = browserStorage()): void {
  storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
