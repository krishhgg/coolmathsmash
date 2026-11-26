import { transformPath } from '../../../render/rig/geometry';
import type { Paint, PathShape } from '../../../render/rig/types';
import { spiralBand } from './parts';
import { LINE, blob, capsule, ellipse, ink, inkedFill, poly, type Pt } from './shapes';

/**
 * Shell Ship, the Final Smash (src/fighters/snailbob/finalSmash.ts): Snail Bob's spaceship and its effects, drawn from
 * scratch in his games' Flash look like his Rocket Hover booster and crane remote. It is a stubby steel rocket with a
 * red nose and fins and a yellow and black hazard band, a porthole, a laser cannon under the nose, and a snail-shell
 * dome on its back in his costume's shell colours. Every drawing is in its own bone's space (y down), the ship
 * facing right with its middle at the origin.
 */

const fill = (d: string, paint: Paint): PathShape => ({ d, fill: paint });

/** Move and scale path data (the shell dome's spiral is drawn round the origin). */
const placed = (shapes: PathShape[], x: number, y: number, s: number): PathShape[] =>
  shapes.map((p) => ({
    ...p,
    d: transformPath(p.d, { a: s, b: 0, c: 0, d: s, tx: x, ty: y }),
    ...(p.stroke && { stroke: { ...p.stroke, width: p.stroke.width * s } }),
  }));

/** The hull's length from the nozzle's lip to the nose tip, for the clips. */
export const SHIP_NOSE = 12.6;
export const SHIP_TAIL = -13.6;
/** The laser cannon's muzzle, in ship space. */
export const MUZZLE: Pt = [10.3, 4.35];

const HULL = blob([
  [-12, -2.7, true],
  [-8, -3.75],
  [0, -3.95],
  [7, -3.05],
  [11.2, -1.25],
  [SHIP_NOSE, 0.3],
  [11, 1.85],
  [6.5, 3.2],
  [0, 3.7],
  [-8, 3.5],
  [-12, 2.6, true],
]);
/** The hull's underside, a shade darker. */
const BELLY = blob([
  [-11.8, 1.4, true],
  [-6, 2.15],
  [1, 2.35],
  [7, 1.9],
  [11.5, 1.2, true],
  [11, 1.85],
  [6.5, 3.2],
  [0, 3.7],
  [-8, 3.5],
  [-11.9, 2.55, true],
]);
const NOSE = blob([
  [7.3, -2.95, true],
  [9.6, -2.25],
  [11.2, -1.25],
  [SHIP_NOSE, 0.3],
  [11, 1.85],
  [9.4, 2.6],
  [7.1, 3.15, true],
  [7.75, 1.6],
  [7.95, 0.1],
  [7.75, -1.5],
]);
const TOP_FIN = blob([
  [-6.4, -3.7, true],
  [-8.6, -6.1],
  [-11.2, -8.6],
  [-12.9, -8.8, true],
  [-12.7, -7.2],
  [-11.6, -2.8, true],
]);
const LOW_FIN = blob([
  [-6.8, 3.45, true],
  [-9.4, 5.8],
  [-11.8, 7.7],
  [-13.2, 7.7, true],
  [-12.8, 6.1],
  [-11.7, 2.6, true],
]);
const NOZZLE = poly([
  [-11.9, -2.15],
  [SHIP_TAIL, -2.9],
  [SHIP_TAIL, 2.9],
  [-11.9, 2.15],
]);
/** The hazard band round the hull behind the dome, cut to the hull's height there. */
const BAND: [number, number] = [-6.4, -4.7];
/** One of the band's black stripes, slanting across it from `y` on its back edge. */
const bandStripe = (y: number): string =>
  poly([
    [BAND[0], y],
    [BAND[1], y - 0.75],
    [BAND[1], y - 0.05],
    [BAND[0], y + 0.7],
  ]);
/** The snail-shell dome over the cockpit, sitting on the hull's back. */
const DOME = blob([
  [-8.4, -3.45, true],
  [-8.1, -6.6],
  [-6, -9.15],
  [-2.6, -10.25],
  [0.8, -9.45],
  [3.1, -7.1],
  [4.1, -3.5, true],
]);
const domePaint: Paint = {
  type: 'radial',
  cx: -0.6,
  cy: -8.6,
  r: 8,
  stops: [
    { offset: 0, color: 'shellHi' },
    { offset: 0.45, color: 'shell' },
    { offset: 1, color: 'shellLo' },
  ],
};
/** The ridged rim where the dome meets the hull, like the lip of his own shell. */
const RIM = blob([
  [-8.9, -3.1, true],
  [-8.6, -4.25],
  [-2.2, -4.55],
  [4.4, -4.15],
  [4.6, -3.05, true],
  [-2.2, -3.4],
]);
const PORT: Pt = [3.4, -0.35];

