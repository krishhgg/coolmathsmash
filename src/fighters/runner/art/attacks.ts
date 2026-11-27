import { pointOf, type Pose } from '../../../render/rig/author';
import { toLocal } from '../../../render/rig/sample';
import type { AnimClip, BonePose, Key } from '../../../render/rig/types';
import { LEDGE_ATTACK } from '../../../sim/constants';
import { RAPID_JAB } from '../timing';
import { AIR, BALL_Y, DOWN, HANG, READY, TUCK, ballAt, pull, runPose, spun } from './clips';
import {
  ANGRY,
  AWAY,
  CROUCH,
  FACE,
  FAR_ARM_IN_FRONT,
  HAPPY,
  HURT,
  P,
  SHOUT,
  STAND,
  ants,
  between,
  hands,
  key,
  mix,
  type Pt,
} from './poses';
import { FOOT, HAND, rig } from './rig';

/**
 * The Runner's moves, on her frame data: each clip is FAF - 1 frames long and its `active` windows are the move's
 * hit windows, so the renderer plays it frame for frame. Every strike shows a white speed streak from the limb
 * that throws it to the hitbox, so a still frame of the attack reads as a hit.
 */

type Limb = 'foreB' | 'foreF' | 'shinB' | 'shinF';

type Swaps = Record<string, string | null>;

/** A rig point in the space of the root bone, which the fx bones hang from (it is flipped in a handstand). */
function inRoot(pose: Pose, [x, y]: Pt): Pt {
  const [ox, oy] = pointOf(rig, pose, 'root');
  const [ax, ay] = pointOf(rig, pose, 'root', 1, 0);
  const [cx, cy] = pointOf(rig, pose, 'root', 0, 1);
  return toLocal({ a: ax - ox, b: ay - oy, c: cx - ox, d: cy - oy, tx: ox, ty: oy }, x, y);
}

/** A streak from the end of `limb` in `pose` to the hitbox at `to` (rig point), `r` wide at its head. */
function trail(pose: Pose, limb: Limb, to: Pt, r: number): BonePose {
  const [x, y] = inRoot(pose, pointOf(rig, pose, limb, 0, limb.startsWith('shin') ? FOOT : HAND));
  const [tx, ty] = inRoot(pose, to);
  const len = Math.max(1.5, Math.hypot(tx - x, ty - y) + r);
  const rot = (Math.atan2(ty - y, tx - x) * 180) / Math.PI;
  return { x: tx, y: ty, rot, sx: len, sy: r };
}

/** `pose` with streaks on fx1 (and fx2): each is [limb, hitbox (rig point), head radius]. */
function hitting(pose: Pose, ...streaks: [Limb, Pt, number][]): Pose {
  const fx = ['fx1', 'fx2'];
  return mix(pose, Object.fromEntries(streaks.map(([limb, to, r], i) => [fx[i]!, trail(pose, limb, to, r)])));
}

const STREAK1 = { fx1: 'streak' };
const STREAK2 = { fx1: 'streak', fx2: 'streak' };
const NO_FX = { fx1: null, fx2: null };

/** Holds `pose` through an active window with its streaks shown, then hides them. */
function strike(from: number, to: number, pose: Pose, swaps: Swaps, z?: Record<string, number>): Key[] {
  return [key(from, pose, { ease: 'linear', swaps, ...(z ? { z } : {}) }), key(to, pose, { ease: 'out' })];
}
const done = (frame: number, pose?: Pose, swaps: Swaps = {}) =>
  key(frame, pose, { swaps: { ...NO_FX, ...swaps }, z: {} });

/** A move clip: length FAF - 1, active windows matching the move's hit windows. */
function move(faf: number, active: [number, number][], keys: Key[], swaps: Swaps = ANGRY): AnimClip {
  return { length: faf - 1, active, swaps, keys };
}

/** Arm stretch for punches: her arms are stubs, so they reach like rubber hoses. */
const LONG_B: Pose = { armB: { sy: 1.6 }, foreB: { sy: 1.15 } };
const LONG_F: Pose = { armF: { sy: 1.6 }, foreF: { sy: 1.15 } };
const LONG_LEG_B: Pose = { thighB: { sy: 1.15 }, shinB: { sy: 1.15 } };
const LONG_LEG_F: Pose = { thighF: { sy: 1.15 }, shinF: { sy: 1.15 } };

/** Antennae swung out level to either side of her head (from their rest at -38 and 33 degrees). */
const ANTENNAE_FLAT: Pose = { antB: { rot: -52 }, antF: { rot: 57 } };

/** Vertical flip about her middle: upside down but still facing the same way (Gravity Switch, handstands). */
const FLIP: Pose = { root: { sy: -1, y: -13 } };

/** Jab 1: a straight punch with the far arm. */
const JAB1 = hitting(
  P({
    x: 0.8,
    y: 0.6,
    rot: 12,
    legs: [
      [2.5, 0],
      [-1.5, 0],
    ],
    arms: [
      [6.2, -6.9],
      [-4.6, -5.6],
    ],
    raw: LONG_B,
    ant: [16, 10],
  }),
  ['foreB', [6, -7], 1.4],
);
/** Jab 2: the near arm swings across her front. */
const JAB2 = hitting(
  P({
    x: 1.0,
    y: 0.6,
    rot: 16,
    legs: [
      [2.6, 0],
      [-1.4, 0],
    ],
    raw: { ...LONG_F, armF: { x: 4.4, y: 0.5, sy: 1.6 } },
    arms: [
      [4.6, -5.0],
      [6.6, -6.0],
    ],
    ant: [20, 14],
  }),
  ['foreF', [6.5, -7], 1.4],
);
/** The kick flurry: running in place, alternating feet thrust forward at hip height. */
const KICK_B = hitting(
  P({
    x: 1.8,
    y: 0.55,
    rot: -26,
    legs: [
      [8.1, -5.2],
      [-1.6, 0],
    ],
    raw: { thighB: { sy: 1.65 }, shinB: { sy: 1.48 } },
    arms: [
      [4.4, -7.4],
      [-5.2, -7.0],
    ],
    ant: [-6, 18],
  }),
  ['shinB', [8.45, -5.2], 1.15],
);
const KICK_F = hitting(
  P({
    x: 1.55,
    y: 0.95,
    rot: -15,
    legs: [
      [1.8, 0],
      [7.7, -3.65],
    ],
    raw: { thighF: { sy: 1.6 }, shinF: { sy: 1.42 } },
    arms: [
      [5.4, -7.0],
      [-4.4, -7.4],
    ],
    ant: [15, -8],
  }),
  ['shinF', [8.1, -3.75], 1.28],
);
const SHOVE = hitting(
  P({
    x: 1.3,
    y: 0.5,
    rot: 18,
    legs: [
      [2.8, 0],
      [-2.0, 0],
    ],
    raw: { ...LONG_B, ...LONG_F, armF: { x: 4.6, y: 0.5, sy: 1.6 } },
    arms: [
      [6.8, -6.8],
      [6.4, -5.3],
    ],
    ant: [24, 18],
  }),
  ['foreB', [7, -6.5], 1.8],
);

