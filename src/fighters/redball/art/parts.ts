import type { ArtSymbol, Paint, PathShape } from '../../../render/rig/types';
import { arcPoints, blob, brush, ellipse, star, type Pt } from './draw';

/**
 * Red Ball, drawn by hand in rig units (y down) in the Red Ball 4 style: a glossy red circle with a thick dark ink
 * ring, big white eyes pressed together under a heavy brow, and a sideways smirk. Every colour is a palette key so
 * each costume recolours every symbol.
 *
 * The ball symbols are centred on the ball's centre (the `core` bone); the face symbols share that origin and are
 * already turned a little towards +x, the way he faces, so the HUD icon can stack them as they are.
 */

/** Ball radius: about 10.5 units across, ink included. */
export const R = 5.25;
/** Inside of the ink ring. */
const IN = 4.8;
/** Where the tongue leaves the mouth (face space), and the drawn tongue's rest length. */
export const MOUTH: Pt = [2.75, 1.95];
export const TONGUE = 4;

const fill = (d: string, paint: Paint): PathShape => ({ d, fill: paint });
const line = (d: string, width = 0.28, color = 'line'): PathShape => ({ d, stroke: { color, width } });

const BODY: Paint = {
  type: 'radial',
  cx: -1.7,
  cy: -2.1,
  r: 7.6,
  stops: [
    { offset: 0, color: 'bodyHi' },
    { offset: 0.42, color: 'body' },
    { offset: 0.86, color: 'body' },
    { offset: 1, color: 'bodyLo' },
  ],
};

export const ballLine: PathShape[] = [fill(ellipse(0, 0, R), 'line')];
export const ballFill: PathShape[] = [fill(ellipse(0, 0, IN), BODY)];
/** The darker rim inside the ink along the shadow side, as in the cutscene drawings. */
export const ballShade: PathShape[] = [
  fill(brush(arcPoints(0, 0, IN - 0.38, IN - 0.38, -15, 168, 9), 0.78, 0.4, 0.4), 'bodyLo'),
];
/** Gloss that stays put while the ball rolls: a soft band along the lit edge, a glint and a speck. */
export const ballShine: PathShape[] = [
  fill(brush(arcPoints(0, 0, IN - 0.72, IN - 0.72, 196, 262, 7), 1.05, 0.5, 0.5), {
    type: 'radial',
    cx: -2.6,
    cy: -2.9,
    r: 3.4,
    stops: [
      { offset: 0, color: 'shine', alpha: 0.75 },
      { offset: 1, color: 'shine', alpha: 0.05 },
    ],
  }),
  fill(ellipse(-1.85, -3.55, 0.95, 0.4, -24), 'shine'),
  fill(ellipse(-3.35, -2.15, 0.3, 0.27), 'shine'),
];

/* Eyes: two whites pressed together, the far (back) one a little lower, both looking the way he faces. */
type Eye = [cx: number, cy: number, rx: number, ry: number];
const EYE_B: Eye = [-1.05, -1.15, 1.6, 1.45];
const EYE_F: Eye = [1.95, -1.3, 1.52, 1.6];
const EYE_INK = 0.27;

/** An eye white (or its ink, grown by `grow`) with everything above `lid(x)` cut away. */
function eyeShape([cx, cy, rx, ry]: Eye, grow: number, lid?: (x: number) => number): string {
  if (!lid) return ellipse(cx, cy, rx + grow, ry + grow);
  const pts: Pt[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const x = cx + Math.cos(a) * (rx + grow);
    pts.push([x, Math.max(cy + Math.sin(a) * (ry + grow), lid(x) - grow * 0.4)]);
  }
  return `M ${pts.map(([x, y]) => `${Math.round(x * 1000) / 1000} ${Math.round(y * 1000) / 1000}`).join(' L ')} Z`;
}

function whites(lid?: (x: number) => number): PathShape[] {
  return [
    fill(eyeShape(EYE_B, EYE_INK, lid), 'eyeLine'),
    fill(eyeShape(EYE_B, 0, lid), 'eyeWhite'),
    fill(eyeShape(EYE_F, EYE_INK, lid), 'eyeLine'),
    fill(eyeShape(EYE_F, 0, lid), 'eyeWhite'),
  ];
}

