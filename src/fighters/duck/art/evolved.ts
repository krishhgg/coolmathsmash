import type { PathShape, SymbolLoop } from '../../../render/rig/types';
import { STOMP, WAVE } from '../finalSmash';
import { BODY_R, HEAD_R, LINE, blob, circle, place, poly } from './parts';

/**
 * Evolved Stomp's drawings (src/fighters/duck/finalSmash.ts), by hand in Duck Life's Flash style: flat colours under
 * one heavy black ink line. The evolved Duck is his own rig grown three times taller, with two parts the duckling
 * lacks: a grown duck's plume of head feathers and an upturned tail. The two stomps' effects are drawn at world scale
 * as the entities' props: the burst over the slam's area, and the shockwave as a wall of dust as big as its hitboxes.
 */

type P = readonly [number, number];
const { cos, sin, PI } = Math;
const rad = (deg: number) => (deg * PI) / 180;
const n = (v: number) => Math.round(v * 1000) / 1000;

/**
 * One soft feather rooted `root` units out from a bone's origin at angle `deg` (y down, clockwise), `len` long and
 * swept `sweep` degrees further round as it grows, its root tucked under the head or belly it grows from.
 */
function plumeFeather(root: number, deg: number, len: number, sweep: number, width = 0.62): PathShape {
  const pts: P[] = [
    [0, -width * 0.8],
    [len * 0.45, -width],
    [len * 0.82, -width * 0.55],
    [len, 0.1],
    [len * 0.8, width * 0.55],
    [len * 0.4, width * 0.85],
    [0, width * 0.8],
  ];
  // Bend the feather along its length: each point turns by up to `sweep` degrees about the root.
  const bent = pts.map(([x, y]): P => {
    const a = rad(sweep * (x / len) ** 1.5);
    return [x * cos(a) - y * sin(a), x * sin(a) + y * cos(a)];
  });
  const [bx, by] = [root * cos(rad(deg)), root * sin(rad(deg))];
  return { d: blob(place(bent, deg, bx, by)), fill: 'body', stroke: { color: 'line', width: LINE * 0.8 } };
}

/** The plume: three feathers rising from the top and back of the head, swept back (head bone, behind its outline). */
export const plume: PathShape[] = [
  plumeFeather(HEAD_R - 0.5, -100, 2.1, -50, 0.62),
  plumeFeather(HEAD_R - 0.5, -122, 2.5, -46, 0.66),
  plumeFeather(HEAD_R - 0.5, -144, 1.9, -40, 0.56),
];

/** The tail: two pointed feathers turned up off the back of the belly (body bone, behind its outline). */
export const tail: PathShape[] = [
  plumeFeather(BODY_R - 0.6, 198, 1.9, 34, 0.62),
  plumeFeather(BODY_R - 0.6, 220, 2.3, 30, 0.6),
];

/** A cloud of dust puffs (x, y, r): inked rings first, then the fills, so the puffs merge into one cloud. */
function cloud(puffs: [number, number, number][], ink = 0.7, fill = 'puff', line = 'puffLine'): PathShape[] {
  return [
    ...puffs.map(([x, y, r]) => ({ d: circle(x, y, r + ink), fill: line })),
    ...puffs.map(([x, y, r]) => ({ d: circle(x, y, r), fill })),
  ];
}

/**
 * A lightning bolt from `from` heading `deg` (y down), `len` long: a band `w` wide that kinks sideways three times and
 * ends in a point, filled star yellow under an ink edge, for the slam's paralysis. `kink` flips which way it jags.
 */
function bolt(from: P, deg: number, len: number, w: number, kink = 1): PathShape {
  const spine: P[] = [
    [0, 0],
    [len * 0.3, kink * len * 0.12],
    [len * 0.5, -kink * len * 0.04],
    [len * 0.75, kink * len * 0.1],
    [len, 0],
  ];
  const width = (i: number) => w * (1 - i / 5);
  const top = spine.slice(0, -1).map(([x, y], i): P => [x, y - width(i)]);
  const bottom = spine.slice(0, -1).map(([x, y], i): P => [x + w * 0.5, y + width(i)]);
  const pts = [...top, spine.at(-1)!, ...bottom.reverse()];
  return { d: poly(place(pts, deg, from[0], from[1])), fill: 'star', stroke: { color: 'line', width: 0.5 } };
}