/** Strafe Kick: wound up facing away, then the far leg whips round at hip height. */
const FTILT = hitting(
  P({
    x: 1.4,
    y: 0.5,
    rot: -14,
    legs: [
      [8.2, -6.0],
      [-1.6, 0],
    ],
    raw: { thighB: { sy: 1.25 }, shinB: { sy: 1.2 } },
    arms: [
      [3.4, -9.0],
      [-5.6, -8.0],
    ],
    ant: [-14, -18],
  }),
  ['shinB', [9.5, -6], 2.2],
);

/** Wall Flip: a backflip whose feet sweep from in front of her to overhead and behind. */
const flip = (rot: number, lift: number): Pose =>
  P({
    y: -lift,
    rot,
    raw: {
      thighB: { rot: 6 },
      shinB: { rot: -4 },
      thighF: { rot: -6 },
      shinF: { rot: 4 },
      armB: { rot: 40 },
      armF: { rot: -40 },
    },
    ant: [0, 0],
  });
const UTILT1 = hitting(flip(-125, 1.6), ['shinB', [3.5, -10], 2.0]);
/** Crouched to spring into the Wall Flip. */
const UTILT_CROUCH = P({
  y: 1.3,
  sy: 0.9,
  legs: [
    [2.0, 0],
    [-1.8, 0],
  ],
  arms: [
    [4.0, -3.4],
    [-4.6, -3.4],
  ],
  ant: [-10, 10],
});
const UTILT2 = hitting(flip(-205, 2.2), ['shinB', [-2, -13.5], 2.0]);

/** Gap Trip: a low slide with the far foot along the floor. */
const DTILT = hitting(
  P({
    x: 0.6,
    y: 2.0,
    rot: -24,
    legs: [
      [7.8, -1.1],
      [-0.6, 0],
    ],
    raw: { thighB: { sy: 1.2 }, shinB: { sy: 1.2 } },
    // The near knee folds up behind her as she slides, instead of forward through the floor.
    knees: [1, -1],
    arms: [
      [3.6, -1.0],
      [-5.8, -2.2],
    ],
    ant: [-20, -14],
  }),
  ['shinB', [8.5, -1.5], 1.5],
);

/** Tile Tumble: a dive (body flat, arms first), then a roll out along the floor. */
const DIVE = hitting(
  P({
    x: 2.2,
    y: 1.2,
    rot: 62,
    raw: {
      ...LONG_B,
      ...LONG_F,
      armF: { x: 5.0, y: -1.0, sy: 1.5 },
      thighB: { rot: 30 },
      shinB: { rot: 20 },
      thighF: { rot: 40 },
      shinF: { rot: 30 },
    },
    arms: [
      [7.4, -4.2],
      [7.0, -3.4],
    ],
    ant: [50, 44],
  }),
  ['foreB', [6, -5], 2.0],
);

/** Running Dropkick: both feet forward, her body laid out behind them. */
const DROPKICK = hitting(
  P({
    x: 4.35,
    y: -0.6,
    rot: -78,
    raw: {
      thighB: { rot: -4, sy: 1.72 },
      shinB: { rot: 2, sy: 1.34 },
      thighF: { rot: 4, sy: 1.49 },
      shinF: { rot: 2, sy: 1.28 },
      armB: { rot: -55 },
      armF: { rot: -81 },
      fx3: { x: 15.25, y: -5.7, sx: 1.05, sy: 0.97 },
    },
    ant: [10, 10],
  }),
  ['shinB', [13.35, -6], 1.5],
  ['shinF', [12.4, -4.25], 1.25],
);
const DROPKICK_LATE = hitting(mix(DROPKICK, { body: { x: 2.1, rot: -70, y: 0 } }), ['shinB', [10, -5], 1.5]);
/** Down on the floor after the dropkick. */
const DROPKICK_DOWN = mix(DROPKICK_LATE, { body: { y: 1.6, rot: -60 } });
/** Back up in a squat. */
const DROPKICK_SQUAT = P({
  y: 1.9,
  rot: -10,
  sy: 0.88,
  sx: 1.1,
  legs: [
    [2.4, 0],
    [-2.2, 0],
  ],
  arms: [
    [3.2, -4.0],
    [-5.4, -4.2],
  ],
  ant: [-30, -24],
});
/** The tuck's legs, knees to her chest. */
const TUCKED_LEGS: Pose = {
  thighB: TUCK.thighB!,
  shinB: TUCK.shinB!,
  thighF: TUCK.thighF!,
  shinF: TUCK.shinF!,
  footB: {},
  footF: {},
};

/**
 * Handstand Flip: upside down on her hands, kicking both feet straight up. Her antennae splay out flat to either
 * side, since her head is nearly on the floor.
 */
const HANDSTAND = (spread: number): Pose =>
  mix(FLIP, ANTENNAE_FLAT, {
    root: { sy: -1, y: -13.3 },
    body: { y: -1.6 },
    thighB: { rot: -spread },
    shinB: { rot: 0 },
    thighF: { rot: spread },
    shinF: { rot: 0 },
    armB: { rot: 160, sy: 1.2 },
    foreB: { rot: 10 },
    armF: { rot: -160, sy: 1.2 },
    foreF: { rot: -10 },
  });
const USMASH1 = hitting(HANDSTAND(6), ['shinB', [0, -14], 2.8], ['foreB', [5, -6], 1.4]);
const USMASH2 = hitting(HANDSTAND(28), ['shinF', [0, -14], 2.6]);

