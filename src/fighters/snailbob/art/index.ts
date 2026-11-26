import type { FighterArt } from '../../../render/rig/types';
import { LEDGE_GRIP, clips } from './clips';
import { poseSvg } from './icon';
import { palettes } from './palettes';
import { rig } from './rig';

/**
 * Snail Bob (Snail Bob, Hunter Hamster, 2010), drawn from scratch as fan art in the games' Flash style. Plain
 * data: no Pixi imports.
 */
export const art: FighterArt = {
  height: 13,
  rig,
  clips,
  palettes,
  icon: poseSvg({ height: 13, rig, clips, palettes }, 'idle', 0, palettes.default),
  ledgeGrip: LEDGE_GRIP,
  /**
   * Crate Drop's crate, by entity name (entities.ts): the falling `crateFall` and the resting `crate` it turns into
   * on landing are one drawing, a 10-unit box filling the entity's body. The lab shows it landed: about 20 ahead,
   * resting on the floor from frame 30.
   */
  projectiles: {
    crateFall: { symbols: rig.symbols, symbol: 'crate', scale: 1 },
    crate: {
      symbols: rig.symbols,
      symbol: 'crate',
      scale: 1,
      preview: { neutralB: { frame: 30, x: 20, y: 5 } },
    },
  },
};
