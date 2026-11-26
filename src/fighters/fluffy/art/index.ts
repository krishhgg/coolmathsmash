import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { AnimClip, FighterArt, PathShape } from '../../../render/rig/types';
import { ATTACKS } from './attacks';
import { LOCOMOTION } from './clips';
import { FINAL_SMASH } from './finalSmash';
import { palettes } from './palettes';
import { FACE, eyes, pupils } from './parts';
import { rig } from './rig';
import { SPECIALS, TARGET } from './specials';
import { LEDGE_GRIP, STATES } from './states';

/** Where the line leaves him in the lab: TETHER.handHeight of his 11-unit height, as tetherOrigin puts it. */
const HAND = 6.6;

/** The ball with its eyes in body space, for the HUD icon (the face sits on the ball at FACE). */
const iconSymbols = { ...rig.symbols, iconEyes: eyes(FACE), iconPupils: pupils(FACE) };

/** Square viewBox around the resting ball, for the HUD icon. */
function iconBox(): [number, number, number, number] {
  const [x0, y0, x1, y1] = shapesBounds(rig.symbols.fur0 as PathShape[]);
  const size = Math.max(x1 - x0, y1 - y0) + 0.8;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

const clips: Record<string, AnimClip> = { ...LOCOMOTION, ...ATTACKS, ...STATES, ...SPECIALS, ...FINAL_SMASH };

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
  /**
   * IQ Ball's reticle for Point Grapple, drawn at the real aim in a match. The lab shows it on the clip's target
   * until frame 23, the latest the line anchors.
   */
  reticle: {
    symbols: rig.symbols,
    symbol: 'reticle',
    scale: 1,
    preview: { neutralB: { frame: 0, to: 23, x: TARGET[0], y: -TARGET[1] } },
  },
  /**
   * The grabber of Point Grapple and Quick Grapple, the rig's own line and tip drawings, drawn from his hand to the
   * line's real end in a match. The lab shows Point Grapple's flying at the clip's target from the shot on 12 and
   * holding there to 40, and Quick Grapple's flying 120 units straight up from the shot on 8 and holding there to
   * 28, through the reel pose.
   */
  tetherLine: {
    symbols: rig.symbols,
    line: 'line',
    tip: 'tip',
    moves: ['neutralB', 'upB'],
    preview: {
      neutralB: { frame: 12, to: 40, from: [0, HAND], end: [TARGET[0], -TARGET[1]], travel: 12 },
      upB: { frame: 8, to: 28, from: [0, HAND], end: [0, HAND + 120], travel: 10 },
    },
  },
};
