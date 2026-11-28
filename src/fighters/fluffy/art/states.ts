import type { Pose } from '../../../render/rig/author';
import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip } from '../../../render/rig/types';
import {
  FOCUS,
  BLINK,
  DIZZY,
  DUST,
  EFFORT,
  FALL_FUR,
  FLAT_FUR,
  GRAB,
  HALF,
  HAPPY,
  HURT,
  LOOK_BACK,
  PUFF,
  SAD,
  SHOCK,
  WHIP,
  at,
  ball,
  centreOf,
  key,
  smooth,
  type Ball,
  type Pt,
} from './poses';

/**
 * Defence, ledge, hurt and grab-victim clips, plus the taunt. Lengths follow the engine's actions
 * (`src/sim/constants.ts`): dodges end on their FAF, ledge getups follow the engine's lift from the hang.
 */

const STAND: Ball = {};
const FLAT: Ball = { sx: 1.32, sy: 0.6, face: { y: 0.75 } };
const BRACE: Ball = { x: -0.25, sx: 1.13, sy: 0.84, tilt: -3, face: { y: 0.35 }, look: [0.62, -0.13] };
const WORRIED = { ...SAD, sweat: 'sweat' };

/**
 * Where the ledge's top corner is while hanging (rig space). The engine hangs a fighter half its width plus 0.5
 * out from the corner and 0.85 of its height below it: Fluffy is 10 wide and 11 tall.
 */
export const LEDGE_GRIP: [number, number] = [5.5, -9.35];
const [GX, GY] = LEDGE_GRIP;

/**
 * The corner's rig position `frame` frames into a ledge getup that ends `distance` past the corner on frame
 * `moveEnd`: the engine slides the origin across with a smoothstep and lifts it 1.6 times faster.
 */
function corner(frame: number, moveEnd: number, distance: number): Pt {
  const u = Math.min(1, frame / moveEnd);
  const t = u * u * (3 - 2 * u);
  return [GX - (GX + distance) * t, GY * (1 - Math.min(1, 1.6 * t))];
}

/** The grabber's spiked ball on the corner: the line from the ball's centre to just over the lip. */
const onCorner = (b: Ball, [x, y]: Pt): Ball => ({
  ...b,
  grab: {
    from: [(b.x ?? 0) + 3.6 * (b.sx ?? 1), centreOf(b)[1] - 1.4 * (b.sy ?? 1)],
    to: [x + 0.2, y - 0.45],
    near: -90,
  },
});

/** Hanging under the corner from his grabber, eyes on the lip. `sway` swings him a little. */
const hang = (sway = 0, extra: Ball = {}): Pose =>
  ball(
    onCorner(
      {
        x: 0.45 + sway,
        y: 4.2 - Math.abs(sway) * 0.24,
        tilt: sway * 9 - 4,
        sx: 0.91,
        sy: 1.07,
        spin: sway * 7,
        face: { x: 0.16, y: -0.24 },
        look: [0.55, -0.7],
        ...extra,
      },
      [GX, GY],
    ),
  );

/** A pull-up `frame` frames into a getup: the line reeling him in as the engine lifts him over the corner. */
const pull = (frame: number, moveEnd: number, distance: number, b: Ball): Pose =>
  ball(onCorner(b, corner(frame, moveEnd, distance)));

const CLIMB = { end: 30, distance: 7 };
const ROLL = { end: 40, distance: 25 };
const ATTACK = { end: 20, distance: 7 };

