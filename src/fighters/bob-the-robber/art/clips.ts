import { pointOf, type Pose } from '../../../render/rig/author';
import type { AnimClip } from '../../../render/rig/types';
import { attacks } from './attacks';
import {
  AIR,
  ANGRY,
  ARMS_OVER_HEAD,
  BLINK,
  BREATHE,
  CROUCH,
  FRONT,
  FRONT_ARM_OVER_HEAD,
  FRONT_BLINK,
  FRONT_DAZED,
  FRONT_GRIN,
  FRONT_WIDE,
  GRIN,
  HURT,
  READY,
  SACK_ON_BACK,
  SIDE,
  STAND,
  TUCK,
  WIDE,
  aim,
  feet,
  floor,
  fx,
  hands,
  key,
  mix,
  type Pt,
} from './poses';
import { FORE_ARM, UPPER_ARM } from './parts';
import { rig } from './rig';

/**
 * Where the hands hold the ledge (rig space): the ledge's top corner while hanging. It matches the engine's hang
 * position (half the width + 0.5 out from the corner, 0.85 x height below it).
 */
export const LEDGE_GRIP: [number, number] = [4.75, -12.325];
const [GX, GY] = LEDGE_GRIP;

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Where the ledge's corner is in rig space `frame` frames into a getup that ends its move at `moveEnd` and
 * finishes `inward` past the corner: the engine slides the origin across with a smoothstep and lifts it
 * 1.6 times as fast, so hands planted on the corner ride down and back as Bob comes up.
 */
function corner(frame: number, moveEnd: number, inward: number): Pt {
  const t = smooth(Math.min(1, frame / moveEnd));
  return [GX - (GX + inward) * t, GY * (1 - Math.min(1, 1.6 * t))];
}

/** How far below the floor the origin still is `frame` frames into a getup. */
const below = (frame: number, moveEnd: number) => -corner(frame, moveEnd, 0)[1];

/** Moves a standing pose up by `dy` (feet included), for poses the engine has not finished lifting. */
const lift = (pose: Pose, dy: number): Pose => mix(pose, { body: { y: (pose.body?.y ?? 0) - dy } });

/**
 * Hanging on with both hands over the lip, peeking over it the way he peeks over the title logo: body raised
 * and leaned into the wall, arms stretched just enough to reach, legs dangling.
 */
function hang(hx: number, hy: number, extra: Pose = {}): Pose {
  const base = mix(
    {
      body: { x: 0.9, y: -2.1, rot: 6 },
      neck: { rot: -4 },
      thighF: { rot: -18 },
      shinF: { rot: 22 },
      thighB: { rot: 6 },
      shinB: { rot: 16 },
      footF: { rot: 20 },
      footB: { rot: 30 },
    },
    extra,
  );
  const front: Pt = [hx + 1.1, hy - 0.35];
  const back: Pt = [hx + 0.2, hy - 0.3];
  const stretch = (arm: string, [x, y]: Pt) => {
    const [sx, sy] = pointOf(rig, base, arm);
    return Math.max(1, (Math.hypot(x - sx, y - sy) * 1.02) / (UPPER_ARM + FORE_ARM));
  };
  const s = { armF: { sy: stretch('armF', front) }, foreF: { sy: stretch('armF', front) } };
  const t = { armB: { sy: stretch('armB', back) }, foreB: { sy: stretch('armB', back) } };
  return hands(mix(base, s, t), back, front, 1);
}

const HANG = hang(GX, GY);
const HANG_LOOK = { ...SIDE, handF: 'handOpen', handB: 'handOpen' };

/** Mid pull-up `frame` frames into a getup: hands on the corner, knees coming up under him. */
function pull(frame: number, moveEnd: number, inward: number, progress: number): Pose {
  const [cx, cy] = corner(frame, moveEnd, inward);
  return hang(cx, cy, {
    body: { x: 0.9 + 0.6 * progress, y: -2.1 - 2.2 * progress, rot: 6 + 10 * progress },
    thighF: { rot: -18 - 85 * progress },
    shinF: { rot: 22 + 90 * progress },
    thighB: { rot: 6 - 40 * progress },
    shinB: { rot: 16 + 70 * progress },
  });
}

/** A gait loop of four poses on straight tweens. */
function cycle(
  length: number,
  poses: [Pose, Pose, Pose, Pose],
  swaps: Record<string, string | null>,
): AnimClip {
  const q = length / 4;
  return { length, loop: true, swaps, keys: poses.map((pose, i) => key(i * q, pose, { ease: 'linear' })) };
}

