import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { clips } from './clips';
import { head, moved, faces, stache, hat } from './parts';
import { palettes } from './palettes';
import { rig } from './rig';

/** The head, face, moustache and toque in head space, for the HUD icon. */
const iconHead = [...head, ...faces.face!, ...moved(stache, 0.5, 0.55), ...moved(hat, -0.4, -1.98)];

/** Papa Louie (Papa Louie: When Pizzas Attack!, Flipline Studios, 2006), drawn in the Flash style. Plain data. */
export const art: FighterArt = {
  height: 15,
  rig: { ...rig, symbols: { ...rig.symbols, iconHead } },
  clips,
  palettes,
  icon: symbolsToSvg({ iconHead }, ['iconHead'], palettes.default, [-2.3, -5.4, 5.6, 7.4]),
  projectiles: {
    pepperBomb: { symbols: rig.symbols, symbol: 'pepperBomb', scale: 1 },
    shaker: { symbols: rig.symbols, symbol: 'shaker', scale: 1 },
    cheeseCloud: { symbols: rig.symbols, symbol: 'cheeseCloud', scale: 1 },
  },
};
