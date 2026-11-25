import type { Pose } from '../../../render/rig/author';
import type { AnimClip } from '../../../render/rig/types';
import { attacks } from './attacks';
import {
  ANGRY,
  BLINK,
  BREATHE,
  CROUCH,
  DIZZY,
  FLYING,
  HURT,
  LOOK_UP,
  SHOUT,
  STAND,
  WINGS,
  air,
  at,
  feet,
  fx,
  headAt,
  key,
  leg,
  mix,
  tucked,
  wing,
  wingTo,
} from './poses';
import { BODY_X, BODY_Y } from './rig';

/**
 * Where the ledge's top corner sits while hanging (rig space). It matches the engine's hang position: half the
 * width plus 0.5 out from the corner and 0.85 of the height below it. The Duck has no hands, so he hangs with his
 * front wing hooked over the lip and his head tipped up beside it.
 */
export const LEDGE_GRIP: [number, number] = [4.5, -9.35];
const [GX, GY] = LEDGE_GRIP;

/**
 * How far below the floor the fighter's origin still is `frame` frames into a ledge getup: the engine lifts the
 * origin from the hang position to the floor with a smoothstep that finishes rising at 1/1.6 of `moveEnd`.
 */
function belowFloor(frame: number, moveEnd: number): number {
  const t = Math.min(1, frame / moveEnd);
  return -GY * (1 - Math.min(1, 1.6 * t * t * (3 - 2 * t)));
}

/**
 * Hanging from the corner at (hx, hy): belly flat against the wall, head tucked under the lip with the beak
 * biting the corner, the far wing hooked over onto the floor and the near wing and feet dangling.
 */
function hang(hx: number, hy: number, extra: Pose = {}): Pose {
  let pose = mix({ body: { x: hx - 3.75 - BODY_X, y: hy + 3.9 - BODY_Y, rot: -6 } }, extra);
  pose = headAt(pose, [hx - 3.15, hy + 0.55], -12);
  pose = wingTo(wing(pose, 'F', 105, 1.0), 'B', [hx + 1.7, hy - 0.3], 0.92, 1.1);
  return air(pose, 75, 65);
}
const HANG = hang(GX, GY);

/** The hang swaying by `rot` with the feet paddling at the wall, the front foot `kick` forwards of hanging. */
function paddle(rot: number, kick: number): Pose {
  const pose = hang(GX, GY, { body: { rot: -6 + rot, sy: 1 + Math.abs(rot) * 0.008 } });
  const [bx, by] = at(pose, 'legB');
  const [hx, hy] = at(pose, 'legF');
  return leg(
    leg(pose, 'B', [bx - 0.35 - kick * 0.5, by + 1.4], 75),
    'F',
    [hx + 0.15 + kick, hy + 1.45 - Math.abs(kick) * 0.4],
    40 + kick * 40,
  );
}

/** Mid pull-up `frame` frames into a getup: the wing stays on the corner, which sinks as the engine lifts him. */
function pull(frame: number, moveEnd: number, progress: number): Pose {
  return hang(GX - 1.6 * progress, -belowFloor(frame, moveEnd), { body: { rot: -6 + 16 * progress } });
}

/** A gait loop of four poses: contact, passing, contact and passing on the other leg. */
function cycle(length: number, poses: [Pose, Pose, Pose, Pose], extra: Partial<AnimClip> = {}): AnimClip {
  const q = length / 4;
  return { length, loop: true, keys: poses.map((pose, i) => key(i * q, pose, { ease: 'linear' })), ...extra };
}

/** A step pose: body offsets, then each ankle (x, lift above the ground) and toe angle. */
function step(body: Pose, back: [number, number, number], front: [number, number, number]): Pose {
  return leg(
    leg(body, 'B', [back[0], -0.19 - back[1]], back[2]),
    'F',
    [front[0], -0.19 - front[1]],
    front[2],
  );
}

