import type { Pose } from '../../../render/rig/author';
import type { AnimClip } from '../../../render/rig/types';
import {
  ANGRY,
  BLINK,
  CROUCH,
  DIZZY,
  LOOK_UP,
  PECK,
  SHOUT,
  STAND,
  WEB,
  WEB_F,
  WINGS,
  WING_F,
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
  type Pt,
} from './poses';

/**
 * The Duck's attacks. He has no hands, so the head is the weapon (pecks, headbutts, the Hurdle Run ram), the
 * wings flap and sweep, and the webbed feet kick and stomp. Clips follow `moves.ts`: frame 1 is the move's first
 * frame, `length` = FAF - 1, and each strike is keyed so the beak, head, wing or foot covers every hitbox centre
 * through the hit's active frames (index.test.ts checks it).
 */

interface Strike {
  /** Belly lean (deg, + forwards), shift forwards and drop, in rig units. */
  lean?: number;
  shift?: number;
  drop?: number;
  /** Squash of the belly: sx, sy. */
  squash?: [number, number];
  /** Head centre (rig point) and the beak's world angle (0 = forwards, 90 = down). */
  head?: Pt;
  aim?: number;
  /** Planted feet, back and front ankle x relative to the belly's shift; null leaves the legs hanging (aerials). */
  feet?: [number, number] | null;
  extra?: Pose;
}

/**
 * Farthest the head's centre may get from the belly's: Duck Life draws him as two overlapping circles, so a
 * lunge carries the belly along behind the head instead of opening a neck between them.
 */
const NECK = 4.1;

/** A pose for a strike: body lean and lunge, feet planted, head placed with the beak aimed. */
function strike(s: Strike): Pose {
  const [sx, sy] = s.squash ?? [1, 1];
  const body = { rot: s.lean ?? 0, x: s.shift ?? 0, y: s.drop ?? 0, sx, sy };
  if (s.head) {
    const [bx, by] = at({ body }, 'body');
    const dx = s.head[0] - bx;
    const dy = s.head[1] - by;
    const d = Math.hypot(dx, dy);
    if (d > NECK) {
      body.x += dx * (1 - NECK / d);
      body.y += dy * (1 - NECK / d);
    }
  }
  let pose = mix({ body }, s.extra ?? {});
  if (s.feet === null) pose = air(pose);
  else {
    const [b, f] = s.feet ?? [-1.2, 0.3];
    pose = feet(pose, body.x + b - 0.55, body.x + f - 0.55);
  }
  return s.head ? headAt(pose, s.head, s.aim ?? 0) : pose;
}

/** Both wings at once: [angle, reach, thickness?] each, or null to leave one alone. */
type W = [number, number, number?];
const wings = (pose: Pose, f: W | null, b: W | null) => {
  let p = pose;
  if (f) p = wing(p, 'F', f[0], f[1], f[2]);
  if (b) p = wing(p, 'B', b[0], b[1], b[2]);
  return p;
};

/** Head pulled back for a peck or a headbutt. */
const COCK: Pose = strike({ lean: -10, shift: -0.3, head: [-0.6, -7.9], aim: -12 });

/** A swoosh along a swing (decoration behind the duck, on the fx3 slot). */
const swoosh = (x: number, y: number, s: number, rot: number, sy = s) => ({ fx3: fx(x, -y, s, rot, sy) });

const SMEAR = { fxBack: 'fxSwoosh' };

/** Jab 1: a quick forward peck. */
const PECK1 = strike({ lean: 14, shift: 0.6, head: [4.2, -6.3], aim: 4 });
/** Jab 2: a second, higher peck from the other side. */
const PECK2 = strike({ lean: 12, shift: 0.7, head: [4.5, -6.65], aim: -2 });

/** Jab 3: a lunge that slaps the front wing forwards. */
const SLAP = strike({ lean: 16, shift: 1.2, head: [3.0, -7.2], aim: 0 });

/** Utilt: head thrust up and forwards while both wings beat up over it, tips crossing at `x` offsets. */
const flapUp = (f: number, b: number) =>
  wingTo(
    wingTo(strike({ lean: -4, squash: [0.96, 1.06], head: [2.0, -8.7], aim: -45 }), 'F', [f, -12.2], 0.68, 1.3),
    'B',
    [b, -12.2],
    0.68,
    1.3,
  );

/** Dsmash: squatting low with both wings swept out flat along the floor, tips past `reach` on each side. */
const SWEEP = strike({ drop: 0.8, squash: [1.1, 0.86], feet: [-1.0, 1.4] });
const sweep = (reach: number, lift: number) =>
  wingTo(
    wingTo(strike({ drop: 1.4, squash: [1.16, 0.8], feet: [-1.2, 1.6] }), 'F', [reach, lift], 0.72, 1.35),
    'B',
    [-reach, lift],
    0.72,
    1.35,
  );

