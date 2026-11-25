import { describe, expect, it } from 'vitest';
import { SETTINGS_KEY, defaultSettings, loadSettings, saveSettings } from './settings';

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
};

describe('settings', () => {
  it('defaults without storage or saved data', () => {
    expect(loadSettings(null)).toEqual(defaultSettings());
    expect(loadSettings(memory())).toEqual(defaultSettings());
  });

  it('round-trips through storage', () => {
    const store = memory();
    const s = defaultSettings();
    s.keyboard[0]!.buttons.attack = ['KeyQ'];
    s.gamepad.jump = [3];
    s.tapJump = false;
    saveSettings(s, store);
    expect(loadSettings(store)).toEqual(s);
  });

  it('falls back field by field on malformed data', () => {
    const store = memory({
      [SETTINGS_KEY]: JSON.stringify({
        keyboard: [{ up: 'KeyW', buttons: { attack: ['KeyQ'], special: [7] } }],
        gamepad: { jump: ['x'] },
        tapJump: 'yes',
      }),
    });
    const s = loadSettings(store);
    const d = defaultSettings();
    expect(s.keyboard[0]!.up).toEqual(d.keyboard[0]!.up);
    expect(s.keyboard[0]!.buttons.attack).toEqual(['KeyQ']);
    expect(s.keyboard[0]!.buttons.special).toEqual(d.keyboard[0]!.buttons.special);
    expect(s.keyboard[1]).toEqual(d.keyboard[1]);
    expect(s.gamepad.jump).toEqual(d.gamepad.jump);
    expect(s.tapJump).toBe(true);
    expect(loadSettings(memory({ [SETTINGS_KEY]: '{not json' }))).toEqual(d);
    expect(loadSettings(memory({ [SETTINGS_KEY]: 'null' }))).toEqual(d);
    expect(loadSettings(memory({ [SETTINGS_KEY]: '7' }))).toEqual(d);
  });

  it('loads a saved gamepad mapping that strands the pause menu as the defaults', () => {
    const saved = (gamepad: Record<string, number[]>) =>
      loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify({ gamepad }) })).gamepad;
    const d = defaultSettings().gamepad;
    // Pause on A, as the controls screen allowed before: A took Attack's place, so Attack was left empty.
    expect(saved({ ...d, attack: [], start: [0] })).toEqual(d);
    // Start moved to Attack while it was Pause's only button.
    expect(saved({ ...d, attack: [9], start: [] })).toEqual(d);
    expect(saved({ ...d, jump: [2], start: [3] })).toEqual({ ...d, jump: [2], start: [3] });
  });

  it('survives storage that throws', () => {
    const blocked = {
      getItem: (): string | null => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    };
    expect(loadSettings(blocked)).toEqual(defaultSettings());
    expect(() => saveSettings(defaultSettings(), blocked)).not.toThrow();
  });
});
