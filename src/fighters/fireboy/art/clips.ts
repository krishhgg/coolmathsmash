import { pointOf, type Pose } from '../../../render/rig/author';
import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip } from '../../../render/rig/types';
import { attacks } from './attacks';
import { finalSmashAirClip, finalSmashClip } from './finalSmash';
import {
  AIR,
  ANGRY,
  ARMS_IN_FRONT,
  BLINK,
  CROUCH,
  FRONT,
  HEAD_BEHIND,
  HURT,
  MITTENS,
  NO_BODY,
  SIDE,
  SIDE_ANGRY,
  SIDE_HURT,
  SIDE_SHOUT,
  STAND,
  TUCK,
  UP,
  feet,
  flame,
  hands,
  key,
  mix,
  type Pt,
} from './poses';
import { FORE_ARM, UPPER_ARM } from './parts';
import { rig } from './rig';

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

/**
 * How far the body hangs below the hang position (negative: above it). Fireboy's arms are short, so like Kirby
 * he hangs with the ball of his head just under the lip and only his flames above it.
 */
const DROP = -1.0;

/**
 * Hanging from rig point (hx, hy) with the body `drop` lower: both arms re-rooted at the wall side of the
 * head, in front of it, stretched just enough to reach the lip; legs dangling together.
 */
function hang(hx: number, hy: number, drop: number, extra: Pose = {}): Pose {
  const base = mix(
    {
      body: { rot: 5, x: 0.9, y: drop },
      neck: { rot: -3 },
      armF: { x: 2.4, y: -6.6 },
      armB: { x: 2.6, y: -7.2 },
      thighF: { rot: -16 },
      shinF: { rot: 18 },
      thighB: { rot: -8 },
      shinB: { rot: 14 },
    },
    extra,
  );
  const front: Pt = [hx + 0.6, hy - 0.28];
  const back: Pt = [hx + 0.05, hy - 0.26];
  const stretch = (arm: string, [x, y]: Pt) => {
    const [sx, sy] = pointOf(rig, base, arm);
    return Math.max(1, (Math.hypot(x - sx, y - sy) * 1.02 - FORE_ARM) / UPPER_ARM);
  };
  return hands(
    mix(base, { armF: { sy: stretch('armF', front) }, armB: { sy: stretch('armB', back) } }),
    back,
    front,
    1,
  );
}

/** Mid pull-up `frame` frames into a getup: hands still on the corner, which sinks as the engine lifts him. */
function pull(frame: number, moveEnd: number, progress: number): Pose {
  return hang(GX - 1.5 * progress, -belowFloor(frame, moveEnd), DROP * (1 - progress), {
    armF: { x: 2.4 * (1 - progress ** 3), y: -6.6 * (1 - progress ** 3) },
    armB: { x: 2.6 * (1 - progress ** 3), y: -7.2 * (1 - progress ** 3) },
    thighF: { rot: -10 - 70 * progress },
    shinF: { rot: 14 + 90 * progress },
    thighB: { rot: 8 - 30 * progress },
    shinB: { rot: 10 + 70 * progress },
  });
}

const BREATHE = feet(
  { hip: { y: 0.1 }, neck: { rot: 1.5 }, head: { sx: 1.015, sy: 0.99 }, armF: { rot: -3 }, armB: { rot: 3 } },
  [-0.45, 0],
  [0.45, 0],
  true,
);

/** A gait loop of four poses: contact, passing, then contact and passing on the other leg. */
function cycle(length: number, poses: [Pose, Pose, Pose, Pose]): AnimClip {
  const q = length / 4;
  return {
    length,
    loop: true,
    swaps: SIDE,
    keys: poses.map((pose, i) => key(i * q, pose, { ease: 'linear' })),
  };
}

/**
 * A gait pose: body offsets, the back and front legs' feet (IK targets) and the arm swing in degrees
 * (positive swings the front arm back and the back arm forward, against the legs).
 */
const gait = (body: Pose, back: Pt, front: Pt, swing: number): Pose =>
  feet(
    mix(body, { armF: { rot: swing }, foreF: { rot: -55 }, armB: { rot: -swing }, foreB: { rot: -45 } }),
    back,
    front,
  );