/** Ftilt: the battering-ram headbutt, a lunge with the whole body behind the head. */
const BUTT = strike({ lean: 18, shift: 1.6, head: [6.6, -6.6], aim: -2, feet: [-1.6, 1.0] });

/** Fsmash: the big headbutt, neck wound back, then the duck launches the head forwards. */
const WIND = strike({ lean: -18, shift: -0.9, head: [-1.6, -7.7], aim: -20, feet: [-1.0, 1.1] });
const SLAM = strike({ lean: 24, shift: 2.8, head: [8.1, -6.7], aim: -3, feet: [-2.0, 1.2], squash: [1.06, 0.96] });

/** Dtilt: a low peck at the opponent's feet. */
const LOW = strike({ lean: 40, shift: 0.8, drop: 1.0, head: [5.0, -2.9], aim: 25, feet: [-2.0, 0.6] });

/** Dash attack: the Hurdle Run, body flat out and head first. */
const RAM = strike({ lean: 70, shift: 1.4, drop: 0.4, head: [5.6, -5.6], aim: 0, feet: null });

/** Low peck from the floor for the getup attack: crouched, head stabbing along the ground. */

/** Bair: body tipped forwards so both webbed feet kick out behind at (bx, by) and (fx, fy). */
function kick(lean: number, bx: number, by: number, fx: number, fy: number): Pose {
  const pose: Pose = { body: { rot: lean, x: 0.6 }, head: { rot: -lean + 6 } };
  return leg(leg(pose, 'B', [bx, by], 180), 'F', [fx, fy], 172);
}

/** Dair: the front webbed foot stamped down to ankle height `ankleY` (rig y) with its toes at world angle `toe`. */
function stomp(ankleY: number, toe: number): Pose {
  const pose: Pose = { body: { rot: -8, sy: 1.04 }, head: { rot: 6 } };
  const [hx] = at(pose, 'legF');
  const [bx, by] = at(pose, 'legB');
  return leg(leg(pose, 'B', [bx - 0.9, by + 0.5], 170), 'F', [hx + 0.6, ankleY], toe);
}

/** A beak grab: lunge on frames from-to with the head on `head`, then hold the bite and recover. */
function grabClip(length: number, from: number, to: number, head: Pt): AnimClip {
  const bite = strike({ lean: 16, shift: 0.9, head, aim: 6, feet: [-1.6, 0.7] });
  return {
    length,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(from - 3, COCK, { ease: 'in' }),
      key(from, bite, { ease: 'linear', swaps: PECK }),
      key(to, bite, { ease: 'out', swaps: ANGRY }),
      key(to + 4, undefined, { swaps: BLINK }),
      key(to + 8, strike({ lean: 8, shift: 0.4, head: [2.2, -7.4], aim: 6 }), { swaps: ANGRY }),
      key(length, STAND),
    ],
  };
}

const GROUND_PECK: Pose = strike({ lean: 30, shift: 0.5, drop: 1.2, head: [5.1, -3.3], aim: 6, feet: [-1.8, 0.5] });

/**
 * Flight Training (upB): the flying mini-game's flap as a recovery. Duck Life's line wing runs through its drawings
 * one a frame, a beat every six frames (twice the falling flap's speed), with a snappy downstroke; the belly
 * stretches on each downstroke and speed lines trail below him.
 */
const FLIGHT_WING = ['wingA', 'wingFlat', 'wingV', 'wingVs', 'wingFlat', 'wingAs'];
const climb = (down: boolean, lines: number, feathers?: [number, number, number]): Pose =>
  mix(
    air(
      down
        ? { body: { rot: -6, sx: 0.95, sy: 1.08, y: -0.25 }, head: { rot: -8, y: -0.1 }, wingF: { sx: 1.45, sy: 1.3 }, wingB: { sx: 1.45, sy: 1.3 } }
        : { body: { rot: -6, sx: 1.04, sy: 0.95 }, head: { rot: -12 }, wingF: { sx: 1.45, sy: 1.3 }, wingB: { sx: 1.45, sy: 1.3 } },
      80,
      68,
    ),
    { fx3: fx(-0.5, -0.6, lines, -90, 1.1) },
    feathers ? { fx1: fx(...feathers) } : {},
  );

/** The first pose of the helpless clip, so the climb hands over to it without a jump. */
const SPENT = wing(
  wing(mix(air({ body: { sx: 0.97, sy: 1.04 }, head: { rot: 4, y: 0.1 } }, 70, 60), { body: { rot: -8 } }), 'F', -120, 0.9),
  'B',
  -70,
  0.9,
);

