import type { SwingChecks } from '../../../render/rig/swingChecks';

/**
 * The Runner's allowances for the swing checks (`src/render/rig/swingChecks.ts`). Her clips are sorted into ground
 * and air by the shared defaults in `src/fighters/swingChecks.ts`.
 */
export const swingChecks: SwingChecks = {
  ground: [],
  air: [],
  decals: [
    // A floor tile, part of the floor itself: Tile Flip and Tunnel Flip lift it out of the floor and lay it back.
    'tile',
    // The flash where her feet or Box Drop's crate meet the floor, drawn on the floor line.
    'contact',
    // Tunnel Flip's tunnel, drawn under the stage on purpose (the `fxUnder` slot draws under every fighter).
    'tunnel',
  ],
};
