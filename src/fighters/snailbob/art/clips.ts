import { pointOf, type Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import {
  AIR,
  BLINK,
  CALM,
  CROUCH,
  DAZED,
  DETERMINED,
  HANDS,
  HAPPY,
  HURT,
  IN_SHELL,
  SHELL_DOWN,
  SPINNING,
  STAND,
  STARTLED,
  WIDE,
  add,
  at,
  hands,
  key,
  look,
  mix,
  stalks,
  type Pt,
} from './poses';
import { BODY_Y, SHELL_X, SHELL_Y, rig } from './rig';

const TAU = Math.PI * 2;
const sin = (t: number) => Math.sin(t * TAU);

/**
 * A looping clip sampled from `fn(phase)` (phase 0 to 1) at `count` evenly spaced keys, tweened linearly: handy
 * for cycles with secondary motion, where each part follows the main beat a little late.
 */
function wave(
  length: number,
  count: number,
  fn: (t: number) => Pose,
  extra: Partial<AnimClip> = {},
): AnimClip {
  const keys: Key[] = Array.from({ length: count }, (_, i) =>
    key((i * length) / count, fn(i / count), { ease: 'linear' }),
  );
  return { length, loop: true, keys, ...extra };
}

/** The eyestalks swaying with a lag behind `t`: lower segments first, tips later, front pair a beat behind. */
function sway(t: number, amp: number, base: [number, number, number, number] = [0, 0, 0, 0]): Pose {
  return stalks(
    base[0] + amp * sin(t - 0.15),
    base[1] + amp * 1.3 * sin(t - 0.3),
    base[2] + amp * sin(t - 0.25),
    base[3] + amp * 1.3 * sin(t - 0.4),
  );
}

/** The stalks' resting bend: each pair curves out from the other like the games' Bob, never parallel. */
const STALK_REST: [number, number, number, number] = [-4, 8, 2, -5];

/** Pulled into the shell with the shell's centre on the body's pivot, so turning `body` spins it in place. */
const BALL: Pose = { shell: { x: -SHELL_X, y: BODY_Y - SHELL_Y } };

/* ---------------------------------------------------------------- ground */

const idle = wave(
  96,
  8,
  (t) =>
    add(
      { shell: { y: -0.16 * sin(t), rot: -0.8 * sin(t - 0.1) }, foot: { sx: 1 - 0.012 * sin(t) } },
      { neck: { rot: -2 * sin(t - 0.1) }, head: { rot: -1.5 * sin(t - 0.2) } },
      sway(t, 3, STALK_REST),
    ),
  { swaps: HAPPY },
);
idle.keys.push(key(80, undefined, { swaps: BLINK }), key(84, undefined, { swaps: {} }));
idle.keys.sort((a, b) => a.frame - b.frame);

/**
 * Crawl: the foot stretches forward then gathers up, humping the middle so the shell bobs and rocks a beat late,
 * the head nods and the stalks swing behind it; the skirt's ripple runs on its own (the crawl cels).
 */
const crawl = (t: number, speed: number): Pose =>
  add(
    {
      foot: { sx: 1 + 0.11 * speed * sin(t), sy: 1 - 0.08 * speed * sin(t), x: 0.45 * speed * sin(t) },
      shell: {
        y: -0.85 * speed * Math.max(0, -sin(t - 0.12)),
        rot: 4.5 * speed * sin(t - 0.2),
        x: 0.45 * speed * sin(t - 0.12),
      },
      neck: { rot: 8 * speed * sin(t - 0.05) },
      head: { rot: -5 * speed * sin(t - 0.2), y: -0.2 * speed * sin(t * 2) },
    },
    sway(t, 5 * speed, STALK_REST),
    look(0.06 * sin(t - 0.3), 0),
  );

const CRAWL_FEET = { foot: 'footCrawl', footLine: 'footCrawlLine' };
const walk = wave(48, 12, (t) => crawl(t, 1), { swaps: { ...HAPPY, ...CRAWL_FEET } });

/** Run: leaning hard into it, the foot pumping long and short, shell bouncing, stalks streaming back in the wind. */
const RUN_LEAN: Pose = mix(
  { shell: { rot: 9, x: 0.4 }, neck: { rot: 20 }, head: { rot: 6 } },
  stalks(-24, -12, -20, -10, 1.06),
);
const runPose = (t: number): Pose =>
  add(
    RUN_LEAN,
    {
      foot: { sx: 1.02 + 0.15 * sin(t * 2), sy: 1 - 0.1 * sin(t * 2), x: 0.5 * sin(t * 2) },
      shell: { y: -0.75 * Math.abs(sin(t - 0.06)), rot: 4 * sin(t * 2 - 0.15) },
      neck: { rot: 6 * sin(t * 2 - 0.1) },
      head: { y: -0.2 * sin(t * 2 - 0.2) },
      fx4: at(-6.6, 0, 0, 0.42 + 0.14 * sin(t * 2)),
    },
    sway(t * 2, 6),
  );
const run = wave(24, 8, runPose, {
  swaps: { ...HAPPY, mouth: 'grin', fxBack: 'dust', foot: 'footRush', footLine: 'footRushLine' },
});

const dash: AnimClip = {
  length: 13,
  swaps: DETERMINED,
  keys: [
    key(0, mix(CROUCH, { shell: { y: 0.8, rot: -8, x: -0.4 } }), { ease: 'out' }),
    key(4, mix(runPose(0.25), { foot: { sx: 1.16, x: 0.7 }, neck: { rot: 24 }, fx4: at(-6.8, 0, 0, 0.7) }), {
      ease: 'inOut',
      swaps: { ...DETERMINED, fxBack: 'dust' },
    }),
    key(13, runPose(0)),
  ],
};

const runBrake: AnimClip = {
  length: 14,
  swaps: STARTLED,
  keys: [
    key(
      0,
      mix(
        {
          foot: { sx: 0.9, x: -0.3 },
          shell: { rot: 14, x: 1.0, y: -0.3 },
          neck: { rot: -12 },
          fx2: at(5.4, 0, 0, 0.6),
        },
        stalks(24, 18, 28, 20),
      ),
      { ease: 'out', swaps: { ...STARTLED, fx2: 'dust' } },
    ),
    key(
      6,
      mix(
        { shell: { rot: -5, x: -0.2 }, neck: { rot: 4 }, fx2: at(6.2, 0, 0, 0.3) },
        stalks(-8, -10, -6, -8),
      ),
      {
        ease: 'inOut',
      },
    ),
    key(8, undefined, { swaps: HAPPY }),
    key(14, STAND),
  ],
};

/**
 * Turning around: the engine flips him on frame 1, so he starts mirrored, bunches up, then snaps round in one cel
 * (no thin in-between) with the stalks whipping after the turn and settling.
 */
const turn: AnimClip = {
  length: 12,
  swaps: HAPPY,
  keys: [
    key(0, mix({ body: { sx: -1 } }, stalks(10, 6, 12, 8)), { ease: 'out' }),
    key(3, mix(CROUCH, { body: { sx: -0.96, sy: 0.94 } }, stalks(8, 6, 10, 8, 0.85)), { ease: 'step' }),
    key(4, mix({ body: { sx: 1.06, sy: 0.96 }, shell: { rot: -6 } }, stalks(-20, -12, -16, -10)), {
      ease: 'out',
    }),
    key(8, mix({ shell: { rot: 2 } }, stalks(8, 10, 10, 6)), { ease: 'inOut' }),
    key(12, STAND),
  ],
};

const crouch: AnimClip = {
  length: 6,
  swaps: CALM,
  keys: [key(0, STAND, { ease: 'out' }), key(6, CROUCH)],
};

const SQUAT = mix(
  CROUCH,
  { shell: { y: 1.5, sx: 1.08, sy: 0.86 }, foot: { sx: 1.14 } },
  stalks(-20, 14, -10, 14, 0.62),
);

const jumpSquat: AnimClip = {
  length: 3,
  swaps: DETERMINED,
  keys: [key(0, CROUCH, { ease: 'out' }), key(3, SQUAT)],
};

/* ---------------------------------------------------------------- air */

/** Launching up: stretched tall and thin, the stalks dragged down and back by the climb. */
const STRETCH = mix(AIR, { body: { sx: 0.86, sy: 1.16 } }, stalks(-6, -8, -2, -6, 0.88));
/** The top of the arc: weightless, the body spread and nose-up, stalks floating apart, looking down. */
const APEX = mix(
  AIR,
  { body: { sx: 1.07, sy: 0.94 }, foot: { rot: -14 }, shell: { rot: -9, y: -0.2 }, neck: { rot: -2 } },
  stalks(16, 8, 28, 10, 1.08),
  look(0.05, 0.3),
);

const jump: AnimClip = {
  length: 40,
  swaps: HAPPY,
  keys: [
    key(0, STRETCH, { ease: 'out' }),
    key(10, mix(AIR, stalks(0, -6, 6, -4)), { ease: 'inOut' }),
    key(24, APEX, { ease: 'inOut', swaps: { ...HAPPY, mouth: 'grin' } }),
    key(40, mix(APEX, { body: { sx: 1, sy: 1 } }, stalks(14, 4, 22, 4, 1.1))),
  ],
};

const doubleJump: AnimClip = {
  length: 30,
  swaps: HAPPY,
  keys: [
    key(0, mix(STRETCH, { body: { rot: 0 } }), { ease: 'linear' }),
    key(2, mix(BALL, { body: { rot: 20, sx: 0.92, sy: 1.08 } }), { ease: 'linear', swaps: SPINNING }),
    key(16, mix(BALL, { body: { rot: 340 } }), { ease: 'out' }),
    key(18, mix(STRETCH, { body: { rot: 360 } }), { ease: 'out', swaps: HAPPY }),
    key(30, mix(APEX, { body: { rot: 360 } })),
  ],
};

/** Falling: nose down and stretched, stalks streaming straight up and fluttering, eyes wide on the ground. */
const FALL = mix(
  AIR,
  { body: { sx: 0.92, sy: 1.1 }, foot: { rot: 10 }, shell: { rot: 7 }, neck: { rot: 12 }, head: { rot: 6 } },
  look(0.02, 0.4),
);
const fall = wave(
  28,
  8,
  (t) =>
    add(FALL, sway(t * 2, 4, [-12, -10, 2, -6]), {
      stalkB1: { sy: 1.16 },
      stalkB2: { sy: 1.1 },
      stalkF1: { sy: 1.16 },
      stalkF2: { sy: 1.1 },
      shell: { rot: 1.5 * sin(t) },
      foot: { rot: 2 * sin(t - 0.2) },
    }),
  { swaps: WIDE },
);

const helpless = wave(
  40,
  4,
  (t) =>
    add(mix(AIR, { foot: { rot: -14 }, neck: { rot: -20 } }), sway(t, 6, [-40, -30, -34, -28]), {
      body: { rot: 6 * sin(t) },
    }),
  { swaps: DAZED },
);

const land: AnimClip = {
  length: 4,
  swaps: HAPPY,
  keys: [key(0, SQUAT, { ease: 'out' }), key(4, STAND)],
};

/* ---------------------------------------------------------------- defence */

/** Hunkered down in the shell, eyes peeking out of its mouth (the engine draws the bubble around him). */
const HIDE: Pose = mix(SHELL_DOWN, { shell: { sx: 1.03, sy: 0.97 } });
const SHRINK: Pose = mix(CROUCH, { neck: { rot: -20, sy: 0.6 } }, stalks(-30, 20, -20, 20, 0.4));

const shield: AnimClip = {
  length: 4,
  swaps: STARTLED,
  keys: [
    key(0, STAND, { ease: 'in' }),
    key(2, SHRINK, { ease: 'out' }),
    key(3, HIDE, { swaps: IN_SHELL }),
    key(4, HIDE),
  ],
};

const shieldDrop: AnimClip = {
  length: 11,
  swaps: IN_SHELL,
  keys: [key(0, HIDE, { ease: 'linear' }), key(3, SHRINK, { ease: 'out', swaps: HAPPY }), key(11, STAND)],
};

const shieldBreak: AnimClip = {
  length: 40,
  swaps: STARTLED,
  keys: [
    key(0, mix(HIDE, { shell: { y: 1.2 } }), { ease: 'out', swaps: IN_SHELL }),
    key(3, mix({ body: { sx: 0.82, sy: 1.25 } }, stalks(-6, 6, 6, 8, 1.15)), {
      ease: 'out',
      swaps: STARTLED,
    }),
    key(14, mix({ body: { rot: -10 } }, stalks(-30, 20, 20, 30)), { ease: 'inOut', swaps: DAZED }),
    key(28, mix({ body: { rot: 8 } }, stalks(20, -20, -10, -30)), { ease: 'inOut' }),
    key(40, mix({ body: { rot: -4 } }, stalks(-20, 10, 10, 20))),
  ],
};

const dizzy = wave(
  60,
  6,
  (t) =>
    add(
      { shell: { rot: 5 * sin(t) }, neck: { rot: -6 * sin(t - 0.1) }, head: { rot: 6 * sin(t - 0.2) } },
      sway(t, 14, [-6, 10, 8, 12]),
      { fx1: at(4.4, -14.2, 360 * t, [1, 1]) },
    ),
  { swaps: { ...DAZED, fx1: 'stars' } },
);

const spotDodge: AnimClip = {
  length: 26,
  swaps: STARTLED,
  keys: [
    key(0, STAND, { ease: 'in' }),
    key(2, SHRINK, { ease: 'out' }),
    key(3, mix(HIDE, { shell: { sy: 0.9, sx: 1.06 } }), { ease: 'inOut', swaps: IN_SHELL }),
    key(17, HIDE, { ease: 'out' }),
    key(19, SHRINK, { ease: 'out', swaps: HAPPY }),
    key(26, STAND),
  ],
};

/** Rolls in the shell: tucks in, the shell turns over `turns` x 360 degrees, then he pops out (`flip`: facing back). */
function roll(length: number, dir: 1 | -1, flip: boolean): AnimClip {
  const out: Pose = flip ? { body: { sx: -1 } } : {};
  return {
    length,
    swaps: STARTLED,
    keys: [
      key(0, STAND, { ease: 'in' }),
      key(2, SHRINK, { ease: 'linear' }),
      key(4, HIDE, { ease: 'linear', swaps: SPINNING }),
      key(Math.round(length * 0.65), mix(HIDE, { shell: { ...HIDE.shell, rot: 360 * dir } }), {
        ease: 'out',
      }),
      key(Math.round(length * 0.65) + 1, mix(SHRINK, out), { ease: 'out', swaps: HAPPY }),
      key(length, mix(STAND, out)),
    ],
  };
}

const airDodge: AnimClip = {
  length: 49,
  swaps: STARTLED,
  keys: [
    key(0, AIR, { ease: 'linear' }),
    key(2, mix(BALL, { body: { rot: 0 } }), { ease: 'inOut', swaps: IN_SHELL }),
    key(16, mix(BALL, { body: { rot: -25 } }), { ease: 'inOut' }),
    key(28, mix(BALL, { body: { rot: 0 } }), { ease: 'out' }),
    key(30, STRETCH, { ease: 'inOut', swaps: HAPPY }),
    key(49, AIR),
  ],
};

/* ---------------------------------------------------------------- ledge */

/**
 * Where the ledge's top corner is while hanging (rig space): the engine hangs him width / 2 + 0.5 out from the
 * corner and 0.85 x height below it. He clings to the wall with his foot like a snail on a wall, the shell on his
 * back, and peeks over the lip with both little hands on top.
 */
export const LEDGE_GRIP: [number, number] = [6.5, -11.05];
const [GX, GY] = LEDGE_GRIP;

/** The corner's rig position `frame` frames into a getup that moves `distance` past it by `moveEnd` (ledge.ts). */
function corner(frame: number, moveEnd: number, distance: number): Pt {
  const u = Math.min(1, frame / moveEnd);
  const s = u * u * (3 - 2 * u);
  return [GX - (GX + distance) * s, GY * (1 - Math.min(1, 1.6 * s))];
}

/** Clinging to the wall below the corner at (cx, cy): foot flat on the wall, head and hands over the lip. */
function cling(cx: number, cy: number, extra: Pose = {}): Pose {
  const base = mix(
    {
      body: { rot: -90, x: cx - GX + 2.05, y: cy - GY - 1.7 },
      neck: { rot: 72 },
      head: { rot: 10 },
    },
    stalks(-6, 10, 4, 10),
    extra,
  );
  return hands(base, [cx + 0.3, cy - 0.35], [cx + 1.3, cy - 0.35], 1);
}

const HANG = cling(GX, GY);

const ledgeCatch: AnimClip = {
  length: 8,
  swaps: { ...STARTLED, ...HANDS },
  keys: [
    key(0, cling(GX, GY + 1.2, { body: { rot: -70 } }), { ease: 'out' }),
    key(4, cling(GX, GY - 0.3), { ease: 'inOut', swaps: { ...HAPPY, ...HANDS } }),
    key(8, HANG),
  ],
};

const ledgeHang = wave(60, 4, (t) => add(HANG, sway(t, 4), { body: { y: 0.12 * sin(t) } }), {
  swaps: { ...HAPPY, ...HANDS },
});

/** Crawls up over the lip as the engine lifts him: the body swings from the wall onto the floor. */
function climb(
  moveEnd: number,
  distance: number,
  frames: number[],
  swaps: Record<string, string | null>,
): Key[] {
  return frames.map((f, i) => {
    const [cx, cy] = corner(f, moveEnd, distance);
    const k = Math.min(1, f / moveEnd);
    const rot = -90 * (1 - Math.min(1, k * 1.4));
    const lifted = mix(
      {
        body: { rot, x: (cx - GX + 2.05) * (1 - k) + 0, y: (cy - GY - 1.7) * (1 - k) },
        neck: { rot: 72 * (1 - k) },
      },
      stalks(-6 * (1 - k), 10 * (1 - k), 4 * (1 - k), 10 * (1 - k)),
    );
    const pose = k < 0.55 ? hands(lifted, [cx + 0.3, cy - 0.35], [cx + 1.3, cy - 0.35], 1) : lifted;
    return key(f, pose, {
      ease: 'inOut',
      ...(i === 0
        ? { swaps }
        : k >= 0.55 && f === frames.find((g) => g / moveEnd >= 0.55)
          ? { swaps: HAPPY }
          : {}),
    });
  });
}

const ledgeClimb: AnimClip = {
  length: 33,
  swaps: HAPPY,
  keys: [...climb(30, 8, [0, 6, 12, 18, 24], { ...DETERMINED, ...HANDS }), key(33, STAND)],
};

/**
 * Rolling up in the shell: the engine is still lifting him out of the hang for the first half of the roll, so the
 * ball rides the corner's height (as `climb` does) until it's on the floor, spinning from 90 to 720 degrees.
 */
const LEDGE_ROLL_SPIN = [12, 14, 16, 18, 20, 22, 24, 36].map((f, i) => {
  const u = (f - 12) / 24;
  const pose = mix(BALL, { body: { rot: 90 + 630 * (1 - (1 - u) ** 2), y: corner(f, 40, 25)[1] } });
  return key(f, pose, { ease: f === 36 ? 'out' : 'linear', ...(i === 0 ? { swaps: SPINNING } : {}) });
});

const ledgeRoll: AnimClip = {
  length: 49,
  swaps: HAPPY,
  keys: [
    ...climb(40, 25, [0, 5, 10], { ...DETERMINED, ...HANDS }),
    ...LEDGE_ROLL_SPIN,
    key(38, mix(SHRINK, { body: { rot: 720 } }), { ease: 'out', swaps: HAPPY }),
    key(49, mix(STAND, { body: { rot: 720 } })),
  ],
};

const ledgeJump: AnimClip = {
  length: 20,
  swaps: DETERMINED,
  keys: [
    key(0, HANG, { ease: 'in', swaps: { ...DETERMINED, ...HANDS } }),
    key(3, cling(GX, GY + 2, { body: { rot: -60 } }), { ease: 'out', swaps: HAPPY }),
    key(6, STRETCH, { ease: 'out' }),
    key(20, APEX),
  ],
};

const ledgeAttack: AnimClip = {
  length: 55,
  swaps: DETERMINED,
  keys: [
    ...climb(20, 8, [0, 5, 10], { ...DETERMINED, ...HANDS }),
    key(12, mix(BALL, { body: { rot: 0 } }), { ease: 'in', swaps: SPINNING }),
    key(16, mix(BALL, { body: { rot: 180 } }), { ease: 'linear', swaps: { ...SPINNING, fx1: 'sideSmear' } }),
    key(24, mix(BALL, { body: { rot: 720 }, fx1: at(2, -4.5, 0, 1.1) }), { ease: 'out' }),
    key(28, undefined, { swaps: SPINNING }),
    key(30, mix(SHRINK, { body: { rot: 720 } }), { ease: 'out', swaps: DETERMINED }),
    key(55, mix(STAND, { body: { rot: 720 } })),
  ],
};

/* ---------------------------------------------------------------- hurt */

const HIT: Pose = mix(
  { shell: { rot: -14, x: -0.4 }, foot: { rot: -5 }, neck: { rot: -22 }, head: { rot: -10 } },
  stalks(-38, -20, -30, -22),
);

const hitstun: AnimClip = {
  length: 20,
  swaps: HURT,
  keys: [
    key(0, HIT, { ease: 'out' }),
    key(8, mix(HIT, stalks(-10, 20, -6, 24)), { ease: 'inOut' }),
    key(20, mix(HIT, { shell: { rot: -8 } })),
  ],
};

/** Tumbling end over end, limp. */
const tumble = wave(
  40,
  8,
  (t) =>
    add(
      mix(HIT, { body: { rot: -360 * t } }),
      {
        foot: { rot: 14 * sin(t * 2), sx: 1 + 0.1 * sin(t * 2 + 0.25), sy: 1 - 0.08 * sin(t * 2 + 0.25) },
        neck: { rot: 18 * sin(t * 2 - 0.15) },
        head: { rot: 10 * sin(t * 2 - 0.3) },
      },
      sway(t * 2, 22),
    ),
  { swaps: HURT },
);
tumble.keys.push(key(40, mix(HIT, { body: { rot: -360 } }), { ease: 'linear' }));

/** Knocked flat: the shell tipped back on the floor, the body splayed and the stalks limp on the ground. */
const FLAT: Pose = mix(
  {
    body: { rot: -14, y: 0.6 },
    shell: { rot: -40, x: -0.8, y: 0.9 },
    neck: { rot: 50, sy: 0.8 },
    head: { rot: 30 },
  },
  stalks(60, 18, 52, 20, 0.9),
);
const down = wave(40, 4, (t) => add(FLAT, sway(t, 3), { shell: { rot: 2 * sin(t) } }), { swaps: DAZED });

const downBound: AnimClip = {
  length: 26,
  swaps: HURT,
  keys: [
    key(0, mix(FLAT, { body: { y: -0.2 } }), { ease: 'out' }),
    key(5, mix(FLAT, { body: { y: -1.8, rot: -24 } }), { ease: 'in' }),
    key(11, FLAT, { ease: 'out' }),
    key(15, mix(FLAT, { body: { y: -0.4 } }), { ease: 'in' }),
    key(19, FLAT, { ease: 'out', swaps: DAZED }),
    key(26, FLAT),
  ],
};

const getupStand: AnimClip = {
  length: 29,
  swaps: DAZED,
  keys: [
    key(0, FLAT, { ease: 'inOut' }),
    key(10, mix(CROUCH, { shell: { rot: -12 } }), { ease: 'out', swaps: CALM }),
    key(18, mix({ body: { sx: 0.95, sy: 1.06 } }, stalks(-6, 8, -4, 10)), { ease: 'inOut', swaps: HAPPY }),
    key(29, STAND),
  ],
};

/** Spins up in the shell where he lands (tech in place, tech and getup rolls). */
function shellSpin(length: number, from: Pose, turns: number): AnimClip {
  const pop = Math.round(length * 0.7);
  return {
    length,
    swaps: STARTLED,
    keys: [
      key(0, from, { ease: 'linear' }),
      key(2, HIDE, { ease: 'linear', swaps: SPINNING }),
      key(pop, mix(HIDE, { shell: { ...HIDE.shell, rot: -360 * turns } }), { ease: 'out' }),
      key(pop + 1, SHRINK, { ease: 'out', swaps: HAPPY }),
      key(length, STAND),
    ],
  };
}

const techInPlace = shellSpin(26, HIT, 1);
const techRoll = shellSpin(40, HIT, 2);
const getupRoll = shellSpin(35, FLAT, 2);

const respawn = wave(60, 4, (t) => add({ shell: { y: -0.1 * sin(t) } }, sway(t, 3)), { swaps: HAPPY });

/* ---------------------------------------------------------------- grabbed and taunt */

const grabbed = wave(20, 4, (t) => add(HIT, { body: { y: -0.5, rot: -6 + 4 * sin(t) } }, sway(t, 10)), {
  swaps: HURT,
});

/** Taunt: stands tall, waves both little hands overhead with the games' big grin, stalks bouncing. */
const TALL: Pose = mix({ body: { sx: 0.95, sy: 1.07 }, neck: { rot: -6 } }, stalks(-8, 8, 6, 10, 1.05));
const wave1 = (lift: number): Pose => hands(TALL, [1.0, -10.2 - lift], [6.8, -10.0 + lift]);

const taunt: AnimClip = {
  length: 60,
  swaps: HAPPY,
  keys: [
    key(0, STAND, { ease: 'out' }),
    key(6, wave1(0), { ease: 'inOut', swaps: { ...HAPPY, ...HANDS } }),
    key(14, wave1(1.2), { ease: 'inOut' }),
    key(22, wave1(-0.6), { ease: 'inOut' }),
    key(30, wave1(1.2), { ease: 'inOut' }),
    key(38, wave1(-0.6), { ease: 'inOut', swaps: { ...BLINK, ...HANDS } }),
    key(42, undefined, { swaps: { ...HAPPY, ...HANDS } }),
    key(48, TALL, { ease: 'inOut', swaps: HAPPY }),
    key(60, STAND),
  ],
};

void pointOf;
void rig;

/**
 * Every clip: the engine's action names and the canonical names in docs/art.md that differ from them (knockdown,
 * getUp, tech). Move clips follow in the next change.
 */
export const clips: Record<string, AnimClip> = {
  idle,
  walk,
  dash,
  run,
  runBrake,
  turn,
  crouch,
  jumpSquat,
  land,
  taunt,
  jump,
  doubleJump,
  fall,
  helpless,
  shield,
  shieldDrop,
  shieldBreak,
  dizzy,
  spotDodge,
  rollForward: roll(30, 1, true),
  rollBack: roll(30, -1, false),
  airDodge,
  ledgeCatch,
  ledgeHang,
  ledgeClimb,
  ledgeRoll,
  ledgeJump,
  ledgeAttack,
  hitstun,
  tumble,
  down,
  knockdown: down,
  downBound,
  getupStand,
  getUp: getupStand,
  techInPlace,
  tech: techInPlace,
  techRoll,
  getupRoll,
  respawn,
  grabbed,
};