/** Both legs swung from the hips by (dx, dy), feet at world angle `toe`: trailing behind a dive or a slide. */
function trail(pose: Pose, dx: number, dy: number, toe: number): Pose {
  const [bx, by] = at(pose, 'legB');
  const [hx, hy] = at(pose, 'legF');
  return leg(leg(pose, 'B', [bx + dx - 0.3, by + dy], toe), 'F', [hx + dx, hy + dy + 0.2], toe);
}

/**
 * Dive Ram (downB): neck pulled back and wings raised for the stall, then beak first, steeply down and forwards
 * with the wings swept back and the feet trailing. Landing turns it into a belly-flop slide along the floor.
 */
const DIVE_WIND = wings(strike({ lean: -22, shift: -0.5, drop: -0.4, head: [-1.6, -8.0], aim: -35, feet: null }), [-140, 1.1], [-112, 1.05]);
const DIVE_COIL = wings(strike({ lean: -27, shift: -0.6, drop: -0.5, head: [-1.9, -8.1], aim: -42, feet: null }), [-134, 1.15], [-106, 1.1]);
const dive = (flutter: number, lines: number): Pose =>
  mix(
    wings(trail(strike({ lean: 62, shift: 1.0, head: [4.7, -3.3], aim: 52, feet: null }), -0.6, -1.5, 235), [-160 + flutter, 1.15], [-148 - flutter, 1.1]),
    { fx3: fx(-1.5, -6.8, lines, 60) },
  );
const slide = (lines: number, puff: number): Pose =>
  mix(
    wings(
      trail(strike({ lean: 12, shift: 1.0, drop: 2.3, squash: [1.24, 0.72], head: [4.9, -2.8], aim: 6, feet: null }), -1.4, -0.6, 190),
      [-172, 1.1],
      [-158, 1.05],
    ),
    { fx3: fx(-3.6, -2.4, lines, 0), fx1: fx(7.2, -0.5, puff), fx2: fx(-3.8, -0.4, puff * 0.8) },
  );