/** Walk: short grounded steps, the body upright. */
const WALK_DOWN: Pose = { body: { rot: 3, y: 0.12 }, neck: { rot: 1 } };
const WALK_UP: Pose = { body: { rot: 3, y: -0.12 }, neck: { rot: 0.5 } };
const WALK: [Pose, Pose, Pose, Pose] = [
  gait(WALK_DOWN, [-0.75, 0], [0.85, 0], 25),
  gait(WALK_UP, [0.15, -0.45], [0.05, 0], 0),
  gait(WALK_DOWN, [0.85, 0], [-0.75, 0], -25),
  gait(WALK_UP, [0.05, 0], [0.15, -0.45], 0),
];

/** How far the run leans into travel, in degrees. */
const RUN_LEAN = 14;

/**
 * A running foot at phase `p` of its stride (0: planting ahead of the hips). It drives back along the floor for
 * 45% of the stride, then the heel kicks up behind and the foot swings through to plant again.
 */
function runFoot(p: number): Pt {
  const u = p - Math.floor(p);
  if (u < 0.45) return [1.0 - (2.5 * u) / 0.45, 0];
  const s = (u - 0.45) / 0.55;
  return [
    -1.5 + 1.25 * (1 - Math.cos(Math.PI * s)) - 0.6 * Math.sin(Math.PI * s),
    -1.4 * Math.sin(Math.PI * s),
  ];
}

/**
 * The run at phase `t` of its cycle. The body leans into travel, drops on each footfall (mid-stance at t = 0.22
 * and 0.72) and rises through the flight between them, the arms pump against the legs, and the head trails the
 * bob by about a frame and a half: it squashes as the body lands and stretches as it rises.
 */
function runPose(t: number, lean = RUN_LEAN): Pose {
  const bob = Math.cos(4 * Math.PI * (t - 0.22));
  const lag = Math.cos(4 * Math.PI * (t - 0.3));
  const swing = 55 * Math.cos(2 * Math.PI * t);
  return feet(
    {
      body: { rot: lean, x: 0.4, y: 0.05 + 0.3 * bob },
      neck: { rot: -lean * 0.35 + 3 * lag },
      head: { sx: 1 + 0.03 * lag, sy: 1 - 0.045 * lag },
      armF: { rot: swing },
      foreF: { rot: -80 },
      armB: { rot: -swing },
      foreB: { rot: -70 },
    },
    runFoot(t + 0.5),
    runFoot(t),
  );
}

/** A looping clip sampled from `pose(t)`, t in [0, 1), at `count` evenly spaced keys. */
function sampled(length: number, count: number, pose: (t: number) => Pose): AnimClip {
  return {
    length,
    loop: true,
    swaps: SIDE,
    keys: Array.from({ length: count }, (_, i) =>
      key((i * length) / count, pose(i / count), { ease: 'linear' }),
    ),
  };
}

/** Falling: legs reaching down for the floor, arms spread wide under the head. */
const FALL = mix(AIR, {
  body: { sx: 0.97, sy: 1.04 },
  head: { sx: 0.92, sy: 1.1 },
  armF: { rot: -75 },
  foreF: { rot: -50 },
  armB: { rot: 75 },
  foreB: { rot: 50 },
  thighF: { rot: -4 },
  shinF: { rot: 6 },
  thighB: { rot: 6 },
  shinB: { rot: 4 },
});
const FALL_2 = mix(FALL, { armF: { rot: -65 }, armB: { rot: 65 }, foreF: { rot: -60 }, foreB: { rot: 60 } });

/**
 * Jump apex: knees tucked up under the head and the body tipped back a little. The arms are short enough to
 * vanish behind the head when raised, so they splay down and out where they show.
 */
