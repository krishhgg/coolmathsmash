import type { Pose } from '../../../render/rig/author';
import type { AnimClip } from '../../../render/rig/types';
import { attacks } from './attacks';
import {
  AIR,
  ANGRY,
  BLINK,
  CROUCH,
  FRONT,
  HEAD_BEHIND,
  HURT,
  NO_BODY,
  SIDE,
  SIDE_ANGRY,
  STAND,
  TUCK,
  UP,
  feet,
  flame,
  hands,
  key,
  mix,
} from './poses';

/**
 * Where the hands hold the ledge (rig space): the ledge's top corner while hanging. It matches the engine's
 * hang position (feet width / 2 + 0.5 out from the corner and 0.85 x height below it). Fireboy's arms start
 * under his huge head, so in ledge clips they re-root behind the head and stretch up to the corner.
 */
export const LEDGE_GRIP: [number, number] = [4.5, -12.75];
const [GX, GY] = LEDGE_GRIP;

/**
 * How far below the floor the fighter's origin still is `frame` frames into a ledge getup: the engine lifts
 * the origin from the hang position to the floor with a smoothstep that finishes rising at 1/1.6 of `moveEnd`.
 */
function belowFloor(frame: number, moveEnd: number): number {
  const t = Math.min(1, frame / moveEnd);
  return -GY * (1 - Math.min(1, 1.6 * t * t * (3 - 2 * t)));
}

/** Hanging with arms re-rooted behind the head (`reach` scales them) and hands on rig point (hx, hy). */
function hang(hx: number, hy: number, reach: number, extra: Pose = {}): Pose {
  return hands(
    mix(
      {
        body: { rot: -4, x: 0.4 },
        neck: { rot: -6 },
        armF: { x: 1.6, y: -5.8, sy: reach },
        foreF: { sy: reach },
        armB: { x: 1.0, y: -6.0, sy: reach },
        foreB: { sy: reach },
        thighF: { rot: -10 },
        shinF: { rot: 14 },
        thighB: { rot: 8 },
        shinB: { rot: 10 },
      },
      extra,
    ),
    [hx - 0.3, hy + 0.1],
    [hx, hy],
    1,
  );
}

/** Mid pull-up `frame` frames into a getup: hands still on the corner, which sinks as the engine lifts him. */
function pull(frame: number, moveEnd: number, progress: number): Pose {
  const below = belowFloor(frame, moveEnd);
  const reach = 2.6 - 1.6 * progress;
  return hang(GX - 1.5 * progress, -below, reach, {
    armF: { x: 1.6 * (1 - progress), y: -5.8 * (1 - progress), sy: reach },
    armB: { x: 1.0 * (1 - progress), y: -6.0 * (1 - progress), sy: reach },
    thighF: { rot: -10 - 70 * progress },
    shinF: { rot: 14 + 90 * progress },
    thighB: { rot: 8 - 30 * progress },
    shinB: { rot: 10 + 70 * progress },
  });
}

const BREATHE = hands(
  feet({ hip: { y: 0.12 }, neck: { rot: 1.5 }, head: { sx: 1.015, sy: 0.99 } }, [-0.45, 0], [0.45, 0], true),
  [-1.2, -2.1],
  [1.22, -2.08],
);

/** A walk or run cycle: two contacts and two passing poses, mirrored. */
function cycle(length: number, contact: Pose, passing: Pose, swap: (p: Pose) => Pose): AnimClip {
  const q = length / 4;
  return {
    length,
    loop: true,
    swaps: SIDE,
    keys: [
      key(0, contact, { ease: 'linear' }),
      key(q, passing, { ease: 'linear' }),
      key(2 * q, swap(contact), { ease: 'linear' }),
      key(3 * q, swap(passing), { ease: 'linear' }),
    ],
  };
}

/** Swaps the legs' and arms' roles (left/right step). */
function mirrorLimbs(p: Pose): Pose {
  const out: Pose = { ...p };
  const pairs: [string, string][] = [
    ['thighF', 'thighB'],
    ['shinF', 'shinB'],
    ['armF', 'armB'],
    ['foreF', 'foreB'],
  ];
  for (const [a, b] of pairs) {
    out[a] = { ...p[b] };
    out[b] = { ...p[a] };
  }
  // arm rest angles are mirrored, so a swapped arm offset needs the rest difference
  if (p.armF || p.armB) {
    out.armF = { ...out.armF, rot: (p.armB?.rot ?? 0) + 48 };
    out.armB = { ...out.armB, rot: (p.armF?.rot ?? 0) - 48 };
  }
  return out;
}

