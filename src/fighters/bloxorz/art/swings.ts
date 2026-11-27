import type { SwingChecks } from '../../../render/rig/swingChecks';

/**
 * Effects drawn across the floor line on purpose, by symbol, each with why. The floor check leaves them out; the
 * block itself is still checked on every frame.
 */
export const FLOOR_FX: Record<string, string> = {
  dust: 'Dust puffs kick up where the block meets the floor, so their lower lobes cross the floor line.',
  slam: 'The dust cloud of a slam bursts out of the floor where the block lands.',
  skid: 'Sparks struck where the block grinds along the floor, centred on the contact line.',
  spark: "Sparks where the block's corner scrapes the floor, centred on the contact.",
  ring: 'A shock ring lying flat on the floor in perspective, like a shadow.',
};

/**
 * Clips that tip the block end over end, a quarter lap a tip. The simulation swaps the block's form at each tip's
 * balance point and the other form's clip draws the rest of that tip, so the frames either side of the swap in one
 * clip are never drawn one after the other. index.test.ts checks the turn frame by frame as the simulation plays it.
 */
export const TIPS = ['walk', 'run', 'dash', 'dashAttack', 'sideB'];

/** The block's allowances for the swing checks (`src/render/rig/swingChecks.ts`), in both forms. */
export const swingChecks: SwingChecks = {
  ground: [],
  air: [],
  decals: Object.keys(FLOOR_FX),
  spins: [
    {
      bone: 'block',
      why: 'Tips end over end, changing form at each balance point, where the other form draws the rest of the tip.',
      clips: TIPS,
    },
  ],
};
