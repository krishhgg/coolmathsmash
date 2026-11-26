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
  /** How far the head may reach from the belly before it drags the belly along (default NECK). */
  neck?: number;
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
    const neck = s.neck ?? NECK;
    if (d > neck) {
      body.x += dx * (1 - neck / d);
      body.y += dy * (1 - neck / d);
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

/** An impact star on a strike's first active frames, centred on (x, y) with y up, like the hitboxes. */
const star = (x: number, y: number, s: number) => ({ fx2: fx(x, -y, s, 0) });
const STAR = { fx2: 'fxStar' };

/** Lifts one foot off the floor to (dx, dy) from its hip, toes at world angle `toe`. */
function lift(pose: Pose, side: 'B' | 'F', dx: number, dy: number, toe: number): Pose {
  const [hx, hy] = at(pose, `leg${side}`);
  return leg(pose, side, [hx + dx, hy + dy], toe);
}

/** Jab 1: a short, high neck snap; the belly stays upright over feet kept close together. */
const PECK1 = strike({ lean: 2, shift: 0.1, head: [4.1, -7.7], aim: 26, feet: [-0.9, 0.1], neck: 5.2 });
/** Jab 2: the recoil loads a longer peck, the belly lunging after the head over a wide stance. */
const PECK2 = wings(
  lift(strike({ lean: 20, shift: 1.1, head: [4.8, -6.6], aim: -8, feet: [-2.2, 0.6] }), 'B', -1.5, 0.7, 165),
  [-165, 0.95],
  null,
);

/** Jab 3: a lunge that slaps the front wing forwards. */
const SLAP = strike({ lean: 16, shift: 1.2, head: [3.0, -7.2], aim: 0 });

/** Utilt: head thrust up and forwards while both wings beat up over it, tips crossing at `x` offsets. */
const flapUp = (f: number, b: number) =>
  wingTo(
    wingTo(
      strike({ lean: -4, squash: [0.96, 1.06], head: [2.0, -8.7], aim: -45 }),
      'F',
      [f, -12.2],
      0.68,
      1.3,
    ),
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

/** Ftilt: the battering-ram headbutt, forehead first, feet planted wide and both wings swept back. */
const BUTT = strike({ lean: 34, shift: 2.0, head: [6.7, -6.5], aim: -14, feet: [-2.6, 1.3] });

/**
 * Fsmash: the big headbutt. The duck rears back over his back foot with the front foot raised and the wings up,
 * stretches through a smear frame, then slams the head out past his front foot with the back leg flung out.
 */
const WIND = wings(
  lift(
    strike({
      lean: -24,
      shift: -1.0,
      drop: 0.3,
      squash: [1.04, 0.92],
      head: [-2.0, -7.8],
      aim: -32,
      feet: [-1.0, 1.1],
    }),
    'F',
    0.9,
    1.0,
    10,
  ),
  [-150, 1.0],
  [-128, 1.0],
);
const COIL = wings(
  lift(
    strike({
      lean: -28,
      shift: -1.2,
      drop: 0.35,
      squash: [1.05, 0.9],
      head: [-2.4, -7.85],
      aim: -38,
      feet: [-1.0, 1.1],
    }),
    'F',
    1.0,
    0.9,
    10,
  ),
  [-155, 1.0],
  [-132, 1.0],
);
const LUNGE = strike({
  lean: 20,
  shift: 1.8,
  head: [5.6, -6.9],
  aim: -6,
  squash: [1.16, 0.9],
  feet: [-2.2, 1.2],
});
const SLAM = wings(
  strike({ lean: 36, shift: 3.4, head: [9.0, -6.4], aim: -4, feet: [-4.2, 1.5], squash: [1.18, 0.88] }),
  [-176, 1.15],
  [-166, 1.1],
);

/** Dtilt: a low peck at the opponent's feet. */
const LOW = strike({ lean: 40, shift: 0.8, drop: 1.0, head: [5.0, -2.9], aim: 25, feet: [-2.0, 0.6] });

/** Dash attack: the Hurdle Run, body flat out and head first. */
const RAM = trail(
  strike({ lean: 70, shift: 1.4, drop: 0.4, squash: [1.15, 0.9], head: [5.6, -5.6], aim: 0, feet: null }),
  -1.4,
  -0.5,
  195,
);

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
  const bite = strike({ lean: 6, shift: 0.3, head, aim: 6, feet: [-1.3, 0.6], neck: 5.2 });
  return {
    length,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(from - 3, COCK, { ease: 'in' }),
      key(from - 1, undefined, { swaps: PECK }),
      key(from, bite, { ease: 'linear', swaps: ANGRY }),
      key(to, bite, { ease: 'out' }),
      key(to + 4, undefined, { swaps: BLINK }),
      key(to + 8, strike({ lean: 8, shift: 0.4, head: [2.2, -7.4], aim: 6 }), { swaps: ANGRY }),
      key(length, STAND),
    ],
  };
}

const GROUND_PECK: Pose = strike({
  lean: 30,
  shift: 0.5,
  drop: 1.2,
  head: [5.1, -3.3],
  aim: 6,
  feet: [-1.8, 0.5],
});