/** Walk: a waddle, rocking from foot to foot with the head bobbing a beat behind. */
const WALK: [Pose, Pose, Pose, Pose] = [
  step({ body: { rot: 4, y: 0.1, sy: 0.98 }, head: { rot: 4, y: 0.12 } }, [-1.3, 0, 0], [0.4, 0, 0]),
  step({ body: { rot: 1, y: -0.18, sy: 1.02 }, head: { rot: 0, y: -0.05 } }, [-0.4, 0.55, 25], [-0.5, 0, 0]),
  step({ body: { rot: 4, y: 0.1, sy: 0.98 }, head: { rot: 4, y: 0.12 } }, [0.4, 0, 0], [-1.3, 0, 0]),
  step({ body: { rot: 1, y: -0.18, sy: 1.02 }, head: { rot: 0, y: -0.05 } }, [-0.5, 0, 0], [-0.4, 0.55, 25]),
];

/**
 * Run, after Duck Life's running training: leaning in, legs whirling under the belly in long flat-footed strides,
 * bouncing off the ground between steps with the head held level.
 */
const LEAN: Pose = { body: { rot: 14 }, head: { rot: -12, x: 0.4 } };
const RUN: [Pose, Pose, Pose, Pose] = [
  step(mix(LEAN, { body: { y: 0.35, sy: 0.94, sx: 1.05 } }), [-2.4, 0.5, -30], [1.5, 0, 0]),
  step(
    mix(LEAN, { body: { y: -0.9, sy: 1.05, sx: 0.98 }, head: { y: -0.1 } }),
    [0.2, 2.3, 60],
    [-1.8, 0.8, -50],
  ),
  step(mix(LEAN, { body: { y: 0.35, sy: 0.94, sx: 1.05 } }), [1.5, 0, 0], [-2.4, 0.5, -30]),
  step(
    mix(LEAN, { body: { y: -0.9, sy: 1.05, sx: 0.98 }, head: { y: -0.1 } }),
    [-1.8, 0.8, -50],
    [0.2, 2.3, 60],
  ),
];

/** Rising out of a jump: stretched tall, legs trailing. */
const RISE = air({ body: { sx: 0.94, sy: 1.08 }, head: { rot: -6 } }, 80, 70);
/** The top of a jump: round again, feet dangling, looking ahead. */
const APEX = air({ body: { sy: 1.0 }, head: { rot: 2 } }, 45, 30);
/** Falling: a touch stretched, feet reaching down for the ground, the little flight wing fluttering. */
const FALL = air({ body: { sx: 0.97, sy: 1.04 }, head: { rot: 4, y: 0.1 } }, 70, 60);
const FALL_2 = air({ body: { sx: 0.99, sy: 1.02 }, head: { rot: 1 } }, 60, 50);

/**
 * The air jump is Duck Life's flying flap: the line wing beats from a peak to a V twice (frame by frame) while
 * the belly stretches on each downstroke and loose feathers fall away.
 */
const FLAP_UP = air({ body: { sy: 0.95, sx: 1.04 }, head: { rot: -4 }, wingF: { sx: 1.1, sy: 1.1 } }, 70, 55);
const FLAP_DOWN = air(
  { body: { sy: 1.08, sx: 0.95 }, head: { rot: 2, y: -0.1 }, wingF: { sx: 1.1, sy: 1.1 } },
  85,
  70,
);

/** Flap poses for open wings (taunt, respawn, ledge jump): front and back wing angles. */
const flap = (front: number, back: number, extra: Pose = {}) =>
  wing(wing(air(extra, 70, 55), 'F', front, 1.3, 1.15), 'B', back, 1.25, 1.1);

/**
 * Taunt flap beat `i`: on the up-beat both wings come out and up behind the head, tips breaking the outline so the
 * eye stays clear; on the down-beat they sweep below the body. He hops higher on the up-beats.
 */
function beat(up: boolean, i: number): Pose {
  const lift = up ? 3.2 + (i % 3) * 0.2 : 1.0;
  const pose = air({
    base: { y: -lift },
    body: { sy: up ? 1.06 : 0.95, sx: up ? 0.96 : 1.04 },
    head: { rot: up ? -14 : 6 },
    wingF: { x: up ? -0.9 : 0 },
    wingB: { x: up ? -1.2 : 0 },
  });
  return up
    ? wing(wing(pose, 'F', 215 - i * 2, 1.25, 1.15), 'B', 248 + i * 2, 1.4, 1.2)
    : wing(wing(pose, 'F', 60, 1.1), 'B', 25, 1.05);
}

