import type { Rig } from '../../../render/rig/types';
import { symbols } from './symbols';

/** The Final Smash's twelve level tiles, `lt0` the furthest behind the block (art/finalSmash.ts). */
export const LEVEL_TILES = Array.from({ length: 12 }, (_, i) => `lt${i}`);

/**
 * Bloxorz block's skeleton. `pivot` is the edge the block turns about (a tip's leading bottom edge, or its
 * centre for spins) and carries the rotation; `block` sits on it, offset to the block's centre, turned 0 when
 * standing and 90 when lying, and scaled along its own axes (x across, y along its length) for squash and stretch.
 * `cubeA`/`cubeB` are the two cubes the block splits into in its taunt and Final Smash; `fx1`-`fx7` place effects
 * in rig space, and `lt0`-`lt11` the Final Smash's level tiles, which draw behind everything else. `bevelUnder` and
 * `faceUnder` draw the block under every fighter (Slot.under) while its Final Smash lies toppled on the one it caught.
 * Clips key every bone on every frame, so rests are all zero.
 */
export const rig: Rig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'pivot', parent: 'root', x: 0, y: 0 },
    { name: 'block', parent: 'pivot', x: 0, y: 0 },
    { name: 'cubeA', parent: 'root', x: 0, y: 0 },
    { name: 'cubeB', parent: 'root', x: 0, y: 0 },
    ...[1, 2, 3, 4, 5, 6, 7].map((i) => ({ name: `fx${i}`, parent: 'root', x: 0, y: 0 })),
    ...LEVEL_TILES.map((name) => ({ name, parent: 'root', x: 0, y: 0 })),
  ],
  slots: [
    ...LEVEL_TILES.map((name) => ({ name, bone: name, symbol: null, decor: true })),
    { name: 'back', bone: 'fx1', symbol: null, decor: true },
    { name: 'bevel', bone: 'block', symbol: 'bevel0' },
    { name: 'face', bone: 'block', symbol: 'face' },
    { name: 'bevelUnder', bone: 'block', symbol: null, under: true },
    { name: 'faceUnder', bone: 'block', symbol: null, under: true },
    { name: 'cubeBevelA', bone: 'cubeA', symbol: null },
    { name: 'cubeA', bone: 'cubeA', symbol: null },
    { name: 'cubeBevelB', bone: 'cubeB', symbol: null },
    { name: 'cubeB', bone: 'cubeB', symbol: null },
    { name: 'dustA', bone: 'fx2', symbol: null, decor: true },
    { name: 'dustB', bone: 'fx3', symbol: null, decor: true },
    { name: 'hitA', bone: 'fx4', symbol: null },
    { name: 'hitB', bone: 'fx5', symbol: null },
    { name: 'starA', bone: 'fx6', symbol: null, decor: true },
    { name: 'starB', bone: 'fx7', symbol: null, decor: true },
  ],
  symbols,
};
