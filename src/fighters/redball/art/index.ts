import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { attacks } from './attacks';
import { LEDGE_GRIP, clips } from './clips';
import { R } from './parts';
import { palettes } from './palettes';
import { rig } from './rig';

/**
 * Red Ball's art: a hand-drawn ball rig (no limbs: squash, stretch, roll and a tongue) with every canonical clip
 * and one clip per move. Plain data: no Pixi imports.
 */
export const art: FighterArt = {
  height: 11,
  rig,
  clips: { ...clips, ...attacks },
  palettes,
  /** The Evil Box wears the box body and its mottled shade, in any clip that does not swap the body itself. */
  costumeSwaps: {
    evil: { ballLine: 'cubeLine', ballFill: 'cubeFill', ballShade: 'evilShade', costumeMouth: 'evilGrin' },
  },
  icon: symbolsToSvg(
    rig.symbols,
    ['ballLine', 'ballFill', 'ballShade', 'eyesDetermined', 'browAngry', 'mouthSmirk', 'ballShine'],
    palettes.default,
    [-R - 0.3, -R - 0.3, 2 * R + 0.6, 2 * R + 0.6],
  ),
  ledgeGrip: LEDGE_GRIP,
};