export const STATES: Record<string, AnimClip> = {
  shield: {
    length: 6,
    swaps: { ...WORRIED, ...FLAT_FUR },
    keys: [
      key(0, ball(STAND), { ease: 'out', swaps: { sweat: null } }),
      key(3, ball({ ...BRACE, sx: 1.2, sy: 0.78, tilt: -6 }), { ease: 'out', swaps: WORRIED }),
      key(6, ball(BRACE)),
    ],
  },
  shieldDrop: {
    length: 11,
    swaps: { ...WORRIED, ...FLAT_FUR },
    keys: [
      key(0, ball(BRACE), { ease: 'out' }),
      key(5, ball({ sx: 0.94, sy: 1.07, tilt: 5, face: { y: -0.15 }, look: [0.32, -0.24] }), {
        swaps: { ...HALF, sweat: null },
      }),
      key(8, undefined, { swaps: { fur: 'fur', lids: null, sweat: null } }),
      key(11, ball(STAND)),
    ],
  },
  shieldBreak: {
    length: 40,
    swaps: { ...SHOCK, fur: 'furBristle' },
    keys: [
      key(0, ball({ sx: 1.25, sy: 0.78, puff: 1.1 }), { ease: 'out' }),
      key(6, ball({ sx: 0.82, sy: 1.25, float: true, puff: 1.15, look: [0, -0.5] }), { ease: 'inOut' }),
      key(20, ball({ float: true, spin: 25, look: [-0.3, -0.4] }), { swaps: { ...SHOCK, ...FALL_FUR } }),
      key(40, ball({ float: true, spin: 0, look: [0, 0.3] }), { swaps: DIZZY }),
    ],
  },
  dizzy: {
    length: 60,
    loop: true,
    swaps: DIZZY,
    keys: [
      key(0, ball({ x: -0.3, tilt: -9, sx: 1.04, sy: 0.96, face: { x: -0.2 } })),
      key(30, ball({ x: 0.3, tilt: 9, sx: 1.04, sy: 0.96, face: { x: 0.2 } })),
    ],
  },
  spotDodge: {
    length: 25,
    swaps: BLINK,
    keys: [
      key(0, ball(STAND), { ease: 'out' }),
      key(3, ball({ sx: 1.45, sy: 0.48, face: { y: 1.0 } }), {
        ease: 'inOut',
        swaps: { ...BLINK, ...FLAT_FUR },
      }),
      key(15, ball({ sx: 1.4, sy: 0.52, face: { y: 0.95 } }), { ease: 'out' }),
      key(19, ball({ sx: 0.9, sy: 1.1 }), { ease: 'inOut', swaps: {} }),
      key(25, ball(STAND)),
    ],
  },
  rollForward: {
    length: 29,
    swaps: { ...BLINK, fur: 'furRoll' },
    keys: [
      key(0, ball({ sx: 1.1, sy: 0.9 }), { ease: 'in' }),
      key(4, ball({ y: -0.5, tilt: 40 }), { ease: 'linear' }),
      key(18, ball({ y: -0.5, tilt: 340 }), { ease: 'out' }),
      key(22, ball({ sx: 1.12, sy: 0.88, tilt: 360 }), { ease: 'inOut', swaps: HALF }),
      key(29, ball({ tilt: 360 })),
    ],
  },
  rollBack: {
    length: 34,
    swaps: { ...BLINK, fur: 'furRoll' },
    keys: [
      key(0, ball({ sx: 1.1, sy: 0.9, face: LOOK_BACK }), { ease: 'in' }),
      key(4, ball({ y: -0.5, tilt: -40, face: LOOK_BACK }), { ease: 'linear' }),
      key(18, ball({ y: -0.5, tilt: -340, face: LOOK_BACK }), { ease: 'out' }),
      key(22, ball({ sx: 1.12, sy: 0.88, tilt: -360 }), { ease: 'inOut', swaps: HALF }),
      key(34, ball({ tilt: -360 })),
    ],
  },
  airDodge: {
    length: 48,
    swaps: { ...BLINK, ...PUFF },
    keys: [
      key(0, ball({ float: true, sx: 0.88, sy: 0.88, puff: 0.9 }), { ease: 'out' }),
      key(6, ball({ float: true, sx: 0.8, sy: 0.8, spin: 120, puff: 0.92 }), { ease: 'linear' }),
      key(28, ball({ float: true, sx: 0.84, sy: 0.84, spin: 330 }), { ease: 'out' }),
      key(34, ball({ float: true, sx: 1.04, sy: 1.04, spin: 360 }), { swaps: HALF }),
      key(48, ball({ float: true, spin: 360 })),
    ],
  },
  ledgeCatch: {
    length: 19,
    swaps: { ...SHOCK, mouth: null, ...GRAB },
    keys: [
      key(0, hang(-0.65, { y: 5.3, sy: 1.18, tilt: -14 }), {
        ease: 'out',
      }),
      key(10, hang(0.25, { y: 3.65, sx: 1.01, sy: 0.98 }), { ease: 'inOut' }),
      key(19, hang(0)),
    ],
  },
  ledgeHang: {
    length: 60,
    loop: true,
    swaps: { ...GRAB, sweat: 'sweat' },
    keys: [
      key(0, hang(0)),
      key(15, hang(-0.85, { look: [0.72, -0.52] })),
      key(30, hang(-0.28, { look: [0.24, -0.66] })),
      key(44, undefined, { swaps: { ...GRAB, ...BLINK } }),
      key(45, hang(0.23, { spin: -7 })),
      key(48, undefined, { swaps: GRAB }),
    ],
  },
  ledgeClimb: {
    length: 33,
    swaps: { ...EFFORT, ...GRAB },
    keys: smooth([
      key(0, hang(0), { ease: 'in' }),
      key(
        6,
        pull(6, CLIMB.end, CLIMB.distance, {
          x: 0.1,
          y: 2.6,
          sx: 0.88,
          sy: 1.16,
          tilt: 14,
          look: [0.4, -0.5],
        }),
        {
          ease: 'linear',
        },
      ),
      key(
        12,
        pull(12, CLIMB.end, CLIMB.distance, {
          x: -0.15,
          y: 0.25,
          sx: 0.9,
          sy: 1.12,
          tilt: 10,
          look: [0.3, -0.3],
        }),
        {
          ease: 'out',
        },
      ),
      key(
        16,
        pull(16, CLIMB.end, CLIMB.distance, {
          x: -0.4,
          y: -1.55,
          sx: 0.92,
          sy: 1.11,
          tilt: 12,
          look: [-0.1, 0.1],
        }),
        { ease: 'linear' },
      ),
      key(19, ball({ y: -1.7, sx: 0.97, sy: 1.04, tilt: 15, look: [0.3, 0.2] }), {
        ease: 'in',
        swaps: { ...HALF, grabLine: null, tip: null },
      }),
      key(26, ball({ sx: 1.2, sy: 0.8, face: { y: 0.3 }, fx3: at(0, 0, 0.85) }), {
        ease: 'out',
        swaps: { ...HALF, ...DUST, grabLine: null, tip: null },
      }),
      key(31, ball({ fx3: at(0, 0, 0.3) }), { swaps: { grabLine: null, tip: null } }),
      key(33, ball(STAND)),
    ]),
  },
  ledgeRoll: {
    length: 45,
    swaps: { ...EFFORT, ...GRAB },
    keys: [
      key(0, hang(0), { ease: 'in' }),
      key(8, pull(8, ROLL.end, ROLL.distance, { x: 0.3, sx: 0.88, sy: 1.16, tilt: 16, look: [0.4, -0.5] }), {
        ease: 'linear',
      }),
      key(14, ball({ y: -0.6, tilt: 60 }), { ease: 'linear', swaps: { ...BLINK, fur: 'furRoll' } }),
      key(34, ball({ y: -0.5, tilt: 340 }), { ease: 'out' }),
      key(40, ball({ sx: 1.12, sy: 0.88, tilt: 360 }), { ease: 'inOut', swaps: HALF }),
      key(45, ball({ tilt: 360 })),
    ],
  },
  ledgeAttack: {
    length: 55,
    swaps: { ...EFFORT, ...GRAB },
    keys: [
      key(0, hang(0), { ease: 'in' }),
      key(
        8,
        pull(8, ATTACK.end, ATTACK.distance, { x: 0.3, sx: 0.88, sy: 1.16, tilt: 14, look: [0.4, -0.4] }),
        {
          ease: 'linear',
        },
      ),
      key(
        16,
        ball({ grab: { from: [-1, -5], to: [-6, -9], near: -150 }, x: -0.6, sx: 0.9, sy: 1.08, tilt: -10 }),
        {
          ease: 'in',
          swaps: { ...FOCUS, ...GRAB },
        },
      ),
      key(
        22,
        ball({ grab: { from: [2, -5], to: [16, -5] }, x: 1.4, sx: 1.14, sy: 0.9, tilt: 10, look: [0.5, 0] }),
        {
          ease: 'linear',
        },
      ),
      key(
        25,
        ball({ grab: { from: [2, -5], to: [16, -5] }, x: 1.4, sx: 1.14, sy: 0.9, tilt: 10, look: [0.5, 0] }),
        {
          ease: 'in',
          swaps: { ...FOCUS, ...WHIP },
        },
      ),
      key(40, ball({ grab: { from: [0, -4.7], to: [2, -4.7] } }), {
        ease: 'out',
        swaps: { ...HALF, ...GRAB },
      }),
      key(41, undefined, { swaps: HALF }),
      key(55, ball(STAND)),
    ],
  },
  ledgeJump: {
    length: 20,
    swaps: { ...EFFORT, ...GRAB },
    keys: smooth([
      key(0, hang(0), { ease: 'linear' }),
      key(4, ball(onCorner({ y: -1, sx: 0.82, sy: 1.25, tilt: 8, look: [0.3, -0.6] }, [GX - 4, GY + 6])), {
        ease: 'out',
      }),
      key(7, ball({ sx: 0.85, sy: 1.2, float: true, look: [0.3, -0.5] }), { ease: 'inOut', swaps: FALL_FUR }),
      key(20, ball({ float: true, look: [0.35, -0.1] }), { swaps: {} }),
    ]),
  },
  hitstun: {
    length: 20,
    swaps: { ...HURT, fur: 'furBristle' },
    keys: [
      key(0, ball({ x: -0.6, float: true, sx: 1.18, sy: 0.84, tilt: -14, puff: 1.08 }), { ease: 'out' }),
      key(6, ball({ x: -0.3, float: true, sx: 0.9, sy: 1.1, tilt: -6 }), {
        ease: 'inOut',
        swaps: { ...HURT, ...PUFF },
      }),
      key(20, ball({ float: true, tilt: -2 }), { swaps: { ...HURT, ...PUFF } }),
    ],
  },
  tumble: {
    length: 32,
    loop: true,
    swaps: { ...SHOCK, ...FALL_FUR },
    keys: [
      key(0, ball({ float: true, tilt: 0, sx: 1.04, sy: 0.96 }), { ease: 'linear' }),
      key(16, ball({ float: true, tilt: 180, sx: 0.96, sy: 1.04 }), { ease: 'linear' }),
      key(32, ball({ float: true, tilt: 360, sx: 1.04, sy: 0.96 }), { ease: 'linear' }),
    ],
  },
  helpless: {
    length: 40,
    loop: true,
    swaps: { ...SAD, ...FALL_FUR },
    keys: [
      key(0, ball({ float: true, tilt: -6, sx: 0.97, sy: 1.04, look: [0, 0.45] })),
      key(20, ball({ float: true, tilt: 6, sx: 1.0, sy: 1.0, look: [0.1, 0.5] })),
    ],
  },
  down: {
    length: 40,
    loop: true,
    swaps: DIZZY,
    keys: [key(0, ball(FLAT)), key(20, ball({ ...FLAT, sx: 1.34, sy: 0.58 }))],
  },
  downBound: {
    length: 26,
    swaps: { ...HURT, ...FLAT_FUR },
    keys: [
      key(0, ball({ sx: 1.45, sy: 0.5, face: { y: 0.9 } }), {
        ease: 'out',
        swaps: { ...HURT, ...FLAT_FUR, ...DUST },
      }),
      key(7, ball({ y: -2.2, sx: 0.92, sy: 1.08, tilt: 10 }), {
        ease: 'in',
        swaps: { ...HURT, ...FLAT_FUR },
      }),
      key(13, ball({ sx: 1.4, sy: 0.55, face: { y: 0.85 } }), { ease: 'out' }),
      key(26, ball(FLAT), { swaps: DIZZY }),
    ],
  },
  getupStand: {
    length: 29,
    keys: [
      key(0, ball(FLAT), { ease: 'inOut', swaps: DIZZY }),
      key(8, ball({ sx: 1.38, sy: 0.55, face: { y: 0.9 } }), {
        ease: 'out',
        swaps: { ...HALF, ...FLAT_FUR },
      }),
      key(14, ball({ y: -1.8, sx: 0.88, sy: 1.15 }), { ease: 'in', swaps: { ...BLINK, ...PUFF } }),
      key(20, ball({ sx: 1.15, sy: 0.85 }), { ease: 'out', swaps: {} }),
      key(29, ball(STAND)),
    ],
  },
  techInPlace: {
    length: 26,
    swaps: { ...BLINK, ...PUFF },
    keys: [
      key(0, ball({ sx: 1.3, sy: 0.65 }), { ease: 'linear' }),
      key(5, ball({ y: -1.4, sx: 0.9, sy: 1.12, spin: 180 }), { ease: 'inOut' }),
      key(12, ball({ sx: 1.1, sy: 0.9, spin: 360 }), { ease: 'inOut', swaps: FOCUS }),
      key(26, ball({ spin: 360 }), { swaps: FOCUS }),
    ],
  },
  techRoll: {
    length: 40,
    swaps: { ...BLINK, fur: 'furRoll' },
    keys: [
      key(0, ball({ sx: 1.3, sy: 0.65 }), { ease: 'in' }),
      key(6, ball({ y: -0.5, tilt: 60 }), { ease: 'linear' }),
      key(24, ball({ y: -0.5, tilt: 340 }), { ease: 'out' }),
      key(30, ball({ sx: 1.12, sy: 0.88, tilt: 360 }), { ease: 'inOut', swaps: HALF }),
      key(40, ball({ tilt: 360 })),
    ],
  },
  respawn: {
    length: 60,
    loop: true,
    swaps: HAPPY,
    keys: [key(0, ball({ sx: 1.04, sy: 0.96 })), key(30, ball({ y: -0.4, sx: 0.98, sy: 1.03 }))],
  },
  grabbed: {
    length: 24,
    loop: true,
    swaps: { ...HURT, fur: 'furPuff' },
    keys: [
      key(0, ball({ float: true, sx: 0.88, sy: 1.08, tilt: -6 })),
      key(12, ball({ float: true, sx: 0.92, sy: 1.04, tilt: 6 })),
    ],
  },
  grabRelease: {
    length: 29,
    swaps: SHOCK,
    keys: [
      key(0, ball({ x: -0.8, tilt: -16, sx: 1.12, sy: 0.9, y: -0.4 }), {
        ease: 'out',
        swaps: { ...SHOCK, ...DUST },
      }),
      key(10, ball({ x: -0.3, tilt: -6, sx: 0.98, sy: 1.02 }), { ease: 'inOut', swaps: { ...SHOCK } }),
      key(18, ball({ tilt: 0 }), { swaps: BLINK }),
      key(21, undefined, { swaps: HALF }),
      key(29, ball(STAND)),
    ],
  },
  /** He finds a candy, looks up at it with big eyes, and grins. */
  taunt: {
    length: 60,
    swaps: { prop: 'candy' },
    keys: [
      key(0, ball({ fx1: at(3, -13, 0) }), { ease: 'out' }),
      key(10, ball({ sx: 0.92, sy: 1.1, look: [0.25, -0.6], face: { y: -0.3 }, fx1: at(2.5, -15, 0.9) }), {
        ease: 'inOut',
        swaps: { prop: 'candy', pupils: 'pupils' },
      }),
      key(24, ball({ sx: 0.9, sy: 1.12, look: [0.2, -0.6], face: { y: -0.4 }, fx1: at(2.5, -15.5, 0.9) }), {
        ease: 'out',
      }),
      key(30, ball({ sx: 1.2, sy: 0.82, fx1: at(2.5, -13.5, 0.9) }), {
        ease: 'out',
        swaps: { ...HAPPY, prop: 'candy' },
      }),
      key(38, ball({ y: -2.2, sx: 0.92, sy: 1.1, spin: 10, fx1: at(2.5, -16.5, 0.9) }), { ease: 'in' }),
      key(46, ball({ sx: 1.18, sy: 0.84, fx1: at(2.5, -13, 0.9) }), { ease: 'out' }),
      key(54, ball({ fx1: at(2.5, -14, 0.5) }), { ease: 'in' }),
      key(60, ball({ fx1: at(2.5, -14, 0) }), { swaps: {} }),
    ],
  },
};

/** The tech roll on the getup roll's timeline: the sim's travel ends on frame 28 instead of 30, and 35 frames in all. */
STATES.getupRoll = retimeClip(STATES.techRoll!, 35, [
  [4, 4],
  [30, 28],
]);
/** Tech and getup rolls away from the facing: the back roll with its frames moved onto each action's travel. */
STATES.techRollBack = retimeClip(STATES.rollBack!, 40, [
  [4, 4],
  [20, 30],
]);
STATES.getupRollBack = retimeClip(STATES.rollBack!, 35, [
  [4, 4],
  [20, 28],
]);
/**
 * The air dodge on the neutral dodge's 52 frames (AIR_DODGE_NEUTRAL): keys inside the intangible window (3 to 29)
 * stay put and only the recovery after it stretches. A directional dodge plays the same clip over its own length.
 */
STATES.airDodge = retimeClip(STATES.airDodge!, 52, [[29, 29]]);
