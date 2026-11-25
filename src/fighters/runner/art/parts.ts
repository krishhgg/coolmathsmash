import type { PathShape } from '../../../render/rig/types';

/**
 * The Runner's parts, drawn from scratch in Run 3's style: flat grey shapes inside a heavy dark outline, one big
 * green cat's eye and two ball-tipped antennae. Limbs hang from their bone's origin down the +y axis; antennae,
 * ears and the crest stand up the -y axis. Colours are palette keys, so costumes recolour them; the costume-only
 * parts (ears, crest, colander, cane) are shown per costume through the art's costumeSwaps.
 */

const K = 0.5523;
const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** Closed capsule from (x, y0) radius r0 to (x, y1) radius r1. */
export function tube(x: number, y0: number, y1: number, r0: number, r1: number): string {
  return [
    `M${n(x + r0)} ${n(y0)}`,
    `L${n(x + r1)} ${n(y1)}`,
    `C${n(x + r1)} ${n(y1 + K * r1)} ${n(x + K * r1)} ${n(y1 + r1)} ${n(x)} ${n(y1 + r1)}`,
    `C${n(x - K * r1)} ${n(y1 + r1)} ${n(x - r1)} ${n(y1 + K * r1)} ${n(x - r1)} ${n(y1)}`,
    `L${n(x - r0)} ${n(y0)}`,
    `C${n(x - r0)} ${n(y0 - K * r0)} ${n(x - K * r0)} ${n(y0 - r0)} ${n(x)} ${n(y0 - r0)}`,
    `C${n(x + K * r0)} ${n(y0 - r0)} ${n(x + r0)} ${n(y0 - K * r0)} ${n(x + r0)} ${n(y0)}Z`,
  ].join('');
}

/** Control-point distance for a Bézier eighth of a circle. */
const K8 = (4 / 3) * Math.tan(Math.PI / 16);

/** Ellipse centred at (x, y), in eight arcs so small ones stay round when the renderer tessellates them. */
export function ellipse(x: number, y: number, rx: number, ry: number): string {
  const at = (i: number) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)] as const;
  let d = `M${n(x + rx)} ${n(y)}`;
  for (let i = 0; i < 8; i++) {
    const [c0, s0] = at(i);
    const [c1, s1] = at(i + 1);
    d += `C${n(x + rx * (c0 - K8 * s0))} ${n(y + ry * (s0 + K8 * c0))} ${n(x + rx * (c1 + K8 * s1))} ${n(y + ry * (s1 - K8 * c1))} ${n(x + rx * c1)} ${n(y + ry * s1)}`;
  }
  return d + 'Z';
}

/** A smooth closed outline through points (Catmull-Rom as cubic Béziers). */
export function blob(points: readonly (readonly [number, number])[]): string {
  const at = (i: number) => points[(i + points.length) % points.length]!;
  let d = `M${n(points[0]![0])} ${n(points[0]![1])}`;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    d += `C${n(x1 + (x2 - x0) / 6)} ${n(y1 + (y2 - y0) / 6)} ${n(x2 - (x3 - x1) / 6)} ${n(y2 - (y3 - y1) / 6)} ${n(x2)} ${n(y2)}`;
  }
  return d + 'Z';
}

/** Scales a point list about the origin (for outlines grown from their fills). */
const grow = (pts: readonly (readonly [number, number])[], s: number, cx = 0, cy = 0) =>
  pts.map(([x, y]) => [cx + (x - cx) * s, cy + (y - cy) * s] as const);

/** Outline width. Run's ink is heavy: about a sixteenth of her body's width. */
export const LINE = 0.46;

/** Her round body, which is also her head (body space, centre at the origin). */
export const BODY_RX = 4.22;
export const BODY_RY = 3.75;

export const THIGH = 1.75;
/** Knee to the sole of the foot. */
export const SHIN = 2.3;
export const UPPER_ARM = 0.95;
/** Shoulder-side end of the forearm to the centre of the hand nub. */
export const FORE_ARM = 0.95;
const LEG_R = 0.95;
const ARM_R = 0.72;

