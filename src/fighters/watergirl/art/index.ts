import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { ArtSymbol, FighterArt, PathShape } from '../../../render/rig/types';
import { art as fireboy } from '../../fireboy/art';
import { clips } from './clips';
import { pumps } from './pumps';
import { palettes } from './palettes';
import { splashes, streams } from './parts';

const frames = (name: string, drawings: ArtSymbol[]) =>
  Object.fromEntries(drawings.map((d, i) => [`${name}${i}`, d]));

/** Fireboy's symbols with water drawn in place of fire: the loops (fxJet, fxBall, fxFlame) pick these up. */
const symbols: Record<string, ArtSymbol> = {
  ...fireboy.rig.symbols,
  ...frames('fxJet', streams),
  ...frames('fxBall', splashes),
};

/** Square viewBox around the front head, for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds(symbols.headFront as PathShape[]);
  const size = Math.max(x1 - x0, y1 - y0) + 0.6;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/**
 * Watergirl's art until her own drawing lands: Fireboy's placeholder mannequin rig and clips in cool ash wood,
 * with water in place of fire under the same symbol names, so every clip places it the same way. Plain data.
 */
const mannequin: FighterArt = {
  ...fireboy,
  rig: { ...fireboy.rig, symbols },
  clips,
  palettes,
  icon: symbolsToSvg(symbols, ['headFront', 'faceFront'], palettes.default, iconBox()),
  projectiles: {},
};

/** Her art in matches: the mannequin, with Water Stream's pumps (pumps.ts) among her props. */
export const art: FighterArt = { ...mannequin, projectiles: { ...mannequin.projectiles, ...pumps } };
