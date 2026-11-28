import type { SwingChecks } from '../../../render/rig/swingChecks';

/**
 * Water she draws standing on the floor with its base line under the floor line, so no gap shows between the water
 * and the stage. The floor check leaves it out.
 */
export const FLOOR_WATER: Record<string, string> = {
  /** Tidal Wave's swell: the mound's base is drawn 0.3 under its origin on the floor. */
  fxSwell: 'the mound of water round her feet sits its base under the floor line',
};

/** Watergirl's allowances for the swing checks (`src/render/rig/swingChecks.ts`); her clips are sorted by default. */
export const swingChecks: SwingChecks = { ground: [], air: [], decals: Object.keys(FLOOR_WATER) };
