import type { PathShape } from '../../../render/rig/types';
import { DUCK_RAFT } from '../duckRaftData';
import { LINE, INK } from './parts';
import { bezier, ellipse, inflate, smooth, strokes, type P } from './shapes';

/**
 * Duck Raft's drawings, by hand in the kids' flat Flash look: a yellow inflatable duck boat seen from the side, its
 * head and orange bill up at the bow and a little tail at the stern, and the folded raft the big kid throws.
 *
 * Raft space is the entity's: origin at its centre, y down, the bow (+x) the way it faces. The hull's rim is drawn
 * 0.95 above the deck the sim stands fighters on (DUCK_RAFT.deck), and the raft draws over fighters, so whoever stands
 * on it stands in the boat, the near side of the hull hiding their feet. Its bottom is DUCK_RAFT.bottom down.
 */

const fill = (d: string, color: string): PathShape => ({ d, fill: color });
const inked = (d: string, color: string, width = INK): PathShape => ({
  d,
  fill: color,
  stroke: { color: 'line', width },
});
/** A closed outline as an ink underlay and its fill. */
const solid = (pts: readonly P[], color: string, ink = LINE): PathShape[] => [
  fill(smooth(inflate(pts, ink)), 'line'),
  fill(smooth(pts), color),
];

/** The deck in raft space (y down) and the rim just above it. */
const DECK = -DUCK_RAFT.deck;
export const RIM = DECK - 0.95;
const BOTTOM = DUCK_RAFT.bottom;

/** The hull, a fat tube rising a little toward its ends: the rim along the top, the keel along the bottom. */
const HULL: P[] = [
  [-8.9, RIM - 0.45],
  [-6.0, RIM - 0.08],
  [0, RIM],
  [6.0, RIM - 0.08],
  [8.7, RIM - 0.45],
  [9.6, RIM + 0.75],
  [8.5, 0.85],
  [5.6, BOTTOM - 0.3],
  [0, BOTTOM],
  [-5.6, BOTTOM - 0.3],
  [-8.5, 0.85],
  [-9.6, RIM + 0.75],
];

/** The underside in shade, away from the light, inside the hull's outline. */
const HULL_SHADE: P[] = [
  [-8.7, 0.35],
  [-5.4, 1.05],
  [0, 1.25],
  [5.4, 1.05],
  [8.7, 0.35],
  [8.2, 1.05],
  [5.5, BOTTOM - 0.38],
  [0, BOTTOM - 0.08],
  [-5.5, BOTTOM - 0.38],
  [-8.2, 1.05],
];

/** The print of a folded wing on the hull's side: a rounded top and three scallops along its back edge. */
const WING: P[] = [
  [-3.9, -1.3],
  [-1.6, -1.95],
  [1.2, -1.75],
  [2.9, -1.0],
  [1.4, -0.6],
  [-0.1, -0.15],
  [-1.0, -0.6, 0],
  [-1.7, 0.05],
  [-2.6, -0.45, 0],
  [-3.3, 0.1],
  [-3.7, -0.6, 0],
];

/** The neck rising from the bow into a round head. */
const HEAD: P[] = [
  [6.3, RIM + 0.7],
  [6.4, -3.7],
  [6.0, -5.4],
  [6.0, -7.1],
  [6.9, -8.6],
  [8.4, -9.2],
  [9.9, -8.6],
  [10.5, -7.1],
  [9.9, -5.6],
  [9.4, -4.3],
  [9.4, -3.2],
  [9.1, RIM + 0.7],
];

/** The front of the neck and the underside of the head in shade. */
const HEAD_SHADE: P[] = [
  [9.6, -7.9],
  [10.5, -7.1],
  [9.9, -5.6],
  [9.4, -4.3],
  [9.4, -3.2],
  [9.1, RIM + 0.6],
  [8.5, RIM + 0.6],
  [8.6, -3.4],
  [8.7, -4.9],
  [9.3, -6.2],
];

/** A flat duck's bill pointing forward from the head. */
const BILL: P[] = [
  [9.9, -7.5],
  [11.0, -7.55],
  [12.3, -7.2],
  [12.5, -6.6],
  [11.6, -6.25],
  [10.2, -6.2],
];

/** The tail flicking up at the stern, behind the hull. */
const TAIL: P[] = [
  [-7.9, RIM + 0.6],
  [-9.7, RIM + 0.5],
  [-10.7, -3.2],
  [-11.1, -5.0, 0],
  [-10.1, -4.0],
  [-9.1, -3.1],
  [-8.1, RIM - 0.4],
];

export const duckRaft: PathShape[] = [
  ...solid(TAIL, 'duck'),
  ...solid(HEAD, 'duck'),
  fill(smooth(HEAD_SHADE), 'duckLo'),
  fill(ellipse(7.3, -8.15, 0.75, 0.42), 'duckHi'),
  ...solid(BILL, 'beak', INK + 0.05),
  fill(smooth(BILL.slice(3).concat([[10.2, -6.6]])), 'beakLo'),
  inked(ellipse(8.75, -7.55, 0.62, 0.8), 'eye'),
  fill(ellipse(9.0, -7.45, 0.34, 0.44), 'pupil'),
  fill(ellipse(9.12, -7.62, 0.11, 0.13), 'eye'),
  ...solid(HULL, 'duck'),
  fill(smooth(HULL_SHADE), 'duckLo'),
  ...strokes(bezier([-6.6, -1.6], [-5.0, -1.85], [-3.4, -1.95], [-2.0, -1.9], 5), 0.42, 'duckHi'),
  inked(smooth(WING), 'duckLo', INK),
  ...strokes(bezier([-2.9, -1.05], [-1.8, -1.35], [-0.2, -1.3], [1.4, -1.05], 5), INK * 0.8),
  inked(ellipse(-6.2, 0.15, 0.42, 0.36), 'buckle', INK),
  fill(ellipse(-6.2, 0.15, 0.16, 0.13), 'line'),
];

/**
 * The raft folded up in the big kid's fist before he throws it, in hand space (the fist at the origin): a squashed
 * yellow bundle with the duck's head and bill poking out of the top.
 */
export const raftBundle: PathShape[] = [
  ...solid(
    [
      [-1.15, -0.95],
      [0.15, -1.25],
      [1.25, -0.9],
      [1.35, 0.25],
      [0.2, 0.55],
      [-1.2, 0.3],
    ],
    'duck',
  ),
  fill(
    smooth([
      [-1.1, -0.1],
      [0.2, 0.05],
      [1.3, -0.2],
      [1.3, 0.25],
      [0.2, 0.5],
      [-1.15, 0.28],
    ]),
    'duckLo',
  ),
  ...strokes(bezier([-0.9, -0.45], [-0.3, -0.25], [0.5, -0.3], [1.05, -0.55], 4), INK * 0.8),
  ...solid(
    [
      [0.25, -1.1],
      [0.35, -1.75],
      [0.85, -2.1],
      [1.35, -1.8],
      [1.3, -1.15],
    ],
    'duck',
    INK + 0.05,
  ),
  ...solid(
    [
      [1.3, -1.85],
      [1.85, -1.75],
      [1.8, -1.5],
      [1.3, -1.5],
    ],
    'beak',
    INK,
  ),
  fill(ellipse(0.95, -1.8, 0.12, 0.15), 'pupil'),
];

export const raftSymbols = { duckRaft, raftBundle };
