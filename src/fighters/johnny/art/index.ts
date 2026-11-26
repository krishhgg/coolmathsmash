import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { LASER, MUZZLE } from '../entities';
import { clips } from './clips';
import { LEDGE_GRIP } from './ledge';
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
  height: 17.5,
  rig,
  clips,
  palettes,
  ledgeGrip: LEDGE_GRIP,
  icon: symbolsToSvg(rig.symbols, ['head', 'grit'], palettes.default, iconBox()),
  projectiles: {
    /**
     * Laser Gun's bolt: its head on the hit's centre, 6 units of streak behind it. The lab draws it from the frame
     * after the shot (the muzzle flash covers the shot's own frame), one frame of travel past where it appears.
     */
    laser: {
      symbols: rig.symbols,
      symbol: 'laserBolt',
      scale: 1,
      preview: {
        neutralB: { frame: 9, x: MUZZLE.x + LASER.speed, y: MUZZLE.y, vx: LASER.speed },
        neutralBAir: { frame: 8, x: MUZZLE.x + LASER.speed, y: MUZZLE.airY, vx: LASER.speed },
      },
    },
    /**
     * Upgraded Laser's bolt: the laser's bolt at Limit Blade Beam's size over Blade Beam's (radius 5.5 against 3.0),
     * from the frame after the shot. Its burst has no drawing yet; matches draw every entity as a placeholder.
     */
    megaLaser: {
      symbols: rig.symbols,
      symbol: 'laserBolt',
      scale: 5.5 / 3,
      preview: {
        neutralBUpgraded: { frame: 7, x: MUZZLE.x + LASER.speed, y: MUZZLE.y, vx: LASER.speed },
        neutralBUpgradedAir: { frame: 6, x: MUZZLE.x + LASER.speed, y: MUZZLE.airY, vx: LASER.speed },
      },
    },
  },
};
