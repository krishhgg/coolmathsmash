import { poseBounds } from '../../../render/rig/geometry';
import { ease, samplePose } from '../../../render/rig/sample';
import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip, BonePose, Ease, FighterArt, Key } from '../../../render/rig/types';
import {
  GETUP_STAND,
  LEDGE_ATTACK,
  LEDGE_CATCH_FRAMES,
  LEDGE_CLIMB,
  LEDGE_ROLL,
  ROLL_BACK,
  ROLL_FORWARD,
  RUN_TURN_FRAMES,
  SPOT_DODGE,
  TECH_IN_PLACE,
  TECH_ROLL,
} from '../../../sim/constants';
import { stats } from '../stats';
import { FORE_ARM, SHIN, THIGH, UPPER_ARM } from './parts';
import { STAND, aim, feet, hands, key, mix, pointOf, swing, twoHanded, type Pose, type Pt } from './poses';
import { rig } from './rig';

/**
 * Papa Louie's action clips: standing, moving, jumping, defending, ledge, hurt and grab states, plus his PL1
 * glide. Rig space: y down, feet at the origin, facing right. The paddle stays in his front fist in every
 * state; it is never allowed through his head or the floor.
 */

// --- Swap sets -------------------------------------------------------------------------------------------

const BLINK = { face: 'faceBlink' };
const DETERMINED = { face: 'faceAngry' };
const ANGRY = { face: 'faceAngry', stache: 'stacheGrit' };
const SHOUT = { face: 'faceAngry', stache: 'stacheShout' };
const HURT = { face: 'faceHurt', stache: 'stacheShout' };
const OUCH = { face: 'faceHurt', stache: 'stacheGrit' };
const WORRIED = { face: 'faceWorried' };
const STRAIN = { face: 'faceWorried', stache: 'stacheGrit' };
const YELL = { face: 'faceWorried', stache: 'stacheShout' };
const DAZED = { face: 'faceDazed', stache: 'stacheShout' };
const UP = { face: 'faceUp' };
const GRIN = { face: 'faceBlink', stache: 'stacheGrit' };
const SQUINT = { face: 'faceHurt', stache: 'stacheGrit' };
const CHUTE = { hat: 'hatChute' };

/** Draw orders. The back hand over the toque (holding it on); the paddle behind him or behind his legs. */
const HAND_ON_HAT = { handB: 29.5 };
const PADDLE_BEHIND = { paddle: 0.5 };
const PADDLE_LOW = { paddle: 6.5 };
const LEDGE_HOLD = { ...PADDLE_BEHIND, handB: 29.5 };

// --- Builders --------------------------------------------------------------------------------------------

interface Spec {
  /** Offsets for body, hip, torso, neck, head, hat, and any limb not placed below. */
  body?: Pose;
  /** Ankle targets (back, front), stretching a leg that cannot reach; the shoes' angles: 0 flat, + toe down. */
  feet?: [Pt, Pt];
  toes?: [number, number];
  /** Wrist targets (back, front); targets beyond reach stretch the upper arm. */
  hands?: [Pt | null, Pt | null];
  bend?: 1 | -1;
  /** Paddle direction (see swing): 0 down, -90 forward, 180 up, 90 back. */
  paddle?: number;
  /** Rig height the paddle's blade rests on (moves the front hand to put it there): a brake, a cane. */
  planted?: number;
  /** Offsets applied last: effect bones, the paddle spun in his fingers. */
  then?: Pose;
}

/** Puts the wrists on targets, stretching each upper arm just enough when a target is out of reach. */
function reachOut(pose: Pose, back: Pt | null, front: Pt | null, bend: 1 | -1): Pose {
  const stretch = (arm: string, [x, y]: Pt): Pose => {
    const [sx, sy] = pointOf(pose, arm);
    const s = (Math.hypot(x - sx, y - sy) * 1.02 - FORE_ARM) / UPPER_ARM;
    return s > 1 ? { [arm]: { ...pose[arm], sy: s } } : {};
  };
  const p = mix(pose, back ? stretch('armB', back) : {}, front ? stretch('armF', front) : {});
  return hands(p, back, front, bend);
}

/** How far below the ankle a shoe at this angle (see Spec.toes) reaches: toe tip, sole or heel. */
function soleDrop(deg: number): number {
  const a = deg / (180 / Math.PI);
  const sole: Pt[] = [
    [-1.3, 0.55],
    [-1.1, 0.9],
    [-0.8, 1],
    [1.95, 1],
    [2.6, 0.75],
    [2.85, 0.3],
  ];
  return Math.max(...sole.map(([x, y]) => x * Math.sin(a) + y * Math.cos(a)));
}

/** The paddle's lowest drawn point (rig y). */
function paddleLow(pose: Pose): number {
  const edge: Pt[] = [
    [-2.1, 7.6],
    [2.1, 7.6],
    [-1.6, 8.55],
    [1.6, 8.55],
    [0, 8.6],
  ];
  return Math.max(...edge.map(([x, y]) => pointOf(pose, 'paddle', x * (pose.paddle?.sx ?? 1), y)[1]));
}

function build(s: Spec): Pose {
  let p = s.body ?? {};
  if (s.feet) {
    const [tb, tf] = s.toes ?? [0, 0];
    const back: Pt = [s.feet[0][0], Math.min(s.feet[0][1], -soleDrop(tb))];
    const front: Pt = [s.feet[1][0], Math.min(s.feet[1][1], -soleDrop(tf))];
    const stretch = (thigh: string, shin: string, [x, y]: Pt): Pose => {
      const [hx, hy] = pointOf(p, thigh);
      const k = (Math.hypot(x - hx, y - hy) * 1.01) / (THIGH + SHIN);
      return k > 1 ? { [thigh]: { ...p[thigh], sy: k }, [shin]: { ...p[shin], sy: k } } : {};
    };
    p = mix(p, stretch('thighB', 'shinB', back), stretch('thighF', 'shinF', front));
    p = aim(aim(feet(p, back, front), 'footB', tb), 'footF', tf);
  }
  if (s.hands) {
    const [back, front] = s.hands;
    p = swing(reachOut(p, back, front, s.bend ?? -1), s.paddle ?? -168);
    if (s.planted !== undefined && front) {
      const lift = paddleLow(p) - s.planted;
      p = swing(reachOut(p, back, [front[0], front[1] - lift], s.bend ?? -1), s.paddle ?? -168);
    }
  } else if (s.paddle !== undefined) p = swing(p, s.paddle);
  return s.then ? mix(p, s.then) : p;
}

/** The lowest drawn point of a pose (rig y), measured on its real outlines. */
function lowest(pose: Pose, paddle = true): number {
  const art: FighterArt = {
    height: 15,
    rig,
    clips: { p: { length: 0, keys: [key(0, pose, paddle ? {} : { swaps: { paddle: null } })] } },
    palettes: { default: {} },
    icon: '',
  };
  return poseBounds(art, samplePose(art, 'p', 0, 0))[3];
}

/** Lifts or drops the whole figure so its lowest point rests on a floor at rig height y (rolls, lying down). */
function rest(pose: Pose, y = 0, paddle = true): Pose {
  return mix(pose, { root: { ...pose.root, y: (pose.root?.y ?? 0) + y - lowest(pose, paddle) } });
}

/**
 * Frame-by-frame keys between two poses over [from, to), each tweened like the sampler would and then set on the
 * floor, so a figure changing shape (sitting up, rolling over) never sinks into it or floats above it.
 */
