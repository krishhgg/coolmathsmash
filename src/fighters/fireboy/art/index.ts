import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt, PathShape } from '../../../render/rig/types';
import { BLAST } from '../finalSmash';
import { LEDGE_GRIP, clips } from './clips';
import { palettes } from './palettes';
import { rig } from './rig';

/** Square viewBox around the front head, for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds(rig.symbols.headFront as PathShape[]);
  const size = Math.max(x1 - x0, y1 - y0) + 0.6;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/**
 * Fireboy's rig and clips, drawn for now as a plain hand-drawn mannequin (parts.ts) until his own drawing
 * replaces it under the same symbol names. Plain data: no Pixi imports.
 */
export const art: FighterArt = {
  height: 15,
  rig,
  clips,
  palettes,
  icon: symbolsToSvg(rig.symbols, ['headFront', 'faceFront'], palettes.default, iconBox()),
  ledgeGrip: LEDGE_GRIP,
  projectiles: {
    /** Radius-2.5 fireball (the ball is 3.6 units at scale 1), trailing flames behind it. */
    fireball: {
      symbols: rig.symbols,
      symbol: 'fxBall',
      scale: 0.7,
      align: true,
      preview: { neutralB: { frame: 14, x: 8.5, y: 4.6, vx: 1.4 } },
    },
    /** Fire Blast, the Final Smash's fire: drawn at world scale, as big as its radius-16 hitboxes. */
    blast: {
      symbols: rig.symbols,
      symbol: 'fxBlast',
      scale: 1,
      preview: {
        finalSmash: { frame: BLAST.frame, x: BLAST.x, y: BLAST.y, vx: BLAST.speed },
        finalSmashAir: { frame: BLAST.frame, x: BLAST.x, y: BLAST.y, vx: BLAST.speed },
      },
    },
  },
};
