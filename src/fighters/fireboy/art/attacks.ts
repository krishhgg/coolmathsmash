import type { Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import {
  AIR,
  ANGRY,
  ARMS_IN_FRONT,
  BLINK,
  CROUCH,
  FIST_B,
  FIST_F,
  FISTS,
  FRONT_ARM_IN_FRONT,
  NO_BODY,
  SIDE_ANGRY,
  SIDE_SHOUT,
  STAND,
  TUCK,
  UP,
  ball,
  feet,
  flame,
  hands,
  key,
  mix,
} from './poses';

/**
 * Fireboy's moves. Frames use Smash numbering (frame 1 = first frame of the move, length = FAF - 1). Each
 * strike pose is keyed from the frame before the first active frame through the last active frame, so the
 * striking limb or flame covers the hitbox centre whether the engine counts from 0 or from 1.
 */

type Swaps = Record<string, string | null>;

/** Holds `pose` from `from` to `to` (the active window), with the strike's swaps and draw order. */
function strike(from: number, to: number, pose: Pose, swaps: Swaps, z?: Record<string, number>): Key[] {
  return [key(from, pose, { ease: 'linear', swaps, ...(z ? { z } : {}) }), key(to, pose, { ease: 'out' })];
}

/** Ends the strike: swaps and draw order back to the clip's. */
const done = (frame: number) => key(frame, undefined, { swaps: {}, z: {} });

/** Standing with the feet apart, ready to hit. */
const READY = hands(
  feet({ hip: { y: 0.35 }, body: { rot: 4 } }, [-0.75, 0], [0.85, 0], true),
  [-0.8, -3.0],
  [-0.1, -3.4],
);

/** A ground stance leaning by `rot` with the hips lowered by `drop`. */
const stance = (rot: number, drop: number, back: number, front: number, extra: Pose = {}): Pose =>
  feet(mix({ body: { rot }, hip: { y: drop } }, extra), [back, 0], [front, 0], true);

const stretch = (bones: string[], s: number): Pose => Object.fromEntries(bones.map((b) => [b, { sy: s }]));
const FRONT_ARM = ['armF', 'foreF'];
const BACK_ARM = ['armB', 'foreB'];

const JAB1 = hands(
  stance(10, 0.35, -0.75, 0.95, { body: { x: 0.3 }, ...stretch(FRONT_ARM, 1.3) }),
  [-1.3, -2.9],
  [2.55, -4.9],
  -1,
);
const JAB2 = hands(
  stance(12, 0.35, -0.7, 1.0, { body: { x: 0.4 }, ...stretch(BACK_ARM, 1.35) }),
  [2.45, -4.85],
  [-0.4, -3.2],
  -1,
);
const JAB3 = hands(
  stance(14, 0.45, -1.0, 1.3, { body: { x: 0.6 }, ...stretch([...FRONT_ARM, ...BACK_ARM], 1.3) }),
  [2.4, -4.4],
  [2.7, -5.2],
  -1,
);

const FTILT = hands(
  feet(mix({ body: { rot: -14 }, hip: { y: 0.15 } }), [-0.7, 0], [0.9, 0], true),
  [-1.9, -4.7],
  [-0.9, -5.1],
);
const FTILT_KICK = mix(FTILT, { thighF: { rot: -102 }, shinF: { rot: -4 }, fx1: ball(8.5, -3.5, 3.2, -6) });

const CHARGE = hands(stance(-14, 0.5, -1.2, 1.0, { body: { x: -0.4 } }), [0.9, -3.3], [-1.7, -4.6]);
const FSMASH = hands(
  stance(16, 0.5, -1.5, 1.9, { body: { x: 1.2 }, ...stretch(FRONT_ARM, 1.4) }),
  [-2.1, -3.9],
  [3.7, -5.7],
  -1,
);

const nairKeys: Key[] = [];
for (let f = 2; f <= 24; f += 2) {
  const t = ((f - 2) / 22) * 720;
  const orbit = (i: number) => {
    const a = ((t + i * 120) * Math.PI) / 180;
    return ball(Math.cos(a) * 5.4, -6 + Math.sin(a) * 5.4, 1.9, t + i * 120 + 90);
  };
  nairKeys.push(
    key(f, mix(TUCK, { body: { rot: t }, fx1: orbit(0), fx2: orbit(1), fx3: orbit(2) }), {
      ease: 'linear',
      ...(f === 2 ? { swaps: { fx1: 'fxBall', fx2: 'fxBall', fx3: 'fxBall', face: 'faceFrontShout' } } : {}),
    }),
  );
}

const FAIR_WIND = mix(TUCK, {
  body: { rot: -18 },
  armF: { rot: -170 },
  foreF: { rot: -20 },
  armB: { rot: 170 },
  foreB: { rot: 20 },
  fx2: ball(-0.6, -11.5, 1.2, -90),
});
const FAIR = (r: number, fx: ReturnType<typeof ball>): Pose =>
  hands(
    mix(AIR, {
      body: { rot: 24 },
      thighF: { rot: -50 },
      shinF: { rot: 60 },
      ...stretch([...FRONT_ARM, ...BACK_ARM], 1.3),
      fx1: fx,
    }),
    [2.2, -2.4 - r],
    [2.6, -2.8 - r],
    1,
  );

const BAIR = mix(AIR, {
  body: { rot: 22 },
  head: { sx: -1 },
  thighB: { rot: 118 },
  shinB: { rot: -6 },
  thighF: { rot: -40 },
  shinF: { rot: 70 },
  armF: { rot: -40 },
  armB: { rot: -60 },
  fx1: ball(-8, -6, 3.7, 180),
});

const DAIR = mix(AIR, {
  body: { sx: 0.94, sy: 1.08 },
  thighF: { rot: -4 },
  shinF: { rot: 0 },
  thighB: { rot: 4 },
  shinB: { rot: 0 },
  armF: { rot: -140 },
  foreF: { rot: -20 },
  armB: { rot: 140 },
  foreB: { rot: 20 },
  fx1: ball(0, 2, 4.2, 90),
});

const GRAB = hands(
  stance(14, 0.4, -1.0, 1.4, { body: { x: 0.9 }, ...stretch([...FRONT_ARM, ...BACK_ARM], 1.9) }),
  [4.2, -5.0],
  [4.6, -5.6],
  -1,
);
const DASH_GRAB = hands(
  stance(22, 0.6, -1.4, 1.9, { body: { x: 2.2 }, ...stretch([...FRONT_ARM, ...BACK_ARM], 2.2) }),
  [6.2, -5.4],
  [6.7, -6.0],
  -1,
);
const HOLD = hands(stance(6, 0.3, -0.7, 0.8), [1.7, -4.0], [2.0, -3.5], -1);

const LIE = feet(
  { body: { rot: -90, y: 2.35, x: 0.6 }, neck: { rot: -10 }, armF: { rot: -40 }, armB: { rot: 60 } },
  [3.7, 0],
  [4.6, 0],
);

export const attacks: Record<string, AnimClip> = {
  jab1: {
    length: 16,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      ...strike(
        2,
        4,
        mix(JAB1, { fx1: ball(6, -6, 2.9, -8) }),
        { ...FIST_F, fx1: 'fxBall' },
        FRONT_ARM_IN_FRONT,
      ),
      key(7, mix(JAB1, { fx1: ball(6.8, -6.2, 0.8, -8) }), { ease: 'inOut' }),
      done(8),
      key(16, READY),
    ],
  },
  jab2: {
    length: 18,
    swaps: ANGRY,
    keys: [
      key(0, mix(JAB1, { body: { rot: 6 } }), { ease: 'out' }),
      ...strike(
        2,
        4,
        mix(JAB2, { fx1: ball(6.5, -6, 2.9, -8) }),
        { ...FIST_B, fx1: 'fxBall' },
        ARMS_IN_FRONT,
      ),
      key(7, mix(JAB2, { fx1: ball(7.3, -6.2, 0.8, -8) }), { ease: 'inOut' }),
      done(8),
      key(18, READY),
    ],
  },
  jab3: {
    length: 31,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'in' }),
      key(3, hands(stance(-6, 0.45, -0.9, 0.9), [-1.0, -3.4], [-0.6, -3.7]), { ease: 'out' }),
      ...strike(
        4,
        7,
        mix(JAB3, { fx1: ball(7, -6, 4.4, -4), fx2: flame(4.2, -5.2, 1.6, -40) }),
        { ...FISTS, fx1: 'fxBall', fx2: 'fxFlame', face: 'faceFrontShout' },
        ARMS_IN_FRONT,
      ),
      key(11, mix(JAB3, { fx1: ball(8.2, -6.4, 1.2, -4), fx2: flame(4.6, -5.4, 0.4, -40) }), {
        ease: 'inOut',
      }),
      done(12),
      key(31, STAND),
    ],
  },
  ftilt: {
    length: 27,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(3, mix(FTILT, { thighF: { rot: -75 }, shinF: { rot: 105 } }), { ease: 'in' }),
      ...strike(5, 8, FTILT_KICK, { fx1: 'fxBall', face: 'faceFrontShout' }, { fx1: 22 }),
      key(12, mix(FTILT_KICK, { fx1: ball(9.4, -3.7, 0.8, -6), thighF: { rot: -95 } }), { ease: 'inOut' }),
      done(13),
      key(18, mix(FTILT, { thighF: { rot: -40 }, shinF: { rot: 60 } }), { ease: 'inOut' }),
      key(27, STAND),
    ],
  },
  utilt: {
    length: 29,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(
        3,
        mix(stance(-10, 0.5, -0.8, 0.8), {
          neck: { rot: -26, y: 0.2 },
          armF: { rot: 20 },
          armB: { rot: -20 },
        }),
        { ease: 'in' },
      ),
      ...strike(
        4,
        10,
        hands(
          stance(6, 0.1, -0.6, 0.7, {
            neck: { rot: 18 },
            head: { sx: 0.92, sy: 1.16 },
            fx1: flame(2, -15, 2.5, -95, 1.2),
          }),
          [-1.6, -2.5],
          [1.9, -2.8],
        ),
        { fx1: 'fxFlame', face: 'faceFrontShout' },
      ),
      key(14, mix(stance(4, 0.15, -0.6, 0.7), { neck: { rot: 12 }, fx1: flame(2.4, -16, 0.6, -95) }), {
        ease: 'inOut',
      }),
      done(15),
      key(29, STAND),
    ],
  },
  dtilt: {
    length: 21,
    swaps: ANGRY,
    keys: [
      key(0, CROUCH, { ease: 'out' }),
      key(
        3,
        hands(
          feet({ hip: { y: 1.25 }, body: { rot: 6 }, neck: { y: 0.3 } }, [-0.9, 0], [0.4, 0], true),
          [-1.4, -0.3],
          [0.6, -1.2],
        ),
        { ease: 'in' },
      ),
      ...strike(
        4,
        7,
        mix(
          hands(
            feet({ hip: { y: 1.25 }, body: { rot: 10 }, neck: { y: 0.3 } }, [-0.9, 0], [0.4, 0], true),
            [-1.5, -0.3],
            [0.7, -1.1],
          ),
          {
            thighF: { rot: -92 },
            shinF: { rot: -2 },
            fx1: ball(8, -1, 2.8, 0),
          },
        ),
        { fx1: 'fxBall', face: 'faceFrontShout' },
      ),
      key(10, mix(CROUCH, { thighF: { rot: -70 }, fx1: ball(8.8, -1, 0.6, 0) }), { ease: 'inOut' }),
      done(11),
      key(21, CROUCH),
    ],
  },
  dashAttack: {
    length: 37,
    swaps: SIDE_ANGRY,
    keys: [
      key(0, hands(stance(16, 0.7, -1.0, 1.2), [-1.6, -3.4], [-0.8, -3.6]), { ease: 'in' }),
      ...strike(
        5,
        18,
        mix(AIR, {
          body: { rot: 32, x: 1.6, y: 1.3 },
          thighF: { rot: 30 },
          shinF: { rot: 40 },
          thighB: { rot: 55 },
          shinB: { rot: 20 },
          armF: { rot: 90 },
          armB: { rot: 30 },
          fx1: ball(6, -4, 3.4, 4),
        }),
        { fx1: 'fxBall', face: 'faceSideShout' },
        { fx1: 18.9 },
      ),
      key(22, mix(stance(10, 0.6, -0.9, 1.4), { fx1: ball(6.5, -3.6, 0.8, 4) }), { ease: 'inOut' }),
      done(23),
      key(30, undefined, { swaps: ANGRY }),
      key(37, STAND),
    ],
  },
  fsmash: {
    length: 49,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(1, mix(CHARGE, { fx2: flame(-1.7, -5.1, 0.6) }), { swaps: { ...FIST_F, fx2: 'fxFlame' } }),
      key(10, mix(CHARGE, { body: { rot: -16 }, fx2: flame(-1.75, -5.2, 0.9) }), { ease: 'in' }),
      key(12, mix(CHARGE, { body: { rot: -4, x: 0 } }), { ease: 'linear', swaps: FIST_F }),
      ...strike(
        14,
        17,
        mix(FSMASH, { fx1: ball(10, -6, 5.2, -4) }),
        { ...FIST_F, ...SIDE_SHOUT, fx1: 'fxBall' },
        FRONT_ARM_IN_FRONT,
      ),
      key(22, mix(FSMASH, { body: { rot: 12 }, fx1: ball(11.5, -6.4, 1.2, -4) }), { ease: 'inOut' }),
      done(23),
      key(30, undefined, { swaps: ANGRY }),
      key(49, STAND),
    ],
  },
  usmash: {
    length: 43,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(7, mix(CROUCH, { head: { sx: 1.12, sy: 0.84 }, fx4: flame(0, -7, 1.2) }), {
        ease: 'in',
        swaps: { ...BLINK, fxBack: 'fxFlame' },
      }),
      ...strike(
        9,
        14,
        hands(
          stance(0, 0, -0.7, 0.7, { body: { sx: 0.94, sy: 1.1 }, fx1: flame(0, -15, 4.6, -90, 1.5) }),
          [-2.3, -5.6],
          [2.3, -5.6],
          -1,
        ),
        { fx1: 'fxFlame', face: 'faceFrontShout' },
        { fx1: 0.2 },
      ),
      key(20, mix(STAND, { fx1: flame(0, -17, 1, -90) }), { ease: 'inOut' }),
      done(21),
      key(43, STAND),
    ],
  },
  dsmash: {
    length: 45,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(4, hands(stance(0, 0.4, -0.9, 0.9), [-1.2, -5.0], [1.2, -5.0], -1), { ease: 'in', swaps: FISTS }),
      ...strike(
        5,
        7,
        mix(hands(stance(10, 1.1, -1.0, 1.1), [1.6, -0.4], [2.1, -0.4]), {
          fx1: flame(9, -2.4, 2.8, -90, 1.4),
        }),
        { ...FISTS, fx1: 'fxFlame', face: 'faceFrontShout' },
      ),
      key(
        9,
        mix(hands(stance(0, 0.8, -1.0, 1.0), [0.5, -1.0], [1.0, -1.2]), { fx1: flame(9, -1.4, 1.0, -90) }),
        { ease: 'inOut' },
      ),
      ...strike(
        11,
        13,
        mix(hands(stance(-10, 1.1, -1.1, 1.0), [-2.1, -0.4], [-1.6, -0.4]), {
          fx2: flame(-9, -2.4, 2.8, -90, 1.4),
        }),
        { ...FISTS, fx2: 'fxFlame', face: 'faceFrontShout' },
        ARMS_IN_FRONT,
      ),
      key(17, mix(CROUCH, { fx2: flame(-9, -1.4, 0.8, -90) }), { ease: 'inOut' }),
      done(18),
      key(45, STAND),
    ],
  },
  nair: {
    length: 41,
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      ...nairKeys,
      key(26, mix(TUCK, { body: { rot: 750 } }), { swaps: {} }),
      key(41, mix(AIR, { body: { rot: 720 } })),
    ],
  },
  fair: {
    length: 51,
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(10, FAIR_WIND, { ease: 'in', swaps: { fx2: 'fxBall' } }),
      key(13, FAIR(2.4, ball(6.4, -5.8, 4.0, 70)), {
        ease: 'linear',
        swaps: { fx1: 'fxBall', face: 'faceFrontShout' },
      }),
      key(15, FAIR(1.4, ball(7, -4.2, 4.4, 85)), { ease: 'linear' }),
      key(17, FAIR(0.6, ball(6.6, -2.8, 3.8, 100)), { ease: 'out' }),
      key(23, FAIR(0.4, ball(6.2, -1.6, 0.8, 110)), { ease: 'inOut' }),
      done(24),
      key(51, AIR),
    ],
  },
  bair: {
    length: 32,
    swaps: SIDE_ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(4, mix(TUCK, { body: { rot: 16 }, head: { sx: -1 } }), { ease: 'in' }),
      ...strike(5, 9, BAIR, { fx1: 'fxBall', face: 'faceSideShout' }, { fx1: 22 }),
      key(13, mix(BAIR, { thighB: { rot: 90 }, fx1: ball(-8.8, -6.2, 0.8, 180) }), { ease: 'inOut' }),
      done(14),
      key(20, mix(AIR, { head: { sx: -1 } }), { ease: 'inOut', swaps: ANGRY }),
      key(32, AIR),
    ],
  },
  uair: {
    length: 31,
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(2, mix(TUCK, { body: { rot: -40 } }), { ease: 'linear' }),
      ...strike(
        3,
        8,
        mix(AIR, {
          body: { rot: -165 },
          thighF: { rot: -10 },
          shinF: { rot: 0 },
          thighB: { rot: 30 },
          shinB: { rot: 40 },
          fx1: ball(2, -15, 4.4, -90),
        }),
        { fx1: 'fxBall', face: 'faceFrontShout' },
        { fx1: 22 },
      ),
      key(12, mix(TUCK, { body: { rot: -250 }, fx1: ball(2.4, -16, 0.8, -90) }), { ease: 'out' }),
      done(13),
      key(20, mix(AIR, { body: { rot: -360 } }), { ease: 'inOut' }),
      key(31, mix(AIR, { body: { rot: -360 } })),
    ],
  },
  dair: {
    length: 43,
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(11, mix(TUCK, { body: { y: -0.8 }, armF: { rot: -150 }, armB: { rot: 150 } }), { ease: 'in' }),
      ...strike(13, 17, DAIR, { fx1: 'fxBall', face: 'faceFrontShout' }),
      key(22, mix(DAIR, { fx1: ball(0, 3.2, 0.8, 90) }), { ease: 'inOut' }),
      done(23),
      key(43, AIR),
    ],
  },
  grab: {
    length: 29,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'in' }),
      key(3, hands(stance(-4, 0.4, -0.8, 1.0), [-0.9, -3.2], [-0.5, -3.6]), { ease: 'out' }),
      ...strike(5, 8, mix(GRAB, { fx1: ball(5.7, -5.9, 1.4, 0) }), { fx1: 'fxBall' }, ARMS_IN_FRONT),
      key(12, mix(GRAB, { body: { x: 0.6, rot: 10 }, fx1: ball(5.4, -5.8, 0.4, 0) }), { ease: 'inOut' }),
      done(13),
      key(29, STAND),
    ],
  },
  dashGrab: {
    length: 37,
    swaps: ANGRY,
    keys: [
      key(0, hands(stance(16, 0.6, -1.0, 1.2), [-1.4, -3.3], [-0.9, -3.5]), { ease: 'in' }),
      ...strike(8, 10, mix(DASH_GRAB, { fx1: ball(7.6, -6, 1.5, 0) }), { fx1: 'fxBall' }, ARMS_IN_FRONT),
      key(16, mix(DASH_GRAB, { body: { x: 1.4, rot: 14 }, fx1: ball(7.4, -5.8, 0.4, 0) }), { ease: 'inOut' }),
      done(17),
      key(37, STAND),
    ],
  },
  pummel: {
    length: 17,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'in' }),
      ...strike(
        2,
        4,
        mix(HOLD, { body: { rot: 9 }, fx1: ball(2.7, -4.2, 1.7, 0) }),
        { fx1: 'fxBall', face: 'faceFrontShout' },
        ARMS_IN_FRONT,
      ),
      key(8, mix(HOLD, { fx1: ball(2.9, -4.3, 0.4, 0) }), { ease: 'inOut' }),
      done(9),
      key(17, HOLD),
    ],
  },
  fthrow: {
    length: 29,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'inOut' }),
      key(8, hands(stance(-10, 0.4, -0.9, 0.8), [0.9, -4.1], [1.2, -3.8], -1), { ease: 'in' }),
      ...strike(
        11,
        13,
        mix(
          hands(
            stance(16, 0.4, -1.0, 1.4, stretch([...FRONT_ARM, ...BACK_ARM], 1.4)),
            [3.4, -4.7],
            [3.7, -5.0],
            -1,
          ),
          { fx1: ball(6, -5, 2.6, 0) },
        ),
        { fx1: 'fxBall', face: 'faceFrontShout' },
        ARMS_IN_FRONT,
      ),
      key(18, mix(stance(8, 0.3, -0.9, 1.1), { fx1: ball(7.4, -5.2, 0.5, 0) }), { ease: 'inOut' }),
      done(19),
      key(29, STAND),
    ],
  },
  bthrow: {
    length: 37,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'in' }),
      key(6, mix(HOLD, { body: { sx: 0.1 } }), { ease: 'out', swaps: BLINK }),
      key(10, mix(hands(stance(-8, 0.4, -0.9, 0.9), [1.3, -4.2], [1.5, -3.9], -1), { body: { sx: -1 } }), {
        ease: 'in',
        swaps: ANGRY,
      }),
      ...strike(
        15,
        17,
        mix(
          hands(
            stance(14, 0.4, -1.0, 1.4, stretch([...FRONT_ARM, ...BACK_ARM], 1.4)),
            [3.4, -4.7],
            [3.7, -5.0],
            -1,
          ),
          { body: { sx: -1 }, fx1: ball(-6, -5, 2.6, 180) },
        ),
        { fx1: 'fxBall', face: 'faceFrontShout' },
        ARMS_IN_FRONT,
      ),
      key(21, mix(stance(8, 0.3, -0.9, 1.1), { body: { sx: -1 }, fx1: ball(-7.4, -5.2, 0.5, 180) }), {
        ease: 'inOut',
      }),
      done(22),
      key(28, mix(STAND, { body: { sx: 0.1 } }), { ease: 'out' }),
      key(37, STAND),
    ],
  },
  uthrow: {
    length: 33,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'in' }),
      key(8, mix(CROUCH, { armF: { rot: -60 }, armB: { rot: 60 } }), { ease: 'in' }),
      ...strike(
        11,
        13,
        mix(hands(stance(0, 0, -0.7, 0.7, { body: { sy: 1.08, sx: 0.95 } }), [-1.0, -5.4], [1.0, -5.4], -1), {
          fx1: flame(0.6, -13.5, 3.2, -90, 1.4),
        }),
        { fx1: 'fxFlame', face: 'faceFrontShout' },
        { fx1: 0.2 },
      ),
      key(20, mix(STAND, { fx1: flame(0.6, -16, 0.6, -90) }), { ease: 'inOut' }),
      done(21),
      key(33, STAND),
    ],
  },
  dthrow: {
    length: 37,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'out' }),
      key(10, hands(stance(-6, 0, -0.7, 0.8, { body: { sy: 1.05 } }), [-1.5, -5.2], [1.6, -5.2], -1), {
        ease: 'in',
        swaps: FISTS,
      }),
      ...strike(
        17,
        19,
        mix(hands(stance(12, 1.1, -1.0, 1.2), [1.9, -0.4], [2.4, -0.4]), {
          fx1: flame(3.2, -2, 2.6, -90, 1.2),
        }),
        { ...FISTS, fx1: 'fxFlame', face: 'faceFrontShout' },
      ),
      key(24, mix(CROUCH, { fx1: flame(3.4, -1.4, 0.6, -90) }), { ease: 'inOut' }),
      done(25),
      key(37, STAND),
    ],
  },
  neutralSpecial: {
    length: 43,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(
        2,
        mix(hands(stance(-8, 0.45, -1.0, 0.9), [0.8, -3.4], [-1.3, -4.4]), {
          fx1: ball(-1.4, -4.7, 0.4, -90),
        }),
        { swaps: { fx1: 'fxBall' } },
      ),
      key(
        10,
        mix(hands(stance(-14, 0.5, -1.1, 0.9), [0.9, -3.3], [-1.6, -4.7]), {
          fx1: ball(-1.7, -5.1, 1.5, -90),
        }),
        { ease: 'in' },
      ),
      key(
        12,
        mix(hands(stance(10, 0.5, -1.1, 1.3, stretch(FRONT_ARM, 1.3)), [-1.6, -3.4], [2.4, -5.4], -1), {
          fx1: ball(4.2, -6.5, 2.0, 0),
        }),
        {
          ease: 'linear',
          swaps: { ...FIST_F, fx1: 'fxBall', face: 'faceFrontShout' },
          z: FRONT_ARM_IN_FRONT,
        },
      ),
      key(
        13,
        mix(hands(stance(12, 0.5, -1.1, 1.3, stretch(FRONT_ARM, 1.3)), [-1.7, -3.4], [2.5, -5.5], -1), {
          fx1: ball(6.4, -6.9, 2.4, 0),
        }),
        { ease: 'out' },
      ),
      key(14, undefined, { swaps: { ...FIST_F, face: 'faceFrontShout' } }),
      key(20, hands(stance(12, 0.5, -1.1, 1.3, stretch(FRONT_ARM, 1.3)), [-1.7, -3.4], [2.5, -5.5], -1), {
        ease: 'inOut',
      }),
      done(24),
      key(43, STAND),
    ],
  },
  sideSpecial: {
    length: 49,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'in' }),
      key(7, mix(CROUCH, { body: { rot: 14 }, fx4: ball(-0.5, -6, 3, 0) }), {
        ease: 'in',
        swaps: { fxBack: 'fxBall' },
      }),
      ...strike(
        9,
        24,
        { body: { x: 3.8, y: 2.46 }, head: { sx: 1.08, sy: 0.94 }, fx1: ball(5.4, -5, 4.2, 0) },
        { ...NO_BODY, ...SIDE_SHOUT, fx1: 'fxBall' },
        { fx1: 18.9 },
      ),
      key(27, mix(CROUCH, { body: { x: 2.4, rot: 10 } }), { ease: 'out', swaps: {}, z: {} }),
      key(36, mix(READY, { body: { x: 0.6 } }), { ease: 'inOut' }),
      key(49, STAND),
    ],
  },
  upSpecial: {
    length: 39,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(5, mix(CROUCH, { fx4: flame(0, -1, 1.2, 90) }), { ease: 'in', swaps: { fxBack: 'fxFlame' } }),
      ...strike(
        6,
        34,
        { body: { y: 1.46 }, head: { sx: 0.92, sy: 1.1 }, fx4: flame(0, -1.6, 2.6, 90, 1.5) },
        { ...NO_BODY, ...UP, fxBack: 'fxFlame' },
      ),
      key(39, mix(AIR, { armF: { rot: -70 }, armB: { rot: 70 } }), {
        swaps: { head: 'headFront', face: 'faceFrontBlink' },
      }),
    ],
  },
  downSpecial: {
    length: 39,
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(
        7,
        mix(CROUCH, {
          head: { sx: 1.1, sy: 0.88 },
          armF: { rot: 20 },
          armB: { rot: -20 },
          fx4: ball(0, -4.5, 1.6, -90),
        }),
        { ease: 'in', swaps: { ...BLINK, fxBack: 'fxBall' } },
      ),
      ...strike(
        8,
        12,
        hands(
          stance(0, 0, -1.1, 1.1, {
            fx4: flame(0, -5.2, 7, -90, 1.05),
            fx1: ball(-6.6, -3, 2.6, 180),
            fx2: ball(6.6, -3, 2.6, 0),
            fx3: flame(0, -13, 2.4, -90),
          }),
          [-2.4, -4.6],
          [2.4, -4.6],
          -1,
        ),
        { fxBack: 'fxFlame', fx1: 'fxBall', fx2: 'fxBall', fx3: 'fxFlame', face: 'faceFrontShout' },
      ),
      key(
        19,
        mix(STAND, {
          fx4: flame(0, -5, 1, -90),
          fx1: ball(-8, -3, 0.5, 180),
          fx2: ball(8, -3, 0.5, 0),
          fx3: flame(0, -15, 0.5, -90),
        }),
        { ease: 'inOut' },
      ),
      done(20),
      key(39, STAND),
    ],
  },
  getupAttack: {
    length: 49,
    swaps: ANGRY,
    keys: [
      key(0, LIE, { ease: 'inOut' }),
      key(12, mix(LIE, { body: { rot: -60, y: 1.6 } }), { ease: 'in' }),
      ...strike(
        17,
        20,
        mix(
          hands(
            feet({ hip: { y: 1.4 }, body: { rot: 0 } }, [-0.6, 0], [0.6, 0], true),
            [-1.6, -0.2],
            [1.6, -0.2],
          ),
          {
            thighF: { rot: -94 },
            shinF: { rot: -2 },
            thighB: { rot: 94 },
            shinB: { rot: 2 },
            fx1: ball(7, -3, 3.6, -4),
            fx2: ball(-7, -3, 3.6, 184),
          },
        ),
        { fx1: 'fxBall', fx2: 'fxBall', face: 'faceFrontShout' },
        { fx1: 22, fx2: 22.5 },
      ),
      key(25, mix(CROUCH, { fx1: ball(8, -3, 0.5, 0), fx2: ball(-8, -3, 0.5, 180) }), { ease: 'inOut' }),
      done(26),
      key(49, STAND),
    ],
  },
};
