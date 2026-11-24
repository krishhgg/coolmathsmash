import type { ArtSymbol, Paint, PathShape } from '../../../render/rig/types';
import { type Node, brush, capsule, curve, dir, inked, inset, oval, turn, wobble } from './pen';

/**
 * Fireboy drawn from scratch: a round fire ball whose top breaks into licking tongues, two big yellow eyes, a
 * lopsided grin, a little red stick body, and the black brush outline of the Flash games. Every shape is
 * generated from the numbers below, placed by eye while looking at the official art, so costumes recolour it
 * and the flames can bend with his motion.
 *
 * Head space: the ball's centre is the origin (the `head` bone), y down.
 */

/** Ball radius in head space. */
export const R = 3.5;
/** Outline weight. */
export const INK = 0.2;

export interface Tongue {
  /** Where the tongue rises from the ball: degrees clockwise from straight up. */
  at: number;
  /** Length past the ball, in ball radii. */
  len: number;
  /** Half its width at the root, in degrees of the ball. */
  span: number;
  /** Extra lean of the tip, degrees clockwise. */
  lean?: number;
}

export interface Flame {
  tongues: Tongue[];
  /** Direction the tongues bend towards (degrees clockwise from up) and how far, 0 to 1. Flames rise: default up. */
  wind?: number;
  gust?: number;
  /** How far the roots slide round the ball towards the wind, 0 to 1 (a flame blown sideways). */
  gather?: number;
  /** Multiplies every tongue's length. */
  stretch?: number;
  /** How deep the dips between tongues reach, 0 (up at the tongues' shoulders) to 1 (down to the ball). */
  valley?: number;
}

/**
 * The silhouette of a flame ball of radius `r` centred on (cx, cy), walking clockwise from the first tongue's
 * outer root over the tips and back round the bottom of the ball. Each tongue curls from its root direction into
 * the wind along a curved spine and narrows to a sharp tip; the ink thins towards the tips.
 */
export function flame(f: Flame, r = R, cx = 0, cy = 0): Node[] {
  const wind = f.wind ?? 0;
  const gust = f.gust ?? 1;
  const gather = f.gather ?? 0;
  const stretch = f.stretch ?? 1;
  const depth = f.valley ?? 0.62;
  const onBall = (deg: number, k = 1): Node => {
    const [x, y] = dir(deg);
    return { x: cx + x * r * k, y: cy + y * r * k };
  };
  const tongues = f.tongues.map((t) => {
    const at = t.at + turn(t.at, wind) * gather;
    const pull = turn(at, wind) * gust;
    const len = t.len * r * stretch;
    const base = r * Math.sin((t.span * Math.PI) / 180) * 1.1;
    const root = onBall(at, 0.9);
    let [x, y] = [root.x, root.y];
    const left: Node[] = [];
    const right: Node[] = [];
    let prev = 0;
    for (const s of [0.38, 0.72, 1]) {
      const heading = at + pull * (0.3 + 0.7 * Math.pow(s, 0.7)) + (t.lean ?? 0) * s;
      const [dx, dy] = dir(heading);
      x += dx * len * (s - prev);
      y += dy * len * (s - prev);
      prev = s;
      if (s === 1) break;
      const hw = base * Math.pow(1 - s, 0.85);
      const [px, py] = dir(heading + 90);
      left.push({ x: x - px * hw, y: y - py * hw, w: 0.75 });
      right.unshift({ x: x + px * hw, y: y + py * hw, w: 0.75 });
    }
    const tip: Node = { x, y, sharp: true, w: 0.3 };
    return { at, span: t.span, left, right, tip };
  });
  const nodes: Node[] = [];
  const last = tongues.length - 1;
  tongues.forEach((t, i) => {
    if (i === 0) nodes.push(onBall(t.at - t.span));
    nodes.push(
      ...(i === 0 ? t.left.slice(1) : t.left),
      t.tip,
      ...(i === last ? t.right.slice(0, -1) : t.right),
    );
    const next = tongues[i + 1];
    if (!next) {
      nodes.push(onBall(t.at + t.span));
      return;
    }
    const a = t.right[t.right.length - 1]!;
    const b = next.left[0]!;
    const low = onBall((t.at + next.at) / 2, 1.02);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    nodes.push({ x: mx + (low.x - mx) * depth, y: my + (low.y - my) * depth, w: 0.6 });
  });
  const from = tongues[last]!.at + tongues[last]!.span;
  const to = tongues[0]!.at - tongues[0]!.span + 360;
  const steps = Math.max(2, Math.round((to - from) / 28));
  for (let k = 1; k < steps; k++) nodes.push({ ...onBall(from + ((to - from) * k) / steps), w: 1.3 });
  return nodes;
}

