import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt, PathShape } from '../../../render/rig/types';
import { STOMP, WAVE } from '../finalSmash';
import { LEDGE_GRIP, clips } from './clips';
import { palettes } from './palettes';
import { rig } from './rig';

/** Square viewBox around the head (beak and outline included), for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds([
    ...(rig.symbols.headLine as PathShape[]),
    ...(rig.symbols.face as PathShape[]),
  ]);
  const size = Math.max(x1 - x0, y1 - y0) + 0.6;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/** The Duck (Duck Life, Wix Games, 2010), drawn by hand in the game's Flash style. Plain data: no Pixi imports. */
export const art: FighterArt = {
  height: 11,
  rig,
  clips,
  palettes,
  costumeSwaps: { crown: { hat: 'crown' }, evil: { hat: 'crest', face: 'faceEvil' } },
  icon: symbolsToSvg(rig.symbols, ['headLine', 'head', 'face'], palettes.default, iconBox()),
  ledgeGrip: LEDGE_GRIP,
  projectiles: {
    /** Evolved Stomp's first stomp: the burst over the slam's area, drawn at world scale from his feet. */
    stomp: {
      symbols: rig.symbols,
      symbol: 'fxBurst',
      scale: 1,
      preview: {
        finalSmash: { frame: STOMP.frame, x: 0, y: 0 },
        finalSmashAir: { frame: STOMP.frame, x: 0, y: 0 },
      },
    },
    /** The second stomp's shockwave: a wall of dust as big as its hitboxes, along the floor. */
    wave: {
      symbols: rig.symbols,
      symbol: 'fxWave',
      scale: 1,
      preview: { finalSmash: { frame: WAVE.frame, x: 0, y: WAVE.radius, vx: WAVE.speed } },
    },
    /** The same shockwave stamped in the air, flying on at his height. */
    waveAir: {
      symbols: rig.symbols,
      symbol: 'fxWave',
      scale: 1,
      preview: { finalSmashAir: { frame: WAVE.frame, x: 0, y: WAVE.radius, vx: WAVE.speed } },
    },
  },
};