/** Pupils at `back` and `front`, each with a pin glint. */
function pupils(back: Pt, front: Pt, r = 0.5): PathShape[] {
  return [back, front].flatMap(([x, y]) => [
    fill(ellipse(x, y, r * 0.92, r), 'pupil'),
    fill(ellipse(x + r * 0.32, y - r * 0.36, r * 0.27, r * 0.27), 'shine'),
  ]);
}

/** The brow line of the determined face: down to a V between the eyes, up and out over the front eye. */
const BROW: Pt[] = [
  [-2.95, -2.45],
  [-1.4, -2.2],
  [0.42, -1.72],
  [2.1, -2.42],
  [3.55, -3.0],
];
/** Height of the determined brow's centre line at x. */
function browY(x: number): number {
  for (let i = 1; i < BROW.length; i++) {
    const [x0, y0] = BROW[i - 1]!;
    const [x1, y1] = BROW[i]!;
    if (x <= x1 || i === BROW.length - 1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return BROW[0]![1];
}

/** Closed happy eyes: two arches. */
const arches = (lift = 0): PathShape[] => [
  fill(
    brush(
      [
        [-2.35, -0.85 + lift],
        [-1.1, -2.05 + lift],
        [0.15, -0.95 + lift],
      ],
      0.44,
      0.25,
      0.25,
    ),
    'line',
  ),
  fill(
    brush(
      [
        [0.75, -1.05 + lift],
        [1.95, -2.25 + lift],
        [3.2, -1.1 + lift],
      ],
      0.44,
      0.25,
      0.25,
    ),
    'line',
  ),
];

/** A spiral for dizzy eyes, wound around (cx, cy). */
function spiral(cx: number, cy: number, r: number, turns = 2.2): Pt[] {
  const pts: Pt[] = [];
  const steps = Math.round(turns * 10);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r * (0.12 + 0.88 * t), cy + Math.sin(a) * r * (0.12 + 0.88 * t)]);
  }
  return pts;
}

export const eyes: Record<string, ArtSymbol> = {
  /** The signature look: whites cut flat by the brow, pupils up under it towards the opponent. */
  eyesDetermined: [...whites(browY), ...pupils([-0.3, -1.05], [2.55, -1.3])],
  /** Wide open, looking ahead and a little up (neutral smile). */
  eyesOpen: [...whites(), ...pupils([-0.65, -1.5], [2.3, -1.7])],
  /** Looking up (happy, jumping, hanging). */
  eyesUp: [...whites(), ...pupils([-0.85, -2.05], [2.1, -2.3])],
  /** Looking down at the floor or the target below. */
  eyesDown: [...whites(), ...pupils([-0.65, -0.25], [2.25, -0.35])],
  /** Determined and looking down. */
  eyesDeterminedDown: [...whites(browY), ...pupils([-0.55, -0.45], [2.35, -0.6])],
  /** Determined and looking up. */
  eyesDeterminedUp: [...whites(browY), ...pupils([-0.7, -1.35], [2.2, -1.62], 0.46)],
  /** Shocked: pinprick pupils in wide whites. */
  eyesWide: [...whites(), ...pupils([-0.95, -1.15], [1.95, -1.3], 0.3)],
  /** Happy closed eyes. */
  eyesShut: arches(),
  /** A blink: lids drawn as low, flat curves. */
  eyesBlink: [
    fill(
      brush(
        [
          [-2.45, -1.0],
          [-1.05, -0.55],
          [0.35, -1.0],
        ],
        0.36,
        0.3,
        0.3,
      ),
      'line',
    ),
    fill(
      brush(
        [
          [0.6, -1.1],
          [1.95, -0.65],
          [3.3, -1.15],
        ],
        0.36,
        0.3,
        0.3,
      ),
      'line',
    ),
  ],
  /** Squeezed shut in pain: > <. */
  eyesHurt: [
    fill(
      brush(
        [
          [-2.45, -2.05],
          [-0.4, -1.25],
          [-2.35, -0.4],
        ],
        0.46,
        0.2,
        0.2,
      ),
      'line',
    ),
    fill(
      brush(
        [
          [3.35, -2.25],
          [1.25, -1.35],
          [3.25, -0.45],
        ],
        0.46,
        0.2,
        0.2,
      ),
      'line',
    ),
  ],
  /** Dizzy: spirals in the whites. */
  eyesDizzy: [
    ...whites(),
    fill(brush(spiral(-1.05, -1.15, 1.15), 0.24, 0.1, 0.05), 'pupil'),
    fill(brush(spiral(1.95, -1.3, 1.15), 0.24, 0.1, 0.05), 'pupil'),
  ],
};

