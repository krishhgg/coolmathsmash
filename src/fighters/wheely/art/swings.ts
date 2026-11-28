import type { SwingChecks } from '../../../render/rig/swingChecks';

/** Wheely's allowances for the swing checks (`src/render/rig/swingChecks.ts`). */
export const swingChecks: SwingChecks = {
  ground: [],
  air: [],
  decals: [
    // Smoke from the pipe 2 above the floor and dust thrown up at the tyres: puffs that cross the floor line.
    'fxPuff',
    // The Final Smash cut scene's last honk: sound waves bursting round the foe as they blow them away.
    'fxHonk',
  ],
  spins: [
    {
      bone: 'spinB',
      why: 'The back wheel rolls; index.test.ts checks every turn reads the right way round.',
    },
    {
      bone: 'spinF',
      why: 'The front wheel rolls; index.test.ts checks every turn reads the right way round.',
    },
    {
      bone: 'hood',
      why: 'The hood flips over on its spring and slams shut, up to 70 degrees a frame.',
      clips: ['usmash'],
    },
  ],
};
