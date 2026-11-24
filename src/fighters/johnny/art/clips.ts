import type { Pose } from '../../../render/rig/author';
import type { AnimClip } from '../../../render/rig/types';
import {
  AIR,
  CROUCH,
  FISTS,
  GRIT,
  GUARD,
  HURT,
  PALM_F,
  SHOUT,
  SMIRK,
  STANCE,
  STAND,
  feet,
  hands,
  key,
  mix,
  soles,
  type Pt,
} from './poses';

/**
 * Johnny's movement, defence and hurt clips, posed after the 2012 game's drawings: the bow-legged fighting stance
 * with an open guard hand and a cocked fist, the leaning sprint with pumping fists, and the fist-first jump.
 */

/** Idle breath: hips sink, the chest swells and the guard hand drifts. */
const BREATHE = hands(
  mix(feet({ hip: { y: 0.42 }, body: { rot: 3 }, neck: { rot: 2 } }, [3.0, 0], [-2.4, 0]), {
    footF: { sx: -1 },
  }),
  [5.6, -8.7],
  [-3.8, -8.5],
  -1,
  1,
);
const IDLE_FEET = { footF: { sx: -1 } };

/** Legs tucked together under the hips for strides, as he does when he runs side-on. */
const STRIDE: Pose = { thighF: { x: 1.0 }, thighB: { x: -1.1 }, armF: { x: 1.0 }, armB: { x: -0.9 } };

/**
 * A stride pose: body offsets, then the near (F) and far (B) boots' sole points and sole angles, then the fists.
 */
function stride(
  body: Pose,
  near: Pt,
  nearSole: number,
  far: Pt,
  farSole: number,
  fistF: Pt,
  fistB: Pt,
): Pose {
  const legs = feet(mix(STRIDE, body), far, near, 1);
  return hands(soles(legs, farSole, nearSole), fistB, fistF, -1, 1);
}

/** A gait loop of four poses: contact, passing, then contact and passing on the other leg. */
function cycle(length: number, poses: [Pose, Pose, Pose, Pose], swaps = { ...GRIT, ...FISTS }): AnimClip {
  const q = length / 4;
  return {
    length,
    loop: true,
    swaps,
    keys: poses.map((pose, i) => key(i * q, pose, { ease: 'linear' })),
  };
}

/** Walk: a swaggering march, chest out, fists swinging low. */
const WALK: [Pose, Pose, Pose, Pose] = [
  stride({ body: { rot: 4, y: 0.25 } }, [2.6, 0], -10, [-1.8, 0], 14, [-2.6, -5.8], [4.0, -6.6]),
  stride({ body: { rot: 4, y: -0.25 } }, [0.3, 0], 0, [1.4, -1.4], 16, [-0.6, -5.2], [2.0, -5.4]),
  stride({ body: { rot: 4, y: 0.25 } }, [-1.8, 0], 14, [2.6, 0], -10, [2.4, -6.8], [-0.6, -6.4]),
  stride({ body: { rot: 4, y: -0.25 } }, [1.4, -1.4], 16, [0.3, 0], 0, [0.6, -5.8], [1.4, -5.8]),
];

/**
 * Run, after the game's sprint: leaning hard into it, one fist punching up past his chin while the other drives
 * back, the trailing boot kicked up behind him with its toe pointing down.
 */
const RUN_LEAN: Pose = { body: { rot: 24, x: 1.4 }, neck: { rot: -14 } };
const RUN: [Pose, Pose, Pose, Pose] = [
  stride(
    mix(RUN_LEAN, { body: { y: -0.2 } }),
    [4.2, -0.5],
    -22,
    [-3.6, -3.4],
    78,
    [-3.8, -7.0],
    [5.4, -12.4],
  ),
  stride(mix(RUN_LEAN, { body: { y: -1.0 } }), [1.2, -0.2], 4, [2.2, -3.4], 24, [-1.2, -7.4], [3.8, -10.6]),
  stride(mix(RUN_LEAN, { body: { y: -0.2 } }), [-3.6, -3.4], 78, [4.2, -0.5], -22, [4.4, -9.4], [-0.6, -9.8]),
  stride(mix(RUN_LEAN, { body: { y: -1.0 } }), [2.2, -3.4], 24, [1.2, -0.2], 4, [1.8, -8.8], [2.0, -10.8]),
];