const WALK_CONTACT: Pose = {
  body: { rot: 4 },
  hip: { y: 0.12 },
  thighF: { rot: -30 },
  shinF: { rot: 12 },
  thighB: { rot: 24 },
  shinB: { rot: 18 },
  armF: { rot: 40 },
  foreF: { rot: -10 },
  armB: { rot: -34 },
  foreB: { rot: -20 },
  neck: { rot: 2 },
};
const WALK_PASS: Pose = {
  body: { rot: 4, y: -0.12 },
  thighF: { rot: -2 },
  shinF: { rot: 4 },
  thighB: { rot: -22 },
  shinB: { rot: 55 },
  armF: { rot: 22 },
  armB: { rot: -24 },
  neck: { rot: 1 },
};

const RUN_CONTACT: Pose = {
  body: { rot: 14, y: 0.15 },
  hip: { y: 0.15 },
  thighF: { rot: -55 },
  shinF: { rot: 25 },
  thighB: { rot: 42 },
  shinB: { rot: 48 },
  armF: { rot: 70 },
  foreF: { rot: -60 },
  armB: { rot: -80 },
  foreB: { rot: -60 },
  neck: { rot: 4 },
};
const RUN_PASS: Pose = {
  body: { rot: 12, y: -0.45 },
  thighF: { rot: 5 },
  shinF: { rot: 20 },
  thighB: { rot: -40 },
  shinB: { rot: 105 },
  armF: { rot: 20 },
  foreF: { rot: -50 },
  armB: { rot: -30 },
  foreB: { rot: -50 },
  neck: { rot: 2 },
};

const FALL = mix(AIR, {
  armF: { rot: -100 },
  foreF: { rot: -40 },
  armB: { rot: 100 },
  foreB: { rot: 40 },
  thighF: { rot: -12 },
  shinF: { rot: 22 },
  thighB: { rot: 8 },
  shinB: { rot: 20 },
});
const FALL_2 = mix(FALL, { armF: { rot: -85 }, armB: { rot: 85 }, foreF: { rot: -55 }, foreB: { rot: 55 } });

const APEX = mix(AIR, {
  thighF: { rot: -60 },
  shinF: { rot: 85 },
  thighB: { rot: -25 },
  shinB: { rot: 90 },
  armF: { rot: -70 },
  foreF: { rot: -50 },
  armB: { rot: 70 },
  foreB: { rot: 50 },
});

const RISE: Pose = {
  body: { sx: 0.94, sy: 1.08 },
  thighF: { rot: -6 },
  shinF: { rot: 8 },
  thighB: { rot: 8 },
  shinB: { rot: 10 },
  armF: { rot: -150 },
  foreF: { rot: -10 },
  armB: { rot: 150 },
  foreB: { rot: 10 },
};

const SHIELD = hands(
  feet({ hip: { y: 0.55 }, neck: { y: 0.25, rot: 6 }, body: { rot: 4 } }, [-0.85, 0], [0.85, 0], true),
  [1.35, -3.65],
  [1.65, -3.25],
  -1,
);

const HANG = hang(GX, GY, 2.6);

/** Lying on his back, head on the floor behind him, legs drawn up. */
const DOWN = feet(
  {
    body: { rot: -90, y: 2.35, x: 0.6 },
    neck: { rot: -10 },
    armF: { rot: -40 },
    foreF: { rot: -20 },
    armB: { rot: 60 },
    foreB: { rot: 20 },
  },
  [3.7, 0],
  [4.6, 0],
);

const HIT = mix(AIR, {
  body: { rot: -22, x: -0.3 },
  neck: { rot: -12 },
  armF: { rot: -120 },
  foreF: { rot: -30 },
  armB: { rot: 120 },
  foreB: { rot: 30 },
  thighF: { rot: -40 },
  shinF: { rot: 30 },
  thighB: { rot: 20 },
  shinB: { rot: 20 },
});

const SPREAD = mix(AIR, {
  armF: { rot: -95 },
  foreF: { rot: -10 },
  armB: { rot: 95 },
  foreB: { rot: 10 },
  thighF: { rot: -45 },
  shinF: { rot: 10 },
  thighB: { rot: 45 },
  shinB: { rot: -10 },
});

