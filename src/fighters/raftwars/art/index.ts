import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt, PropArt } from '../../../render/rig/types';
import { aimedShotClips, aimedShotProp } from './aimedShot';
import { attacks, frameData } from './attacks';
import { LEDGE_GRIP, clips } from './clips';
import { hat, head } from './parts';
import { palettes } from './palettes';
import { rig } from './rig';

/** Square viewBox around the head and bucket hat, for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds([...head, ...hat]);
  const size = Math.max(x1 - x0, y1 - y0) + 0.6;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/**
 * The thrown things, for the lab's sheets of the moves that fire them (a match draws its own entities): each
 * tennis ball and the grenade where it spawns, moving at its launch speed. A ball is 1.4 units in radius.
 */
const SHOTS: Record<string, string> = {
  jabBall: 'jab',
  shot: 'ftilt',
  lob: 'utilt',
  skip: 'dtilt',
  ringBall: 'nair',
  airShot: 'fair',
  recoilShot: 'bair',
  upShot: 'uair',
  downShot: 'dair',
  grenade: 'sideB',
};
const projectiles: Record<string, PropArt> = Object.fromEntries(
  Object.entries(SHOTS).map(([entity, move]) => {
    const { frame, x, y, vx, vy } = frameData.SPAWNS[move]![0]!;
    const grenade = entity === 'grenade';
    return [
      entity,
      {
        symbols: rig.symbols,
        symbol: grenade ? 'grenade' : 'fxBall',
        scale: grenade ? 1.5 : 1.4,
        preview: { [move]: { frame, x, y, vx, vy } },
      },
    ];
  }),
);

/** The Raft Wars kids, two kids of our own design drawn by hand in a Flash cartoon style. Plain data. */
export const art: FighterArt = {
  height: 13,
  rig,
  clips: { ...clips, ...attacks, ...aimedShotClips },
  palettes,
  ledgeGrip: LEDGE_GRIP,
  projectiles: { ...projectiles, aimedShot: aimedShotProp },
  icon: symbolsToSvg(rig.symbols, ['head', 'face', 'hat'], palettes.default, iconBox()),
};