export interface Part {
  line: PathShape[];
  fill: PathShape[];
}

/** A limb segment: the outline (drawn behind both segments, so joints have no seam) and the fill. */
function limb(len: number, r0: number, r1: number, fill: string): Part {
  return {
    line: [{ d: tube(0, 0, len, r0 + LINE, r1 + LINE), fill: 'line' }],
    fill: [{ d: tube(0, 0, len, r0, r1), fill }],
  };
}

/** How far the sole sits below the ankle (the foot bone's origin). */
export const ANKLE = 0.58 + LINE;

/** The shin narrows into the ankle so its rounded end stays inside the foot. */
const SHIN_END = 0.56;

/** The shin, from the knee down to the ankle. */
function shin(fill: string): Part {
  return {
    line: [{ d: tube(0, 0, SHIN - ANKLE, LEG_R * 0.95 + LINE, SHIN_END + LINE), fill: 'line' }],
    fill: [{ d: tube(0, 0, SHIN - ANKLE, LEG_R * 0.95, SHIN_END), fill }],
  };
}

/**
 * A rounded foot pointing a little forward, its sole ANKLE below the bone and a band of sole colour along it. Its
 * outline is drawn with the leg's, so leg and foot read as one stubby limb (the sole band shows only on costumes
 * that wear shoes).
 */
function foot(fill: string, shoe: string): Part {
  return {
    line: [{ d: ellipse(0.28, 0, 1.0 + LINE, 0.58 + LINE), fill: 'line' }],
    fill: [
      { d: ellipse(0.28, 0, 1.0, 0.58), fill: shoe },
      {
        d: `M-0.62 0.3Q0.28 0.72 1.18 0.3L1.1 0.5Q0.28 0.62 -0.55 0.5Z`,
        fill: fill === 'skin' ? 'sole' : 'soleFar',
      },
    ],
  };
}

/** Near limbs are lit; far limbs (behind the body) are the shade tone. */
export const limbs: Record<string, Part> = {
  thigh: limb(THIGH, LEG_R, LEG_R * 0.95, 'skin'),
  thighFar: limb(THIGH, LEG_R, LEG_R * 0.95, 'skinLo'),
  shin: shin('skin'),
  shinFar: shin('skinLo'),
  foot: foot('skin', 'shoe'),
  footFar: foot('skinLo', 'shoeFar'),
  upperArm: limb(UPPER_ARM, ARM_R, ARM_R * 0.96, 'skin'),
  upperArmFar: limb(UPPER_ARM, ARM_R, ARM_R * 0.96, 'skinLo'),
  /** The forearm ends in the round nub of a hand, a little fatter than the arm. */
  hand: limb(FORE_ARM, ARM_R * 0.96, ARM_R * 1.06, 'skin'),
  handFar: limb(FORE_ARM, ARM_R * 0.96, ARM_R * 1.06, 'skinLo'),
};

/** The body outline: round on top, a touch fuller below where the arms come out. */
const BODY_PTS: [number, number][] = [
  [0, -BODY_RY],
  [2.6, -3.0],
  [BODY_RX, -0.7],
  [4.0, 1.45],
  [2.75, 3.2],
  [0, BODY_RY],
  [-2.75, 3.2],
  [-4.0, 1.45],
  [-BODY_RX, -0.7],
  [-2.6, -3.0],
];

export const body: PathShape[] = [
  { d: blob(grow(BODY_PTS, 1 + LINE / 3.8)), fill: 'line' },
  { d: blob(BODY_PTS), fill: 'skin' },
];

const IDLE_BODY_PTS: [number, number][] = [
  [0, -BODY_RY],
  [2.62, -2.98],
  [3.67, -1.35],
  [4.73, -0.2],
  [5.16, 0.94],
  [4.84, 1.66],
  [4.01, 1.45],
  [3.53, 2.27],
  [2.54, 3.27],
  [0, BODY_RY],
  [-2.64, 3.28],
  [-3.78, 2.35],
  [-4.17, 1.51],
  [-5.0, 1.63],
  [-5.32, 0.93],
  [-4.83, -0.23],
  [-3.83, -1.17],
  [-2.6, -2.95],
];