function settle(
  a: Pose,
  b: Pose,
  from: number,
  to: number,
  kind: Ease = 'inOut',
  first: Omit<Key, 'frame' | 'pose'> = {},
): Key[] {
  const keys: Key[] = [];
  for (let f = from; f < to; f++) {
    const k = ease(kind, (f - from) / (to - from));
    const p: Pose = {};
    for (const bone of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const [u, v] = [a[bone] ?? {}, b[bone] ?? {}];
      p[bone] = {
        x: (u.x ?? 0) + ((v.x ?? 0) - (u.x ?? 0)) * k,
        y: (u.y ?? 0) + ((v.y ?? 0) - (u.y ?? 0)) * k,
        rot: (u.rot ?? 0) + ((v.rot ?? 0) - (u.rot ?? 0)) * k,
        sx: (u.sx ?? 1) + ((v.sx ?? 1) - (u.sx ?? 1)) * k,
        sy: (u.sy ?? 1) + ((v.sy ?? 1) - (u.sy ?? 1)) * k,
      };
    }
    keys.push(key(f, rest(p), { ease: 'linear', ...(f === from ? first : {}) }));
  }
  return keys;
}

/** Moves the whole figure (a pose built on the floor) to stand on a floor at (x, y). */
function shift(pose: Pose, x: number, y: number): Pose {
  return mix(pose, { root: { x: (pose.root?.x ?? 0) + x, y: (pose.root?.y ?? 0) + y } });
}

/** The swoosh smear on an effect bone, about (x, y) with radius r; its 90-degree arc trails a tip at aim deg. */
function smear(x: number, y: number, r: number, deg: number, flip = false): BonePose {
  return { x, y, rot: flip ? deg - 90 : deg + 90, sx: ((flip ? -1 : 1) * r) / 9, sy: r / 9 };
}

/** The paddle spun about its long axis (a twirl in his fingers): cos of the turn, never quite edge-on. */
const twirl = (turn: number): Pose => ({
  paddle: { sx: Math.abs(Math.cos(turn)) < 0.15 ? 0.15 : Math.cos(turn) },
});

// --- Standing and walking --------------------------------------------------------------------------------

const STANCE: [Pt, Pt] = [
  [-1.05, -1],
  [1.2, -1],
];

const BREATHE = build({
  body: {
    body: { y: 0.27 },
    torso: { sy: 0.975, sx: 1.015 },
    neck: { rot: 2 },
    hat: { rot: -2.5 },
    stache: { rot: 3, sy: 1.04 },
  },
  feet: STANCE,
  hands: [
    [-2.2, -3.45],
    [3.35, -4.85],
  ],
  paddle: -171,
});

interface Gait {
  length: number;
  /** Share of the cycle each foot is planted. */
  stance: number;
  /** Ankle x at heel strike and at toe-off, from the leg's hip joint. */
  stride: [number, number];
  /** Swing height, and how early in the swing it peaks (below 1: the heel kicks up behind first). */
  lift: number;
  kick: number;
  /** Shoe angles at heel strike (toe up, negative) and toe-off (toe down). */
  heel: number;
  toe: number;
  /** The rest of the pose at phase p (0: the front heel strikes, 0.5: the back heel strikes). */
  upper: (p: number) => Spec;
}

/** Where one foot is at phase q of its own step: planted and sliding back, or swinging forward. */
function step(g: Gait, q: number): { x: number; lift: number; toe: number } {
  const [front, back] = g.stride;
  if (q < g.stance) {
    const u = q / g.stance;
    const toe = u < 0.3 ? g.heel * (1 - u / 0.3) : u > 0.6 ? g.toe * ((u - 0.6) / 0.4) : 0;
    return { x: front + (back - front) * u, lift: 0, toe };
  }
  const u = (q - g.stance) / (1 - g.stance);
  const s = u * u * (3 - 2 * u);
  return {
    x: back + (front - back) * s,
    lift: g.lift * Math.sin(Math.PI * u ** g.kick),
    toe: g.toe + (g.heel - g.toe) * s,
  };
}

/** A gait loop keyed every few frames, so the planted foot never dips through the floor between keys. */
function gait(g: Gait, every = 2): AnimClip {
  const keys = [];
  for (let f = 0; f < g.length; f += every) {
    const p = f / g.length;
    const spec = g.upper(p);
    const dx = spec.body?.body?.x ?? 0;
    const b = step(g, (p + 0.5) % 1);
    const fr = step(g, p);
    keys.push(
      key(
        f,
        build({
          ...spec,
          feet: [
            [-0.85 + dx + b.x, -soleDrop(b.toe) - b.lift],
            [0.95 + dx + fr.x, -soleDrop(fr.toe) - fr.lift],
          ],
          toes: [b.toe, fr.toe],
        }),
        { ease: 'linear' },
      ),
    );
  }
  return { length: g.length, loop: true, keys };
}

const TAU = Math.PI * 2;

/** Walk: a jaunty, bouncy waddle with the paddle carried upright, sinking on each contact. */
const WALK = gait({
  length: 28,
  stance: 0.6,
  stride: [1.35, -1.25],
  lift: 0.9,
  kick: 0.9,
  heel: -16,
  toe: 30,
  upper: (p) => {
    const bob = Math.cos(2 * TAU * p);
    const lag = Math.cos(2 * TAU * (p - 0.08));
    const arm = Math.cos(TAU * p);
    return {
      body: {
        body: { y: 0.3 + 0.22 * bob },
        torso: { rot: 3 + 1.5 * bob, sy: 1 - 0.025 * bob, sx: 1 + 0.015 * bob },
        neck: { rot: -1.5 * lag },
        hat: { rot: 3 * lag },
      },
      hands: [
        [-1.9 + 1.3 * arm, -4.5],
        [3.15 - 0.4 * arm, -5.2 - 0.2 * arm],
      ],
      paddle: -156 + 5 * arm,
    };
  },
});

/**
 * Run, after the PL1 run cycle: leaning in, big strides on rubbery legs with the shoes flicking up behind, the
 * coat squashing on every contact and stretching in the air, the paddle carried up in front like the pizza
 * boxes and the back hand flung out behind.
 */
const RUN_STANCE = 0.28;
const RUN = gait(
  {
    length: 18,
    stance: RUN_STANCE,
    stride: [3.9, -4.1],
    lift: 3,
    kick: 0.68,
    heel: -24,
    toe: 48,
    upper: (p) => {
      const bob = Math.cos(2 * TAU * (p - RUN_STANCE / 2));
      const lag = Math.cos(2 * TAU * (p - RUN_STANCE / 2 - 0.1));
      const pump = Math.cos(TAU * (p - 0.08));
      return {
        body: {
          body: { y: -0.35 + 0.55 * bob, x: 0.55, rot: 12 },
          torso: { rot: 20 + 3 * bob, sy: 0.98 - 0.065 * bob, sx: 1 + 0.05 * bob },
          neck: { rot: -24 - 4 * lag },
          hat: { rot: 2 + 10 * lag, x: -0.15 + 0.2 * lag },
        },
        hands: [
          [-2.7 - 1.55 * pump, -6.25 - 0.65 * pump],
          [4.65 + 0.75 * pump, -6.8 - 0.65 * pump],
        ],
        paddle: -128 + 9 * lag + 6 * pump,
      };
    },
  },
  1,
);

/** The first key of a gait clip. */
const first = (clip: AnimClip): Pose => clip.keys[0]!.pose!;

