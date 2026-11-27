import type { SwingChecks } from '../../../render/rig/swingChecks';

/** Clips where he spins in his shell faster than the turn check's 60 degrees a frame, by design. */
const SPINS = ['sideB', 'ledgeAttack'];

/**
 * Snail Bob's allowances for the swing checks (`src/render/rig/swingChecks.ts`). His clips are sorted into ground and
 * air by the shared defaults.
 */
export const swingChecks: SwingChecks = {
  ground: [],
  air: [],
  /** The Shell Plunge's and Shell Pound's shockwave: a flat ring lying on the floor in perspective. */
  decals: ['shockwave'],
  spins: [
    {
      bone: 'shell',
      why: 'Shell Spin revs up to 100 degrees a frame; the ledge attack spins at 68 to 79 a frame, one way round.',
      clips: SPINS,
    },
    { bone: 'spin', why: "The shell's spiral, turning with the shell.", clips: SPINS },
  ],
};
