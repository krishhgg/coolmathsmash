import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt, PathShape } from '../../../render/rig/types';
import { clips } from './clips';
import { palettes } from './palettes';
import { rig } from './rig';

/** Square viewBox around the front head, beanie and feather included, for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds([
    ...(rig.symbols.headFront as PathShape[]),
    ...(rig.symbols.hatFront as PathShape[]),
  ]);
  const size = Math.max(x1 - x0, y1 - y0) + 0.6;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/** Bob the Robber (Flazm and MeowBeast, 2011), drawn from scratch as fan art. Plain data: no Pixi imports. */
export const art: FighterArt = {
  height: 15.6,
  rig,
  clips,
  palettes,
  icon: symbolsToSvg(rig.symbols, ['headFront', 'faceFront', 'hatFront'], palettes.default, iconBox()),
  ledgeGrip: [4.75, -12.325],
  projectiles: {
    /** The stun gun's dart, trailing its crackling wire. */
    taserDart: { symbols: rig.symbols, symbol: 'dart', scale: 1 },
  },
};