/** Jump take-off: the superhero launch, far fist thrust overhead, near fist at his hip, legs trailing. */
const RISE = hands(
  mix(AIR, {
    body: { rot: -6, sx: 0.95, sy: 1.06 },
    thighF: { rot: 10 },
    shinF: { rot: 30 },
    thighB: { rot: -6 },
    shinB: { rot: 24 },
    footF: { rot: 40 },
    footB: { rot: 30 },
  }),
  [4.4, -16.4],
  [-3.4, -6.4],
  -1,
  1,
);

/** Jump apex, after the game's jump drawing: knees tucked, fists up in front of him. */
const APEX = hands(
  mix(AIR, {
    hip: { y: -0.3 },
    thighF: { rot: -70 },
    shinF: { rot: 95 },
    thighB: { rot: -40 },
    shinB: { rot: 85 },
    footF: { rot: 10 },
    footB: { rot: 10 },
  }),
  [5.2, -10.4],
  [1.8, -8.2],
  -1,
  1,
);

/** Falling: legs reaching down for the floor, arms out for balance. */
const FALL = hands(
  mix(AIR, {
    thighF: { rot: 14 },
    shinF: { rot: 10 },
    thighB: { rot: -16 },
    shinB: { rot: 18 },
    footF: { rot: 12 },
    footB: { rot: 0 },
  }),
  [6.2, -11.2],
  [-5.2, -11.4],
  -1,
  1,
);
const FALL_2 = hands(FALL, [6.0, -12.0], [-5.0, -12.2], -1, 1);

/** Balled up for the double jump flip: knees to his chest, fists on his shins. */
const TUCK: Pose = hands(
  {
    hip: { y: -0.6 },
    thighF: { rot: -110 },
    shinF: { rot: 130 },
    thighB: { rot: -95 },
    shinB: { rot: 125 },
    neck: { y: 0.4 },
  },
  [3.6, -5.6],
  [1.8, -5.2],
  -1,
  1,
);

/** Under the bubble: knees bent wide, forearms crossed in front of his jaw. */
const SHIELD = hands(
  mix(feet({ hip: { y: 1.0 }, body: { rot: 4 }, neck: { y: 0.35 } }, [3.2, 0], [-2.8, 0]), IDLE_FEET),
  [2.6, -11.2],
  [2.2, -9.6],
  -1,
  1,
);

/** Struck: head snapped back, arms flung out, hips pushed forward. */
const HIT = hands(
  mix(AIR, {
    body: { rot: -20, x: -0.4 },
    neck: { rot: -14 },
    thighF: { rot: -30 },
    shinF: { rot: 30 },
    thighB: { rot: 12 },
    shinB: { rot: 24 },
  }),
  [5.8, -13.6],
  [-5.4, -12.6],
  -1,
  1,
);

/** Launched: spinning, limbs splayed in four directions like the game's knocked-back frame. */
const TUMBLE = hands(
  mix(AIR, {
    body: { rot: -40 },
    thighF: { rot: -70 },
    shinF: { rot: 80 },
    thighB: { rot: 40 },
    shinB: { rot: 10 },
  }),
  [6.4, -13.2],
  [-6.0, -10.4],
  -1,
  1,
);