/**
 * Walk: the cartoon burglar's tiptoe. Hunched, knees lifted high, toes set down first, hands held up in front
 * with the fingers dangling.
 */
const SNEAK: Pose = { body: { rot: 10, x: 0.3 }, hip: { y: 0.55 }, neck: { rot: -8 } };
const sneakHands = (pose: Pose, bob: number) => hands(pose, [0.9, -6.5 + bob], [3.4, -6.7 + bob], -1);
const WALK: [Pose, Pose, Pose, Pose] = [
  sneakHands(feet(mix(SNEAK, { body: { y: 0.15 } }), floor(-1.5), [1.8, -2.4], false, [25, 30]), 0.15),
  sneakHands(feet(mix(SNEAK, { body: { y: -0.15 } }), floor(-0.6), floor(2.0), false, [35, 5]), -0.15),
  sneakHands(feet(mix(SNEAK, { body: { y: 0.15 } }), [1.8, -2.4], floor(-1.5), false, [30, 25]), 0.15),
  sneakHands(feet(mix(SNEAK, { body: { y: -0.15 } }), floor(2.0), floor(-0.6), false, [5, 35]), -0.15),
];

/**
 * Run: the getaway sprint from the title screen. Leaning in, the loot sack slung over his shoulder in the back
 * fist, the front fist pumping, legs cycling under him.
 */
const RUN_BODY = (dy: number): Pose => ({ body: { rot: 14, x: 0.7, y: dy }, neck: { rot: -10 } });
const runArm = (pose: Pose, swing: number): Pose =>
  hands(
    mix(pose, { armF: { rot: swing }, foreF: { rot: -70 } }),
    pointOf(rig, mix(pose, { sackC: {} }), 'sackC', 0.2, 0.25),
    null,
  );
/** One run pose from leg angles (thigh, shin) and shoe tilts in the world, back leg first. */
const stride = (
  dy: number,
  back: [number, number, number],
  front: [number, number, number],
  swing: number,
): Pose =>
  runArm(
    aim(
      aim(
        mix(RUN_BODY(dy), {
          thighB: { rot: back[0] },
          shinB: { rot: back[1] },
          thighF: { rot: front[0] },
          shinF: { rot: front[1] },
        }),
        'footB',
        back[2],
      ),
      'footF',
      front[2],
    ),
    swing,
  );
const RUN: [Pose, Pose, Pose, Pose] = [
  stride(0.35, [40, 75, 60], [-62, 30, -10], 55),
  stride(-0.55, [-70, 105, 20], [-8, 12, 10], 0),
  stride(0.35, [-62, 30, -10], [40, 75, 60], -55),
  stride(-0.55, [-8, 12, 10], [-70, 105, 20], 0),
];

/** Falling: arms up and out, legs reaching for the floor. */
const FALL = hands(
  mix(AIR, {
    thighF: { rot: -10 },
    shinF: { rot: 15 },
    thighB: { rot: 10 },
    shinB: { rot: 10 },
    footF: { rot: 15 },
  }),
  [-3.6, -9.6],
  [3.4, -10.0],
);
const FALL_2 = hands(FALL, [-3.8, -9.0], [3.6, -9.4]);

/** Rising out of a jump: stretched tall, arms thrown up, legs trailing. */
const RISE = hands(
  mix(AIR, {
    body: { sx: 0.95, sy: 1.07 },
    thighF: { rot: -8 },
    shinF: { rot: 12 },
    thighB: { rot: 12 },
    shinB: { rot: 16 },
    footF: { rot: 30 },
    footB: { rot: 40 },
  }),
  [-3.9, -10.6],
  [3.9, -10.9],
);

/** Jump apex: weightless, knees up, arms floating. */
const APEX = hands(
  mix(AIR, { thighF: { rot: -55 }, shinF: { rot: 85 }, thighB: { rot: -30 }, shinB: { rot: 75 } }),
  [-3.4, -7.8],
  [3.6, -8.4],
);

/** Braced behind the bubble: crouched, head pulled in, fists up in front of his chest. */
const SHIELD = hands(
  feet({ hip: { y: 0.9 }, neck: { y: 0.45, rot: 6 }, body: { rot: 4 } }, floor(-1.6), floor(1.6), true),
  [1.4, -5.6],
  [3.0, -5.9],
  -1,
);

