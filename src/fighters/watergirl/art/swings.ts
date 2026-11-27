import type { SwingChecks } from '../../../render/rig/swingChecks';

/**
 * Water she draws standing on the floor, its base line under the floor line so no gap shows between the water and
 * the stage. The floor check leaves them out.
 */
export const FLOOR_WATER: Record<string, string> = {
  /** Tidal Wave's swell: the mound's base is drawn 0.3 under its origin on the floor. */
  fxSwell: 'the mound of water round her feet sits its base under the floor line',
  /** The wave forming in front of her: drawn as the wave prop is in a match, whose base rides 0.6 under the floor. */
  fxWave: 'the forming wave stands on the floor as the rolling wave prop does',
};

/** Watergirl's allowances for the swing checks (`src/render/rig/swingChecks.ts`); her clips are sorted by default. */
export const swingChecks: SwingChecks = { ground: [], air: [], decals: Object.keys(FLOOR_WATER) };
