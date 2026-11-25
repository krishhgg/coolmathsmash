import type { FighterArt } from '../../../render/rig/types';
import { LEDGE_GRIP, clips } from './clips';
import { poseSvg } from './icon';
import { palettes } from './palettes';
import { rig } from './rig';

/**
 * Snail Bob (Snail Bob, Hunter Hamster, 2010), drawn from scratch as fan art in the games' Flash style. Plain
 * data: no Pixi imports.
 */
export const art: FighterArt = {
  height: 13,
  rig,
  clips,
  palettes,
  icon: poseSvg({ height: 13, rig, clips, palettes }, 'idle', 0, palettes.default),
  ledgeGrip: LEDGE_GRIP,
};