/** Fireboy's flame, standing still: five tongues licking upwards, the tallest just left of centre. */
export const UPRIGHT: Tongue[] = [
  { at: -64, len: 0.78, span: 22, lean: -16 },
  { at: -26, len: 1.3, span: 20, lean: -4 },
  { at: 12, len: 0.95, span: 18, lean: 8 },
  { at: 48, len: 1.12, span: 22, lean: 14 },
];

/** Flicker drawing `i` of a flame: tips sway and stretch a little, differently each time. */
export function flicker(f: Flame, i: number, amount = 1): Flame {
  return {
    ...f,
    tongues: f.tongues.map((t, k) => ({
      ...t,
      len: t.len * (1 + 0.1 * amount * wobble(i, k)),
      lean: (t.lean ?? 0) + 8 * amount * wobble(i + 7, k),
    })),
  };
}

export const glow = (
  cx: number,
  cy: number,
  r: number,
  inner: string,
  outer: string,
  hold = 0.55,
): Paint => ({
  type: 'radial',
  cx,
  cy,
  r,
  stops: [
    { offset: 0, color: inner },
    { offset: hold, color: inner },
    { offset: 1, color: outer },
  ],
});

const scaled = (f: Flame, len: number, span: number): Flame => ({
  ...f,
  tongues: f.tongues.map((t) => ({ ...t, len: t.len * len, span: t.span * span })),
});

/**
 * A flame drawing: the inked flame in red with a warm centre, an orange inner flame licking up inside the
 * tongues, and a hot core. `up` is where the inner flames sit (towards the wind for a blown flame).
 */
export function flameShapes(f: Flame, r = R, line: Paint = 'line', ink = INK): PathShape[] {
  const [wx, wy] = dir(f.wind ?? 0);
  const lift = Math.abs(f.wind ?? 0) > 60 ? 0.45 : 1;
  const [ux, uy] = [wx * lift, wy * lift];
  return [
    ...inked(flame(f, r), glow(ux * r * 0.1, uy * r * 0.1 + r * 0.2, r * 2, 'fire', 'fireLo'), ink, line),
    {
      d: curve(flame(scaled(f, 0.75, 0.85), r * 0.55, ux * r * 0.55, uy * r * 0.55)),
      fill: glow(ux * r * 0.7, uy * r * 0.7, r * 1.4, 'fireMid', 'fire'),
    },
    {
      d: curve(flame(scaled(f, 0.45, 0.75), r * 0.3, ux * r * 0.75, uy * r * 0.75)),
      fill: glow(ux * r * 0.85, uy * r * 0.85, r * 0.9, 'fireHot', 'fireMid'),
    },
  ];
}

/** The head poses the clips swap between, each a flame shape that flickers through five drawings. */
export const HEADS: Record<string, Flame> = {
  headFront: { tongues: UPRIGHT },
  /** Seen from the side, the flames lean back a little. */
  headSide: { tongues: UPRIGHT, wind: -30 },
  headUp: { tongues: UPRIGHT },
  /** Running: the flames stream out behind him. */
  headRun: { tongues: UPRIGHT, wind: -95, gust: 0.95, gather: 0.5, stretch: 1.2, valley: 0.3 },
  /** Rising through a jump: the flames are dragged down round the ball like a comet's tail. */
  headRise: {
    tongues: [
      { at: 118, len: 0.55, span: 20, lean: 10 },
      { at: 152, len: 0.95, span: 19, lean: 6 },
      { at: 186, len: 1.05, span: 18, lean: -4 },
      { at: 220, len: 0.9, span: 19, lean: -8 },
      { at: 250, len: 0.5, span: 18, lean: -12 },
    ],
    wind: 180,
    gust: 0.75,
    valley: 0.5,
  },
  /** Falling: the flames stretch up tall. */
  headFall: { tongues: UPRIGHT, stretch: 1.25, valley: 0.55 },
};

