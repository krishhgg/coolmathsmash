import type { AnimClip, Key } from '../../../render/rig/types';
import { R } from './parts';
import {
  BLINK,
  DETERMINED,
  DETERMINED_DOWN,
  DETERMINED_UP,
  DIZZY,
  FLINCH,
  GRIN,
  GRIT,
  HAPPY,
  HURT,
  LICK_AIM,
  SHOCK,
  SMILE,
  STRAIN,
  WHEE,
  WORRY,
  body,
  fx,
  ground,
  key,
  lick,
  look,
  mix,
  roll,
  type Pose,
  type Pt,
} from './poses';

/**
 * Red Ball's movement, defence, ledge and hurt clips. He has no limbs, so every one is the ball squashing,
 * stretching, rolling and bouncing, and his face doing the acting.
 */

/** Where the ledge's top corner sits while he hangs (sim/movement.ts hangPos: width / 2 + 0.5, 0.85 x height). */
export const LEDGE_GRIP: [number, number] = [5.5, -9.35];
const [GX, GY] = LEDGE_GRIP;

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * The ledge corner in rig space `frame` frames into a getup that carries him `dist` past it by `moveEnd`: the
 * engine slides the origin from the hang position onto the stage, rising 1.6 times faster than it moves across.
 */
function cornerAt(frame: number, moveEnd: number, dist: number): Pt {
  const t = smooth(Math.min(1, frame / moveEnd));
  return [GX + (-dist - GX) * t, GY * (1 - Math.min(1, t * 1.6))];
}

/** Puts the ball's centre at `corner` + `rel`. */
const nearCorner = (corner: Pt, rel: Pt, sx = 1, sy = 1): Pose =>
  mix(ground(1, 1, corner[0] + rel[0], -(corner[1] + rel[1] + R)), body(sx, sy));

/** Hanging by his teeth: the ball pressed to the wall under the lip, face tipped up to the bite. */
const HANG_REL: Pt = [-4.5, 3.3];
const BITE = { fxBack: 'biteInk', fx2: 'bite', fx4: 'sweat' };
const HANG = mix(
  nearCorner(LEDGE_GRIP, HANG_REL, 0.95, 1.06),
  roll(-28),
  fx('fx2', GX, GY),
  fx('fx3', GX, GY),
  fx('fx4', -3.8, -9.6, 0.8),
);
const HANG_SWAY = mix(HANG, body(0.94, 1.08), roll(-24), fx('fx4', -4.3, -7.9, 0.75));
const HANG_SWAY_B = mix(HANG, body(0.96, 1.05), roll(-31), fx('fx4', -3.4, -9.2, 0.72));

/** Lying flat after a missed tech: squashed, rolled onto his back. */
const DOWN = mix(ground(1.32, 0.7), roll(-75));

/** Stars circling his head: fx bone poses for `count` stars `phase` (0-1) of the way round. */
function stars(phase: number, rx = 4.2, ry = 1.1, y = -12): Pose {
  return mix(
    ...(['fx1', 'fx2'] as const).map((bone, i) => {
      const a = (phase + i / 2) * Math.PI * 2;
      return fx(bone, Math.cos(a) * rx, y + Math.sin(a) * ry, 0.75 + 0.2 * Math.sin(a));
    }),
  );
}
const STARS = { fx1: 'star', fx2: 'star' };

/** A wobbling loop with stars going round: dizzy, helpless. */
function woozy(length: number, wobble: (i: number) => Pose, starY: number): AnimClip {
  const n = 8;
  return {
    length,
    loop: true,
    swaps: { ...DIZZY, ...STARS },
    keys: Array.from({ length: n }, (_, i) =>
      key((i * length) / n, mix(wobble(i), stars(i / n, 4.2, 1.1, starY)), { ease: 'linear' }),
    ),
  };
}

/** A ball rolling along the floor: `deg` per loop of `length` frames, with a bump every half turn. */
function rolling(
  length: number,
  from: number,
  deg: number,
  lean: Pose,
  bump: Pose,
  extra: Partial<AnimClip> = {},
): AnimClip {
  return {
    length,
    loop: true,
    keys: [
      key(0, mix(lean, roll(from)), { ease: 'linear' }),
      key(length / 4, mix(lean, bump, roll(from + deg / 4)), { ease: 'linear' }),
      key(length / 2, mix(lean, roll(from + deg / 2)), { ease: 'linear' }),
      key((3 * length) / 4, mix(lean, bump, roll(from + (3 * deg) / 4)), { ease: 'linear' }),
      key(length, mix(lean, roll(from + deg)), { ease: 'linear' }),
    ],
    ...extra,
  };
}