/** Knocked off balance: head snapped back, arms and legs flung, beanie lifted off his head. */
const HIT: Pose = mix(AIR, {
  body: { rot: -20, x: -0.4 },
  neck: { rot: -14 },
  hat: { y: -0.7, rot: -12 },
  armF: { rot: -130 },
  foreF: { rot: -40 },
  armB: { rot: 130 },
  foreB: { rot: 40 },
  thighF: { rot: -45 },
  shinF: { rot: 35 },
  thighB: { rot: 25 },
  shinB: { rot: 25 },
});

/** Launched: spread-eagled, beanie half off. */
const TUMBLE: Pose = mix(AIR, {
  hat: { y: -0.8, rot: -18, x: -0.3 },
  armF: { rot: -150 },
  foreF: { rot: -20 },
  armB: { rot: 140 },
  foreB: { rot: 30 },
  thighF: { rot: -70 },
  shinF: { rot: 80 },
  thighB: { rot: 45 },
  shinB: { rot: 10 },
});

/** Flat on his back, head behind him, beanie askew, legs bent up. */
const DOWN = feet(
  {
    body: { rot: -90, y: 2.35, x: 0.9 },
    neck: { rot: -6 },
    hat: { rot: -12, x: -0.2 },
    armF: { rot: -50 },
    foreF: { rot: -30 },
    armB: { rot: 70 },
    foreB: { rot: 20 },
  },
  [2.4, -1.4],
  [3.3, -0.9],
  false,
  [60, 50],
);

/**
 * Rolled up in a ball for rolls and techs: head tucked, the figure shifted so the body bone (the pivot) sits at
 * the ball's centre and the ball rests on the floor.
 */
const BALL: Pose = mix(TUCK, { body: { y: 1.1, sx: 0.86, sy: 0.86 }, hip: { y: 1.5 }, neck: { y: 1.0 } });
/** The same ball in the air, centred on the body bone for flips. */
const FLIP: Pose = mix(TUCK, { hip: { y: 1.5 }, neck: { y: 1.0 }, body: { y: -1.5 } });

/**
 * Crouch is Bob sneaking, as in his games: down on his tiptoes, hunched over, a finger to his lips and the
 * other hand held up in front with the fingers dangling.
 */
const SNEAK_CROUCH: Pose = (() => {
  const base = feet(
    { body: { rot: 14, x: 0.2 }, hip: { y: 1.5 }, neck: { rot: -12, y: 0.25 } },
    floor(-1.7, -0.05),
    floor(1.7, -0.05),
    false,
    [38, 34],
  );
  return hands(base, [1.6, -4.6], pointOf(rig, base, 'face', 1.0, 3.2), -1);
})();

/** Ledge attack: up onto the stage and a low baton sweep in front. */
const LEDGE_BATON = { baton: 'baton', handF: 'fist' };
const LEDGE_LOW = feet(
  { body: { rot: 22, x: 0.6 }, hip: { y: 1.7 }, neck: { rot: -14 } },
  floor(-2.4),
  floor(2.2),
  false,
  [35, 0],
);
const LEDGE_WIND = aim(hands(LEDGE_LOW, null, [1.0, -3.0], -1), 'baton', 160);
const LEDGE_SWEEP = (() => {
  const p = aim(hands(LEDGE_LOW, null, [3.8, -2.6], -1), 'baton', 6);
  const [sx, sy] = pointOf(rig, p, 'armF');
  const [tx, ty] = pointOf(rig, p, 'baton', 7.5, 0);
  const r = Math.hypot(tx - sx, ty - sy) + 0.3;
  const deg = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
  return mix(p, { fxS: fx(sx, sy, deg, r, -r) });
})();
const LEDGE_FOLLOW = aim(hands(LEDGE_LOW, null, [3.0, -2.8], -1), 'baton', 30);

/** Flipping a gold coin off his thumb for the taunt. */
const coinAt = (x: number, y: number, rot = 0) => ({ fx1: fx(x, y, rot) });