// Faces -------------------------------------------------------------------------------------------------------

const ink = (d: string): PathShape => ({ d, fill: 'line' });
const stroke = (pts: [number, number][], width = 0.28, ends = 0.3) =>
  ink(
    brush(
      pts.map(([x, y]) => ({ x, y })),
      width,
      ends,
    ),
  );

/**
 * An eye: an inked yellow disc, hot in the middle, with a small dark pupil looking along `look`. `lid` closes
 * the top with a straight lid sloping that many degrees (positive: lower towards +x).
 */
export function eye(
  cx: number,
  cy: number,
  r: number,
  look: [number, number] = [0.45, 0.2],
  lid?: number,
): PathShape[] {
  let nodes = oval(cx, cy, r, r * 1.05, 12);
  if (lid !== undefined) {
    const slope = Math.tan((lid * Math.PI) / 180);
    const top = cy - r * 0.15;
    nodes = nodes.map((p) => {
      const y = top + (p.x - cx) * slope;
      return p.y < y ? { ...p, y } : p;
    });
  }
  const py = cy + look[1] * r * 0.42 + (lid === undefined ? 0 : r * 0.2);
  return [
    ...inked(nodes, glow(cx - r * 0.2, cy - r * 0.25, r * 1.4, 'eye', 'eyeRim', 0.45), INK * 0.85),
    { d: curve(oval(cx + look[0] * r * 0.42, py, r * 0.21, r * 0.25, 6)), fill: 'line' },
  ];
}

/** A brow: a thick tapered brush stroke along the eye's lid. */
const brow = (cx: number, cy: number, r: number, lid: number) => {
  const slope = Math.tan((lid * Math.PI) / 180);
  const y = cy - r * 0.15 - 0.06;
  return stroke(
    [
      [cx - r * 1.15, y - slope * r * 1.15],
      [cx, y],
      [cx + r * 1.15, y + slope * r * 1.15],
    ],
    0.34,
    0.35,
  );
};

/** A closed eye: a curved lash line. */
const shut = (cx: number, cy: number, r: number) =>
  stroke(
    [
      [cx - r, cy - 0.1],
      [cx, cy + r * 0.35],
      [cx + r, cy - 0.1],
    ],
    0.26,
  );

/** A squeezed eye, `>` or `<` pointing along `point`. */
const squeeze = (cx: number, cy: number, r: number, point: 1 | -1) =>
  stroke(
    [
      [cx - point * r, cy - r * 0.75],
      [cx + point * r * 0.7, cy],
      [cx - point * r, cy + r * 0.75],
    ],
    0.3,
    0.4,
  );

/** An open mouth: an inked D with a dark inside and a tongue. */
function shout(x0: number, x1: number, y: number, depth: number): PathShape[] {
  const w = x1 - x0;
  const nodes: Node[] = [
    { x: x0, y, sharp: true },
    { x: x0 + w * 0.5, y: y - 0.08 },
    { x: x1, y: y - 0.12, sharp: true },
    { x: x1 - w * 0.12, y: y + depth * 0.7 },
    { x: x0 + w * 0.5, y: y + depth },
    { x: x0 + w * 0.1, y: y + depth * 0.6 },
  ];
  return [
    ink(curve(inset(nodes, -0.09))),
    { d: curve(inset(nodes, 0.06)), fill: 'mouth' },
    { d: curve(oval(x0 + w * 0.55, y + depth * 0.78, w * 0.24, depth * 0.2, 8)), fill: 'tongue' },
  ];
}

