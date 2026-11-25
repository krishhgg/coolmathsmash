import { pointOf, type Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import {
  AIR,
  ANGRY,
  ARMS_OVER_HEAD,
  BACK_ARM_IN_FRONT,
  BATON,
  CROUCH,
  FRONT_ARM_OVER_HEAD,
  GRIN,
  HURT,
  READY,
  SACK,
  SACK_IN_FRONT,
  SHOUT,
  SIDE,
  TUCK,
  aim,
  feet,
  floor,
  fx,
  hands,
  key,
  mix,
  type Pt,
} from './poses';
import { rig } from './rig';

/**
 * Attack clips, keyed on Bob's frame data in `../moves.ts` and `../specials.ts`: frame 1 is the move's first
 * frame, the clip ends at FAF - 1, and `active` repeats the move's hit windows (or its throw or pummel frame), so
 * the renderer's retiming (`src/render/rig/timing.ts`) plays them frame for frame. On every active frame the
 * baton, the sack, a hand, the hook or the swing's smear reaches into each hitbox (`index.test.ts` checks).
 */

/** Holds the night-stick in the front fist at `wrist`, pointing `deg` (0 forward, -90 up, 90 down). */
const swing = (pose: Pose, wrist: Pt, deg: number, bend: 1 | -1 = 1): Pose =>
  aim(hands(pose, null, wrist, bend), 'baton', deg);

/** Stretches the front arm so the wrist reaches `wrist` from where the shoulder is in `pose`. */
function reachF(pose: Pose, wrist: Pt, slack = 1): Pose {
  const [sx, sy] = pointOf(rig, pose, 'armF');
  const k = Math.max(1, (Math.hypot(wrist[0] - sx, wrist[1] - sy) * slack) / 2.68);
  return mix(pose, { armF: { sy: k }, foreF: { sy: k } });
}

/** Stretches the back arm the same way, for the sack. */
function reachB(pose: Pose, wrist: Pt): Pose {
  const [sx, sy] = pointOf(rig, pose, 'armB');
  const k = Math.max(1, Math.hypot(wrist[0] - sx, wrist[1] - sy) / 2.68);
  return mix(pose, { armB: { sy: k }, foreB: { sy: k } });
}

/** A swing smear on the `fxS` bone: pivot, leading edge angle, radius; `back` mirrors it for upward swings. */
const smearAt = (pivot: Pt, deg: number, radius: number, back = false) => ({
  fxS: fx(pivot[0], pivot[1], deg, radius, back ? -radius : radius),
});

/**
 * A smear from the grip's shoulder that reaches the baton's tip in `pose`: the arc a Flash animator draws behind
 * a swing, trailing back from the leading edge.
 */
function trail(pose: Pose, back = false, extra = 0.3): Pose {
  const pivot = pointOf(rig, pose, 'armF');
  const [tx, ty] = pointOf(rig, pose, 'baton', 7.5, 0);
  const deg = (Math.atan2(ty - pivot[1], tx - pivot[0]) * 180) / Math.PI;
  return mix(pose, smearAt(pivot, deg, Math.hypot(tx - pivot[0], ty - pivot[1]) + extra, back));
}

const STANCE = feet({ body: { rot: 6 }, hip: { y: 0.45 }, neck: { rot: -4 } }, floor(-1.8), floor(1.8));
const LUNGE = feet(
  { body: { rot: 14, x: 1.0 }, hip: { y: 0.8 }, neck: { rot: -8 } },
  floor(-2.6),
  floor(2.6),
  false,
  [30, 0],
);
const LOW = feet(
  { body: { rot: 22, x: 0.6 }, hip: { y: 1.7 }, neck: { rot: -14, y: 0.2 } },
  floor(-2.4),
  floor(2.2),
  false,
  [35, 0],
);
const BATON_READY = swing(STANCE, [2.6, -5.8], -60);

/** The opponent held by the collar at the front fist. */
const HOLD = hands(
  feet({ body: { rot: 6 }, hip: { y: 0.45 } }, floor(-1.8), floor(1.6)),
  [0.6, -5.4],
  [4.6, -7.2],
  -1,
);

const strikeKey = (
  frame: number,
  pose: Pose,
  swaps: Key['swaps'],
  extra: Omit<Key, 'frame' | 'pose' | 'swaps'> = {},
) => key(frame, pose, { ease: 'linear', swaps, ...extra });

// Jab: poke, second poke, overhead bonk ----------------------------------------------------------------------

const JAB_BACK = swing(STANCE, [1.8, -5.4], -16);
const JAB_POKE = swing(mix(STANCE, { body: { rot: 4, x: 0.6 } }), [4.9, -6.3], -10);
const JAB2_WIND = swing(STANCE, [2.0, -5.6], 30, -1);
const JAB2_POKE = swing(mix(STANCE, { body: { rot: 5, x: 0.8 } }), [4.9, -5.9], -6, -1);
const JAB3_UP = swing(mix(STANCE, { body: { rot: -6 } }), [1.0, -9.6], -115);
const JAB3_BONK = swing(mix(LUNGE, { body: { rot: 18, x: 0.9 } }), [4.0, -9.2], 18);

// Tilts ----------------------------------------------------------------------------------------------------

const FTILT_BACK = swing(mix(STANCE, { body: { rot: -4 } }), [-0.2, -6.2], -165);
const FTILT_HIT = reachF(swing(mix(LUNGE, { body: { rot: 6 } }), [5.2, -6.4], -8), [5.2, -6.4]);
const FTILT_FOLLOW = swing(mix(LUNGE, { body: { rot: 12 } }), [3.4, -6.0], 50);

const UTILT_UP = (deg: number) =>
  reachF(swing(mix(STANCE, { body: { rot: -4 } }), [1.8, -10.4], deg), [1.8, -10.4]);
const UTILT_FINISH = reachF(swing(mix(STANCE, { body: { rot: -8 } }), [2.2, -11.2], -80), [2.2, -11.2]);

const DTILT_BACK = swing(LOW, [1.0, -3.0], 160, -1);
const DTILT_HIT = swing(LOW, [3.6, -2.5], 6, -1);

// Dash attack: the loot sack swung forward out of the run -----------------------------------------------------

const SLIDE = feet(
  { body: { rot: 18, x: 1.2 }, hip: { y: 1.3 }, neck: { rot: -10 } },
  floor(-2.8),
  floor(2.8),
  false,
  [40, -15],
);
const DASH_WIND = aim(hands(SLIDE, [-2.6, -7.4], [2.4, -5.4]), 'sackH', 130);
const DASH_HIT = aim(reachB(hands(SLIDE, [5.0, -5.9], [2.6, -4.4]), [5.0, -5.9]), 'sackH', -84);
const DASH_LATE = aim(reachB(hands(SLIDE, [4.7, -5.5], [2.6, -4.4]), [4.7, -5.5]), 'sackH', -66);

// Smashes ----------------------------------------------------------------------------------------------------

const FSMASH_WIND = hands(
  swing(mix(STANCE, { body: { rot: -12, x: -0.6 }, neck: { rot: 6 } }), [-0.8, -9.8], -165),
  [-0.4, -9.4],
  null,
);
const FSMASH_TOP = swing(mix(STANCE, { body: { rot: 2 } }), [1.6, -10.6], -80);
const FSMASH_HIT = reachF(swing(mix(LUNGE, { body: { rot: 8, x: 1.6 } }), [6.2, -6.9], -8), [6.2, -6.9]);
const FSMASH_FOLLOW = swing(mix(LUNGE, { body: { rot: 20, x: 1.4 } }), [4.0, -5.4], 70);

const USMASH_LOW = swing(mix(CROUCH, { body: { rot: 4 } }), [2.6, -3.6], 40);
const USMASH_HAND: Pt = [0.8, -12.2];
const USMASH_UP = (deg: number) =>
  reachF(swing(mix(STANCE, { body: { rot: -2 }, hip: { y: 0.2 } }), USMASH_HAND, deg), USMASH_HAND);
const ROTOR = { fx4: fx(USMASH_HAND[0], USMASH_HAND[1] - 0.6, 0, 6.8) };

const DSMASH_HIT = swing(mix(LOW, { body: { rot: 26 } }), [3.6, -2.2], 4, -1);
const DSMASH_WIND = swing(mix(LOW, { body: { rot: 10 } }), [1.4, -4.6], -40, -1);

// Aerials ----------------------------------------------------------------------------------------------------

const NAIR_POSE = swing(
  mix(AIR, { thighF: { rot: -70 }, shinF: { rot: 90 }, thighB: { rot: -40 }, shinB: { rot: 80 } }),
  [4.0, -7.4],
  0,
);
const SPIN = { fx4: fx(0, -6.4, 0, 9.4) };

const FAIR_UP = swing(AIR, [0.6, -10.6], -120);
const FAIR_HIT = reachF(swing(mix(AIR, { body: { rot: 12 } }), [5.2, -9.4], 35), [5.2, -9.4]);
const FAIR_FOLLOW = swing(mix(AIR, { body: { rot: 14 } }), [3.8, -6.0], 85);

/** Back air: Bob twists round (body mirrored) and swings behind him. */
const turned = (pose: Pose): Pose => {
  const out = mix(pose, { body: { sx: -1, x: -(pose.body?.x ?? 0), rot: -(pose.body?.rot ?? 0) } });
  for (const bone of ['fx1', 'fx2', 'fx3', 'fx4', 'fxS']) {
    const p = pose[bone];
    if (p) out[bone] = { ...p, x: -(p.x ?? 0), rot: -(p.rot ?? 0), sx: -(p.sx ?? 1) };
  }
  return out;
};
const BAIR_WIND = swing(AIR, [-0.6, -8.0], -160);
const BAIR_HIT = reachF(swing(mix(AIR, { body: { rot: 8 } }), [4.6, -7.6], 0), [4.6, -7.6]);

const UAIR_FRONT = swing(AIR, [3.0, -8.4], -20);
const UAIR_TOP = (deg: number) =>
  reachF(swing(mix(AIR, { body: { rot: -6 } }), [0.8, -11.0], deg), [0.8, -11.0]);

const DAIR_TUCK = mix(TUCK, { hip: { y: -1.0 }, thighF: { rot: -110 }, thighB: { rot: -85 } });
const DAIR_UP = aim(hands(DAIR_TUCK, [-1.6, -9.6], [-0.6, -10.0]), 'sackH', 125);
const DAIR_HIT = aim(hands(DAIR_TUCK, [0.9, -4.6], [1.6, -4.8], -1), 'sackH', 0);

// Grabs and throws --------------------------------------------------------------------------------------------

const reachBoth = (pose: Pose, f: Pt, b: Pt): Pose => {
  const [sx, sy] = pointOf(rig, pose, 'armB');
  const k = Math.max(1, Math.hypot(b[0] - sx, b[1] - sy) / 2.68);
  return hands(reachF(mix(pose, { armB: { sy: k }, foreB: { sy: k } }), f), b, f, -1);
};

// Specials ---------------------------------------------------------------------------------------------------

const HOOK_DIR = -66;
const hookAt = (pose: Pose, dist: number): Pose => {
  const [hx, hy] = pointOf(rig, pose, 'handF', 0, 0.6);
  const r = (HOOK_DIR * Math.PI) / 180;
  const tip: Pt = [hx + Math.cos(r) * dist, hy + Math.sin(r) * dist];
  return mix(pose, {
    fx1: fx(tip[0], tip[1], HOOK_DIR),
    fx2: fx(hx, hy, HOOK_DIR, Math.max(0.01, dist - 0.8), 1),
  });
};
const HOOK_THROW = reachF(hands(mix(AIR, { body: { rot: -10 } }), [-1.0, -6.0], [3.0, -10.6]), [3.0, -10.6]);
const ZIP = reachF(
  hands(
    mix(AIR, { body: { rot: -22, sy: 1.06 }, thighF: { rot: 10 }, thighB: { rot: 20 } }),
    [-1.6, -6.6],
    [2.6, -11.4],
  ),
  [2.6, -11.4],
);

const TWIRL_POSE = (deg: number) =>
  swing(
    feet(
      { body: { rot: 8, x: 1.0 }, hip: { y: 0.6 }, neck: { rot: -6 } },
      floor(-2.6),
      floor(2.4),
      false,
      [35, 0],
    ),
    [4.6, -6.2],
    deg,
  );

export const attacks: Record<string, AnimClip> = {
  jab: {
    length: 19,
    active: [[4, 5]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, BATON_READY, { ease: 'out' }),
      key(2, JAB_BACK, { ease: 'in' }),
      strikeKey(4, JAB_POKE, { ...SHOUT, ...BATON }),
      key(5, JAB_POKE, { ease: 'inOut' }),
      key(10, swing(STANCE, [2.8, -6.8], -20), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(19, BATON_READY),
    ],
  },
  jab2: {
    length: 19,
    active: [[3, 4]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, JAB_POKE, { ease: 'out' }),
      key(1, JAB2_WIND, { ease: 'in' }),
      strikeKey(3, JAB2_POKE, { ...SHOUT, ...BATON }),
      key(4, JAB2_POKE, { ease: 'inOut' }),
      key(9, swing(STANCE, [2.8, -6.2], 20, -1), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(19, BATON_READY),
    ],
  },
  jab3: {
    length: 32,
    active: [[6, 7]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, JAB2_POKE, { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
      key(4, JAB3_UP, { ease: 'in' }),
      strikeKey(6, trail(JAB3_BONK), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(7, trail(JAB3_BONK), { ease: 'out' }),
      key(11, swing(mix(LUNGE, { body: { rot: 20, x: 0.9 } }), [3.6, -7.0], 45), {
        ease: 'inOut',
        swaps: { ...ANGRY, ...BATON },
        z: {},
      }),
      key(32, BATON_READY),
    ],
  },
  ftilt: {
    length: 29,
    active: [[6, 8]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, BATON_READY, { ease: 'out' }),
      key(4, FTILT_BACK, { ease: 'in' }),
      strikeKey(6, trail(FTILT_HIT), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(8, trail(FTILT_HIT), { ease: 'out' }),
      key(13, FTILT_FOLLOW, { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(29, BATON_READY),
    ],
  },
  utilt: {
    length: 33,
    active: [
      [6, 7],
      [9, 10],
      [12, 13],
      [15, 17],
    ],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, BATON_READY, { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
      key(4, UTILT_UP(-30), { ease: 'linear', swaps: { ...SHOUT, ...BATON, fxBack: 'twirl' } }),
      ...[5, 7, 9, 11, 13].map((f, i) =>
        key(f, mix(UTILT_UP(-30 - 180 * (i + 1)), { fx4: fx(1.8, -10.6, 0, 5.6) }), { ease: 'linear' }),
      ),
      strikeKey(15, mix(trail(UTILT_FINISH, true), { fx4: fx(1.8, -10.6, 0, 5.4) }), {
        ...SHOUT,
        ...BATON,
        fxBack: 'twirl',
        smear: 'smear90',
      }),
      key(17, mix(trail(UTILT_FINISH, true), { fx4: fx(1.8, -10.6, 0, 5.0) }), { ease: 'out' }),
      key(18, undefined, { swaps: { ...SHOUT, ...BATON, smear: 'smear90' } }),
      key(21, UTILT_FINISH, { ease: 'inOut', swaps: { ...ANGRY, ...BATON }, z: {} }),
      key(33, BATON_READY),
    ],
  },
  dtilt: {
    length: 23,
    active: [[6, 7]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, BATON_READY, { ease: 'out' }),
      key(4, DTILT_BACK, { ease: 'in' }),
      strikeKey(6, trail(DTILT_HIT, true), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(7, trail(DTILT_HIT, true), { ease: 'out' }),
      key(11, swing(LOW, [3.0, -2.8], 30, -1), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(23, BATON_READY),
    ],
  },
  dashAttack: {
    length: 39,
    active: [
      [9, 12],
      [13, 20],
    ],
    swaps: { ...ANGRY, ...SACK },
    keys: [
      key(0, DASH_WIND, { ease: 'out' }),
      key(6, aim(DASH_WIND, 'sackH', 150), { ease: 'in' }),
      strikeKey(9, DASH_HIT, { ...SHOUT, ...SACK }, { z: { ...BACK_ARM_IN_FRONT, ...SACK_IN_FRONT } }),
      key(12, DASH_HIT, { ease: 'linear' }),
      key(20, DASH_LATE, { ease: 'inOut', swaps: { ...GRIN, ...SACK } }),
      key(28, aim(hands(STANCE, [1.0, -6.4], null), 'sackH', 10), { ease: 'inOut', z: {} }),
      key(39, READY, { swaps: { ...SIDE, sack: null } }),
    ],
  },
  fsmash: {
    length: 49,
    active: [[13, 15]],
    swaps: { ...ANGRY, ...BATON, handB: 'fist' },
    keys: [
      key(0, BATON_READY, { ease: 'out' }),
      key(8, FSMASH_WIND, { ease: 'inOut', z: FRONT_ARM_OVER_HEAD }),
      key(9, FSMASH_WIND, { ease: 'in' }),
      key(11, FSMASH_TOP, { ease: 'linear', swaps: { ...SHOUT, ...BATON, handB: 'fist' } }),
      strikeKey(
        13,
        trail(FSMASH_HIT, false, 0.6),
        { ...SHOUT, ...BATON, handB: 'fist', smear: 'smear150' },
        { z: {} },
      ),
      key(15, trail(FSMASH_HIT, false, 0.6), { ease: 'out' }),
      key(21, FSMASH_FOLLOW, { ease: 'inOut', swaps: { ...ANGRY, ...BATON, handB: 'fist' } }),
      key(49, BATON_READY),
    ],
  },
  usmash: {
    length: 51,
    active: [
      [10, 11],
      [13, 14],
      [16, 17],
      [19, 20],
      [23, 25],
    ],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, BATON_READY, { ease: 'out' }),
      key(6, USMASH_LOW, { ease: 'in' }),
      key(9, USMASH_UP(-60), {
        ease: 'linear',
        swaps: { ...SHOUT, ...BATON, fxBack: 'twirl' },
        z: FRONT_ARM_OVER_HEAD,
      }),
      ...[10, 12, 14, 16, 18, 20].map((f, i) =>
        key(f, mix(USMASH_UP(-60 - 200 * (i + 1)), ROTOR), { ease: 'linear' }),
      ),
      key(21, USMASH_UP(-100), { ease: 'out', swaps: { ...SHOUT, ...BATON } }),
      strikeKey(23, trail(USMASH_UP(-90), true), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(25, trail(USMASH_UP(-90), true), { ease: 'out' }),
      key(30, USMASH_UP(-80), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(40, swing(STANCE, [2.6, -6.6], -50), { ease: 'inOut', z: {} }),
      key(51, BATON_READY),
    ],
  },
  dsmash: {
    length: 47,
    active: [
      [7, 8],
      [15, 16],
    ],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, BATON_READY, { ease: 'out' }),
      key(4, DSMASH_WIND, { ease: 'in' }),
      strikeKey(7, trail(DSMASH_HIT, true), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(8, trail(DSMASH_HIT, true), { ease: 'inOut' }),
      key(10, DSMASH_HIT, { ease: 'in', swaps: { ...ANGRY, ...BATON } }),
      key(13, mix(DSMASH_WIND, { body: { sx: -0.2 } }), { ease: 'out' }),
      strikeKey(15, turned(trail(DSMASH_HIT, true)), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(16, turned(trail(DSMASH_HIT, true)), { ease: 'inOut' }),
      key(20, turned(DSMASH_HIT), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(30, mix(BATON_READY, { body: { sx: -0.2 } }), { ease: 'out' }),
      key(36, BATON_READY),
      key(47, BATON_READY),
    ],
  },
  getupAttack: {
    length: 45,
    active: [
      [17, 18],
      [25, 26],
    ],
    swaps: { ...HURT, ...BATON },
    keys: [
      key(0, mix(LOW, { body: { rot: -70, y: 2.0 } }), { ease: 'out' }),
      key(10, DSMASH_WIND, { ease: 'in', swaps: { ...ANGRY, ...BATON } }),
      strikeKey(17, trail(swing(LOW, [4.0, -3.2], 10, -1), true), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(18, trail(swing(LOW, [4.0, -3.2], 10, -1), true), { ease: 'inOut' }),
      key(21, mix(DSMASH_WIND, { body: { sx: -0.2 } }), { ease: 'out', swaps: { ...ANGRY, ...BATON } }),
      strikeKey(25, turned(trail(swing(LOW, [4.0, -3.2], 10, -1), true)), {
        ...SHOUT,
        ...BATON,
        smear: 'smear90',
      }),
      key(26, turned(trail(swing(LOW, [4.0, -3.2], 10, -1), true)), { ease: 'inOut' }),
      key(32, turned(BATON_READY), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(38, mix(BATON_READY, { body: { sx: -0.2 } }), { ease: 'out' }),
      key(45, READY, { swaps: SIDE }),
    ],
  },
  nair: {
    length: 39,
    active: [
      [5, 8],
      [9, 22],
    ],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, swing(AIR, [2.4, -6.2], -60), { ease: 'in' }),
      key(4, NAIR_POSE, { ease: 'linear', swaps: { ...SHOUT, ...BATON, fxBack: 'twirl' } }),
      key(5, mix(NAIR_POSE, SPIN), { ease: 'linear' }),
      key(9, mix(NAIR_POSE, SPIN, { body: { rot: 360 } }), { ease: 'linear' }),
      key(15, mix(NAIR_POSE, SPIN, { body: { rot: 720 } }), { ease: 'linear' }),
      key(22, mix(NAIR_POSE, SPIN, { body: { rot: 1080 } }), { ease: 'out', swaps: { ...ANGRY, ...BATON } }),
      key(23, undefined, { swaps: { ...ANGRY, ...BATON, fxBack: null } }),
      key(30, mix(swing(AIR, [2.6, -6.4], -40), { body: { rot: 1080 } }), { ease: 'inOut' }),
      key(39, mix(AIR, { body: { rot: 1080 } }), { swaps: SIDE }),
    ],
  },
  fair: {
    length: 35,
    active: [[7, 9]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, swing(AIR, [2.4, -6.4], -50), { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
      key(4, FAIR_UP, { ease: 'in' }),
      strikeKey(7, trail(FAIR_HIT), { ...SHOUT, ...BATON, smear: 'smear90' }, { z: {} }),
      key(9, trail(FAIR_HIT), { ease: 'out' }),
      key(14, FAIR_FOLLOW, { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(35, mix(AIR, {}), { swaps: SIDE }),
    ],
  },
  bair: {
    length: 37,
    active: [[9, 11]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, swing(AIR, [2.4, -6.4], -50), { ease: 'out' }),
      key(5, turned(BAIR_WIND), { ease: 'in' }),
      strikeKey(9, turned(trail(BAIR_HIT)), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(11, turned(trail(BAIR_HIT)), { ease: 'out' }),
      key(17, turned(swing(AIR, [3.4, -6.4], 40)), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(26, mix(AIR, { body: { sx: -0.2 } }), { ease: 'out' }),
      key(37, AIR, { swaps: SIDE }),
    ],
  },
  uair: {
    length: 33,
    active: [[6, 9]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, swing(AIR, [2.4, -6.4], -40), { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
      key(3, UAIR_FRONT, { ease: 'in' }),
      strikeKey(6, trail(UAIR_TOP(-82), true), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(9, trail(UAIR_TOP(-102), true), { ease: 'out' }),
      key(14, UAIR_TOP(-150), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(22, swing(AIR, [1.0, -8.0], -120), { ease: 'inOut', z: {} }),
      key(33, AIR, { swaps: SIDE }),
    ],
  },
  dair: {
    length: 49,
    active: [
      [14, 16],
      [17, 22],
    ],
    swaps: { ...ANGRY, ...SACK, handF: 'fist' },
    keys: [
      key(0, aim(hands(AIR, [1.0, -6.0], [2.0, -6.4]), 'sackH', 20), { ease: 'out' }),
      key(8, DAIR_UP, { ease: 'inOut' }),
      key(11, DAIR_UP, { ease: 'in' }),
      strikeKey(
        14,
        DAIR_HIT,
        { ...SHOUT, ...SACK, handF: 'fist' },
        { z: { ...BACK_ARM_IN_FRONT, ...SACK_IN_FRONT } },
      ),
      key(16, DAIR_HIT, { ease: 'linear' }),
      key(22, aim(DAIR_HIT, 'sackH', 8), { ease: 'inOut', swaps: { ...GRIN, ...SACK, handF: 'fist' } }),
      key(34, aim(hands(AIR, [1.0, -6.0], [2.0, -6.4]), 'sackH', 30), { ease: 'inOut', z: {} }),
      key(49, AIR, { swaps: SIDE }),
    ],
  },
  grab: {
    length: 35,
    active: [[7, 8]],
    swaps: SIDE,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(4, hands(mix(STANCE, { body: { rot: -4 } }), [0.0, -7.2], [1.6, -7.6]), { ease: 'in' }),
      strikeKey(7, reachBoth(mix(LUNGE, { body: { rot: 16 } }), [6.0, -7.4], [5.2, -6.8]), ANGRY),
      key(8, reachBoth(mix(LUNGE, { body: { rot: 16 } }), [6.0, -7.4], [5.2, -6.8]), { ease: 'inOut' }),
      key(16, hands(STANCE, [1.0, -6.4], [3.0, -6.8]), { ease: 'inOut', swaps: SIDE }),
      key(35, READY),
    ],
  },
  dashGrab: {
    length: 43,
    active: [[10, 11]],
    swaps: SIDE,
    keys: [
      key(0, mix(READY, { body: { rot: 12 } }), { ease: 'out' }),
      key(6, hands(mix(SLIDE, { body: { rot: 4 } }), [0.0, -7.2], [1.6, -7.6]), { ease: 'in' }),
      strikeKey(10, reachBoth(mix(SLIDE, { body: { rot: 22, x: 1.6 } }), [6.6, -7.4], [6.0, -6.8]), ANGRY),
      key(11, reachBoth(mix(SLIDE, { body: { rot: 22, x: 1.6 } }), [6.6, -7.4], [6.0, -6.8]), {
        ease: 'inOut',
      }),
      key(20, hands(STANCE, [1.0, -6.4], [3.0, -6.8]), { ease: 'inOut', swaps: SIDE }),
      key(43, READY),
    ],
  },
  pivotGrab: {
    length: 38,
    active: [[11, 12]],
    swaps: SIDE,
    keys: [
      key(0, mix(READY, { body: { sx: -1, rot: 10 } }), { ease: 'in' }),
      key(5, mix(STANCE, { body: { sx: -0.15 } }), { ease: 'out', swaps: { ...SIDE, face: 'face3qWide' } }),
      key(7, hands(mix(STANCE, { body: { rot: -4 } }), [0.0, -7.2], [1.6, -7.6]), {
        ease: 'in',
        swaps: SIDE,
      }),
      strikeKey(11, reachBoth(mix(LUNGE, { body: { rot: 18, x: 1.4 } }), [6.8, -7.4], [6.2, -6.8]), ANGRY),
      key(12, reachBoth(mix(LUNGE, { body: { rot: 18, x: 1.4 } }), [6.8, -7.4], [6.2, -6.8]), {
        ease: 'inOut',
      }),
      key(20, hands(STANCE, [1.0, -6.4], [3.0, -6.8]), { ease: 'inOut', swaps: SIDE }),
      key(38, READY),
    ],
  },
  grabHold: {
    length: 30,
    loop: true,
    swaps: { ...GRIN, handF: 'fist', handB: 'fist' },
    keys: [key(0, HOLD), key(15, mix(HOLD, { hip: { y: 0.55 }, neck: { rot: -3 } })), key(30, HOLD)],
  },
  pummel: {
    length: 6,
    active: [[1, 1]],
    swaps: { ...GRIN, handF: 'fist', handB: 'handOpen' },
    keys: [
      key(0, HOLD, { ease: 'out', z: BACK_ARM_IN_FRONT }),
      key(1, hands(HOLD, [4.4, -5.0], null, -1), { ease: 'inOut' }),
      key(3, hands(HOLD, [4.0, -4.6], null, -1), { ease: 'inOut' }),
      key(6, HOLD),
    ],
  },
  fthrow: {
    length: 29,
    active: [[12, 12]],
    swaps: { ...ANGRY, handF: 'fist', handB: 'fist' },
    keys: [
      key(0, HOLD, { ease: 'out' }),
      key(8, hands(mix(STANCE, { body: { rot: -6, x: -0.4 } }), [1.6, -6.8], [2.6, -7.0], -1), {
        ease: 'in',
      }),
      strikeKey(12, reachBoth(mix(LUNGE, { body: { rot: 18, x: 1.4 } }), [6.2, -7.8], [5.6, -6.4]), {
        ...SHOUT,
        handF: 'handOpen',
        handB: 'handOpen',
      }),
      key(16, reachBoth(mix(LUNGE, { body: { rot: 18, x: 1.4 } }), [6.2, -7.8], [5.6, -6.4]), {
        ease: 'inOut',
      }),
      key(29, READY, { swaps: SIDE }),
    ],
  },
  bthrow: {
    length: 43,
    active: [[22, 22]],
    swaps: { ...ANGRY, handB: 'fist', handF: 'fist' },
    keys: [
      key(0, HOLD, { ease: 'out' }),
      key(8, mix(HOLD, { body: { sx: 0.2 } }), { ease: 'in' }),
      key(12, turned(swing(STANCE, [1.0, -9.8], -120)), {
        ease: 'inOut',
        swaps: { ...ANGRY, ...BATON },
        z: FRONT_ARM_OVER_HEAD,
      }),
      key(18, turned(swing(mix(STANCE, { body: { rot: -6 } }), [0.8, -10.0], -130)), { ease: 'in' }),
      strikeKey(22, turned(trail(JAB3_BONK)), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(24, turned(trail(JAB3_BONK)), { ease: 'out' }),
      key(30, turned(swing(LUNGE, [3.4, -6.6], 50)), { ease: 'inOut', swaps: { ...GRIN, ...BATON }, z: {} }),
      key(38, mix(BATON_READY, { body: { sx: -0.2 } }), { ease: 'out' }),
      key(43, READY, { swaps: SIDE }),
    ],
  },
  uthrow: {
    length: 37,
    active: [[16, 16]],
    swaps: { ...ANGRY, handF: 'fist', handB: 'fist' },
    keys: [
      key(0, HOLD, { ease: 'out' }),
      key(8, hands(mix(CROUCH, { body: { rot: 4 } }), [2.6, -4.4], [3.6, -4.6], -1), { ease: 'in' }),
      strikeKey(
        16,
        reachBoth(mix(STANCE, { body: { rot: -6, sy: 1.04 } }), [1.8, -12.0], [0.6, -11.8]),
        { ...SHOUT, handF: 'handOpen', handB: 'handOpen' },
        { z: ARMS_OVER_HEAD },
      ),
      key(20, reachBoth(mix(STANCE, { body: { rot: -6, sy: 1.04 } }), [1.8, -12.2], [0.6, -12.0]), {
        ease: 'inOut',
      }),
      key(28, hands(STANCE, [-0.4, -9.0], [2.0, -9.6]), { ease: 'inOut', swaps: GRIN, z: {} }),
      key(37, READY, { swaps: SIDE }),
    ],
  },
  dthrow: {
    length: 37,
    active: [[18, 18]],
    swaps: { ...ANGRY, handF: 'fist', handB: 'fist' },
    keys: [
      key(0, HOLD, { ease: 'out' }),
      key(10, hands(mix(STANCE, { body: { rot: -4 } }), [1.6, -9.6], [2.8, -9.8]), {
        ease: 'in',
        z: ARMS_OVER_HEAD,
      }),
      strikeKey(18, hands(mix(LOW, { body: { rot: 30 } }), [4.2, -1.8], [5.0, -1.6], -1), SHOUT, { z: {} }),
      key(22, hands(mix(LOW, { body: { rot: 28 } }), [4.2, -1.6], [5.0, -1.4], -1), {
        ease: 'inOut',
        swaps: GRIN,
      }),
      key(37, READY, { swaps: SIDE }),
    ],
  },
  sideB: {
    length: 49,
    active: [
      [8, 9],
      [11, 12],
      [14, 15],
      [17, 18],
      [20, 21],
      [25, 27],
    ],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, BATON_READY, { ease: 'out' }),
      key(5, TWIRL_POSE(-90), { ease: 'linear', swaps: { ...SHOUT, ...BATON, fxBack: 'twirl' } }),
      ...[8, 11, 14, 17, 20].map((f, i) =>
        key(f, mix(TWIRL_POSE(-90 + 240 * (i + 1)), { fx4: fx(5.4, -7.8, 0, 4.6) }), { ease: 'linear' }),
      ),
      key(22, mix(TWIRL_POSE(1350), { fx4: fx(5.4, -7.8, 0, 4.6) }), {
        ease: 'out',
        swaps: { ...SHOUT, ...BATON },
      }),
      key(24, JAB3_UP, { ease: 'in', z: FRONT_ARM_OVER_HEAD }),
      strikeKey(25, trail(JAB3_BONK), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(27, trail(JAB3_BONK), { ease: 'out' }),
      key(34, swing(mix(LUNGE, { body: { rot: 20, x: 0.9 } }), [3.6, -7.0], 45), {
        ease: 'inOut',
        swaps: { ...GRIN, ...BATON },
        z: {},
      }),
      key(49, BATON_READY),
    ],
  },
  upB: {
    length: 45,
    active: [
      [10, 11],
      [12, 13],
    ],
    swaps: { ...ANGRY, handF: 'fist', fx1: 'hook' },
    keys: [
      key(
        0,
        mix(hands(mix(AIR, { body: { rot: 6 } }), [-1.0, -6.0], [-0.6, -4.6], -1), {
          fx1: fx(-0.4, -3.6, 120),
        }),
        { ease: 'in' },
      ),
      key(
        6,
        mix(hands(mix(AIR, { body: { rot: 8 } }), [-1.0, -6.0], [-1.6, -5.0], -1), {
          fx1: fx(-1.8, -4.0, 150),
        }),
        { ease: 'in' },
      ),
      key(9, hookAt(HOOK_THROW, 1.2), {
        ease: 'linear',
        swaps: { ...SHOUT, handF: 'handOpen', fx1: 'hook', fx2: 'rope' },
        z: FRONT_ARM_OVER_HEAD,
      }),
      key(12, hookAt(HOOK_THROW, 14), { ease: 'linear' }),
      key(14, hookAt(HOOK_THROW, 20), { ease: 'out' }),
      key(16, hookAt(ZIP, 20), { ease: 'in', swaps: { ...GRIN, handF: 'fist', fx1: 'hook', fx2: 'rope' } }),
      key(30, hookAt(ZIP, 2.5), { ease: 'out' }),
      key(32, undefined, { swaps: { ...SIDE, fx1: null, fx2: null }, z: {} }),
      key(45, mix(AIR, { body: { rot: 0 } })),
    ],
  },
};
