import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { LEDGE_GRIP, clips } from './clips';
import { head } from './parts';
import { palettes } from './palettes';
import { rig } from './rig';

/** Square viewBox around the head, for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds(head);
  const size = Math.max(x1 - x0, y1 - y0) + 0.6;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/** The Raft Wars kids, two kids of our own design drawn by hand in a Flash cartoon style. Plain data. */
export const art: FighterArt = {
  height: 13,
  rig,
  clips,
  palettes,
  ledgeGrip: LEDGE_GRIP,
  icon: symbolsToSvg(rig.symbols, ['head', 'face', 'hat'], palettes.default, iconBox()),
};