/** Lying on his back after a knockdown, feet in the air. */
const DOWN: Pose = (() => {
  const pose: Pose = { base: { rot: -88, x: 3.2, y: -3.3 }, head: { rot: -8, y: 0.3 } };
  return wing(
    wing(leg(leg(pose, 'B', [-0.2, -6.0], -150), 'F', [0.9, -6.3], -135), 'F', -60, 0.9),
    'B',
    -110,
    0.9,
  );
})();

/** Recoiling from a hit: thrown back, wings flung up, feet kicked forwards. */
const RECOIL: Pose = wing(
  wing(air({ body: { rot: -22, x: -0.4 }, head: { rot: 8, x: -0.3 } }, 10, -10), 'F', -140, 1.0),
  'B',
  -100,
  0.95,
);

/** Tumbling: spread out and spinning, the body turned `deg` about its middle. */
const tumble = (deg: number): Pose =>
  wing(
    wing(air({ body: { rot: deg }, head: { rot: -10 } }, 20, 0), 'F', deg - 150, 1.05),
    'B',
    deg - 60,
    1.0,
  );

/** A roll: balled up with the wings wrapped, the belly spun `deg` about its middle. */
const ball = (deg: number): Pose =>
  wing(wing(tucked({ body: { rot: deg, y: 1.1 } }), 'F', deg + 200, 0.8), 'B', deg + 160, 0.8);

/** Shield: hunkered down behind both wings, which wrap forwards over the face. */
const GUARD: Pose = wing(
  wing(
    feet({ body: { sx: 1.1, sy: 0.86, y: 0.5, rot: -4 }, head: { y: 0.45, rot: 6 } }, -1.2, 0.0),
    'F',
    -40,
    0.95,
  ),
  'B',
  -60,
  0.9,
);

/** Holding a grabbed fighter in his beak, wings out for balance. */
const HOLD: Pose = wing(
  wing(headAt(feet({ body: { rot: 10 } }, -1.4, 0.4), [3.2, -6.4], 14), 'F', 200, 0.9),
  'B',
  -150,
  0.9,
);

/** Held by someone: dangling, kicking and flapping. */
const HELD: Pose = wing(
  wing(air({ body: { rot: -10 }, head: { rot: -12 } }, 40, 20), 'F', -120, 1.0),
  'B',
  -60,
  0.95,
);

