import { pointOf, type Pose } from '../../../render/rig/author';
import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip, Key } from '../../../render/rig/types';
import { LEDGE_CATCH_FRAMES, LEDGE_ROLL } from '../../../sim/constants';
import { FORE_ARM, UPPER_ARM } from './parts';
import {
  ANGRY,
  AWAY,
  BLINK,
  CROUCH,
  DIZZY,
  FACE,
  FAR_ARM_IN_FRONT,
  FRONT,
  FRONT_HAPPY,
  HAPPY,
  HURT,
  P,
  SHOUT,
  STAND,
  ants,
  hands,
  key,
  mix,
  turn,
  type Pt,
} from './poses';
import { rig } from './rig';

/**
 * Movement, defence, ledge, hurt and grab clips. Run 3's Runner is all bounce: a round body that squashes into
 * each step, short legs that blur, and antennae that trail a beat behind everything she does.
 */

/** Fighting stance: knees soft, leaning in a little, the near arm up in front of her. */
export const READY = P({
  y: 0.65,
  rot: 6,
  legs: [
    [2.0, 0],
    [-1.7, 0],
  ],
  arms: [
    [5.1, -5.4],
    [-4.7, -4.9],
  ],
  ant: [4, 2],
});

/** Curled into a ball (rolls, flips, air dodges): limbs tucked against the body. */
export const TUCK = P({
  sx: 0.96,
  sy: 0.94,
  raw: {
    thighB: { rot: -75 },
    shinB: { rot: 105 },
    thighF: { rot: -65 },
    shinF: { rot: 100 },
    armB: { rot: -95 },
    foreB: { rot: -40 },
    armF: { rot: 95 },
    foreF: { rot: 40 },
  },
  ant: [24, 18],
});

/** The ball on the floor: how far the body drops for its bottom to touch the ground. */
const BALL_Y = 2.9;

/** Airborne, legs tucked a little and arms out for balance. */
export const AIR = P({
  raw: {
    thighB: { rot: -30 },
    shinB: { rot: 35 },
    thighF: { rot: 12 },
    shinF: { rot: 28 },
  },
  arms: [
    [5.4, -6.4],
    [-5.2, -6.2],
  ],
});

/** A gait loop of four poses: contact, passing, contact and passing on the other leg. */
function gait(length: number, poses: [Pose, Pose, Pose, Pose]): AnimClip {
  const q = length / 4;
  return { length, loop: true, keys: poses.map((p, i) => key(i * q, p)) };
}

/** One leg's path through a run stride (sole positions), as fractions of the cycle. */
const STRIDE: [number, Pt][] = [
  [0, [4.65, 0]],
  [0.12, [3.25, 0]],
  [0.29, [-1.0, 0]],
  [0.42, [-4.7, -0.65]],
  [0.58, [-4.8, -1.9]],
  [0.72, [0.9, -3.55]],
  [0.86, [4.75, -2.1]],
];

function strideAt(t: number): Pt {
  const u = ((t % 1) + 1) % 1;
  for (let i = 0; i < STRIDE.length; i++) {
    const [t0, p0] = STRIDE[i]!;
    const [t1, p1] = STRIDE[(i + 1) % STRIDE.length]!;
    const end = i + 1 < STRIDE.length ? t1 : 1;
    if (u >= t0 && u <= end) {
      const k = (u - t0) / (end - t0);
      return [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k];
    }
  }
  return STRIDE[0]![1];
}

/** A run pose `t` of the way through the cycle: leaning in hard, arms pumping, antennae streaming back. */
export function runPose(t: number, lean = 31): Pose {
  const bob = Math.cos(t * Math.PI * 4);
  const swing = Math.sin(t * Math.PI * 2);
  return P({
    x: 0.7,
    y: 0.64 + 0.46 * bob,
    rot: lean + 6 * bob,
    sy: 0.94 - 0.044 * bob,
    sx: 1.04 + 0.031 * bob,
    raw: {
      thighB: { sy: 1.5 },
      shinB: { sy: 1.29 },
      thighF: { sy: 1.5 },
      shinF: { sy: 1.29 },
      armB: { sy: 1.22 },
      armF: { sy: 1.22 },
    },
    legs: [strideAt(t), strideAt(t + 0.5)],
    arms: [
      [5.0 + 1.8 * swing, -5.55 - 3.15 * swing],
      [-3.85 + 2.0 * swing, -5.45 + 3.25 * swing],
    ],
    ant: [42 + 10 * bob, 38 + 9 * bob],
  });
}

