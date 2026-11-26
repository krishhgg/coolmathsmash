import type { PathShape, Rig, Slot } from '../../../render/rig/types';
import {
  FORE_ARM,
  SHIN,
  THIGH,
  UPPER_ARM,
  baton,
  explorerHat,
  explorerJacket,
  faces,
  fist,
  foreArm,
  goggles,
  handOpen,
  hat3q,
  hatFront,
  head3q,
  headFront,
  hook,
  ledgeGripHand,
  point,
  rope,
  sack,
  shin,
  shoe,
  shoeFront,
  smears,
  spark,
  stars,
  thigh,
  torso,
  twirl,
  upperArm,
} from './parts';

/** Outline slots for both segments of a limb, then their fills, so the elbow or knee has no seam. */
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

/** Rig y of the hips and of the centre of the face at rest. */
export const HIP_Y = -2.85;
export const HEAD_Y = -9.5;
/** The head is drawn a size up from the body, for the big-headed look of the games. */
const HEAD_SCALE = 1.16;

/**
 * Bob's skeleton, standing and facing right. `body` sits at his middle so rotating it turns the whole fighter;
 * the baton and stun gun ride in the front fist, the swung sack in the back fist, the carried sack on his back.
 * `fx1`-`fx4` and `fxS` are free effect bones that clips place in rig space.
 */
export const rig: Rig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'body', parent: 'root', x: 0, y: -5.5 },
    { name: 'hip', parent: 'body', x: 0, y: 5.5 + HIP_Y },
    { name: 'torso', parent: 'hip', x: 0, y: 0 },
    { name: 'neck', parent: 'torso', x: 0, y: -3.6 },
    { name: 'head', parent: 'neck', x: 0, y: HEAD_Y - HIP_Y + 3.6, sx: HEAD_SCALE, sy: HEAD_SCALE },
    { name: 'face', parent: 'head', x: 0, y: 0 },
    { name: 'hat', parent: 'head', x: 0, y: 0 },
    { name: 'sackC', parent: 'torso', x: -1.4, y: -3.2, rot: 60 },
    { name: 'armB', parent: 'torso', x: -2.0, y: -2.95, rot: 16, localScale: true },
    { name: 'foreB', parent: 'armB', x: 0, y: UPPER_ARM, localScale: true },
    { name: 'handB', parent: 'foreB', x: 0, y: FORE_ARM },
    { name: 'sackH', parent: 'handB', x: 0, y: 0.55 },
    { name: 'armF', parent: 'torso', x: 2.0, y: -2.95, rot: -16, localScale: true },
    { name: 'foreF', parent: 'armF', x: 0, y: UPPER_ARM, localScale: true },
    { name: 'handF', parent: 'foreF', x: 0, y: FORE_ARM },
    { name: 'baton', parent: 'handF', x: 0, y: 0.55 },
    { name: 'gun', parent: 'handF', x: 0, y: 0.5 },
    { name: 'thighB', parent: 'hip', x: -1.0, y: 0, localScale: true },
    { name: 'shinB', parent: 'thighB', x: 0, y: THIGH, localScale: true },
    { name: 'footB', parent: 'shinB', x: 0, y: SHIN },
    { name: 'thighF', parent: 'hip', x: 1.0, y: 0, localScale: true },
    { name: 'shinF', parent: 'thighF', x: 0, y: THIGH, localScale: true },
    { name: 'footF', parent: 'shinF', x: 0, y: SHIN },
    { name: 'fx1', parent: 'root', x: 0, y: 0 },
    { name: 'fx2', parent: 'root', x: 0, y: 0 },
    { name: 'fx3', parent: 'root', x: 0, y: 0 },
    { name: 'fx4', parent: 'root', x: 0, y: 0 },
    { name: 'fxS', parent: 'root', x: 0, y: 0 },
  ],
  slots: [
    { name: 'fxBack', bone: 'fx4', symbol: null },
    { name: 'smear', bone: 'fxS', symbol: null },
    { name: 'sackBack', bone: 'sackC', symbol: null },
    ...limbSlots('armB', 'foreB', 'upperArm', 'foreArm'),
    { name: 'handB', bone: 'handB', symbol: 'handOpen' },
    { name: 'sack', bone: 'sackH', symbol: null },
    ...limbSlots('thighB', 'shinB', 'thigh', 'shin'),
    { name: 'footB', bone: 'footB', symbol: 'shoe' },
    ...limbSlots('thighF', 'shinF', 'thigh', 'shin'),
    { name: 'footF', bone: 'footF', symbol: 'shoe' },
    { name: 'torso', bone: 'torso', symbol: 'torso' },
    ...limbSlots('armF', 'foreF', 'upperArm', 'foreArm'),
    { name: 'baton', bone: 'baton', symbol: null },
    { name: 'gun', bone: 'gun', symbol: null },
    { name: 'handF', bone: 'handF', symbol: 'handOpen' },
    { name: 'head', bone: 'head', symbol: 'head3q' },
    { name: 'face', bone: 'face', symbol: 'face3q' },
    { name: 'hat', bone: 'hat', symbol: 'hat3q' },
    { name: 'gear', bone: 'hat', symbol: null },
    { name: 'fx1', bone: 'fx1', symbol: null },
    { name: 'fx2', bone: 'fx2', symbol: null },
    { name: 'fx3', bone: 'fx3', symbol: null },
  ],
  symbols: {
    headFront,
    head3q,
    hatFront,
    hat3q,
    goggles,
    explorerHat,
    explorerJacket,
    ...faces,
    torso,
    ...limbSymbols({ upperArm, foreArm, thigh, shin }),
    handOpen,
    ledgeGripHand,
    fist,
    point,
    shoe,
    shoeFront,
    sack,
    spark,
    baton,
    hook,
    rope,
    stars,
    ...smears,
    twirl,
  },
};

/** Lengths the IK helpers need: the wrist and the ankle sit this far down their lower bone. */
export const HAND = FORE_ARM;
export const FOOT = SHIN;
