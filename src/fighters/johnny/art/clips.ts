import { pointOf, type Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { attacks } from './attacks';
import { dodges } from './dodges';
import { laser } from './laser';
import { ledge } from './ledge';
import {
  AIR,
  BACK_ARM_OVER_HEAD,
  CROUCH,
  FISTS,
  GRIT,
  GUARD,
  HURT,
  PALM_B,
  PALM_F,
  PIVOT,
  SHOUT,
  SMIRK,
  STANCE,
  aloft,
  feet,
  fist,
  hands,
  key,
  leg,
  mix,
  shortTurns,
  soles,
  type Pt,
} from './poses';
import { rig } from './rig';

/**
 * Johnny's movement, defence and hurt clips, posed after the 2012 game's drawings: the bow-legged fighting stance
 * with an open guard hand and a cocked fist, the charging sprint with one fist cocked by his jaw, and the
 * fist-first jump.
 */

const IDLE_FEET = { footF: { sx: -1 } };

/** Puts a fist `reach` from its shoulder, `deg` degrees from straight down (positive swings it towards +x). */
function swing(pose: Pose, side: 'B' | 'F', deg: number, reach = 4.3, bend: 1 | -1 = 1): Pose {
  const [x, y] = pointOf(rig, pose, `arm${side}`);
  const r = (deg * Math.PI) / 180;
  return fist(pose, side, [x + Math.sin(r) * reach, y + Math.cos(r) * reach], 1, bend);
}

/**
 * Idle breath with overlapping action: `sink` (0 to 1) drops the hips and rolls the shoulders forward, `head` is
 * where the head has got to (it trails the shoulders by a few frames), and the hands drift on their own beat.
 */
function breath(sink: number, head: number, back: Pt, front: Pt): Pose {
  const lag = head - sink;
  const body = {
    hip: { y: 0.25 + 0.32 * sink },
    body: { rot: 2 + 1.4 * sink },
    neck: { y: 0.3 * lag, rot: 2.4 * head - 1.4 * lag },
  };
  return hands(mix(feet(body, [3.0, 0], [-2.4, 0]), IDLE_FEET), back, front, -1, 1);
}

/** Thigh roots pulled in under the hips for strides, as he does when he walks and runs side-on. */
const SIDE_ON: Pose = { thighF: { x: 0.6 }, thighB: { x: -0.7 } };

/**
 * Walk: a swaggering march, chest out, the fists swinging wide of the torso. One leg's ankle path in eight beats
 * (point and sole angle); the far leg runs half a cycle behind and a little to the +x side, so the passing boots
 * never stack. Each passing beat plants a flat boot with the hips shifted over it.
 */
const WALK_LEG: [Pt, number][] = [
  [[3.0, -0.55], -4],
  [[1.5, -0.55], 0],
  [[0.0, -0.55], 0],
  [[-1.5, -0.75], 6],
  [[-3.0, -1.3], 24],
  [[-1.4, -1.9], 30],
  [[0.9, -2.1], 6],
  [[2.6, -1.1], -12],
];
/** Hip drop and forward shift of the body on each beat: low at the contacts, high and over the boot when passing. */
const WALK_BODY: [number, number][] = [
  [0.35, 0],
  [0.15, -0.3],
  [-0.15, -0.5],
  [0.1, -0.2],
];
const WALK: Pose[] = WALK_LEG.map((_, i) => {
  const [[nx, ny], nearSole] = WALK_LEG[i]!;
  const [[fx, fy], farSole] = WALK_LEG[(i + 4) % 8]!;
  const [hipY, shift] = WALK_BODY[i % 4]!;
  const sway = i < 4 ? shift : -shift * 0.4;
  const base = mix(SIDE_ON, {
    hip: { y: hipY },
    body: { x: sway, rot: 2 },
    torso: { rot: -3 },
    neck: { rot: 2 },
  });
  const legs = leg(leg(base, 'F', [nx - 0.4, ny], nearSole), 'B', [fx + 0.4, fy], farSole);
  const arm = 25 * Math.cos((i * Math.PI) / 4);
  return swing(swing(legs, 'F', -35 - arm, 4.3, -1), 'B', 40 + arm, 4.3, 1);
});

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

/**
 * Run, after the game's charging sprint: the torso pitched 38 degrees into it so the head leads, the near arm
 * flung straight back past the hip and the far fist cocked up beside the jaw, legs split wide with the trailing
 * boot kicked up behind. One leg's ankle path in eight beats (sole angle, stretch); the other leg runs half a
 * cycle behind. Contacts (beats 0 and 4) pin the loaded sole to the floor; the passing beats leave it briefly.
 */
const RUN_LEG: [Pt, number, number][] = [
  [[2.4, -0.55], 0, 1.05],
  [[0.3, -0.85], 8, 1.0],
  [[-2.0, -2.4], 55, 1.05],
  [[-4.4, -2.7], 130, 1.15],
  [[-5.0, -2.3], 160, 1.15],
  [[-1.8, -4.3], 115, 1.1],
  [[2.0, -2.8], 20, 1.0],
  [[3.4, -1.1], -12, 1.05],
];
const RUN_BODY = [0.3, 0.0, -0.5, -0.15];
/** The arms at contact, then half a beat on, then passing, then the next half beat: near hand back, far fist up. */
const RUN_ARMS: [Pt, Pt][] = [
  [
    [-4.9, -6.4],
    [9.2, -11.0],
  ],
  [
    [-4.2, -6.0],
    [9.0, -10.6],
  ],
  [
    [-3.2, -5.6],
    [8.8, -10.2],
  ],
  [
    [-4.2, -6.2],
    [9.0, -10.7],
  ],
];
const RUN: Pose[] = RUN_LEG.map((_, i) => {
  const [nearAt, nearSole, nearStretch] = RUN_LEG[i]!;
  const [farAt, farSole, farStretch] = RUN_LEG[(i + 4) % 8]!;
  const [back, up] = RUN_ARMS[i % 4]!;
  const lean = {
    thighF: { x: 1.0 },
    thighB: { x: -1.1 },
    torso: { rot: 38 },
    neck: { rot: -22 },
    armF: { x: -0.3, y: 0.9 },
  };
  const body = mix(lean, { hip: { y: RUN_BODY[i % 4]! }, body: { x: -0.6 } });
  const legs = leg(leg(body, 'F', nearAt, nearSole, nearStretch), 'B', farAt, farSole, farStretch);
  return fist(fist(legs, 'F', back, 1.2, 1), 'B', up, 1.1, 1);
});

/** A pose `t` of the way from `a` to `b`, tweened bone by bone the way the player does it. */
function blend(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const bone of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const [p, q] = [a[bone] ?? {}, b[bone] ?? {}];
    out[bone] = {
      x: (p.x ?? 0) + ((q.x ?? 0) - (p.x ?? 0)) * t,
      y: (p.y ?? 0) + ((q.y ?? 0) - (p.y ?? 0)) * t,
      rot: (p.rot ?? 0) + ((q.rot ?? 0) - (p.rot ?? 0)) * t,
      sx: (p.sx ?? 1) + ((q.sx ?? 1) - (p.sx ?? 1)) * t,
      sy: (p.sy ?? 1) + ((q.sy ?? 1) - (p.sy ?? 1)) * t,
    };
  }
  return out;
}