/** Skidding to a stop: leaning back on the front heel, the paddle dragged ahead along the floor as a brake. */
function skid(dig: number): Pose {
  return build({
    body: {
      body: { y: 0.75 + 0.15 * dig, x: -0.5 - 0.1 * dig },
      torso: { rot: -17 - 3 * dig, sy: 0.97 - 0.02 * dig },
      neck: { rot: 12 + 2 * dig },
      hat: { rot: -14 - 2 * dig, x: -0.2 },
    },
    feet: [
      [-1.5, -1],
      [2.4 + 0.1 * dig, -1],
    ],
    toes: [0, -26 - 2 * dig],
    hands: [
      [-3.4, -8.4 + 0.4 * dig],
      [3.5, -5.6],
    ],
    paddle: -62 + 4 * dig,
    planted: 0,
  });
}

const CROUCH = build({
  body: {
    body: { y: 1.35 },
    torso: { rot: 13, sy: 0.88, sx: 1.08 },
    neck: { rot: -8, y: 0.25 },
    hat: { rot: 5 },
  },
  feet: [
    [-1.65, -1],
    [1.75, -1],
  ],
  hands: [
    [-1.4, -2.7],
    [3.4, -3.2],
  ],
  paddle: -132,
});

/** Knees bent and the coat squashed: jump squat, landing, a dip before a toss. */
const squash = (depth = 1.3): Pose =>
  build({
    body: {
      body: { y: depth },
      torso: { rot: 8, sy: 0.85, sx: 1.1 },
      neck: { y: 0.3, rot: -5 },
      hat: { sy: 0.9, sx: 1.06 },
    },
    feet: [
      [-1.45, -1],
      [1.6, -1],
    ],
    hands: [
      [-2.8, -2.6],
      [2.6, -3.3],
    ],
    paddle: -146,
  });
const SQUASH = squash();

/** Leaning into the run after a turnaround, both feet still down. */
const LEAN = build({
  body: { body: { y: 0.7, x: 0.2 }, torso: { rot: 14, sy: 0.96 }, neck: { rot: -6 }, hat: { rot: 6 } },
  feet: [
    [-1.7, -1],
    [1.9, -1],
  ],
  toes: [25, 0],
  hands: [
    [-3.4, -6.4],
    [3.8, -6.2],
  ],
  paddle: -146,
});

// --- Air ------------------------------------------------------------------------------------------------

const JUMP_COIL = build({
  body: {
    body: { y: 1.2, x: -0.35, rot: 7 },
    torso: { rot: 17, sx: 1.12, sy: 0.79 },
    neck: { y: 0.2, rot: -10 },
    hat: { rot: -10, sx: 1.08, sy: 0.89 },
  },
  feet: [
    [-2.1, -1],
    [2.0, -1],
  ],
  hands: [
    [-3.5, -2.7],
    [3.2, -3.0],
  ],
  paddle: -98,
});

/** Take-off: stretched tall, toes pointed, arms thrown up. */
const LAUNCH = build({
  body: {
    body: { y: -1, x: -0.15, rot: -7 },
    torso: { rot: -4, sy: 1.14, sx: 0.9 },
    neck: { rot: 3 },
    hat: { rot: -16, y: 0.2 },
  },
  feet: [
    [-2.35, -2.65],
    [1.6, -2.35],
  ],
  toes: [64, 51],
  hands: [
    [-3.8, -10.15],
    [2.6, -10.15],
  ],
  paddle: -173,
});

const RISE = build({
  body: {
    body: { y: -0.45, rot: 3 },
    torso: { rot: 4, sy: 1.06 },
    neck: { rot: -7 },
    hat: { rot: -5, y: -0.15 },
  },
  feet: [
    [-2.8, -2.85],
    [2.25, -3.2],
  ],
  toes: [50, 8],
  hands: [
    [-3.8, -8.8],
    [3.6, -8.4],
  ],
  paddle: -146,
});

/** Jump apex: one knee tucks up in front while the other boot and the free arm counterbalance behind. */
const APEX = build({
  body: {
    body: { y: 0.05, x: -0.4, rot: 13 },
    torso: { rot: 10, sx: 1.05, sy: 0.91 },
    neck: { rot: -18 },
    hat: { rot: 9, y: -0.25 },
  },
  feet: [
    [-3.65, -3.35],
    [3.0, -4.35],
  ],
  toes: [52, -23],
  hands: [
    [-4.5, -7.35],
    [4.55, -6.95],
  ],
  paddle: -100,
});

/** Falling: legs reaching down, arms raised by the air. */
const FALL: [Pose, Pose] = [
  build({
    body: {
      body: { y: -0.55, x: -0.55, rot: -15 },
      torso: { rot: -5, sy: 1.04 },
      neck: { rot: 21 },
      hat: { rot: -8, y: -0.45 },
    },
    feet: [
      [-2.45, -1.7],
      [2.25, -1.25],
    ],
    toes: [17, -12],
    hands: [
      [-4.6, -9.4],
      [3.5, -8.35],
    ],
    paddle: -54,
  }),
  build({
    body: {
      body: { y: -0.35, x: -0.35, rot: -10 },
      torso: { rot: -5, sy: 1.01 },
      neck: { rot: 14 },
      hat: { rot: -13, y: -0.3 },
    },
    feet: [
      [-2, -1.35],
      [2.65, -1.95],
    ],
    toes: [6, 25],
    hands: [
      [-4.2, -8.55],
      [3.85, -7.85],
    ],
    paddle: -68,
  }),
];

const LAND = build({
  body: {
    body: { y: 1.05, rot: 7 },
    torso: { rot: 10, sx: 1.12, sy: 0.81 },
    neck: { y: 0.25, rot: -4 },
    hat: { rot: 10, sx: 1.09, sy: 0.88 },
  },
  feet: [
    [-1.95, -1],
    [2.25, -1],
  ],
  hands: [
    [-3.1, -3.25],
    [3.5, -3.65],
  ],
  paddle: -100,
});

/** Curled into a ball: knees to the chest, head down, the paddle held over his back like a shell (draw it behind). */
const tuck = (paddle = 148): Pose =>
  build({
    body: {
      hip: { y: -0.4 },
      torso: { rot: 30, sy: 0.95 },
      neck: { rot: 20, y: 0.35 },
      hat: { rot: 8 },
      thighF: { rot: -115 },
      shinF: { rot: 135 },
      thighB: { rot: -100 },
      shinB: { rot: 140 },
      footF: { rot: 20 },
      footB: { rot: 20 },
    },
    hands: [
      [1.0, -4.3],
      [2.4, -4.4],
    ],
    paddle,
  });
const TUCK = tuck();

/** The tuck rotated by rot with the paddle pointing along deg in rig space (to steer it round his head). */
const spun = (rot: number, deg: number): Pose => mix(tuck(deg - rot), { body: { rot } });

/** The ball rolled deg degrees and set on a floor at height y (rolls and tech rolls). */
const rolled = (deg: number, y = 0): Pose => rest(mix(TUCK, { body: { rot: deg } }), y);

/**
 * A roll keyed every frame over [from, to): the ball turning from a to b degrees, resting on a floor at
 * floor(f) (a ledge roll's floor still rises) and led lead(f) ahead of the origin.
 */
function roll(
  from: number,
  to: number,
  a: number,
  b: number,
  first: Omit<Key, 'frame' | 'pose'> = {},
  floor: (f: number) => number = () => 0,
  lead: (f: number) => number = () => 0,
): Key[] {
  const keys: Key[] = [];
  for (let f = from; f < to; f++) {
    const deg = a + ((b - a) * (f - from)) / (to - from);
    keys.push(
      key(f, shift(rolled(deg, floor(f)), lead(f), 0), { ease: 'linear', ...(f === from ? first : {}) }),
    );
  }
  return keys;
}