/** The ship itself, without its exhaust. */
const hull: PathShape[] = [
  inkedFill(TOP_FIN, 'knob', LINE * 1.6),
  inkedFill(LOW_FIN, 'knob', LINE * 1.6),
  fill(
    blob([
      [-7.6, 3.5, true],
      [-10, 5.4],
      [-12.3, 6.9, true],
      [-11.6, 2.9, true],
    ]),
    'girderLo',
  ),
  inkedFill(NOZZLE, 'steelLo', LINE * 1.6),
  ink(`M${SHIP_TAIL} -2.9L${SHIP_TAIL} 2.9`, LINE * 1.4),
  inkedFill(capsule([4.4, 3.45], [9.8, 4.35], 0.7, 0.62), 'steelLo', LINE * 1.4),
  inkedFill(HULL, 'steel', LINE * 2.2),
  fill(BELLY, 'steelLo'),
  fill(
    poly([
      [BAND[0], -3.75],
      [BAND[1], -3.85],
      [BAND[1], 3.65],
      [BAND[0], 3.55],
    ]),
    'hazard',
  ),
  ...[-2.8, -1.2, 0.4, 2.0].map((y) => fill(bandStripe(y), 'hazardLo')),
  ink(`M${BAND[0]} -3.75L${BAND[0]} 3.55M${BAND[1]} -3.85L${BAND[1]} 3.65`, LINE * 0.8),
  inkedFill(NOSE, 'knob', LINE * 1.2),
  fill(ellipse(9.6, -1.4, 1.2, 0.38, 22), 'gloss'),
  inkedFill(ellipse(PORT[0], PORT[1], 2.05, 2.05), 'steelLo', LINE * 1.4),
  {
    d: ellipse(PORT[0], PORT[1], 1.45, 1.45),
    fill: {
      type: 'radial',
      cx: PORT[0] - 0.5,
      cy: PORT[1] - 0.6,
      r: 2,
      stops: [
        { offset: 0, color: 'glassHi' },
        { offset: 1, color: 'glass' },
      ],
    },
  },
  fill(ellipse(PORT[0] - 0.55, PORT[1] - 0.55, 0.55, 0.3, -35), 'gloss'),
  ...[-10.6, -2.6, 0.2, 6.2].map((x) => inkedFill(ellipse(x, 1.0, 0.2, 0.2), 'steel', LINE * 0.5)),
  inkedFill(ellipse(MUZZLE[0], MUZZLE[1], 0.55, 0.55), 'laser', LINE * 0.8),
  fill(ellipse(-1.2, -2.35, 3.2, 0.34, 1), 'gloss'),
  inkedFill(DOME, domePaint, LINE * 2),
  ...placed(spiralBand(0.15, 2.75, 0.35, 1.15, 1.6, 70), -2.3, -6.55, 0.95),
  fill(ellipse(0.6, -8.4, 1.25, 0.42, 32), 'gloss'),
  inkedFill(RIM, 'lip', LINE * 1.4),
];

/** The exhaust out of the nozzle, `len` long and `w` half-wide there, its tip `lean` off the centre line. */
function exhaust(len: number, w: number, lean: number): PathShape[] {
  const tongue = (s: number, tip: number): string =>
    blob([
      [SHIP_TAIL + 0.2, -w * s, true],
      [SHIP_TAIL - len * tip * 0.28, -w * s * 1.12],
      [SHIP_TAIL - len * tip * 0.64, -w * s * 0.62],
      [SHIP_TAIL - len * tip, lean * s, true],
      [SHIP_TAIL - len * tip * 0.64, w * s * 0.62],
      [SHIP_TAIL - len * tip * 0.28, w * s * 1.12],
      [SHIP_TAIL + 0.2, w * s, true],
    ]);
  return [
    inkedFill(tongue(1, 1), 'flameLo', LINE * 1.2),
    fill(tongue(0.72, 0.78), 'flame'),
    fill(tongue(0.4, 0.52), 'flameHi'),
  ];
}

/** The ship with its exhaust: three cels for the flame's flicker. */
export const ship1: PathShape[] = [...exhaust(7.5, 2.2, 0.3), ...hull];
export const ship2: PathShape[] = [...exhaust(9.2, 2.4, -0.45), ...hull];
export const ship3: PathShape[] = [...exhaust(6.4, 2.05, 0.1), ...hull];

/** How far behind the nozzle the swoop's streak reaches. */
export const TRAIL = 40;
/**
 * The swoop through the stage: the ship at full thrust, with a long white streak behind it, bright at the ship and
 * fading out at the far end, and speed lines over and under it.
 */
