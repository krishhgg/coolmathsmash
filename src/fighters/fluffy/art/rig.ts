import { shapesBounds } from '../../../render/rig/geometry';
import type { ArtSymbol, PathShape, Rig, SymbolLoop } from '../../../render/rig/types';
import {
  FACE,
  candy,
  dizzyPupils,
  dust,
  eyes,
  fur,
  lids,
  line,
  mouthEffort,
  mouthO,
  mouthSmile,
  pupils,
  reticle,
  santaHat,
  shut,
  sweat,
  thrustSmear,
  tip,
  wave,
  witchHat,
  type FurStyle,
} from './parts';

const range = (count: number) => Array.from({ length: count }, (_, i) => i);

/** `count` hand-drawn variants of the fur in one style, plus a movie clip that boils through them. */
function boil(name: string, count: number, fps: number, style: FurStyle): Record<string, ArtSymbol> {
  const loop: SymbolLoop = { loop: range(count).map((i) => `${name}${i}`), fps };
  return {
    ...Object.fromEntries(range(count).map((i) => [`${name}${i}`, fur({ ...style, variant: i })])),
    [name]: loop,
  };
}

/** The fur boils like a hand-redrawn Flash loop: three drawings at 8 fps. */
const furs = {
  ...boil('fur', 3, 8, {}),
  /** Even all round, for rolling. */
  ...boil('furRoll', 2, 8, { round: true, wind: [0, 0] }),
  /** Blown back by speed. */
  ...boil('furRun', 2, 12, { wind: [-0.8, 0.12] }),
  /** Blown up while falling. */
  ...boil('furFall', 2, 10, { wind: [-0.12, -0.62] }),
  /** Puffed up: a ready, angry ball. */
  ...boil('furPuff', 2, 12, { length: 1.35, sharp: 0.5, wind: [-0.05, 0] }),
  /** Every hair on end (his neutral air), vibrating. */
  ...boil('furBristle', 2, 20, { length: 1.95, sharp: 1, wind: [0, 0] }),
  /** Flattened and limp: crouching, dizzy, lying down. */
  ...boil('furFlat', 2, 6, { length: 0.62, wind: [-0.1, 0.35] }),
};

/**
 * Height of the ball's centre: the lowest tuft of the first resting drawing touches the floor (the boil's other
 * drawings land within a tenth of a unit of it).
 */
export const CENTRE = Math.round(shapesBounds(furs.fur0 as PathShape[])[3] * 1000) / 1000;

/**
 * Fluffy's skeleton (rest pose: sitting on the floor, facing right). `body` is the ball (squash and stretch,
 * tilt), `fur` spins and puffs the fur alone, `face` and `pupils` move the eyes over the ball, and the
 * grabber is `grab`, a line whose x scale is its length in units, with `tip` carried out to its end. `fx1`-`fx3`
 * place props and effects in rig space.
 */
export const rig: Rig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'body', parent: 'root', x: 0, y: -CENTRE },
    { name: 'fur', parent: 'body', x: 0, y: 0 },
    { name: 'face', parent: 'body', x: FACE[0], y: FACE[1] },
    { name: 'pupils', parent: 'face', x: 0, y: 0 },
    { name: 'grab', parent: 'root', x: 0, y: -CENTRE, localScale: true },
    { name: 'tip', parent: 'grab', x: 1, y: 0 },
    { name: 'fx1', parent: 'root', x: 0, y: 0 },
    { name: 'fx2', parent: 'root', x: 0, y: 0 },
    { name: 'fx3', parent: 'root', x: 0, y: 0 },
  ],
  slots: [
    { name: 'fxBack', bone: 'fx3', symbol: null, decor: true },
    { name: 'grabLine', bone: 'grab', symbol: null },
    { name: 'tip', bone: 'tip', symbol: null },
    { name: 'fur', bone: 'fur', symbol: 'fur' },
    { name: 'hat', bone: 'body', symbol: null, decor: true },
    { name: 'eyes', bone: 'face', symbol: 'eyes' },
    { name: 'pupils', bone: 'pupils', symbol: 'pupils' },
    { name: 'lids', bone: 'face', symbol: null },
    { name: 'mouth', bone: 'face', symbol: null },
    { name: 'prop', bone: 'fx1', symbol: null },
    { name: 'fx', bone: 'fx3', symbol: null, decor: true },
    { name: 'sweat', bone: 'face', symbol: null, decor: true },
  ],
  symbols: {
    ...furs,
    eyes: eyes(),
    pupils: pupils(),
    pupilsSmall: pupils([0, 0], 0.62),
    pupilsFocus: pupils([0.15, 0], 0.78),
    pupilsDizzy: dizzyPupils,
    lidsHalf: lids(0.45, 0.45),
    lidsAngry: lids(0.12, 0.55),
    lidsSad: lids(0.5, 0.15),
    blink: shut(false),
    squeeze: shut(true),
    mouthO,
    mouthEffort,
    mouthSmile,
    line,
    lineWave: wave(0.9),
    lineWaveBig: wave(1.6, 1.5),
    tip: tip(),
    tip0: tip(0),
    tip1: tip(0.5),
    tipSpin: { loop: ['tip0', 'tip1'], fps: 30 },
    ...Object.fromEntries(range(4).map((i) => [`candy${i}`, candy((i * Math.PI) / 2)])),
    candy: { loop: range(4).map((i) => `candy${i}`), fps: 24 },
    reticle,
    dust,
    santaHat,
    witchHat,
    sweat,
    thrustSmear,
  },
};