export const attacks: Record<string, AnimClip> = {
  jab: {
    length: 17,
    swaps: ANGRY,
    keys: [
      key(0, COCK, { ease: 'out' }),
      key(2, PECK1, { ease: 'linear', swaps: { ...PECK } }),
      key(4, PECK1, { ease: 'out' }),
      key(6, undefined, { swaps: ANGRY }),
      key(10, strike({ lean: 6, shift: 0.3, head: [2.0, -7.4], aim: 0 })),
      key(17, STAND),
    ],
  },
  jab2: {
    length: 19,
    swaps: ANGRY,
    keys: [
      key(0, strike({ lean: -6, shift: 0.1, head: [0.0, -8.4], aim: -16 }), { ease: 'out' }),
      key(2, PECK2, { ease: 'linear', swaps: { ...PECK } }),
      key(4, PECK2, { ease: 'out' }),
      key(6, undefined, { swaps: ANGRY }),
      key(11, strike({ lean: 6, shift: 0.3, head: [2.0, -7.4], aim: 0 })),
      key(19, STAND),
    ],
  },
  jab3: {
    length: 30,
    swaps: { ...ANGRY, ...WING_F },
    keys: [
      key(0, wings(strike({ lean: -10, head: [-0.2, -8.0], aim: -10 }), [-150, 1.0], null), { ease: 'in' }),
      key(3, mix(wingTo(SLAP, 'F', [6.4, -6.0], 0.62, 1.25), swoosh(4.5, 7, 2.6, 0, 2.2)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WING_F, ...SMEAR },
      }),
      key(5, mix(wingTo(SLAP, 'F', [6.6, -5.1], 0.62, 1.25), swoosh(5.0, 6, 2.6, 30, 2.2)), {
        ease: 'out',
      }),
      key(8, undefined, { swaps: { ...ANGRY, ...WING_F } }),
      key(16, wings(strike({ lean: 6, shift: 0.5, head: [1.2, -7.6], aim: 0 }), [60, 1.0], null)),
      key(22, undefined, { swaps: ANGRY }),
      key(30, STAND),
    ],
  },
  ftilt: {
    length: 29,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(4, COCK, { ease: 'in' }),
      key(6, BUTT, { ease: 'linear', swaps: { ...SHOUT, ...SMEAR } }),
      key(7, mix(BUTT, swoosh(5.5, 6.6, 3.0, 0, 1.6)), { swaps: { ...SHOUT, ...SMEAR } }),
      key(9, mix(BUTT), { ease: 'out' }),
      key(11, undefined, { swaps: ANGRY }),
      key(18, strike({ lean: 8, shift: 0.6, head: [2.4, -7.4], aim: 0 })),
      key(29, STAND),
    ],
  },
  utilt: {
    length: 25,
    swaps: { ...LOOK_UP, ...WINGS },
    keys: [
      key(0, wings(strike({ lean: 4, drop: 0.4, squash: [1.08, 0.9] }), [100, 1.0], [80, 1.0]), { ease: 'in' }),
      key(4, mix(flapUp(-0.5, 0.5), swoosh(0, 11, 3.2, -90, 2.4)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WINGS, ...SMEAR },
      }),
      key(7, mix(flapUp(0.4, -0.4), swoosh(0, 11, 3.2, -90, 2.4))),
      key(10, flapUp(-0.2, 0.2), { ease: 'out' }),
      key(12, undefined, { swaps: { ...LOOK_UP, ...WINGS } }),
      key(18, wings(STAND, [150, 1.0], [130, 1.0])),
      key(21, undefined, { swaps: {} }),
      key(25, STAND),
    ],
  },
  dtilt: {
    length: 21,
    swaps: ANGRY,
    keys: [
      key(0, strike({ lean: 14, drop: 0.6, head: [1.6, -6.6], aim: 10, feet: [-1.4, 0.6] }), { ease: 'in' }),
      key(3, LOW, { ease: 'linear', swaps: { ...PECK } }),
      key(6, LOW, { ease: 'out' }),
      key(8, undefined, { swaps: ANGRY }),
      key(14, strike({ lean: 20, drop: 0.6, head: [3.0, -5.2], aim: 10, feet: [-1.4, 0.8] })),
      key(21, STAND),
    ],
  },
  dashAttack: {
    length: 39,
    swaps: { ...ANGRY, fxBack: 'fxSpeed' },
    keys: [
      key(0, mix(strike({ lean: 30, shift: 0.6, drop: 0.5, head: [3.0, -6.0], aim: 0, feet: [-2.4, 0.4] }), { fx3: fx(-3, -5, 0.5) }), {
        ease: 'in',
      }),
      key(6, mix(RAM, { fx3: fx(-1.8, -5.2, 1.0) }), { ease: 'linear', swaps: { ...SHOUT, fxBack: 'fxSpeed' } }),
      key(10, mix(RAM, { fx3: fx(-2.4, -5.2, 1.1) }), { ease: 'linear' }),
      key(11, undefined, { swaps: { ...ANGRY, fxBack: 'fxSpeed' } }),
      key(20, mix(RAM, { body: { rot: 66 }, fx3: fx(-3.0, -5.2, 0.6) }), { ease: 'inOut' }),
      key(21, undefined, { swaps: ANGRY }),
      key(28, mix(CROUCH, { body: { rot: 10 } })),
      key(39, STAND),
    ],
  },
  fsmash: {
    length: 47,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(8, WIND, { ease: 'inOut', swaps: { face: 'faceAngry' } }),
      key(10, mix(WIND, { body: { rot: -20, sy: 0.96 } }), { ease: 'in' }),
      key(13, SLAM, { ease: 'linear', swaps: { ...SHOUT, ...SMEAR } }),
      key(14, mix(SLAM, swoosh(6.0, 6.8, 4.0, 0, 2.0)), { ease: 'linear' }),
      key(16, mix(SLAM, swoosh(6.5, 6.8, 4.0, 0, 2.0)), { ease: 'out' }),
      key(18, undefined, { swaps: ANGRY }),
      key(30, strike({ lean: 14, shift: 1.6, head: [5.2, -6.8], aim: 4, feet: [-1.4, 1.0] }), { ease: 'inOut' }),
      key(47, STAND),
    ],
  },
  usmash: {
    length: 43,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, wings(STAND, [150, 1.0], [130, 1.0]), { ease: 'out' }),
      key(6, wings(strike({ drop: 1.2, squash: [1.16, 0.76], head: [0.6, -6.6], aim: 10, feet: [-1.3, 0.2] }), [120, 1.1], [60, 1.1]), {
        ease: 'in',
      }),
      key(9, mix(wings(strike({ shift: 0.2, drop: -1.4, squash: [0.92, 1.12], head: [0.4, -10.6], aim: -80, feet: [-0.6, -0.2] }), [-150, 1.6, 1.2], [-65, 1.75, 1.2]), swoosh(0, 12.5, 3.4, -90, 2.8)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WINGS, ...SMEAR },
      }),
      key(13, mix(wings(strike({ shift: 0.2, drop: -1.6, squash: [0.92, 1.12], head: [0.4, -10.7], aim: -84, feet: [-0.6, -0.2] }), [-160, 1.6, 1.2], [-55, 1.75, 1.2]), swoosh(0, 13, 3.4, -90, 2.8)), {
        ease: 'out',
      }),
      key(16, undefined, { swaps: { ...ANGRY, ...WINGS } }),
      key(28, wings(strike({ drop: 0.4, squash: [1.05, 0.94] }), [140, 1.0], [120, 1.0])),
      key(36, undefined, { swaps: {} }),
      key(43, STAND),
    ],
  },
  dsmash: {
    length: 41,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, wings(STAND, [-60, 1.0], [-120, 1.0]), { ease: 'out' }),
      key(3, wings(SWEEP, [-80, 1.2], [-100, 1.2]), { ease: 'in' }),
      key(6, mix(sweep(8.3, -2.2), swoosh(5.5, 1.5, 3.4, 90, 1.6)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WINGS, ...SMEAR },
      }),
      key(8, mix(sweep(8.7, -1.5), swoosh(6, 1.5, 3.4, 90, 1.6)), { ease: 'out' }),
      key(10, undefined, { swaps: { ...ANGRY, ...WINGS } }),
      key(24, wings(SWEEP, [60, 1.1], [120, 1.1])),
      key(34, undefined, { swaps: {} }),
      key(41, STAND),
    ],
  },
  nair: {
    length: 39,
    swaps: { ...ANGRY, ...WINGS, fx1: 'fxFeathers' },
    keys: [
      key(0, wings(air({ body: { rot: 0 } }), [-120, 1.0], [-60, 1.0]), { ease: 'in', swaps: { ...ANGRY, ...WINGS } }),
      key(3, mix(wings(tucked({ body: { rot: 60 } }), [100, 1.25], [-80, 1.25]), { fx1: fx(-0.3, -4.7, 5.2, 0) }), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WINGS, fx1: 'fxFeathers' },
      }),
      key(9, mix(wings(tucked({ body: { rot: 240 } }), [280, 1.25], [100, 1.25]), { fx1: fx(-0.3, -4.7, 5.6, 120) }), { ease: 'linear' }),
      key(15, mix(wings(tucked({ body: { rot: 420 } }), [460, 1.2], [280, 1.2]), { fx1: fx(-0.3, -4.7, 5.6, 240) }), { ease: 'linear' }),
      key(22, mix(wings(tucked({ body: { rot: 620 } }), [660, 1.15], [480, 1.15]), { fx1: fx(-0.3, -4.7, 4.6, 360) }), { ease: 'out' }),
      key(24, undefined, { swaps: { ...ANGRY, ...WINGS } }),
      key(30, wings(air({ body: { rot: 720 } }), [-120 + 720, 1.0], [-60 + 720, 1.0])),
      key(32, undefined, { swaps: ANGRY }),
      key(39, air({ body: { rot: 720 } })),
    ],
  },
  fair: {
    length: 37,
    swaps: ANGRY,
    keys: [
      key(0, air({ body: { rot: -14 }, head: { rot: -10 } }), { ease: 'out' }),
      key(5, strike({ lean: -24, feet: null, head: [-1.2, -7.8], aim: -28 }), { ease: 'in' }),
      key(8, mix(strike({ lean: 52, shift: 0.8, feet: null, head: [6.0, -5.0], aim: 10 }), swoosh(4.5, 5.2, 3.0, 20, 1.6)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...SMEAR },
      }),
      key(12, mix(strike({ lean: 56, shift: 0.9, feet: null, head: [6.1, -4.8], aim: 12 })), { ease: 'out' }),
      key(14, undefined, { swaps: ANGRY }),
      key(24, strike({ lean: 20, feet: null, head: [2.2, -7.4], aim: 0 })),
      key(37, air()),
    ],
  },
  bair: {
    length: 35,
    swaps: ANGRY,
    keys: [
      key(0, air({ body: { rot: 10 } }), { ease: 'out' }),
      key(5, tucked({ body: { rot: 50 } }), { ease: 'in', swaps: { ...ANGRY, ...WEB } }),
      key(7, mix(kick(75, -7.3, -4.0, -7.4, -3.2), swoosh(-6.5, 4, 2.6, 180, 1.6)), { ease: 'linear', swaps: { ...SHOUT, ...WEB, ...SMEAR } }),
      key(10, mix(kick(78, -7.4, -4.0, -7.6, -3.3)), { ease: 'linear' }),
      key(15, kick(70, -6.4, -4.0, -6.6, -3.4), { ease: 'out', swaps: { ...ANGRY, ...WEB } }),
      key(18, undefined, { swaps: ANGRY }),
      key(26, air({ body: { rot: 16 } })),
      key(35, air()),
    ],
  },
  uair: {
    length: 31,
    swaps: { ...LOOK_UP, ...WINGS },
    keys: [
      key(0, wings(air({ body: { sy: 0.94, sx: 1.05 }, head: { y: 0.4, rot: -10 } }), [140, 1.0], [110, 1.0]), { ease: 'in' }),
      key(4, mix(wings(strike({ lean: -10, squash: [0.92, 1.12], feet: null, head: [0.6, -9.7], aim: -80 }), [150, 1.0], [120, 1.0]), swoosh(1, 12.5, 2.4, -90, 1.6)), {
        ease: 'linear',
        swaps: { ...PECK, ...WINGS, ...SMEAR },
      }),
      key(8, mix(wings(strike({ lean: -10, squash: [0.92, 1.12], feet: null, head: [0.7, -9.7], aim: -78 }), [150, 1.0], [120, 1.0])), {
        ease: 'out',
      }),
      key(9, undefined, { swaps: { face: 'faceAngry', ...WINGS } }),
      key(18, wings(air({ head: { rot: -14 } }), [150, 1.0], [130, 1.0])),
      key(22, undefined, { swaps: {} }),
      key(31, air()),
    ],
  },
  dair: {
    length: 45,
    swaps: ANGRY,
    keys: [
      key(0, air(), { ease: 'out' }),
      key(8, wings(stomp(-1.6, -90), [-110, 1.0], [-70, 1.0]), { ease: 'in', swaps: { ...ANGRY, ...WEB_F, ...WINGS } }),
      key(11, mix(wings(stomp(0.25, 62), [-140, 1.05], [-40, 1.0]), swoosh(0.6, 0, 2.2, 0, 1.4)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WEB_F, ...WINGS, ...SMEAR },
      }),
      key(14, mix(wings(stomp(0.25, 62), [-140, 1.05], [-40, 1.0])), { ease: 'linear' }),
      key(15, undefined, { swaps: { ...ANGRY, ...WEB_F, ...WINGS } }),
      key(20, wings(stomp(0.15, 66), [-130, 1.0], [-50, 1.0]), { ease: 'out' }),
      key(26, undefined, { swaps: ANGRY }),
      key(34, air({ body: { rot: -6 } })),
      key(45, air()),
    ],
  },
  grab: grabClip(33, 6, 8, [4.5, -5.95]),
  dashGrab: grabClip(41, 9, 11, [5.2, -5.9]),
  pivotGrab: grabClip(36, 10, 12, [5.7, -5.9]),
  pummel: {
    length: 6,
    swaps: PECK,
    keys: [
      key(0, strike({ lean: 14, shift: 0.5, head: [3.6, -6.4], aim: 14 }), { ease: 'out', swaps: { ...PECK } }),
      key(2, mix(strike({ lean: 10, shift: 0.4, head: [3.2, -6.6], aim: 10 })), { ease: 'inOut', swaps: ANGRY }),
      key(6, strike({ lean: 10, shift: 0.3, head: [3.2, -6.4], aim: 14 })),
    ],
  },
  fthrow: {
    length: 29,
    swaps: ANGRY,
    keys: [
      key(0, strike({ lean: 10, shift: 0.4, head: [3.2, -6.4], aim: 14 }), { ease: 'inOut' }),
      key(8, strike({ lean: -16, shift: -0.4, head: [-0.4, -8.3], aim: -24 }), { ease: 'in' }),
      key(12, mix(strike({ lean: 22, shift: 1.2, head: [5.4, -6.9], aim: -6 })), {
        ease: 'out',
        swaps: { ...SHOUT },
      }),
      key(16, undefined, { swaps: ANGRY }),
      key(29, STAND),
    ],
  },
  bthrow: {
    length: 41,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, wings(strike({ lean: 10, shift: 0.4, head: [3.2, -6.4], aim: 14 }), [200, 0.9], [-150, 0.9]), { ease: 'inOut' }),
      key(10, mix(wings(STAND, [120, 1.1], [60, 1.0]), { base: { sx: 0.2 } }), { ease: 'linear', swaps: { face: 'faceBlink', ...WINGS } }),
      key(16, mix(wings(STAND, [10, 1.4], [-20, 1.0]), { base: { sx: -1 } }), { ease: 'in', swaps: { ...SHOUT, ...WINGS } }),
      key(22, mix(wings(strike({ lean: 12, shift: 0.6 }), [-10, 1.7], [-40, 1.1]), { base: { sx: -1 } }, swoosh(-6, 7, 3.0, 180, 1.8)), {
        ease: 'out',
        swaps: { ...SHOUT, ...WINGS, ...SMEAR },
      }),
      key(26, undefined, { swaps: { ...ANGRY, ...WINGS } }),
      key(32, mix(wings(STAND, [140, 1.0], [120, 1.0]), { base: { sx: -1 } })),
      key(33, undefined, { swaps: ANGRY }),
      key(41, mix(STAND, { base: { sx: -1 } })),
    ],
  },
  uthrow: {
    length: 45,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, wings(strike({ lean: 10, shift: 0.4, head: [3.2, -6.4], aim: 14 }), [200, 0.9], [-150, 0.9]), { ease: 'inOut' }),
      key(6, wings(strike({ drop: 0.9, squash: [1.12, 0.84], head: [2.6, -5.6], aim: -40 }), [120, 1.05], [60, 1.0]), { ease: 'in' }),
      key(12, mix(wings(air({ head: { rot: -50 } }), [-80, 1.4], [-110, 1.3]), { base: { y: -3.0 } }), { ease: 'inOut', swaps: { ...SHOUT, ...WINGS } }),
      key(18, mix(wings(air({ head: { rot: -50 } }), [90, 1.3], [60, 1.2]), { base: { y: -4.5 } }), { ease: 'inOut' }),
      key(24, mix(wings(air({ head: { rot: -70 } }), [-90, 1.4], [-120, 1.3]), { base: { y: -5.2 } }), {
        ease: 'out',
        swaps: { ...SHOUT, ...WINGS },
      }),
      key(28, undefined, { swaps: { ...LOOK_UP, ...WINGS } }),
      key(36, mix(wings(air(), [100, 1.1], [70, 1.0]), { base: { y: -1.6 } }), { ease: 'in' }),
      key(40, mix(CROUCH, { body: { sy: 0.74, y: 1.2 } }), { ease: 'out', swaps: {} }),
      key(45, STAND),
    ],
  },
  dthrow: {
    length: 37,
    swaps: { ...ANGRY, ...WEB_F },
    keys: [
      key(0, strike({ lean: 10, shift: 0.4, head: [3.2, -6.4], aim: 14 }), { ease: 'inOut' }),
      key(6, mix(stomp(-1.4, -60), { base: { x: 1.2, y: -1.2 } }), { ease: 'in' }),
      key(9, mix(stomp(2.2, 70), { base: { x: 1.2 } }), { ease: 'out', swaps: { ...SHOUT, ...WEB_F } }),
      key(10, undefined, { swaps: { ...ANGRY, ...WEB_F } }),
      key(15, mix(stomp(-1.4, -60), { base: { x: 1.4, y: -1.6 } }), { ease: 'in' }),
      key(20, mix(stomp(2.4, 70), { base: { x: 1.4 } }), { ease: 'out', swaps: { ...SHOUT, ...WEB_F } }),
      key(23, undefined, { swaps: { ...ANGRY, ...WEB_F } }),
      key(28, mix(STAND, { base: { x: 0.6 } }), { swaps: ANGRY }),
      key(37, STAND),
    ],
  },
  getupAttack: {
    length: 45,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, wings(mix(CROUCH, { base: { rot: -40, x: 1.6, y: -0.2 } }), [150, 1.0], [210, 1.0]), { ease: 'inOut' }),
      key(10, wings(strike({ lean: -10, drop: 1.0, head: [-0.6, -6.6], aim: -10, feet: [-1.2, 0.4] }), [150, 1.0], [200, 1.0]), { ease: 'in' }),
      key(16, mix(wings(GROUND_PECK, [170, 1.1], [190, 1.1])), { ease: 'linear', swaps: { ...PECK, ...WINGS } }),
      key(18, wings(GROUND_PECK, [170, 1.1], [190, 1.1]), { ease: 'inOut', swaps: { ...ANGRY, ...WINGS } }),
      key(21, mix(wings(strike({ drop: 1.0, head: [0.2, -6.8], aim: 0, feet: [-1.0, 0.4] }), [140, 1.0], [210, 1.0]), { base: { sx: 0.1 } }), { ease: 'linear' }),
      key(24, mix(wings(GROUND_PECK, [170, 1.1], [190, 1.1]), { base: { sx: -1 } }), { ease: 'linear', swaps: { ...PECK, ...WINGS } }),
      key(26, mix(wings(GROUND_PECK, [170, 1.1], [190, 1.1]), { base: { sx: -1 } }), { ease: 'inOut', swaps: { ...ANGRY, ...WINGS } }),
      key(34, mix(CROUCH, { base: { sx: -0.4 } }), { swaps: ANGRY }),
      key(45, STAND),
    ],
  },
  ledgeAttack: {
    length: 55,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, wings(mix(CROUCH, { base: { y: 6, x: -2 } }), [-30, 1.0], [-60, 1.0]), { ease: 'out' }),
      key(10, wings(mix(CROUCH, { body: { rot: 8 } }), [150, 1.0], [200, 1.0]), { ease: 'out' }),
      key(16, wings(strike({ lean: -14, head: [-0.6, -7.8], aim: -14 }), [200, 1.0], [-150, 1.0]), { ease: 'in' }),
      key(19, mix(wings(strike({ lean: 20, shift: 1.6, head: [6.4, -6.0], aim: 4, feet: [-1.6, 1.0] }), [10, 1.5], [-20, 1.0]), swoosh(5, 6, 3, 0, 2)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WINGS, ...SMEAR },
      }),
      key(24, wings(strike({ lean: 16, shift: 1.4, head: [6.0, -6.2], aim: 6, feet: [-1.6, 1.0] }), [20, 1.3], [-10, 1.0]), {
        ease: 'inOut',
        swaps: { ...ANGRY, ...WINGS },
      }),
      key(30, undefined, { swaps: ANGRY }),
      key(55, STAND),
    ],
  },
  upB: {
    length: 51,
    swaps: LOOK_UP,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(3, wings(mix(CROUCH, { head: { rot: -10 } }), [-115, 1.1], [-70, 1.05]), { ease: 'in', swaps: { ...LOOK_UP, ...WINGS } }),
      key(5, mix(wings(air({ body: { sx: 0.9, sy: 1.14, y: -0.3 }, head: { rot: -12, y: -0.2 } }, 80, 70), [105, 1.15], [75, 1.1]), { fx1: fx(-0.4, -1.0, 0.5) }), {
        ease: 'out',
        swaps: { ...SHOUT, ...WINGS, fx1: 'fxFeathers' },
      }),
      ...Array.from({ length: 38 }, (_, i) => {
        const f = 6 + i;
        const feathers: [number, number, number] | undefined = f < 15 ? [-0.5 - i * 0.05, 0.2 + i * 0.95, 0.6 + i * 0.03] : undefined;
        const pose = i % 6 === 0 ? climb(false, i % 12 ? 1.25 : 1.0, feathers) : i % 6 === 2 ? climb(true, i % 12 === 2 ? 1.15 : 1.35, feathers) : undefined;
        const drawing = FLIGHT_WING[i % 6]!;
        return key(f, pose, { ease: i % 6 === 0 ? 'in' : 'inOut', swaps: { ...LOOK_UP, wingF: drawing, wingB: drawing, fx1: f < 15 ? 'fxFeathers' : null, fxBack: 'fxSpeed' } });
      }),
      key(44, climb(false, 0.7), { ease: 'out', swaps: { ...LOOK_UP, wingF: 'wingA', wingB: 'wingA' } }),
      key(47, wing(wing(air({ body: { rot: -4 }, head: { rot: -6 } }, 70, 60), 'F', -110, 0.95), 'B', -65, 0.95), { swaps: { ...LOOK_UP, ...WINGS } }),
      key(49, undefined, { swaps: { ...DIZZY, ...WINGS } }),
      key(51, SPENT),
    ],
  },
  downB: {
    length: 71,
    swaps: ANGRY,
    keys: [
      key(0, air(), { ease: 'out', swaps: { ...ANGRY, ...WINGS } }),
      key(5, DIVE_WIND, { ease: 'out' }),
      key(8, DIVE_COIL, { ease: 'linear' }),
      key(9, dive(0, 1.0), { ease: 'linear', swaps: { ...ANGRY, ...WINGS, ...WEB, fxBack: 'fxSpeed' } }),
      key(17, dive(6, 1.25), { ease: 'inOut' }),
      key(25, dive(-4, 1.05), { ease: 'inOut' }),
      key(33, dive(6, 1.3), { ease: 'inOut' }),
      key(41, dive(-4, 1.1), { ease: 'inOut' }),
      key(44, dive(0, 1.2), { ease: 'linear' }),
      key(45, slide(1.3, 0.55), { ease: 'out', swaps: { ...SHOUT, ...WINGS, ...WEB, fxBack: 'fxSpeed', fx1: 'fxPuff', fx2: 'fxPuff' } }),
      key(52, slide(1.0, 0.9), { ease: 'inOut' }),
      key(58, slide(0.6, 1.1), { ease: 'out' }),
      key(59, undefined, { swaps: { ...ANGRY, ...WINGS } }),
      key(64, wings(mix(CROUCH, { body: { rot: 6 } }), [95, 1.0], [80, 1.0]), { ease: 'inOut' }),
      key(66, undefined, { swaps: BLINK }),
      key(69, undefined, { swaps: {} }),
      key(71, STAND),
    ],
  },
};