const RUN_LEN = 12;
const runningArms = { armFLine: 19.1, foreFLine: 19.2 };
function runCycle(length: number): Key[] {
  return Array.from({ length }, (_, i) =>
    key(i, runPose(i / length), {
      ease: 'linear',
      ...(i === 0 ? { z: runningArms } : {}),
    }),
  );
}

/** Upright with the corner of the ledge in her hands (the engine's hang point; see LEDGE_GRIP). */
export const LEDGE_GRIP: [number, number] = [4.0, -11.05];
const [GX, GY] = LEDGE_GRIP;

/** How far below the floor the origin still is during a getup (the engine's smoothstep lift, as for Fireboy). */
function belowFloor(frame: number, moveEnd: number): number {
  const t = Math.min(1, frame / moveEnd);
  return -GY * (1 - Math.min(1, 1.6 * t * t * (3 - 2 * t)));
}

/** Arms re-rooted at the top front of the body so they can reach up over the lip. */
const HIGH_SHOULDERS: Pose = { armF: { x: 5.5, y: -2.9 }, armB: { x: -0.3, y: -3.05 } };

/** Stretches the arms just enough to reach their targets. */
function stretched(base: Pose, back: Pt, front: Pt): Pose {
  const s = (arm: string, [x, y]: Pt) => {
    const [ax, ay] = pointOf(rig, base, arm);
    return Math.max(1, (Math.hypot(x - ax, y - ay) * 1.02 - FORE_ARM) / UPPER_ARM);
  };
  return hands(
    mix(base, { armF: { sy: s('armF', front) }, armB: { sy: s('armB', back) } }),
    back,
    front,
    -1,
    -1,
  );
}

/** Hanging from rig point (hx, hy), the body `drop` lower and its top tucked under the lip. */
function hang(hx: number, hy: number, drop: number, extra: Pose = {}): Pose {
  const base = mix(
    P({
      x: hx - GX - 0.35,
      y: hy - GY - 0.18 + drop,
      rot: 8,
      raw: {
        ...HIGH_SHOULDERS,
        face: { x: -2.65, y: 0.45 },
        thighB: { rot: -12 },
        shinB: { rot: 16 },
        thighF: { rot: 6 },
        shinF: { rot: 12 },
      },
    }),
    extra,
  );
  return ants(stretched(base, [hx - 0.25, hy - 0.3], [hx + 0.3, hy - 0.35]), 10, 4);
}

export const HANG = hang(GX, GY, 0);

/** Mid pull-up: hands still on the corner, which sinks as the engine lifts her. */
export function pull(frame: number, moveEnd: number, progress: number): Pose {
  return hang(GX - 1.2 * progress, -belowFloor(frame, moveEnd), -1.4 * progress, {
    thighF: { rot: -20 - 70 * progress },
    shinF: { rot: 20 + 90 * progress },
    thighB: { rot: -10 - 40 * progress },
    shinB: { rot: 15 + 70 * progress },
  });
}

/** Rolling ball keys from `from` to `to` (turning `turns` times; negative rolls backwards). */
function roll(from: number, to: number, turns: number, extra: (f: number) => Pose = () => ({})): Key[] {
  const steps = 4 * Math.abs(turns);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = Math.round(from + ((to - from) * i) / steps);
    return key(f, mix(TUCK, { body: { y: BALL_Y, rot: (360 * turns * i) / steps } }, extra(f)), {
      ease: 'linear',
    });
  });
}

const SHIELD = P({
  y: 1.1,
  sy: 0.93,
  sx: 1.05,
  rot: -3,
  legs: [
    [2.0, 0],
    [-1.9, 0],
  ],
  arms: [
    [5.0, -7.3],
    [3.0, -6.6],
  ],
  ant: [-6, 10],
});