/** Dash push-off: the far leg driving him off the floor behind, the near knee punched up, arms thrown wide. */
const PUSH_OFF = fist(
  fist(
    leg(
      leg(
        mix(SIDE_ON, {
          hip: { y: 0.5 },
          body: { x: -1.0 },
          torso: { rot: 38 },
          neck: { rot: -24 },
          armF: { x: -0.3, y: 0.9 },
        }),
        'B',
        [-4.4, -2.15],
        68,
        1.2,
      ),
      'F',
      [3.9, -0.1],
      6,
      1.05,
    ),
    'F',
    [-5.6, -9.4],
    1.2,
    1,
  ),
  'B',
  [9.6, -8.2],
  1.15,
  1,
);
/** Dash wind-up: sunk low and coiled, both fists pulled back. */
const DASH_LOAD = fist(
  fist(
    mix(feet({ hip: { y: 0.9 }, torso: { rot: 30 }, neck: { rot: -18 } }, [1.9, 0], [-2.6, 0]), IDLE_FEET),
    'F',
    [-3.6, -6.0],
    1,
    1,
  ),
  'B',
  [5.8, -6.6],
  1,
  1,
);

/** Halfway off the mark: the far heel peeling up as the near knee starts to drive. */
const DASH_DRIVE = fist(
  fist(
    leg(
      leg(mix(blend(DASH_LOAD, PUSH_OFF, 0.5), { hip: { y: -0.1 } }), 'B', [-2.2, -1.66], 34),
      'F',
      [-0.2, -1.4],
      18,
      1,
      -1,
    ),
    'F',
    [-4.8, -8.0],
    1.15,
    1,
  ),
  'B',
  [8.0, -7.6],
  1.1,
  1,
);

