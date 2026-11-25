import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt, PathShape } from '../../../render/rig/types';
import { attacks } from './attacks';
import { boxDropClips } from './box-drop';
import { LEDGE_GRIP, clips } from './clips';
import { costumeSwaps, palettes } from './palettes';
import { rig } from './rig';

/** Square viewBox around the body and its antennae, for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds(rig.symbols.body as PathShape[]);
  const size = Math.max(x1 - x0, y1 - y0) + 0.8;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/** The Runner (Run, Run 2 and Run 3, Joseph Cloutier, 2008-2014), drawn from scratch. Plain data: no Pixi. */
export const art: FighterArt = {
  height: 13,
  rig,
  clips: { ...clips, ...attacks, ...boxDropClips },
  palettes,
  costumeSwaps,
  ledgeGrip: LEDGE_GRIP,
  icon: symbolsToSvg(rig.symbols, ['body', 'faceFront'], palettes.default, iconBox()),
};