const HIT = P({
  x: -0.7,
  y: -0.4,
  rot: -20,
  raw: { thighB: { rot: -45 }, shinB: { rot: 30 }, thighF: { rot: -25 }, shinF: { rot: 25 } },
  arms: [
    [6.4, -9.4],
    [-1.0, -10.6],
  ],
  ant: [-34, -28],
});

/** Spread out and spinning (tumble), as launched. */
const SPREAD = P({
  raw: { thighB: { rot: -55 }, shinB: { rot: 20 }, thighF: { rot: 40 }, shinF: { rot: 20 } },
  arms: [
    [6.0, -9.0],
    [-6.0, -8.6],
  ],
  ant: [-20, -20],
});

/** Flat on her back, feet towards her front. */
const DOWN = P({
  x: -1.6,
  y: 2.25,
  rot: -88,
  raw: { thighB: { rot: -20 }, shinB: { rot: 10 }, thighF: { rot: 10 }, shinF: { rot: 15 } },
  arms: [
    [-1.0, -0.6],
    [-5.6, -0.6],
  ],
  ant: [-30, -10],
});

/** The map from Run 3's title art, held up in front of her face while she looks for the way. */
const MAP_UP: Pose = { fx1: { x: 0.2, y: -5.0 } };

export const clips: Record<string, AnimClip> = {
  idle: {
    length: 60,
    loop: true,
    swaps: {
      body: 'idleBody',
      face: 'faceIdle',
      armBLine: null,
      foreBLine: null,
      armB: null,
      foreB: null,
      armFLine: null,
      foreFLine: null,
      armF: null,
      foreF: null,
    },
    keys: [
      key(0, ants(STAND, 0, 0)),
      key(
        30,
        P({
          y: 0.5,
          sy: 0.975,
          sx: 1.02,
          legs: [
            [1.6, 0],
            [-1.4, 0],
          ],
          arms: [
            [5.05, -4.0],
            [-4.95, -3.9],
          ],
          ant: [-5, 5],
        }),
      ),
      key(44, undefined, { swaps: { face: 'faceIdleBlink' } }),
      key(48, undefined, { swaps: {} }),
    ],
  },
  walk: gait(28, [
    P({
      y: 0.35,
      rot: 3,
      legs: [
        [2.3, 0],
        [-1.7, 0],
      ],
      arms: [
        [4.4, -4.5],
        [-5.2, -4.6],
      ],
      ant: [7, 3],
    }),
    P({
      y: -0.05,
      rot: 3,
      legs: [
        [0.3, -1.2],
        [-0.2, 0],
      ],
      arms: [
        [4.9, -4.4],
        [-4.7, -4.4],
      ],
      ant: [2, 7],
    }),
    P({
      y: 0.35,
      rot: 3,
      legs: [
        [-1.5, 0],
        [2.1, 0],
      ],
      arms: [
        [5.6, -4.6],
        [-4.1, -4.6],
      ],
      ant: [7, 3],
    }),
    P({
      y: -0.05,
      rot: 3,
      legs: [
        [0.3, 0],
        [-0.1, -1.2],
      ],
      arms: [
        [4.9, -4.4],
        [-4.7, -4.4],
      ],
      ant: [3, 7],
    }),
  ]),
  dash: {
    length: 10,
    keys: [
      key(
        0,
        P({
          y: 1.2,
          rot: 22,
          sy: 0.9,
          sx: 1.06,
          legs: [
            [2.5, 0],
            [-1.9, 0],
          ],
          arms: [
            [5.1, -4.0],
            [-4.6, -4.2],
          ],
          ant: [10, 8],
        }),
        { ease: 'out' },
      ),
      key(
        4,
        mix(
          P({
            x: 0.4,
            y: 0.1,
            rot: 33,
            legs: [
              [3.6, -0.7],
              [-3.3, -0.2],
            ],
            arms: [
              [3.0, -3.6],
              [-6.0, -6.6],
            ],
            ant: [36, 30],
          }),
          { fx3: { x: -4.7, y: -0.15, sx: 1.8, sy: 1.16 } },
        ),
        { swaps: { fxBack: 'dust' } },
      ),
      key(8, mix(runPose(0), { fx3: { x: -7.1, y: -0.15, sx: 2.7, sy: 0.32 } })),
      key(10, runPose(0)),
    ],
  },
  run: { length: RUN_LEN, loop: true, keys: runCycle(RUN_LEN) },
  runBrake: {
    length: 14,
    swaps: ANGRY,
    keys: [
      key(0, runPose(0), { ease: 'out' }),
      key(
        3,
        P({
          x: -0.6,
          y: 1.1,
          rot: -16,
          legs: [
            [4.4, 0],
            [1.1, 0],
          ],
          arms: [
            [6.2, -7.8],
            [-2.4, -8.4],
          ],
          ant: [-32, -26],
        }),
      ),
      key(
        9,
        P({
          y: 0.8,
          rot: -8,
          legs: [
            [3.3, 0],
            [0.4, 0],
          ],
          arms: [
            [5.6, -6.0],
            [-4.3, -6.4],
          ],
          ant: [-14, -10],
        }),
      ),
      key(14, STAND),
    ],
  },
  turn: {
    length: 8,
    keys: [
      key(0, STAND, { swaps: FACE }),
      key(
        2,
        P({
          y: 0.6,
          sx: 0.88,
          legs: [
            [0.9, 0],
            [-0.8, 0],
          ],
          arms: [
            [3.9, -4.0],
            [-3.9, -4.0],
          ],
          ant: [-10, 10],
        }),
        { swaps: FRONT },
      ),
      key(6, STAND, { swaps: FACE }),
      key(8, STAND),
    ],
  },
  crouch: {
    length: 6,
    keys: [key(0, STAND, { ease: 'out' }), key(4, ants(CROUCH, 14, -14))],
  },
  jumpSquat: {
    length: 3,
    keys: [
      key(0, READY),
      key(
        3,
        P({
          y: 1.5,
          sy: 0.84,
          sx: 1.12,
          legs: [
            [2.1, 0],
            [-1.9, 0],
          ],
          arms: [
            [4.8, -3.0],
            [-4.6, -3.0],
          ],
          ant: [-8, 8],
        }),
      ),
    ],
  },
  jump: {
    length: 40,
    keys: [
      key(
        0,
        P({
          sy: 1.1,
          sx: 0.92,
          raw: { thighB: { rot: 5 }, shinB: { rot: 5 }, thighF: { rot: 10 }, shinF: { rot: 10 } },
          arms: [
            [3.6, -10.6],
            [-3.4, -10.4],
          ],
          ant: [-30, -30],
        }),
        { ease: 'out' },
      ),
      key(
        14,
        mix(
          AIR,
          P({
            sy: 1.02,
            arms: [
              [4.8, -8.8],
              [-4.6, -8.6],
            ],
            ant: [-18, -14],
          }),
        ),
      ),
      key(
        27,
        mix(
          AIR,
          P({
            rot: -13,
            sy: 0.87,
            sx: 1.11,
            raw: {
              thighB: { rot: -76, sy: 1.24 },
              shinB: { rot: 12 },
              thighF: { rot: 66, sy: 1.24 },
              shinF: { rot: 8 },
            },
            arms: [
              [4.85, -3.8],
              [-4.95, -3.65],
            ],
            ant: [-18, -13],
          }),
        ),
      ),
      key(
        34,
        ants(
          mix(
            AIR,
            P({
              rot: 12,
              sx: 0.94,
              sy: 1.09,
              raw: { thighB: { rot: -16 }, shinB: { rot: 4 }, thighF: { rot: 3 }, shinF: { rot: 6 } },
              arms: [
                [5.05, -9.2],
                [-5.15, -9.15],
              ],
              ant: [8, 4],
            }),
          ),
          8,
          4,
        ),
      ),
      key(
        40,
        P({
          rot: 15,
          sy: 1.12,
          sx: 0.91,
          raw: { thighB: { rot: -11 }, shinB: { rot: 7 }, thighF: { rot: 14 }, shinF: { rot: 2 } },
          arms: [
            [5.2, -9.0],
            [-5.35, -9.2],
          ],
          ant: [4, 1],
        }),
      ),
    ],
  },
  doubleJump: {
    length: 30,
    keys: [
      key(0, mix(TUCK, { body: { rot: 0 } }), { ease: 'linear' }),
      key(5, mix(TUCK, { body: { rot: 100 } }), { ease: 'linear' }),
      key(10, mix(TUCK, { body: { rot: 200 } }), { ease: 'linear' }),
      key(16, mix(TUCK, { body: { rot: 300 } }), { ease: 'out' }),
      key(22, ants(mix(AIR, { body: { rot: 360 } }), -10, -10)),
      key(30, ants(mix(AIR, { body: { rot: 360 } }), 6, 4)),
    ],
  },
  fall: {
    length: 16,
    loop: true,
    keys: [
      key(
        0,
        ants(
          mix(
            AIR,
            P({
              rot: 14,
              sy: 1.12,
              sx: 0.9,
              raw: { thighB: { rot: -10 }, shinB: { rot: 0 }, thighF: { rot: 10 }, shinF: { rot: 0 } },
              arms: [
                [5.8, -9.35],
                [-5.6, -9.3],
              ],
            }),
          ),
          18,
          14,
        ),
      ),
      key(
        8,
        ants(
          mix(
            AIR,
            P({
              rot: 10,
              sy: 1.08,
              sx: 0.96,
              raw: { thighB: { rot: -20 }, shinB: { rot: 4 }, thighF: { rot: 6 }, shinF: { rot: 2 } },
              arms: [
                [5.35, -8.95],
                [-6, -9.65],
              ],
            }),
          ),
          6,
          4,
        ),
      ),
    ],
  },
  land: {
    length: 4,
    keys: [
      key(0, mix(CROUCH, { body: { y: 1.9, sx: 1.12, sy: 0.84, rot: 0 } }), { ease: 'out' }),
      key(4, STAND),
    ],
  },
  helpless: {
    length: 20,
    loop: true,
    swaps: HURT,
    keys: [
      key(
        0,
        mix(
          SPREAD,
          P({
            rot: -6,
            raw: SPREAD,
            arms: [
              [4.6, -10.2],
              [-4.4, -10.4],
            ],
            ant: [22, 18],
          }),
        ),
      ),
      key(
        10,
        mix(
          SPREAD,
          P({
            rot: 6,
            raw: SPREAD,
            arms: [
              [5.8, -9.2],
              [-3.4, -10.8],
            ],
            ant: [10, 26],
          }),
        ),
      ),
    ],
  },
  shield: {
    length: 10,
    swaps: ANGRY,
    keys: [key(0, READY, { ease: 'out' }), key(4, SHIELD), key(10, SHIELD)],
  },
  shieldDrop: {
    length: 11,
    swaps: ANGRY,
    keys: [key(0, SHIELD), key(11, STAND)],
  },
  shieldBreak: {
    length: 40,
    swaps: DIZZY,
    keys: [
      key(0, SHIELD, { ease: 'out' }),
      key(8, mix(SPREAD, { body: { rot: -25 } })),
      key(40, mix(SPREAD, { body: { rot: -10 } })),
    ],
  },
  dizzy: {
    length: 40,
    loop: true,
    swaps: DIZZY,
    keys: [
      key(
        0,
        P({
          y: 0.5,
          rot: -9,
          legs: [
            [1.6, 0],
            [-1.6, 0],
          ],
          arms: [
            [4.4, -3.2],
            [-4.6, -3.6],
          ],
          ant: [26, -12],
        }),
      ),
      key(
        20,
        P({
          y: 0.5,
          rot: 9,
          legs: [
            [1.6, 0],
            [-1.6, 0],
          ],
          arms: [
            [4.6, -3.6],
            [-4.4, -3.2],
          ],
          ant: [-12, 26],
        }),
      ),
    ],
  },
  spotDodge: {
    length: 25,
    swaps: BLINK,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(3, mix(TUCK, { body: { y: BALL_Y + 0.3, sy: 0.86, sx: 1.08 } })),
      key(20, mix(TUCK, { body: { y: BALL_Y + 0.3, sy: 0.86, sx: 1.08 } })),
      key(25, READY, { swaps: FACE }),
    ],
  },
  rollForward: {
    length: 29,
    keys: [key(0, READY, { ease: 'out' }), ...roll(4, 24, 1), key(29, READY)],
  },
  rollBack: {
    length: 34,
    keys: [key(0, READY, { ease: 'out' }), ...roll(4, 24, -1), key(34, READY)],
  },
  airDodge: {
    length: 49,
    swaps: BLINK,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(4, mix(TUCK, { body: { rot: -20 } })),
      key(28, mix(TUCK, { body: { rot: 20 } })),
      key(49, ants(AIR, 10, 8), { swaps: FACE }),
    ],
  },
  ledgeCatch: retimeClip(
    {
      length: 8,
      swaps: ANGRY,
      keys: [
        key(0, hang(GX, GY, 1.2, { body: { rot: -6 }, thighF: { rot: -40 }, thighB: { rot: 30 } }), {
          ease: 'outBack',
          z: FAR_ARM_IN_FRONT,
        }),
        key(8, HANG),
      ],
    },
    LEDGE_CATCH_FRAMES,
  ),
  ledgeHang: {
    length: 60,
    loop: true,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { z: FAR_ARM_IN_FRONT }),
      key(30, hang(GX, GY, 0.25, { body: { rot: 4 }, thighF: { rot: -6 }, thighB: { rot: 10 } })),
    ],
  },
  ledgeClimb: {
    length: 34,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear', z: FAR_ARM_IN_FRONT }),
      key(6, pull(6, 30, 0.45), { ease: 'linear' }),
      key(12, pull(12, 30, 1), { ease: 'out', z: {} }),
      key(18, CROUCH, { swaps: FACE }),
      key(34, STAND),
    ],
  },
  /** The keys up to frame 40 follow the engine's path; only the stand-up after them fits the roll's last frames. */
  ledgeRoll: retimeClip(
    {
      length: 50,
      swaps: ANGRY,
      keys: [
        key(0, HANG, { ease: 'linear', z: FAR_ARM_IN_FRONT }),
        key(6, pull(6, 40, 0.6), { ease: 'linear' }),
        ...roll(10, 34, 1, (f) => ({ body: { y: BALL_Y - belowFloor(f, 40) } })).map((k, i) =>
          i === 0 ? { ...k, z: {} } : k,
        ),
        key(40, CROUCH, { swaps: FACE }),
        key(50, STAND),
      ],
    },
    LEDGE_ROLL.faf - 1,
    [[40, 40]],
  ),
  ledgeJump: {
    length: 20,
    swaps: HAPPY,
    keys: [
      key(0, HANG, { ease: 'in', z: FAR_ARM_IN_FRONT }),
      key(4, mix(TUCK, { body: { rot: 60 } }), { ease: 'linear', z: {} }),
      key(9, mix(TUCK, { body: { rot: 240 } }), { ease: 'out' }),
      key(20, ants(mix(AIR, { body: { rot: 360 } }), -12, -12)),
    ],
  },
  hitstun: {
    length: 20,
    swaps: HURT,
    keys: [
      key(0, HIT, { ease: 'out' }),
      key(8, mix(HIT, { body: { rot: -12 } })),
      key(20, ants(AIR, 10, 10)),
    ],
  },
  tumble: {
    length: 24,
    loop: true,
    swaps: HURT,
    keys: [0, 6, 12, 18].map((f) => key(f, mix(SPREAD, { body: { rot: -15 * f } }), { ease: 'linear' })),
  },
  down: {
    length: 60,
    loop: true,
    swaps: HURT,
    keys: [key(0, DOWN), key(30, mix(DOWN, { body: { sx: 1.03, sy: 0.97 } }))],
  },
  getupStand: {
    length: 29,
    swaps: ANGRY,
    keys: [
      key(0, DOWN),
      key(
        8,
        P({
          x: -0.6,
          y: 2.0,
          rot: -40,
          legs: [
            [2.4, 0],
            [0.4, 0],
          ],
          arms: [
            [1.4, -1.2],
            [-4.6, -0.4],
          ],
          ant: [-20, -10],
        }),
      ),
      key(16, CROUCH, { swaps: FACE }),
      key(29, STAND),
    ],
  },
  techInPlace: {
    length: 26,
    swaps: ANGRY,
    keys: [key(0, mix(TUCK, { body: { y: BALL_Y } })), key(8, CROUCH), key(26, READY)],
  },
  techRoll: {
    length: 40,
    swaps: ANGRY,
    keys: [...roll(0, 26, 1), key(32, CROUCH), key(40, READY)],
  },
  respawn: {
    length: 60,
    loop: true,
    swaps: FRONT_HAPPY,
    keys: [
      key(
        0,
        P({
          y: 0.2,
          legs: [
            [1.6, 0],
            [-1.4, 0],
          ],
          arms: [
            [5.6, -7.6],
            [-5.4, -7.4],
          ],
          ant: [0, 0],
        }),
      ),
      key(
        30,
        P({
          y: 0.4,
          legs: [
            [1.6, 0],
            [-1.4, 0],
          ],
          arms: [
            [5.8, -8.4],
            [-5.6, -8.2],
          ],
          ant: [-6, 6],
        }),
      ),
    ],
  },
  taunt: {
    length: 60,
    swaps: FRONT,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(
        8,
        mix(
          P({
            y: 0.3,
            legs: [
              [1.6, 0],
              [-1.4, 0],
            ],
            arms: [
              [3.6, -5.4],
              [-3.6, -5.4],
            ],
            ant: [-8, 8],
          }),
          MAP_UP,
        ),
        {
          swaps: { fx1: 'map' },
          z: FAR_ARM_IN_FRONT,
        },
      ),
      key(
        30,
        mix(
          P({
            y: 0.35,
            rot: 3,
            legs: [
              [1.6, 0],
              [-1.4, 0],
            ],
            arms: [
              [3.7, -5.6],
              [-3.5, -5.2],
            ],
            ant: [4, 14],
          }),
          MAP_UP,
        ),
      ),
      key(
        42,
        mix(
          P({
            y: 0.35,
            rot: -3,
            legs: [
              [1.6, 0],
              [-1.4, 0],
            ],
            arms: [
              [3.5, -5.2],
              [-3.7, -5.6],
            ],
            ant: [14, 4],
          }),
          MAP_UP,
        ),
      ),
      key(52, STAND, { swaps: { fx1: null, ...FRONT_HAPPY }, z: {} }),
      key(60, STAND, { swaps: FACE }),
    ],
  },
  grabHold: {
    length: 30,
    loop: true,
    swaps: ANGRY,
    keys: [
      key(
        0,
        P({
          x: 0.5,
          y: 0.6,
          rot: 8,
          legs: [
            [2.4, 0],
            [-1.6, 0],
          ],
          arms: [
            [6.4, -6.6],
            [5.4, -5.6],
          ],
          raw: { armB: { sy: 1.3 }, armF: { sy: 1.6 } },
          ant: [6, 4],
        }),
        { z: FAR_ARM_IN_FRONT },
      ),
      key(
        15,
        P({
          x: 0.5,
          y: 0.75,
          rot: 9,
          legs: [
            [2.4, 0],
            [-1.6, 0],
          ],
          arms: [
            [6.4, -6.4],
            [5.4, -5.4],
          ],
          raw: { armB: { sy: 1.3 }, armF: { sy: 1.6 } },
          ant: [2, 8],
        }),
      ),
    ],
  },
  grabbed: {
    length: 30,
    loop: true,
    swaps: HURT,
    keys: [
      key(
        0,
        P({
          y: -0.4,
          rot: -10,
          raw: { thighB: { rot: -20 }, shinB: { rot: 20 }, thighF: { rot: 15 }, shinF: { rot: 15 } },
          arms: [
            [5.8, -8.4],
            [-5.0, -7.6],
          ],
          ant: [-14, -10],
        }),
      ),
      key(
        15,
        P({
          y: -0.6,
          rot: -4,
          raw: { thighB: { rot: 10 }, shinB: { rot: 20 }, thighF: { rot: -20 }, shinF: { rot: 25 } },
          arms: [
            [5.2, -7.6],
            [-5.6, -8.4],
          ],
          ant: [-6, -18],
        }),
      ),
    ],
  },
};

/** The tech roll on the getup roll's timeline: the sim's travel ends on frame 28 instead of 30, and 35 frames in all. */
clips.getupRoll = retimeClip(clips.techRoll!, 35, [
  [4, 4],
  [30, 28],
]);

export { BALL_Y, GX, GY, SHIELD, belowFloor, roll, runCycle, strideAt };
export const swapsFor = { SHOUT, AWAY, turn };
