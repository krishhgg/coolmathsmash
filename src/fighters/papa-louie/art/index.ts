import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { moves } from '../moves';
import { clips } from './clips';
import { LEDGE_GRIP } from './movement';
import { head, moved, faces, stache, hat } from './parts';
import { palettes } from './palettes';
import { rig } from './rig';

const pepper = moves.neutralB!.spawn![0]!;

/** The head, face, moustache and toque in head space, for the HUD icon. */
const iconHead = [...head, ...faces.face!, ...moved(stache, 0.5, 0.55), ...moved(hat, -0.18, -1.69)];

/** Papa Louie (Papa Louie: When Pizzas Attack!, Flipline Studios, 2006), drawn in the Flash style. Plain data. */
export const art: FighterArt = {
  height: 15,
  rig: { ...rig, symbols: { ...rig.symbols, iconHead } },
  clips,
  palettes,
  costumeSwaps: { roy: { hat: 'cap', apron: 'royWaist' }, cori: { hat: 'captainHat' } },
  icon: symbolsToSvg({ iconHead }, ['iconHead'], palettes.default, [-3.9, -5.2, 7.2, 7]),
  projectiles: {
    /** The lab draws the Pepper Bomb over neutralB from the frame the move spawns it, where it spawns. */
    pepperBomb: {
      symbols: rig.symbols,
      symbol: 'pepperBomb',
      scale: 1,
      preview: { neutralB: { frame: pepper.frame, x: pepper.x, y: pepper.y, vx: pepper.vx, vy: pepper.vy } },
    },
  },
  ledgeGrip: LEDGE_GRIP,
};