const ROLL_BALL: Pose = { body: { y: 3.7 } };

export const clips: Record<string, AnimClip> = {
  idle: {
    length: 96,
    loop: true,
    swaps: FRONT,
    keys: [
      key(0, STAND),
      key(48, BREATHE),
      key(70, undefined, { swaps: BLINK }),
      key(75, undefined, { swaps: {} }),
    ],
  },
  walk: cycle(36, WALK_CONTACT, WALK_PASS, mirrorLimbs),
  dash: {
    length: 10,
    swaps: SIDE,
    keys: [
      key(0, mix(CROUCH, { body: { rot: 18 }, armF: { rot: 30 }, armB: { rot: -30 } }), { ease: 'out' }),
      key(4, mix(RUN_CONTACT, { thighF: { rot: -70 }, thighB: { rot: 55 }, body: { rot: 18, y: -0.2 } }), {
        ease: 'linear',
      }),
      key(10, RUN_PASS),
    ],
  },
  run: cycle(24, RUN_CONTACT, RUN_PASS, mirrorLimbs),
  runBrake: {
    length: 14,
    swaps: SIDE,
    keys: [
      key(
        0,
        hands(feet({ body: { rot: -16 }, hip: { y: 0.5 } }, [-0.4, 0], [2.0, 0]), [-1.6, -4.4], [-0.6, -4.9]),
        { ease: 'out' },
      ),
      key(
        8,
        hands(feet({ body: { rot: -8 }, hip: { y: 0.35 } }, [-0.3, 0], [1.4, 0]), [-1.4, -3.5], [-0.2, -4.0]),
        {
          swaps: FRONT,
        },
      ),
      key(14, STAND),
    ],
  },
  turn: {
    length: 8,
    swaps: FRONT,
    keys: [
      key(0, mix(STAND, { body: { sx: -1 } }), { ease: 'in' }),
      key(3, mix(STAND, { body: { sx: -0.2, sy: 1.04 }, hip: { y: 0.15 } }), { ease: 'step', swaps: BLINK }),
      key(4, mix(STAND, { body: { sx: 0.2, sy: 1.04 }, hip: { y: 0.15 } }), { ease: 'out' }),
      key(6, undefined, { swaps: {} }),
      key(8, STAND),
    ],
  },
  crouch: {
    length: 6,
    swaps: FRONT,
    keys: [key(0, STAND, { ease: 'out' }), key(6, CROUCH)],
  },
  jumpSquat: {
    length: 3,
    swaps: FRONT,
    keys: [key(0, STAND, { ease: 'out' }), key(3, mix(CROUCH, { head: { sx: 1.1, sy: 0.86 } }))],
  },
  jump: {
    length: 40,
    swaps: UP,
    keys: [
      key(0, RISE, { ease: 'out', z: HEAD_BEHIND }),
      key(14, mix(RISE, { body: { sx: 1, sy: 1 }, armF: { rot: -120 }, armB: { rot: 120 } }), {
        ease: 'inOut',
      }),
      key(24, mix(AIR, { body: { sy: 1.02 } }), { swaps: FRONT, z: {} }),
      key(40, APEX),
    ],
  },
  doubleJump: {
    length: 30,
    swaps: FRONT,
    keys: [
      key(0, mix(AIR, { body: { sy: 1.06 }, fx4: flame(0, 1.2, 1.1, 90, 1.3) }), {
        ease: 'out',
        swaps: { fxBack: 'fxFlame' },
      }),
      key(4, mix(TUCK, { body: { rot: 60 }, fx4: flame(0, 2.6, 0.5, 90, 1.3) }), { ease: 'linear' }),
      key(8, mix(TUCK, { body: { rot: 180 } }), { ease: 'linear', swaps: {} }),
      key(14, mix(TUCK, { body: { rot: 300 } }), { ease: 'out' }),
      key(20, mix(AIR, { body: { rot: 360 } })),
      key(30, mix(APEX, { body: { rot: 360 } })),
    ],
  },
  fall: {
    length: 40,
    loop: true,
    swaps: FRONT,
    keys: [key(0, FALL), key(20, FALL_2)],
  },
  land: {
    length: 4,
    swaps: FRONT,
    keys: [key(0, mix(CROUCH, { head: { sx: 1.12, sy: 0.85 } }), { ease: 'out' }), key(4, STAND)],
  },
  shield: {
    length: 6,
    swaps: ANGRY,
    keys: [key(0, STAND, { ease: 'out' }), key(6, SHIELD)],
  },
  spotDodge: {
    length: 27,
    swaps: FRONT,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(3, mix(CROUCH, { head: { sx: 1.15, sy: 0.82 } }), { ease: 'out', swaps: BLINK }),
      key(
        8,
        hands(
          feet(
            { body: { x: -0.5, rot: -10 }, hip: { y: 0.4 }, head: { sx: 0.9, sy: 1.1 } },
            [-0.6, 0],
            [0.6, 0],
            true,
          ),
          [-1.8, -3],
          [0.6, -2.6],
        ),
      ),
      key(
        19,
        hands(
          feet(
            { body: { x: -0.4, rot: -8 }, hip: { y: 0.35 }, head: { sx: 0.92, sy: 1.08 } },
            [-0.6, 0],
            [0.6, 0],
            true,
          ),
          [-1.8, -3],
          [0.6, -2.6],
        ),
        {
          ease: 'inOut',
        },
      ),
      key(22, undefined, { swaps: {} }),
      key(27, STAND),
    ],
  },
  rollForward: {
    length: 31,
    swaps: FRONT,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(4, CROUCH, { ease: 'out' }),
      key(6, ROLL_BALL, { ease: 'linear', swaps: { ...NO_BODY, ...SIDE_ANGRY } }),
      key(23, ROLL_BALL, { ease: 'out', swaps: {} }),
      key(26, mix(CROUCH, { body: { sx: -1 } }), { ease: 'out' }),
      key(31, mix(STAND, { body: { sx: -1 } })),
    ],
  },
  rollBack: {
    length: 31,
    swaps: FRONT,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(4, CROUCH, { ease: 'out' }),
      key(6, mix(ROLL_BALL, { body: { sx: -1 } }), { ease: 'linear', swaps: { ...NO_BODY, ...SIDE_ANGRY } }),
      key(23, mix(ROLL_BALL, { body: { sx: -1 } }), { ease: 'out', swaps: {} }),
      key(26, CROUCH, { ease: 'out' }),
      key(31, STAND),
    ],
  },
  airDodge: {
    length: 49,
    swaps: FRONT,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(4, mix(TUCK, { body: { rot: -20, sx: 0.92, sy: 1.06 } }), { swaps: BLINK }),
      key(30, mix(TUCK, { body: { rot: -30 } }), { ease: 'inOut' }),
      key(34, undefined, { swaps: {} }),
      key(49, AIR),
    ],
  },
  ledgeCatch: {
    length: 8,
    swaps: ANGRY,
    keys: [
      key(0, hang(GX, GY, 3.0, { body: { y: 0.8, rot: -10 }, thighF: { rot: -40 }, thighB: { rot: 30 } }), {
        ease: 'outBack',
      }),
      key(8, HANG),
    ],
  },
  ledgeHang: {
    length: 60,
    loop: true,
    swaps: FRONT,
    keys: [
      key(0, HANG),
      key(
        30,
        hang(GX, GY, 2.65, {
          body: { rot: -7, x: 0.3 },
          neck: { rot: -2 },
          thighF: { rot: -4 },
          thighB: { rot: 14 },
        }),
      ),
    ],
  },
  ledgeClimb: {
    length: 34,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear' }),
      key(6, pull(6, 30, 0.45), { ease: 'linear' }),
      key(12, pull(12, 30, 1), { ease: 'out' }),
      key(18, mix(CROUCH, { body: { rot: 8 } }), { ease: 'inOut', swaps: FRONT }),
      key(34, STAND),
    ],
  },
  ledgeRoll: {
    length: 50,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear' }),
      key(6, pull(6, 40, 0.6), { ease: 'linear' }),
      ...[10, 14, 18, 22, 26, 34].map((f) =>
        key(
          f,
          { body: { y: 3.7 - belowFloor(f, 40) } },
          { ease: 'linear', ...(f === 10 ? { swaps: { ...NO_BODY, ...SIDE_ANGRY } } : {}) },
        ),
      ),
      key(37, mix(CROUCH, { head: { sx: 1.1, sy: 0.88 } }), { ease: 'out', swaps: FRONT }),
      key(50, STAND),
    ],
  },
  ledgeJump: {
    length: 20,
    swaps: FRONT,
    keys: [
      key(0, HANG, { ease: 'in' }),
      key(4, pull(4, 6, 0.8), { ease: 'out' }),
      key(6, RISE, { ease: 'out', swaps: UP, z: HEAD_BEHIND }),
      key(20, mix(AIR, { body: { sy: 1.02 } }), { swaps: FRONT, z: {} }),
    ],
  },
  ledgeAttack: {
    length: 55,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear' }),
      key(5, pull(5, 20, 0.6), { ease: 'linear' }),
      key(10, mix(CROUCH, { body: { rot: 6 } }), { ease: 'out', swaps: FRONT }),
      key(
        16,
        hands(
          feet({ body: { rot: -10 }, hip: { y: 0.3 } }, [-0.8, 0], [0.7, 0], true),
          [-1.8, -4.6],
          [-0.9, -5.0],
        ),
        {
          ease: 'in',
          swaps: ANGRY,
        },
      ),
      key(
        19,
        mix(
          hands(
            feet({ body: { rot: -14 }, hip: { y: 0.15 } }, [-0.7, 0], [0.9, 0], true),
            [-1.9, -4.7],
            [-0.9, -5.1],
          ),
          {
            thighF: { rot: -100 },
            shinF: { rot: -4 },
            fx1: flame(6, -3.2, 2.5, -4, 1.2),
          },
        ),
        { ease: 'linear', swaps: { fx1: 'fxFlame', head: 'headFront', face: 'faceFrontShout' } },
      ),
      key(
        24,
        mix(
          hands(
            feet({ body: { rot: -12 }, hip: { y: 0.15 } }, [-0.7, 0], [0.9, 0], true),
            [-1.9, -4.7],
            [-0.9, -5.1],
          ),
          {
            thighF: { rot: -96 },
            shinF: { rot: -4 },
            fx1: flame(7, -3.3, 0.6, -4),
          },
        ),
        { ease: 'inOut' },
      ),
      key(25, undefined, { swaps: ANGRY }),
      key(55, STAND),
    ],
  },
  hitstun: {
    length: 20,
    swaps: HURT,
    keys: [
      key(0, HIT, { ease: 'out' }),
      key(6, mix(HIT, { body: { rot: -28 } })),
      key(20, mix(HIT, { body: { rot: -14 }, armF: { rot: -80 }, armB: { rot: 80 } })),
    ],
  },
  tumble: {
    length: 30,
    loop: true,
    swaps: HURT,
    keys: [
      key(0, mix(SPREAD, { body: { rot: 0 } }), { ease: 'linear' }),
      key(15, mix(SPREAD, { body: { rot: -180 }, thighF: { rot: -70 } }), { ease: 'linear' }),
      key(30, mix(SPREAD, { body: { rot: -360 } }), { ease: 'linear' }),
    ],
  },
  helpless: {
    length: 32,
    loop: true,
    swaps: { head: 'headFront', face: 'faceFrontBlink' },
    keys: [
      key(0, mix(FALL, { armF: { rot: -70 }, armB: { rot: 70 }, neck: { rot: 6, y: 0.15 } })),
      key(16, mix(FALL_2, { armF: { rot: -55 }, armB: { rot: 55 }, neck: { rot: 3, y: 0.15 } })),
    ],
  },
  knockdown: {
    length: 40,
    loop: true,
    swaps: HURT,
    keys: [key(0, DOWN), key(20, mix(DOWN, { head: { sx: 1.03, sy: 0.97 }, armF: { rot: -50 } }))],
  },
  getUp: {
    length: 30,
    swaps: HURT,
    keys: [
      key(0, DOWN, { ease: 'in' }),
      key(10, mix(feet({ body: { rot: -40, y: 1.6 } }, [0.6, 0], [1.8, 0]), { armB: { rot: 90 } }), {
        ease: 'out',
        swaps: FRONT,
      }),
      key(20, CROUCH, { ease: 'out' }),
      key(30, STAND),
    ],
  },
  tech: {
    length: 26,
    swaps: BLINK,
    keys: [
      key(0, mix(CROUCH, { body: { rot: -20 } }), { ease: 'out' }),
      key(6, mix(CROUCH, { head: { sx: 1.1, sy: 0.88 } }), { ease: 'inOut' }),
      key(14, undefined, { swaps: ANGRY }),
      key(26, STAND),
    ],
  },
  techRoll: {
    length: 40,
    swaps: FRONT,
    keys: [
      key(0, mix(CROUCH, { body: { rot: -20 } }), { ease: 'out', swaps: BLINK }),
      key(5, ROLL_BALL, { ease: 'linear', swaps: { ...NO_BODY, ...SIDE_ANGRY } }),
      key(28, ROLL_BALL, { ease: 'out', swaps: {} }),
      key(32, CROUCH, { ease: 'out' }),
      key(40, STAND),
    ],
  },
  dizzy: {
    length: 60,
    loop: true,
    swaps: HURT,
    keys: [
      key(
        0,
        hands(
          feet({ body: { rot: -8 }, hip: { y: 0.3 }, neck: { rot: -10 } }, [-0.6, 0], [0.6, 0], true),
          [-1.6, -2.4],
          [1.2, -1.9],
        ),
      ),
      key(
        30,
        hands(
          feet({ body: { rot: 8 }, hip: { y: 0.3 }, neck: { rot: 10 } }, [-0.6, 0], [0.6, 0], true),
          [-1.2, -1.9],
          [1.6, -2.4],
        ),
      ),
    ],
  },
  grabHold: {
    length: 30,
    loop: true,
    swaps: ANGRY,
    keys: [
      key(
        0,
        hands(
          feet({ body: { rot: 6 }, hip: { y: 0.3 } }, [-0.7, 0], [0.8, 0], true),
          [1.7, -4.0],
          [2.0, -3.5],
          -1,
        ),
      ),
      key(
        15,
        hands(
          feet({ body: { rot: 5 }, hip: { y: 0.36 } }, [-0.7, 0], [0.8, 0], true),
          [1.7, -3.95],
          [2.0, -3.45],
          -1,
        ),
      ),
    ],
  },
  grabbed: {
    length: 20,
    loop: true,
    swaps: HURT,
    keys: [
      key(0, mix(HIT, { body: { rot: -8, y: -0.6 } })),
      key(10, mix(HIT, { body: { rot: -2, y: -0.7 }, thighF: { rot: -20 }, thighB: { rot: 35 } })),
    ],
  },
  taunt: {
    length: 60,
    swaps: FRONT,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(8, mix(CROUCH, { fx4: flame(0, -7.6, 0.5) }), {
        ease: 'out',
        swaps: { head: 'headFront', face: 'faceFrontBlink', fxBack: 'fxFlame' },
      }),
      key(
        16,
        mix(
          hands(
            feet({ body: { sy: 1.06, sx: 0.96 } }, [-0.6, 0], [0.6, 0], true),
            [-2.2, -5.0],
            [2.2, -5.0],
            -1,
          ),
          { fx4: flame(0, -7.8, 5.2, -90, 1.15) },
        ),
        {
          ease: 'outBack',
          swaps: { head: 'headFront', face: 'faceFrontShout', fxBack: 'fxFlame' },
        },
      ),
      key(
        44,
        mix(hands(feet({}, [-0.6, 0], [0.6, 0], true), [-2.1, -4.9], [2.1, -4.9], -1), {
          fx4: flame(0, -7.7, 4.6, -90, 1.1),
        }),
        { ease: 'in' },
      ),
      key(52, mix(STAND, { fx4: flame(0, -7.5, 1) }), { swaps: { fxBack: 'fxFlame' } }),
      key(56, undefined, { swaps: {} }),
      key(60, STAND),
    ],
  },
  shieldDrop: {
    length: 11,
    swaps: FRONT,
    keys: [key(0, SHIELD, { ease: 'out' }), key(11, STAND)],
  },
  shieldBreak: {
    length: 40,
    swaps: HURT,
    keys: [
      key(0, mix(HIT, { body: { rot: -30 } }), { ease: 'out' }),
      key(20, mix(TUCK, { body: { rot: -200 } }), { ease: 'linear' }),
      key(40, mix(HIT, { body: { rot: -360 } })),
    ],
  },
  respawn: {
    length: 60,
    loop: true,
    swaps: FRONT,
    keys: [key(0, STAND), key(30, BREATHE)],
  },
  ...attacks,
};