export const idleBody: PathShape[] = [
  { d: blob(grow(IDLE_BODY_PTS, 1 + LINE / 4.3)), fill: 'line' },
  { d: blob(IDLE_BODY_PTS), fill: 'skin' },
];

/** Where the antennae meet the body (body space) and how they splay. */
export const ANTENNA_BASES = { back: [-1.75, -3.25, -38], front: [1.35, -3.45, 33] } as const;

const STALK = 2.55;
const BALL = 0.8;
/** One antenna: a dark stalk up the -y axis, a grey ball on top and a dark rivet where it meets the body. */
export const antenna: PathShape[] = [
  { d: tube(0, -STALK, 0.1, 0.36, 0.4), fill: 'antLine' },
  { d: ellipse(0, -STALK - BALL * 0.55, BALL + LINE, BALL + LINE), fill: 'antLine' },
  { d: ellipse(0, -STALK - BALL * 0.55, BALL, BALL), fill: 'ant' },
  { d: ellipse(0, 0.05, 0.42, 0.36), fill: 'antLine' },
];

export const iconAntennae: PathShape[] = [
  {
    d: 'M-2.39 -2.83L-3.81 -5.21L-3.17 -5.6L-1.75 -3.22ZM1.58 -3.17L3.06 -5.59L3.71 -5.2L2.24 -2.78Z',
    fill: 'antLine',
  },
  { d: ellipse(-3.7, -5.57, 1.15, 1.12), fill: 'antLine' },
  { d: ellipse(3.62, -5.57, 1.15, 1.12), fill: 'antLine' },
  { d: ellipse(-3.7, -5.57, 0.71, 0.68), fill: 'ant' },
  { d: ellipse(3.62, -5.57, 0.71, 0.68), fill: 'ant' },
];

/** The cat's eye: a flat green oval and a dark vertical slit. */
function eye(x: number, y: number, rx: number, ry: number, pupil = 1): PathShape[] {
  return [
    { d: ellipse(x, y, rx, ry), fill: 'eye' },
    {
      d: `M${n(x + rx * 0.05)} ${n(y - ry * 0.72)}Q${n(x + rx * (0.05 + 0.2 * pupil))} ${n(y)} ${n(x + rx * 0.05)} ${n(y + ry * 0.72)}Q${n(x + rx * (0.05 - 0.2 * pupil))} ${n(y)} ${n(x + rx * 0.05)} ${n(y - ry * 0.72)}Z`,
      fill: 'pupil',
    },
  ];
}

/** A shut eye: a dark arc where the eye was. */
function shut(x: number, y: number, w: number): PathShape[] {
  return [
    {
      d: `M${n(x - w)} ${n(y)}Q${n(x)} ${n(y + 0.55)} ${n(x + w)} ${n(y)}Q${n(x)} ${n(y + 0.95)} ${n(x - w)} ${n(y)}Z`,
      fill: 'line',
    },
  ];
}

/** Squeezed shut in pain: a chevron pointing forward. */
function squeezed(x: number, y: number, s: number): PathShape[] {
  return [
    {
      d: `M${n(x - s)} ${n(y - s * 0.75)}L${n(x + s * 0.55)} ${n(y)}L${n(x - s)} ${n(y + s * 0.75)}`,
      stroke: { color: 'line', width: 0.34 },
    },
  ];
}

/** The game's dizzy eye: a little cross. */
function crossed(x: number, y: number, s: number): PathShape[] {
  return [
    {
      d: `M${n(x - s)} ${n(y - s)}L${n(x + s)} ${n(y + s)}M${n(x + s)} ${n(y - s)}L${n(x - s)} ${n(y + s)}`,
      stroke: { color: 'line', width: 0.32 },
    },
  ];
}

/** Her usual mouth: a short dark dash. */
function dash(x: number, y: number, w: number): PathShape[] {
  return [
    {
      d: `M${n(x - w)} ${n(y - 0.11)}L${n(x + w)} ${n(y - 0.11)}L${n(x + w)} ${n(y + 0.11)}L${n(x - w)} ${n(y + 0.11)}Z`,
      fill: 'mouth',
    },
  ];
}

