import { transformPath } from '../../../render/rig/geometry';
import type { PathShape } from '../../../render/rig/types';
import { BLAST } from '../fullArsenalData';
import { grenade } from './parts';
import { arcPoints, ellipse, inflate, place, poly, smooth, star, strokes, turn, type P } from './shapes';

/**
 * Full Arsenal's drawings (the kids' Final Smash, fullArsenalData.ts), in the same Flash look as the rest of the kids:
 * flat fills on a dark ink underlay, one shade, one highlight. The crosshair, the marks it leaves on foes, the
 * brother's spyglass, the rocket they lob and the big burst where each shot comes down. Unit size is a game unit.
 */

const LINE = 0.26;
const INK = 0.15;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
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
const rounded = (pts: P[]): P[] => pts.map(([x, y]) => [r3(x), r3(y)]);

// ---------------------------------------------------------------------------------------------------------
// The crosshair: a red ring with four ticks and a dot, the way the kids' own aim marker would look on a toy
// launcher. It turns a third of a quarter turn each drawing while it hunts (fxReticle).

const RING = 4;
/** A ring band from radius r0 to r1 as one even-odd shape. */
const band = (r0: number, r1: number) => ellipse(0, 0, r1) + ellipse(0, 0, r0);

function sight(deg: number): PathShape[] {
  const ticks = [0, 90, 180, 270].map((a) => a + deg);
  const tick = (a: number, r0: number, r1: number, w: number, color: string) => {
    const t = (a * Math.PI) / 180;
    return strokes(
      [
        [r3(Math.cos(t) * r0), r3(Math.sin(t) * r0)],
        [r3(Math.cos(t) * r1), r3(Math.sin(t) * r1)],
      ],
      w,
      color,
    );
  };
  return [
    fill(band(RING - 0.85, RING + 0.45), 'line'),
    ...ticks.flatMap((a) => tick(a, RING * 0.35, RING * 1.45, 0.62, 'line')),
    fill(band(RING - 0.55, RING + 0.15), 'aim'),
    fill(band(RING - 0.55, RING - 0.32), 'aimHi'),
    ...ticks.flatMap((a) => tick(a, RING * 0.42, RING * 1.38, 0.3, 'aim')),
    inked(ellipse(0, 0, 0.42), 'aim', INK),
  ];
}
export const reticleSymbols = {
  fxReticleA: sight(0),
  fxReticleB: sight(30),
  fxReticleC: sight(60),
};

// ---------------------------------------------------------------------------------------------------------
// A mark on a locked foe: four red corner brackets round the middle of the body, squeezing in and out (fxLock).

function brackets(w: number, h: number): PathShape[] {
  const arm = 1.6;
  const corner = (sx: number, sy: number): P[] => [
    [sx * (w - arm), sy * h],
    [sx * w, sy * h],
    [sx * w, sy * (h - arm)],
  ];
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => corner(sx!, sy!));
  return [
    ...corners.flatMap((c) => strokes(c, 0.7, 'line')),
    ...corners.flatMap((c) => strokes(c, 0.38, 'aim')),
    inked(
      poly([
        [0, -h - 2.2],
        [0.75, -h - 1.2],
        [0, -h - 0.2],
        [-0.75, -h - 1.2],
      ]),
      'aim',
      INK,
    ),
  ];
}
export const lockSymbols = { fxLockA: brackets(5.2, 7.6), fxLockB: brackets(4.6, 6.9) };

// ---------------------------------------------------------------------------------------------------------
// The brother's spyglass, in its own space: the eyepiece at the origin, the lens end along +x. A brass toy
// telescope pulled out in three sections.

const sections: [number, number, number][] = [
  [0, 0.95, 0.24],
  [0.85, 1.85, 0.3],
  [1.75, 2.75, 0.37],
];
const tubeShape = (x0: number, x1: number, r: number): P[] => [
  [x0, -r, 0],
  [x1, -r, 0],
  [x1, r, 0],
  [x0, r, 0],
];
export const spyglass: PathShape[] = [
  ...sections.map(([x0, x1, r]) => fill(poly(inflate(tubeShape(x0, x1, r), LINE * 0.8)), 'line')),
  ...sections.flatMap(([x0, x1, r]) => [
    fill(poly(tubeShape(x0, x1, r)), 'brass'),
    fill(poly(tubeShape(x0, x1, r).map(([x, y]) => [x, y > 0 ? y : r * 0.25] as P)), 'brassLo'),
    fill(poly(tubeShape(x0 + 0.08, x1 - 0.08, r * 0.3).map(([x, y]) => [x, y - r * 0.5] as P)), 'brassHi'),
  ]),
  inked(ellipse(2.78, 0, 0.16, 0.36), 'lens', INK * 0.8),
];

// ---------------------------------------------------------------------------------------------------------
// The rocket they lob, flying along +x: a toy rocket like the one the brother rides, lying on its side, its
// flame flickering behind it (volleyRocket). The nose is at +x, the nozzle at x -2.6.