export const brows: Record<string, ArtSymbol> = {
  /** One heavy brow, dipping into a V between the eyes. */
  browAngry: [fill(brush(BROW, 0.98, 0.2, 0.22), 'line')],
  /** Worried: inner ends raised. */
  browWorried: [
    fill(
      brush(
        [
          [-2.6, -2.75],
          [-1.35, -3.05],
          [-0.15, -3.5],
        ],
        0.5,
        0.3,
        0.2,
      ),
      'line',
    ),
    fill(
      brush(
        [
          [0.95, -3.7],
          [2.15, -3.4],
          [3.3, -3.15],
        ],
        0.5,
        0.2,
        0.3,
      ),
      'line',
    ),
  ],
  /** Raised in surprise. */
  browRaised: [
    fill(
      brush(
        [
          [-2.4, -3.0],
          [-1.15, -3.55],
          [0.15, -3.25],
        ],
        0.46,
        0.3,
        0.3,
      ),
      'line',
    ),
    fill(
      brush(
        [
          [0.85, -3.55],
          [2.0, -4.05],
          [3.2, -3.6],
        ],
        0.46,
        0.3,
        0.3,
      ),
      'line',
    ),
  ],
};

/** A D-shaped open mouth from (x0, y0) to (x1, y1) along the top, sagging `depth` below it. */
function openMouth(x0: number, y0: number, x1: number, y1: number, depth: number, teeth = 0.62): PathShape[] {
  const mx = (x0 + x1) / 2;
  const top: Pt[] = [
    [x0, y0],
    [mx, (y0 + y1) / 2 + 0.18],
    [x1, y1],
  ];
  const outline = blob([
    [x0, y0],
    [mx, (y0 + y1) / 2 + 0.2],
    [x1, y1],
    [x1 - 0.55, y1 + depth * 0.6],
    [mx + 0.2, (y0 + y1) / 2 + depth],
    [x0 + 0.5, y0 + depth * 0.55],
  ]);
  const tongueY = (y0 + y1) / 2 + depth * 0.86;
  return [
    fill(outline, 'mouthIn'),
    fill(
      blob([
        [mx - (x1 - x0) * 0.28, tongueY + 0.05],
        [mx + 0.1, tongueY - depth * 0.32],
        [mx + (x1 - x0) * 0.3, tongueY - 0.05],
        [mx + 0.25, tongueY + depth * 0.14],
      ]),
      'tongue',
    ),
    fill(
      blob([
        top[0]!,
        top[1]!,
        top[2]!,
        [x1 - 0.25, y1 + teeth],
        [mx, (y0 + y1) / 2 + teeth + 0.15],
        [x0 + 0.25, y0 + teeth * 0.9],
      ]),
      'teeth',
    ),
    line(outline, 0.32),
  ];
}

