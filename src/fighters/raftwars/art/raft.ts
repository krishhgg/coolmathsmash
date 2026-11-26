import { flattenPath } from '../../../render/rig/geometry';
import type { PathShape } from '../../../render/rig/types';
import { DUCK_RAFT } from '../duckRaftData';
import { LINE, INK } from './parts';
import { bezier, ellipse, inflate, place, poly, smooth, strokes, turn, type P } from './shapes';

/**
 * Duck Raft's drawings, by hand in the kids' flat Flash look: a yellow inflatable duck boat seen from the side, its
 * head and orange bill up at the bow and a little tail at the stern, the folded raft the big kid throws, and the pop
 * when it goes.
 *
 * Raft space is the entity's: origin at its centre, y down, the bow (+x) the way it faces. Its bottom is
 * DUCK_RAFT.bottom down. The whole raft draws behind fighters, so its head and hull never hide anyone. Only `duckRaftRim`,
 * the top band of the hull from its rim (0.95 above the deck the sim stands fighters on) to just under the deck, draws
 * over them, so whoever stands on it stands in the boat with their feet behind the rim (PropArt.front).
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

/** The print of a folded wing on the hull's side, below the rim band: a rounded top and three scallops behind. */
const WING: P[] = place(
  [
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
  ],
  0,
  1.2,
  1,
  0.85,
);

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
  [-7.6, RIM + 0.6],
  [-9.4, RIM + 0.5],
  [-9.9, -3.3],
  [-9.9, -5.1, 0],
  [-9.1, -4.0],
  [-8.5, -3.1],
  [-7.7, RIM - 0.4],
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
  ...strokes(bezier([-2.9, 0.31], [-1.8, 0.05], [-0.2, 0.1], [1.4, 0.31], 5), INK * 0.8),
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

/** Where the rim band ends: just under the deck, so it covers the soles of whoever stands on it. */
export const RIM_BAND = DECK + 0.3;

/** The part of a smooth closed outline above y `cut` (y down), closed along the cut. */
function above(pts: readonly P[], cut: number): string {
  const flat = flattenPath(smooth(pts), 12)[0]!;
  const ring: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) ring.push([flat[i]!, flat[i + 1]!]);
  const start = ring.findIndex(([, y]) => y > cut);
  const out: [number, number][] = [];
  for (let k = 0; k < ring.length; k++) {
    const [ax, ay] = ring[(start + k) % ring.length]!;
    const [bx, by] = ring[(start + k + 1) % ring.length]!;
    if (ay <= cut) out.push([ax, ay]);
    if (ay > cut !== by > cut) {
      const t = (cut - ay) / (by - ay);
      out.push([ax + (bx - ax) * t, cut]);
    }
  }
  return poly(out);
}

/**
 * The hull's top band, drawn over fighters: the same ink, fill and highlight as the hull from its rim down to
 * RIM_BAND, cut straight along the bottom where it meets the hull drawn behind them.
 */
export const duckRaftRim: PathShape[] = [
  // The ink stops a little above the fill's cut, so the fill hides its edge and no seam shows on the hull.
  fill(above(inflate(HULL, LINE), RIM_BAND - 0.15), 'line'),
  fill(above(HULL, RIM_BAND), 'duck'),
  ...strokes(bezier([-6.6, -1.6], [-5.0, -1.85], [-3.4, -1.95], [-2.0, -1.9], 5), 0.42, 'duckHi'),
];

/** A torn scrap of yellow vinyl, about a unit across, at (x, y) scaled by `s` and turned `deg` degrees. */
const SCRAP: P[] = [
  [-0.75, -0.35],
  [0.1, -0.6],
  [0.8, -0.3],
  [0.55, 0.45],
  [-0.2, 0.3],
  [-0.65, 0.5],
];
function scrap(x: number, y: number, s: number, deg: number, color = 'duck'): PathShape[] {
  const pts = place(turn(SCRAP, deg), x, y, s);
  return [fill(poly(inflate(pts, 0.2)), 'line'), fill(poly(pts), color)];
}

/** A puff of air from the burst raft: three inked white lobes. */
function puff(x: number, y: number, r: number): PathShape[] {
  return [
    inked(ellipse(x - r * 0.7, y + r * 0.2, r * 0.65), 'puff', INK),
    inked(ellipse(x + r * 0.75, y + r * 0.25, r * 0.6), 'puff', INK),
    inked(ellipse(x, y, r), 'puff', INK),
    fill(ellipse(x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.22), 'puffHi'),
  ];
}

/** The scraps' directions (degrees, 0 forward, -90 up) and spins: up and out, none down through the floor. */
const SCRAPS: [number, number][] = [
  [-170, 20],
  [-135, -40],
  [-100, 70],
  [-65, -15],
  [-30, 50],
  [-5, -60],
  [175, 110],
];
/** The burst on its four drawings: how far the scraps have flown, how far they have fallen, and their size. */
const FLIGHT: [number, number, number][] = [
  [3.0, 0, 1.15],
  [7.0, 0.3, 1.05],
  [10.0, 1.0, 0.9],
  [12.5, 2.0, 0.75],
];

/** A jagged burst `rx` by `ry` with `count` points, centred at (x, y): flatter than a star, as wide as the hull. */
function burst(x: number, y: number, rx: number, ry: number, inner: number, count: number, deg = -90): P[] {
  return Array.from({ length: count * 2 }, (_, i): P => {
    const a = ((deg + (i * 180) / count) * Math.PI) / 180;
    const k = i % 2 ? inner : 1;
    return [x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k];
  });
}

function popDrawing(k: number): PathShape[] {
  const [dist, fall, size] = FLIGHT[k]!;
  const at = (deg: number, d = dist): [number, number] => [
    Math.cos((deg * Math.PI) / 180) * d,
    -1 + Math.sin((deg * Math.PI) / 180) * d * 0.75 + fall,
  ];
  const scraps = SCRAPS.flatMap(([deg, spin]) => scrap(...at(deg), size, spin + k * 55));
  const bill = scrap(...at(-35, dist * 1.1), size * 0.9, 30 + k * 70, 'beak');
  const flash =
    k === 0
      ? [
          fill(poly(burst(0.5, -1.8, 10.8, 4.3, 0.62, 12)), 'line'),
          fill(poly(burst(0.5, -1.8, 10.2, 3.9, 0.62, 12)), 'spark'),
          fill(poly(burst(0.5, -1.8, 6.2, 2.4, 0.6, 12, -75)), 'duck'),
        ]
      : [];
  const puffs = [
    [],
    [...puff(-4.2, -1.6, 1.5), ...puff(0.2, -3.0, 1.9), ...puff(4.3, -1.2, 1.5)],
    [...puff(-5.6, -2.6, 1.9), ...puff(0.4, -4.4, 2.3), ...puff(5.4, -2.2, 1.8)],
    [...puff(-6.4, -4.0, 1.0), ...puff(0.6, -6.0, 1.3), ...puff(6.0, -3.6, 0.9)],
  ][k]!;
  return [...flash, ...puffs, ...scraps, ...bill];
}

/** The pop's four drawings, three frames each (DUCK_RAFT.popFrames). */
export const popDrawings = Object.fromEntries(
  ['A', 'B', 'C', 'D'].map((n, k) => [`duckRaftPop${n}`, popDrawing(k)]),
) as Record<string, PathShape[]>;

export const raftSymbols = {
  duckRaft,
  duckRaftRim,
  raftBundle,
  ...popDrawings,
  /** The raft popping when it breaks, wears out or is replaced: once through on the pop entity's age. */
  duckRaftPop: { loop: Object.keys(popDrawings), fps: 20 },
};