const BODY = 0.8;
const TAIL = -2.6;
const NOSE = 3.4;
function flyingRocket(flame: number): PathShape[] {
  const fins = (s: number): P[] => [
    [TAIL + 1.9, s * BODY, 0],
    [TAIL + 0.2, s * 1.85],
    [TAIL - 0.35, s * 1.8, 0],
    [TAIL + 0.35, s * BODY, 0],
  ];
  const tube: P[] = [
    [TAIL + 0.3, -BODY, 0],
    [NOSE - 1.2, -BODY, 0],
    [NOSE - 0.45, -0.65],
    [NOSE, 0, 0],
    [NOSE - 0.45, 0.65],
    [NOSE - 1.2, BODY, 0],
    [TAIL + 0.3, BODY, 0],
  ];
  const fire: P[] = [
    [TAIL, -0.7 * flame, 0],
    [TAIL - 1.6 * flame, -0.5],
    [TAIL - 3.0 * flame, 0, 0],
    [TAIL - 1.6 * flame, 0.5],
    [TAIL, 0.7 * flame, 0],
  ];
  return [
    fill(smooth(fire), 'flame'),
    fill(
      smooth(
        place(
          fire.map(([x, y]) => [x, y] as P),
          TAIL * 0.42,
          0,
          0.58,
          0.55,
        ),
      ),
      'flameCore',
    ),
    ...solid(fins(-1), 'rocketTrim'),
    ...solid(fins(1), 'rocketTrim'),
    ...solid(
      [
        [TAIL - 0.05, -0.55, 0],
        [TAIL + 0.45, -0.55, 0],
        [TAIL + 0.45, 0.55, 0],
        [TAIL - 0.05, 0.55, 0],
      ],
      'nozzle',
    ),
    ...solid(tube, 'rocket'),
    fill(
      smooth([
        [NOSE - 1.2, -BODY, 0],
        [NOSE - 0.45, -0.65],
        [NOSE, 0, 0],
        [NOSE - 0.45, 0.65],
        [NOSE - 1.2, BODY, 0],
      ]),
      'rocketTrim',
    ),
    ...[-0.9, 0.7].map((x) =>
      fill(
        poly([
          [x, -BODY],
          [x + 0.5, -BODY],
          [x + 1.2, BODY],
          [x + 0.7, BODY],
        ]),
        'rocketTrim',
      ),
    ),
    fill(
      poly([
        [TAIL + 0.3, 0.3],
        [NOSE - 1.2, 0.3],
        [NOSE - 1.2, BODY],
        [TAIL + 0.3, BODY],
      ]),
      'rocketLo',
    ),
    fill(ellipse(0.3, -0.42, 1.5, 0.14), 'rocketHi'),
  ];
}
export const rocketSymbols = {
  volleyRocketA: flyingRocket(1),
  volleyRocketB: flyingRocket(0.75),
};

/** The grenade tumbling end over end: the side special's own grenade turned a quarter turn each drawing. */
const spin = (deg: number): PathShape[] => grenade.map((s) => ({ ...s, d: turnPath(s.d, deg) }));
export const grenadeSpin = {
  volleyGrenadeA: spin(0),
  volleyGrenadeB: spin(90),
  volleyGrenadeC: spin(180),
  volleyGrenadeD: spin(270),
};

/** Turns a path about the origin, clockwise on screen. */
function turnPath(d: string, deg: number): string {
  const t = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(t), Math.sin(t)];
  return transformPath(d, { a: c, b: s, c: -s, d: c, tx: 0, ty: 0 });
}

// ---------------------------------------------------------------------------------------------------------
// The burst where a shot comes down: Covering Fire's missile blast, radius 23, drawn at world scale. A white
// flash, then the orange boom with its yellow core and a ring of smoke puffs, then the smoke rolling out and
// thinning. Four drawings over the burst's 20 frames (fxBlast, 12 fps).

const R = BLAST.radius;
/** Puffs round the boom: angle, distance and size as fractions of the blast radius. */
const PUFFS: [number, number, number][] = [
  [-80, 0.62, 0.3],
  [-35, 0.7, 0.26],
  [10, 0.66, 0.3],
  [55, 0.72, 0.25],
  [100, 0.64, 0.28],
  [145, 0.7, 0.27],
  [190, 0.66, 0.3],
  [235, 0.7, 0.26],
];
function puffs(grow: number, keep = 1): PathShape[] {
  return PUFFS.filter((_, i) => i % Math.round(1 / keep) === 0).map(([a, d, s]) => {
    const [[x, y]] = arcPoints(0, 0, R * d * grow, R * d * grow, a, a, 1) as [[number, number]];
    return inked(ellipse(r3(x), r3(y), r3(R * s * (0.7 + 0.3 * grow))), 'puff', INK * 3);
  });
}
const boom = (r: number, ri: number, deg: number): string => star(0, 0, r, ri, 11, deg);
export const blastSymbols = {
  fxBlastA: [
    inked(boom(R * 0.62, R * 0.38, -80), 'flame', INK * 4),
    fill(boom(R * 0.45, R * 0.26, -64), 'flameCore'),
    fill(ellipse(0, 0, R * 0.26), 'spark'),
  ],
  fxBlastB: [
    ...puffs(0.85),
    inked(boom(R * 0.98, R * 0.6, -86), 'flame', INK * 4),
    fill(boom(R * 0.66, R * 0.4, -70), 'flameCore'),
    fill(ellipse(0, 0, R * 0.22), 'spark'),
  ],
  fxBlastC: [
    ...puffs(1.05),
    inked(smooth(rounded(turn(starPoints(R * 0.7, R * 0.5, 9), 12))), 'flame', INK * 4),
    fill(smooth(rounded(turn(starPoints(R * 0.42, R * 0.3, 9), 30))), 'flameCore'),
  ],
  fxBlastD: [...puffs(1.2, 0.5), inked(ellipse(0, 0, R * 0.3), 'puff', INK * 3)],
};
/** Points of a soft star, for smoothing into a rolling fireball. */
function starPoints(r: number, ri: number, count: number): P[] {
  return Array.from({ length: count * 2 }, (_, i): P => {
    const a = (i * Math.PI) / count;
    const rr = i % 2 ? ri : r;
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });
}