export const mouths: Record<string, ArtSymbol> = {
  /** The signature smirk: one long stroke up the front cheek, finished with a dimple. */
  mouthSmirk: [
    fill(
      brush(
        [
          [0.85, 3.4],
          [2.3, 3.15],
          [3.55, 2.35],
          [4.2, 1.1],
        ],
        0.44,
        0.45,
        0.12,
      ),
      'line',
    ),
    fill(
      brush(
        [
          [3.98, 0.95],
          [3.8, 0.3],
          [3.98, -0.35],
          [4.42, -0.52],
        ],
        0.27,
        0.2,
        0.55,
      ),
      'line',
    ),
  ],
  /** A plain, happy smile. */
  mouthSmile: [
    fill(
      brush(
        [
          [-1.2, 1.45],
          [0.2, 2.65],
          [1.95, 2.85],
          [3.45, 1.65],
        ],
        0.42,
        0.25,
        0.25,
      ),
      'line',
    ),
  ],
  /** Big open grin: top teeth, dark inside, tongue at the bottom. */
  mouthHappy: openMouth(-1.85, 0.6, 3.8, 0.35, 3.35),
  /** A smaller open grin for jumps. */
  mouthGrin: openMouth(-0.7, 1.1, 3.4, 0.85, 2.3, 0.5),
  /** Clenched teeth: effort. */
  mouthGrit: [
    fill(
      blob([
        [0.05, 2.1],
        [1.2, 1.45],
        [2.75, 1.15],
        [3.95, 1.05],
        [4.05, 1.85],
        [3.1, 2.55],
        [1.6, 2.85],
        [0.35, 2.75],
      ]),
      'teeth',
    ),
    fill(
      brush(
        [
          [0.25, 2.35],
          [1.7, 2.05],
          [3.0, 1.85],
          [4.0, 1.5],
        ],
        0.2,
        0.1,
        0.1,
      ),
      'line',
    ),
    fill(
      brush(
        [
          [1.35, 1.45],
          [1.3, 2.8],
        ],
        0.16,
        0,
        0,
      ),
      'line',
    ),
    fill(
      brush(
        [
          [2.55, 1.2],
          [2.45, 2.6],
        ],
        0.16,
        0,
        0,
      ),
      'line',
    ),
    fill(
      brush(
        [
          [3.5, 1.1],
          [3.45, 2.25],
        ],
        0.16,
        0,
        0,
      ),
      'line',
    ),
    line(
      blob([
        [0.05, 2.1],
        [1.2, 1.45],
        [2.75, 1.15],
        [3.95, 1.05],
        [4.05, 1.85],
        [3.1, 2.55],
        [1.6, 2.85],
        [0.35, 2.75],
      ]),
      0.3,
    ),
  ],
  /** Open "O": a shout or a gasp. */
  mouthOpen: [
    fill(ellipse(1.75, 2.15, 1.05, 1.25, 8), 'mouthIn'),
    fill(ellipse(1.8, 2.85, 0.65, 0.38), 'tongue'),
    fill(
      brush(
        [
          [0.95, 1.45],
          [1.75, 1.05],
          [2.55, 1.4],
        ],
        0.42,
        0.2,
        0.2,
      ),
      'teeth',
    ),
    line(ellipse(1.75, 2.15, 1.05, 1.25, 8), 0.32),
  ],
  /** Pain: a wide grimace with both rows of teeth showing. */
  mouthHurt: [
    fill(
      blob([
        [-0.4, 2.0],
        [1.0, 1.35],
        [2.4, 1.6],
        [3.7, 1.15],
        [3.5, 2.5],
        [2.0, 2.75],
        [0.6, 2.95],
      ]),
      'mouthIn',
    ),
    fill(
      brush(
        [
          [-0.2, 2.0],
          [1.0, 1.55],
          [2.4, 1.8],
          [3.5, 1.35],
        ],
        0.42,
        0.15,
        0.15,
      ),
      'teeth',
    ),
    fill(
      brush(
        [
          [0.6, 2.75],
          [2.0, 2.55],
          [3.35, 2.35],
        ],
        0.34,
        0.2,
        0.2,
      ),
      'teeth',
    ),
    line(
      blob([
        [-0.4, 2.0],
        [1.0, 1.35],
        [2.4, 1.6],
        [3.7, 1.15],
        [3.5, 2.5],
        [2.0, 2.75],
        [0.6, 2.95],
      ]),
      0.3,
    ),
  ],
  /** The mouth the tongue comes out of. */
  mouthLick: [
    fill(ellipse(MOUTH[0], MOUTH[1], 1.15, 0.95, -18), 'mouthIn'),
    fill(
      brush(
        [
          [1.75, 1.75],
          [2.55, 1.15],
          [3.55, 1.25],
        ],
        0.4,
        0.2,
        0.2,
      ),
      'teeth',
    ),
    line(ellipse(MOUTH[0], MOUTH[1], 1.15, 0.95, -18), 0.32),
  ],
  /** A wobbly line: dizzy, worried, held. */
  mouthFrown: [
    fill(
      brush(
        [
          [-0.2, 2.75],
          [0.75, 2.3],
          [1.65, 2.65],
          [2.55, 2.25],
          [3.35, 2.55],
        ],
        0.36,
        0.2,
        0.2,
      ),
      'line',
    ),
  ],
  /** Puffed, spitting "ptoo". */
  mouthSpit: [
    fill(ellipse(3.05, 1.75, 0.62, 0.55), 'mouthIn'),
    line(ellipse(3.05, 1.75, 0.62, 0.55), 0.3),
    fill(
      brush(
        [
          [2.0, 1.45],
          [2.35, 1.95],
          [2.15, 2.45],
        ],
        0.22,
        0.2,
        0.2,
      ),
      'line',
    ),
  ],
};

