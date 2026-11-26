import type { PathShape, SymbolLoop } from '../../../render/rig/types';
import { STOMP_BOXES, WAVE, WAVE_BOXES } from '../finalSmashData';
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
function cloud(puffs: [number, number, number][], ink = 0.7): PathShape[] {
  return [
    ...puffs.map(([x, y, r]) => ({ d: circle(x, y, r + ink), fill: 'puffLine' })),
    ...puffs.map(([x, y, r]) => ({ d: circle(x, y, r), fill: 'puff' })),
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

/** The slam's hitboxes as circles in the burst's drawing (y down, from his feet), back to front. */
const SLAM_CIRCLES = STOMP_BOXES.map((b) => [b.x, -b.y, b.radius] as const).sort((a, b) => a[0] - b[0]);

/**
 * The slam's dome: the outline of its three circles, each shrunk by `inset` so whatever is drawn on that outline
 * stays `inset` inside them. A bubble of force from 7 behind his feet to 75 in front and 50 up, resting on the floor
 * where the circles touch it.
 */
function dome(inset: number): string {
  const circles = SLAM_CIRCLES.map(([x, y, r]) => [x, y, r - inset] as const);
  const [mx, my] = [(circles[0]![0] + circles.at(-1)![0]) / 2, circles[0]![1]];
  const inside = (x: number, y: number, skip: number) =>
    circles.some(([cx, cy, r], i) => i !== skip && Math.hypot(x - cx, y - cy) < r - 1e-9);
  const pts: P[] = circles.flatMap(([cx, cy, r], i) =>
    Array.from({ length: 96 }, (_, k): P => [
      cx + r * cos((k * PI) / 48),
      cy + r * sin((k * PI) / 48),
    ]).filter(([x, y]) => !inside(x, y, i)),
  );
  // Where neighbouring circles cross, so the outline turns its corners on them rather than cutting across.
  for (let i = 1; i < circles.length; i++) {
    const [ax, ay, r] = circles[i - 1]!;
    const [bx] = circles[i]!;
    const h = Math.sqrt(r * r - ((bx - ax) / 2) ** 2);
    pts.push([(ax + bx) / 2, ay - h], [(ax + bx) / 2, ay + h]);
  }
  const around = ([x, y]: P) => Math.atan2(y - my, x - mx);
  return poly(pts.sort((a, b) => around(a) - around(b)).map(([x, y]) => [n(x), n(y)]));
}

/**
 * The dome filled with a flash, brightest in its middle and fading towards the rim, `a` its opacity, so the Duck at
 * its back edge stays clear.
 */
function flash(inset: number, a: number): PathShape {
  return {
    d: dome(inset),
    fill: {
      type: 'radial',
      cx: 38,
      cy: -18,
      r: 44,
      stops: [
        { offset: 0, color: 'glowCore', alpha: a * 0.85 },
        { offset: 0.45, color: 'star', alpha: a * 0.55 },
        { offset: 1, color: 'glow', alpha: a * 0.08 },
      ],
    },
  };
}

/** The dome's rim as a ring of ink `w` thick, kept inside the circles. */
const rim = (inset: number, w: number): PathShape => ({
  d: dome(inset),
  stroke: { color: 'line', width: w },
});

/**
 * Bolts crackling out across the dome from where the back circle meets the floor (18, -5): [angle, length] each (deg,
 * y down, -90 straight up), fanned forwards and kept inside the circles.
 */
const bolts = (spokes: [number, number][], w: number) =>
  spokes.map(([a, len], i) => bolt([18, -5], a, len, w, i % 2 ? 1 : -1));

/**
 * Dust rolling out along the floor under the dome, risen by `rise` and grown by `g`: a cloud of three puffs over each
 * place a circle meets the floor, and a smaller one, a little higher, between them.
 */
function dust(rise: number, g: number): PathShape[] {
  const at: [number, number, number][] = [
    [18, 3.6, 2.6],
    [26, 5.2, 2.2],
    [34, 3.6, 2.6],
    [42, 5.2, 2.2],
    [50, 3.6, 2.6],
  ];
  return cloud(
    at.flatMap(([x, h, size]): [number, number, number][] => {
      const r = size * g;
      return [
        [x - r * 0.8, -h - rise + r * 0.2, r * 0.7],
        [x, -h - rise, r],
        [x + r * 0.8, -h - rise + r * 0.25, r * 0.65],
      ];
    }),
  );
}

/**
 * The burst, drawn for the entity's 23 frames as six drawings (the first for three frames, the rest for four): the
 * flash fills the slam's dome with paralysing bolts on its five active frames, then its rim spreads out to the
 * circles' edge and fades while dust rolls out along the floor and settles. Every drawing stays inside the circles
 * (index.test.ts).
 */
const bursts: PathShape[][] = [
  [
    flash(2.4, 0.9),
    rim(2.4, 1.2),
    ...bolts(
      [
        [-92, 34],
        [-70, 38],
        [-48, 40],
        [-28, 42],
        [-12, 40],
      ],
      1.8,
    ),
  ],
  [
    flash(1.4, 0.65),
    rim(1.4, 1),
    ...bolts(
      [
        [-82, 36],
        [-58, 40],
        [-36, 42],
        [-18, 42],
      ],
      1.6,
    ),
    ...dust(0, 0.8),
  ],
  [
    flash(0.9, 0.32),
    rim(0.9, 0.7),
    ...bolts(
      [
        [-74, 30],
        [-44, 34],
        [-22, 36],
      ],
      1.2,
    ),
    ...dust(1.5, 1),
  ],
  [rim(0.6, 0.4), ...dust(3, 1.2)],
  [...dust(4.5, 1.1)],
  [...dust(6, 0.75)],
];

export const burstSymbols: Record<string, PathShape[]> = Object.fromEntries(
  bursts.map((shapes, i) => [`fxBurst${i}`, shapes]),
);
/** Plays once over the burst's life (STOMP.lifetime, 23 frames): six drawings at 15 a second. */
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

/** The shockwave's hitboxes as circles in its drawing (y down, centre at the origin, floor WAVE.radius below). */
const WAVE_CIRCLES = WAVE_BOXES.map((b) => [b.x, WAVE.radius - b.y, b.radius] as const);

/**
 * How far forward the hitboxes reach at drawing height `y` (y down), each shrunk by `inset` first, so a point on that
 * edge is at least `inset` inside them: the front edge the shockwave is drawn to.
 */
function frontAt(y: number, inset = 0): number {
  return Math.max(
    ...WAVE_CIRCLES.map(([cx, cy, r]) =>
      Math.abs(y - cy) < r - inset ? cx + Math.sqrt((r - inset) ** 2 - (y - cy) ** 2) : -Infinity,
    ),
  );
}

/**
 * The shockwave at world scale around its centre (y down, the floor WAVE.radius below it), drawn inside its
 * hitboxes so nobody sees it reach them before it hits: a wall of dust over the boxes, tall over the middle where
 * the 35% boxes reach 48 up and nosing forwards over the 45% box, with a band of shock along the boxes' own front
 * edge (frontAt) and clods of earth flung up inside. `j` churns the puffs and the clods for the three drawings;
 * `g` below 1 draws the wall still rising, shrunk towards the floor under its middle.
 */
function waveDrawing(j: number, g = 1): PathShape[] {
  const f = WAVE.radius;
  const w = (i: number) => sin(rad(j * 120 + i * 67)) * 0.6;
  /** Puffs as (x, height above the floor, radius): every one with its ink ring inside the boxes (index.test.ts). */
  const puffs: [number, number, number][] = [
    [-27, 7, 3.8],
    [-18, 9, 6.5],
    [-8, 11, 8.5],
    [5, 10, 9],
    [-12, 26, 8.5],
    [-1, 34, 8.5],
    [9, 27, 10],
    [15, 13, 7.5],
    [17, 33, 6.5],
    [21, 22, 5.2],
    [26, 13, 6],
  ];
  // The wall rising: everything shrunk towards (PIVOT, the floor) while g < 1.
  const PIVOT = 5;
  const at = (x: number, y: number): P => [PIVOT + (x - PIVOT) * g, f + (y - f) * g];
  const churned = puffs.map(([x, h, r], i): [number, number, number] => {
    const [px, py] = at(x + w(i), f - h + w(i + 3));
    return [px, py, (r + w(i + 5) * 0.5) * g];
  });
  // The shock: a band along the boxes' front edge from the 45% box's foot, 2.8 up, to 40 up, its outer edge 0.6
  // inside the boxes so its ink stays in them, swelling to 5 thick in the middle; drawn behind the dust so only its rim
  // shows. While rising it starts higher, so shrinking it towards the floor keeps its foot inside the 45% box.
  const steps = 18;
  const foot = 2.8 + (1 - g) * 6;
  const ys = Array.from({ length: steps + 1 }, (_, i) => f - foot - (i / steps) * (40 - foot));
  const outer = ys.map((y): P => [frontAt(y, 0.6), y]);
  const inner = ys.map((y, i): P => [frontAt(y, 0.6) - 5 * Math.sin((PI * i) / steps), y]);
  const shock = [...outer, ...inner.reverse()].map(([x, y]) => at(x, y));
  return [
    { d: poly(shock), fill: 'star', stroke: { color: 'line', width: 0.8 } },
    ...shadedCloud(churned, 0.9),
    ...(g === 1
      ? [
          clod(-4 + j * 2, f - 41 + j, 1.4, j * 50),
          clod(11 - j, f - 40 + j * 2, 1.1, 40 + j * 70),
          clod(-16 + j * 1.5, f - 31 - j, 1.2, 90 + j * 45),
          clod(21 + j, f - 26 - j, 0.9, 20 + j * 60),
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
 * The shockwave over its life at 15 drawings a second: the wall rises out of the floor over its first frames, as it
 * pulls away from the Duck's feet, then churns through three drawings. A prop's loop counts from age 1, so its ages
 * 1 to WAVE.lifetime (64) reach drawing floor(64 / 4) = 16: the loop has 17, and never wraps back to the first.
 */
export const fxWave: SymbolLoop = {
  loop: [
    'fxWaveRise0',
    'fxWaveRise1',
    ...Array.from({ length: Math.floor(WAVE.lifetime / 4) + 1 - 2 }, (_, i) => `fxWave${i % 3}`),
  ],
  fps: 15,
};
