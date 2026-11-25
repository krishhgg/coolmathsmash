import type { PathShape, Rig, Slot } from '../../../render/rig/types';
import {
  FORE_ARM,
  SHIN,
  THIGH,
  UPPER_ARM,
  apron,
  boxes,
  cheeseCloud,
  dough,
  faces,
  fist,
  foreArm,
  handOpen,
  hat,
  hatChute,
  head,
  neckSkin,
  oven,
  paddle,
  pepperBomb,
  pepperDust,
  scarf,
  shaker,
  shin,
  shoe,
  stache,
  stacheGrit,
  stacheShout,
  swoosh,
  thigh,
  torso,
  upperArm,
} from './parts';

/** Outline slots for both segments of a limb, then their fills, so the joint has no seam. */
function limbSlots(upper: string, lower: string, upperSym: string, lowerSym: string): Slot[] {
  return [
    { name: `${upper}Line`, bone: upper, symbol: `${upperSym}Line` },
    { name: `${lower}Line`, bone: lower, symbol: `${lowerSym}Line` },
    { name: upper, bone: upper, symbol: upperSym },
    { name: lower, bone: lower, symbol: lowerSym },
  ];
}

const limbSymbols = (
  parts: Record<string, { line: PathShape[]; fill: PathShape[] }>,
): Record<string, PathShape[]> =>
  Object.fromEntries(
    Object.entries(parts).flatMap(([name, part]) => [
      [name, part.fill],
      [`${name}Line`, part.line],
    ]),
  );

/** Hip height: the trousers are short, so his coat sits low and round. */
export const HIP_Y = -(THIGH + SHIN + 1);

/**
 * Papa Louie's skeleton (rest pose: standing, facing right). `body` is the centre of mass; the paddle hangs
 * from the front hand and `prop` (pepper bomb, shaker, dough) sits in the back hand. `fx1`-`fx3` are free effect
 * bones placed in rig space by the clips.
 */
export const rig: Rig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'body', parent: 'root', x: 0, y: -5 },
    { name: 'hip', parent: 'body', x: 0, y: 5 + HIP_Y },
    { name: 'torso', parent: 'hip', x: 0, y: 0 },
    { name: 'neck', parent: 'torso', x: 0.15, y: -4.7 },
    { name: 'head', parent: 'neck', x: 0.05, y: -2.55 },
    { name: 'face', parent: 'head', x: 0, y: 0 },
    { name: 'stache', parent: 'head', x: 0.5, y: 0.55 },
    { name: 'hat', parent: 'head', x: -0.4, y: -1.98, rot: -14 },
    { name: 'armB', parent: 'torso', x: -1.05, y: -4.1, rot: 12, localScale: true },
    { name: 'foreB', parent: 'armB', x: 0, y: UPPER_ARM, localScale: true },
    { name: 'handB', parent: 'foreB', x: 0, y: FORE_ARM },
    { name: 'prop', parent: 'handB', x: 0, y: 0.6 },
    { name: 'armF', parent: 'torso', x: 1.3, y: -4.0, rot: -12, localScale: true },
    { name: 'foreF', parent: 'armF', x: 0, y: UPPER_ARM, localScale: true },
    { name: 'handF', parent: 'foreF', x: 0, y: FORE_ARM },
    { name: 'paddle', parent: 'handF', x: 0, y: 0.6 },
    { name: 'thighB', parent: 'hip', x: -0.85, y: 0, localScale: true },
    { name: 'shinB', parent: 'thighB', x: 0, y: THIGH, localScale: true },
    { name: 'footB', parent: 'shinB', x: 0, y: SHIN },
    { name: 'thighF', parent: 'hip', x: 0.95, y: 0, localScale: true },
    { name: 'shinF', parent: 'thighF', x: 0, y: THIGH, localScale: true },
    { name: 'footF', parent: 'shinF', x: 0, y: SHIN },
    { name: 'fx1', parent: 'root', x: 0, y: 0 },
    { name: 'fx2', parent: 'root', x: 0, y: 0 },
    { name: 'fx3', parent: 'root', x: 0, y: 0 },
  ],
  slots: [
    { name: 'fxBack', bone: 'fx3', symbol: null },
    ...limbSlots('armB', 'foreB', 'upperArm', 'foreArm'),
    { name: 'handB', bone: 'handB', symbol: 'handOpen' },
    { name: 'prop', bone: 'prop', symbol: null },
    ...limbSlots('thighB', 'shinB', 'thigh', 'shin'),
    { name: 'footB', bone: 'footB', symbol: 'shoe' },
    ...limbSlots('thighF', 'shinF', 'thigh', 'shin'),
    { name: 'footF', bone: 'footF', symbol: 'shoe' },
    { name: 'torso', bone: 'torso', symbol: 'torso' },
    { name: 'apron', bone: 'hip', symbol: 'apron' },
    ...limbSlots('armF', 'foreF', 'upperArm', 'foreArm'),
    { name: 'paddle', bone: 'paddle', symbol: 'paddle' },
    { name: 'handF', bone: 'handF', symbol: 'fist' },
    { name: 'neckSkin', bone: 'neck', symbol: 'neckSkin' },
    { name: 'scarf', bone: 'neck', symbol: 'scarf' },
    { name: 'head', bone: 'head', symbol: 'head' },
    { name: 'face', bone: 'face', symbol: 'face' },
    { name: 'stache', bone: 'stache', symbol: 'stache' },
    { name: 'hat', bone: 'hat', symbol: 'hat' },
    { name: 'fx1', bone: 'fx1', symbol: null },
    { name: 'fx2', bone: 'fx2', symbol: null },
  ],
  symbols: {
    ...limbSymbols({ upperArm, foreArm, thigh, shin }),
    shoe,
    torso,
    apron,
    scarf,
    head,
    neckSkin,
    ...faces,
    stache,
    stacheShout,
    stacheGrit,
    hat,
    hatChute,
    handOpen,
    fist,
    paddle,
    pepperBomb,
    shaker,
    cheeseCloud,
    dough,
    boxes,
    swoosh,
    oven,
    pepperDust,
  },
};

/** Lengths the IK helpers need: the wrist and the ankle sit this far down their lower bone. */
export const HAND = FORE_ARM;
export const FOOT = SHIN;