/** The tongue, drawn along +x from the mouth; the bone stretches it and the tip rides on the end. */
export const tongue: PathShape[] = [
  fill(
    blob([
      [-0.2, -0.5],
      [TONGUE * 0.5, -0.62],
      [TONGUE, -0.62],
      [TONGUE, 0.62],
      [TONGUE * 0.5, 0.62],
      [-0.2, 0.5],
    ]),
    'tongue',
  ),
  fill(
    brush(
      [
        [0.3, 0.05],
        [TONGUE * 0.6, 0.08],
        [TONGUE, 0.06],
      ],
      0.16,
      0.2,
      0,
    ),
    'tongueLo',
  ),
  line(`M -0.2 -0.5 L ${TONGUE} -0.62`, 0.24),
  line(`M -0.2 0.5 L ${TONGUE} 0.62`, 0.24),
];
export const tongueTip: PathShape[] = [
  fill(ellipse(0.35, 0, 0.95, 0.78), 'tongue'),
  fill(
    brush(
      [
        [-0.3, 0.06],
        [0.45, 0.04],
      ],
      0.16,
      0,
      0.6,
    ),
    'tongueLo',
  ),
  fill(ellipse(0.55, -0.32, 0.3, 0.16, -10), 'tongueHi'),
  line(`M -0.25 -0.62 C 0.7 -0.95 1.35 -0.55 1.3 0 C 1.3 0.55 0.7 0.95 -0.25 0.62`, 0.24),
];

/**
 * The jaws of the ledge bite, around a corner at the origin with the ledge filling x > 0, y > 0: the upper lip
 * lies on the ledge top, the lower one against the wall, and the far side melts into the ball.
 */
const JAWS: Pt[] = [
  [-2.5, 2.0],
  [-2.3, 0.2],
  [-1.3, -0.95],
  [0.3, -1.3],
  [1.55, -1.08],
  [1.95, -0.5],
  [1.55, -0.08],
  [0.2, -0.06],
  [-0.06, 0.22],
  [-0.08, 1.65],
  [-0.5, 2.3],
  [-1.45, 2.6],
];

/** Effects, placed by the fx bones. */
const puff = (cx: number, cy: number, r: number): [string, string] => [
  ellipse(cx, cy, r + 0.2),
  ellipse(cx, cy, r),
];
const PUFF = [puff(-0.75, 0.1, 0.75), puff(0.35, -0.25, 0.95), puff(1.2, 0.25, 0.6)];

