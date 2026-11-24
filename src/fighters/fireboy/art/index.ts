import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt, PathShape } from '../../../render/rig/types';
import { LEDGE_GRIP, clips } from './clips';
import { palettes } from './palettes';
import { rig } from './rig';

/** Square viewBox around the front head (flames included), for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds(rig.symbols.headFront0 as PathShape[]);
  const size = Math.max(x1 - x0, y1 - y0) + 0.6;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/** Fireboy (Fireboy & Watergirl in the Forest Temple, Oslo Albet, 2009). Plain data: no Pixi imports. */
export const art: FighterArt = {
  height: 15,
  rig,
  clips,
  palettes,
  icon: symbolsToSvg(rig.symbols, ['headFront0', 'faceFront'], palettes.default, iconBox()),
  ledgeGrip: LEDGE_GRIP,
  projectiles: {
    /** Radius-2.5 fireball (the ball is 3.6 units at scale 1), trailing flames behind it. */
    fireball: { symbols: rig.symbols, symbol: 'fxBall', scale: 0.7 },
  },
};
