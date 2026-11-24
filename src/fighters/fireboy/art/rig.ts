import type { ArtSymbol, PathShape, Rig, Slot } from '../../../render/rig/types';
import {
  eyesFront,
  eyesSide,
  eyesUp,
  headFront,
  headSide,
  headUp,
  mouthFront,
  mouthSide,
  mouthUp,
} from './flash';
import {
  FORE_ARM,
  SHIN,
  THIGH,
  UPPER_ARM,
  blinkFront,
  blinkSide,
  fist,
  foreArm,
  jets,
  lidsFront,
  lidsSide,
  ouchFront,
  ouchSide,
  shin,
  shoutFront,
  shoutSide,
  squintFront,
  squintSide,
  thigh,
  torso,
  upperArm,
} from './parts';

/** Outline slots for both segments of a limb, then their fills, so joints have no seam. */
function limbSlots(upper: string, lower: string, upperSym: string, lowerSym: string): Slot[] {
  return [
    { name: `${upper}Line`, bone: upper, symbol: `${upperSym}Line` },
    { name: `${lower}Line`, bone: lower, symbol: `${lowerSym}Line` },
    { name: upper, bone: upper, symbol: upperSym },
    { name: lower, bone: lower, symbol: lowerSym },
  ];
}

function limbSymbols(
  parts: Record<string, { line: PathShape[]; fill: PathShape[] }>,
): Record<string, PathShape[]> {
  return Object.fromEntries(
    Object.entries(parts).flatMap(([name, part]) => [
      [name, part.fill],
      [`${name}Line`, part.line],
    ]),
  );
}

/** Original Flash frame rate: the head flicker cycles 5 drawings at 25 fps. */
const FLICKER_FPS = 25;

const frames = (name: string, drawings: ArtSymbol[]) =>
  Object.fromEntries(drawings.map((d, i) => [`${name}${i}`, d]));
const loop = (name: string, count: number, fps: number, order = [0, 1, 2, 3, 4]) => ({
  loop: order.slice(0, count).map((i) => `${name}${i}`),
  fps,
});

export const HIP_Y = -(THIGH + SHIN);
/** Head centre above the chin: the head symbols are drawn around the head centre. */
export const HEAD_R = 3.41;
/** The original head drawn 6% larger, so it fills about 78% of Fireboy's height as in the 2009 sprite. */
const HEAD_SCALE = 1.06;

/**
 * Fireboy's skeleton (rest pose: standing, facing right). `body` is the centre of mass, so rotating it flips
 * the whole fighter; `fx1`-`fx4` are free effect bones placed in rig space by the attack clips.
 */
export const rig: Rig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'body', parent: 'root', x: 0, y: -6 },
    { name: 'hip', parent: 'body', x: 0, y: 6 + HIP_Y },
    { name: 'torso', parent: 'hip', x: 0, y: 0 },
    { name: 'neck', parent: 'torso', x: 0, y: -1.3 },
    { name: 'head', parent: 'neck', x: 0, y: -HEAD_R * HEAD_SCALE, sx: HEAD_SCALE, sy: HEAD_SCALE },
    { name: 'face', parent: 'head', x: 0, y: 0 },
    { name: 'armB', parent: 'torso', x: -0.6, y: -1.1, rot: 30, localScale: true },
    { name: 'foreB', parent: 'armB', x: 0, y: UPPER_ARM, localScale: true },
    { name: 'armF', parent: 'torso', x: 0.6, y: -1.1, rot: -30, localScale: true },
    { name: 'foreF', parent: 'armF', x: 0, y: UPPER_ARM, localScale: true },
    { name: 'thighB', parent: 'hip', x: -0.36, y: 0, localScale: true },
    { name: 'shinB', parent: 'thighB', x: 0, y: THIGH, localScale: true },
    { name: 'thighF', parent: 'hip', x: 0.36, y: 0, localScale: true },
    { name: 'shinF', parent: 'thighF', x: 0, y: THIGH, localScale: true },
    { name: 'fx1', parent: 'root', x: 0, y: 0 },
    { name: 'fx2', parent: 'root', x: 0, y: 0 },
    { name: 'fx3', parent: 'root', x: 0, y: 0 },
    { name: 'fx4', parent: 'root', x: 0, y: 0 },
  ],
  slots: [
    { name: 'fxBack', bone: 'fx4', symbol: null },
    ...limbSlots('armB', 'foreB', 'upperArm', 'foreArm'),
    { name: 'torsoLine', bone: 'torso', symbol: 'torsoLine' },
    ...limbSlots('thighB', 'shinB', 'thigh', 'shin'),
    ...limbSlots('thighF', 'shinF', 'thigh', 'shin'),
    { name: 'torso', bone: 'torso', symbol: 'torso' },
    ...limbSlots('armF', 'foreF', 'upperArm', 'foreArm'),
    { name: 'head', bone: 'head', symbol: 'headFront' },
    { name: 'face', bone: 'face', symbol: 'faceFront' },
    { name: 'fx1', bone: 'fx1', symbol: null },
    { name: 'fx2', bone: 'fx2', symbol: null },
    { name: 'fx3', bone: 'fx3', symbol: null },
  ],
  symbols: {
    ...frames('headFront', headFront),
    ...frames('headSide', headSide),
    ...frames('headUp', headUp),
    headFront: loop('headFront', 5, FLICKER_FPS),
    headSide: loop('headSide', 5, FLICKER_FPS),
    headUp: loop('headUp', 5, FLICKER_FPS),
    faceFront: [...eyesFront, ...mouthFront],
    faceFrontBlink: [...blinkFront, ...mouthFront],
    faceFrontAngry: [...eyesFront, ...lidsFront, ...mouthFront],
    faceFrontShout: [...eyesFront, ...lidsFront, ...shoutFront],
    faceFrontHurt: [...squintFront, ...ouchFront],
    faceSide: [...eyesSide, ...mouthSide],
    faceSideBlink: [...blinkSide, ...mouthSide],
    faceSideAngry: [...eyesSide, ...lidsSide, ...mouthSide],
    faceSideShout: [...eyesSide, ...lidsSide, ...shoutSide],
    faceSideHurt: [...squintSide, ...ouchSide],
    faceUp: [...eyesUp, ...mouthUp],
    ...limbSymbols({ upperArm, foreArm, fist, thigh, shin, torso }),
    /** A fireball: the side head's ball and trailing flames (trail towards -x), flickering faster. */
    fxBall: loop('headSide', 5, 30, [2, 0, 3, 1, 4]),
    /** A flame tongue: the front head's three tips pointing up from the ball. */
    fxFlame: loop('headFront', 5, 30, [3, 1, 4, 0, 2]),
    ...frames('fxJet', jets),
    /** A strike flame: a yellow-cored teardrop with swept tongues, flickering through three drawings. */
    fxJet: loop('fxJet', 3, 20, [0, 1, 2]),
  },
};

/** Lengths the IK helpers need: hand and foot points are this far down their lower bone. */
export const HAND = FORE_ARM;
export const FOOT = SHIN;