/** Front-face features. Eyes sit just above the ball's middle; the big one on the left. */
const EL = [-1.2, -0.3, 0.84] as const;
const ER = [1.25, -0.25, 0.74] as const;
const eyes = (look?: [number, number], lid = 0) => [
  ...eye(EL[0], EL[1], EL[2], look, lid ? lid : undefined),
  ...eye(ER[0], ER[1], ER[2], look, lid ? -lid : undefined),
];
const GRIN = stroke(
  [
    [-1.3, 1.2],
    [-0.35, 1.85],
    [0.7, 1.9],
    [1.4, 1.42],
  ],
  0.34,
);
const OUCH: PathShape[] = inked(oval(-0.1, 1.7, 0.42, 0.36, 8), 'mouth', 0.1);

/** Side face, looking right: one eye near the front of the ball, the grin under it. */
const ES = [1.8, -0.4, 0.86] as const;
const sideEye = (look?: [number, number], lid?: number) => eye(ES[0], ES[1], ES[2], look ?? [0.6, 0.12], lid);
const SIDE_GRIN = stroke(
  [
    [0.85, 1.25],
    [1.7, 1.75],
    [2.55, 1.35],
  ],
  0.32,
);

export const faces: Record<string, PathShape[]> = {
  faceFront: [...eyes(), GRIN],
  faceFrontBlink: [shut(EL[0], EL[1], EL[2]), shut(ER[0], ER[1], ER[2]), GRIN],
  faceFrontAngry: [
    ...eyes([0.3, 0.2], 18),
    brow(EL[0], EL[1], EL[2], 18),
    brow(ER[0], ER[1], ER[2], -18),
    GRIN,
  ],
  faceFrontShout: [
    ...eyes([0.3, 0.2], 20),
    brow(EL[0], EL[1], EL[2], 20),
    brow(ER[0], ER[1], ER[2], -20),
    ...shout(-1.2, 1.35, 1.15, 1.25),
  ],
  faceFrontHurt: [squeeze(EL[0], EL[1], EL[2] * 0.85, 1), squeeze(ER[0], ER[1], ER[2] * 0.85, -1), ...OUCH],
  faceFrontDazed: [
    ...eye(EL[0], EL[1], EL[2], [-0.6, -0.4]),
    ...eye(ER[0], ER[1], ER[2], [0.6, 0.5]),
    stroke(
      [
        [-1.1, 1.6],
        [-0.55, 1.4],
        [0, 1.65],
        [0.55, 1.4],
        [1.1, 1.6],
      ],
      0.26,
    ),
  ],
  faceFrontStrain: [
    ...eyes([0.3, 0.1], 10),
    ...inked(
      [
        { x: -1.0, y: 1.3, sharp: true },
        { x: 0.2, y: 1.42 },
        { x: 1.2, y: 1.25, sharp: true },
        { x: 1.15, y: 1.9, sharp: true },
        { x: 0.1, y: 2.0 },
        { x: -0.95, y: 1.85, sharp: true },
      ],
      'teeth',
      0.14,
    ),
    stroke(
      [
        [-0.9, 1.65],
        [1.1, 1.6],
      ],
      0.12,
      0.6,
    ),
  ],
  faceSide: [...sideEye(), SIDE_GRIN],
  faceSideBlink: [shut(ES[0], ES[1], ES[2]), SIDE_GRIN],
  faceSideAngry: [...sideEye([0.6, 0.2], 18), brow(ES[0], ES[1], ES[2], 18), SIDE_GRIN],
  faceSideShout: [...sideEye([0.6, 0.2], 20), brow(ES[0], ES[1], ES[2], 20), ...shout(0.9, 2.65, 0.95, 1.2)],
  faceSideHurt: [
    squeeze(ES[0], ES[1], ES[2] * 0.85, -1),
    ...inked(oval(1.75, 1.45, 0.36, 0.3, 8), 'mouth', 0.1),
  ],
  faceUp: [
    ...eye(-1.2, -1.15, 0.92, [0.1, -0.85]),
    ...eye(1.25, -1.1, 0.84, [0.15, -0.85]),
    stroke(
      [
        [-0.9, 0.75],
        [0.15, 1.2],
        [1.05, 0.8],
      ],
      0.3,
    ),
  ],
};

