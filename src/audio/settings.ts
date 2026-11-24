/** Volume settings: one slider per bus plus master, persisted in localStorage. */

export const BUSES = ['music', 'sfx', 'voice'] as const;
export type Bus = (typeof BUSES)[number];
export type Channel = Bus | 'master';

export interface AudioSettings {
  /** Slider positions, 0..1. */
  master: number;
  music: number;
  sfx: number;
  voice: number;
  muted: boolean;
}

export const DEFAULT_SETTINGS: Readonly<AudioSettings> = {
  master: 0.8,
  music: 0.7,
  sfx: 0.9,
  voice: 1,
  muted: false,
};

export const SETTINGS_KEY = 'coolmathsmash.audio';

export type SettingsStore = Pick<Storage, 'getItem' | 'setItem'>;

const unit = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

/** Saved settings merged over the defaults; anything missing or malformed falls back to its default. */
export function loadSettings(store: SettingsStore | null | undefined): AudioSettings {
  const s = { ...DEFAULT_SETTINGS };
  try {
    const saved = JSON.parse(store?.getItem(SETTINGS_KEY) ?? 'null') as Partial<AudioSettings> | null;
    if (saved && typeof saved === 'object') {
      for (const c of ['master', ...BUSES] as const) s[c] = unit(saved[c], s[c]);
      if (typeof saved.muted === 'boolean') s.muted = saved.muted;
    }
  } catch {
    // Unreadable storage (private mode, bad JSON): keep the defaults.
  }
  return s;
}

export function saveSettings(store: SettingsStore | null | undefined, s: AudioSettings): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: the settings still apply for this session.
  }
}

/**
 * Slider position to linear gain. A squared curve tracks loudness far better than a linear one: half way is
 * about -12 dB, a tenth is -40 dB, and 0 is silence.
 */
export const sliderGain = (v: number) => Math.min(1, Math.max(0, v)) ** 2;

/** The gain a bus actually gets: its slider times master, or 0 when muted. */
export function busGain(s: AudioSettings, bus: Bus): number {
  return s.muted ? 0 : sliderGain(s.master) * sliderGain(s[bus]);
}
