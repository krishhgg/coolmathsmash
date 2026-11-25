import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { AnimClip, FighterArt, PathShape } from '../../../render/rig/types';
import { ATTACKS } from './attacks';
import { LOCOMOTION } from './clips';
import { palettes } from './palettes';
import { FACE, eyes, pupils } from './parts';
import { rig } from './rig';
import { SPECIALS } from './specials';
import { LEDGE_GRIP, STATES } from './states';

/** The ball with its eyes in body space, for the HUD icon (the face sits on the ball at FACE). */
const iconSymbols = { ...rig.symbols, iconEyes: eyes(FACE), iconPupils: pupils(FACE) };

/** Square viewBox around the resting ball, for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds(rig.symbols.fur0 as PathShape[]);
  const size = Math.max(x1 - x0, y1 - y0) + 0.8;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/** Keep the lab and docs/art.md names alongside the engine's move and action names. */
const clips: Record<string, AnimClip> = {
  ...LOCOMOTION,
  ...ATTACKS,
  ...STATES,
  ...SPECIALS,
  jab1: ATTACKS.jab!,
  knockdown: STATES.down!,
  getUp: STATES.getupStand!,
  tech: STATES.techInPlace!,
  neutralSpecial: SPECIALS.neutralB!,
  sideSpecial: SPECIALS.sideB!,
  upSpecial: SPECIALS.upB!,
  downSpecial: SPECIALS.downB!,
};

/** Fluffy (IQ Ball, Coolmath 2011; Catch the Candy, FedoIT 2011), drawn by hand in their style. Plain data. */
export const art: FighterArt = {
  height: 11,
  rig,
  clips,
  palettes,
  costumeSwaps: { xmas: { hat: 'santaHat' }, halloween: { hat: 'witchHat' } },
  icon: symbolsToSvg(iconSymbols, ['fur0', 'iconEyes', 'iconPupils'], palettes.default, iconBox()),
  ledgeGrip: LEDGE_GRIP,
  projectiles: {
    /** Candy Frisbee's spinning candy (radius 2.2). */
    candy: { symbols: rig.symbols, symbol: 'candy', scale: 1 },
  },
};