// Body ---------------------------------------------------------------------------------------------------------

export const THIGH = 0.95;
export const SHIN = 1.05;
export const UPPER_ARM = 0.85;
export const FORE_ARM = 0.85;
const LEG_R = 0.36;
const ARM_R = 0.25;
/** Body outline weight: a little lighter than the head's. */
const LINE = 0.16;

/**
 * A limb segment hanging from its bone, as the outline (drawn in a slot behind both segments of the limb, so the
 * joint has no seam) and the fill, lit from the upper left: a bright stripe down the left, shade down the right.
 */
function limb(nodes: Node[], len: number, r: number): { line: PathShape[]; fill: PathShape[] } {
  return {
    line: [ink(curve(inset(nodes, -LINE)))],
    fill: [
      { d: curve(nodes), fill: 'skin' },
      {
        d: brush(
          [
            { x: r * 0.45, y: len * 0.1 },
            { x: r * 0.5, y: len * 0.9 },
          ],
          r * 0.55,
          0.5,
        ),
        fill: 'skinLo',
      },
      {
        d: brush(
          [
            { x: -r * 0.45, y: len * 0.05 },
            { x: -r * 0.5, y: len * 0.8 },
          ],
          r * 0.45,
          0.4,
        ),
        fill: 'skinHi',
      },
    ],
  };
}

export const thigh = limb(capsule(THIGH, LEG_R, LEG_R * 0.95), THIGH, LEG_R);
/** The shin ends in a round little foot whose bottom sits SHIN below the knee. */
export const shin = limb(capsule(SHIN - LEG_R * 1.1 - LINE, LEG_R * 0.95, LEG_R * 1.1), SHIN, LEG_R);
export const upperArm = limb(capsule(UPPER_ARM, ARM_R, ARM_R * 0.95), UPPER_ARM, ARM_R);
/** A plain rounded stub of a hand, as he has in his game. */
export const foreArm = limb(
  capsule(FORE_ARM - ARM_R * 1.1 - LINE, ARM_R * 0.95, ARM_R * 1.1),
  FORE_ARM,
  ARM_R,
);
/** A rounded mitten, for gripping. */
export const mitten = limb(
  capsule(FORE_ARM - ARM_R * 1.4 - LINE, ARM_R * 0.95, ARM_R * 1.4),
  FORE_ARM,
  ARM_R,
);
const FIST_Y = FORE_ARM - 0.32;
const wrist = limb(capsule(FIST_Y, ARM_R * 0.95, ARM_R), FIST_Y, ARM_R);
/** A balled-up hand for punches. */
export const fist = {
  line: [...wrist.line, ink(curve(oval(0, FIST_Y, 0.36 + LINE, 0.34 + LINE)))],
  fill: [
    ...wrist.fill,
    { d: curve(oval(0, FIST_Y, 0.36, 0.34)), fill: 'skin' },
    { d: curve(oval(-0.1, FIST_Y - 0.08, 0.16, 0.12, 6)), fill: 'skinHi' },
  ],
};

/** The torso in hip space, from the hips (y 0) up to the neck under the head: a little pear of a body. */
const TORSO: Node[] = [
  { x: 0, y: -1.45 },
  { x: 0.5, y: -1.3 },
  { x: 0.68, y: -0.7 },
  { x: 0.72, y: -0.15 },
  { x: 0, y: 0.1 },
  { x: -0.72, y: -0.15 },
  { x: -0.68, y: -0.7 },
  { x: -0.5, y: -1.3 },
];
export const torso = {
  line: [ink(curve(inset(TORSO, -LINE)))],
  fill: [
    { d: curve(TORSO), fill: 'skin' },
    {
      d: brush(
        [
          { x: 0.42, y: -1.1 },
          { x: 0.45, y: -0.25 },
        ],
        0.32,
        0.4,
      ),
      fill: 'skinLo',
    },
    {
      d: brush(
        [
          { x: -0.4, y: -1.15 },
          { x: -0.45, y: -0.3 },
        ],
        0.28,
        0.4,
      ),
      fill: 'skinHi',
    },
  ],
};

