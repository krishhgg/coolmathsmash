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

  it('loads a keyboard half with a menu key on the wrong action as its defaults', () => {
    const saved = (keyboard: unknown) =>
      loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify({ keyboard }) })).keyboard;
    const d = defaultSettings().keyboard;

    // Escape on Keyboard 1's Attack: in a match every attack would also pause. Keyboard 2 keeps its own keys but
    // gives up F, which goes back to Keyboard 1's Attack.
    const kb1 = structuredClone(d);
    kb1[0]!.buttons.attack = ['Escape'];
    kb1[0]!.buttons.start = [];
    kb1[1]!.buttons.special = ['KeyF', 'Numpad2'];
    kb1[1]!.buttons.jump = ['KeyM'];
    const loaded1 = saved(kb1);
    expect(loaded1[0]).toEqual(d[0]);
    expect(loaded1[1]!.buttons.special).toEqual(['Numpad2']);
    expect(loaded1[1]!.buttons.jump).toEqual(['KeyM']);

    // Escape on Keyboard 2's Attack resets Keyboard 2 only.
    const kb2 = structuredClone(d);
    kb2[0]!.buttons.start = ['KeyP'];
    kb2[1]!.buttons.attack = ['Escape', 'Numpad1'];
    const loaded2 = saved(kb2);
    expect(loaded2[1]).toEqual(d[1]);
    expect(loaded2[0]!.buttons.start).toEqual(['KeyP']);

    // The other menu keys follow the same rule: Space can only be Attack, Enter and Backspace only Pause.
    const space = structuredClone(d);
    space[0]!.buttons.jump = ['Space'];
    expect(saved(space)[0]).toEqual(d[0]);
    const enter = structuredClone(d);
    enter[1]!.down = ['Enter'];
    expect(saved(enter)[1]).toEqual(d[1]);

    // Menu keys on their own action load as saved.
    const fine = structuredClone(d);
    fine[0]!.buttons.attack = ['Space'];
    fine[0]!.buttons.start = ['Escape', 'Backspace'];
    expect(saved(fine)).toEqual(fine);
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
