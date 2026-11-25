import { GAMEPAD_BUTTONS, KEYBOARD_BINDINGS, type KeyboardBinding } from '../input/bindings';
import type { ButtonName } from '../input/types';
import { keyboardMenusUsable, padMenusUsable, resetKeyboard } from './controls';

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

/** localStorage, or null where there is none or the browser blocks it (reading the global itself can throw). */
function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Saved settings over the defaults; anything missing or malformed falls back to its default. A saved gamepad mapping
 * with Pause on A or on no button at all (possible before the controls screen refused those) loads as the defaults,
 * so a controller-only player is never stuck in or out of the pause menu. A keyboard half with a menu key on the
 * wrong action (Escape on Attack would pause on every attack) loads as its defaults the way Reset does, taking those
 * keys off the other half.
 */
export function loadSettings(storage: StorageLike | null = browserStorage()): Settings {
  const defaults = defaultSettings();
  let saved: Partial<Settings>;
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return defaults;
    saved = parsed;
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
  keyboard.forEach((binding, i) => {
    if (!keyboardMenusUsable(binding)) resetKeyboard(keyboard, i);
  });
  const gamepad = Object.fromEntries(
    Object.entries(defaults.gamepad).map(([name, indices]) => {
      const v = (saved.gamepad as Record<string, unknown> | undefined)?.[name];
      return [name, Array.isArray(v) && v.every((n) => Number.isInteger(n)) ? (v as number[]) : indices];
    }),
  ) as Settings['gamepad'];
  return {
    keyboard,
    gamepad: padMenusUsable(gamepad) ? gamepad : defaults.gamepad,
    tapJump: typeof saved.tapJump === 'boolean' ? saved.tapJump : defaults.tapJump,
  };
}

export function saveSettings(settings: Settings, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked: the settings still apply for this session.
  }
}
