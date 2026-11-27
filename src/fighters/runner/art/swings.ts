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
  // Strafe Dash goes from pose to pose on step keys, Fox Illusion style: the afterimage trail draws the motion
  // between, so each step reads as a cut.
  cuts: [
    {
      clip: 'sideB',
      frame: 24,
      why: 'Strafe Dash bursts out of the coil, the afterimages trailing back to it',
    },
    { clip: 'sideB', frame: 29, why: 'Strafe Dash stops dead into the brake at the end of its trail' },
    {
      clip: 'sideBAir',
      frame: 24,
      why: 'Strafe Dash bursts out of the tuck in the air, the afterimages trailing back',
    },
    { clip: 'sideBAir', frame: 29, why: 'Strafe Dash pulls up at the end of its trail in the air' },
  ],
};