/** The slam's dome over its area, from 7 behind his feet to 75 in front and 50 up, at `s` of its size. */
function dome(s: number): string {
  const cx = (STOMP.from + STOMP.to) / 2;
  const rx = ((STOMP.to - STOMP.from) / 2 + STOMP.radius) * s;
  const ry = (STOMP.y + STOMP.radius) * s;
  const pts: P[] = Array.from({ length: 25 }, (_, i): P => {
    const a = PI + (i / 24) * PI;
    return [cx + rx * cos(a), ry * sin(a)];
  });
  return poly(pts.map(([x, y]) => [n(x), n(y)]));
}

/** The dome filled with a flash, brightest at the stomp point and fading towards the rim, `a` its opacity. */
function flash(s: number, a: number): PathShape {
  return {
    d: dome(s),
    fill: {
      type: 'radial',
      cx: 6,
      cy: 0,
      r: 78 * s,
      stops: [
        { offset: 0, color: 'glowCore', alpha: a },
        { offset: 0.35, color: 'star', alpha: a * 0.75 },
        { offset: 1, color: 'glow', alpha: a * 0.1 },
      ],
    },
  };
}

/** The dome's rim as a ring of ink, `w` thick. */
const rim = (s: number, w: number): PathShape => ({ d: dome(s), stroke: { color: 'line', width: w } });

/** Bolts crackling out from the stomp point (5, -2) across the dome: [angle, length] each (deg, y down). */
const bolts = (spokes: [number, number][], w: number) =>
  spokes.map(([a, len], i) => bolt([5, -2], a, len, w, i % 2 ? 1 : -1));

/** Dust rolling out along the floor under the dome, risen by `rise` and grown by `g`: three puffs to a cloud. */
function dust(rise: number, g: number): PathShape[] {
  const at = [-4, 12, 30, 48, 64];
  return cloud(
    at.flatMap((x, i): [number, number, number][] => {
      const r = (3.4 - Math.abs(i - 2) * 0.35) * g;
      return [
        [x - r * 0.7, -r * 0.5 - rise, r * 0.75],
        [x, -r * 0.8 - rise, r],
        [x + r * 0.75, -r * 0.45 - rise, r * 0.7],
      ];
    }),
  );
}

/**
 * The burst, drawn for the entity's 24 frames as six drawings of four frames each: the flash fills the slam's dome
 * with paralysing bolts on its five active frames, then its rim spreads and fades while dust rolls out along the
 * floor and settles.
 */
const bursts: PathShape[][] = [
  [
    flash(0.92, 0.9),
    rim(0.92, 1.2),
    ...bolts(
      [
        [-160, 22],
        [-120, 30],
        [-88, 34],
        [-58, 40],
        [-32, 46],
        [-10, 52],
      ],
      1.8,
    ),
  ],
  [
    flash(1, 0.65),
    rim(1, 1),
    ...bolts(
      [
        [-140, 28],
        [-100, 36],
        [-70, 42],
        [-44, 48],
        [-20, 56],
      ],
      1.6,
    ),
    ...dust(0, 0.8),
  ],
  [
    flash(1.04, 0.32),
    rim(1.04, 0.7),
    ...bolts(
      [
        [-112, 26],
        [-62, 34],
        [-26, 40],
      ],
      1.2,
    ),
    ...dust(1.5, 1),
  ],
  [rim(1.07, 0.4), ...dust(3, 1.2)],
  [...dust(4.5, 1.1)],
  [...dust(6, 0.75)],
];

export const burstSymbols: Record<string, PathShape[]> = Object.fromEntries(
  bursts.map((shapes, i) => [`fxBurst${i}`, shapes]),
);
/** Plays once over the burst's life (STOMP.lifetime): six drawings at 15 a second. */
export const fxBurst: SymbolLoop = { loop: bursts.map((_, i) => `fxBurst${i}`), fps: 15 };

/**
 * A two-tone cloud as the game's launch smoke draws it: grey ink rings, a grey body, and a white lobe on each puff
 * lifted up and back, so the lower front edges stay shaded.
 */
function shadedCloud(puffs: [number, number, number][], ink: number): PathShape[] {
  return [
    ...puffs.map(([x, y, r]) => ({ d: circle(x, y, r + ink), fill: 'puffLine' })),
    ...puffs.map(([x, y, r]) => ({ d: circle(x, y, r), fill: 'puffShade' })),
    ...puffs.map(([x, y, r]) => ({ d: circle(x - r * 0.12, y - r * 0.14, r * 0.84), fill: 'puff' })),
  ];
}

