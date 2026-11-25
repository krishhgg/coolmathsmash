import { announce, announceWinner, type AnnouncerLine } from './announcer';
import { bankFiles, type SoundId } from './bank';
import { AudioEngine, type PlayOptions, type Voice } from './engine';
import { MatchAudio } from './match';
import { MusicPlayer } from './music';
import { DEFAULT_SETTINGS, type AudioSettings, type Channel } from './settings';
import type { SimEvent } from '../sim/events';
import type { MatchState } from '../sim/match';

export type { AnnouncerLine } from './announcer';
export { ANNOUNCED_FIGHTERS, ANNOUNCER_LINES } from './bank';
export type { SoundId } from './bank';
export type { Voice, PlayOptions } from './engine';
export type { AudioSettings, Bus, Channel } from './settings';

/** Anything that reports sim events every frame, like `Game`. */
export interface EventSource {
  onEvents(listener: (events: readonly SimEvent[], state: MatchState) => void): () => void;
}

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
   * Give a match its sound: hits, shields, KOs, movement and the rest, from `game.onEvents`. Returns the
   * function that stops listening. New matches and replays on the same game start over cleanly.
   */
  match(game: EventSource): () => void;
  /**
   * Crossfade to a music track: 'menu', a stage id (each stage has its own track, see src/audio/music.ts), or
   * null to fade the music out. Unknown ids keep the current music. Safe before init and before the first
   * click: the music starts as soon as the browser unlocks audio.
   */
  music(track: string | null): void;
  /**
   * Say an announcer line, ducking the music while it speaks: a match call ('ready', 'three', 'two', 'one',
   * 'go', 'game', 'time', 'winner-is', 'title', ...: ANNOUNCER_LINES) or a fighter's name as `fighter:<id>`
   * (ANNOUNCED_FIGHTERS). A line the announcer does not have stays silent.
   */
  announce(line: AnnouncerLine): void;
  /** "The winner is..." then the fighter's name right as that line ends. Silent for an unknown fighter. */
  announceWinner(fighterId: string): void;
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
  let player: MusicPlayer | null = null;
  let music: string | null = null;
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
      player = new MusicPlayer(engine);
      player.play(music);
      void Promise.all(bankFiles().map((f) => engine!.file(f)));
    },
    ui(sound) {
      engine?.play(UI[sound]);
    },
    play(id, opts) {
      return engine?.play(id, opts) ?? null;
    },
    match(game) {
      let sounds: MatchAudio | null = null;
      const off = game.onEvents((events, state) => {
        if (!engine) return;
        sounds ??= new MatchAudio(engine);
        sounds.observe(events, state);
      });
      return () => {
        off();
        sounds?.reset();
      };
    },
    music(track) {
      music = track;
      player?.play(track);
    },
    announce(line) {
      if (engine) announce(engine, line);
    },
    announceWinner(fighterId) {
      if (engine) announceWinner(engine, fighterId);
    },
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