export const clips: Record<string, AnimClip> = {
  idle: {
    length: 120,
    loop: true,
    keys: [
      key(0, STAND),
      key(24, feet({ body: { sx: 1.035, sy: 0.96 }, head: { y: 0.1, rot: 1 } }, -0.55, -0.55)),
      key(30, feet({ body: { sx: 1.04, sy: 0.955 }, head: { y: 0.32, rot: 3 } }, -0.55, -0.55)),
      key(54, BREATHE),
      key(62, STAND),
      key(76, feet({ body: { sx: 1.03, sy: 0.965 }, head: { rot: -7, y: 0.05 } }, -0.55, -0.55), {
        swaps: LOOK_UP,
      }),
      key(84, feet({ body: { sx: 1.02, sy: 0.975 }, head: { rot: -8, y: 0.15 } }, -0.55, -0.55)),
      key(94, STAND, { swaps: {} }),
      key(102, undefined, { swaps: BLINK }),
      key(107, undefined, { swaps: {} }),
    ],
  },
  walk: cycle(32, WALK),
  dash: {
    length: 10,
    keys: [
      key(0, feet({ body: { rot: 18, sy: 0.9, y: 0.35 }, head: { rot: -12, x: 0.3 } }, -2.0, 0.6, -10), {
        ease: 'out',
        swaps: { fx1: 'fxPuff' },
      }),
      key(4, mix(RUN[0], { body: { rot: 16, y: -0.2 }, fx1: fx(-2.4, -0.7, 0.8) }), { ease: 'linear' }),
      key(10, mix(RUN[1], { fx1: fx(-3.4, -1.0, 0.3) })),
    ],
  },
  run: cycle(16, RUN),
  runBrake: {
    length: 14,
    swaps: { face: 'faceAngry', fx1: 'fxPuff' },
    keys: [
      key(
        0,
        mix(feet({ body: { rot: -16, y: 0.25 }, head: { rot: 10 } }, -0.6, 1.9, 0, -15), {
          fx1: fx(2.6, -0.6, 0.7),
        }),
        {
          ease: 'out',
        },
      ),
      key(
        8,
        mix(feet({ body: { rot: -6, y: 0.1 }, head: { rot: 4 } }, -0.5, 1.2), { fx1: fx(3.4, -1.0, 0.35) }),
      ),
      key(9, undefined, { swaps: {} }),
      key(14, STAND),
    ],
  },
  turn: {
    length: 8,
    keys: [
      key(0, mix(STAND, { base: { sx: -1 } }), { ease: 'in' }),
      key(3, mix(STAND, { base: { sx: -0.2 }, body: { sy: 1.04 } }), { ease: 'step', swaps: BLINK }),
      key(4, mix(STAND, { base: { sx: 0.2 }, body: { sy: 1.04 } }), { ease: 'out' }),
      key(6, undefined, { swaps: {} }),
      key(8, STAND),
    ],
  },
  crouch: { length: 6, keys: [key(0, STAND, { ease: 'out' }), key(6, CROUCH)] },
  jumpSquat: {
    length: 3,
    keys: [key(0, STAND, { ease: 'out' }), key(3, mix(CROUCH, { body: { sy: 0.74, sx: 1.18, y: 1.15 } }))],
  },
  jump: {
    length: 40,
    keys: [
      key(0, RISE, { ease: 'out', swaps: LOOK_UP }),
      key(16, mix(RISE, { body: { sx: 1, sy: 1.03 } })),
      key(40, APEX, { swaps: {} }),
    ],
  },
  doubleJump: {
    length: 30,
    swaps: { wingF: 'wingA' },
    keys: [
      key(0, mix(air({ body: { sy: 0.92, sx: 1.06 } }, 40, 30), { wingF: { sx: 1.1, sy: 1.1 } }), {
        ease: 'out',
      }),
      key(2, mix(FLAP_DOWN, { fx1: fx(-1.9, -1.8, 0.9, 20), fx2: fx(0.9, -1.5, 0.8, -30) }), {
        ease: 'linear',
        swaps: { wingF: 'wingV', fx1: 'fxFeather', fx2: 'fxFeather' },
      }),
      ...['wingVs', 'wingFlat', 'wingAs', 'wingA', 'wingAs', 'wingFlat', 'wingVs', 'wingV'].map(
        (drawing, i) =>
          key(i * 2 + 4, undefined, { swaps: { wingF: drawing, fx1: 'fxFeather', fx2: 'fxFeather' } }),
      ),
      key(
        7,
        mix(FLAP_UP, {
          body: { sy: 1.12, sx: 0.9 },
          fx1: fx(-2.7, 0.9, 0.7, 60),
          fx2: fx(2.3, 0.4, 0.65, -65),
        }),
        {
          ease: 'inOut',
        },
      ),
      key(
        16,
        mix(FLAP_DOWN, {
          body: { sx: 1.06, sy: 0.94 },
          fx1: fx(-3.2, 3.2, 0.35, 120),
          fx2: fx(3.1, 2.9, 0.3, -125),
        }),
        { ease: 'inOut' },
      ),
      key(22, mix(FLAP_UP, { fx1: fx(-3.6, 4.2, 0, 140), fx2: fx(3.5, 3.5, 0, -150) }), { ease: 'out' }),
      key(24, undefined, { swaps: { wingF: 'wingVs' } }),
      key(30, APEX),
    ].sort((a, b) => a.frame - b.frame),
  },
  fall: {
    length: 40,
    loop: true,
    swaps: FLYING,
    keys: [key(0, wing(FALL, 'F', 175)), key(20, wing(FALL_2, 'F', 175))],
  },
  helpless: {
    length: 32,
    loop: true,
    swaps: { ...DIZZY, ...WINGS },
    keys: [
      key(0, wing(wing(mix(FALL, { body: { rot: -8 } }), 'F', -120, 0.9), 'B', -70, 0.9)),
      key(16, wing(wing(mix(FALL_2, { body: { rot: 8 } }), 'F', -95, 0.9), 'B', -50, 0.9)),
    ],
  },
  land: {
    length: 4,
    swaps: { fx1: 'fxPuff', fx2: 'fxPuff' },
    keys: [
      key(
        0,
        mix(CROUCH, {
          body: { sy: 0.76, sx: 1.18, y: 1.1 },
          fx1: fx(-2.6, -0.5, 0.5),
          fx2: fx(2.2, -0.5, 0.5),
        }),
        {
          ease: 'out',
        },
      ),
      key(4, mix(STAND, { fx1: fx(-3.6, -0.8, 0.2), fx2: fx(3.2, -0.8, 0.2) })),
    ],
  },
  shield: { length: 6, swaps: { ...ANGRY, ...WINGS }, keys: [key(0, STAND, { ease: 'out' }), key(6, GUARD)] },
  shieldDrop: {
    length: 11,
    swaps: WINGS,
    keys: [
      key(0, GUARD, { ease: 'out' }),
      key(7, undefined, { swaps: { wingF: null, wingB: null } }),
      key(11, STAND),
    ],
  },
  shieldBreak: {
    length: 40,
    swaps: { ...DIZZY, ...WINGS },
    keys: [
      key(0, GUARD, { ease: 'out' }),
      key(
        8,
        wing(wing(air({ body: { rot: -12, y: -2.5 }, head: { rot: -20 } }), 'F', -130, 1.05), 'B', -80),
        { ease: 'inOut' },
      ),
      key(26, wing(wing(air({ body: { rot: 6, y: -1.2 }, head: { rot: 8 } }), 'F', -100), 'B', -60)),
      key(40, wing(wing(feet({ body: { rot: 6 }, head: { rot: 10 } }, -1, 0), 'F', 160), 'B', 150)),
    ],
  },
  dizzy: {
    length: 60,
    loop: true,
    swaps: { ...DIZZY, fx2: 'fxStar' },
    keys: [
      key(
        0,
        mix(feet({ body: { rot: -7 }, head: { rot: -12 } }, -1.0, 0.1), { fx2: fx(-1.6, -12.0, 0.6, 0) }),
      ),
      key(15, mix(feet({ body: { rot: 2 }, head: { rot: 4 } }, -1.0, 0.1), { fx2: fx(0.4, -12.6, 0.5, 45) })),
      key(
        30,
        mix(feet({ body: { rot: 8 }, head: { rot: 14 } }, -1.0, 0.1), { fx2: fx(1.8, -12.0, 0.6, 90) }),
      ),
      key(
        45,
        mix(feet({ body: { rot: 0 }, head: { rot: 0 } }, -1.0, 0.1), { fx2: fx(0.0, -11.6, 0.4, 135) }),
      ),
    ],
  },
  spotDodge: {
    length: 27,
    swaps: { ...BLINK, ...WINGS },
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(
        3,
        wing(
          wing(
            mix(CROUCH, { body: { sy: 0.66, sx: 1.2, y: 1.8, x: -0.8 }, head: { y: 1.4 } }),
            'F',
            -15,
            0.9,
          ),
          'B',
          -165,
          0.9,
        ),
        {
          ease: 'inOut',
        },
      ),
      key(
        18,
        wing(
          wing(
            mix(CROUCH, { body: { sy: 0.7, sx: 1.18, y: 1.6, x: -0.6 }, head: { y: 1.2 } }),
            'F',
            -20,
            0.9,
          ),
          'B',
          -160,
          0.9,
        ),
      ),
      key(20, undefined, { swaps: { wingF: null, wingB: null } }),
      key(27, STAND),
    ],
  },
  rollForward: {
    length: 31,
    keys: [
      key(0, CROUCH, { ease: 'in', swaps: BLINK }),
      key(4, ball(90), { ease: 'linear', swaps: { ...BLINK, ...WINGS } }),
      key(10, ball(200), { ease: 'linear' }),
      key(16, ball(300), { ease: 'linear' }),
      key(22, ball(380), { ease: 'out' }),
      key(24, undefined, { swaps: {} }),
      key(26, mix(CROUCH, { body: { rot: 360 } }), { ease: 'out' }),
      key(31, mix(STAND, { body: { rot: 360 } })),
    ],
  },
  rollBack: {
    length: 31,
    keys: [
      key(0, CROUCH, { ease: 'in', swaps: BLINK }),
      key(4, ball(-90), { ease: 'linear', swaps: { ...BLINK, ...WINGS } }),
      key(10, ball(-200), { ease: 'linear' }),
      key(16, ball(-300), { ease: 'linear' }),
      key(22, ball(-380), { ease: 'out' }),
      key(24, undefined, { swaps: {} }),
      key(26, mix(CROUCH, { body: { rot: -360 } }), { ease: 'out' }),
      key(31, mix(STAND, { body: { rot: -360 } })),
    ],
  },
  airDodge: {
    length: 49,
    swaps: { ...BLINK, ...WINGS },
    keys: [
      key(0, APEX, { ease: 'out' }),
      key(4, wing(wing(tucked({ body: { rot: -20 } }), 'F', 160, 0.85), 'B', 200, 0.85), { ease: 'inOut' }),
      key(30, wing(wing(tucked({ body: { rot: -10 } }), 'F', 150, 0.85), 'B', 190, 0.85), { ease: 'inOut' }),
      key(36, undefined, { swaps: {} }),
      key(49, FALL),
    ],
  },
  ledgeCatch: {
    length: 8,
    swaps: { ...SHOUT, ...WINGS },
    keys: [key(0, hang(GX, GY + 1.4, { body: { rot: -14 } }), { ease: 'outBack' }), key(8, HANG)],
  },
  ledgeHang: {
    length: 60,
    loop: true,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, HANG),
      key(10, paddle(-2, 0.6)),
      key(20, paddle(-3.5, -0.4)),
      key(30, paddle(-1, 0.5)),
      key(34, undefined, { swaps: { ...BLINK, ...WINGS } }),
      key(38, undefined, { swaps: {} }),
      key(40, paddle(2, -0.4)),
      key(50, paddle(1, 0.4)),
    ],
  },
  ledgeClimb: {
    length: 34,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, HANG, { ease: 'linear' }),
      key(6, pull(6, 30, 0.45), { ease: 'linear' }),
      key(12, pull(12, 30, 1), { ease: 'linear' }),
      key(
        16,
        mix(tucked({ base: { y: 1.2, x: 0.6 }, body: { rot: 30 } }), {
          wingF: { rot: 170 },
          wingB: { rot: 150 },
        }),
        {
          ease: 'out',
          swaps: WINGS,
        },
      ),
      key(18, undefined, { swaps: {} }),
      key(
        20,
        mix(CROUCH, {
          base: { y: -0.8 },
          body: { rot: 12, sy: 0.8, sx: 1.14 },
          wingF: { rot: 110 },
          wingB: { rot: 85 },
        }),
        {
          ease: 'out',
          swaps: BLINK,
        },
      ),
      key(26, mix(CROUCH, { body: { rot: 8, sy: 0.86, sx: 1.1 } }), { ease: 'inOut', swaps: {} }),
      key(34, STAND),
    ],
  },
  ledgeRoll: {
    length: 50,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, HANG, { ease: 'linear' }),
      key(6, pull(6, 40, 0.6), { ease: 'linear' }),
      key(10, mix(ball(120), { base: { y: -belowFloor(10, 40) } }), {
        ease: 'linear',
        swaps: { ...BLINK, ...WINGS },
      }),
      key(18, mix(ball(260), { base: { y: -belowFloor(18, 40) } }), { ease: 'linear' }),
      key(26, mix(ball(400), { base: { y: -belowFloor(26, 40) } }), { ease: 'linear' }),
      key(34, ball(540), { ease: 'out' }),
      key(37, mix(CROUCH, { body: { rot: 720 } }), { ease: 'out', swaps: {} }),
      key(50, mix(STAND, { body: { rot: 720 } })),
    ],
  },
  ledgeJump: {
    length: 20,
    swaps: { ...SHOUT, ...WINGS },
    keys: [
      key(0, HANG, { ease: 'in' }),
      key(3, mix(CROUCH, { body: { rot: -6 } }), { ease: 'out', swaps: { ...SHOUT, ...WINGS } }),
      key(6, flap(110, 70), { ease: 'out' }),
      key(12, undefined, { swaps: LOOK_UP }),
      key(20, RISE),
    ],
  },
  ledgeAttack: attacks.ledgeAttack!,
  hitstun: {
    length: 20,
    swaps: { ...HURT, ...WINGS },
    keys: [
      key(0, RECOIL, { ease: 'out' }),
      key(12, wing(wing(mix(RECOIL, { body: { rot: -10 } }), 'F', -120), 'B', -80)),
      key(20, FALL),
    ],
  },
  tumble: {
    length: 30,
    loop: true,
    swaps: { ...HURT, ...WINGS },
    keys: [
      key(0, tumble(0), { ease: 'linear' }),
      key(10, tumble(-120), { ease: 'linear' }),
      key(20, tumble(-240), { ease: 'linear' }),
      key(30, tumble(-360)),
    ],
  },
  down: {
    length: 40,
    loop: true,
    swaps: { ...DIZZY, ...WINGS },
    keys: [key(0, DOWN), key(20, mix(DOWN, { body: { sy: 1.03, sx: 0.98 }, head: { rot: -14 } }))],
  },
  getupStand: {
    length: 30,
    swaps: { ...BLINK, ...WINGS },
    keys: [
      key(0, DOWN, { ease: 'inOut' }),
      key(10, wing(wing(mix(CROUCH, { base: { rot: -30, x: 1.2, y: -0.4 } }), 'F', 150), 'B', 210), {
        ease: 'out',
        swaps: { ...ANGRY, ...WINGS },
      }),
      key(18, mix(CROUCH, { body: { rot: 6 } }), { ease: 'inOut', swaps: ANGRY }),
      key(30, STAND),
    ],
  },
  techInPlace: {
    length: 26,
    swaps: BLINK,
    keys: [
      key(0, ball(-60), { ease: 'out', swaps: { ...BLINK, ...WINGS } }),
      key(8, mix(CROUCH, { body: { sy: 0.72, y: 1.2 } }), { ease: 'out', swaps: { ...ANGRY, ...WINGS } }),
      key(14, wing(wing(STAND, 'F', -60), 'B', -120), { swaps: ANGRY }),
      key(20, undefined, { swaps: {} }),
      key(26, STAND),
    ],
  },
  techRoll: {
    length: 40,
    keys: [
      key(0, ball(-60), { ease: 'linear', swaps: { ...BLINK, ...WINGS } }),
      key(8, ball(60), { ease: 'linear' }),
      key(16, ball(180), { ease: 'linear' }),
      key(24, ball(300), { ease: 'out' }),
      key(28, mix(CROUCH, { body: { rot: 360 } }), { ease: 'out', swaps: ANGRY }),
      key(40, mix(STAND, { body: { rot: 360 } })),
    ],
  },
  grabHold: {
    length: 30,
    loop: true,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, HOLD),
      key(15, mix(HOLD, { body: { sy: 0.97, y: 0.1 }, wingF: { rot: HOLD.wingF!.rot! + 15 } })),
    ],
  },
  grabbed: {
    length: 20,
    loop: true,
    swaps: { ...HURT, ...WINGS },
    keys: [
      key(0, HELD),
      key(10, mix(wing(wing(HELD, 'F', -70, 1.0), 'B', -20, 0.95), { body: { rot: -4 } })),
    ],
  },
  taunt: {
    length: 60,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(6, mix(CROUCH, { body: { rot: 10 } }), { ease: 'out', swaps: { face: 'faceHappy' } }),
      ...Array.from({ length: 6 }, (_, i) => {
        const up = i % 2 === 0;
        return key(12 + i * 6, up ? beat(true, i) : beat(false, i), {
          ease: up ? 'out' : 'in',
          swaps: { face: 'faceHappy', ...WINGS },
          z: up ? { wingF: 8.5 } : {},
        });
      }),
      key(52, undefined, { swaps: {}, z: {} }),
      key(60, STAND),
    ],
  },
  respawn: {
    length: 60,
    swaps: WINGS,
    keys: [
      key(0, flap(-70, -110), { ease: 'inOut', swaps: { ...SHOUT, ...WINGS } }),
      key(10, flap(100, 70)),
      key(20, flap(-70, -110), { swaps: WINGS }),
      key(30, flap(100, 70)),
      key(40, wing(wing(STAND, 'F', 175), 'B', 175)),
      key(44, undefined, { swaps: { wingF: null, wingB: null } }),
      key(60, STAND),
    ],
  },
  ...attacks,
};