/** The skid out of the turn: weight back on the heels, guard coming up. */
const TURN_SKID = hands(
  mix(feet({ hip: { y: 0.55 }, body: { rot: -8, x: -0.5 } }, [3.3, 0], [-2.9, 0]), IDLE_FEET),
  [5.4, -8.0],
  [-4.0, -7.6],
  -1,
  1,
);

/**
 * Crouch, low and wide like a sumo: knees folded and splayed, the torso pitched forward, head sunk between the
 * shoulders, fists resting on his knees.
 */
const SQUAT_LEGS = mix(
  feet(
    { hip: { y: 1.9 }, body: { sx: 1.05, sy: 0.92 }, torso: { rot: 26 }, neck: { y: 1.9, rot: -1 } },
    [3.9, 0],
    [-3.7, 0],
  ),
  IDLE_FEET,
);

/** His fists rest just above the knees. */
const SQUAT = hands(
  SQUAT_LEGS,
  [pointOf(rig, SQUAT_LEGS, 'shinB')[0] + 0.3, pointOf(rig, SQUAT_LEGS, 'shinB')[1] - 0.9],
  [pointOf(rig, SQUAT_LEGS, 'shinF')[0] + 0.4, pointOf(rig, SQUAT_LEGS, 'shinF')[1] - 0.9],
  -1,
  1,
);

/** Touchdown: squashed into his knees, arms flung out low for balance. */
const LAND_IMPACT = hands(
  mix(
    feet(
      { hip: { y: 1.8 }, body: { sx: 1.05, sy: 0.94 }, torso: { rot: 12 }, neck: { y: 0.5 } },
      [3.4, 0],
      [-3.2, 0],
    ),
    IDLE_FEET,
  ),
  [6.6, -5.4],
  [-5.6, -5.6],
  -1,
  1,
);
/** Rising out of the landing: weight rolling onto the near leg, the fists coming back up into his guard. */
const LAND_RISE = hands(
  mix(
    feet(
      { hip: { y: 0.9 }, body: { x: -0.35, rot: -2 }, torso: { rot: 6 }, neck: { y: 0.2 } },
      [3.2, 0],
      [-2.6, 0],
    ),
    IDLE_FEET,
  ),
  [6.0, -7.2],
  [-4.3, -7.0],
  -1,
  1,
);

/** Jump take-off: the superhero launch, far fist thrust overhead, near fist at his hip, legs trailing. */
const RISE = aloft(
  hands(
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
  ),
);

/** Jump apex, after the game's jump drawing: knees tucked, fists up in front of him. */
const APEX = aloft(
  hands(
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
  ),
);

/**
 * Falling, flapping for balance: arms up and spread above the horizontal (`near` and `far` degrees) with the
 * palms open, knees bent and boots apart, the quiff tossed by `neck`. Boots hang at the rig root.
 */
function flap(near: number, far: number, neck: number, splay: number): Pose {
  const legs = soles(
    {
      torso: { rot: -2 },
      neck: { rot: neck },
      thighF: { rot: 16 + splay },
      shinF: { rot: 34 },
      thighB: { rot: -26 - splay },
      shinB: { rot: 30 },
    },
    24,
    34,
  );
  return aloft(swing(swing(legs, 'F', -90 - near, 4.2, 1), 'B', 90 + far, 4.2, -1));
}
const FALL: [Pose, Pose, Pose] = [flap(38, 34, 2, 0), flap(30, 44, -9, 3), flap(45, 31, 4, 1)];

/** The double jump's kick-off: fists flung up in a V, the near leg stamping down, the far knee coming up. */
const DJ_OPEN = aloft(
  hands(
    {
      neck: { rot: -10 },
      torso: { rot: -4 },
      thighF: { rot: 14 },
      shinF: { rot: 12 },
      thighB: { rot: -70 },
      shinB: { rot: 90 },
      footF: { rot: 50 },
      footB: { rot: 20 },
    },
    [7.2, -15.2],
    [-5.0, -15.0],
    -1,
    1,
  ),
);

/** Balled up for the flip: knees hugged to his chest, arms wrapped round his shins, head tucked down. */
const BALL_LEGS: Pose = {
  hip: { y: -0.4 },
  torso: { rot: 14 },
  neck: { y: 0.6, rot: 16 },
  thighF: { rot: -92 },
  shinF: { rot: 74 },
  thighB: { rot: -78 },
  shinB: { rot: 66 },
  footF: { rot: 64 },
  footB: { rot: 52 },
};
const BALL = hands(
  BALL_LEGS,
  [pointOf(rig, BALL_LEGS, 'shinB', 0, 1.0)[0] + 0.7, pointOf(rig, BALL_LEGS, 'shinB', 0, 1.0)[1]],
  [pointOf(rig, BALL_LEGS, 'shinF', 0, 1.0)[0] + 0.9, pointOf(rig, BALL_LEGS, 'shinF', 0, 1.0)[1]],
  1,
  1,
);
/** Unfurled after the flip: arms thrown out wide, legs apart, chest up. */
const SPREAD = hands(
  {
    torso: { rot: -6 },
    neck: { rot: -6 },
    thighF: { rot: 18 },
    shinF: { rot: 24 },
    thighB: { rot: -30 },
    shinB: { rot: 30 },
    footF: { rot: 30 },
    footB: { rot: 20 },
  },
  [8.2, -10.6],
  [-6.8, -10.6],
  -1,
  1,
);