const APEX = mix(AIR, {
  body: { rot: -5 },
  thighF: { rot: -78 },
  shinF: { rot: 112 },
  thighB: { rot: -46 },
  shinB: { rot: 98 },
  armF: { rot: -48 },
  foreF: { rot: -62 },
  armB: { rot: 48 },
  foreB: { rot: 62 },
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

/** Braced under the bubble: knees bent, head pulled down, both forearms crossed in front of the chin. */
const SHIELD = hands(
  feet(
    {
      hip: { y: 0.7 },
      neck: { y: 0.5, rot: 4 },
      body: { rot: 3 },
      armF: { sy: 1.35 },
      foreF: { sy: 1.1 },
      armB: { sy: 1.35 },
      foreB: { sy: 1.1 },
    },
    [-1.1, 0],
    [1.1, 0],
    true,
  ),
  [0.9, -4.1],
  [2.0, -3.9],
  -1,
);

/** Hanging with the legs apart: the front knee drawn up against the wall, the back leg dangling straight. */
const HANG = hang(GX, GY, DROP, {
  thighF: { rot: -34 },
  shinF: { rot: 52 },
  thighB: { rot: 10 },
  shinB: { rot: 6 },
});
/** Holding on: mitten hands, straining. */
const HANG_FACE = { head: 'headFront', face: 'faceFrontStrain', ...MITTENS };

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

/**
 * Launched, in the original's motion language: the profile head flies backwards and up like a comet, its
 * flames streaming down and forward, limbs splayed in four directions.
 */
const TUMBLE = mix(AIR, {
  body: { sx: -1, rot: 32 },
  armF: { rot: -150 },
  foreF: { rot: -20 },
  armB: { rot: 120 },
  foreB: { rot: 30 },
  thighF: { rot: -70 },
  shinF: { rot: 90 },
  thighB: { rot: 50 },
  shinB: { rot: 5 },
});

const TUMBLE_FLAIL = mix(TUMBLE, {
  armF: { rot: -110 },
  foreF: { rot: -45 },
  armB: { rot: 150 },
  thighF: { rot: -100 },
  shinF: { rot: 60 },
  thighB: { rot: 75 },
  shinB: { rot: 30 },
});

/** Rolled into the ball: the head's ball resting on the floor. */
const ROLL_BALL: Pose = { body: { y: 3.05 } };

/** How far the hips ride up inside the ball in `ROLL_TUCK`. The neck drops as far, so the head stays put. */
const ROLL_LIFT = 1.6;

/**
 * The rolls' ball. `ROLL_BALL` puts the hips 1.05 below the floor, and the legs show through it on the frames
 * where the body tweens into and out of the ball. This pose lifts the hips inside the head and plants the feet
 * as in the crouch. The head stays where `ROLL_BALL` puts it.
 */
const ROLL_TUCK = hands(
  feet(mix(ROLL_BALL, { hip: { y: -ROLL_LIFT }, neck: { y: ROLL_LIFT } }), [-0.8, 0], [0.9, 0], true),
  [-1.35, -0.6],
  [1.5, -0.7],
);

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
  walk: cycle(36, WALK),
  dash: {
    length: 10,
    swaps: SIDE,
    keys: [
      key(
        0,
        mix(CROUCH, {
          body: { rot: 22 },
          neck: { rot: -6 },
          head: { sx: 1.08, sy: 0.9 },
          armF: { rot: 45 },
          armB: { rot: -45 },
        }),
        { ease: 'out' },
      ),
      key(3, mix(runPose(0.55, 24), { head: { sx: 0.95, sy: 1.07 } }), { ease: 'linear' }),
      key(10, runPose(0)),
    ],
  },
  run: sampled(20, 10, (t) => runPose(t)),
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
    keys: [key(0, STAND, { ease: 'out' }), key(3, mix(CROUCH, { head: { sx: 1.12, sy: 0.84 } }))],
  },
  jump: {
    length: 40,
    swaps: UP,
    keys: [
      key(0, mix(RISE, { head: { sx: 0.88, sy: 1.14 } }), { ease: 'out', z: HEAD_BEHIND }),
      key(4, mix(RISE, { head: { sx: 0.97, sy: 1.04 } }), { ease: 'inOut' }),
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
    keys: [
      key(0, mix(CROUCH, { head: { sx: 1.16, sy: 0.82 } }), { ease: 'out' }),
      key(2, mix(STAND, { hip: { y: 0.15 }, head: { sx: 0.96, sy: 1.05 } }), { ease: 'inOut' }),
      key(4, STAND),
    ],
  },
  shield: {
    length: 6,
    swaps: ANGRY,
    keys: [key(0, STAND, { ease: 'out', z: ARMS_IN_FRONT }), key(6, SHIELD)],
  },
  spotDodge: {
    length: 25,
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
      key(21, undefined, { swaps: {} }),
      key(25, STAND),
    ],
  },
  rollForward: {
    length: 29,
    swaps: FRONT,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(4, CROUCH, { ease: 'out' }),
      key(6, ROLL_TUCK, { ease: 'linear', swaps: { ...NO_BODY, ...SIDE_ANGRY } }),
      key(23, ROLL_TUCK, { ease: 'out', swaps: {} }),
      key(25, mix(CROUCH, { body: { sx: -1 } }), { ease: 'out' }),
      key(29, mix(STAND, { body: { sx: -1 } })),
    ],
  },
  rollBack: {
    length: 34,
    swaps: FRONT,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(4, CROUCH, { ease: 'out' }),
      key(6, mix(ROLL_TUCK, { body: { sx: -1 } }), { ease: 'linear', swaps: { ...NO_BODY, ...SIDE_ANGRY } }),
      key(23, mix(ROLL_TUCK, { body: { sx: -1 } }), { ease: 'out', swaps: {} }),
      key(27, CROUCH, { ease: 'out' }),
      key(34, STAND),
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
    length: 19,
    swaps: { ...ANGRY, ...MITTENS },
    keys: [
      key(0, hang(GX, GY, DROP + 0.8, { body: { rot: -4 }, thighF: { rot: -40 }, thighB: { rot: 30 } }), {
        ease: 'outBack',
        z: ARMS_IN_FRONT,
      }),
      key(19, HANG),
    ],
  },
  ledgeHang: {
    length: 60,
    loop: true,
    swaps: HANG_FACE,
    keys: [
      key(0, HANG, { z: ARMS_IN_FRONT }),
      key(
        30,
        hang(GX, GY, DROP + 0.1, {
          body: { rot: 2, x: 0.4 },
          neck: { rot: -2 },
          thighF: { rot: -20 },
          shinF: { rot: 34 },
          thighB: { rot: 20 },
          shinB: { rot: 18 },
        }),
      ),
    ],
  },
  ledgeClimb: {
    length: 34,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear', z: ARMS_IN_FRONT }),
      key(6, pull(6, 30, 0.45), { ease: 'linear' }),
      key(12, pull(12, 30, 1), { ease: 'out', z: {} }),
      key(18, mix(CROUCH, { body: { rot: 8 } }), { ease: 'inOut', swaps: FRONT }),
      key(34, STAND),
    ],
  },
  ledgeRoll: {
    length: 45,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear', z: ARMS_IN_FRONT }),
      key(6, pull(6, 40, 0.6), { ease: 'linear' }),
      ...[10, 14, 18, 22, 26, 34].map((f) =>
        key(
          f,
          { body: { y: ROLL_BALL.body!.y! - belowFloor(f, 40) } },
          { ease: 'linear', ...(f === 10 ? { swaps: { ...NO_BODY, ...SIDE_ANGRY }, z: {} } : {}) },
        ),
      ),
      key(37, mix(CROUCH, { head: { sx: 1.1, sy: 0.88 } }), { ease: 'out', swaps: FRONT }),
      key(45, STAND),
    ],
  },
  ledgeJump: {
    length: 20,
    swaps: FRONT,
    keys: [
      key(0, HANG, { ease: 'in', z: ARMS_IN_FRONT }),
      key(3, mix(CROUCH, { body: { rot: -6 }, armF: { rot: -150 }, armB: { rot: 150 } }), {
        ease: 'out',
        z: {},
      }),
      key(6, RISE, { ease: 'out', swaps: UP, z: HEAD_BEHIND }),
      key(20, mix(AIR, { body: { sy: 1.02 } }), { swaps: FRONT, z: {} }),
    ],
  },
  ledgeAttack: {
    length: 55,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear', z: ARMS_IN_FRONT }),
      key(5, pull(5, 20, 0.6), { ease: 'linear' }),
      key(10, mix(CROUCH, { body: { rot: 6 } }), { ease: 'out', swaps: FRONT, z: {} }),
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
        { ease: 'linear', swaps: { fx1: 'fxJet', head: 'headFront', face: 'faceFrontShout' } },
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
  /**
   * Head over heels: the whole rig turns once every 30 frames, limbs splayed and flailing between two spreads.
   * The last key sits a full turn past the first, so the loop's wrap is seamless.
   */
  tumble: {
    length: 30,
    loop: true,
    swaps: SIDE_HURT,
    keys: [0, 5, 10, 15, 20, 25, 30].map((f, i) =>
      key(f, mix(i % 2 ? TUMBLE_FLAIL : TUMBLE, { body: { sx: -1, rot: 32 + 60 * i } }), { ease: 'linear' }),
    ),
  },
  helpless: {
    length: 32,
    loop: true,
    swaps: { head: 'headFront', face: 'faceFrontDazed' },
    keys: [
      key(0, mix(FALL, { armF: { rot: -70 }, armB: { rot: 70 }, neck: { rot: 6, y: 0.15 } })),
      key(16, mix(FALL_2, { armF: { rot: -55 }, armB: { rot: 55 }, neck: { rot: 3, y: 0.15 } })),
    ],
  },
  down: {
    length: 40,
    loop: true,
    swaps: HURT,
    keys: [key(0, DOWN), key(20, mix(DOWN, { head: { sx: 1.03, sy: 0.97 }, armF: { rot: -50 } }))],
  },
  getupStand: {
    length: 29,
    swaps: HURT,
    keys: [
      key(0, DOWN, { ease: 'in' }),
      key(10, mix(feet({ body: { rot: -40, y: 1.6 } }, [0.6, 0], [1.8, 0]), { armB: { rot: 90 } }), {
        ease: 'out',
        swaps: FRONT,
      }),
      key(20, CROUCH, { ease: 'out' }),
      key(29, STAND),
    ],
  },
  techInPlace: {
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
  /**
   * Pushed apart after a grab ends without a throw (either side): jolted back on his heels with his arms thrown
   * up, he skids on the front foot, then crouches and stands. As long as GRAB.releaseLag.
   */
  grabRelease: {
    length: 29,
    swaps: SIDE_SHOUT,
    keys: [
      key(
        0,
        hands(
          feet(
            { body: { rot: -18, x: -0.3 }, hip: { y: 0.45 }, neck: { rot: -8 } },
            [-0.8, 0],
            [2.2, 0],
            true,
          ),
          [1.2, -6.6],
          [2.6, -5.8],
        ),
        { ease: 'out' },
      ),
      key(
        8,
        hands(
          feet({ body: { rot: -9 }, hip: { y: 0.65 }, neck: { rot: -3 } }, [-0.7, 0], [1.8, 0], true),
          [-2.0, -3.6],
          [2.2, -4.0],
        ),
        { ease: 'inOut', swaps: SIDE_ANGRY },
      ),
      key(15, CROUCH, { ease: 'inOut', swaps: ANGRY }),
      key(21, STAND, { swaps: FRONT }),
      key(29, STAND),
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
  finalSmash: finalSmashClip,
  finalSmashAir: finalSmashAirClip,
};

/** The tech roll on the getup roll's timeline: the sim's travel ends on frame 28 instead of 30, and 35 frames in all. */
clips.getupRoll = retimeClip(clips.techRoll!, 35, [
  [4, 4],
  [30, 28],
]);
/** Tech and getup rolls away from the facing: the back roll with its frames moved onto each action's travel. */
clips.techRollBack = retimeClip(clips.rollBack!, 40, [
  [4, 4],
  [20, 30],
]);
clips.getupRollBack = retimeClip(clips.rollBack!, 35, [
  [4, 4],
  [20, 28],
]);