/** Split Kick: drops into the splits, a foot shooting out along the floor to each side. */
const SPLITS = hitting(
  P({
    y: 3.0,
    sy: 0.92,
    sx: 1.06,
    raw: { thighB: { sy: 1.55 }, shinB: { sy: 1.25 }, thighF: { sy: 1.55 }, shinF: { sy: 1.25 } },
    legs: [
      [7.8, -1.6],
      [-7.8, -1.6],
    ],
    knees: [-1, 1],
    arms: [
      [4.6, -9.4],
      [-4.4, -9.6],
    ],
    ant: [-14, 14],
  }),
  ['shinB', [8.5, -2], 2.0],
  ['shinF', [-8.5, -2], 2.0],
);

/**
 * Getup attack: sitting back on the floor on one hand, spinning on her seat in the splits with the front foot kicked
 * high. `side` 1 has the far leg in front; -1 is half a turn later, the near leg in front and her back to the camera.
 */
function floorSpin(side: 1 | -1): Pose {
  return hitting(
    P({
      x: -0.3,
      y: 2.6,
      sy: 0.9,
      sx: 1.06,
      rot: -18,
      raw: { thighB: { sy: 1.85 }, shinB: { sy: 1.5 }, thighF: { sy: 1.85 }, shinF: { sy: 1.5 } },
      legs:
        side === 1
          ? [
              [7.6, -3.8],
              [-7.6, -1.4],
            ]
          : [
              [-7.6, -1.4],
              [7.6, -3.8],
            ],
      knees: side === 1 ? [-1, 1] : [1, -1],
      arms: [
        [3.6 * side, -10.2],
        [-6.4, -0.4],
      ],
      ant: [-22, 10],
    }),
    ['shinB', [8 * side, -3], 2.2],
    ['shinF', [-8 * side, -3], 2.2],
  );
}
/** Her near leg drawn over her body, as it swings round in front of her seat. */
const NEAR_LEG_IN_FRONT = {
  thighFLine: 23.1,
  shinFLine: 23.2,
  footFLine: 23.3,
  thighF: 23.4,
  shinF: 23.5,
  footF: 23.6,
};
const SPIN_FRONT = floorSpin(1);
const SPIN_BACK = floorSpin(-1);

/**
 * Getup attack wind-up and recovery: sitting back on the floor on her near hand, knees up and soles planted.
 * `knees` matches the spin pose it leads into or out of, so the legs never fold through the floor between them.
 */
function floorSit(knees: [1 | -1, 1 | -1], feet: [Pt, Pt], lean: number): Pose {
  return P({
    x: -0.3,
    y: 2.3,
    sy: 0.92,
    sx: 1.05,
    rot: lean,
    legs: feet,
    knees,
    arms: [
      [2.4, -9.4],
      [-6.0, -1.0],
    ],
    ant: [-14, 6],
  });
}
/** Flat on her back as she lies down (clips.ts DOWN), lifted so nothing dips through the floor. */
const LIE = mix(DOWN, { body: { y: 2.1 } });

/** Scissor Kick: the far leg scoops up, then the near leg cuts across. */
const SCISSOR1 = hitting(
  P({
    rot: -26,
    raw: { ...LONG_LEG_B, thighF: { rot: 25 }, shinF: { rot: 30 } },
    legs: [
      [6.2, -6.4],
      [-1.2, -0.6],
    ],
    arms: [
      [2.6, -10.2],
      [-5.6, -8.4],
    ],
    ant: [-10, -10],
  }),
  ['shinB', [7, -5], 2.0],
);
const SCISSOR2 = hitting(
  P({
    rot: -20,
    raw: { ...LONG_LEG_F, thighB: { rot: -100 }, shinB: { rot: 60 } },
    legs: [
      [3.6, -7.6],
      [7.0, -5.0],
    ],
    arms: [
      [3.2, -10.0],
      [-5.8, -7.8],
    ],
    ant: [-6, -14],
  }),
  ['shinF', [8, -5], 2.0],
);

/** Back Kick: leaning forward, the near leg drives straight out behind her. */
const BAIR = hitting(
  P({
    x: 0.6,
    rot: 28,
    raw: { ...LONG_LEG_F, thighB: { rot: -60 }, shinB: { rot: 70 } },
    legs: [
      [3.0, -3.0],
      [-7.2, -6.0],
    ],
    knees: [1, -1],
    arms: [
      [6.0, -6.6],
      [-1.6, -11.0],
    ],
    ant: [-20, -12],
  }),
  ['shinF', [-8, -6], 2.0],
);

/** Bicycle Kick: tipped onto her back in the air, pedalling overhead. */
const pedal = (a: number): Pose =>
  P({
    y: 0.5,
    rot: -160,
    raw: {
      thighB: { rot: -a },
      shinB: { rot: a * 1.4 },
      thighF: { rot: a },
      shinF: { rot: 10 },
      armB: { rot: -40 },
      armF: { rot: 40 },
    },
    ant: [0, 0],
  });
const UAIR1 = hitting(pedal(35), ['shinF', [1, -13], 2.4]);
const UAIR2 = hitting(pedal(-35), ['shinB', [1, -13], 2.4]);

/** Tile Stomp: drilling stomps straight down, alternating feet, then a two-footed stamp. */
const STOMP_B = hitting(
  P({
    y: -0.6,
    rot: 4,
    raw: LONG_LEG_B,
    legs: [
      [0.4, 0.9],
      [-1.4, -2.2],
    ],
    arms: [
      [5.4, -10.0],
      [-5.0, -10.2],
    ],
    ant: [-24, -24],
  }),
  ['shinB', [0, 0.5], 1.6],
);
const STOMP_F = hitting(
  P({
    y: -0.6,
    rot: -4,
    raw: LONG_LEG_F,
    legs: [
      [1.6, -2.2],
      [-0.2, 0.9],
    ],
    arms: [
      [5.0, -10.2],
      [-5.4, -10.0],
    ],
    ant: [-24, -24],
  }),
  ['shinF', [0, 0.5], 1.6],
);
const STAMP = hitting(
  P({
    y: -0.2,
    sy: 1.08,
    sx: 0.94,
    raw: { ...LONG_LEG_B, ...LONG_LEG_F },
    legs: [
      [1.0, 1.0],
      [-0.9, 1.0],
    ],
    arms: [
      [5.6, -11.0],
      [-5.4, -11.2],
    ],
    ant: [-30, -30],
  }),
  ['shinB', [0, 0], 2.2],
);

