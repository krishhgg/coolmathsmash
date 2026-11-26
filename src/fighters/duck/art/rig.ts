import type { Rig } from '../../../render/rig/types';
import {
  BODY_R,
  HEAD_R,
  LEG,
  body,
  bodyLine,
  crest,
  crown,
  faces,
  foot,
  footWeb,
  fxFeather,
  fxFeathers,
  fxGlows,
  fxPuff,
  fxSpeed,
  fxStar,
  fxSwoosh,
  head,
  headLine,
  leg,
  ruffles,
  wingLines,
  wingOpen,
} from './parts';

/** Height of the belly's centre above the feet, and the head's centre from the belly's. */
export const BODY_Y = -1.15 - 0.19 - BODY_R;
export const BODY_X = -0.3;
export const HEAD_X = 0.5;
export const HEAD_Y = -11 + 0.19 + HEAD_R - BODY_Y;
/** Hips, in belly space: both legs come out of the bottom of the belly. */
export const HIP_Y = 3.0;
export const HIP_X = -0.25;

/**
 * The Duck's skeleton (rest pose: standing, facing right). `base` turns the whole duck about his feet and mirrors
 * him for turns; `body` is the belly's centre and squashes on its own (`localScale`), carrying the head, wings
 * and legs. `fx1`-`fx3` are free effect bones placed in rig space.
 */
export const rig: Rig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'base', parent: 'root', x: 0, y: 0 },
    { name: 'body', parent: 'base', x: BODY_X, y: BODY_Y, localScale: true },
    { name: 'head', parent: 'body', x: HEAD_X, y: HEAD_Y },
    { name: 'face', parent: 'head', x: 0, y: 0 },
    { name: 'hat', parent: 'head', x: 0, y: 0 },
    { name: 'wingB', parent: 'body', x: 0.55, y: -1.6 },
    { name: 'wingF', parent: 'body', x: -0.05, y: -0.9 },
    { name: 'legB', parent: 'body', x: HIP_X, y: HIP_Y, localScale: true },
    { name: 'footB', parent: 'legB', x: 0, y: LEG },
    { name: 'legF', parent: 'body', x: HIP_X, y: HIP_Y, localScale: true },
    { name: 'footF', parent: 'legF', x: 0, y: LEG },
    { name: 'fx1', parent: 'root', x: 0, y: 0 },
    { name: 'fx2', parent: 'root', x: 0, y: 0 },
    { name: 'fx3', parent: 'root', x: 0, y: 0 },
  ],
  slots: [
    { name: 'fxBack', bone: 'fx3', symbol: null, decor: true },
    { name: 'wingB', bone: 'wingB', symbol: null },
    { name: 'legB', bone: 'legB', symbol: 'leg' },
    { name: 'footB', bone: 'footB', symbol: 'foot' },
    { name: 'legF', bone: 'legF', symbol: 'leg' },
    { name: 'footF', bone: 'footF', symbol: 'foot' },
    { name: 'bodyLine', bone: 'body', symbol: 'bodyLine' },
    { name: 'headLine', bone: 'head', symbol: 'headLine' },
    { name: 'body', bone: 'body', symbol: 'body' },
    { name: 'head', bone: 'head', symbol: 'head' },
    { name: 'face', bone: 'face', symbol: 'face' },
    { name: 'hat', bone: 'hat', symbol: null },
    { name: 'wingF', bone: 'wingF', symbol: null },
    { name: 'fx1', bone: 'fx1', symbol: null, decor: true },
    { name: 'fx2', bone: 'fx2', symbol: null, decor: true },
  ],
  symbols: {
    body,
    bodyLine,
    head,
    headLine,
    ...faces,
    leg,
    foot,
    footWeb,
    wingOpen,
    ...wingLines,
    /** The flight wing flapping on the match clock, as Duck Life's flying training draws it. */
    wingFlap: {
      loop: ['wingV', 'wingVs', 'wingFlat', 'wingAs', 'wingA', 'wingAs', 'wingFlat', 'wingVs'],
      fps: 30,
    },
    /** Feathers fluffing up while Running Ram charges, flickering through three drawings. */
    fxRuffle: { loop: ['ruffleA', 'ruffleB', 'ruffleC'], fps: 15 },
    ...ruffles,
    ...fxGlows,
    crown,
    crest,
    fxPuff,
    fxFeather,
    fxFeathers,
    fxSwoosh,
    fxSpeed,
    fxStar,
  },
};