/**
 * Flight Training (upB): the flying mini-game's flap as a recovery. Duck Life's line wing runs through its drawings
 * one a frame, a beat every six frames (twice the falling flap's speed), with a snappy downstroke; the belly
 * stretches on each downstroke and speed lines trail below him.
 */
const FLIGHT_WING = ['wingA', 'wingFlat', 'wingV', 'wingVs', 'wingFlat', 'wingAs'];
const LINE_WINGS = { wingF: { sx: 1.45, sy: 1.3 }, wingB: { sx: 1.45, sy: 1.3 } };
const climb = (phase: 'top' | 'power' | 'lift', lines: number, feathers?: [number, number, number]): Pose =>
  mix(
    phase === 'power'
      ? tucked({ body: { rot: -6, sx: 1.1, sy: 0.88, y: 0.15 }, head: { rot: -12, y: 0.25 }, ...LINE_WINGS })
      : phase === 'lift'
        ? air(
            { body: { rot: -6, sx: 0.9, sy: 1.14, y: -0.45 }, head: { rot: -6, y: -0.15 }, ...LINE_WINGS },
            95,
            85,
          )
        : air({ body: { rot: -6 }, head: { rot: -10 }, ...LINE_WINGS }, 80, 68),
    { fx3: fx(-0.5, -0.6, lines, -90, 1.1) },
    feathers ? { fx1: fx(...feathers) } : {},
  );