/** Running: leaning into it, a little smeared, speed lines behind. */
const RUN = fx('fx3', -5.4, -5.6, 0.85);

/** Dust kicked up behind a rolling ball. */
const dustBehind = (x: number, s: number): Pose => fx('fx1', x, -0.45 * s, s);

/**
 * A ledge getup's keys after the hang: the ball's path relative to the corner, keyed on the engine's own lift of
 * the origin, with face and effect swaps where they change.
 */
function getup(
  moveEnd: number,
  dist: number,
  path: [frame: number, rel: Pt, extra: Pose, swaps?: Key['swaps']][],
): Key[] {
  return [
    key(0, HANG, { swaps: { ...STRAIN, ...BITE } }),
    ...path.map(([frame, rel, extra, swaps]) =>
      key(frame, mix(nearCorner(cornerAt(frame, moveEnd, dist), rel), extra), swaps ? { swaps } : {}),
    ),
  ];
}

const BITE_AT = (frame: number, moveEnd: number, dist: number): Pose => {
  const [cx, cy] = cornerAt(frame, moveEnd, dist);
  return mix(fx('fx2', cx, cy), fx('fx3', cx, cy));
};

export const clips: Record<string, AnimClip> = {
  /** Breathing in place with the signature smirk, and a blink. */
  idle: {
    length: 72,
    loop: true,
    keys: [
      key(0, ground()),
      key(18, mix(ground(0.985, 1.022), look(0, -0.08), roll(-1.5))),
      key(36, ground()),
      key(54, mix(ground(1.024, 0.978), look(0, 0.06), roll(1))),
      key(58, undefined, { swaps: BLINK }),
      key(62, undefined, { swaps: {} }),
    ],
  },
  /** Rolling along: one turn every 33 frames, the distance a walking-speed ball covers. */
  walk: rolling(33, 0, 360, ground(), ground(1.025, 0.975), { swaps: SMILE }),
  /** The push-off: a squash back, then the roll gets going. */
  dash: {
    length: 11,
    swaps: { ...DETERMINED, fx1: 'dust' },
    keys: [
      key(0, mix(ground(1.14, 0.88, -0.4), roll(-12), dustBehind(-4.2, 0.55))),
      key(3, mix(ground(1.1, 0.93, 0.3), roll(28), dustBehind(-6, 0.9)), { ease: 'in' }),
      key(8, undefined, { swaps: { fx1: null } }),
      key(11, mix(ground(1.08, 0.95, 0.4), roll(180), dustBehind(-7.5, 1.1))),
    ],
  },
  /** Full speed: a turn every 15 frames, leaning into it, speed lines and dust behind. */
  run: {
    length: 15,
    loop: true,
    swaps: { ...DETERMINED, fxBack: 'speed', fx1: 'dust' },
    keys: [
      key(0, mix(ground(1.08, 0.95, 0.4), RUN, roll(180), dustBehind(-4.4, 0.5)), {
        ease: 'linear',
        swaps: {},
      }),
      key(3.75, mix(ground(1.12, 0.91, 0.5), RUN, roll(270), dustBehind(-5.8, 0.8)), { ease: 'linear' }),
      key(7.5, mix(ground(1.06, 0.97, 0.45), RUN, roll(360), dustBehind(-7.0, 1.0)), { ease: 'linear' }),
      key(9, undefined, { swaps: { fx1: null } }),
      key(11.25, mix(ground(1.12, 0.91, 0.5), RUN, roll(450), dustBehind(-5.6, 0.7)), { ease: 'linear' }),
      key(15, mix(ground(1.08, 0.95, 0.4), RUN, roll(540), dustBehind(-4.4, 0.5)), { ease: 'linear' }),
    ],
  },
  /** Skidding to a stop, squashed against the floor, dust thrown up in front. */
  runBrake: {
    length: 14,
    swaps: { ...GRIT, fx1: 'dust' },
    keys: [
      key(0, mix(ground(1.14, 0.88, 0.3), roll(-16), fx('fx1', 4.8, -0.3, 0.5))),
      key(5, mix(ground(1.18, 0.86, 0.4), roll(-22), fx('fx1', 6.6, -0.6, 0.95))),
      key(10, mix(ground(1.04, 0.97, 0.1), roll(-6), fx('fx1', 7.6, -0.9, 1.1)), {
        swaps: { ...DETERMINED, fx1: null },
      }),
      key(14, ground()),
    ],
  },
  /** Turning round mid-run: the face swings across the ball while the old momentum skids him backwards. */
  turn: {
    length: 12,
    swaps: { ...GRIT, fx1: 'dust' },
    keys: [
      key(0, mix(ground(1.12, 0.9), look(-2.5, 0, 0.45), roll(-28), fx('fx1', -5.0, -0.3, 0.5))),
      key(4, mix(ground(1.06, 0.95), look(-0.9, 0, 0.8), roll(-18), fx('fx1', -6.6, -0.7, 0.9))),
      key(8, mix(ground(1.03, 0.97), roll(-6)), { swaps: { ...DETERMINED, fx1: null } }),
      key(12, ground()),
    ],
  },
  crouch: {
    length: 6,
    keys: [key(0, ground()), key(6, mix(ground(1.2, 0.8), look(0, 0.35)))],
    swaps: DETERMINED_DOWN,
  },
  jumpSquat: {
    length: 3,
    swaps: GRIT,
    keys: [key(0, ground(1.06, 0.94), { ease: 'out' }), key(3, ground(1.24, 0.78))],
  },
  /** Takes off stretched tall, rounds out on the way up, floats a little squashed at the top. */
  jump: {
    length: 40,
    swaps: DETERMINED_UP,
    keys: [
      key(0, ground(0.78, 1.26), { ease: 'out' }),
      key(5, mix(body(0.88, 1.13), roll(6))),
      key(12, mix(body(0.97, 1.03), roll(14))),
      key(16, undefined, { swaps: DETERMINED }),
      key(26, mix(body(1, 1), roll(20))),
      key(34, mix(body(1.04, 0.97), roll(22))),
      key(40, mix(body(1.03, 0.98), roll(22))),
    ],
  },
  /** A midair jump: squashes, pops off a ring of air and does a little forward flip, grinning. */
  doubleJump: {
    length: 30,
    swaps: { ...WHEE, fx1: 'ring' },
    keys: [
      key(0, mix(body(1.32, 0.74), fx('fx1', 0, 0.4, 0.55))),
      key(3, mix(body(0.93, 1.08, 0.25, -0.5), roll(48), fx('fx1', 0, 2.0, 1.05)), {
        ease: 'out',
      }),
      key(6, mix(body(0.94, 1.07), roll(130), fx('fx1', 0, 3.4, 1.4)), {
        swaps: { fx1: 'ring', fxBack: null },
      }),
      key(9, undefined, { swaps: { fx1: null, fxBack: null } }),
      key(15, mix(body(1, 1), roll(300))),
      key(21, mix(body(1.02, 0.98), roll(360)), { swaps: { ...DETERMINED_UP, fx1: null, fxBack: null } }),
      key(30, mix(body(1, 1), roll(360))),
    ],
  },
  fall: {
    length: 30,
    loop: true,
    swaps: DETERMINED_DOWN,
    keys: [key(0, mix(body(0.96, 1.05), roll(-3))), key(15, mix(body(0.97, 1.04), roll(3)))],
  },
  /** Every landing squashes him, puffing dust out both sides. */
  land: {
    length: 4,
    swaps: { ...GRIT, fx1: 'dust', fx2: 'dust' },
    keys: [
      key(0, mix(ground(1.32, 0.7), fx('fx1', -5.4, -0.3, 0.7), fx('fx2', 5.4, -0.3, -0.7, 0, 0.7)), {
        ease: 'out',
      }),
      key(2, mix(ground(1.1, 0.92), fx('fx1', -6.6, -0.5, 0.95), fx('fx2', 6.6, -0.5, -0.95, 0, 0.95))),
      key(4, mix(ground(1.02, 0.98), fx('fx1', -7.2, -0.7, 0.85), fx('fx2', 7.2, -0.7, -0.85, 0, 0.85))),
    ],
  },
  /** Big happy grin and three bounces, the last one with a flip. */
  taunt: {
    length: 60,
    keys: [
      key(0, ground()),
      key(4, ground(1.22, 0.8), { swaps: GRIN, ease: 'out' }),
      key(9, ground(0.86, 1.16, 0, 4.5), { ease: 'out' }),
      key(13, mix(ground(1, 1, 0, 6), roll(-8)), { ease: 'in' }),
      key(18, ground(0.95, 1.06, 0, 1.5), { ease: 'out' }),
      key(21, ground(1.25, 0.78), { ease: 'out' }),
      key(25, ground(0.9, 1.1, 0, 3), { ease: 'out' }),
      key(29, mix(ground(1, 1, 0, 3.8), roll(6)), { ease: 'in' }),
      key(33, ground(1.2, 0.82), { ease: 'out' }),
      key(37, ground(0.92, 1.08, 0, 2.2), { ease: 'out' }),
      key(41, mix(ground(1, 1, 0, 3), roll(180)), { ease: 'in' }),
      key(45, mix(ground(1.18, 0.84), roll(360), fx('fx3', 0, -4.6, 1.2)), {
        ease: 'out',
        swaps: { ...HAPPY, fxBack: 'pop' },
      }),
      key(46, mix(ground(1.15, 0.86), roll(360), fx('fx3', 0, -R, 1.5))),
      key(50, mix(ground(0.97, 1.03), roll(360), fx('fx3', 0, -R, 2.1)), { swaps: HAPPY }),
      key(60, mix(ground(), roll(360))),
    ],
  },
  /** Tucked behind the bubble, flinching. */
  shield: {
    length: 10,
    swaps: FLINCH,
    keys: [
      key(0, ground(), { swaps: DETERMINED }),
      key(3, mix(ground(1.1, 0.88), roll(-6), look(-0.2, 0.25)), { swaps: FLINCH }),
      key(10, mix(ground(1.08, 0.9), roll(-5), look(-0.2, 0.25))),
    ],
  },
  shieldDrop: {
    length: 11,
    keys: [
      key(0, mix(ground(1.08, 0.9), roll(-5), look(-0.2, 0.25)), { swaps: FLINCH }),
      key(6, ground(0.98, 1.02), { swaps: DETERMINED }),
      key(11, ground()),
    ],
  },
  /** Shield broken: popped up wide-eyed, then woozy. */
  shieldBreak: {
    length: 30,
    keys: [
      key(0, ground(1.3, 0.7), { swaps: SHOCK }),
      key(5, mix(body(0.82, 1.22), roll(-20))),
      key(15, mix(body(1, 1), roll(15)), { swaps: DIZZY }),
      key(30, mix(body(1, 1), roll(-10))),
    ],
  },
  dizzy: woozy(
    48,
    (i) => mix(ground(i % 2 ? 0.97 : 1.06, i % 2 ? 1.03 : 0.95), roll([-12, -6, 0, 6, 12, 6, 0, -6][i]!)),
    -12.2,
  ),
  /** Flattens under the attack. */
  spotDodge: {
    length: 26,
    keys: [
      key(0, ground(), { swaps: DETERMINED }),
      key(3, ground(1.45, 0.55), { swaps: FLINCH }),
      key(14, ground(1.5, 0.52)),
      key(19, ground(0.9, 1.12), { swaps: DETERMINED, ease: 'out' }),
      key(23, ground(1.03, 0.97)),
      key(26, ground()),
    ],
  },
  rollForward: {
    length: 30,
    swaps: GRIT,
    keys: [
      key(0, ground()),
      key(3, mix(ground(1.12, 0.9), roll(-10))),
      key(20, mix(ground(1.02, 0.98), roll(360))),
      key(24, mix(ground(1.08, 0.93), roll(362)), { swaps: DETERMINED }),
      key(30, mix(ground(), roll(360))),
    ],
  },
  rollBack: {
    length: 30,
    swaps: GRIT,
    keys: [
      key(0, ground()),
      key(3, mix(ground(1.12, 0.9), roll(10))),
      key(20, mix(ground(1.02, 0.98), roll(-360))),
      key(24, mix(ground(1.08, 0.93), roll(-362)), { swaps: DETERMINED }),
      key(30, mix(ground(), roll(-360))),
    ],
  },
  /** A quick tuck and spin. */
  airDodge: {
    length: 46,
    swaps: FLINCH,
    keys: [
      key(0, body()),
      key(3, mix(body(1.12, 0.9), roll(-15)), { ease: 'out' }),
      key(12, mix(body(0.96, 1.04), roll(345))),
      key(16, mix(body(), roll(360)), { swaps: DETERMINED }),
      key(46, mix(body(), roll(360))),
    ],
  },

  ledgeCatch: {
    length: 8,
    keys: [
      key(
        0,
        mix(HANG, nearCorner(LEDGE_GRIP, [HANG_REL[0] - 0.6, HANG_REL[1] - 1.6], 0.9, 1.12), roll(-10)),
        {
          swaps: { ...SHOCK, fx4: null },
        },
      ),
      key(3, mix(HANG, body(1.08, 0.94), roll(-32), fx('fx1', GX - 0.55, GY - 0.8, 0.72)), {
        swaps: { ...STRAIN, ...BITE, fx1: 'pop', fx4: null },
      }),
      key(6, undefined, { swaps: { ...STRAIN, ...BITE, fx4: null } }),
      key(8, mix(HANG, fx('fx1', GX - 0.55, GY - 0.8, 0.9)), { swaps: { ...STRAIN, ...BITE } }),
    ],
  },
  /** Hanging on by his teeth, sweating: the grip sags and pulls up again every two thirds of a second. */
  ledgeHang: {
    length: 90,
    loop: true,
    swaps: { ...STRAIN, ...BITE },
    keys: [key(0, HANG), key(24, HANG_SWAY), key(48, HANG_SWAY_B), key(70, HANG_SWAY), key(90, HANG)],
  },
  /** Lets go of the lip, hops up and rolls onto the stage. */
  ledgeClimb: {
    length: 33,
    keys: getup(30, 7, [
      [
        4,
        [-5.1, 4.9],
        mix(body(1.08, 0.94), roll(-30), BITE_AT(4, 30, 7)),
        { ...STRAIN, ...BITE, fx4: null },
      ],
      [9, [-2.4, -2.8], mix(body(0.86, 1.16), roll(40)), WHEE],
      [14, [1.5, -6.4], mix(body(1, 1), roll(200))],
      [19, [5.2, -4.6], mix(body(1.16, 0.86), roll(340))],
      [24, [7, -5.25], mix(body(1, 1), roll(360)), DETERMINED],
      [33, [7, -5.25], roll(360)],
    ]),
  },
  /** Lets go, pops over the lip and rolls a long way in. */
  ledgeRoll: {
    length: 49,
    keys: getup(40, 25, [
      [
        4,
        [-5.1, 4.9],
        mix(body(1.08, 0.94), roll(-30), BITE_AT(4, 40, 25)),
        { ...STRAIN, ...BITE, fx4: null },
      ],
      [8, [-2.0, -3.2], mix(body(0.88, 1.14), roll(30)), GRIT],
      [13, [2.5, -5.25], mix(body(1.1, 0.92), roll(90))],
      [40, [25, -5.25], roll(360)],
      [44, [25, -5.25], mix(ground(1.08, 0.93), roll(362)), DETERMINED],
      [49, [25, -5.25], roll(360)],
    ]),
  },
  /** Pops up over the lip and bumps forward. */
  ledgeAttack: {
    length: 55,
    keys: getup(20, 7, [
      [
        3,
        [-4.8, 4.2],
        mix(body(1.08, 0.94), roll(-30), BITE_AT(3, 20, 7)),
        { ...STRAIN, ...BITE, fx4: null },
      ],
      [7, [-1.5, -3.5], mix(body(0.86, 1.16), roll(60)), GRIT],
      [12, [3.5, -5.0], mix(body(1.12, 0.9), roll(300))],
      [17, [7, -5.25], roll(360)],
      [21, [7, -5.25], mix(body(0.92, 1.06, -0.8), roll(350))],
      [25, [7, -5.25], mix(body(1.24, 0.86, 3.0), roll(370))],
      [31, [7, -5.25], mix(body(1.2, 0.88, 3.2), roll(370))],
      [42, [7, -5.25], mix(body(0.98, 1.02, 0.4), roll(360)), DETERMINED],
      [55, [7, -5.25], roll(360)],
    ]),
  },
  /** Springs off the lip straight into the jump. */
  ledgeJump: {
    length: 20,
    keys: [
      key(0, HANG, { swaps: { ...STRAIN, ...BITE } }),
      key(3, mix(HANG, body(1.1, 0.92), roll(-34)), { swaps: { ...STRAIN, ...BITE, fx4: null } }),
      key(6, mix(body(0.82, 1.22), roll(-8)), { swaps: WHEE }),
      key(20, mix(body(0.95, 1.05), roll(10))),
    ],
  },

  /** Hit: squashed by the blow, then rebounding. */
  hitstun: {
    length: 20,
    swaps: HURT,
    keys: [
      key(0, mix(body(1.3, 0.78), roll(-18)), { ease: 'out' }),
      key(4, mix(body(0.88, 1.14), roll(-12))),
      key(10, mix(body(1.04, 0.97), roll(-8))),
      key(20, mix(body(), roll(-6))),
    ],
  },
  /** Launched: tumbling backwards, wide-eyed. */
  tumble: {
    length: 40,
    loop: true,
    swaps: SHOCK,
    keys: [
      key(0, mix(body(0.94, 1.07), roll(0)), { ease: 'linear' }),
      key(20, mix(body(1.05, 0.96), roll(-180)), { ease: 'linear' }),
      key(40, mix(body(0.94, 1.07), roll(-360)), { ease: 'linear' }),
    ],
  },
  /** After the recovery: dizzy, stars round his head. */
  helpless: woozy(
    48,
    (i) => mix(body(i % 2 ? 0.97 : 1.02, i % 2 ? 1.04 : 0.98), roll([-10, -5, 0, 5, 10, 5, 0, -5][i]!)),
    -12.6,
  ),
  /** Splatted on the floor. */
  down: {
    length: 40,
    loop: true,
    swaps: DIZZY,
    keys: [key(0, DOWN), key(20, mix(DOWN, ground(1.28, 0.73)))],
  },
  downBound: {
    length: 26,
    keys: [
      key(0, mix(ground(1.5, 0.55), roll(-60)), { swaps: HURT, ease: 'out' }),
      key(6, mix(ground(0.92, 1.08, 0, 1.8), roll(-70)), { ease: 'in' }),
      key(12, mix(ground(1.4, 0.64), roll(-75))),
      key(18, mix(ground(1.28, 0.73), roll(-75)), { swaps: DIZZY }),
      key(26, DOWN),
    ],
  },
  getupStand: {
    length: 29,
    keys: [
      key(0, DOWN, { swaps: DIZZY }),
      key(6, mix(ground(1.4, 0.62), roll(-60)), { ease: 'out' }),
      key(12, mix(ground(0.86, 1.16, 0, 1.8), roll(-15)), { swaps: DETERMINED, ease: 'in' }),
      key(18, mix(ground(1.15, 0.87), roll(0))),
      key(23, ground(0.97, 1.03)),
      key(29, ground()),
    ],
  },
  techInPlace: {
    length: 26,
    swaps: { ...GRIT, fxBack: 'pop' },
    keys: [
      key(0, mix(ground(1.35, 0.68), roll(-20), fx('fx3', 0, -3.6, 1.3)), { ease: 'out' }),
      key(4, mix(ground(0.9, 1.12, 0, 0.8), roll(0), fx('fx3', 0, -R, 1.9))),
      key(7, undefined, { swaps: { ...DETERMINED, fxBack: null } }),
      key(10, ground(1.05, 0.95)),
      key(26, ground()),
    ],
  },
  techRoll: {
    length: 40,
    swaps: GRIT,
    keys: [
      key(0, mix(ground(1.3, 0.7), roll(-10))),
      key(4, mix(ground(), roll(0))),
      key(22, mix(ground(1.02, 0.98), roll(360))),
      key(28, mix(ground(1.08, 0.93), roll(360)), { swaps: DETERMINED }),
      key(40, mix(ground(), roll(360))),
    ],
  },
  respawn: {
    length: 60,
    loop: true,
    swaps: SMILE,
    keys: [key(0, ground()), key(30, mix(ground(0.98, 1.02), roll(-4)))],
  },

  /** Holding someone with his tongue stuck to them. */
  grabHold: {
    length: 40,
    loop: true,
    swaps: LICK_AIM,
    keys: [
      key(0, lick(mix(body(1.02, 0.98, 0.5), roll(4)), [7.2, -5.4])),
      key(20, lick(mix(body(1, 1.01, 0.3), roll(2)), [7.0, -5.7])),
    ],
  },
  /** Caught: squeezed and worried, wriggling. */
  grabbed: {
    length: 30,
    loop: true,
    swaps: WORRY,
    keys: [key(0, mix(body(0.9, 1.08), roll(-5))), key(15, mix(body(0.93, 1.05), roll(5)))],
  },
};

/** Engine and docs/art.md names for the same clips. */
Object.assign(clips, {
  knockdown: clips.down,
  getUp: clips.getupStand,
  tech: clips.techInPlace,
  shieldStun: clips.shield,
  getupRoll: clips.techRoll,
});
