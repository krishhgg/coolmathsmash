import type { Bus } from './settings';

/**
 * Every sound the game can play, by id. Files live under public/audio/ and are rendered by
 * scripts/audio/build-sfx.ts (peak-normalised to about -1 dBFS), so `gain` is the mix level.
 */
export interface SoundDef {
  /** Variants under public/audio/; each play picks one at random, never the same one twice in a row. */
  files: readonly string[];
  bus: Bus;
  /** Mix level in dB. */
  gain: number;
  /** Random pitch spread per play, in semitones either way. */
  vary?: number;
  /** Most voices of this sound at once; the oldest is cut beyond it (default 4). */
  max?: number;
  loop?: boolean;
}

const sfx = (name: string, ...variants: number[]) =>
  (variants.length ? variants : [1]).map((n) => `sfx/${name}-${n}.mp3`);

export const SOUNDS = {
  // Hits, by strength. The KO hit replaces the heavy one when the launch will KO.
  'hit-light': { files: sfx('hit-light', 1, 2, 3), bus: 'sfx', gain: -7, vary: 1 },
  'hit-medium': { files: sfx('hit-medium', 1, 2, 3), bus: 'sfx', gain: -5, vary: 0.8 },
  'hit-heavy': { files: sfx('hit-heavy', 1, 2, 3), bus: 'sfx', gain: -3, vary: 0.6 },
  'hit-ko': { files: sfx('hit-ko'), bus: 'sfx', gain: -1, vary: 0.3, max: 2 },
  // Layers on top of a hit for the hitbox's effect.
  'hit-fire': { files: sfx('hit-fire', 1, 2), bus: 'sfx', gain: -9, vary: 1 },
  'hit-electric': { files: sfx('hit-electric'), bus: 'sfx', gain: -12, vary: 1 },

  'shield-hit': { files: sfx('shield-hit', 1, 2), bus: 'sfx', gain: -8, vary: 1 },
  'shield-break': { files: sfx('shield-break'), bus: 'sfx', gain: -3, max: 2 },
  'shield-on': { files: sfx('shield-on'), bus: 'sfx', gain: -13, vary: 0.5 },
  dizzy: { files: sfx('dizzy'), bus: 'sfx', gain: -13, loop: true, max: 4 },

  launch: { files: sfx('launch', 1), bus: 'sfx', gain: -9, vary: 0.7 },
  'launch-strong': { files: sfx('launch', 2), bus: 'sfx', gain: -6, vary: 0.5 },
  'ko-blast': { files: sfx('ko-blast'), bus: 'sfx', gain: -2, vary: 0.4, max: 3 },
  respawn: { files: sfx('respawn'), bus: 'sfx', gain: -13, max: 4 },

  jump: { files: sfx('jump', 1, 2), bus: 'sfx', gain: -13, vary: 1.5 },
  'double-jump': { files: sfx('double-jump'), bus: 'sfx', gain: -12, vary: 1 },
  land: { files: sfx('land', 1, 2), bus: 'sfx', gain: -13, vary: 1.5 },
  'land-heavy': { files: sfx('land', 3), bus: 'sfx', gain: -10, vary: 1 },
  dash: { files: sfx('dash', 1, 2), bus: 'sfx', gain: -14, vary: 1.5 },
  skid: { files: sfx('skid'), bus: 'sfx', gain: -16, vary: 1 },
  step: { files: sfx('step', 1, 2, 3), bus: 'sfx', gain: -20, vary: 2, max: 8 },
  'ledge-grab': { files: sfx('ledge-grab'), bus: 'sfx', gain: -10, vary: 1 },
  dodge: { files: sfx('dodge'), bus: 'sfx', gain: -13, vary: 1 },
  roll: { files: sfx('roll'), bus: 'sfx', gain: -13, vary: 1 },
  'smash-charge': { files: sfx('smash-charge'), bus: 'sfx', gain: -14 },
  'swing-light': { files: sfx('swing', 1), bus: 'sfx', gain: -15, vary: 1.5 },
  'swing-medium': { files: sfx('swing', 2), bus: 'sfx', gain: -15, vary: 1.2 },
  'swing-heavy': { files: sfx('swing', 3), bus: 'sfx', gain: -13, vary: 1 },

  'menu-move': { files: sfx('menu-move'), bus: 'sfx', gain: -12 },
  'menu-select': { files: sfx('menu-select'), bus: 'sfx', gain: -8 },
  'menu-back': { files: sfx('menu-back'), bus: 'sfx', gain: -10 },
  'menu-error': { files: sfx('menu-error'), bus: 'sfx', gain: -10 },
  'menu-toggle': { files: sfx('menu-toggle'), bus: 'sfx', gain: -9 },
  'menu-start': { files: sfx('menu-start'), bus: 'sfx', gain: -5.5, max: 1 },
} satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUNDS;

export const soundDef = (id: SoundId): SoundDef => SOUNDS[id];

/** Every file the bank references, once. */
export const bankFiles = (): string[] => [
  ...new Set(Object.values(SOUNDS).flatMap((d: SoundDef) => d.files)),
];