/** The open half-moon grin from the Skater art. */
function grin(x: number, y: number, w: number): PathShape[] {
  return [
    {
      d: `M${n(x - w)} ${n(y - 0.15)}Q${n(x)} ${n(y + 0.15)} ${n(x + w)} ${n(y - 0.2)}Q${n(x + w * 0.4)} ${n(y + 1.0)} ${n(x - w * 0.2)} ${n(y + 0.75)}Q${n(x - w * 0.85)} ${n(y + 0.5)} ${n(x - w)} ${n(y - 0.15)}Z`,
      fill: 'mouth',
    },
  ];
}

function shout(x: number, y: number, rx: number, ry: number): PathShape[] {
  return [
    { d: ellipse(x, y, rx, ry), fill: 'mouth' },
    { d: ellipse(x, y + ry * 0.5, rx * 0.62, ry * 0.36), fill: 'tongue' },
  ];
}

/** A heavy brow across the top of the eye, for determined and angry looks. */
function brow(x: number, y: number, rx: number, ry: number): PathShape[] {
  return [
    {
      d: `M${n(x - rx - 0.35)} ${n(y - ry - 0.75)}L${n(x + rx + 0.45)} ${n(y - ry - 0.75)}L${n(x + rx + 0.45)} ${n(y - ry * 0.15)}L${n(x - rx - 0.35)} ${n(y - ry * 0.7)}Z`,
      fill: 'skin',
    },
    {
      d: `M${n(x - rx - 0.3)} ${n(y - ry * 0.7)}L${n(x + rx + 0.4)} ${n(y - ry * 0.15)}`,
      stroke: { color: 'line', width: 0.34 },
    },
  ];
}

/** Face anchors in body space. Side view: the eye sits on the front half of her round body. */
const EYE: [number, number] = [1.95, -1.0];
const MOUTH: [number, number] = [2.2, 0.85];
const EYE_RX = 0.77;
const EYE_RY = 0.92;
const FRONT_EYE: [number, number] = [0, -0.95];
const FRONT_MOUTH: [number, number] = [0, 1.05];

export const faces: Record<string, PathShape[]> = {
  faceIdle: [...eye(0.86, -1.03, 0.84, 0.89), ...dash(0.96, 0.99, 0.66)],
  faceIdleBlink: [...shut(0.86, -0.92, 0.73), ...dash(0.96, 0.99, 0.66)],
  face: [...eye(...EYE, EYE_RX, EYE_RY), ...dash(...MOUTH, 0.5)],
  faceBlink: [...shut(EYE[0], EYE[1] + 0.1, 0.8), ...dash(...MOUTH, 0.5)],
  faceAngry: [
    ...eye(...EYE, EYE_RX, EYE_RY, 0.8),
    ...brow(...EYE, EYE_RX, EYE_RY),
    ...dash(MOUTH[0], MOUTH[1] + 0.05, 0.45),
  ],
  faceShout: [
    ...eye(...EYE, EYE_RX, EYE_RY, 0.8),
    ...brow(...EYE, EYE_RX, EYE_RY),
    ...shout(MOUTH[0] - 0.1, MOUTH[1] + 0.25, 0.62, 0.55),
  ],
  faceHurt: [
    ...squeezed(EYE[0] - 0.46, EYE[1], 0.6),
    ...squeezed(EYE[0] + 0.56, EYE[1], -0.6),
    { d: ellipse(MOUTH[0] - 0.08, MOUTH[1] + 0.16, 0.45, 0.46), fill: 'mouth' },
  ],
  faceHappy: [...eye(...EYE, EYE_RX, EYE_RY), ...grin(MOUTH[0] - 0.15, MOUTH[1] - 0.1, 0.75)],
  faceFront: [...eye(...FRONT_EYE, EYE_RX * 1.1, EYE_RY), ...dash(...FRONT_MOUTH, 0.75)],
  faceFrontHappy: [
    ...eye(...FRONT_EYE, EYE_RX * 1.1, EYE_RY),
    ...grin(FRONT_MOUTH[0], FRONT_MOUTH[1] - 0.1, 1.05),
  ],
  faceFrontDizzy: [
    ...crossed(FRONT_EYE[0], FRONT_EYE[1], 0.55),
    ...shout(FRONT_MOUTH[0], FRONT_MOUTH[1] + 0.2, 0.6, 0.45),
  ],
  faceBack: [],
};