export const clips: Record<string, AnimClip> = {
  idle: {
    length: 96,
    loop: true,
    swaps: FRONT,
    keys: [
      key(0, STAND),
      key(48, BREATHE),
      key(70, undefined, { swaps: FRONT_BLINK }),
      key(75, undefined, { swaps: {} }),
    ],
  },
  walk: cycle(32, WALK, SIDE),
  dash: {
    length: 10,
    swaps: { ...SIDE, ...SACK_ON_BACK },
    keys: [
      key(0, mix(CROUCH, { body: { rot: 22 } }), { ease: 'out' }),
      key(4, mix(RUN[0], { body: { rot: 20, x: 0.8, y: -0.2 } }), { ease: 'linear' }),
      key(10, RUN[1]),
    ],
  },
  run: cycle(22, RUN, { ...SIDE, ...SACK_ON_BACK }),
  runBrake: {
    length: 14,
    swaps: { ...SIDE, ...SACK_ON_BACK },
    keys: [
      key(
        0,
        hands(
          feet({ body: { rot: -18 }, hip: { y: 0.7 } }, floor(-0.6), floor(2.6), false, [0, -25]),
          null,
          [4.2, -6.2],
        ),
        {
          ease: 'out',
          swaps: { ...WIDE, ...SACK_ON_BACK },
        },
      ),
      key(
        8,
        hands(
          feet({ body: { rot: -8 }, hip: { y: 0.45 } }, floor(-0.6), floor(1.9), false, [0, -10]),
          null,
          [3.6, -5.4],
        ),
        {
          swaps: { ...SIDE, ...SACK_ON_BACK },
        },
      ),
      key(14, READY),
    ],
  },
  turn: {
    length: 8,
    swaps: SIDE,
    keys: [
      key(0, mix(READY, { body: { sx: -1 } }), { ease: 'in' }),
      key(3, mix(READY, { body: { sx: -0.4, sy: 1.04 }, hip: { y: 0.2 } }), {
        ease: 'step',
        swaps: FRONT_BLINK,
      }),
      key(4, mix(READY, { body: { sx: 0.4, sy: 1.04 }, hip: { y: 0.2 } }), { ease: 'out' }),
      key(5, undefined, { swaps: {} }),
      key(8, READY),
    ],
  },
  crouch: {
    length: 8,
    swaps: { ...SIDE, face: 'face3qBlink', handF: 'point' },
    keys: [
      key(0, READY, { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
      key(5, mix(SNEAK_CROUCH, { hip: { y: 1.7 } }), { ease: 'out' }),
      key(8, SNEAK_CROUCH),
    ],
  },
  jumpSquat: {
    length: 3,
    swaps: SIDE,
    keys: [key(0, READY, { ease: 'out' }), key(3, mix(CROUCH, { body: { sy: 0.92 } }))],
  },
  jump: {
    length: 40,
    swaps: SIDE,
    keys: [
      key(0, RISE, { ease: 'out' }),
      key(14, mix(RISE, { body: { sx: 1, sy: 1 } }), { ease: 'inOut' }),
      key(26, mix(AIR, { body: { sy: 1.02 } })),
      key(40, APEX),
    ],
  },
  doubleJump: {
    length: 30,
    swaps: SIDE,
    keys: [
      key(0, mix(RISE, { body: { sy: 1.05 } }), { ease: 'out' }),
      key(4, mix(FLIP, { body: { rot: 70 } }), { ease: 'linear', swaps: BLINK }),
      key(9, mix(FLIP, { body: { rot: 190 } }), { ease: 'linear' }),
      key(15, mix(FLIP, { body: { rot: 310 } }), { ease: 'out' }),
      key(21, mix(AIR, { body: { rot: 360 } }), { swaps: {} }),
      key(30, mix(APEX, { body: { rot: 360 } })),
    ],
  },
  fall: {
    length: 40,
    loop: true,
    swaps: { ...SIDE, face: 'face3qWide' },
    keys: [key(0, FALL, { z: ARMS_OVER_HEAD }), key(20, FALL_2)],
  },
  helpless: {
    length: 32,
    loop: true,
    swaps: FRONT_DAZED,
    keys: [
      key(0, mix(FALL, { neck: { rot: 8 } }), { z: ARMS_OVER_HEAD }),
      key(16, mix(FALL_2, { neck: { rot: -8 } })),
    ],
  },
  land: {
    length: 4,
    swaps: SIDE,
    keys: [key(0, mix(CROUCH, { body: { sx: 1.06, sy: 0.9 } }), { ease: 'out' }), key(4, READY)],
  },
  shield: {
    length: 6,
    swaps: { ...ANGRY, handF: 'fist', handB: 'fist' },
    keys: [key(0, READY, { ease: 'out' }), key(6, SHIELD)],
  },
  shieldDrop: {
    length: 11,
    swaps: { ...SIDE, handF: 'fist', handB: 'fist' },
    keys: [key(0, SHIELD, { ease: 'out' }), key(6, undefined, { z: {} }), key(11, READY)],
  },
  shieldBreak: {
    length: 40,
    swaps: FRONT_DAZED,
    keys: [
      key(0, mix(HIT, { body: { rot: -30 } }), { ease: 'out' }),
      key(20, mix(TUCK, { body: { rot: -200 } }), { ease: 'linear' }),
      key(40, mix(HIT, { body: { rot: -360 } })),
    ],
  },
  dizzy: {
    length: 60,
    loop: true,
    swaps: { ...FRONT_DAZED, fx2: 'stars' },
    keys: [
      key(
        0,
        mix(feet({ body: { rot: -8 }, hip: { y: 0.4 }, neck: { rot: -10 } }, floor(-1.2), floor(1.2), true), {
          fx2: fx(-0.6, -14.6, -6),
        }),
      ),
      key(
        30,
        mix(feet({ body: { rot: 8 }, hip: { y: 0.4 }, neck: { rot: 10 } }, floor(-1.2), floor(1.2), true), {
          fx2: fx(0.6, -14.6, 6, -1, 1),
        }),
      ),
      key(
        60,
        mix(feet({ body: { rot: -8 }, hip: { y: 0.4 }, neck: { rot: -10 } }, floor(-1.2), floor(1.2), true), {
          fx2: fx(-0.6, -14.6, -6),
        }),
      ),
    ],
  },
  spotDodge: {
    length: 27,
    swaps: SIDE,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(
        3,
        hands(mix(CROUCH, { hip: { y: 1.8 }, body: { sy: 0.86, rot: 0 } }), [-0.6, -11.2], [1.4, -11.6]),
        {
          ease: 'out',
          swaps: { ...FRONT_WIDE, handB: 'handOpen' },
          z: ARMS_OVER_HEAD,
        },
      ),
      key(
        18,
        hands(mix(CROUCH, { hip: { y: 1.6 }, body: { sy: 0.88, rot: 0 } }), [-0.6, -11.0], [1.4, -11.4]),
        {
          ease: 'inOut',
        },
      ),
      key(22, undefined, { swaps: {}, z: {} }),
      key(27, READY),
    ],
  },
  rollForward: {
    length: 31,
    swaps: SIDE,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(4, CROUCH, { ease: 'out' }),
      key(6, BALL, { ease: 'linear', swaps: BLINK }),
      key(14, mix(BALL, { body: { rot: 180 } }), { ease: 'linear' }),
      key(22, mix(BALL, { body: { rot: 360 } }), { ease: 'out', swaps: {} }),
      key(26, mix(CROUCH, { body: { sx: -1 } }), { ease: 'out' }),
      key(31, mix(READY, { body: { sx: -1 } })),
    ],
  },
  rollBack: {
    length: 31,
    swaps: SIDE,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(4, CROUCH, { ease: 'out' }),
      key(6, BALL, { ease: 'linear', swaps: BLINK }),
      key(14, mix(BALL, { body: { rot: -180 } }), { ease: 'linear' }),
      key(22, mix(BALL, { body: { rot: -360 } }), { ease: 'out', swaps: {} }),
      key(26, CROUCH, { ease: 'out' }),
      key(31, READY),
    ],
  },
  airDodge: {
    length: 49,
    swaps: BLINK,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(4, mix(TUCK, { body: { rot: -20, sx: 0.92, sy: 1.06 } })),
      key(30, mix(TUCK, { body: { rot: -30 } }), { ease: 'inOut' }),
      key(34, undefined, { swaps: SIDE }),
      key(49, AIR),
    ],
  },
  ledgeCatch: {
    length: 8,
    swaps: { ...WIDE, handF: 'handOpen', handB: 'handOpen' },
    keys: [
      key(
        0,
        hang(GX, GY, { body: { x: 0.9, y: -0.8, rot: -4 }, thighF: { rot: -50 }, thighB: { rot: 35 } }),
        {
          ease: 'outBack',
        },
      ),
      key(8, HANG, { swaps: HANG_LOOK }),
    ],
  },
  ledgeHang: {
    length: 60,
    loop: true,
    swaps: HANG_LOOK,
    keys: [
      key(0, HANG),
      key(
        30,
        hang(GX, GY, {
          body: { x: 0.9, y: -2.0, rot: 4 },
          neck: { rot: 2 },
          thighF: { rot: -8 },
          thighB: { rot: 16 },
        }),
      ),
      key(60, HANG),
    ],
  },
  ledgeClimb: {
    length: 34,
    swaps: HANG_LOOK,
    keys: [
      key(0, HANG, { ease: 'linear' }),
      key(6, pull(6, 30, 6.25, 0.5), { ease: 'linear' }),
      key(12, pull(12, 30, 6.25, 1), { ease: 'out' }),
      key(18, lift(mix(CROUCH, { body: { rot: 14 } }), below(18, 30)), { ease: 'inOut', swaps: SIDE }),
      key(26, lift(READY, below(26, 30))),
      key(34, READY),
    ],
  },
  ledgeRoll: {
    length: 50,
    swaps: HANG_LOOK,
    keys: [
      key(0, HANG, { ease: 'linear' }),
      key(6, pull(6, 40, 25, 0.6), { ease: 'linear' }),
      ...[10, 16, 22, 28, 34].map((f, i) =>
        key(f, lift(mix(BALL, { body: { rot: i * 90 } }), below(f, 40)), {
          ease: 'linear',
          ...(f === 10 ? { swaps: BLINK } : {}),
        }),
      ),
      key(38, lift(mix(CROUCH, { body: { rot: 360 } }), below(38, 40)), { ease: 'out', swaps: SIDE }),
      key(50, mix(READY, { body: { rot: 360 } })),
    ],
  },
  ledgeJump: {
    length: 20,
    swaps: HANG_LOOK,
    keys: [
      key(0, HANG, { ease: 'in' }),
      key(4, lift(mix(CROUCH, { body: { rot: -6 } }), 2), { ease: 'out', swaps: SIDE }),
      key(8, RISE, { ease: 'out' }),
      key(20, mix(AIR, { body: { sy: 1.02 } }), { z: {} }),
    ],
  },
  ledgeAttack: {
    length: 55,
    swaps: HANG_LOOK,
    keys: [
      key(0, HANG, { ease: 'linear' }),
      key(5, pull(5, 20, 6.25, 0.6), { ease: 'linear' }),
      key(11, lift(mix(CROUCH, { body: { rot: 10 } }), below(11, 20)), {
        ease: 'out',
        swaps: { ...ANGRY, ...LEDGE_BATON },
      }),
      key(18, LEDGE_WIND, { ease: 'in' }),
      key(22, LEDGE_SWEEP, {
        ease: 'linear',
        swaps: { ...ANGRY, ...LEDGE_BATON, face: 'face3qShout', smear: 'smear90' },
      }),
      key(25, LEDGE_SWEEP, { ease: 'out' }),
      key(30, LEDGE_FOLLOW, { ease: 'inOut', swaps: { ...ANGRY, ...LEDGE_BATON } }),
      key(55, READY, { swaps: SIDE }),
    ],
  },
  hitstun: {
    length: 20,
    swaps: HURT,
    keys: [
      key(0, HIT, { ease: 'out' }),
      key(6, mix(HIT, { body: { rot: -28 } })),
      key(20, mix(HIT, { body: { rot: -12 }, hat: {}, armF: { rot: -80 }, armB: { rot: 80 } })),
    ],
  },
  tumble: {
    length: 32,
    loop: true,
    swaps: { ...HURT, face: 'face3qHurt' },
    keys: [
      key(0, TUMBLE, { ease: 'linear' }),
      key(16, mix(TUMBLE, { body: { rot: 180 }, armF: { rot: -120 }, thighF: { rot: -95 } }), {
        ease: 'linear',
      }),
      key(32, mix(TUMBLE, { body: { rot: 360 } })),
    ],
  },
  down: {
    length: 40,
    loop: true,
    swaps: { ...HURT, face: 'face3qHurt' },
    keys: [
      key(0, DOWN),
      key(20, mix(DOWN, { armF: { rot: -60 }, hat: { rot: -16, x: -0.3 } })),
      key(40, DOWN),
    ],
  },
  getupStand: {
    length: 30,
    swaps: HURT,
    keys: [
      key(0, DOWN, { ease: 'in' }),
      key(10, feet({ body: { rot: -40, y: 1.6 }, armB: { rot: 90 } }, floor(0.8), floor(2.0)), {
        ease: 'out',
        swaps: SIDE,
      }),
      key(20, CROUCH, { ease: 'out' }),
      key(30, READY),
    ],
  },
  techInPlace: {
    length: 26,
    swaps: BLINK,
    keys: [
      key(0, mix(CROUCH, { body: { rot: -20 } }), { ease: 'out' }),
      key(6, mix(CROUCH, { body: { sx: 1.05, sy: 0.92 } }), { ease: 'inOut' }),
      key(14, undefined, { swaps: ANGRY }),
      key(26, READY),
    ],
  },
  techRoll: {
    length: 40,
    swaps: SIDE,
    keys: [
      key(0, mix(CROUCH, { body: { rot: -20 } }), { ease: 'out', swaps: BLINK }),
      key(5, BALL, { ease: 'linear' }),
      key(16, mix(BALL, { body: { rot: 180 } }), { ease: 'linear' }),
      key(27, mix(BALL, { body: { rot: 360 } }), { ease: 'out', swaps: {} }),
      key(32, mix(CROUCH, { body: { rot: 360 } }), { ease: 'out' }),
      key(40, mix(READY, { body: { rot: 360 } })),
    ],
  },
  grabbed: {
    length: 20,
    loop: true,
    swaps: HURT,
    keys: [
      key(0, mix(HIT, { body: { rot: -8, y: -0.6 }, hat: {} })),
      key(10, mix(HIT, { body: { rot: -2, y: -0.7 }, hat: {}, thighF: { rot: -20 }, thighB: { rot: 35 } })),
      key(20, mix(HIT, { body: { rot: -8, y: -0.6 }, hat: {} })),
    ],
  },
  grabRelease: {
    length: 29,
    swaps: WIDE,
    keys: [
      key(0, mix(HIT, { body: { rot: -14 }, hat: {} }), { ease: 'out' }),
      key(10, feet({ body: { rot: -12 }, hip: { y: 0.6 } }, floor(-2.2), floor(1.0)), {
        ease: 'inOut',
        swaps: SIDE,
      }),
      key(29, READY),
    ],
  },
  taunt: {
    length: 60,
    swaps: { ...SIDE, handF: 'fist', fx1: 'coin' },
    keys: [
      key(0, mix(READY, coinAt(3.9, -5.6)), { ease: 'out' }),
      key(6, mix(hands(READY, null, [3.0, -6.4]), coinAt(3.4, -6.6)), {
        ease: 'out',
        swaps: { ...SIDE, handF: 'fist', fx1: 'coin' },
      }),
      key(10, mix(hands(READY, null, [3.4, -7.4]), coinAt(4.2, -10.5, 0)), {
        ease: 'out',
        swaps: { ...GRIN, handF: 'handOpen', fx1: 'coinEdge' },
      }),
      key(18, mix(hands(READY, null, [3.4, -7.0]), coinAt(4.6, -17.0, 90)), {
        ease: 'in',
        swaps: { ...GRIN, handF: 'handOpen', fx1: 'coin' },
      }),
      key(22, undefined, { swaps: { ...GRIN, handF: 'handOpen', fx1: 'coinEdge' } }),
      key(26, mix(hands(READY, null, [3.6, -6.8]), coinAt(4.4, -11.0, 180)), {
        ease: 'in',
        swaps: { ...GRIN, handF: 'handOpen', fx1: 'coin' },
      }),
      key(30, mix(hands(READY, null, [3.4, -6.6]), coinAt(3.9, -7.6, 270)), {
        ease: 'out',
        swaps: { ...GRIN, handF: 'fist', fx1: null },
      }),
      key(36, mix(hands(READY, null, [2.2, -8.6]), { neck: { rot: -6 } }), {
        ease: 'inOut',
        swaps: { ...FRONT_GRIN, handF: 'fist', fx1: null },
      }),
      key(50, mix(hands(READY, null, [2.3, -8.4]), { neck: { rot: -4 } }), { ease: 'inOut' }),
      key(60, READY, { swaps: { ...SIDE, fx1: null } }),
    ],
  },
  respawn: {
    length: 60,
    loop: true,
    swaps: FRONT,
    keys: [key(0, STAND), key(30, BREATHE), key(60, STAND)],
  },
  ...attacks,
};
