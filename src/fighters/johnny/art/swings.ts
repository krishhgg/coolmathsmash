import type { SwingChecks } from '../../../render/rig/swingChecks';

/**
 * Johnny's allowances for the swing checks (`src/render/rig/swingChecks.ts`). His clips are sorted into ground and
 * air by the shared defaults in `src/fighters/swingChecks.ts`.
 */
export const swingChecks: SwingChecks = {
  ground: [],
  air: [],
  decals: [
    // Max Upgrade's aura: a glow round his middle that swells past his boots while he powers up.
    'upgradeAura',
    // Max Upgrade's boot jets (and the small ones): flames fired down from his soles into the floor as he lifts off
    // and as he lands.
    'bootJet',
    // The Upgraded Laser's burst in the cut scene: a ring the size of the hit round the trapped fighter, its lower
    // edge across the floor line.
    'laserBurst',
  ],
};
