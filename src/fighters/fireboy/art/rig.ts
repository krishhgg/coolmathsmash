import type { Rig, Slot } from '../../../render/rig/types';
import { FORE_ARM, SHIN, THIGH, UPPER_ARM, symbols } from './parts';

/** Outline slots for both segments of a limb, then their fills, so joints have no seam. */
function limbSlots(upper: string, lower: string, upperSym: string, lowerSym: string): Slot[] {
  return [
    { name: `${upper}Line`, bone: upper, symbol: `${upperSym}Line` },
    { name: `${lower}Line`, bone: lower, symbol: `${lowerSym}Line` },
    { name: upper, bone: upper, symbol: upperSym },
    { name: lower, bone: lower, symbol: lowerSym },
  ];
}

export const HIP_Y = -(THIGH + SHIN);
/** Head centre above the chin: the head symbols are drawn around the head centre. */
export const HEAD_R = 3.41;
/** Head size on the rig: the head fills most of the fighter's height. */
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
    { name: 'aura', bone: 'body', symbol: 'aura', decor: true },
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
  symbols,
};

/** Lengths the IK helpers need: hand and foot points are this far down their lower bone. */
export const HAND = FORE_ARM;
export const FOOT = SHIN;
