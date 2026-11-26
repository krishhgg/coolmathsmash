import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { ArtSymbol, FighterArt, PathShape } from '../../../render/rig/types';
import { art as fireboy } from '../../fireboy/art';
import { clips } from './clips';
import { palettes } from './palettes';
import { WAVE } from '../finalSmashData';
import { splashes, streams, swells, waves } from './parts';

const frames = (name: string, drawings: ArtSymbol[]) =>
  Object.fromEntries(drawings.map((d, i) => [`${name}${i}`, d]));
const loop = (name: string, fps: number) => ({ loop: [0, 1, 2].map((i) => `${name}${i}`), fps });

/** Fireboy's symbols with water drawn in place of fire: the loops (fxJet, fxBall, fxFlame) pick these up. */
const symbols: Record<string, ArtSymbol> = {
  ...fireboy.rig.symbols,
  ...frames('fxJet', streams),
  ...frames('fxBall', splashes),
  ...frames('fxWave', waves),
  /** Tidal Wave, the Final Smash's wave at world scale, its crest rolling on through three drawings. */
  fxWave: loop('fxWave', 12),
  ...frames('fxSwell', swells),
  /** The swell of water she raises round her feet while Tidal Wave powers up. */
  fxSwell: loop('fxSwell', 10),
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
export const art: FighterArt = {
  ...fireboy,
  rig: { ...fireboy.rig, symbols },
  clips,
  palettes,
  icon: symbolsToSvg(symbols, ['headFront', 'faceFront'], palettes.default, iconBox()),
  projectiles: {
    /** Tidal Wave, the Final Smash's wave: drawn at world scale, as big as its radius-16 hitboxes. */
    wave: {
      symbols,
      symbol: 'fxWave',
      scale: 1,
      preview: {
        finalSmash: { frame: WAVE.frame, x: WAVE.x, y: WAVE.y, vx: WAVE.speed },
        finalSmashAir: { frame: WAVE.frame, x: WAVE.x, y: WAVE.y, vx: WAVE.speed },
      },
    },
  },
};