export const clips: Record<string, AnimClip> = {
  idle: {
    length: 56,
    loop: true,
    swaps: { ...GRIT, ...GUARD },
    keys: [key(0, STANCE), key(28, BREATHE)],
  },
  walk: cycle(40, WALK),
  dash: {
    length: 10,
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, mix(CROUCH, { body: { rot: 22 } }), { ease: 'out' }),
      key(4, mix(RUN[0], { body: { rot: 22, y: -0.2 } }), { ease: 'linear' }),
      key(10, RUN[1]),
    ],
  },
  run: cycle(24, RUN),
  runBrake: {
    length: 14,
    swaps: { ...SHOUT, ...FISTS },
    keys: [
      key(
        0,
        stride({ body: { rot: -14, y: 0.6 } }, [3.4, 0], -16, [-1.0, 0], 0, [-4.0, -8.8], [0.4, -10.6]),
        {
          ease: 'out',
        },
      ),
      key(8, stride({ body: { rot: -6, y: 0.4 } }, [2.6, 0], -8, [-0.6, 0], 0, [-3.6, -8.0], [1.4, -9.2]), {
        swaps: { ...GRIT, ...FISTS },
      }),
      key(14, STANCE, { swaps: { ...GRIT, ...GUARD } }),
    ],
  },
  turn: {
    length: 8,
    swaps: { ...GRIT, ...GUARD },
    keys: [
      key(0, mix(STANCE, { body: { sx: -1 } }), { ease: 'in' }),
      key(3, mix(STAND, { body: { sx: -0.2, sy: 1.03 } }), { ease: 'step' }),
      key(4, mix(STAND, { body: { sx: 0.2, sy: 1.03 } }), { ease: 'out' }),
      key(8, STANCE),
    ],
  },
  crouch: {
    length: 6,
    swaps: { ...GRIT, ...FISTS },
    keys: [key(0, STANCE, { ease: 'out' }), key(6, CROUCH)],
  },
  jumpSquat: {
    length: 3,
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, STANCE, { ease: 'out' }),
      key(3, mix(CROUCH, { hip: { y: 2.0 }, body: { sx: 1.05, sy: 0.94 } })),
    ],
  },
  jump: {
    length: 40,
    swaps: { ...SHOUT, ...FISTS },
    keys: [
      key(0, RISE, { ease: 'out' }),
      key(16, mix(RISE, { body: { sx: 1, sy: 1, rot: -3 } }), {
        ease: 'inOut',
        swaps: { ...GRIT, ...FISTS },
      }),
      key(40, APEX),
    ],
  },
  doubleJump: {
    length: 30,
    swaps: { ...SHOUT, ...FISTS },
    keys: [
      key(0, mix(RISE, { body: { sy: 1.08 } }), { ease: 'out' }),
      key(4, mix(TUCK, { body: { rot: 60 } }), { ease: 'linear', swaps: { ...GRIT, ...FISTS } }),
      key(10, mix(TUCK, { body: { rot: 180 } }), { ease: 'linear' }),
      key(16, mix(TUCK, { body: { rot: 300 } }), { ease: 'out' }),
      key(22, mix(APEX, { body: { rot: 360 } })),
      key(30, mix(FALL, { body: { rot: 360 } })),
    ],
  },
  fall: {
    length: 40,
    loop: true,
    swaps: { ...GRIT, ...FISTS },
    keys: [key(0, FALL), key(20, FALL_2)],
  },
  land: {
    length: 4,
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, mix(CROUCH, { hip: { y: 2.0 }, body: { sx: 1.06, sy: 0.93 } }), { ease: 'out' }),
      key(4, STANCE),
    ],
  },
  shield: {
    length: 6,
    swaps: { ...GRIT, ...FISTS },
    keys: [key(0, STANCE, { ease: 'out' }), key(6, SHIELD)],
  },
  shieldDrop: {
    length: 11,
    swaps: { ...GRIT, ...GUARD },
    keys: [
      key(0, SHIELD, { ease: 'out', swaps: { ...GRIT, ...FISTS } }),
      key(6, undefined, { swaps: {} }),
      key(11, STANCE),
    ],
  },
  hitstun: {
    length: 20,
    swaps: { ...HURT, ...PALM_F },
    keys: [
      key(0, HIT, { ease: 'out' }),
      key(6, mix(HIT, { body: { rot: -26 } })),
      key(20, mix(HIT, { body: { rot: -12 } })),
    ],
  },
  tumble: {
    length: 32,
    loop: true,
    swaps: { ...HURT, ...PALM_F },
    keys: [
      key(0, TUMBLE, { ease: 'linear' }),
      key(16, mix(TUMBLE, { body: { rot: -220 } }), { ease: 'linear' }),
      key(32, mix(TUMBLE, { body: { rot: -400 } })),
    ],
  },
  helpless: {
    length: 32,
    loop: true,
    swaps: { ...SMIRK, ...PALM_F },
    keys: [key(0, mix(FALL, { neck: { rot: 8 } })), key(16, mix(FALL_2, { neck: { rot: 4 } }))],
  },
};