/** Tile Flip: the near hand slaps the floor and the tile in front flips up on its edge. */
const SLAP = P({
  x: 1.6,
  y: 2.0,
  rot: 30,
  legs: [
    [2.6, 0],
    [-2.4, 0],
  ],
  raw: { armF: { x: 6.6, y: 0.8, sy: 2.35 }, foreF: { sy: 1.3 }, face: { x: -1.85, y: -0.85 } },
  arms: [
    [5.6, -1.4],
    [7.8, -0.65],
  ],
  ant: [34, 28],
});
/** The streak up from the tile as it flips. */
const TILE_STREAK: Pose = { fx2: { x: 9.4, y: -9.4, rot: -90, sx: 3.3, sy: 1.6 } };

function tileAt(rot: number): Pose {
  const angle = (rot * Math.PI) / 180;
  return { fx1: { x: 8.1 + 3.2 * Math.cos(angle), y: -0.74 + 3.2 * Math.sin(angle), rot } };
}

const TILE_BRACE = P({
  x: -0.65,
  y: 1.5,
  rot: -24,
  sx: 1.03,
  sy: 0.89,
  legs: [
    [2.2, 0],
    [-2.4, 0],
  ],
  arms: [
    [5.25, -7.9],
    [-5.2, -6.75],
  ],
  ant: [-19, -26],
});

/** Gravity Switch: upside down; `pose` is drawn as if standing and then flipped about her middle. */
const flipped = (pose: Pose): Pose => mix(pose, FLIP);
const RISE = (wave: number): Pose =>
  flipped(
    P({
      raw: { thighB: { rot: -15 }, shinB: { rot: 20 }, thighF: { rot: 10 }, shinF: { rot: 15 } },
      arms: [
        [5.6, -6.8 + wave],
        [-5.4, -6.6 - wave],
      ],
      ant: [-10 - wave * 4, -10 + wave * 4],
    }),
  );

const RUN_LEN = 12;
function clingRun(from: number, to: number): Key[] {
  const keys: Key[] = [];
  for (let f = from; f <= to; f += 2)
    keys.push(
      key(f, mix(flipped(runPose(((f - from) % RUN_LEN) / RUN_LEN, 12)), { root: { y: -12.25 } }), {
        ease: 'linear',
      }),
    );
  return keys;
}

/** The ledge attack's sweep: low and long, the far foot skimming the floor in front of the ledge. */
const LEDGE_SWEEP = hitting(
  P({
    x: 0.4,
    y: 2.2,
    rot: -28,
    legs: [
      [7.4, -0.9],
      [-1.0, 0],
    ],
    raw: { thighB: { sy: 1.2 }, shinB: { sy: 1.2 } },
    arms: [
      [3.0, -1.0],
      [-6.0, -2.6],
    ],
    ant: [-22, -16],
  }),
  ['shinB', [8.2, -1.2], 1.6],
);

/** Grabs: both arms thrown forward. */
const reach = (x: number): Pose =>
  P({
    x: 0.4 + x,
    y: 0.6,
    rot: 10 + x * 3,
    legs: [
      [2.6 + x, 0],
      [-1.6, 0],
    ],
    raw: { ...LONG_B, ...LONG_F, armF: { x: 4.6, y: 0.5, sy: 1.6 } },
    arms: [
      [6.4 + x, -6.4],
      [6.0 + x, -5.2],
    ],
    ant: [16, 10],
  });

/** Holding the opponent at arm's length. */
const HOLD = P({
  x: 0.5,
  y: 0.6,
  rot: 8,
  legs: [
    [2.4, 0],
    [-1.6, 0],
  ],
  raw: { ...LONG_B, ...LONG_F, armF: { x: 4.6, y: 0.5, sy: 1.6 } },
  arms: [
    [6.4, -6.6],
    [5.8, -5.2],
  ],
  ant: [6, 4],
});

