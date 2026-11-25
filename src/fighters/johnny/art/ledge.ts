import type { Pose } from '../../../render/rig/author';
import type { AnimClip } from '../../../render/rig/types';
import { AIR, FISTS, GRIT, HEAD_IN_FRONT, SHOUT, hands, key, mix, shortTurns, sole, type Pt } from './poses';

/**
 * Where the hands hold the ledge (rig space): the ledge's top corner while hanging. It matches the engine's hang
 * position, feet width / 2 + 0.5 out from the corner and 0.85 x height below it (src/sim/movement.ts hangPos).
 */
export const LEDGE_GRIP: [number, number] = [5.0, -14.45];
const [GX, GY] = LEDGE_GRIP;

/**
 * Hanging: both arms up over the lip with the fists on the grip, his shoulders pulled in under his jaw, the body
 * slumped against the wall and the boots dangling. `extra` bends it, for the catch and the sway.
 */
function hang(extra: Pose = {}): Pose {
  return hands(
    mix(
      {
        body: { x: -0.5, y: -0.2 },
        neck: { rot: 5 },
        armF: { x: 6.4, y: -1.0, sy: 1.05 },
        armB: { x: 1.8, y: 0.6, sy: 1.2 },
      },
      extra,
    ),
    [GX, GY],
    [GX - 0.3, GY - 0.1],
    -1,
    1,
  );
}

/** Boots dangling: the far one hangs lower and back, the near one swings a little forward. */
function dangling(extra: Pose = {}): Pose {
  return sole(
    sole(
      hang(mix({ thighF: { rot: -12 }, shinF: { rot: 24 }, thighB: { rot: 14 }, shinB: { rot: 18 } }, extra)),
      'B',
      42,
    ),
    'F',
    24,
  );
}

const HANG = dangling();
/** The hang on the breath: the shoulders sink and the head tips back. */
const HANG_SAG = dangling({
  body: { x: -0.7, y: 0.1 },
  neck: { rot: 9 },
  thighF: { rot: -6 },
  shinF: { rot: 14 },
  thighB: { rot: 20 },
});

/** The fists let go and the arms sweep up as he leaves the ledge, legs tucking under. */
const RELEASE: Pose = mix(AIR, {
  body: { y: -2 },
  armF: { rot: -150 },
  armB: { rot: 150 },
  foreF: { rot: -20 },
  foreB: { rot: 20 },
  thighF: { rot: -52 },
  shinF: { rot: 40 },
  thighB: { rot: -16 },
  shinB: { rot: 48 },
});

export const ledge: Record<string, AnimClip> = {
  ledgeCatch: {
    length: 8,
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(
        0,
        dangling({
          thighF: { rot: -40 },
          shinF: { rot: 44 },
          thighB: { rot: 36 },
          shinB: { rot: 34 },
          body: { y: 0.4 },
        }),
        {
          ease: 'outBack',
          z: HEAD_IN_FRONT,
        },
      ),
      key(8, HANG),
    ],
  },

  ledgeHang: {
    length: 60,
    loop: true,
    swaps: { ...SHOUT, ...FISTS },
    keys: [key(0, HANG, { z: HEAD_IN_FRONT }), key(30, HANG_SAG), key(60, HANG)],
  },

  ledgeJump: {
    length: 20,
    swaps: { ...GRIT, ...FISTS },
    keys: shortTurns([
      key(0, HANG, { ease: 'in', z: HEAD_IN_FRONT }),
      key(
        4,
        dangling({
          body: { y: -0.2 },
          neck: { rot: -4 },
          thighF: { rot: -48 },
          shinF: { rot: 52 },
          thighB: { rot: 40 },
          shinB: { rot: 30 },
        }),
        {
          ease: 'out',
          swaps: { ...GRIT, ...FISTS },
        },
      ),
      key(8, RELEASE, { ease: 'out', z: {} }),
      key(20, mix(AIR, { body: { y: -3 } })),
    ]),
  },
};

/** Hands and the grip, for the tests and the levels. */
export const GRIP_TARGETS: [Pt, Pt] = [
  [GX, GY],
  [GX - 0.3, GY - 0.1],
];
