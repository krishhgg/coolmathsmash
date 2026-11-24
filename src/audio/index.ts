import { bankFiles, type SoundId } from './bank';
import { AudioEngine, type PlayOptions, type Voice } from './engine';
import { DEFAULT_SETTINGS, type AudioSettings, type Channel } from './settings';

export type { SoundId } from './bank';
export type { Voice, PlayOptions } from './engine';
export type { AudioSettings, Bus, Channel } from './settings';

/** Menu feedback sounds. */
export type UiSound = 'move' | 'select' | 'back' | 'error' | 'toggle' | 'start';

const UI: Record<UiSound, SoundId> = {
  move: 'menu-move',
  select: 'menu-select',
  back: 'menu-back',
  error: 'menu-error',
  toggle: 'menu-toggle',
  start: 'menu-start',
};

/**
 * The game's audio, one shared instance: `import { audio } from './audio'`. Every method is safe to call at any
 * time: before init, in unit tests, and in browsers without Web Audio it does nothing.
 */
export interface GameAudio {
  /**
   * Create the audio context, start loading every sound effect, and unlock playback on the first key, click
   * or touch on `target` (browsers keep audio muted until then). Call once at boot; later calls do nothing.
   */
  init(target?: EventTarget): void;
  /** A menu sound: cursor moved, confirmed, went back, refused, toggled an option, started the match. */
  ui(sound: UiSound): void;
  /** Any sound in the bank (src/audio/bank.ts). */
  play(id: SoundId, opts?: PlayOptions): Voice | null;
  /**
   * Crossfade to a music track: 'menu', a stage id, or null to fade the music out. Unknown ids keep the
   * current music. (Tracks arrive with the music PR; until then this is silent.)
   */
  music(track: string | null): void;
  /**
   * An announcer line ('three', 'two', 'one', 'go', 'game', 'winner-is', ...) or a fighter's name as
   * `fighter:<id>`. Ducks the music while it speaks. (Lines arrive with the announcer PR.)
   */
  announce(line: string): void;
  /** Current volume sliders (0..1) and mute; read them to draw an options screen. */
  readonly settings: Readonly<AudioSettings>;
  /** Set a slider (0..1): 'master', 'music', 'sfx' or 'voice'. Saved in localStorage. */
  setVolume(channel: Channel, value: number): void;
  setMuted(muted: boolean): void;
  /** The mixer once init has run; null before (and without Web Audio). */
  readonly engine: AudioEngine | null;
}

/** localStorage, or null where the browser blocks it (reading the getter itself can throw). */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function createGameAudio(): GameAudio {
  let engine: AudioEngine | null = null;
  let fallback: AudioSettings = { ...DEFAULT_SETTINGS };
  return {
    init(target = globalThis) {
      if (engine || typeof AudioContext === 'undefined') return;
      engine = new AudioEngine({
        context: new AudioContext({ latencyHint: 'interactive' }),
        store: storage(),
        dropWhileSuspended: true,
      });
      engine.unlock(target);
      void Promise.all(bankFiles().map((f) => engine!.file(f)));
    },
    ui(sound) {
      engine?.play(UI[sound]);
    },
    play(id, opts) {
      return engine?.play(id, opts) ?? null;
    },
    music() {},
    announce() {},
    get settings() {
      return engine?.settings ?? fallback;
    },
    setVolume(channel, value) {
      if (engine) engine.setVolume(channel, value);
      else fallback = { ...fallback, [channel]: Math.min(1, Math.max(0, value)) };
    },
    setMuted(muted) {
      if (engine) engine.setMuted(muted);
      else fallback = { ...fallback, muted };
    },
    get engine() {
      return engine;
    },
  };
}

export const audio: GameAudio = createGameAudio();
