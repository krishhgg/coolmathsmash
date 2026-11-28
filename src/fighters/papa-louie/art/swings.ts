import type { SwingChecks } from '../../../render/rig/swingChecks';

/**
 * Papa Louie's allowances for the swing checks (`src/render/rig/swingChecks.ts`); his clips are sorted into ground and
 * air by the shared defaults.
 */
export const swingChecks: SwingChecks = {
  ground: [],
  air: [],
  /**
   * Conveyor Oven's belt (`beltStill`, `beltStep0` to `beltStep2`): conveyor.ts draws its frame sunk into the floor,
   * with only the belt's top run above it.
   */
  decals: ['belt'],
  spins: [
    {
      bone: 'fx1',
      why: 'Peel Propeller (upB) spins the peel overhead as a rotor, drawn from side to side every two frames.',
      clips: ['upB'],
    },
    {
      bone: 'fx2',
      why: 'The up tilt spins the dough overhead inside a swoosh ring that turns with it.',
      clips: ['utilt'],
    },
  ],
};