/** Bunny ears, standing up the -y axis like the antennae they replace. */
const EAR_PTS: [number, number][] = [
  [0, 0.3],
  [-0.72, -0.4],
  [-0.95, -2.4],
  [-0.62, -4.3],
  [0, -4.85],
  [0.62, -4.3],
  [0.95, -2.4],
  [0.72, -0.4],
];
export const ear: PathShape[] = [
  { d: blob(grow(EAR_PTS, 1.0 + LINE / 1.0, 0, -2.3)), fill: 'line' },
  { d: blob(EAR_PTS), fill: 'skin' },
  { d: blob(grow(EAR_PTS, 0.58, 0, -2.6)), fill: 'earIn' },
];

/** The Lizard's crest spike on top of her head (body space). */
export const crest: PathShape[] = [
  { d: `M-1.05 -3.2L0 -6.6L1.05 -3.2Z`, fill: 'line' },
  { d: `M-0.62 -3.35L0 -5.95L0.62 -3.35Z`, fill: 'crest' },
  { d: `M0 -3.4L0 -5.6`, stroke: { color: 'line', width: 0.18 } },
];

/** The Pastafarian's colander, worn like a pot on top of her head (body space). */
export const colander: PathShape[] = [
  { d: `M-3.55 -2.35L-2.75 -5.45Q0 -6.05 2.75 -5.45L3.55 -2.35Z`, fill: 'line' },
  { d: `M-3.05 -2.55L-2.38 -5.08Q0 -5.62 2.38 -5.08L3.05 -2.55Z`, fill: 'col' },
  { d: ellipse(0, -2.45, 4.25, 0.62), fill: 'line' },
  { d: ellipse(0, -2.5, 3.9, 0.32), fill: 'colHi' },
  ...[-1.9, -0.95, 0, 0.95, 1.9].map((x) => ({ d: ellipse(x, -3.35, 0.17, 0.15), fill: 'colHole' })),
  ...[-1.45, -0.5, 0.5, 1.45].map((x) => ({ d: ellipse(x, -4.25, 0.15, 0.13), fill: 'colHole' })),
  { d: ellipse(4.35, -2.55, 0.7, 0.3), fill: 'line' },
  { d: ellipse(-4.35, -2.55, 0.7, 0.3), fill: 'line' },
  { d: ellipse(0, -5.6, 1.1, 0.35), fill: 'line' },
];

/** The Pastafarian's walking stick, held in the far hand and standing down the +y axis. */
export const cane: PathShape[] = [
  { d: tube(0, -0.6, 5.6, 0.32, 0.3), fill: 'line' },
  { d: tube(0, -0.6, 5.6, 0.16, 0.15), fill: 'cane' },
];

/** Run 3's map (from her title art): a creased sheet of tan paper, centred on the fx bone. */
export const map: PathShape[] = [
  { d: `M-4.25 -2.75Q0 -3.25 4.15 -2.65L4.45 2.55Q0 2.95 -4.05 2.75Z`, fill: 'mapLine' },
  {
    d: `M-3.95 -2.45Q0 -2.95 3.85 -2.35L4.12 2.25Q0 2.62 -3.78 2.45Z`,
    fill: {
      type: 'linear',
      x0: -4,
      y0: 0,
      x1: 4,
      y1: 0,
      stops: [
        { offset: 0, color: 'mapLo' },
        { offset: 0.35, color: 'map' },
        { offset: 0.55, color: 'mapLo' },
        { offset: 0.8, color: 'map' },
        { offset: 1, color: 'mapLo' },
      ],
    },
  },
  { d: `M-1.6 -1.3L0.4 -0.6L2.2 -1.5M-2.4 0.9L-0.6 1.4L1.6 0.6`, stroke: { color: 'mapLine', width: 0.16 } },
];

