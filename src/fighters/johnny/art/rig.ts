import type { PathShape, Rig, Slot } from '../../../render/rig/types';
import { FORE_ARM, SHIN, THIGH, UPPER_ARM, boots, head, mouths, parts, torso, type Part } from './parts';

/** Outline slots for both segments of a limb, then their fills, so joints have no seam. */
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

/** The head is drawn a little wide; narrowing it gives the game's small skull over a huge jaw. */
const HEAD_SX = 0.88;

/**
 * Johnny's skeleton (rest pose: standing, facing right), in the game's 3/4 view: the near arm and leg (`F`,
 * drawn in front, bright) hang from his right side at -x, the far ones (`B`, drawn behind, shaded) from +x.
 * `body` is his centre of mass, so rotating it turns the whole fighter; `fx1`-`fx3` are free effect bones.
 */
export const rig: Rig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'body', parent: 'root', x: 0, y: -8.5 },
    { name: 'hip', parent: 'body', x: 0.4, y: 4.5 },
    { name: 'torso', parent: 'hip', x: 0, y: 0 },
    { name: 'neck', parent: 'torso', x: 0.2, y: -6.6 },
    { name: 'head', parent: 'neck', x: 0, y: 0, sx: HEAD_SX },
    { name: 'face', parent: 'head', x: 0, y: 0 },
    { name: 'armB', parent: 'torso', x: 3.45, y: -5.7, rot: -18, localScale: true },
    { name: 'foreB', parent: 'armB', x: 0, y: UPPER_ARM, localScale: true },
    { name: 'armF', parent: 'torso', x: -3.0, y: -5.6, rot: 18, localScale: true },
    { name: 'foreF', parent: 'armF', x: 0, y: UPPER_ARM, localScale: true },
    { name: 'thighB', parent: 'hip', x: 1.45, y: 0.3, localScale: true },
    { name: 'shinB', parent: 'thighB', x: 0, y: THIGH, localScale: true },
    { name: 'footB', parent: 'shinB', x: 0, y: SHIN },
    { name: 'thighF', parent: 'hip', x: -1.15, y: 0.3, localScale: true },
    { name: 'shinF', parent: 'thighF', x: 0, y: THIGH, localScale: true },
    { name: 'footF', parent: 'shinF', x: 0, y: SHIN },
    { name: 'fx1', parent: 'root', x: 0, y: 0 },
    { name: 'fx2', parent: 'root', x: 0, y: 0 },
    { name: 'fx3', parent: 'root', x: 0, y: 0 },
  ],
  slots: [
    { name: 'fxBack', bone: 'fx3', symbol: null },
    ...limbSlots('armB', 'foreB', 'upperArmFar', 'fistFar'),
    ...limbSlots('thighB', 'shinB', 'thighFar', 'shinFar'),
    { name: 'footB', bone: 'footB', symbol: 'bootFar' },
    ...limbSlots('thighF', 'shinF', 'thigh', 'shin'),
    { name: 'footF', bone: 'footF', symbol: 'boot' },
    { name: 'torso', bone: 'torso', symbol: 'torso' },
    { name: 'head', bone: 'head', symbol: 'head' },
    { name: 'face', bone: 'face', symbol: 'grit' },
    ...limbSlots('armF', 'foreF', 'upperArm', 'palm'),
    { name: 'fx1', bone: 'fx1', symbol: null },
    { name: 'fx2', bone: 'fx2', symbol: null },
  ],
  symbols: {
    head,
    ...mouths,
    torso,
    ...boots,
    ...partSymbols(parts),
  },
};

/** Lengths the IK helpers need: hand points are this far down the forearm, ankles this far down the shin. */
export const HAND = FORE_ARM;
export const FOOT = SHIN;
