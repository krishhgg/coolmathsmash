import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { clips } from './clips';
import { head } from './parts';
import { palettes } from './palettes';
import { rig } from './rig';

/** Square viewBox around the head (quiff included), for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds(head);
  const size = Math.max(x1 - x0, y1 - y0) + 0.6;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/** Johnny Upgrade (Gameshot, 2012), drawn by hand in the game's Flash style. Plain data: no Pixi imports. */
export const art: FighterArt = {
  height: 17,
  rig,
  clips,
  palettes,
  icon: symbolsToSvg(rig.symbols, ['head', 'grit'], palettes.default, iconBox()),
};
