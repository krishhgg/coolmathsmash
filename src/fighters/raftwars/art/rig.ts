import type { PathShape, Rig, Slot } from '../../../render/rig/types';
import {
  BRO_ARM,
  FORE_ARM,
  SHIN,
  THIGH,
  UPPER_ARM,
  broBody,
  broFaces,
  broHead,
  broParts,
  faces,
  fxBall,
  fxFlames,
  fxPuff,
  fxSpark,
  fxSpeed,
  fxStar,
  fxSweat,
  gun,
  hat,
  head,
  parts,
  ringBack,
  ringFront,
  rocket,
  shoes,
  torso,
  type Part,
} from './parts';

/** Ink slots for both segments of a limb, then their fills, so joints have no seam. */
function limbSlots(upper: string, lower: string, upperSym: string, lowerSym: string): Slot[] {
  return [
    { name: `${upper}Line`, bone: upper, symbol: `${upperSym}Line` },
    { name: `${lower}Line`, bone: lower, symbol: `${lowerSym}Line` },
    { name: upper, bone: upper, symbol: upperSym },
    { name: lower, bone: lower, symbol: lowerSym },
  ];
}

/** A one-piece limb: its ink slot, then its fill. */
function oneSlots(bone: string, sym: string): Slot[] {
  return [
    { name: `${bone}Line`, bone, symbol: `${sym}Line` },
    { name: bone, bone, symbol: sym },
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

/**
 * The kids' skeleton (rest pose: standing, facing right). `body` is the pair's centre of mass, so rotating it turns
 * everything. The big kid is drawn three-quarters from the front: his near arm and leg (`F`) hang from the -x
 * side and draw in front, the far ones (`B`) from +x behind. `ring` rides his hips, `gun` (the launcher on its
 * strap) his chest, and `bro`, the little brother, sits on the back of the ring holding on to him. `rocket` and
 * `fx1`-`fx3` are free bones placed in rig space.
 */
export const rig: Rig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'body', parent: 'root', x: 0, y: -6.0 },
    { name: 'hip', parent: 'body', x: 0.2, y: 1.6 },
    { name: 'torso', parent: 'hip', x: 0, y: 0 },
    { name: 'neck', parent: 'torso', x: 0.3, y: -2.75 },
    { name: 'head', parent: 'neck', x: 0, y: 0 },
    { name: 'face', parent: 'head', x: 0, y: 0 },
    { name: 'hat', parent: 'head', x: 0, y: 0 },
    { name: 'armB', parent: 'torso', x: 1.35, y: -2.65, localScale: true },
    { name: 'foreB', parent: 'armB', x: 0, y: UPPER_ARM, localScale: true },
    { name: 'armF', parent: 'torso', x: -0.55, y: -2.6, localScale: true },
    { name: 'foreF', parent: 'armF', x: 0, y: UPPER_ARM, localScale: true },
    { name: 'thighB', parent: 'hip', x: 0.75, y: 0.3, localScale: true },
    { name: 'shinB', parent: 'thighB', x: 0, y: THIGH, localScale: true },
    { name: 'footB', parent: 'shinB', x: 0, y: SHIN },
    { name: 'thighF', parent: 'hip', x: -0.35, y: 0.3, localScale: true },
    { name: 'shinF', parent: 'thighF', x: 0, y: THIGH, localScale: true },
    { name: 'footF', parent: 'shinF', x: 0, y: SHIN },
    { name: 'ring', parent: 'hip', x: 0.1, y: -0.5 },
    { name: 'gun', parent: 'torso', x: 1.0, y: -1.55 },
    { name: 'bro', parent: 'torso', x: -3.1, y: -1.05 },
    { name: 'broHead', parent: 'bro', x: 0.15, y: -2.0 },
    { name: 'broFace', parent: 'broHead', x: 0, y: 0 },
    { name: 'broArmB', parent: 'bro', x: -0.65, y: -1.6, rot: -40 },
    { name: 'broArmF', parent: 'bro', x: 0.75, y: -1.65, rot: -68 },
    { name: 'broLeg', parent: 'bro', x: 0.3, y: -0.1, rot: -15 },
    { name: 'rocket', parent: 'root', x: 0, y: 0 },
    { name: 'fx1', parent: 'root', x: 0, y: 0 },
    { name: 'fx2', parent: 'root', x: 0, y: 0 },
    { name: 'fx3', parent: 'root', x: 0, y: 0 },
  ],
  slots: [
    { name: 'fxBack', bone: 'fx3', symbol: null, decor: true },
    { name: 'rocket', bone: 'rocket', symbol: null },
    { name: 'ringBack', bone: 'ring', symbol: 'ringBack' },
    ...oneSlots('broArmB', 'broArmFar'),
    { name: 'broBody', bone: 'bro', symbol: 'broBody' },
    { name: 'broHead', bone: 'broHead', symbol: 'broHead' },
    { name: 'broFace', bone: 'broFace', symbol: 'broFace' },
    ...limbSlots('armB', 'foreB', 'upperArmFar', 'fistFar'),
    ...limbSlots('thighB', 'shinB', 'thighFar', 'shinFar'),
    { name: 'footB', bone: 'footB', symbol: 'shoeFar' },
    ...limbSlots('thighF', 'shinF', 'thigh', 'shin'),
    { name: 'footF', bone: 'footF', symbol: 'shoe' },
    { name: 'torso', bone: 'torso', symbol: 'torso' },
    { name: 'ringFront', bone: 'ring', symbol: 'ringFront' },
    ...oneSlots('broLeg', 'broLeg'),
    ...oneSlots('broArmF', 'broArm'),
    { name: 'head', bone: 'head', symbol: 'head' },
    { name: 'face', bone: 'face', symbol: 'face' },
    { name: 'hat', bone: 'hat', symbol: 'hat' },
    { name: 'gun', bone: 'gun', symbol: 'gun' },
    ...limbSlots('armF', 'foreF', 'upperArm', 'fist'),
    { name: 'fx1', bone: 'fx1', symbol: null, decor: true },
    { name: 'fx2', bone: 'fx2', symbol: null, decor: true },
  ],
  symbols: {
    head,
    ...faces,
    hat,
    torso,
    ...shoes,
    ...partSymbols(parts),
    ringBack,
    ringFront,
    gun,
    broBody,
    broHead,
    ...broFaces,
    ...partSymbols(broParts),
    rocket,
    fxPuff,
    fxSpeed,
    fxStar,
    fxSpark,
    fxSweat,
    fxBall,
    ...fxFlames,
    /** The rocket's exhaust flickering on the match clock. */
    fxFlame: { loop: ['fxFlameA', 'fxFlameB'], fps: 20 },
  },
};

/** Lengths the IK helpers need: hand points are this far down the forearm, ankles this far down the shin. */
export const HAND = FORE_ARM;
export const FOOT = SHIN;
export { BRO_ARM };
