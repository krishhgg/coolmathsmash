import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEY, busGain, loadSettings, saveSettings, sliderGain } from './settings';
import { MemoryStore } from './testing';

describe('audio settings', () => {
  it('fall back to the defaults when nothing or garbage is stored', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    const store = new MemoryStore();
    store.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trip through storage, clamping each slider to 0..1 and ignoring bad fields', () => {
    const store = new MemoryStore();
    saveSettings(store, { ...DEFAULT_SETTINGS, music: 0.25, muted: true });
    expect(loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, music: 0.25, muted: true });
    store.setItem(SETTINGS_KEY, JSON.stringify({ sfx: 7, voice: -1, master: 'loud', muted: 'yes' }));
    expect(loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, sfx: 1, voice: 0 });
  });

  it('map sliders to gain on a squared curve, times master, silenced by mute', () => {
    expect(sliderGain(0)).toBe(0);
    expect(sliderGain(0.5)).toBe(0.25);
    expect(sliderGain(1)).toBe(1);
    const s = { master: 0.5, music: 1, sfx: 0.5, voice: 0, muted: false };
    expect(busGain(s, 'music')).toBe(0.25);
    expect(busGain(s, 'sfx')).toBe(0.0625);
    expect(busGain(s, 'voice')).toBe(0);
    expect(busGain({ ...s, muted: true }, 'music')).toBe(0);
  });
});