export const attacks: Record<string, AnimClip> = {
  jab: move(
    15,
    [[2, 3]],
    [
      key(0, READY, { ease: 'in' }),
      key(
        1,
        P({
          y: 0.7,
          rot: 2,
          legs: [
            [2.2, 0],
            [-1.7, 0],
          ],
          arms: [
            [4.6, -5.8],
            [-4.8, -5.0],
          ],
          ant: [0, 0],
        }),
        { ease: 'out' },
      ),
      ...strike(2, 3, JAB1, STREAK1, FAR_ARM_IN_FRONT),
      done(6, JAB1),
      key(14, READY),
    ],
  ),
  jab2: move(
    16,
    [[3, 3]],
    [
      key(0, JAB1, { ease: 'out' }),
      key(
        2,
        P({
          x: 0.6,
          y: 0.6,
          rot: 4,
          legs: [
            [2.5, 0],
            [-1.5, 0],
          ],
          arms: [
            [4.4, -5.4],
            [-4.0, -7.2],
          ],
          ant: [6, 4],
        }),
        { ease: 'out' },
      ),
      ...strike(3, 3, JAB2, STREAK1),
      done(7, JAB2),
      key(15, READY),
    ],
  ),
  jabRapid: move(
    RAPID_JAB.faf,
    [...RAPID_JAB.kicks.map((f): [number, number] => [f, f]), RAPID_JAB.shove],
    [
      ...RAPID_JAB.kicks.flatMap((f, i) => [
        key(f - 1, runPose(i / 4, 12), { ease: 'out', swaps: NO_FX }),
        key(f, i % 2 ? KICK_F : KICK_B, { ease: 'linear', swaps: STREAK1 }),
      ]),
      key(RAPID_JAB.loop - 1, runPose(0, 12), { swaps: NO_FX }),
      key(
        RAPID_JAB.loop + 2,
        P({
          x: 0.2,
          y: 0.8,
          rot: 0,
          legs: [
            [2.0, 0],
            [-1.8, 0],
          ],
          arms: [
            [3.4, -5.2],
            [-5.0, -5.4],
          ],
          ant: [2, 2],
        }),
        { ease: 'out' },
      ),
      ...strike(RAPID_JAB.shove[0], RAPID_JAB.shove[1], SHOVE, { ...STREAK1, ...SHOUT }),
      done(RAPID_JAB.shove[1] + 6, SHOVE),
      key(RAPID_JAB.faf - 1, READY),
    ],
  ),
  ftilt: move(
    24,
    [[5, 8]],
    [
      key(0, READY, { ease: 'linear' }),
      key(
        3,
        P({
          x: 0.2,
          y: 0.8,
          rot: 10,
          sx: -1,
          legs: [
            [-2.2, 0],
            [1.8, 0],
          ],
          arms: [
            [-5.0, -5.6],
            [4.4, -6.4],
          ],
          ant: [10, 10],
        }),
        { swaps: AWAY },
      ),
      ...strike(5, 8, FTILT, { ...STREAK1, ...SHOUT }),
      done(12, FTILT),
      key(23, READY),
    ],
  ),
  utilt: move(
    21,
    [
      [4, 5],
      [6, 10],
    ],
    [
      key(0, READY, { ease: 'linear' }),
      // Already springing on frame 3, so the flip into the first hit turns at most 120 degrees in a frame.
      key(3, between(UTILT_CROUCH, UTILT1, 0.4)),
      ...strike(4, 5, UTILT1, { ...STREAK1, ...SHOUT }),
      ...strike(6, 10, UTILT2, STREAK1),
      // The streaks stay where the second hit left them until they go out on 14.
      done(14, mix(flip(-300, 1.6), { fx1: UTILT2.fx1!, fx2: UTILT2.fx2 ?? {} })),
      key(20, mix(READY, { body: { rot: -360 } })),
    ],
  ),
  dtilt: move(
    22,
    [[5, 7]],
    [
      key(0, READY, { ease: 'out' }),
      key(3, CROUCH),
      ...strike(5, 7, DTILT, STREAK1),
      done(12, DTILT),
      key(21, CROUCH),
    ],
  ),
  dashAttack: move(
    38,
    [
      [7, 12],
      [13, 20],
    ],
    [
      key(0, runPose(0), { ease: 'out' }),
      key(
        4,
        P({
          x: 1.0,
          y: 0.8,
          rot: 30,
          legs: [
            [2.6, 0],
            [-3.0, -0.6],
          ],
          arms: [
            [3.0, -3.0],
            [-5.0, -4.0],
          ],
          ant: [40, 34],
        }),
      ),
      ...strike(7, 12, DIVE, { ...STREAK1, ...SHOUT }),
      // Rolling on the floor ball, antennae trailing, and up again a whole turn on, so she doesn't spin back.
      key(13, mix(ballAt(110), { body: { x: 2.4 } }), { ease: 'linear', swaps: NO_FX }),
      key(17, mix(ballAt(250), { body: { x: 2.4 } }), { ease: 'linear' }),
      key(20, mix(ballAt(360), { body: { x: 2.4 } }), { ease: 'out' }),
      key(28, spun(mix(CROUCH, { body: { x: 1.2 } }), 1), { swaps: FACE }),
      key(37, spun(READY, 1)),
    ],
  ),
  fsmash: move(
    46,
    [
      [12, 14],
      [15, 18],
    ],
    [
      key(0, READY, { ease: 'linear' }),
      key(
        4,
        P({
          x: -0.8,
          y: 1.3,
          rot: -10,
          sy: 0.9,
          legs: [
            [1.4, 0],
            [-2.6, 0],
          ],
          arms: [
            [2.0, -4.0],
            [-6.0, -5.0],
          ],
          ant: [-16, -10],
        }),
      ),
      key(
        8,
        P({
          x: -1.4,
          y: 2.0,
          rot: -24,
          sy: 0.86,
          legs: [
            [1.0, 0],
            [-3.2, 0],
          ],
          raw: { thighB: { rot: -30 }, shinB: { rot: 60 }, thighF: { rot: -20 }, shinF: { rot: 50 } },
          arms: [
            [1.0, -3.0],
            [-6.2, -4.2],
          ],
          ant: [-24, -18],
        }),
        { ease: 'in' },
      ),
      key(
        10,
        P({
          x: 0.6,
          y: -0.6,
          rot: -40,
          raw: { thighB: { rot: -75 }, shinB: { rot: 95 }, thighF: { rot: -65 }, shinF: { rot: 95 } },
          arms: [
            [1.2, -8.6],
            [-5.6, -8.0],
          ],
          ant: [20, 20],
        }),
        { ease: 'out' },
      ),
      ...strike(12, 14, DROPKICK, { ...STREAK2, ...SHOUT, fxBack: 'contact' }),
      ...strike(15, 18, DROPKICK_LATE, { ...STREAK1, fx2: null }),
      { ...done(20, DROPKICK_DOWN), ease: 'linear' },
      // Knees pulled in to her chest on the way up from the floor, so her legs don't sweep through it.
      key(22, mix(between(DROPKICK_DOWN, DROPKICK_SQUAT, 0.5), TUCKED_LEGS), { ease: 'linear' }),
      key(24, DROPKICK_SQUAT),
      key(36, mix(CROUCH, { body: { rot: -10 } }), { swaps: FACE }),
      key(42, CROUCH),
      key(45, READY),
    ],
  ),
  usmash: move(
    44,
    [
      [10, 12],
      [13, 15],
    ],
    [
      key(0, READY, { ease: 'out' }),
      key(
        5,
        P({
          y: 1.6,
          sy: 0.86,
          sx: 1.08,
          legs: [
            [2.0, 0],
            [-1.8, 0],
          ],
          arms: [
            [4.6, -2.6],
            [-4.4, -2.6],
          ],
          ant: [-14, 14],
        }),
        { ease: 'linear' },
      ),
      key(8, mix(HANDSTAND(40), { body: { rot: 30 }, antB: { rot: -82 }, antF: { rot: 27 } }), {
        ease: 'out',
      }),
      ...strike(10, 12, USMASH1, { ...STREAK2, ...SHOUT }),
      ...strike(13, 15, USMASH2, { ...STREAK1, fx2: null }),
      done(22, HANDSTAND(45)),
      key(30, mix(CROUCH, { body: { rot: 10 } })),
      key(43, READY),
    ],
  ),
  dsmash: move(
    44,
    [
      [6, 8],
      [9, 12],
    ],
    [
      key(0, READY, { ease: 'linear' }),
      key(
        3,
        P({
          y: -0.8,
          sy: 1.08,
          legs: [
            [0.8, -0.8],
            [-0.6, -0.6],
          ],
          arms: [
            [4.4, -9.0],
            [-4.2, -9.2],
          ],
          ant: [-20, -20],
        }),
        { ease: 'in' },
      ),
      ...strike(6, 8, SPLITS, { ...STREAK2, ...SHOUT }),
      ...strike(9, 12, SPLITS, STREAK2),
      done(18, SPLITS),
      key(30, CROUCH, { swaps: FACE }),
      key(43, READY),
    ],
  ),
  getupAttack: move(
    46,
    [[16, 21]],
    [
      key(0, LIE, { ease: 'inOut' }),
      key(7, ants(hands(mix(TUCK, { body: { x: -0.8, y: 2.0, rot: -100 } }), null, [-6.2, -3.8]), -95, -85), {
        ease: 'inOut',
      }),
      key(
        12,
        floorSit(
          [1, 1],
          [
            [2.6, -0.2],
            [1.2, -0.2],
          ],
          -22,
        ),
        { ease: 'linear' },
      ),
      key(
        15,
        floorSit(
          [1, 1],
          [
            [3.2, -2.4],
            [-3.2, -8.4],
          ],
          -26,
        ),
        { ease: 'in' },
      ),
      ...strike(16, 18, SPIN_FRONT, { ...STREAK2, ...SHOUT }),
      ...strike(19, 21, SPIN_BACK, { ...STREAK2, ...AWAY }, NEAR_LEG_IN_FRONT),
      key(22, SPIN_BACK, { swaps: { ...NO_FX, ...AWAY } }),
      key(
        24,
        mix(
          floorSit(
            [1, 1],
            [
              [-3.4, -6.6],
              [4.8, -5.0],
            ],
            -10,
          ),
          { body: { y: 1.7 } },
        ),
        { ease: 'linear' },
      ),
      key(27, mix(TUCK, { body: { y: BALL_Y - 2.3, rot: 20 } }), { ease: 'in', swaps: FACE, z: {} }),
      key(33, CROUCH),
      key(45, READY),
    ],
  ),
  nair: move(
    44,
    [
      [6, 9],
      [10, 24],
    ],
    [
      key(0, AIR, { ease: 'out' }),
      key(4, mix(TUCK, { body: { rot: 0 } }), { ease: 'linear', swaps: AWAY }),
      ...[6, 9, 12, 15, 18, 21, 24].map((f, i) =>
        key(f, mix(TUCK, { body: { rot: 60 + i * 110 } }), {
          ease: 'linear',
          swaps: i === 0 ? { ...AWAY } : {},
        }),
      ),
      key(30, mix(AIR, { body: { rot: 720 + 30 } }), { swaps: FACE }),
      key(43, mix(AIR, { body: { rot: 720 } })),
    ],
  ),
  fair: move(
    40,
    [
      [7, 8],
      [13, 15],
    ],
    [
      key(0, AIR, { ease: 'out' }),
      key(
        4,
        P({
          rot: -6,
          raw: { thighB: { rot: 70 }, shinB: { rot: 60 }, thighF: { rot: 40 }, shinF: { rot: 50 } },
          arms: [
            [4.0, -8.6],
            [-5.2, -8.4],
          ],
          ant: [-6, -6],
        }),
      ),
      ...strike(7, 8, SCISSOR1, { ...STREAK1, ...SHOUT }),
      done(10, SCISSOR1),
      ...strike(13, 15, SCISSOR2, STREAK1),
      done(20, SCISSOR2),
      key(39, AIR),
    ],
  ),
  bair: move(
    38,
    [
      [6, 8],
      [9, 12],
    ],
    [
      key(0, AIR, { ease: 'out' }),
      key(
        4,
        P({
          rot: 16,
          raw: { thighB: { rot: -60 }, shinB: { rot: 70 }, thighF: { rot: -70 }, shinF: { rot: 110 } },
          arms: [
            [5.4, -7.4],
            [-3.4, -9.6],
          ],
          ant: [-10, -6],
        }),
      ),
      ...strike(6, 8, BAIR, { ...STREAK1, ...SHOUT }),
      ...strike(9, 12, BAIR, STREAK1),
      done(18, BAIR),
      key(37, AIR),
    ],
  ),
  uair: move(
    34,
    [[7, 11]],
    [
      key(0, AIR, { ease: 'linear' }),
      key(4, pedal(0)),
      key(7, UAIR1, { ease: 'linear', swaps: { ...STREAK1, ...SHOUT } }),
      key(9, UAIR2, { ease: 'linear' }),
      key(11, UAIR1, { ease: 'out' }),
      done(16, pedal(-20)),
      key(33, mix(AIR, { body: { rot: -360 } })),
    ],
  ),
  dair: move(
    50,
    [
      [10, 11],
      [13, 14],
      [16, 17],
      [19, 20],
      [22, 23],
      [26, 27],
    ],
    [
      key(0, AIR, { ease: 'out' }),
      key(
        6,
        P({
          y: -1.2,
          raw: { thighB: { rot: -70 }, shinB: { rot: 90 }, thighF: { rot: -60 }, shinF: { rot: 90 } },
          arms: [
            [5.4, -9.8],
            [-5.2, -10.0],
          ],
          ant: [-14, -14],
        }),
      ),
      ...[10, 13, 16, 19, 22].flatMap((f, i) =>
        strike(f, f + 1, i % 2 ? STOMP_F : STOMP_B, i === 0 ? { ...STREAK1, ...SHOUT } : STREAK1),
      ),
      ...strike(26, 27, STAMP, STREAK1),
      done(32, STAMP),
      key(49, AIR),
    ],
  ),
  neutralB: move(
    40,
    [[14, 17]],
    [
      key(0, READY, { ease: 'out' }),
      key(4, mix(READY, tileAt(0)), { swaps: { fx1: 'tile' } }),
      key(
        8,
        mix(
          P({
            x: -0.4,
            y: 0.2,
            rot: -14,
            legs: [
              [2.0, 0],
              [-1.8, 0],
            ],
            raw: { armF: { x: 3.0, y: -1.0, sy: 1.3 } },
            arms: [
              [4.6, -5.4],
              [-1.6, -12.4],
            ],
            ant: [-14, -6],
          }),
          tileAt(0),
        ),
        { swaps: { ...SHOUT, fx1: 'tile' } },
      ),
      key(12, mix(SLAP, tileAt(0)), { ease: 'linear' }),
      key(13, mix(SLAP, tileAt(-25)), { ease: 'linear' }),
      key(
        14,
        mix(SLAP, tileAt(-53), {
          fx2: { x: 12.5, y: -5.8, rot: -83, sx: 4.3, sy: 1.65 },
          fx3: { x: 9.45, y: -6.55, sx: 0.9, sy: 1.12 },
        }),
        {
          ease: 'linear',
          swaps: { ...SHOUT, fx1: 'tile', fx2: 'streak', fxBack: 'contact' },
        },
      ),
      key(17, mix(SLAP, tileAt(-88), TILE_STREAK), {
        swaps: { ...SHOUT, fx1: 'tile', fx2: 'streak' },
      }),
      // The streak and the flipped tile hold where they are until they go out, on 22 and 28.
      key(22, mix(TILE_BRACE, tileAt(-168), TILE_STREAK), { ease: 'in', swaps: { fx1: 'tile' } }),
      key(25, mix(TILE_BRACE, tileAt(-180))),
      key(28, mix(TILE_BRACE, tileAt(-180)), { swaps: FACE }),
      key(39, READY, { swaps: FACE }),
    ],
  ),
  neutralBAir: move(
    30,
    [[6, 9]],
    [
      key(0, AIR, { ease: 'out' }),
      key(
        3,
        P({
          y: 0.4,
          sy: 0.88,
          sx: 1.1,
          raw: { thighB: { rot: -70 }, shinB: { rot: 100 }, thighF: { rot: -40 }, shinF: { rot: 80 } },
          arms: [
            [4.8, -9.6],
            [-4.6, -9.8],
          ],
          ant: [-20, -20],
        }),
      ),
      ...strike(
        6,
        9,
        hitting(
          P({
            rot: -18,
            raw: { ...LONG_LEG_B, thighF: { rot: 20 }, shinF: { rot: 30 } },
            legs: [
              [6.0, -5.2],
              [-1.0, -0.4],
            ],
            arms: [
              [3.4, -9.6],
              [-5.8, -8.4],
            ],
            ant: [-8, -8],
          }),
          ['shinB', [6.5, -5], 2.0],
        ),
        { ...STREAK1, ...SHOUT },
      ),
      done(14),
      key(29, AIR),
    ],
  ),
  upB: move(
    128,
    [[4, 6]],
    [
      key(0, READY, { ease: 'out', swaps: SHOUT }),
      key(
        3,
        P({
          y: 1.5,
          sy: 0.85,
          sx: 1.1,
          legs: [
            [2.0, 0],
            [-1.8, 0],
          ],
          arms: [
            [4.8, -2.8],
            [-4.6, -2.8],
          ],
          ant: [-12, 12],
        }),
        { ease: 'in' },
      ),
      key(4, mix(TUCK, { body: { rot: 0 } }), { ease: 'linear' }),
      key(5, mix(TUCK, { body: { rot: 60 }, root: { y: -7.5 } }), { ease: 'linear' }),
      key(6, mix(TUCK, { body: { rot: 150 }, root: { y: -6.9 } }), { ease: 'linear' }),
      key(7, RISE(0), { swaps: ANGRY }),
      ...[15, 25, 35, 45].map((f, i) => key(f, RISE(i % 2 ? -1 : 1))),
      key(53, RISE(0)),
      ...clingRun(60, 118),
      key(120, flipped(mix(TUCK, { body: { rot: 0 } })), { ease: 'linear', swaps: HAPPY }),
      key(123, flipped(mix(TUCK, { body: { rot: -85 } })), { ease: 'step' }),
      key(124, mix(TUCK, { body: { rot: 85 } }), { ease: 'out' }),
      key(127, AIR, { swaps: HURT }),
    ],
    { ...ANGRY },
  ),
  grab: move(
    34,
    [[6, 7]],
    [
      key(0, READY, { ease: 'out' }),
      key(
        4,
        P({
          y: 0.7,
          rot: 2,
          legs: [
            [2.3, 0],
            [-1.8, 0],
          ],
          arms: [
            [3.6, -6.2],
            [-5.4, -6.6],
          ],
          ant: [0, 0],
        }),
      ),
      ...strike(6, 7, reach(0.6), {}, FAR_ARM_IN_FRONT),
      key(12, reach(0.6)),
      key(33, READY, { z: {} }),
    ],
  ),
  dashGrab: move(
    42,
    [[9, 10]],
    [
      key(0, runPose(0), { ease: 'out' }),
      key(
        6,
        P({
          x: 0.8,
          y: 0.9,
          rot: 16,
          legs: [
            [3.0, 0],
            [-2.2, -0.4],
          ],
          arms: [
            [4.0, -6.0],
            [-5.6, -6.8],
          ],
          ant: [30, 24],
        }),
      ),
      ...strike(9, 10, reach(1.6), {}, FAR_ARM_IN_FRONT),
      key(16, reach(1.6)),
      key(41, READY, { z: {} }),
    ],
  ),
  pivotGrab: move(
    37,
    [[10, 11]],
    [
      // Her run pose mirrored about the vertical, its lean turned the other way with it.
      key(0, mix(runPose(0), { body: { sx: -1, rot: -(runPose(0).body?.rot ?? 0) } }), {
        ease: 'linear',
        swaps: AWAY,
      }),
      key(
        5,
        P({
          y: 0.9,
          rot: -8,
          sx: 0.85,
          legs: [
            [1.8, 0],
            [-1.8, 0],
          ],
          arms: [
            [4.0, -5.0],
            [-4.4, -5.0],
          ],
          ant: [-20, 20],
        }),
        { swaps: FACE },
      ),
      ...strike(10, 11, reach(1.6), {}, FAR_ARM_IN_FRONT),
      key(16, reach(1.6)),
      key(36, READY, { z: {} }),
    ],
  ),
  pummel: move(
    6,
    [[1, 1]],
    [
      key(0, HOLD, { z: FAR_ARM_IN_FRONT }),
      key(1, mix(HOLD, { body: { x: 1.4, rot: 22 } }), { ease: 'out', swaps: SHOUT }),
      key(5, HOLD, { swaps: ANGRY }),
    ],
  ),
  fthrow: move(
    34,
    [[14, 14]],
    [
      key(0, HOLD, { ease: 'in', z: FAR_ARM_IN_FRONT }),
      key(
        8,
        P({
          y: 0.6,
          rot: -10,
          sx: -0.9,
          legs: [
            [-2.0, 0],
            [1.8, 0],
          ],
          arms: [
            [-4.6, -6.0],
            [4.6, -6.8],
          ],
          ant: [10, 10],
        }),
        { swaps: AWAY, z: {} },
      ),
      ...strike(
        14,
        14,
        hitting(
          P({
            x: 1.0,
            y: 0.5,
            rot: -16,
            legs: [
              [7.2, -6.0],
              [-1.6, 0],
            ],
            raw: LONG_LEG_B,
            arms: [
              [3.4, -9.4],
              [-5.6, -8.0],
            ],
            ant: [-14, -18],
          }),
          ['shinB', [8.5, -6], 2.2],
        ),
        { ...STREAK1, ...SHOUT },
      ),
      done(20),
      key(33, READY),
    ],
  ),
  bthrow: move(
    44,
    [[30, 30]],
    [
      key(0, HOLD, { z: FAR_ARM_IN_FRONT }),
      key(10, mix(HOLD, { body: { x: 0, y: 1.0, rot: -10, sy: 0.92 } }), { ease: 'in' }),
      key(
        22,
        P({
          x: -1.0,
          y: -2.6,
          rot: -90,
          raw: {
            thighB: { rot: 10 },
            shinB: { rot: 10 },
            thighF: { rot: 20 },
            shinF: { rot: 10 },
            ...LONG_B,
            ...LONG_F,
          },
          arms: [
            [-2.0, -12.0],
            [-3.4, -11.4],
          ],
          ant: [-30, -20],
        }),
        { ease: 'in', swaps: SHOUT },
      ),
      key(
        30,
        P({
          x: -2.8,
          y: 1.0,
          rot: -150,
          raw: {
            thighB: { rot: 20 },
            shinB: { rot: 10 },
            thighF: { rot: 30 },
            shinF: { rot: 10 },
            ...LONG_B,
            ...LONG_F,
          },
          arms: [
            [-8.0, -1.6],
            [-8.4, -0.8],
          ],
          // Head down at the floor: the antennae lie flat along it, behind her.
          ant: [-98, -27],
        }),
        { ease: 'linear' },
      ),
      key(36, mix(DOWN_FRONT(), {}), { swaps: ANGRY, z: {} }),
      key(43, READY),
    ],
  ),
  uthrow: move(
    58,
    [[36, 36]],
    [
      key(0, HOLD, { z: FAR_ARM_IN_FRONT }),
      key(
        8,
        P({
          x: 0.5,
          y: 1.6,
          sy: 0.85,
          sx: 1.1,
          legs: [
            [2.4, 0],
            [-1.8, 0],
          ],
          raw: { ...LONG_B, ...LONG_F, armF: { x: 4.6, y: 0.5, sy: 1.6 } },
          arms: [
            [6.2, -5.0],
            [5.8, -4.4],
          ],
          ant: [-14, 14],
        }),
        { ease: 'in' },
      ),
      key(
        14,
        mix(
          flipped(
            P({
              raw: {
                ...LONG_B,
                ...LONG_F,
                armF: { x: 4.6, y: 0.5, sy: 1.6 },
                thighB: { rot: -10 },
                thighF: { rot: 10 },
              },
              arms: [
                [6.0, -7.4],
                [5.6, -6.6],
              ],
            }),
          ),
          { root: { sy: -1, y: -30 } },
        ),
        { ease: 'inOut', swaps: SHOUT },
      ),
      key(
        28,
        mix(
          flipped(
            P({
              raw: {
                ...LONG_B,
                ...LONG_F,
                armF: { x: 4.6, y: 0.5, sy: 1.6 },
                thighB: { rot: -10 },
                thighF: { rot: 10 },
              },
              arms: [
                [6.0, -7.4],
                [5.6, -6.6],
              ],
            }),
          ),
          { root: { sy: -1, y: -32 } },
        ),
        { ease: 'in' },
      ),
      key(
        36,
        P({
          x: 1.0,
          y: 1.8,
          sy: 0.82,
          sx: 1.14,
          legs: [
            [2.6, 0],
            [-1.8, 0],
          ],
          raw: { ...LONG_B, ...LONG_F, armF: { x: 4.6, y: 0.5, sy: 1.6 } },
          arms: [
            [6.6, -1.6],
            [6.2, -1.0],
          ],
          ant: [24, 24],
        }),
        { ease: 'out' },
      ),
      key(44, CROUCH, { swaps: ANGRY, z: {} }),
      key(57, READY),
    ],
  ),
  dthrow: move(
    40,
    [[26, 26]],
    [
      key(0, HOLD, { z: FAR_ARM_IN_FRONT }),
      key(5, mix(runPose(0.1, 6), { body: { x: 1.5, y: -4.0 } }), { z: {} }),
      ...[8, 10, 12, 14, 16, 18, 20, 22].map((f) =>
        key(f, mix(runPose(((f - 8) % 12) / 12, 6), { body: { x: 1.5, y: -4.0 } }), {
          ease: 'linear',
          swaps: f === 8 ? HAPPY : {},
        }),
      ),
      key(
        26,
        P({
          x: -1.4,
          y: -2.4,
          rot: -10,
          sy: 1.08,
          raw: { thighB: { rot: 10 }, shinB: { rot: 20 }, thighF: { rot: -20 }, shinF: { rot: 30 } },
          arms: [
            [3.4, -11.4],
            [-5.8, -10.6],
          ],
          ant: [-20, -20],
        }),
        { ease: 'out' },
      ),
      key(32, CROUCH, { swaps: ANGRY }),
      key(39, READY),
    ],
  ),
  /** Over the corner and straight into a low sweep along the floor (the engine's ledge attack; no move data). */
  ledgeAttack: {
    length: LEDGE_ATTACK.faf - 1,
    swaps: ANGRY,
    keys: [
      key(0, HANG, { ease: 'linear', z: FAR_ARM_IN_FRONT }),
      key(6, pull(6, LEDGE_ATTACK.moveEnd, 0.6), { ease: 'linear' }),
      key(11, mix(CROUCH, { body: { rot: 12 } }), { ease: 'out', z: {} }),
      key(
        16,
        P({
          x: -0.6,
          y: 2.2,
          rot: -30,
          legs: [
            [1.6, -0.6],
            [-0.8, 0],
          ],
          arms: [
            [3.0, -1.2],
            [-5.4, -2.0],
          ],
          ant: [-10, -6],
        }),
        { ease: 'linear' },
      ),
      ...strike(19, 23, LEDGE_SWEEP, { ...STREAK1, ...SHOUT }),
      done(30, LEDGE_SWEEP),
      key(42, CROUCH, { swaps: FACE }),
      key(LEDGE_ATTACK.faf - 1, STAND),
    ],
  },
};

/** Landed face down after the suplex, pushing up. */
function DOWN_FRONT(): Pose {
  return P({
    x: -1.4,
    y: 1.3,
    rot: -40,
    legs: [
      [1.6, 0],
      [-2.6, 0],
    ],
    arms: [
      [-0.4, -1.0],
      [-5.8, -1.2],
    ],
    ant: [-20, -10],
  });
}