// --- Defence --------------------------------------------------------------------------------------------

/** Braced behind the paddle held two-handed across his front, like a shield. */
const SHIELD = twoHanded(
  build({
    body: { body: { y: 0.8 }, torso: { rot: -6, sy: 0.96 }, neck: { rot: 4, y: 0.15 }, hat: { rot: -3 } },
    feet: [
      [-1.6, -1],
      [1.5, -1],
    ],
  }),
  [2.7, -5.0],
  -140,
);

/** The back hand clamped on the toque (draw it with HAND_ON_HAT). */
function holdHat(p: Pose): Pose {
  return aim(hands(p, pointOf(p, 'hat', -0.3, 0.25), null), 'handB', -175);
}

/** Ducked down, eyes shut, holding the toque on. */
function duck(dx: number): Pose {
  return holdHat(
    build({
      body: {
        body: { y: 1.45, x: -0.4 + dx },
        torso: { rot: 20, sy: 0.88, sx: 1.06 },
        neck: { rot: 12, y: 0.35 },
        hat: { rot: 6 },
      },
      feet: [
        [-1.6, -1],
        [1.4, -1],
      ],
      hands: [null, [3.0, -3.4]],
      paddle: -130,
    }),
  );
}

/** Air dodge: knees snapped up, body twisted back, one hand clamping the toque. */
function dodge(lean: number): Pose {
  return holdHat(
    build({
      body: {
        body: { rot: -14 - lean },
        torso: { rot: -8, sx: 0.94, sy: 1.04 },
        neck: { rot: 8, y: 0.2 },
        hat: { rot: -6 },
        thighF: { rot: -90 },
        shinF: { rot: 115 },
        thighB: { rot: -70 },
        shinB: { rot: 120 },
        footF: { rot: 30 },
        footB: { rot: 30 },
      },
      hands: [null, [3.2, -5.4]],
      paddle: -150,
    }),
  );
}

// --- Ledge ----------------------------------------------------------------------------------------------

/** Where his hands hold the ledge (rig space): the corner sits 5 in front of him and 12.75 up while hanging. */
export const LEDGE_GRIP: [number, number] = [5, -12.75];
const [GX, GY] = LEDGE_GRIP;

/**
 * The ledge's corner relative to the origin a number of frames into a getup that ends a distance past it: the
 * engine eases the origin across with a smoothstep over moveEnd and lifts it 1.6 times faster (ledge.ts).
 */
function corner(frame: number, moveEnd: number, distance: number): Pt {
  const t = Math.min(1, frame / moveEnd);
  const s = t * t * (3 - 2 * t);
  return [GX - (GX + distance) * s, GY * (1 - Math.min(1, 1.6 * s))];
}

/** The corner relative to the origin during a ledge jump: a 6-frame smoothstep to 1 above the floor. */
function ledgeRise(frame: number): Pt {
  const t = Math.min(1, frame / 6);
  const s = t * t * (3 - 2 * t);
  return [GX - (GX + 4.5) * s, GY + (1 - GY) * s];
}

/**
 * Hanging from a corner at c with the free hand on the lip and the peel trailing clear of the wall; lift pulls
 * the body up towards the lip (getups).
 */
function hang(c: Pt, lift = 0, extra: Pose = {}): Pose {
  const [cx, cy] = c;
  const p = build({
    body: mix(
      {
        body: { x: cx - 4.25 + lift * 0.35, y: cy + 12.35 - lift, rot: 5 },
        torso: { rot: 5 },
        neck: { rot: -13 },
        hat: { rot: -12 },
        armB: { x: 0.45, y: -0.75 },
        thighB: { rot: 16 },
        shinB: { rot: 26 },
        thighF: { rot: -19 },
        shinF: { rot: 39 },
        footB: { rot: 15 },
        footF: { rot: 17 },
      },
      extra,
    ),
    hands: [
      [cx - 0.85, cy + 0.4],
      [cx - 3.65, cy + 5.45 - lift * 0.65],
    ],
    paddle: 38,
  });
  return aim(p, 'handB', -120);
}

const HANG = hang([GX, GY]);

/** Pressing up over the lip at c: hands flat on the floor, chest over the edge, legs dangling below it. */
function press(c: Pt): Pose {
  const [cx, cy] = c;
  return build({
    body: {
      body: { x: cx - 1.5, y: cy + 2.7 },
      torso: { rot: 35, sy: 0.96 },
      neck: { rot: -20 },
      hat: { rot: 8 },
      thighB: { rot: 12 },
      shinB: { rot: 30 },
      thighF: { rot: -10 },
      shinF: { rot: 40 },
      footB: { rot: 40 },
      footF: { rot: 35 },
    },
    hands: [
      [cx + 1.2, cy - 1.15],
      [cx + 2.0, cy - 1.1],
    ],
    paddle: -94,
  });
}

/** Kneeling up onto a floor at (x, y): the front knee down, hands flat on the floor ahead. */
function kneel(x: number, y: number): Pose {
  return shift(
    build({
      body: {
        body: { y: 1.7 },
        torso: { rot: 24, sy: 0.9, sx: 1.05 },
        neck: { rot: -12, y: 0.2 },
        hat: { rot: 6 },
      },
      feet: [
        [-1.4, -1],
        [1.2, -0.65],
      ],
      toes: [50, 70],
      hands: [
        [1.8, -1.3],
        [3.0, -1.25],
      ],
      paddle: -100,
    }),
    x,
    y,
  );
}

// --- Hurt -----------------------------------------------------------------------------------------------

/** Breaking a fall: thrown into a low crouch, the paddle slapped flat on the floor ahead (or behind, to roll). */
const slap = (behind: boolean): Pose =>
  build({
    body: {
      body: { y: 1.2, x: 0.3 },
      torso: { rot: 18, sy: 0.86, sx: 1.08 },
      neck: { rot: -10, y: 0.3 },
      hat: { rot: -16, y: -0.6 },
    },
    feet: [
      [-1.6, -1],
      [1.8, -1],
    ],
    hands: behind
      ? [
          [-2.2, -2.8],
          [-0.6, -3.4],
        ]
      : [
          [-2.4, -2.6],
          [3.6, -2.8],
        ],
    paddle: behind ? 80 : -80,
    planted: 0,
  });

const HIT = build({
  body: {
    body: { rot: -12, x: -0.3 },
    torso: { rot: -16 },
    neck: { rot: -16 },
    hat: { rot: -22, y: -0.7, x: -0.3 },
  },
  feet: [
    [-1.9, -1.7],
    [1.7, -1.9],
  ],
  toes: [30, -15],
  hands: [
    [-3.8, -8.4],
    [3.9, -8.4],
  ],
  paddle: -160,
});

/** Lying on his back, knees up, head on the floor behind him, the paddle on the floor beyond his feet. */
const DOWN = rest(
  build({
    body: {
      body: { rot: -90 },
      neck: { rot: 18 },
      hat: { rot: -18, x: -0.3 },
      thighF: { rot: -55 },
      shinF: { rot: 95 },
      thighB: { rot: -35 },
      shinB: { rot: 75 },
      footF: { rot: -30 },
      footB: { rot: -40 },
      armB: { rot: 60 },
      foreB: { rot: -30 },
    },
    hands: [null, [2.4, -1.5]],
    paddle: -93,
  }),
);