/** Struck: `k` scales the recoil (head and chest thrown back, hips pushed forward), `neck` snaps the head. */
function recoil(k: number, neck: number, back: Pt, front: Pt): Pose {
  return aloft(
    hands(
      mix(AIR, {
        body: { rot: -20 * k, x: -0.4 * k },
        neck: { rot: neck },
        thighF: { rot: -30 * k },
        shinF: { rot: 30 + 12 * k },
        thighB: { rot: 12 * k },
        shinB: { rot: 24 + 10 * k },
      }),
      back,
      front,
      -1,
      1,
    ),
  );
}

/** Launched: spread-eagle like the game's knocked-back frame, then balled up on the spin, then flung open again. */
const TUMBLE_OPEN = hands(
  mix(AIR, { thighF: { rot: -70 }, shinF: { rot: 80 }, thighB: { rot: 40 }, shinB: { rot: 10 } }),
  [6.4, -13.2],
  [-6.0, -10.4],
  -1,
  1,
);
const TUMBLE_CURL = hands(
  mix(AIR, {
    torso: { rot: 12 },
    neck: { y: 0.4, rot: 12 },
    thighF: { rot: -104, x: 0.8 },
    shinF: { rot: 124 },
    thighB: { rot: -26, x: -1.2 },
    shinB: { rot: 58 },
  }),
  [3.8, -7.0],
  [1.4, -7.6],
  -1,
  1,
);
const spun = (pose: Pose, rot: number) => aloft(mix(pose, { body: { rot } }));

/**
 * Under the bubble, braced: knees bent wide, head ducked, forearms crossed in an X in front of his goggles with the
 * elbows flared, the far arm drawn over his face so its fist shows.
 */
const BRACE_LEGS = mix(
  feet(
    {
      hip: { y: 1.25 },
      torso: { rot: 6 },
      neck: { y: 0.9, rot: 10 },
      armF: { x: 0.4, y: -0.4 },
      armB: { x: -0.4, y: -0.4 },
    },
    [4.1, 0],
    [-3.9, 0],
  ),
  IDLE_FEET,
);
const SHIELD = fist(fist(BRACE_LEGS, 'F', [2.9, -12.4], 1.25, 1), 'B', [-0.4, -12.6], 1.25, -1);

/**
 * Keys for a spin from frame `start` to `end`, one every `step` frames: the body turns from `from` to `to` degrees
 * while the drawing goes through `shape(u)` (u from 0 to 1), each key lifted clear of the floor.
 */
function spin(
  shape: (u: number) => Pose,
  from: number,
  to: number,
  start: number,
  end: number,
  step: number,
): Key[] {
  const keys: Key[] = [];
  for (let f = start; f <= end; f += step) {
    const u = (f - start) / (end - start);
    keys.push(key(f, spun(shape(u), from + (to - from) * u), { ease: 'linear' }));
  }
  return keys;
}

