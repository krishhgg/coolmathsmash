import type { Paint, PathShape } from '../../../render/rig/types';
import {
  LINE,
  arc,
  blob,
  capsule,
  ellipse,
  ink,
  inkedFill,
  n,
  part,
  poly,
  type Part,
  type Pt,
} from './shapes';

/**
 * Snail Bob, drawn from scratch in the Snail Bob games' Flash look: flat fills with one soft gradient on the shell,
 * a glossy highlight and a thick dark outline. Each part is drawn in its own bone's space (y down, facing right).
 */

const fill = (d: string, paint: Paint): PathShape => ({ d, fill: paint });

/* ---------------------------------------------------------------- shell (shell bone: the shell's centre) */

const SHELL = blob([
  [-0.7, -4.9],
  [1.9, -4.35],
  [3.6, -2.5],
  [4.15, 0.4],
  [3.55, 3.45],
  [0.3, 4.2],
  [-3.2, 3.95],
  [-4.6, 1.7],
  [-4.55, -1.5],
  [-3.15, -3.95],
]);

const shellPaint: Paint = {
  type: 'radial',
  cx: 1.4,
  cy: -2.8,
  r: 7.8,
  stops: [
    { offset: 0, color: 'shellHi' },
    { offset: 0.45, color: 'shell' },
    { offset: 1, color: 'shellLo' },
  ],
};

/** The shell dome: a tall rounded cap, flatter where it rests on the body, shaded darker at the back. */
export const shell: PathShape[] = [inkedFill(SHELL, shellPaint, LINE * 2.2)];

/** The glossy highlight, on its own slot so spins can hide it. */
export const gloss: PathShape[] = [
  fill(ellipse(1.75, -3.1, 1.4, 0.5, 30), 'gloss'),
  fill(ellipse(3.2, -1.7, 0.3, 0.24, 60), 'gloss'),
];

/**
 * The spiral: one broad band (about 1.6 turns) that widens as it winds out from the centre at the origin to its
 * outer end at angle `end` (degrees, 90 = down), as on the games' shells, with lighter segment ticks across it.
 */