/** Sitting up from the floor, levering himself on the paddle planted ahead. */
const SIT_UP = build({
  body: rest(
    {
      body: { rot: -40 },
      torso: { rot: 10 },
      neck: { rot: 12 },
      hat: { rot: -12 },
      thighF: { rot: -70 },
      shinF: { rot: 110 },
      thighB: { rot: -50 },
      shinB: { rot: 105 },
      footF: { rot: 10 },
      footB: { rot: 0 },
    },
    0,
    false,
  ),
  hands: [
    [-2.6, -0.9],
    [3.6, -4.6],
  ],
  paddle: -40,
  planted: 0,
});

/** Tumbling: arched back, limbs splayed. */
const TUMBLE: [Pose, Pose] = [
  build({
    body: { torso: { rot: -18 }, neck: { rot: -14 }, hat: { rot: -18, y: -0.6 } },
    feet: [
      [-2.2, -2.2],
      [1.9, -1.4],
    ],
    toes: [40, -20],
    hands: [
      [-4.0, -9.0],
      [4.3, -8.6],
    ],
    paddle: -168,
  }),
  build({
    body: { torso: { rot: -10 }, neck: { rot: -8 }, hat: { rot: -10, y: -0.5 } },
    feet: [
      [-1.6, -1.4],
      [2.3, -2.4],
    ],
    toes: [20, -30],
    hands: [
      [-4.2, -8.2],
      [4.0, -9.2],
    ],
    paddle: -150,
  }),
];

// --- Glide ----------------------------------------------------------------------------------------------

/** PL1's glide: hanging from the toque puffed out overhead like a parachute, legs dangling. */
function glide(sway: number): Pose {
  const spec: Spec = {
    body: {
      body: { rot: 3 + sway * 3 },
      torso: { sy: 1.04 },
      neck: { rot: 2 - sway * 2 },
      hat: { y: -2.3, rot: -3 - sway * 3, sx: 0.88 + sway * 0.03, sy: 0.86 - sway * 0.04 },
    },
    feet: [
      [-1.5 + sway * 0.3, -0.9],
      [1.5 - sway * 0.2, -1.7 - sway * 0.3],
    ],
    toes: [45, -5],
  };
  const p = build(spec);
  return build({
    ...spec,
    hands: [pointOf(p, 'hat', -2.75, 0.1), pointOf(p, 'hat', 2.75, 0.1)],
    paddle: -48,
  });
}

// --- Taunt ----------------------------------------------------------------------------------------------

/** The paddle tossed up out of his open hand, up units along itself, spun turn radians about its length. */
function toss(up: number, turn: number): Pose {
  return build({
    body: { body: { y: -0.1 }, torso: { rot: -6, sy: 1.04 }, neck: { rot: 8 }, hat: { rot: -6 } },
    feet: STANCE,
    hands: [
      [-2.4, -4.0],
      [3.8, -8.2],
    ],
    paddle: -162,
    then: mix(twirl(turn), { paddle: { y: 0.6 + up, sx: twirl(turn).paddle!.sx } }),
  });
}

/** Tipping the toque to the crowd with a grin, the paddle back at his side. */
function tip(lift: number): Pose {
  return holdHat(
    build({
      body: {
        body: { y: 0.2 },
        torso: { rot: 4 },
        neck: { rot: 6 + 6 * lift },
        hat: { y: -0.7 * lift, rot: 16 * lift, x: 0.3 * lift },
      },
      feet: STANCE,
      hands: [null, [3.7, -5.0]],
      paddle: -156,
    }),
  );
}

/** Waiting on the respawn platform: the paddle propped on his shoulder, a fist on his hip, the front toe tapping. */
function shouldered(tap: number, breath = 0): Pose {
  return build({
    body: {
      body: { y: 0.15 + 0.15 * breath },
      torso: { rot: -3, sy: 1 - 0.02 * breath, sx: 1 + 0.012 * breath },
      neck: { rot: 5 },
      hat: { rot: -4 + tap },
    },
    feet: [
      [-1.15, -1],
      [1.45, -1],
    ],
    toes: [0, -22 * tap],
    hands: [
      [-2.5, -4.6],
      [2.6, -7.3],
    ],
    paddle: 118,
  });
}

/** The dash: a coiled start, the push off the back foot, the lunge and the first heel strike. */
const DASH: [Pose, Pose, Pose, Pose] = [
  build({
    body: {
      body: { y: 1.1, x: -0.45, rot: 8 },
      torso: { rot: 18, sy: 0.82, sx: 1.1 },
      neck: { rot: -16 },
      hat: { rot: -14 },
    },
    feet: [
      [-1.65, -1.0],
      [1.65, -1.0],
    ],
    hands: [
      [-2.9, -3.3],
      [2.95, -4.15],
    ],
    paddle: -111,
  }),
  build({
    body: {
      body: { y: 0.65, x: 0.15, rot: 18 },
      torso: { rot: 24, sy: 0.92 },
      neck: { rot: -29 },
      hat: { rot: -4 },
    },
    feet: [
      [-2.95, -1],
      [2.0, -3.55],
    ],
    toes: [28, -14],
    hands: [
      [-3.25, -4.7],
      [4.55, -5.25],
    ],
    paddle: -104,
  }),
  build({
    body: {
      body: { y: -0.3, x: 0.85, rot: 21 },
      torso: { rot: 23, sy: 1.06, sx: 0.95 },
      neck: { rot: -28 },
      hat: { rot: 15, x: -0.15 },
    },
    feet: [
      [-4.9, -2.95],
      [3.5, -2.25],
    ],
    toes: [59, -18],
    hands: [
      [-4.25, -5.6],
      [5.35, -6.25],
    ],
    paddle: -98,
  }),
  build({
    body: {
      body: { y: 0.3, x: 0.6, rot: 16 },
      torso: { rot: 20, sy: 0.91, sx: 1.07 },
      neck: { rot: -25 },
      hat: { rot: 10 },
    },
    feet: [
      [-3.5, -4.25],
      [4.5, -1],
    ],
    toes: [62, -24],
    hands: [
      [-3.8, -5.9],
      [5, -6.8],
    ],
    paddle: -116,
  }),
];

// --- Clips ----------------------------------------------------------------------------------------------