export const effects: Record<string, ArtSymbol> = {
  /** A dust puff, about 3 units wide, sitting on its origin. */
  dust: [...PUFF.map(([outer]) => fill(outer, 'dustLine')), ...PUFF.map(([, inner]) => fill(inner, 'dust'))],
  /** Speed lines trailing back (-x) from the origin. */
  speed: [
    fill(
      brush(
        [
          [0, -2.2],
          [-4.2, -2.2],
        ],
        0.4,
        0,
        0.9,
      ),
      'speed',
    ),
    fill(
      brush(
        [
          [0.6, 0],
          [-5.4, 0],
        ],
        0.45,
        0,
        0.9,
      ),
      'speed',
    ),
    fill(
      brush(
        [
          [0, 2.2],
          [-3.6, 2.2],
        ],
        0.4,
        0,
        0.9,
      ),
      'speed',
    ),
  ],
  /** Spin arcs around a ball of radius R, swept clockwise (rolling forward). */
  swirl: [
    fill(brush(arcPoints(0, 0, R + 0.85, R + 0.85, 200, 320, 8), 0.55, 0.85, 0.05), 'speed'),
    fill(brush(arcPoints(0, 0, R + 0.85, R + 0.85, 20, 140, 8), 0.55, 0.85, 0.05), 'speed'),
  ],
  /** A flat shockwave ring on the floor, for bounces and pops. */
  ring: [line(ellipse(0, 0, 4, 1.15), 0.42, 'speed'), line(ellipse(0, 0, 2.6, 0.7), 0.3, 'speed')],
  /** A splat wave rolling out along the floor towards +x. */
  wave: [
    fill(
      brush(
        [
          [0, 0],
          [0.9, -1.7],
          [2.0, -2.2],
          [3.1, -1.5],
          [3.6, 0],
        ],
        0.5,
        0.2,
        0.2,
      ),
      'speed',
    ),
    fill(
      brush(
        [
          [2.2, 0],
          [3.1, -1.2],
          [4.1, -1.25],
          [4.9, 0],
        ],
        0.38,
        0.2,
        0.2,
      ),
      'speed',
    ),
  ],
  /** A pop burst: short rays around the origin. */
  pop: Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 + 22.5) * (Math.PI / 180);
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return fill(
      brush(
        [
          [c * 1.6, s * 1.6],
          [c * 3.0, s * 3.0],
        ],
        0.42,
        0,
        0.6,
      ),
      'speed',
    );
  }),
  /** A dizzy star. */
  star: [fill(star(0, 0, 0.95, 0.42), 'star'), line(star(0, 0, 0.95, 0.42), 0.16)],
  /** A sweat drop, tip up. */
  sweat: [
    fill(
      'M 0 -0.95 C 0.28 -0.45 0.6 -0.05 0.6 0.32 C 0.6 0.7 0.32 0.92 0 0.92 C -0.32 0.92 -0.6 0.7 -0.6 0.32 C -0.6 -0.05 -0.28 -0.45 0 -0.95 Z',
      'sweat',
    ),
    line(
      'M 0 -0.95 C 0.28 -0.45 0.6 -0.05 0.6 0.32 C 0.6 0.7 0.32 0.92 0 0.92 C -0.32 0.92 -0.6 0.7 -0.6 0.32 C -0.6 -0.05 -0.28 -0.45 0 -0.95 Z',
      0.16,
    ),
    fill(ellipse(-0.22, 0.3, 0.13, 0.22), 'shine'),
  ],
  /**
   * Hanging on by his teeth: a stretched snout clamped on a ledge corner at the origin (ledge to +x and +y), the
   * ball below and to the left. Its ink goes behind the ball (`biteInk`) so the snout grows out of him seamlessly.
   */
  biteInk: [fill(blob(JAWS.map(([x, y]) => [x * 1.07 - 0.06, y * 1.07 + 0.02] as Pt)), 'line')],
  bite: [
    fill(blob(JAWS), 'body'),
    fill(
      brush(
        [
          [-0.42, 1.6],
          [-0.4, 0.15],
          [-0.18, -0.36],
          [0.4, -0.48],
          [1.5, -0.5],
        ],
        0.5,
        0.15,
        0.15,
      ),
      'mouthIn',
    ),
    ...[0.1, 0.62, 1.1].map((x) =>
      fill(
        blob([
          [x, -0.6],
          [x + 0.46, -0.6],
          [x + 0.41, -0.08],
          [x + 0.05, -0.08],
        ]),
        'teeth',
      ),
    ),
    ...[0.22, 0.8].map((y) =>
      fill(
        blob([
          [-0.6, y],
          [-0.6, y + 0.5],
          [-0.1, y + 0.46],
          [-0.1, y + 0.04],
        ]),
        'teeth',
      ),
    ),
    fill(
      brush(
        [
          [1.62, -0.32],
          [1.68, -0.92],
        ],
        0.2,
        0.2,
        0.2,
      ),
      'line',
    ),
  ],
};