/** The first pose of the helpless clip, so the climb hands over to it without a jump. */
const SPENT = wing(
  wing(
    mix(air({ body: { sx: 0.97, sy: 1.04 }, head: { rot: 4, y: 0.1 } }, 70, 60), { body: { rot: -8 } }),
    'F',
    -120,
    0.9,
  ),
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
const DIVE_WIND = wings(
  strike({ lean: -22, shift: -0.5, drop: -0.4, head: [-1.6, -8.0], aim: -35, feet: null }),
  [-140, 1.1],
  [-112, 1.05],
);
const DIVE_COIL = wings(
  strike({ lean: -27, shift: -0.6, drop: -0.5, head: [-1.9, -8.1], aim: -42, feet: null }),
  [-134, 1.15],
  [-106, 1.1],
);
const dive = (flutter: number, lines: number): Pose =>
  mix(
    wings(
      trail(
        strike({
          lean: 70 + flutter * 0.25,
          shift: 1.9,
          drop: -1.5,
          squash: [1.12, 0.92],
          head: [3.95, -2.85],
          aim: 62,
          feet: null,
        }),
        -0.5 + flutter * 0.03,
        -1.6 - flutter * 0.04,
        240 + flutter,
      ),
      [-135 + flutter, 1.1],
      [-122 - flutter, 1.05],
    ),
    { fx3: fx(0.2 - flutter * 0.04, -8.4, lines, 58) },
  );
const slide = (lines: number, puff: number): Pose =>
  mix(
    wings(
      trail(
        strike({
          lean: 12,
          shift: 1.0,
          drop: 2.3,
          squash: [1.24, 0.72],
          head: [4.9, -2.8],
          aim: 6,
          feet: null,
        }),
        -1.4,
        -0.6,
        190,
      ),
      [-172, 1.1],
      [-158, 1.05],
    ),
    { fx3: fx(-3.6, -2.4, lines, 0), fx1: fx(7.2, -0.5, puff), fx2: fx(-3.8, -0.4, puff * 0.8) },
  );

/** Nair: balled up with the head pulled into the belly and the legs folded, turned `rot` about the belly. */
const ball = (rot: number): Pose =>
  tucked({ body: { rot, sx: 1.05, sy: 1.05 }, head: { y: 2.1, x: -0.9, rot: 0 } });
/** The spin's smear ring round the ball and the feathers it throws off, turned with it and grown by `s`. */
const ring = (rot: number, s: number): Pose => ({
  fx3: fx(-0.3, -4.7, 4.6 * s, rot),
  fx1: fx(-0.3, -4.7, s, rot + 40),
});

/** Usmash: stretched up off the floor, beak to the sky, both wings beaten up into a V with tips at (f) and (b). */
const takeoff = (f: number, b: number): Pose =>
  wingTo(
    wingTo(
      strike({ shift: 0.2, drop: -1.6, squash: [0.88, 1.18], head: [0.4, -10.8], aim: -84, feet: null }),
      'F',
      [f, -13.4],
      0.7,
      1.15,
    ),
    'B',
    [b, -13.2],
    0.7,
    1.15,
  );

/**
 * Running Ram (sideB), Skull Bash's crouch and launch: squatting low with the head down and forwards to ram, wings
 * raised and back, feet dug in (BRACE). The charge itself plays `sideBCharge`, with the feathers fluffed up behind
 * him and a glow that grows with the charge. On release he springs off both feet and flies flat out headfirst with
 * the wings swept back, belly-flops into a slide as the ram dies, then rocks back up onto his feet. A hit or a
 * shield bounces him straight to frame 75, the rock back up.
 */
const brace = (quiver = 0): Pose =>
  wings(
    strike({
      lean: 26 + quiver * 0.3,
      shift: -0.7,
      drop: 1.4,
      squash: [1.16, 0.82],
      head: [2.9, -4.0 - quiver * 0.03],
      aim: 18,
      feet: [-1.8, 1.2],
    }),
    [-146 + quiver, 1.0],
    [-122 - quiver, 1.0],
  );
const BRACE = brace();
/** The ruffled feathers on the fx1 bone, centred on and squashed with the belly in `pose`, grown by `s`. */
const fluff = (pose: Pose, s: number): Pose => {
  const [x, y] = at(pose, 'body');
  const b = pose.body ?? {};
  return { fx1: fx(x, y, (b.sx ?? 1) * s, b.rot ?? 0, (b.sy ?? 1) * s) };
};
/** The ruffle draws behind the belly's outline, so only the tufts' tips show round his back. */
const FLUFF_BEHIND = { fx1: 5.5 };
/** The charge glow on the fxBack bone, centred between belly and head, radius `r`. */
const glowAt = (r: number): Pose => ({ fx3: fx(0.6, -4.6, r) });
const fly = (flutter: number, lines: number): Pose =>
  mix(
    wings(
      trail(
        strike({
          lean: 74,
          shift: 1.6,
          drop: 0.3,
          squash: [1.18, 0.88],
          head: [5.9, -5.2],
          aim: 10,
          feet: null,
        }),
        -1.6 + flutter * 0.02,
        -0.3 - flutter * 0.03,
        192 + flutter,
      ),
      [-176 + flutter, 1.12],
      [-168 - flutter, 1.06],
    ),
    { fx3: fx(-3.2, -4.8, lines) },
  );

export const attacks: Record<string, AnimClip> = {
  jab: {
    length: 17,
    swaps: ANGRY,
    keys: [
      key(0, COCK, { ease: 'out' }),
      key(2, mix(PECK1, star(7.6, 6.2, 0.7)), { ease: 'linear', swaps: { ...PECK, ...STAR } }),
      key(4, mix(PECK1, star(7.7, 6.2, 0.9)), { ease: 'out' }),
      key(5, undefined, { swaps: ANGRY }),
      key(10, strike({ lean: 6, shift: 0.3, head: [2.0, -7.4], aim: 0 })),
      key(17, STAND),
    ],
  },
  jab2: {
    length: 19,
    swaps: ANGRY,
    keys: [
      key(0, strike({ lean: 10, shift: 0.2, drop: 0.3, head: [1.2, -6.6], aim: 24, feet: [-1.4, 0.4] }), {
        ease: 'out',
      }),
      key(2, mix(PECK2, star(8.2, 6.7, 0.8)), { ease: 'linear', swaps: { ...PECK, ...WING_F, ...STAR } }),
      key(4, mix(PECK2, star(8.3, 6.7, 1.0)), { ease: 'out' }),
      key(5, undefined, { swaps: ANGRY }),
      key(11, strike({ lean: 6, shift: 0.3, head: [2.0, -7.4], aim: 0 })),
      key(19, STAND),
    ],
  },
  jab3: {
    length: 30,
    swaps: { ...ANGRY, ...WING_F },
    keys: [
      key(0, wings(strike({ lean: -10, head: [-0.2, -8.0], aim: -10 }), [-150, 1.0], null), { ease: 'in' }),
      key(
        3,
        mix(wingTo(SLAP, 'F', [6.4, -6.0], 0.62, 1.25), swoosh(4.5, 7, 2.6, 0, 2.2), star(8.6, 6.0, 0.8)),
        {
          ease: 'linear',
          swaps: { ...SHOUT, ...WING_F, ...SMEAR, ...STAR },
        },
      ),
      key(
        5,
        mix(wingTo(SLAP, 'F', [6.6, -5.1], 0.62, 1.25), swoosh(5.0, 6, 2.6, 30, 2.2), star(8.8, 5.6, 1.1)),
        {
          ease: 'out',
        },
      ),
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
      key(7, mix(BUTT, swoosh(5.5, 6.6, 3.0, 0, 1.6), star(10.0, 6.6, 0.9)), {
        swaps: { ...SHOUT, ...SMEAR, ...STAR },
      }),
      key(9, mix(BUTT, star(10.1, 6.6, 1.2)), { ease: 'out' }),
      key(10, undefined, { swaps: ANGRY }),
      key(18, strike({ lean: 8, shift: 0.6, head: [2.4, -7.4], aim: 0 })),
      key(29, STAND),
    ],
  },
  utilt: {
    length: 25,
    swaps: { ...LOOK_UP, ...WINGS },
    keys: [
      key(0, wings(strike({ lean: 4, drop: 0.4, squash: [1.08, 0.9] }), [100, 1.0], [80, 1.0]), {
        ease: 'in',
      }),
      key(4, mix(flapUp(0.3, -2.6), swoosh(0, 11, 3.2, -90, 2.4)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WINGS, ...SMEAR },
      }),
      key(7, mix(flapUp(0.6, -3.0), swoosh(0, 11, 3.2, -90, 2.4))),
      key(10, flapUp(0.2, -2.4), { ease: 'out' }),
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
      key(3, mix(LOW, star(8.6, 1.5, 0.7)), { ease: 'linear', swaps: { ...PECK, ...STAR } }),
      key(6, mix(LOW, star(8.7, 1.5, 0.9)), { ease: 'out' }),
      key(8, undefined, { swaps: ANGRY }),
      key(14, strike({ lean: 20, drop: 0.6, head: [3.0, -5.2], aim: 10, feet: [-1.4, 0.8] })),
      key(21, STAND),
    ],
  },
  dashAttack: {
    length: 39,
    swaps: { ...ANGRY, fxBack: 'fxSpeed' },
    keys: [
      key(
        0,
        mix(strike({ lean: 30, shift: 0.6, drop: 0.5, head: [3.0, -6.0], aim: 0, feet: [-2.4, 0.4] }), {
          fx3: fx(-3, -5, 0.5),
        }),
        {
          ease: 'in',
        },
      ),
      key(
        4,
        mix(
          strike({
            lean: 42,
            shift: 0.3,
            drop: 1.0,
            squash: [1.12, 0.86],
            head: [3.4, -4.6],
            aim: 6,
            feet: [-2.6, 0.5],
          }),
          {
            fx3: fx(-3.2, -4.4, 0.7),
          },
        ),
        { ease: 'out' },
      ),
      key(6, mix(RAM, { fx3: fx(-1.8, -5.2, 1.0) }, star(8.8, 5.6, 0.9)), {
        ease: 'linear',
        swaps: { ...SHOUT, fxBack: 'fxSpeed', ...STAR },
      }),
      key(10, mix(RAM, { fx3: fx(-2.4, -5.2, 1.1) }, star(8.9, 5.6, 1.1)), { ease: 'linear' }),
      key(11, undefined, { swaps: { ...ANGRY, fxBack: 'fxSpeed' } }),
      key(20, mix(RAM, { body: { rot: 64 }, fx3: fx(-3.0, -5.2, 0.6) }), { ease: 'inOut' }),
      key(21, undefined, { swaps: { ...ANGRY, fx1: 'fxPuff' } }),
      key(
        26,
        mix(strike({ lean: -12, shift: -0.2, head: [0.8, -7.9], aim: -10, feet: [-0.6, 1.7] }), {
          fx1: fx(2.2, -0.5, 0.6),
        }),
        {
          ease: 'out',
        },
      ),
      key(31, undefined, { swaps: ANGRY }),
      key(39, STAND),
    ],
  },
  fsmash: {
    length: 47,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(4, strike({ lean: -10, shift: -0.4, drop: 0.15, head: [-0.8, -7.9], aim: -14 }), { ease: 'inOut' }),
      key(9, WIND, { ease: 'inOut', swaps: { ...ANGRY, ...WINGS } }),
      key(11, COIL, { ease: 'in' }),
      key(12, mix(LUNGE, swoosh(4.0, 7.0, 4.2, 0, 2.4)), { ease: 'linear', swaps: { ...SHOUT, ...SMEAR } }),
      key(13, mix(SLAM, swoosh(6.0, 6.8, 4.0, 0, 2.0), star(12.0, 6.6, 1.0)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WINGS, ...SMEAR, ...STAR },
      }),
      key(15, mix(SLAM, swoosh(6.5, 6.8, 4.0, 0, 2.0), star(12.1, 6.6, 1.5)), { ease: 'linear' }),
      key(16, mix(SLAM, star(12.1, 6.6, 1.2)), { ease: 'out' }),
      key(17, undefined, { swaps: { ...ANGRY, ...WINGS } }),
      key(
        19,
        wings(
          strike({ lean: 22, shift: 2.4, head: [6.6, -7.0], aim: 0, feet: [-3.0, 1.2] }),
          [-160, 1.0],
          [-150, 1.0],
        ),
        {
          ease: 'inOut',
        },
      ),
      key(24, undefined, { swaps: ANGRY }),
      key(29, strike({ lean: 10, shift: 1.0, head: [3.0, -7.6], aim: 4, feet: [-1.6, 0.8] }), {
        ease: 'inOut',
      }),
      key(38, strike({ lean: -5, shift: -0.2, head: [-0.2, -8.1], aim: -6 }), { ease: 'inOut' }),
      key(47, STAND),
    ],
  },
  usmash: {
    length: 43,
    swaps: { ...ANGRY, ...WINGS },
    keys: [
      key(0, wings(STAND, [150, 1.0], [130, 1.0]), { ease: 'out' }),
      key(
        6,
        wings(
          strike({ drop: 1.3, squash: [1.18, 0.74], head: [0.6, -6.4], aim: 14, feet: [-1.3, 0.2] }),
          [125, 1.0],
          [55, 1.0],
        ),
        {
          ease: 'in',
        },
      ),
      key(
        8,
        mix(
          wings(
            strike({ drop: -0.6, squash: [0.94, 1.1], head: [0.5, -9.4], aim: -60, feet: null }),
            [100, 1.1],
            [80, 1.1],
          ),
          swoosh(0, 9, 3.0, -90, 2.4),
        ),
        {
          ease: 'linear',
          swaps: { ...SHOUT, ...WINGS, ...SMEAR },
        },
      ),
      key(9, mix(takeoff(2.6, -2.4), swoosh(0, 12.5, 3.6, -90, 3.0)), { ease: 'linear' }),
      key(13, mix(takeoff(2.9, -2.7), swoosh(0, 13, 3.6, -90, 3.0)), { ease: 'out' }),
      key(16, undefined, { swaps: { ...ANGRY, ...WINGS } }),
      key(
        24,
        wings(
          strike({ drop: -0.3, squash: [0.98, 1.04], head: [0.5, -8.4], aim: -20, feet: null }),
          [-130, 1.0],
          [-60, 1.0],
        ),
      ),
      key(30, wings(strike({ drop: 0.6, squash: [1.1, 0.88], feet: [-1.0, 0.6] }), [140, 1.0], [120, 1.0]), {
        ease: 'out',
      }),
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
    swaps: ANGRY,
    keys: [
      key(0, air({ body: { sy: 0.94, sx: 1.04 } }), { ease: 'in' }),
      key(2, mix(ball(40), ring(40, 0.5)), {
        ease: 'linear',
        swaps: { ...BLINK, fxBack: 'fxSwoosh', fx1: 'fxFeathers' },
      }),
      key(4, mix(ball(130), ring(130, 0.9)), { ease: 'linear' }),
      key(9, mix(ball(310), ring(310, 1.0)), { ease: 'linear' }),
      key(15, mix(ball(490), ring(490, 1.05)), { ease: 'linear' }),
      key(22, mix(ball(670), ring(670, 1.2)), { ease: 'out' }),
      key(24, undefined, { swaps: { ...ANGRY, fx1: 'fxFeathers' } }),
      key(
        28,
        mix(air({ body: { rot: 720, sy: 1.1, sx: 0.93 }, head: { rot: -6 } }), {
          fx1: fx(-0.3, -3.5, 1.5, 760),
        }),
      ),
      key(30, undefined, { swaps: ANGRY }),
      key(39, air({ body: { rot: 720 } })),
    ],
  },
  fair: {
    length: 37,
    swaps: ANGRY,
    keys: [
      key(0, air({ body: { rot: -14 }, head: { rot: -10 } }), { ease: 'out' }),
      key(5, strike({ lean: -24, feet: null, head: [-1.2, -7.8], aim: -28 }), { ease: 'in' }),
      key(
        8,
        mix(
          wings(
            tucked(strike({ lean: 74, shift: 0.8, feet: null, head: [6.0, -4.0], aim: 38 })),
            [-120, 1.0],
            [-100, 1.0],
          ),
          swoosh(4.5, 5.2, 3.0, 30, 1.6),
          star(8.6, 4.2, 0.9),
        ),
        { ease: 'linear', swaps: { ...SHOUT, ...SMEAR, ...WINGS, ...STAR } },
      ),
      key(10, undefined, { swaps: { ...SHOUT, ...SMEAR, ...WINGS } }),
      key(
        12,
        wings(
          tucked(strike({ lean: 76, shift: 0.9, feet: null, head: [6.1, -3.9], aim: 40 })),
          [-125, 1.0],
          [-105, 1.0],
        ),
        {
          ease: 'out',
        },
      ),
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
      key(5, tucked({ body: { rot: 50 }, head: { y: 1.4, x: -0.5 } }), {
        ease: 'in',
        swaps: { ...ANGRY, ...WEB },
      }),
      key(7, mix(kick(75, -7.3, -4.2, -7.0, -2.9), swoosh(-6.5, 4, 2.6, 180, 1.6)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WEB, ...SMEAR },
      }),
      key(10, mix(kick(78, -7.4, -4.2, -7.1, -3.0)), { ease: 'linear' }),
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
      key(
        0,
        wings(air({ body: { sy: 0.94, sx: 1.05 }, head: { y: 0.4, rot: -10 } }), [140, 1.0], [110, 1.0]),
        { ease: 'in' },
      ),
      key(
        4,
        mix(
          wings(
            strike({ lean: -10, squash: [0.92, 1.12], feet: null, head: [0.6, -9.7], aim: -80 }),
            [150, 1.0],
            [120, 1.0],
          ),
          swoosh(1, 12.5, 2.4, -90, 1.6),
        ),
        {
          ease: 'linear',
          swaps: { ...PECK, ...WINGS, ...SMEAR },
        },
      ),
      key(
        8,
        mix(
          wings(
            strike({ lean: -10, squash: [0.92, 1.12], feet: null, head: [0.7, -9.7], aim: -78 }),
            [150, 1.0],
            [120, 1.0],
          ),
        ),
        {
          ease: 'out',
        },
      ),
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
      key(8, wings(stomp(-1.6, -90), [-110, 1.0], [-70, 1.0]), {
        ease: 'in',
        swaps: { ...ANGRY, ...WEB_F, ...WINGS },
      }),
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
      key(0, strike({ lean: 14, shift: 0.5, head: [3.6, -6.4], aim: 14 }), {
        ease: 'out',
        swaps: { ...PECK },
      }),
      key(2, mix(strike({ lean: 10, shift: 0.4, head: [3.2, -6.6], aim: 10 })), {
        ease: 'inOut',
        swaps: ANGRY,
      }),
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
      key(0, wings(strike({ lean: 10, shift: 0.4, head: [3.2, -6.4], aim: 14 }), [200, 0.9], [-150, 0.9]), {
        ease: 'inOut',
      }),
      key(10, mix(wings(STAND, [120, 1.1], [60, 1.0]), { base: { sx: 0.2 } }), {
        ease: 'linear',
        swaps: { face: 'faceBlink', ...WINGS },
      }),
      key(16, mix(wings(STAND, [10, 1.4], [-20, 1.0]), { base: { sx: -1 } }), {
        ease: 'in',
        swaps: { ...SHOUT, ...WINGS },
      }),
      key(
        22,
        mix(
          wings(strike({ lean: 12, shift: 0.6 }), [-10, 1.7], [-40, 1.1]),
          { base: { sx: -1 } },
          swoosh(-6, 7, 3.0, 180, 1.8),
        ),
        {
          ease: 'out',
          swaps: { ...SHOUT, ...WINGS, ...SMEAR },
        },
      ),
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
      key(0, wings(strike({ lean: 10, shift: 0.4, head: [3.2, -6.4], aim: 14 }), [200, 0.9], [-150, 0.9]), {
        ease: 'inOut',
      }),
      key(
        6,
        wings(
          strike({ drop: 0.9, squash: [1.12, 0.84], head: [2.6, -5.6], aim: -40 }),
          [120, 1.05],
          [60, 1.0],
        ),
        { ease: 'in' },
      ),
      key(12, mix(wings(air({ head: { rot: -50 } }), [-80, 1.4], [-110, 1.3]), { base: { y: -3.0 } }), {
        ease: 'inOut',
        swaps: { ...SHOUT, ...WINGS },
      }),
      key(18, mix(wings(air({ head: { rot: -50 } }), [90, 1.3], [60, 1.2]), { base: { y: -4.5 } }), {
        ease: 'inOut',
      }),
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
      key(0, wings(mix(CROUCH, { base: { rot: -40, x: 1.6, y: -0.2 } }), [150, 1.0], [210, 1.0]), {
        ease: 'inOut',
      }),
      key(
        10,
        wings(
          strike({ lean: -10, drop: 1.0, head: [-0.6, -6.6], aim: -10, feet: [-1.2, 0.4] }),
          [150, 1.0],
          [200, 1.0],
        ),
        { ease: 'in' },
      ),
      key(16, mix(wings(GROUND_PECK, [170, 1.1], [190, 1.1])), {
        ease: 'linear',
        swaps: { ...PECK, ...WINGS },
      }),
      key(18, wings(GROUND_PECK, [170, 1.1], [190, 1.1]), { ease: 'inOut', swaps: { ...ANGRY, ...WINGS } }),
      key(
        21,
        mix(
          wings(strike({ drop: 1.0, head: [0.2, -6.8], aim: 0, feet: [-1.0, 0.4] }), [140, 1.0], [210, 1.0]),
          { base: { sx: 0.1 } },
        ),
        { ease: 'linear' },
      ),
      key(24, mix(wings(GROUND_PECK, [170, 1.1], [190, 1.1]), { base: { sx: -1 } }), {
        ease: 'linear',
        swaps: { ...PECK, ...WINGS },
      }),
      key(26, mix(wings(GROUND_PECK, [170, 1.1], [190, 1.1]), { base: { sx: -1 } }), {
        ease: 'inOut',
        swaps: { ...ANGRY, ...WINGS },
      }),
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
      key(16, wings(strike({ lean: -14, head: [-0.6, -7.8], aim: -14 }), [200, 1.0], [-150, 1.0]), {
        ease: 'in',
      }),
      key(
        19,
        mix(
          wings(
            strike({ lean: 20, shift: 1.6, head: [6.4, -6.0], aim: 4, feet: [-1.6, 1.0] }),
            [10, 1.5],
            [-20, 1.0],
          ),
          swoosh(5, 6, 3, 0, 2),
        ),
        {
          ease: 'linear',
          swaps: { ...SHOUT, ...WINGS, ...SMEAR },
        },
      ),
      key(
        24,
        wings(
          strike({ lean: 16, shift: 1.4, head: [6.0, -6.2], aim: 6, feet: [-1.6, 1.0] }),
          [20, 1.3],
          [-10, 1.0],
        ),
        {
          ease: 'inOut',
          swaps: { ...ANGRY, ...WINGS },
        },
      ),
      key(30, undefined, { swaps: ANGRY }),
      key(55, STAND),
    ],
  },
  neutralB: {
    length: 32,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(7, COCK, { ease: 'in' }),
      ...[10, 15, 20].flatMap((frame) => [
        key(frame, strike({ lean: 16, head: [3.6, -6.6], squash: [1.08, 0.96] }), {
          ease: 'out',
          swaps: SHOUT,
        }),
        key(frame + 2, strike({ lean: -10, head: [1, -7.2], squash: [0.96, 1.04] }), {
          ease: 'in',
          swaps: ANGRY,
        }),
      ]),
      key(26, undefined, { swaps: {} }),
      key(32, STAND),
    ],
  },
  upB: {
    length: 51,
    swaps: LOOK_UP,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(3, wings(mix(CROUCH, { head: { rot: -10 } }), [-115, 1.1], [-70, 1.05]), {
        ease: 'in',
        swaps: { ...LOOK_UP, ...WINGS },
      }),
      key(
        5,
        mix(
          wings(
            air({ body: { sx: 0.9, sy: 1.14, y: -0.3 }, head: { rot: -12, y: -0.2 } }, 80, 70),
            [105, 1.15],
            [75, 1.1],
          ),
          { fx1: fx(-0.4, -1.0, 0.5) },
        ),
        {
          ease: 'out',
          swaps: { ...SHOUT, ...WINGS, fx1: 'fxFeathers' },
        },
      ),
      ...Array.from({ length: 38 }, (_, i) => {
        const f = 6 + i;
        const feathers: [number, number, number] | undefined =
          f < 15 ? [-0.5 - i * 0.05, 0.2 + i * 0.95, 0.6 + i * 0.03] : undefined;
        const pose =
          i % 6 === 0
            ? climb('top', i % 12 ? 1.25 : 1.0, feathers)
            : i % 6 === 2
              ? climb('power', 1.1, feathers)
              : i % 6 === 4
                ? climb('lift', i % 12 === 4 ? 1.2 : 1.4, feathers)
                : undefined;
        const drawing = FLIGHT_WING[i % 6]!;
        return key(f, pose, {
          ease: i % 6 === 0 ? 'in' : 'inOut',
          swaps: {
            ...LOOK_UP,
            wingF: drawing,
            wingB: drawing,
            fx1: f < 15 ? 'fxFeathers' : null,
            fxBack: 'fxSpeed',
          },
        });
      }),
      key(44, climb('top', 0.7), { ease: 'out', swaps: { ...LOOK_UP, wingF: 'wingA', wingB: 'wingA' } }),
      key(
        47,
        wing(
          wing(air({ body: { rot: 4, sy: 1.04 }, head: { rot: 20, y: 0.35 } }, 100, 90), 'F', 150, 0.9),
          'B',
          125,
          0.9,
        ),
        { swaps: { face: 'faceDown', ...WINGS } },
      ),
      key(51, undefined, { swaps: { ...DIZZY, ...WINGS } }),
      key(51, SPENT),
    ],
  },
  downB: {
    length: 71,
    swaps: ANGRY,
    keys: [
      key(0, air(), { ease: 'out', swaps: { ...ANGRY, ...WINGS } }),
      key(4, DIVE_WIND, { ease: 'out' }),
      key(7, DIVE_COIL, { ease: 'in' }),
      key(
        8,
        wings(
          strike({ lean: 30, shift: 0.8, drop: -0.8, head: [2.6, -6.0], aim: 20, feet: null }),
          [-130, 1.1],
          [-110, 1.05],
        ),
        {
          ease: 'linear',
        },
      ),
      key(9, dive(0, 1.0), { ease: 'linear', swaps: { ...ANGRY, ...WINGS, ...WEB, fxBack: 'fxSpeed' } }),
      ...[12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42].map((f, i) =>
        key(f, dive(i % 2 ? -14 : 14, i % 2 ? 1.05 : 1.35)),
      ),
      key(44, dive(0, 1.2), { ease: 'linear' }),
      key(
        45,
        mix(
          wings(
            strike({
              lean: 48,
              shift: 1.6,
              drop: 0.2,
              squash: [1.2, 0.84],
              head: [4.6, -2.9],
              aim: 30,
              feet: null,
            }),
            [-150, 1.1],
            [-135, 1.05],
          ),
          { fx3: fx(-1.0, -5.5, 1.2, 30), fx1: fx(6.6, -0.5, 0.5), fx2: fx(-2.0, -0.4, 0.4) },
        ),
        {
          ease: 'linear',
          swaps: { ...SHOUT, ...WINGS, ...WEB, fxBack: 'fxSpeed', fx1: 'fxPuff', fx2: 'fxPuff' },
        },
      ),
      key(47, mix(slide(1.3, 0.7), { body: { sy: 0.6, sx: 1.4, y: 2.9 } }), { ease: 'out' }),
      key(50, mix(slide(1.2, 0.85), { body: { sy: 0.82, sx: 1.16, y: 2.0 } }), { ease: 'inOut' }),
      key(54, slide(1.0, 1.0), { ease: 'inOut' }),
      key(58, slide(0.6, 1.15), { ease: 'out' }),
      key(59, undefined, { swaps: { ...ANGRY, ...WINGS } }),
      key(64, wings(mix(CROUCH, { body: { rot: 6 } }), [95, 1.0], [80, 1.0]), { ease: 'inOut' }),
      key(66, undefined, { swaps: BLINK }),
      key(69, undefined, { swaps: {} }),
      key(71, STAND),
    ],
  },
  sideB: {
    length: 96,
    active: [
      [18, 25],
      [26, 52],
    ],
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(4, mix(CROUCH, { head: { rot: 8 } }), { ease: 'inOut', swaps: { ...ANGRY, ...WINGS } }),
      key(9, mix(BRACE, fluff(BRACE, 0.85)), {
        ease: 'inOut',
        swaps: { ...ANGRY, ...WINGS, fx1: 'fxRuffle' },
        z: FLUFF_BEHIND,
      }),
      key(13, mix(BRACE, fluff(BRACE, 0.9)), { ease: 'in' }),
      key(
        15,
        mix(
          strike({
            lean: 34,
            shift: -0.9,
            drop: 1.9,
            squash: [1.24, 0.72],
            head: [2.6, -3.2],
            aim: 14,
            feet: [-2.0, 1.2],
          }),
          { fx2: fx(-2.6, -0.4, 0.6) },
        ),
        { ease: 'out', swaps: { ...ANGRY, ...WINGS, fx2: 'fxPuff' }, z: {} },
      ),
      key(
        16,
        mix(
          strike({
            lean: 52,
            shift: 0.6,
            drop: 0.4,
            squash: [0.92, 1.1],
            head: [4.6, -5.4],
            aim: 0,
            feet: [-3.0, 0.2],
          }),
          { fx2: fx(-3.2, -0.5, 0.9) },
        ),
        {
          ease: 'linear',
          swaps: { ...SHOUT, ...WINGS, fx2: 'fxPuff' },
        },
      ),
      key(17, fly(0, 0.9), {
        ease: 'linear',
        swaps: { ...SHOUT, ...WINGS, ...WEB, fxBack: 'fxSpeed' },
      }),
      ...[19, 22, 25, 28, 31, 34, 37, 40, 43, 46, 49].map((f, i) =>
        key(f, fly(i % 2 ? -8 : 8, i % 2 ? 1.1 : 1.35), {
          ...(i === 0 && { swaps: { ...SHOUT, ...WINGS, ...WEB, fxBack: 'fxSpeed' } }),
        }),
      ),
      key(52, fly(0, 1.2), { ease: 'linear' }),
      key(53, mix(slide(1.3, 0.6), { body: { sy: 0.66, sx: 1.34, y: 2.7 } }), {
        ease: 'out',
        swaps: { ...SHOUT, ...WINGS, ...WEB, fxBack: 'fxSpeed', fx1: 'fxPuff', fx2: 'fxPuff' },
      }),
      key(57, mix(slide(1.2, 0.85), { body: { sy: 0.8, sx: 1.18, y: 2.0 } }), { ease: 'inOut' }),
      key(64, slide(0.9, 1.0), { ease: 'inOut' }),
      key(70, slide(0.5, 1.1), {
        ease: 'inOut',
        swaps: { ...ANGRY, ...WINGS, ...WEB, fx1: 'fxPuff', fx2: 'fxPuff' },
      }),
      key(
        72,
        trail(
          strike({
            lean: 22,
            shift: 0.7,
            drop: 0.3,
            squash: [1.1, 0.9],
            head: [4.0, -5.0],
            aim: 4,
            feet: null,
          }),
          -1.3,
          -0.6,
          185,
        ),
        { ease: 'inOut', swaps: { ...ANGRY, ...WINGS } },
      ),
      key(75, tucked({ body: { rot: -28, sx: 1.06, sy: 0.96 } }), {
        ease: 'out',
        swaps: { ...BLINK, ...WINGS },
      }),
      key(78, undefined, { swaps: ANGRY }),
      key(84, mix(CROUCH, { body: { rot: -6 } }), { ease: 'inOut' }),
      key(90, strike({ lean: -4, shift: 0.1, head: [0.6, -8.0], aim: -4 }), { ease: 'inOut', swaps: ANGRY }),
      key(96, STAND),
    ],
  },
  /**
   * Running Ram's charge, one clip frame per charge frame (80 for a full charge): the renderer plays it while the move
   * waits on its charge frame. He quivers in the crouch, the feathers stay fluffed up and the glow behind him swells
   * and brightens, flashing a star at the beak once it is full.
   */
  sideBCharge: {
    length: 80,
    swaps: { ...ANGRY, ...WINGS, fx1: 'fxRuffle', fxBack: 'fxGlow1' },
    keys: [
      ...Array.from({ length: 20 }, (_, i) => {
        const f = i * 4;
        const level = f / 80;
        const pose = brace((i % 2 ? 1 : -1) * (2 + 5 * level));
        const glow = f >= 52 ? 'fxGlow3' : f >= 28 ? 'fxGlow2' : 'fxGlow1';
        return key(f, mix(pose, fluff(pose, 0.9 + 0.35 * level), glowAt(4 + 5.5 * level)), {
          ease: 'inOut',
          swaps: { ...ANGRY, ...WINGS, fx1: 'fxRuffle', fxBack: glow },
          ...(i === 0 && { z: FLUFF_BEHIND }),
        });
      }),
      key(80, mix(BRACE, fluff(BRACE, 1.25), glowAt(9.5), { fx2: fx(7.3, -4.3, 1.0) }), {
        swaps: { ...SHOUT, ...WINGS, fx1: 'fxRuffle', fxBack: 'fxGlow3', fx2: 'fxStar' },
      }),
    ],
  },
};
