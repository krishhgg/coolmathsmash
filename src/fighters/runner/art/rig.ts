import type { PathShape, Rig, Slot } from '../../../render/rig/types';
import {
  ANKLE,
  ANTENNA_BASES,
  FORE_ARM,
  SHIN,
  THIGH,
  UPPER_ARM,
  antenna,
  body,
  cane,
  colander,
  crate,
  crest,
  dust,
  ear,
  faces,
  idleBody,
  limbs,
  map,
  streak,
  swoosh,
  tile,
  type Part,
} from './parts';

/** A leg: the outlines of thigh, shin and foot behind all three fills, so the leg is one shape with no seams. */
function legSlots(thigh: string, shin: string, foot: string, far: boolean): Slot[] {
  const sym = (s: string) => (far ? `${s}Far` : s);
  return [
    { name: `${thigh}Line`, bone: thigh, symbol: `${sym('thigh')}Line` },
    { name: `${shin}Line`, bone: shin, symbol: `${sym('shin')}Line` },
    { name: `${foot}Line`, bone: foot, symbol: `${sym('foot')}Line` },
    { name: thigh, bone: thigh, symbol: sym('thigh') },
    { name: shin, bone: shin, symbol: sym('shin') },
    { name: foot, bone: foot, symbol: sym('foot') },
  ];
}

/** Outline slots for both segments of a limb, then their fills, so the joint has no seam. */
function limbSlots(upper: string, lower: string, upperSym: string, lowerSym: string): Slot[] {
  return [
    { name: `${upper}Line`, bone: upper, symbol: `${upperSym}Line` },
    { name: `${lower}Line`, bone: lower, symbol: `${lowerSym}Line` },
    { name: upper, bone: upper, symbol: upperSym },
    { name: lower, bone: lower, symbol: lowerSym },
  ];
}

function partSymbols(all: Record<string, Part>): Record<string, PathShape[]> {
  return Object.fromEntries(
    Object.entries(all).flatMap(([name, part]) => [
      [name, part.fill],
      [`${name}Line`, part.line],
    ]),
  );
}

/** Height of her body's centre above the floor when she stands. */
export const BODY_Y = -6.75;

/**
 * The Runner's skeleton (rest pose: standing, facing right). Her body is also her head, so `body` carries the
 * face, both antennae and both shoulders, and rotating or squashing it moves the whole of her above the legs.
 * The far arm and leg (`B`) sit behind the body in the shade tone; the near arm (`F`) is drawn over it. The
 * antennae (or the Bunny's ears) hang off their own bones so clips can let them trail behind her moves.
 */
export const rig: Rig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'body', parent: 'root', x: 0, y: BODY_Y },
    { name: 'face', parent: 'body', x: 0, y: 0 },
    {
      name: 'antB',
      parent: 'body',
      x: ANTENNA_BASES.back[0],
      y: ANTENNA_BASES.back[1],
      rot: ANTENNA_BASES.back[2],
    },
    {
      name: 'antF',
      parent: 'body',
      x: ANTENNA_BASES.front[0],
      y: ANTENNA_BASES.front[1],
      rot: ANTENNA_BASES.front[2],
    },
    { name: 'armB', parent: 'body', x: 3.15, y: 0.8, rot: -42, localScale: true },
    { name: 'foreB', parent: 'armB', x: 0, y: UPPER_ARM, rot: -10, localScale: true },
    { name: 'armF', parent: 'body', x: -3.3, y: 0.95, rot: 42, localScale: true },
    { name: 'foreF', parent: 'armF', x: 0, y: UPPER_ARM, rot: 10, localScale: true },
    { name: 'hip', parent: 'body', x: 0, y: 2.75 },
    { name: 'thighB', parent: 'hip', x: 1.15, y: 0, localScale: true },
    { name: 'shinB', parent: 'thighB', x: 0, y: THIGH, localScale: true },
    { name: 'footB', parent: 'shinB', x: 0, y: SHIN - ANKLE },
    { name: 'thighF', parent: 'hip', x: -1.05, y: 0, localScale: true },
    { name: 'shinF', parent: 'thighF', x: 0, y: THIGH, localScale: true },
    { name: 'footF', parent: 'shinF', x: 0, y: SHIN - ANKLE },
    { name: 'fx1', parent: 'root', x: 0, y: 0 },
    { name: 'fx2', parent: 'root', x: 0, y: 0 },
    { name: 'fx3', parent: 'root', x: 0, y: 0 },
  ],
  slots: [
    { name: 'fxBack', bone: 'fx3', symbol: null },
    { name: 'antB', bone: 'antB', symbol: 'antenna' },
    ...limbSlots('armB', 'foreB', 'upperArmFar', 'handFar'),
    { name: 'cane', bone: 'foreB', symbol: null },
    ...legSlots('thighB', 'shinB', 'footB', true),
    ...legSlots('thighF', 'shinF', 'footF', false),
    { name: 'antF', bone: 'antF', symbol: 'antenna' },
    { name: 'body', bone: 'body', symbol: 'body' },
    { name: 'crest', bone: 'body', symbol: null },
    { name: 'face', bone: 'face', symbol: 'face' },
    { name: 'hat', bone: 'body', symbol: null },
    ...limbSlots('armF', 'foreF', 'upperArm', 'hand'),
    { name: 'fx1', bone: 'fx1', symbol: null },
    { name: 'fx2', bone: 'fx2', symbol: null },
  ],
  symbols: {
    body,
    idleBody,
    antenna,
    ear,
    crest,
    colander,
    crate,
    dust,
    cane,
    map,
    streak,
    swoosh,
    tile,
    ...faces,
    ...partSymbols(limbs),
  },
};

/** Lengths the IK helpers need: hand centres are this far down the forearm, ankles this far down the shin. */
export const HAND = FORE_ARM;
export const FOOT = SHIN - ANKLE;
export { ANKLE };