const raw: Record<string, AnimClip> = {
  idle: {
    length: 60,
    loop: true,
    keys: [
      key(0, STAND),
      key(30, BREATHE),
      key(46, undefined, { swaps: BLINK }),
      key(50, undefined, { swaps: {} }),
    ],
  },

  walk: WALK,

  dash: {
    length: stats.dashFrames,
    swaps: DETERMINED,
    keys: [
      ...settle(DASH[0], DASH[1], 0, 2, 'out', { swaps: ANGRY }),
      ...settle(DASH[1], DASH[2], 2, 5, 'linear', { swaps: DETERMINED }),
      key(5, DASH[2], { ease: 'in' }),
      key(8, DASH[3], { ease: 'out' }),
      key(stats.dashFrames, first(RUN)),
    ],
  },

  run: RUN,

  runBrake: {
    length: 14,
    swaps: STRAIN,
    keys: [
      key(0, skid(0), { ease: 'out' }),
      key(6, skid(1), { ease: 'inOut' }),
      key(
        8,
        build({
          body: {
            body: { y: 1.1, x: -0.3 },
            torso: { rot: -6, sy: 0.92 },
            neck: { rot: 4 },
            hat: { rot: -6 },
          },
          feet: [
            [-1.6, -1],
            [2.1, -1],
          ],
          toes: [0, -12],
          hands: [
            [-2.6, -5.4],
            [3.4, -3.8],
          ],
          paddle: -110,
        }),
        { ease: 'inOut', swaps: WORRIED },
      ),
      key(11, CROUCH, { ease: 'out' }),
      key(14, STAND, { swaps: {} }),
    ],
  },

  turn: {
    length: RUN_TURN_FRAMES,
    swaps: STRAIN,
    keys: [
      key(0, mix(skid(0), { body: { sx: -1 } }), { ease: 'out' }),
      key(3, mix(skid(1), { body: { sx: -1 } }), { ease: 'inOut' }),
      key(5, mix(CROUCH, { body: { sx: -1 } }), { ease: 'step', swaps: BLINK }),
      key(6, mix(SQUASH, { fx1: smear(0, -5.5, 8.5, -150) }), {
        ease: 'out',
        swaps: { ...DETERMINED, fx1: 'swoosh' },
      }),
      key(7, undefined, { swaps: DETERMINED }),
      key(9, LEAN, { ease: 'inOut' }),
      key(RUN_TURN_FRAMES, LEAN),
    ],
  },

  crouch: {
    length: 6,
    keys: [key(0, STAND, { ease: 'out' }), key(6, CROUCH)],
  },

  jumpSquat: {
    length: 3,
    keys: [key(0, STAND, { ease: 'out' }), key(3, JUMP_COIL)],
  },

  jump: {
    length: 40,
    swaps: UP,
    keys: [
      key(0, LAUNCH, { ease: 'out' }),
      key(10, RISE, { ease: 'inOut', swaps: {} }),
      key(26, APEX, { ease: 'inOut' }),
      key(40, mix(APEX, { torso: { sx: 1.03, sy: 0.94 }, hat: { rot: 5, y: -0.35 } })),
    ],
  },

  doubleJump: {
    length: 30,
    swaps: UP,
    keys: [
      key(0, LAUNCH, { ease: 'out' }),
      key(2, spun(10, -70), { ease: 'linear', swaps: SQUINT, z: PADDLE_BEHIND }),
      key(4, spun(60, 40), { ease: 'linear' }),
      key(7, mix(TUCK, { body: { rot: 150 } }), { ease: 'linear' }),
      key(10, mix(TUCK, { body: { rot: 250 } }), { ease: 'linear' }),
      key(13, spun(330, 40), { ease: 'linear', z: {} }),
      key(14, spun(345, -50), { ease: 'out', swaps: {} }),
      key(17, mix(RISE, { body: { rot: 360 } }), { ease: 'inOut' }),
      key(30, mix(APEX, { body: { rot: 360 } })),
    ],
  },

  fall: {
    length: 40,
    loop: true,
    keys: [key(0, FALL[0]), key(20, FALL[1])],
  },

  land: {
    length: 4,
    keys: [key(0, LAND, { ease: 'out' }), key(4, STAND)],
  },

  glide: {
    length: 48,
    loop: true,
    swaps: CHUTE,
    keys: [
      key(0, glide(-1)),
      key(24, glide(1)),
      key(36, undefined, { swaps: { ...CHUTE, ...BLINK } }),
      key(40, undefined, { swaps: {} }),
    ],
  },

  airDodge: {
    length: 46,
    keys: [
      key(0, FALL[0], { ease: 'out' }),
      key(3, dodge(0), { ease: 'inOut', swaps: SQUINT, z: HAND_ON_HAT }),
      key(27, dodge(6), { ease: 'inOut' }),
      key(32, undefined, { swaps: WORRIED, z: {} }),
      key(46, FALL[0], { swaps: {} }),
    ],
  },

  shield: {
    length: 6,
    swaps: ANGRY,
    keys: [key(0, STAND, { ease: 'out' }), key(6, SHIELD)],
  },

  shieldDrop: {
    length: 11,
    keys: [key(0, SHIELD, { ease: 'out' }), key(11, STAND)],
  },

  shieldBreak: {
    length: 40,
    swaps: HURT,
    keys: [
      key(0, HIT, { ease: 'out' }),
      key(14, mix(TUMBLE[0], { body: { rot: -150 } }), { ease: 'linear' }),
      key(28, mix(TUMBLE[1], { body: { rot: -300 } }), { ease: 'out', swaps: DAZED }),
      key(
        40,
        build({
          body: {
            body: { rot: -360 },
            torso: { rot: -6 },
            neck: { rot: 14 },
            hat: { rot: -24, y: -0.4, x: -0.4 },
          },
          feet: [
            [-1.2, -1.2],
            [1.1, -1.0],
          ],
          toes: [40, 35],
          hands: [
            [-3.2, -7.0],
            [3.6, -6.4],
          ],
          paddle: -120,
        }),
      ),
    ],
  },

  dizzy: {
    length: 60,
    loop: true,
    swaps: DAZED,
    keys: [0, 30].map((f, i) => {
      const s = i === 0 ? -1 : 1;
      return key(
        f,
        build({
          body: {
            body: { x: 0.3 * s },
            torso: { rot: 9 + 5 * s },
            neck: { rot: 12 * s },
            hat: { rot: -10 + 8 * s, x: -0.2 },
          },
          feet: [
            [-1.3, -1],
            [1.0, -1],
          ],
          hands: [
            [-2.3, -3.6 + 0.4 * s],
            [3.2, -7.4],
          ],
          paddle: -50,
          planted: 0,
        }),
      );
    }),
  },

  spotDodge: {
    length: SPOT_DODGE.faf - 1,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(3, duck(0), { ease: 'linear', swaps: SQUINT, z: HAND_ON_HAT }),
      key(17, duck(-0.15), { ease: 'inOut' }),
      key(20, CROUCH, { ease: 'out', swaps: WORRIED, z: {} }),
      key(SPOT_DODGE.faf - 1, STAND, { swaps: {} }),
    ],
  },

  rollForward: {
    length: ROLL_FORWARD.faf - 1,
    swaps: DETERMINED,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(3, mix(CROUCH, { torso: { rot: 26 } }), { ease: 'in' }),
      ...roll(4, 17, 20, 360, { swaps: SQUINT, z: PADDLE_BEHIND }),
      key(17, mix(CROUCH, { body: { rot: 360 } }), { ease: 'out', swaps: DETERMINED, z: {} }),
      key(21, mix(CROUCH, { body: { sx: 1, rot: 360 } }), { ease: 'inOut' }),
      key(24, mix(CROUCH, { body: { sx: -1, rot: 360 } }), { ease: 'out' }),
      key(ROLL_FORWARD.faf - 1, mix(STAND, { body: { sx: -1, rot: 360 } }), { swaps: {} }),
    ],
  },

  rollBack: {
    length: ROLL_BACK.faf - 1,
    swaps: DETERMINED,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(3, mix(CROUCH, { torso: { rot: -6 } }), { ease: 'in' }),
      ...roll(4, 17, -20, -360, { swaps: SQUINT, z: PADDLE_BEHIND }),
      key(17, mix(CROUCH, { body: { rot: -360 } }), { ease: 'out', swaps: DETERMINED, z: {} }),
      key(ROLL_BACK.faf - 1, mix(STAND, { body: { rot: -360 } }), { swaps: {} }),
    ],
  },

  /** Drawn over 8 frames and stretched onto the 19-frame catch (LEDGE_CATCH_FRAMES), as Raft Wars does. */
  ledgeCatch: retimeClip(
    {
      length: 8,
      swaps: SHOUT,
      keys: [
        key(0, hang([GX, GY], -0.9, { body: { rot: -1 }, thighF: { rot: -37 }, thighB: { rot: 39 } }), {
          ease: 'outBack',
          z: LEDGE_HOLD,
        }),
        key(8, HANG, { swaps: STRAIN }),
      ],
    },
    LEDGE_CATCH_FRAMES,
  ),

  ledgeHang: {
    length: 60,
    loop: true,
    swaps: STRAIN,
    keys: [
      key(0, HANG, { z: LEDGE_HOLD }),
      key(
        30,
        hang([GX, GY], 0.1, {
          body: { rot: 7 },
          thighF: { rot: -23 },
          thighB: { rot: 10 },
          shinB: { rot: 40 },
        }),
      ),
      key(44, undefined, { swaps: SQUINT }),
      key(48, undefined, { swaps: {} }),
    ],
  },

  ledgeClimb: {
    length: LEDGE_CLIMB.faf - 1,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear', z: PADDLE_BEHIND }),
      key(
        4,
        hang(corner(4, 30, 6.5), 1.6, {
          thighF: { rot: -50 },
          shinF: { rot: 80 },
          thighB: { rot: -20 },
          shinB: { rot: 60 },
        }),
        {
          ease: 'linear',
        },
      ),
      key(9, press(corner(9, 30, 6.5)), { ease: 'inOut', swaps: SHOUT, z: {} }),
      key(13, kneel(2.4, corner(13, 30, 6.5)[1]), { ease: 'inOut', swaps: ANGRY }),
      key(18, shift(CROUCH, 1.0, 0), { ease: 'inOut', swaps: DETERMINED }),
      key(26, shift(BREATHE, 0.3, 0), { ease: 'inOut', swaps: {} }),
      key(LEDGE_CLIMB.faf - 1, STAND),
    ],
  },

  ledgeRoll: {
    length: LEDGE_ROLL.faf - 1,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear', z: PADDLE_BEHIND }),
      key(
        5,
        hang(corner(5, 40, 25), 1.6, {
          thighF: { rot: -50 },
          shinF: { rot: 80 },
          thighB: { rot: -20 },
          shinB: { rot: 60 },
        }),
        {
          ease: 'linear',
        },
      ),
      key(9, press(corner(9, 40, 25)), { ease: 'linear', swaps: SHOUT }),
      ...roll(
        12,
        30,
        40,
        400,
        { swaps: SQUINT, z: PADDLE_BEHIND },
        (f) => corner(f, 40, 25)[1],
        (f) => Math.max(0, 3 - (f - 12) * 0.2),
      ),
      key(30, mix(CROUCH, { body: { rot: 360 } }), { ease: 'inOut', swaps: DETERMINED, z: {} }),
      key(LEDGE_ROLL.faf - 1, mix(STAND, { body: { rot: 360 } }), { swaps: {} }),
    ],
  },

  ledgeJump: {
    length: 20,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'in', z: PADDLE_BEHIND }),
      key(
        2,
        hang(ledgeRise(2), 2.6, {
          thighF: { rot: -55 },
          shinF: { rot: 90 },
          thighB: { rot: -25 },
          shinB: { rot: 70 },
        }),
        {
          ease: 'linear',
        },
      ),
      key(
        4,
        build({
          body: mix(TUCK, { body: { rot: -8 }, torso: { rot: 10 } }),
          hands: [
            [-2.4, -8.6],
            [4.2, -7.5],
          ],
          paddle: -138,
        }),
        { ease: 'out', swaps: SHOUT, z: {} },
      ),
      key(6, LAUNCH, { ease: 'out', swaps: UP }),
      key(20, RISE, { swaps: {} }),
    ],
  },

  ledgeAttack: {
    length: LEDGE_ATTACK.faf - 1,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear', z: PADDLE_BEHIND }),
      key(
        4,
        hang(corner(4, 20, 6.5), 2.0, {
          thighF: { rot: -50 },
          shinF: { rot: 80 },
          thighB: { rot: -20 },
          shinB: { rot: 60 },
        }),
        {
          ease: 'linear',
        },
      ),
      key(7, press(corner(7, 20, 6.5)), { ease: 'inOut', swaps: SHOUT, z: {} }),
      key(10, kneel(2.4, corner(10, 20, 6.5)[1]), { ease: 'out', swaps: ANGRY }),
      key(
        13,
        shift(
          build({
            body: {
              body: { y: 1.3, x: -0.5 },
              torso: { rot: -10, sy: 0.93, sx: 1.04 },
              neck: { rot: 8 },
              hat: { rot: -8 },
            },
            feet: [
              [-1.9, -1],
              [1.5, -1],
            ],
            hands: [
              [0.0, -7.4],
              [0.9, -7.7],
            ],
            paddle: 140,
          }),
          0.8,
          0,
        ),
        { ease: 'in', z: PADDLE_BEHIND },
      ),
      key(
        16,
        build({
          body: {
            body: { y: 0.9, x: 0.9 },
            torso: { rot: 26, sx: 1.05, sy: 0.97 },
            neck: { rot: -12 },
            hat: { rot: 12 },
          },
          feet: [
            [-2.2, -1],
            [2.9, -1],
          ],
          toes: [20, -10],
          hands: [
            [3.9, -4.6],
            [4.8, -4.4],
          ],
          paddle: -62,
          planted: 0,
          then: { fx1: smear(2.4, -5.0, 8.6, -62, true) },
        }),
        { ease: 'out', swaps: { ...SHOUT, fx1: 'swoosh' }, z: {} },
      ),
      key(
        20,
        build({
          body: {
            body: { y: 1.0, x: 0.9 },
            torso: { rot: 28, sx: 1.04 },
            neck: { rot: -12 },
            hat: { rot: 13 },
          },
          feet: [
            [-2.2, -1],
            [2.9, -1],
          ],
          hands: [
            [3.8, -4.2],
            [4.7, -4.0],
          ],
          paddle: -58,
          planted: 0,
        }),
        { ease: 'inOut', swaps: ANGRY },
      ),
      key(
        27,
        build({
          body: {
            body: { y: 1.15, x: 0.6 },
            torso: { rot: 20, sy: 0.94, sx: 1.04 },
            neck: { rot: -10 },
            hat: { rot: 9 },
          },
          feet: [
            [-2.0, -1],
            [2.6, -1],
          ],
          hands: [
            [1.4, -3.4],
            [3.3, -3.5],
          ],
          paddle: -100,
        }),
        { ease: 'inOut', swaps: DETERMINED },
      ),
      key(34, shift(CROUCH, 0.3, 0), { ease: 'inOut' }),
      key(LEDGE_ATTACK.faf - 1, STAND, { swaps: {} }),
    ],
  },

  hitstun: {
    length: 20,
    swaps: HURT,
    keys: [
      key(0, HIT, { ease: 'out' }),
      key(5, mix(HIT, { body: { rot: -18, x: -0.4 }, torso: { rot: -20 } }), { ease: 'inOut' }),
      key(
        20,
        build({
          body: { body: { rot: -5 }, torso: { rot: -6 }, neck: { rot: -4 }, hat: { rot: -8, y: -0.2 } },
          feet: [
            [-1.6, -1.4],
            [1.5, -1.5],
          ],
          toes: [25, 5],
          hands: [
            [-3.2, -6.8],
            [3.9, -6.8],
          ],
          paddle: -148,
        }),
        { swaps: OUCH },
      ),
    ],
  },

  tumble: {
    length: 48,
    loop: true,
    swaps: HURT,
    keys: [
      key(0, TUMBLE[0], { ease: 'linear' }),
      key(12, mix(TUMBLE[1], { body: { rot: -90 } }), { ease: 'linear' }),
      key(24, mix(TUMBLE[0], { body: { rot: -180 } }), { ease: 'linear' }),
      key(36, mix(TUMBLE[1], { body: { rot: -270 } }), { ease: 'linear' }),
      key(48, mix(TUMBLE[0], { body: { rot: -360 } })),
    ],
  },

  helpless: {
    length: 24,
    loop: true,
    swaps: YELL,
    keys: [
      key(0, mix(FALL[0], { hat: { rot: -8, y: -0.5 } })),
      key(
        12,
        build({
          body: { torso: { rot: -4, sy: 1.03 }, neck: { rot: 4 }, hat: { rot: 4, y: -0.7 } },
          feet: [
            [-1.0, -1.6],
            [1.6, -1.1],
          ],
          toes: [15, 35],
          hands: [
            [-3.9, -8.0],
            [3.9, -8.4],
          ],
          paddle: -160,
        }),
      ),
    ],
  },

  down: {
    length: 40,
    loop: true,
    swaps: DAZED,
    keys: [
      key(0, DOWN, { z: PADDLE_LOW }),
      key(20, rest(mix(DOWN, { torso: { sy: 0.97, sx: 1.03 }, neck: { rot: 22 } }))),
    ],
  },

  getupStand: {
    length: GETUP_STAND.faf - 1,
    swaps: STRAIN,
    keys: [
      ...settle(DOWN, SIT_UP, 0, 9, 'inOut', { z: PADDLE_LOW }),
      ...settle(SIT_UP, mix(CROUCH, { torso: { rot: 20 } }), 9, 17, 'inOut', { z: {} }),
      key(17, mix(CROUCH, { torso: { rot: 20 } }), { ease: 'out', swaps: DETERMINED }),
      key(GETUP_STAND.faf - 1, STAND, { swaps: {} }),
    ],
  },

  techInPlace: {
    length: TECH_IN_PLACE.faf - 1,
    swaps: SQUINT,
    keys: [
      key(0, slap(false), { ease: 'out' }),
      key(4, slap(false), { ease: 'inOut', swaps: SHOUT }),
      key(10, CROUCH, { ease: 'inOut', swaps: ANGRY }),
      key(16, mix(CROUCH, { torso: { rot: 6 } }), { ease: 'inOut', swaps: DETERMINED }),
      key(TECH_IN_PLACE.faf - 1, STAND, { swaps: {} }),
    ],
  },

  techRoll: {
    length: TECH_ROLL.faf - 1,
    swaps: SHOUT,
    keys: [
      ...settle(slap(true), rolled(10), 0, 3, 'in'),
      ...roll(3, 24, 10, 360, { swaps: SQUINT, z: PADDLE_BEHIND }),
      key(24, mix(CROUCH, { body: { rot: 360 } }), { ease: 'out', swaps: DETERMINED, z: {} }),
      key(TECH_ROLL.faf - 1, mix(STAND, { body: { rot: 360 } }), { swaps: {} }),
    ],
  },

  grabHold: {
    length: 30,
    loop: true,
    swaps: ANGRY,
    keys: [0, 15].map((f, i) =>
      key(
        f,
        twoHanded(
          build({
            body: {
              body: { y: 0.6 + 0.1 * i },
              torso: { rot: -5 + 2 * i },
              neck: { rot: 3 },
              hat: { rot: -3 + i },
            },
            feet: [
              [-1.8, -1],
              [1.6, -1],
            ],
          }),
          [3.4, -5.6 + 0.2 * i],
          -97,
        ),
      ),
    ),
  },

  grabbed: {
    length: 20,
    loop: true,
    swaps: HURT,
    keys: [
      key(0, mix(HIT, { body: { rot: -8, y: -0.3 } })),
      key(10, mix(TUMBLE[1], { body: { rot: -4, y: -0.3 } })),
    ],
  },

  taunt: {
    length: 60,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(5, squash(0.8), { ease: 'out', swaps: BLINK }),
      key(9, toss(1.2, 0.5 * Math.PI), { ease: 'linear', swaps: { ...UP, handF: 'handOpen' } }),
      key(12, toss(2.4, Math.PI), { ease: 'linear' }),
      key(15, toss(2.8, 1.5 * Math.PI), { ease: 'linear' }),
      key(18, toss(1.8, 2 * Math.PI), { ease: 'in' }),
      key(21, squash(0.7), { ease: 'out', swaps: GRIN }),
      key(28, tip(1), { ease: 'inOut', z: HAND_ON_HAT }),
      key(42, tip(0.85), { ease: 'inOut' }),
      key(50, BREATHE, { ease: 'inOut', swaps: {}, z: {} }),
      key(60, STAND),
    ],
  },

  respawn: {
    length: 60,
    loop: true,
    keys: [
      key(0, shouldered(0), { ease: 'out', z: PADDLE_BEHIND }),
      key(4, shouldered(1), { ease: 'in' }),
      key(8, shouldered(0), { ease: 'out' }),
      key(12, shouldered(1), { ease: 'in' }),
      key(16, shouldered(0), { ease: 'inOut' }),
      key(38, shouldered(0, 1), { ease: 'inOut' }),
      key(46, undefined, { swaps: BLINK }),
      key(50, undefined, { swaps: {} }),
    ],
  },
};

