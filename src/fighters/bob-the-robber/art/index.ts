import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt, PathShape } from '../../../render/rig/types';
import { clips, LEDGE_GRIP } from './clips';
import { palettes } from './palettes';
import { rig } from './rig';
import { MUZZLE, SHOTS, STUN_GUN } from '../entities';

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
  height: 15.7,
  rig,
  clips,
  palettes,
  costumeSwaps: {
    spy: { gear: 'goggles' },
    explorer: { gear: 'explorerHat', torso: 'explorerJacket' },
  },
  icon: symbolsToSvg(rig.symbols, ['headFront', 'faceFront', 'hatFront'], palettes.default, iconBox()),
  ledgeGrip: LEDGE_GRIP,
  projectiles: {
    /**
     * Stun Gun's shots: one crackling ball, drawn at each shot's radius. The lab shows the uncharged one over the
     * clips from the frame it fires (the full charge fires from the same clips).
     */
    stunShot: {
      symbols: rig.symbols,
      symbol: 'stunShot',
      scale: SHOTS.stunShot.radius,
      preview: {
        neutralB: { frame: STUN_GUN.shot, x: MUZZLE.x, y: MUZZLE.y, vx: SHOTS.stunShot.speed },
        neutralBAir: { frame: STUN_GUN.shot, x: MUZZLE.x, y: MUZZLE.y, vx: SHOTS.stunShot.speed },
      },
    },
    stunShotFull: { symbols: rig.symbols, symbol: 'stunShot', scale: SHOTS.stunShotFull.radius },
  },
};