export const shipSwoop: PathShape[] = [
  {
    d: blob([
      [SHIP_TAIL + 1, -4.6, true],
      [SHIP_TAIL - TRAIL * 0.45, -3.4],
      [SHIP_TAIL - TRAIL, -0.6, true],
      [SHIP_TAIL - TRAIL, 0.6, true],
      [SHIP_TAIL - TRAIL * 0.45, 3.4],
      [SHIP_TAIL + 1, 4.6, true],
    ]),
    fill: {
      type: 'linear',
      x0: SHIP_TAIL - TRAIL,
      y0: 0,
      x1: SHIP_TAIL,
      y1: 0,
      stops: [
        { offset: 0, color: 'smear', alpha: 0 },
        { offset: 0.6, color: 'smear', alpha: 0.55 },
        { offset: 1, color: 'smear', alpha: 0.9 },
      ],
    },
  },
  ink(`M${SHIP_TAIL - 4} -6.2L${SHIP_TAIL - 26} -5.4`, 0.22),
  ink(`M${SHIP_TAIL - 2} 6.3L${SHIP_TAIL - 22} 5.5`, 0.22),
  ink(`M${SHIP_TAIL - 10} 0L${SHIP_TAIL - 34} 0`, 0.16),
  ...exhaust(10.5, 2.6, 0),
  ...hull,
];

/** The laser's length in its own space: the clips stretch it (sx) to reach the target. */
export const BEAM = 10;
/**
 * The laser: a cyan beam from the muzzle at the origin along +x, BEAM long, white-hot down the middle, with a flare
 * round the muzzle. The clips turn and stretch it onto the victim.
 */
export const laser: PathShape[] = [
  inkedFill(
    blob([
      [0, -1.15, true],
      [BEAM, -1.45, true],
      [BEAM, 1.45, true],
      [0, 1.15, true],
    ]),
    'laserLo',
    LINE * 0.9,
  ),
  fill(
    blob([
      [0, -0.75, true],
      [BEAM, -1.0, true],
      [BEAM, 1.0, true],
      [0, 0.75, true],
    ]),
    'laser',
  ),
  fill(
    blob([
      [0, -0.28, true],
      [BEAM, -0.4, true],
      [BEAM, 0.4, true],
      [0, 0.28, true],
    ]),
    'laserHi',
  ),
];

/** A burst of `points` spikes between radii r0 and r1, the long ones every other spike stretched by `long`. */
function starburst(points: number, r0: number, r1: number, long: number, turn = 0): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const a = (i * Math.PI) / points - Math.PI / 2 + turn;
    const r = i % 2 ? r0 : r1 * (i % 4 === 0 ? long : 1);
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });
}

/** The laser charging at the muzzle (origin): a cyan ball with sparks, scaled up by the clips as it builds. */
export const charge: PathShape[] = [
  inkedFill(poly(starburst(6, 0.9, 1.9, 1.25, 0.2)), 'laser', LINE * 0.8),
  inkedFill(ellipse(0, 0, 1.0, 1.0), 'laserHi', LINE * 0.6),
];

/** Where the laser lands: a cyan splash at the origin. */
export const zap: PathShape[] = [
  inkedFill(poly(starburst(7, 1.4, 3.4, 1.3)), 'laser', LINE * 1.2),
  fill(poly(starburst(7, 0.8, 1.9, 1.2, 0.2)), 'laserHi'),
];

/**
 * The final blast, centred on the origin: a Flash-style explosion, a jagged orange star over a red one with a pale
 * hot core and puffs of smoke round it, about 14 units across.
 */
export const shipBlast: PathShape[] = [
  ...[0, 72, 144, 216, 288].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return inkedFill(ellipse(Math.cos(a) * 5.4, Math.sin(a) * 5.4, 2.4, 2.1), 'dust', LINE * 1.2);
  }),
  inkedFill(poly(starburst(9, 3.6, 7.2, 1.2)), 'flameLo', LINE * 1.6),
  fill(poly(starburst(9, 2.8, 5.4, 1.15, 0.17)), 'flame'),
  fill(poly(starburst(7, 1.6, 3.2, 1.1, 0.3)), 'flameHi'),
  fill(ellipse(0, 0, 1.3, 1.3), 'powHi'),
];

/** The blast going out: a loose cloud of big smoke puffs with a few embers, for the frames after the launch. */
export const shipBlastFade: PathShape[] = [
  ...(
    [
      [-3.6, 1.4, 3.0, 2.5],
      [3.4, 1.8, 2.8, 2.3],
      [0.2, -2.6, 3.4, 2.8],
      [-4.4, -2.8, 2.2, 1.9],
      [4.6, -2.2, 2.3, 2.0],
    ] as const
  ).map(([x, y, rx, ry]) => inkedFill(ellipse(x, y, rx, ry), 'dust', LINE * 1.3)),
  fill(ellipse(-0.6, -3.8, 1.5, 0.6, -12), 'dustHi'),
  ...(
    [
      [-6.4, -6.2],
      [6.8, -5.4],
      [0.8, 5.6],
      [-7.2, 3.6],
    ] as const
  ).map(([x, y]) =>
    inkedFill(
      poly(starburst(4, 0.35, 0.9, 1, 0.4).map(([u, v]) => [u + x, v + y] as const)),
      'flameHi',
      0.12,
    ),
  ),
];