function spiralBand(r0: number, r1: number, w0: number, w1: number, turns: number, end: number): PathShape[] {
  const total = turns * Math.PI * 2;
  const steps = 56;
  const at = (i: number, side: number): Pt => {
    const t = i / steps;
    const a = (end * Math.PI) / 180 + total * (1 - t);
    const r = r0 + (r1 - r0) * t + side * (w0 + (w1 - w0) * t) * 0.5;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const idx = Array.from({ length: steps + 1 }, (_, i) => i);
  const band = poly([...idx.map((i) => at(i, 1)), ...[...idx].reverse().map((i) => at(i, -1))]);
  const ticks = idx
    .filter((i) => i > 14 && i % 6 === 0 && i < steps)
    .map((i) => {
      const [ox, oy] = at(i, 0.55);
      const [ix, iy] = at(i, -0.55);
      return `M${ox.toFixed(3)} ${oy.toFixed(3)}L${ix.toFixed(3)} ${iy.toFixed(3)}`;
    })
    .join('');
  return [inkedFill(band, 'spiral', LINE * 1.4), { d: ticks, stroke: { color: 'spiralHi', width: 0.1 } }];
}

/** The spiral (on the spin bone, so shell moves can spin it). */
export const spiral: PathShape[] = spiralBand(0.15, 2.75, 0.35, 1.15, 1.6, 70);

/** The lip: the wide, ridged mantle band where the shell rests on the body. */
const LIP = blob([
  [-3.8, 2.85, true],
  [-1.6, 4.15],
  [1.4, 4.4],
  [3.85, 3.75],
  [4.6, 2.3, true],
  [3.9, 1.95],
  [3.0, 2.75],
  [1.3, 3.2],
  [-1.5, 3.05],
]);
export const lip: PathShape[] = [
  inkedFill(LIP, 'lip', LINE * 1.6),
  ink(
    'M-2.6 3.3Q-2.3 3.75 -2.05 3.9M-0.6 3.35Q-0.45 3.9 -0.3 4.2M1.1 3.35Q1.2 3.9 1.3 4.3M2.7 3.05Q2.95 3.5 3.1 3.9',
    0.12,
  ),
];

/** The shell's mouth from the side, dark inside: Bob pulled in, with his eyes peeking out (or not). */
const HOLE = ellipse(2.55, 2.7, 1.8, 1.1, -26);
export const lipHole: PathShape[] = [...lip, inkedFill(HOLE, 'hole', LINE * 1.6)];
export const lipPeek: PathShape[] = [
  ...lipHole,
  inkedFill(ellipse(1.95, 2.75, 0.55, 0.62), 'eye', 0.18),
  inkedFill(ellipse(3.0, 2.35, 0.55, 0.62), 'eye', 0.18),
  fill(ellipse(2.17, 2.8, 0.24, 0.3), 'pupil'),
  fill(ellipse(3.22, 2.4, 0.24, 0.3), 'pupil'),
];

/* ---------------------------------------------------------------- body (foot bone at the feet) */

const FRONT_X = 4.35;
const TAIL_X = -5.95;
/** Height of the frill bumps under the body: the body's own underside sits this far above the ground. */
const FRILL = 1.0;

/** The slug body: front rising into the neck, tail tapering back; the shell hides its top. */
const FOOT = `${blob(
  [
    [FRONT_X, -FRILL],
    [4.8, -1.2],
    [4.1, -1.95],
    [2.0, -2.35],
    [-1.0, -2.25],
    [-3.6, -1.75],
    [-5.2, -1.05],
    [TAIL_X, -0.3, true],
  ],
  false,
)}Q-5.2 -${FRILL} -4.6 -${FRILL}L${FRONT_X} -${FRILL}Z`;

/** The lighter belly band along the underside. */
const BELLY = `M${FRONT_X} -${FRILL}L4.55 -1.12Q-0.6 -1.45 -4.9 -1.0L-4.6 -${FRILL}Z`;

/**
 * The frilly underside: a skirt of rounded, back-swept teeth hanging below the body, as on the games' Bob. A ripple
 * runs back along it (`phase` 0 to 1, one tooth-triplet per cycle), so crawls flip through the phases like cels.
 */
function skirt(phase: number): string {
  const teeth = 9;
  const x0 = 4.15;
  const x1 = -5.5;
  const w = (x0 - x1) / teeth;
  let d = `M${x0 + 0.1} ${-FRILL - 0.35}L${x0} ${-FRILL}`;
  for (let k = 0; k < teeth; k++) {
    const a = x0 - k * w;
    const wave = phase < 0 ? (k % 2 ? 0.86 : 1) : 0.8 + 0.2 * Math.cos(Math.PI * 2 * (k / 3 - phase));
    const ty = -FRILL + FRILL * Math.min(1, 0.55 + k * 0.15) * wave;
    const lean = phase < 0 ? 0 : 0.12 * Math.sin(Math.PI * 2 * (k / 3 - phase));
    d += `Q${n(a - w * 0.08)} ${n(ty)} ${n(a - w * (0.62 + lean))} ${n(ty)}Q${n(a - w * 0.86)} ${n(ty - 0.08)} ${n(a - w)} ${n(-FRILL)}`;
  }
  return `${d}L${x1 + 0.6} ${-FRILL - 0.3}Z`;
}

const footPart = (phase: number): Part => ({
  line: [inkedFill(skirt(phase), 'frill', LINE * 1.2), ...part(FOOT, []).line],
  fill: [
    fill(FOOT, 'body'),
    fill(BELLY, 'belly'),
    fill(ellipse(-4.4, -1.35, 0.36, 0.2, -15), 'spot'),
    fill(ellipse(-3.1, -1.75, 0.3, 0.18, -10), 'spot'),
    fill(ellipse(-5.3, -0.95, 0.2, 0.13), 'spot'),
    fill(
      blob([
        [-5.6, -0.95],
        [-4.2, -1.55],
        [-2.9, -1.95],
        [-4.4, -1.4],
      ]),
      'bodyHi',
    ),
  ],
});

export const foot = footPart(-1);
/** The crawl cels: the skirt's ripple a third of a cycle apart. */
export const foot1 = footPart(0);
export const foot2 = footPart(1 / 3);
export const foot3 = footPart(2 / 3);

/* ---------------------------------------------------------------- neck and head */

const NECK = capsule([0, -0.6], [0.8, -2.8], 1.2, 1.15);
/** The neck rising from the front of the body (neck bone at its base); inked along its back over the shell. */
export const neck: Part = part(NECK, [
  fill(NECK, 'body'),
  fill(ellipse(-0.2, -1.6, 0.4, 0.95, 10), 'bodyHi'),
  fill(ellipse(0.75, -1.2, 0.28, 0.18), 'spot'),
  ink('M-0.28 -3.19L-0.85 -1.75'),
]);

const HEAD = blob(
  (
    [
      [-0.2, -1.6],
      [1.25, -1.3],
      [2.0, -0.45],
      [2.25, 0.35],
      [1.8, 1.05],
      [0.6, 1.35],
      [-0.8, 1.15],
      [-1.6, 0.3],
      [-1.4, -0.95],
    ] as const
  ).map(([x, y]) => [x * 1.12, y * 1.1] as const),
);
/** The head: a round green blob with a little snout, mouth at the front (head bone at its centre). */
export const head: Part = part(HEAD, [
  fill(HEAD, 'body'),
  fill(ellipse(-0.35, -0.75, 0.72, 0.42, -20), 'bodyHi'),
  fill(ellipse(1.75, 0.2, 0.28, 0.2, 20), 'bodyLo'),
]);

/* ---------------------------------------------------------------- eyestalks and eyes */

export const STALK = 2.45;
const stalkPart = (r0: number, r1: number): Part => {
  const d = capsule([0, 0], [0, -STALK], r0, r1);
  return part(d, [
    fill(d, 'body'),
    fill(capsule([-0.18, -0.2], [-0.18, -STALK + 0.1], r0 * 0.3, r1 * 0.28), 'bodyHi'),
  ]);
};
export const stalkLow = stalkPart(0.58, 0.5);
export const stalkHigh = stalkPart(0.5, 0.48);

/** The eyes sit on the stalk tips: tall ovals drawn around (0, -EYE_Y) in the eye bone's space. */
export const EYE_Y = 1.35;
const EX = 1.3;
const EY = 1.72;
const EYE = ellipse(0, -EYE_Y, EX, EY);
/** The pink rim inside the outline all the way round, thicker at the sides, as in the games' art. */
const RIM = `${EYE}${ellipse(0.06, -EYE_Y + 0.06, EX * 0.76, EY * 0.82)}`;

export const eye: PathShape[] = [fill(EYE, 'eye'), fill(RIM, 'lid'), ink(EYE, LINE * 2)];
/** Wide open for a startle or a hit: bigger whites, thin rim. */
const WIDE = ellipse(0, -EYE_Y - 0.15, EX * 1.1, EY * 1.1);
export const eyeWide: PathShape[] = [
  fill(WIDE, 'eye'),
  fill(`${WIDE}${ellipse(0, -EYE_Y - 0.12, EX * 0.98, EY * 1.0)}`, 'lid'),
  ink(WIDE, LINE * 2),
];

/** Pupils (pupil bone, looking forward). */
export const pupil: PathShape[] = [
  fill(ellipse(0, 0, 0.56, 0.74), 'pupil'),
  fill(ellipse(-0.18, -0.3, 0.2, 0.2), 'eye'),
];
export const pupilSmall: PathShape[] = [fill(ellipse(0, 0, 0.3, 0.36), 'pupil')];

/** A small dark brow floating above the eye: `tilt` > 0 drops its front end (determined), `lift` raises it. */
const brow = (tilt: number, lift = 0, curve = 0.3): PathShape =>
  ink(
    `M${-EX * 0.75} ${-EYE_Y - EY - 0.35 - lift - tilt * 0.5}Q0 ${-EYE_Y - EY - 0.35 - lift - curve} ${EX * 0.75} ${-EYE_Y - EY - 0.35 - lift + tilt * 0.5}`,
    0.34,
  );

/** The eyelid as a band hanging from the eye's top edge down to a straight edge from (back, yb) to (front, yf). */
function lidShape(yb: number, yf: number, extra: PathShape[] = []): PathShape[] {
  const edge = (x: number) => -EYE_Y + yb + ((yf - yb) * (x + EX)) / (2 * EX);
  const d = poly(arc(0, -EYE_Y, EX, EY, 180, 360, 48).filter(([x, y]) => y <= edge(x)));
  return [fill(d, 'lid'), ...extra, ink(blob(arc(0, -EYE_Y, EX, EY, 180, 360, 12), false), LINE * 2)];
}

/** Normal: just the brows. */
export const lid: PathShape[] = [brow(0)];
/** Determined: the lid drops towards the face in a straight, inked edge, the brow slanting with it. */
export const lidAngry: PathShape[] = lidShape(-0.95, -0.1, [
  ink(`M${-EX} ${-EYE_Y - 0.95}L${EX} ${-EYE_Y - 0.1}`, 0.32),
  brow(0.9, -0.3, 0),
]);
/** Half shut and tired (dizzy). */
export const lidHalf: PathShape[] = lidShape(-0.25, -0.25, [
  ink(`M${-EX} ${-EYE_Y - 0.25}L${EX} ${-EYE_Y - 0.25}`, 0.22),
]);
/** Fully shut: a calm blink. */
export const lidShut: PathShape[] = [
  inkedFill(EYE, 'lid', LINE * 2),
  ink(`M${-EX * 0.8} ${-EYE_Y + 0.1}Q0 ${-EYE_Y + 0.7} ${EX * 0.8} ${-EYE_Y + 0.1}`, 0.24),
  brow(0, -0.1),
];
/** Startled or hurt: brows flung up and tilted in worry. */
export const lidUp: PathShape[] = [brow(-0.6, 0.55, 0.15)];

/* ---------------------------------------------------------------- mouths (mouth bone, on the snout) */

const SMILE = blob([
  [-1.05, -0.2, true],
  [0.05, 0.02],
  [1.2, -0.5, true],
  [1.0, 0.25],
  [0.15, 0.78],
  [-0.65, 0.45],
]);
/** The big friendly grin of the games' art: teeth on top, tongue below. */
export const smile: PathShape[] = [
  fill(SMILE, 'mouth'),
  fill(
    blob([
      [-0.85, -0.12, true],
      [0.05, 0.08],
      [1.05, -0.38, true],
      [0.98, -0.12],
      [0.08, 0.32],
      [-0.68, 0.1],
    ]),
    'teeth',
  ),
  fill(ellipse(0.18, 0.56, 0.48, 0.2, -8), 'tongue'),
  ink(SMILE, LINE * 1.3),
  ink('M-1.05 -0.2L-1.3 -0.42', 0.18),
];

const GRIN = blob([
  [-0.95, -0.15, true],
  [0.1, 0.0],
  [1.15, -0.45, true],
  [1.05, 0.05],
  [0.1, 0.42],
  [-0.75, 0.25],
]);
/** Gritted teeth: effort. */
export const grin: PathShape[] = [
  fill(GRIN, 'teeth'),
  ink('M-0.85 0.05Q0.15 0.28 1.1 -0.2', 0.12),
  ...[-0.4, 0.15, 0.65].map((x) => ink(`M${x} ${-0.05 - x * 0.12}L${x} ${0.3 - x * 0.12}`, 0.1)),
  ink(GRIN, LINE * 1.3),
];

/** A small wobbly open mouth: hurt. */
export const ouch: PathShape[] = [
  inkedFill(
    blob([
      [-0.6, 0.2],
      [0.2, -0.2],
      [0.95, 0.0],
      [0.7, 0.55],
      [-0.1, 0.62],
    ]),
    'mouth',
    LINE * 1.3,
  ),
  fill(ellipse(0.2, 0.42, 0.3, 0.12), 'tongue'),
];

/** An open \u201cO\u201d: startled, as in the spikes art. */
export const gasp: PathShape[] = [
  inkedFill(ellipse(0.25, 0.25, 0.55, 0.62, -10), 'mouth', LINE * 1.3),
  fill(ellipse(0.28, 0.55, 0.32, 0.18), 'tongue'),
];

/** A closed little smile (idle blink, calm). */
export const grinClosed: PathShape[] = [
  ink('M-1.05 -0.15Q0.1 0.45 1.2 -0.45', LINE * 1.3),
  ink('M-1.05 -0.15L-1.28 -0.4', 0.18),
];

/* ---------------------------------------------------------------- arms (hidden at rest: he pops them out to punch) */

export const UPPER_ARM = 1.0;
export const FORE_ARM = 1.0;
const ARM_R = 0.4;
export const upperArm: Part = (() => {
  const d = capsule([0, 0], [0, UPPER_ARM], ARM_R, ARM_R * 0.92);
  return part(d, [fill(d, 'body')]);
})();
/** A forearm ending in a round fist with a knuckle crease. */
export const fist: Part = (() => {
  const d = `${capsule([0, 0], [0, FORE_ARM - 0.45], ARM_R * 0.92, ARM_R * 0.9)}${ellipse(0, FORE_ARM - 0.1, 0.66, 0.6)}`;
  return part(d, [
    fill(capsule([0, 0], [0, FORE_ARM - 0.45], ARM_R * 0.92, ARM_R * 0.9), 'body'),
    fill(ellipse(0, FORE_ARM - 0.1, 0.66, 0.6), 'body'),
    fill(ellipse(-0.2, FORE_ARM - 0.3, 0.24, 0.18), 'bodyHi'),
    ink(`M0.42 ${FORE_ARM - 0.4}Q0.16 ${FORE_ARM + 0.05} 0.4 ${FORE_ARM + 0.28}`, 0.13),
  ]);
})();
/** An open hand with a thumb, for grabbing. */
export const hand: Part = (() => {
  const palm = ellipse(0, FORE_ARM - 0.1, 0.62, 0.66);
  const thumb = capsule([0.36, FORE_ARM - 0.42], [0.8, FORE_ARM - 0.7], 0.2, 0.17);
  const wrist = capsule([0, 0], [0, FORE_ARM - 0.45], ARM_R * 0.92, ARM_R * 0.9);
  return part(`${wrist}${palm}${thumb}`, [fill(wrist, 'body'), fill(palm, 'body'), fill(thumb, 'body')]);
})();

/* ---------------------------------------------------------------- props */

/** A red steel I-beam from its hinge (origin) along +x, `GIRDER` long: flanges, web, rivets. */
export const GIRDER = 13;
export const girder: PathShape[] = [
  inkedFill(
    poly([
      [-0.6, -1.25],
      [GIRDER, -1.25],
      [GIRDER, 1.25],
      [-0.6, 1.25],
    ]),
    'girder',
    LINE * 1.8,
  ),
  fill(
    poly([
      [0.2, -1.25],
      [GIRDER, -1.25],
      [GIRDER, -0.7],
      [0.2, -0.7],
    ]),
    'girderHi',
  ),
  fill(
    poly([
      [0.2, 0.7],
      [GIRDER, 0.7],
      [GIRDER, 1.25],
      [0.2, 1.25],
    ]),
    'girderLo',
  ),
  ink(`M0.2 -0.7L${GIRDER} -0.7M0.2 0.7L${GIRDER} 0.7`, 0.14),
  ...[2.2, 4.6, 7.0, 9.4, 11.8].map((x) => fill(ellipse(x, 0, 0.36, 0.3), 'girderLo')),
  inkedFill(ellipse(0, 0, 0.75, 0.75), 'steel', LINE * 1.4),
  fill(ellipse(0, 0, 0.25, 0.25), 'steelLo'),
];

/** How far below the crane's pivot the girder hangs (the pivot sits off screen above the stage). */
export const CABLE = 33;
/**
 * A crane girder on its cable, the pivot at the origin: the cable runs down to a hook, a sling holds the beam
 * level below it, centred at (0, CABLE).
 */
export const girderHung: PathShape[] = [
  { d: `M-0.12 0L-0.12 ${CABLE - 2.6}M0.12 0L0.12 ${CABLE - 2.6}`, stroke: { color: 'line', width: 0.2 } },
  ink(`M0 ${CABLE - 2.5}L-4.2 ${CABLE - 1.25}M0 ${CABLE - 2.5}L4.2 ${CABLE - 1.25}`, 0.18),
  inkedFill(
    blob([
      [0, CABLE - 3.4],
      [0.55, CABLE - 2.9],
      [0.4, CABLE - 2.3],
      [0, CABLE - 2.1],
      [-0.4, CABLE - 2.4],
    ]),
    'steelLo',
    LINE,
  ),
  ...girder.map((shape) => ({
    ...shape,
    d: shape.d.replace(
      /(-?[\d.]+) (-?[\d.]+)/g,
      (_, x: string, y: string) => `${+x - GIRDER / 2} ${+y + CABLE}`,
    ),
  })),
];

/** The girder's swing: a pale band along the beam's arc, fading behind it (pivot at the origin). */
export const girderSmear: PathShape[] = [
  {
    d: poly([
      ...arc(0, 0, CABLE + 1.2, CABLE + 1.2, 90, 122, 16),
      ...arc(0, 0, CABLE - 1.2, CABLE - 1.2, 122, 90, 16),
    ]),
    fill: {
      type: 'linear',
      x0: -16,
      y0: CABLE - 4,
      x1: 0,
      y1: CABLE,
      stops: [
        { offset: 0, color: 'smear', alpha: 0 },
        { offset: 1, color: 'smear', alpha: 0.8 },
      ],
    },
  },
];

/** A construction lever's base: a yellow-and-black striped box on the ground, its pivot at the origin. */
export const leverBase: PathShape[] = [
  inkedFill(
    poly([
      [-1.3, -1.3],
      [1.3, -1.3],
      [1.45, 0],
      [-1.45, 0],
    ]),
    'hazard',
    LINE * 1.6,
  ),
  ...[-1.0, 0.0, 1.0].map((x) =>
    fill(
      poly([
        [x - 0.35, -1.3],
        [x + 0.1, -1.3],
        [x - 0.35, 0],
        [x - 0.8, 0],
      ]),
      'hazardLo',
    ),
  ),
  ink('M-1.3 -1.3L1.3 -1.3L1.45 0L-1.45 0Z', LINE * 1.6),
  inkedFill(ellipse(0, -1.3, 0.45, 0.3), 'steelLo', LINE),
];
/** The lever's handle: a steel rod up from the pivot with a red ball grip. */
export const LEVER = 3.4;
export const leverHandle: PathShape[] = [
  inkedFill(capsule([0, 0], [0, -LEVER], 0.18, 0.18), 'steel', LINE * 1.4),
  inkedFill(ellipse(0, -LEVER, 0.55, 0.55), 'knob', LINE * 1.6),
  fill(ellipse(-0.17, -LEVER - 0.18, 0.18, 0.14), 'gloss'),
];

/** A crane magnet on its cable: a red horseshoe, silver poles, the catch point at the origin (between the poles). */
export const magnet: PathShape[] = [
  ink('M0 -2.6L0 -40', 0.22),
  inkedFill(
    poly([
      [-0.5, -3.2],
      [0.5, -3.2],
      [0.35, -2.4],
      [-0.35, -2.4],
    ]),
    'steelLo',
    LINE,
  ),
  inkedFill(
    poly([
      ...arc(0, -0.6, 2.0, 2.0, 180, 360, 16),
      [2.0, 0.4],
      [1.05, 0.4],
      ...arc(0, -0.6, 1.05, 1.0, 360, 180, 12),
      [-1.05, 0.4],
      [-2.0, 0.4],
    ]),
    'magnet',
    LINE * 1.8,
  ),
  inkedFill(
    poly([
      [-2.0, 0.4],
      [-1.05, 0.4],
      [-1.05, 1.25],
      [-2.0, 1.25],
    ]),
    'steel',
    LINE * 1.6,
  ),
  inkedFill(
    poly([
      [1.05, 0.4],
      [2.0, 0.4],
      [2.0, 1.25],
      [1.05, 1.25],
    ]),
    'steel',
    LINE * 1.6,
  ),
  fill(ellipse(-1.2, -1.95, 0.45, 0.2, -35), 'gloss'),
  ink('M-2.5 1.9L-2.9 2.6M0 1.8L0 2.7M2.5 1.9L2.9 2.6', 0.16),
];

/** A surging wave of slime from its back edge (origin) forward, crest curling over at the front. */
export const slimeWave: PathShape[] = [
  inkedFill(
    blob([
      [-0.2, 0.0, true],
      [1.5, -0.9],
      [3.6, -1.7],
      [5.6, -2.7],
      [7.1, -2.4],
      [7.5, -1.4],
      [6.7, -1.1],
      [7.3, -0.4],
      [7.0, 0.0, true],
    ]),
    'slime',
    LINE * 1.6,
  ),
  fill(
    blob([
      [1.6, -0.6],
      [3.7, -1.3],
      [5.5, -2.25],
      [6.6, -2.2],
      [5.4, -1.6],
      [3.5, -0.9],
    ]),
    'slimeHi',
  ),
  inkedFill(ellipse(8.2, -2.6, 0.42, 0.36), 'slime', LINE),
  inkedFill(ellipse(8.6, -0.7, 0.3, 0.27), 'slime', LINE),
  fill(ellipse(3.0, -0.45, 0.22, 0.16), 'slimeHi'),
];
/** A slime puddle on the ground around the origin, with a bubble. */
export const slimePuddle: PathShape[] = [
  inkedFill(
    blob([
      [-3.0, 0.0, true],
      [-2.3, -0.5],
      [-0.6, -0.75],
      [1.2, -0.65],
      [2.8, -0.35],
      [3.2, 0.0, true],
    ]),
    'slime',
    LINE * 1.4,
  ),
  fill(ellipse(-0.6, -0.45, 1.2, 0.14), 'slimeHi'),
  inkedFill(ellipse(1.4, -0.85, 0.3, 0.28), 'slime', LINE),
];
/** Slime clinging to a squeezed opponent (pummel): a gooey blob with drips. */
export const slimeSplat: PathShape[] = [
  inkedFill(
    blob([
      [-1.6, -0.4],
      [-0.6, -1.5],
      [0.9, -1.4],
      [1.7, -0.3],
      [1.2, 0.9],
      [0.7, 0.6],
      [0.4, 1.7],
      [-0.1, 0.8],
      [-1.1, 1.0],
    ]),
    'slime',
    LINE * 1.4,
  ),
  fill(ellipse(-0.3, -0.75, 0.6, 0.25, -15), 'slimeHi'),
];

/** A dust cloud of three puffs, sitting on the ground at the origin. */
export const dust: PathShape[] = [
  inkedFill(ellipse(-1.5, -1.0, 1.35, 1.05), 'dust', LINE * 1.2),
  inkedFill(ellipse(1.5, -1.05, 1.4, 1.1), 'dust', LINE * 1.2),
  inkedFill(ellipse(0, -1.7, 1.75, 1.45), 'dust', LINE * 1.2),
  fill(ellipse(-0.4, -2.3, 0.7, 0.35, -10), 'dustHi'),
];
/** The ground pound's shockwave: a flat pale ring hugging the floor. */
export const shockwave: PathShape[] = [
  inkedFill(`${ellipse(0, -0.4, 4.2, 0.95)}${ellipse(0, -0.45, 3.0, 0.55)}`, 'smearSolid', LINE),
];

/** A comic \u201cpow\u201d star for punches landing, centred on the origin. */
export const pow: PathShape[] = (() => {
  const pts: Pt[] = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 2 ? 0.75 : 1.55 + (i % 4 === 0 ? 0.25 : 0);
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });
  return [
    inkedFill(poly(pts), 'pow', LINE * 1.4),
    fill(poly(pts.map(([x, y]) => [x * 0.5, y * 0.5] as const)), 'powHi'),
  ];
})();