/** A clod of earth thrown up by the shockwave: a rough lump `r` across, turned `deg`. */
function clod(x: number, y: number, r: number, deg: number): PathShape {
  const lump: P[] = [
    [-1, -0.5],
    [-0.2, -1],
    [0.9, -0.6],
    [1, 0.4],
    [0.1, 0.9],
    [-0.8, 0.6],
  ];
  return { d: poly(place(lump, deg, x, y, r)), fill: 'rock', stroke: { color: 'line', width: 0.45 } };
}

/**
 * The shockwave at world scale around its centre (y down, the floor WAVE.radius below it): a wall of dust as big as
 * its hitboxes, tall over the middle where the 35% boxes reach 48 up and low in front over the 45% box, with a band
 * of shock bowed round its leading edge, clods of earth flung up and speed lines trailing off behind. `j` churns the
 * puffs and the clods for the three drawings; `g` below 1 draws the wall still rising out of the floor at its front.
 */
function waveDrawing(j: number, g = 1): PathShape[] {
  const f = WAVE.radius;
  const w = (i: number) => sin(rad(j * 120 + i * 67)) * 0.9;
  const puffs: [number, number, number][] = [
    [-34, f - 3, 3.5],
    [-27, f - 6, 5.5],
    [-17, f - 9, 8.5],
    [-20, f - 22, 7.5],
    [-8, f - 16, 11],
    [-9, f - 33, 9],
    [3, f - 38, 8],
    [6, f - 25, 10.5],
    [14, f - 12, 10],
    [16, f - 31, 7],
    [21, f - 20, 7],
    [24, f - 9, 8.5],
    [30, f - 4.5, 5],
  ];
  // Churned a little, and while rising squeezed down towards the floor at the front.
  const churned = puffs.map(([x, y, r], i): [number, number, number] => [
    32 - (32 - x - w(i)) * g,
    f - (f - y - w(i + 3)) * g,
    (r + w(i + 5) * 0.6) * g,
  ]);
  // The shock: a crescent round the wall's front, from high on it down to the floor ahead, drawn behind the dust so
  // only its outer edge shows, bowed round the wall like a rim of light.
  const arcPts = (cx: number, r: number, from: number, to: number): P[] =>
    Array.from({ length: 9 }, (_, i): P => {
      const a = rad(from + ((to - from) * i) / 8);
      return [cx + r * cos(a), f + r * sin(a) * g];
    });
  const shock: P[] = [...arcPts(5.5, 34.5, -64, 0), ...arcPts(2, 26, 0, -62)];
  const streak = (y: number, x0: number, x1: number): PathShape => ({
    d: poly([
      [x0, y - 0.5],
      [x1, y - 0.3],
      [x1, y + 0.3],
      [x0, y + 0.5],
    ]),
    fill: 'swoosh',
  });
  const full = g === 1;
  return [
    ...(full
      ? [streak(f - 40 + j, -50, -28), streak(f - 26 - j, -54, -36), streak(f - 12 + j, -50, -38)]
      : []),
    { d: poly(shock), fill: 'star', stroke: { color: 'line', width: 0.8 } },
    ...shadedCloud(churned, 0.9),
    ...(full
      ? [
          clod(-4 + j * 2, f - 44 + j * 2, 1.6, j * 50),
          clod(12 - j, f - 42 + j * 3, 1.2, 40 + j * 70),
          clod(-22 + j * 1.5, f - 33 - j, 1.3, 90 + j * 45),
          clod(22 + j, f - 24 - j * 2, 1.0, 20 + j * 60),
        ]
      : []),
  ];
}

export const waveSymbols: Record<string, PathShape[]> = {
  fxWaveRise0: waveDrawing(0, 0.4),
  fxWaveRise1: waveDrawing(1, 0.7),
  fxWave0: waveDrawing(0),
  fxWave1: waveDrawing(1),
  fxWave2: waveDrawing(2),
};
/**
 * The shockwave over its life at 15 drawings a second (four frames each): the wall rises out of the floor over its
 * first eight frames, as it pulls away from the Duck's feet, then churns through three drawings. WAVE.lifetime is
 * sixteen drawings, so it plays once.
 */
export const fxWave: SymbolLoop = {
  loop: [
    'fxWaveRise0',
    'fxWaveRise1',
    ...Array.from({ length: WAVE.lifetime / 4 - 2 }, (_, i) => `fxWave${i % 3}`),
  ],
  fps: 15,
};