/**
 * The air dodge, drawn over the old 46-frame neutral dodge, on the current 52 (AIR_DODGE_NEUTRAL): keys inside the
 * intangible window (3 to 29) stay put and only the recovery after it stretches. A directional dodge plays the same
 * clip over its own length.
 */
raw.airDodge = retimeClip(raw.airDodge!, 52, [[29, 29]]);

const FREE = new Set(['root', 'body', 'fx1', 'fx2', 'fx3']);
const WRISTS = new Set(['handB', 'handF']);
const PARENT = new Map(rig.bones.map((b) => [b.name, b.parent]));

/** How far a bone is turned from the body: its own rotation plus its parents' below the body. */
function turnFromBody(pose: Pose, bone: string | undefined): number {
  let r = 0;
  for (let b = bone; b && !FREE.has(b); b = PARENT.get(b)) r += pose[b]?.rot ?? 0;
  return r;
}

/**
 * Keeps every joint's tween the short way round: the IK and aim helpers wrap angles into [-180, 180), so a key can
 * land a full turn away from the one before it and the joint would spin through the body. A wrist goes the short
 * way in the body's frame instead, so the paddle in the fist never spins a full turn while the arm swings the other
 * way. Root and body turns (rolls, flips) are left as written.
 */
function shortWay(clip: AnimClip): AnimClip {
  let last: Pose = {};
  const keys = clip.keys.map((k) => {
    if (!k.pose) return k;
    const pose: Pose = { ...k.pose };
    for (const { name } of rig.bones) {
      const bp = pose[name];
      if (!bp || FREE.has(name) || bp.rot === undefined) continue;
      const wrist = WRISTS.has(name);
      const parent = wrist ? turnFromBody(pose, PARENT.get(name)) : 0;
      const prev = wrist ? turnFromBody(last, name) : (last[name]?.rot ?? 0);
      pose[name] = { ...bp, rot: bp.rot + 360 * Math.round((prev - parent - bp.rot) / 360) };
    }
    last = pose;
    return { ...k, pose };
  });
  return { ...clip, keys };
}

/** Papa Louie's action clips by canonical name, plus glide. */
export const movement: Record<string, AnimClip> = Object.fromEntries(
  Object.entries(raw).map(([name, clip]) => [name, shortWay(clip)]),
);