/** Speed lines trailing a punch (towards -x from the origin). */
export const speedLines: PathShape[] = [
  ink('M-0.4 -0.6L-3.2 -0.8', 0.16),
  ink('M-0.2 0.0L-3.8 0.0', 0.18),
  ink('M-0.4 0.6L-3.2 0.8', 0.16),
];

const smearPaint = (x0: number, y0: number, x1: number, y1: number, a = 0.8): Paint => ({
  type: 'linear',
  x0,
  y0,
  x1,
  y1,
  stops: [
    { offset: 0, color: 'smear', alpha: 0 },
    { offset: 1, color: 'smear', alpha: a },
  ],
});

/** A spin smear: a crescent band around the origin from angle a0 to a1 (degrees), between radii r0 and r1. */
function crescent(r0: number, r1: number, a0: number, a1: number): string {
  return poly([...arc(0, 0, r1, r1, a0, a1, 18), ...arc(0, 0, r0, r0, a1, a0, 18)]);
}
/** Two swirling bands around the shell for spins (nair, getups), radius about 6. */
export const spinRing: PathShape[] = [
  { d: crescent(4.6, 6.2, 190, 330), fill: smearPaint(-6, 1, 3, -6) },
  { d: crescent(4.6, 6.2, 10, 150), fill: smearPaint(6, -1, -3, 6) },
  ink(blob(arc(0, 0, 6.2, 6.2, 250, 330, 6), false), 0.12),
  ink(blob(arc(0, 0, 6.2, 6.2, 70, 150, 6), false), 0.12),
];
/** One sweeping crescent ahead of the origin (+x), for a shell striking to one side. */
export const sideSmear: PathShape[] = [
  { d: crescent(3.0, 6.0, -55, 55), fill: smearPaint(1, -5, 6, 0, 0.85) },
  ink(blob(arc(0, 0, 6.0, 6.0, -40, 40, 6), false), 0.12),
];
/** An arc above the head for the eyestalk whips, sweeping from back to front around the origin. */
export const whipSmear: PathShape[] = [
  { d: crescent(4.2, 6.6, 200, 300), fill: smearPaint(-6, 0, 2, -6, 0.8) },
  ink(blob(arc(0, 0, 6.6, 6.6, 230, 300, 6), false), 0.12),
];
/** Motion lines under a falling shell (the ground pound), trailing up from the origin. */
export const fallLines: PathShape[] = [
  ink('M-2.4 -1.0L-2.4 -5.0', 0.18),
  ink('M0 -1.6L0 -6.4', 0.2),
  ink('M2.4 -1.0L2.4 -5.0', 0.18),
];

/** Dizzy stars circling over the head (origin at the ring's centre). */
export const stars: PathShape[] = [-1, 1].flatMap((side) => {
  const cx = side * 1.4;
  const pts: Pt[] = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? 0.26 : 0.6;
    return [cx + Math.cos(a) * r, Math.sin(a) * r] as const;
  });
  return [inkedFill(poly(pts), 'pow', 0.16)];
});
