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
  });
});