// Effects ------------------------------------------------------------------------------------------------------

/** Radius of the fire ball in the effect symbols at scale 1 (`BALL` in poses.ts). */
const BALL = 3.6;

/** His fireball: a ball of fire streaming flames behind it (towards -x), flickering. */
const BALL_FLAME: Flame = {
  tongues: [
    { at: -150, len: 0.55, span: 18 },
    { at: -115, len: 0.9, span: 20 },
    { at: -80, len: 1.1, span: 20 },
    { at: -45, len: 0.8, span: 18 },
    { at: -15, len: 0.45, span: 15 },
  ],
  wind: -90,
  gust: 0.95,
  gather: 0.2,
  valley: 0.35,
};
export const balls = [0, 1, 2].map((i) => flameShapes(flicker(BALL_FLAME, i, 1.3), BALL, 'fxLine', 0.3));

/** How far a strike flame's middle tongue reaches from its base centre (`JET_TIP` for attacks.ts). */
export const JET_TIP = 10.6;
const JET: Flame = {
  tongues: [
    { at: -42, len: 0.95, span: 26, lean: -6 },
    { at: 0, len: 2.25, span: 28 },
    { at: 42, len: 0.95, span: 26, lean: 6 },
  ],
  gust: 1,
  valley: 0.4,
};
/** A strike flame: a teardrop of fire pointing up from a round base at the origin, with a hot yellow core. */
export const jets = [0, 1, 2].map((i) => flameShapes(flicker(JET, i, 0.8), 3, 'fxLine', 0.3));

/** The warm glow round him, in body space (the body bone sits at his middle). */
export const aura: PathShape[] = [
  {
    d: curve(oval(0, -1.2, 6.4, 8.6, 12)),
    fill: {
      type: 'radial',
      cx: 0,
      cy: -1.5,
      r: 8,
      stops: [
        { offset: 0, color: 'aura', alpha: 0.38 },
        { offset: 0.55, color: 'aura', alpha: 0.2 },
        { offset: 1, color: 'aura', alpha: 0 },
      ],
    },
  },
];

const loop = (name: string, order: number[], fps: number) => ({ loop: order.map((i) => `${name}${i}`), fps });

const heads: Record<string, ArtSymbol> = {};
for (const [name, f] of Object.entries(HEADS)) {
  for (const i of [0, 1, 2, 3, 4]) heads[`${name}${i}`] = flameShapes(flicker(f, i));
  heads[name] = loop(name, [0, 1, 2, 3, 4], 15);
}

const limbs: Record<string, PathShape[]> = {};
for (const [name, part] of Object.entries({ upperArm, foreArm, mitten, fist, thigh, shin, torso })) {
  limbs[name] = part.fill;
  limbs[`${name}Line`] = part.line;
}

/**
 * Every symbol of the drawing under the rig's names. Heads are Flash movie clips flickering through five
 * drawings at 15 fps; limbs come as fill and `Line` (outline) pairs; effects flicker faster.
 */
export const symbols: Record<string, ArtSymbol> = {
  ...heads,
  ...faces,
  ...limbs,
  ...Object.fromEntries(balls.map((b, i) => [`fxBall${i}`, b])),
  /** His fireball: radius 3.6, trailing towards -x. */
  fxBall: loop('fxBall', [0, 2, 1], 20),
  ...Object.fromEntries(jets.map((j, i) => [`fxJet${i}`, j])),
  /** A strike flame: a teardrop of fire pointing up from its base. */
  fxJet: loop('fxJet', [0, 1, 2], 20),
  /** A flame tongue pointing up from its base: the strike flame at a different flicker. */
  fxFlame: loop('fxJet', [1, 2, 0], 20),
  aura,
};
