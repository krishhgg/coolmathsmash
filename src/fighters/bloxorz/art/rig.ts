import type { Rig } from '../../../render/rig/types';
import { symbols } from './symbols';

/**
 * Bloxorz block's skeleton. `pivot` is the edge the block turns about (a tip's leading bottom edge, or its
 * centre for spins) and carries the rotation; `block` sits on it, offset to the block's centre, turned 0 when
 * standing and 90 when lying, and scaled along its own axes (x across, y along its length) for squash and stretch.
 * `cubeA`/`cubeB` are the two cubes the block splits into in its taunt; `fx1`-`fx7` place effects in rig space.
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
  ],
  slots: [
    { name: 'back', bone: 'fx1', symbol: null, decor: true },
    { name: 'bevel', bone: 'block', symbol: 'bevel0' },
    { name: 'face', bone: 'block', symbol: 'face' },
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