export const clips: Record<string, AnimClip> = {
  idle: {
    length: 56,
    loop: true,
    swaps: { ...GRIT, ...GUARD },
    keys: [
      key(0, breath(0, 0.1, [5.7, -9.0], [-3.7, -8.9]), { ease: 'in' }),
      key(12, breath(0.55, 0.25, [5.85, -8.8], [-3.95, -8.65]), { ease: 'out' }),
      key(28, breath(1, 0.85, [5.55, -8.6], [-3.85, -8.35]), { ease: 'in' }),
      key(40, breath(0.45, 0.75, [5.45, -8.85], [-3.55, -8.6]), { ease: 'out' }),
    ],
  },
  walk: {
    length: 40,
    loop: true,
    swaps: { ...GRIT, ...FISTS },
    keys: shortTurns(WALK.map((pose, i) => key(i * 5, pose, { ease: 'linear' }))),
  },
  dash: {
    length: 10,
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, DASH_LOAD, { ease: 'in' }),
      key(2, DASH_DRIVE, { ease: 'out' }),
      key(4, PUSH_OFF, { ease: 'inOut' }),
      key(10, RUN[0]),
    ],
  },
  run: {
    length: 24,
    loop: true,
    swaps: { ...GRIT, ...FISTS },
    keys: shortTurns(RUN.map((pose, i) => key(i * 3, pose, { ease: 'linear' }))),
  },
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
      key(0, mix(STANCE, { body: { sx: -1 } }), { ease: 'inOut' }),
      key(2, mix(PIVOT, { body: { sx: -0.92 } }), { ease: 'step', swaps: { ...GRIT, ...FISTS } }),
      key(3, mix(PIVOT, { body: { sx: 0.92 } }), { ease: 'out' }),
      key(5, TURN_SKID, { ease: 'inOut', swaps: { ...GRIT, ...GUARD } }),
      key(8, STANCE),
    ],
  },
  crouch: {
    length: 6,
    swaps: { ...GRIT, ...FISTS },
    keys: [key(0, STANCE, { ease: 'out' }), key(6, SQUAT)],
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
      key(16, aloft(mix(RISE, { body: { sx: 1, sy: 1, rot: -3 } })), {
        ease: 'inOut',
        swaps: { ...GRIT, ...FISTS },
      }),
      key(40, APEX),
    ],
  },
  doubleJump: {
    length: 30,
    swaps: { ...SHOUT, ...FISTS },
    keys: shortTurns([
      key(0, DJ_OPEN, { ease: 'out' }),
      key(4, aloft(mix(DJ_OPEN, { neck: { rot: -4 }, body: { rot: 8 } })), { ease: 'in' }),
      key(5, undefined, { swaps: { ...GRIT, ...FISTS } }),
      ...spin(() => BALL, 30, 330, 6, 14, 1),
      key(15, spun(BALL, 345), { ease: 'out' }),
      key(17, spun(blend(BALL, SPREAD, 0.55), 360), { ease: 'linear' }),
      key(18, spun(blend(BALL, SPREAD, 0.8), 360), { ease: 'out' }),
      key(20, spun(SPREAD, 360), { ease: 'inOut' }),
      key(30, spun(FALL[0], 360)),
    ]),
  },
  fall: {
    length: 24,
    loop: true,
    swaps: { ...GRIT, ...PALM_F, ...PALM_B },
    keys: [key(0, FALL[0]), key(8, FALL[1]), key(16, FALL[2])],
  },
  land: {
    length: 4,
    swaps: { ...GRIT, ...FISTS },
    keys: [key(0, LAND_IMPACT, { ease: 'out' }), key(2, LAND_RISE, { ease: 'inOut' }), key(4, STANCE)],
  },
  shield: {
    length: 6,
    swaps: { ...GRIT, ...FISTS },
    keys: [key(0, STANCE, { ease: 'out' }), key(3, undefined, { z: BACK_ARM_OVER_HEAD }), key(6, SHIELD)],
  },
  shieldDrop: {
    length: 11,
    swaps: { ...GRIT, ...GUARD },
    keys: [
      key(0, SHIELD, { ease: 'out', swaps: { ...GRIT, ...FISTS }, z: BACK_ARM_OVER_HEAD }),
      key(4, undefined, { z: {} }),
      key(6, undefined, { swaps: {} }),
      key(11, STANCE),
    ],
  },
  hitstun: {
    length: 20,
    swaps: { ...HURT, ...PALM_F },
    keys: [
      key(0, recoil(1, -16, [5.8, -13.6], [-5.4, -12.6]), { ease: 'out' }),
      key(3, recoil(1.35, -24, [6.4, -14.4], [-6.0, -13.2]), { ease: 'inOut' }),
      key(9, recoil(0.5, 4, [5.2, -11.2], [-4.2, -10.4]), { ease: 'inOut' }),
      key(20, recoil(0.75, -6, [5.6, -12.2], [-4.8, -11.4])),
    ],
  },
  tumble: {
    length: 32,
    loop: true,
    swaps: { ...HURT, ...PALM_F },
    keys: spin(
      (u) => blend(TUMBLE_OPEN, TUMBLE_CURL, (1 - Math.cos(u * 4 * Math.PI)) / 2),
      -40,
      -400,
      0,
      32,
      1,
    ),
  },
  helpless: {
    length: 32,
    loop: true,
    swaps: { ...SMIRK, ...PALM_F, ...PALM_B },
    keys: [
      key(0, aloft(mix(FALL[0], { neck: { rot: 8 } }))),
      key(16, aloft(mix(FALL[2], { neck: { rot: 4 } }))),
    ],
  },
  ...attacks,
  ...dodges,
  ...laser,
  ...ledge,
};