/**
 * A white speed streak: its blunt head at the origin, its tail tapering and fading along -x to x = -1. Scale x
 * by the length and y by the head's radius, and turn it along the direction of the strike.
 */
export const streak: PathShape[] = [
  {
    d: `M0 -1Q0.12 -1 0.12 0Q0.12 1 0 1L-1 0.12Q-1.04 0 -1 -0.12Z`,
    fill: {
      type: 'linear',
      x0: -1,
      y0: 0,
      x1: 0.4,
      y1: 0,
      stops: [
        { offset: 0, color: 'fx', alpha: 0 },
        { offset: 1, color: 'fx', alpha: 0.85 },
      ],
    },
  },
];

/**
 * A swoosh: a crescent along the unit circle from -70 to +70 degrees around +x, thick in the middle and fading
 * at both tips. Centre it on the joint the limb swings from and scale it to the limb's reach.
 */
export const swoosh: PathShape[] = (() => {
  const pts: string[] = [];
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i <= 14; i++) {
    const a = ((-70 + 10 * i) * Math.PI) / 180;
    const w = 0.34 * Math.sin((i / 14) * Math.PI);
    outer.push([Math.cos(a) * (1 + w / 2), Math.sin(a) * (1 + w / 2)]);
    inner.push([Math.cos(a) * (1 - w / 2), Math.sin(a) * (1 - w / 2)]);
  }
  for (const [x, y] of [...outer, ...inner.reverse()]) pts.push(`${n(x)} ${n(y)}`);
  return [
    {
      d: `M${pts.join('L')}Z`,
      fill: {
        type: 'radial',
        cx: 0,
        cy: 0,
        r: 1.2,
        stops: [
          { offset: 0.5, color: 'fx', alpha: 0 },
          { offset: 0.85, color: 'fx', alpha: 0.9 },
          { offset: 1, color: 'fx', alpha: 0.4 },
        ],
      },
    },
  ];
})();

/** One of Run's floor tiles, side on: a slab six units wide centred on the fx bone, which flips it over. */
export const tile: PathShape[] = [
  { d: `M-3.25 -0.75L3.25 -0.75L3.25 0.75L-3.25 0.75Z`, fill: 'tileLine' },
  { d: `M-2.95 -0.48L2.95 -0.48L2.95 0.48L-2.95 0.48Z`, fill: 'tile' },
  { d: `M-2.95 0.1L2.95 0.1L2.95 0.48L-2.95 0.48Z`, fill: 'tileLo' },
];

export const contact: PathShape[] = [
  {
    d: 'M-3.5 -0.6L-0.95 -0.86L-1.5 -3.45L0.22 -1.39L2.09 -2.91L1.41 -0.68L3.8 0.05L1.02 0.65L1.53 3.02L-0.42 1.35L-2.35 2.45L-1.52 0.6Z',
    fill: 'impact',
  },
  {
    d: 'M-1.37 -0.27L-0.34 -0.48L-0.29 -1.55L0.43 -0.54L1.56 -0.62L0.77 0.06L1.12 1.28L0.15 0.7L-0.78 1.29L-0.66 0.39Z',
    fill: 'fx',
  },
];

export const dust: PathShape[] = [
  {
    d: 'M-1.1 0Q-1.35 -0.55 -0.81 -0.67Q-1.12 -1.25 -0.49 -1.28Q-0.15 -1.37 0 -1.02Q0.5 -1.32 0.68 -0.82Q1.31 -0.95 1.48 0Z',
    fill: {
      type: 'linear',
      x0: -1.1,
      y0: -1.2,
      x1: 0.85,
      y1: 0,
      stops: [
        { offset: 0, color: 'fx', alpha: 0.15 },
        { offset: 1, color: 'fx', alpha: 0.65 },
      ],
    },
  },
];
