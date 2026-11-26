import type { Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { CABLE } from './parts';
import {
  AIR,
  CROUCH,
  DETERMINED,
  FIERCE,
  FIST_B,
  FIST_F,
  HANDS,
  HAPPY,
  HURT,
  IN_SHELL,
  SHELL_DOWN,
  SPINNING,
  STAND,
  add,
  at,
  hands,
  key,
  look,
  mix,
  stalks,
  type Swaps,
} from './poses';
import { BODY_Y, SHELL_X, SHELL_Y } from './rig';

/**
 * Snail Bob's moves, keyed to src/fighters/snailbob/moves.ts. Frames use Smash numbering (frame 1 is the move's
 * first frame, length = FAF - 1), and each clip's `active` windows are the move's hit windows (or its throw or
 * pummel frame), so the renderer's retiming (src/render/rig/timing.ts) keeps the strike on the hit if the frame
 * data changes. Each strike pose is held from the frame before its first active frame through its last, so the
 * part that hits (fist, shell, eyestalk, girder, slime, dust) covers every hitbox.
 */

/** Holds `pose` through a strike window with its swaps. */
function strike(
  from: number,
  to: number,
  pose: Pose,
  swaps?: Swaps,
  ease: 'linear' | 'out' = 'linear',
): Key[] {
  return [key(from, pose, { ease: 'linear', ...(swaps ? { swaps } : {}) }), key(to, pose, { ease })];
}

/** Back to the clip's own swaps and draw order. */
const done = (frame: number) => key(frame, undefined, { swaps: {}, z: {} });

/** In the shell, the shell's centre on the body pivot, so turning `body` spins it in place. */
const BALL: Pose = { shell: { x: -SHELL_X, y: BODY_Y - SHELL_Y } };
/** The ball spun by `deg` and moved to (x, y) relative to the body pivot. */
const ball = (deg: number, x = 0, y = 0, s: [number, number] = [1, 1]): Pose =>
  mix(BALL, { body: { rot: deg, x, y, sx: s[0], sy: s[1] } });

/** Leaning in to punch: neck forward, head down a little, determined. */
const LEAN: Pose = mix(
  { shell: { rot: 4, x: 0.3 }, neck: { rot: 24 }, head: { rot: -8 } },
  stalks(-10, -4, -8, -2),
);
const READY: Pose = mix(
  { shell: { rot: -4, x: -0.3 }, neck: { rot: -8 }, foot: { sx: 0.97 } },
  stalks(-6, 4, -4, 6),
);

/* ---------------------------------------------------------------- jabs */

/**
 * Whirling round to put the shell forward (jab 3, ftilt, fthrow): he bunches up facing ahead, then snaps round in
 * one cel (the next key) rather than tweening his width through a thin sliver; coming back is the same snap.
 */
const WIND_UP: Pose = mix(
  CROUCH,
  { shell: { x: -0.6, rot: 8 }, body: { sy: 0.94 } },
  stalks(14, 10, 16, 10, 0.8),
);
const COME_ROUND: Pose = mix(
  { body: { sx: 1.05, sy: 0.96 }, shell: { rot: -6 } },
  stalks(-22, -14, -18, -10),
);

const JAB = hands(mix(LEAN, { foot: { sx: 1.06, x: 0.3 } }), [4.4, -3.4], [8.3, -5.9]);
const JAB2 = hands(mix(LEAN, { neck: { rot: 30 }, foot: { sx: 1.08, x: 0.4 } }), [8.6, -5.6], [5.3, -2.6]);
const POW = (x: number, y: number, s = 1): Pose => ({ fx1: at(x, y, 12, s) });

const jab: AnimClip = {
  length: 19,
  active: [[4, 5]],
  swaps: DETERMINED,
  keys: [
    key(0, READY, { ease: 'out' }),
    key(2, hands(READY, [3.8, -3.2], [4.6, -3.0]), {
      ease: 'in',
      swaps: { ...DETERMINED, ...FIST_F, ...FIST_B },
    }),
    ...strike(3, 5, mix(JAB, POW(9.1, -6.0, 1.05)), { ...FIERCE, ...FIST_F, ...FIST_B, fx1: 'pow' }, 'out'),
    key(8, mix(JAB, POW(9.3, -6.1, 0.3)), { ease: 'inOut' }),
    key(9, undefined, { swaps: { ...DETERMINED, ...FIST_F, ...FIST_B } }),
    key(13, hands(READY, [3.8, -3.2], [4.8, -3.2]), { ease: 'inOut' }),
    done(15),
    key(19, STAND),
  ],
};

const jab2: AnimClip = {
  length: 20,
  active: [[3, 4]],
  swaps: DETERMINED,
  keys: [
    key(0, hands(READY, [3.8, -3.2], [4.8, -3.2]), {
      ease: 'in',
      swaps: { ...DETERMINED, ...FIST_F, ...FIST_B },
    }),
    ...strike(2, 4, mix(JAB2, POW(9.3, -5.9, 1.05)), { ...FIERCE, ...FIST_F, ...FIST_B, fx1: 'pow' }, 'out'),
    key(8, JAB2, { ease: 'inOut', swaps: { ...DETERMINED, ...FIST_F, ...FIST_B } }),
    done(15),
    key(20, STAND),
  ],
};

/** Third hit: the shell shove (he spins to put his shell forward). */
const SHOVE = mix(
  { body: { sx: -1, x: 4.6 }, shell: { sx: 1.12, sy: 0.96, rot: -6 } },
  stalks(-10, -6, -8, -6),
  look(-0.25, 0),
);
const jab3: AnimClip = {
  length: 33,
  active: [[5, 6]],
  swaps: DETERMINED,
  keys: [
    key(0, READY, { ease: 'out' }),
    key(3, WIND_UP, { ease: 'step' }),
    ...strike(4, 7, SHOVE, { ...FIERCE, fx2: 'speedLines' }, 'out'),
    key(14, mix(SHOVE, { body: { sx: -1, x: 3.2 } }), { ease: 'inOut', swaps: DETERMINED }),
    key(19, mix(SHOVE, { body: { sx: -0.96, x: 2.6, sy: 0.95 } }), { ease: 'step' }),
    key(20, COME_ROUND, { ease: 'out' }),
    key(33, STAND),
  ],
};

/* ---------------------------------------------------------------- tilts */

/** Shell Bump: whirls round to put the shell in front and rams with it. */
const BUMP = mix(
  { body: { sx: -1, x: 5.0, y: 0.2 }, shell: { sx: 1.16, sy: 0.95, rot: -8 }, neck: { rot: -14 } },
  stalks(-20, -10, -16, -8),
  look(-0.3, 0),
);
const ftilt: AnimClip = {
  length: 33,
  active: [[8, 10]],
  swaps: DETERMINED,
  keys: [
    key(0, STAND, { ease: 'out' }),
    key(5, WIND_UP, { ease: 'step' }),
    key(6, mix(BUMP, { body: { sx: -1.04, x: 3.2, sy: 0.96 } }), {
      ease: 'out',
      swaps: { ...FIERCE, fx2: 'speedLines' },
    }),
    ...strike(7, 10, BUMP, { ...FIERCE, fx2: 'speedLines' }, 'out'),
    key(16, mix(BUMP, { body: { sx: -1, x: 3.6 } }), { ease: 'inOut', swaps: DETERMINED }),
    key(22, mix(BUMP, { body: { sx: -0.96, x: 2.4, sy: 0.95 } }), { ease: 'step' }),
    key(23, COME_ROUND, { ease: 'out' }),
    key(33, STAND),
  ],
};

/** Antenna Whip: the eyestalks stretch and whip overhead from front to back. */
const WHIP = (lean: number): Pose =>
  mix(
    { neck: { rot: -2 }, head: { rot: -2 }, shell: { rot: -3 } },
    { stalkB1: { rot: -6 + lean, sy: 1.62 }, stalkB2: { rot: -4 + lean, sy: 1.62 } },
    { stalkF1: { rot: 6 + lean * 0.5, sy: 1.05 }, stalkF2: { rot: 4 + lean * 0.5, sy: 1.05 } },
    { fx3: at(4.0, -6.0, 0, 1.25) },
  );
const utilt: AnimClip = {
  length: 29,
  active: [[6, 11]],
  swaps: DETERMINED,
  keys: [
    key(0, STAND, { ease: 'out' }),
    key(4, mix(CROUCH, stalks(40, 30, 44, 30, 0.8)), { ease: 'in' }),
    ...strike(5, 11, WHIP(0), { ...FIERCE, smearBack: 'whipSmear' }),
    key(15, mix(WHIP(-30), { stalkF1: { rot: -24, sy: 1.1 } }), { ease: 'inOut', swaps: DETERMINED }),
    key(22, stalks(-8, 6, -4, 8), { ease: 'inOut' }),
    key(29, STAND),
  ],
};

/** Slime Trail: slithers low, chin to the floor, and a wave of slime surges out ahead. */
const SLITHER = mix(
  {
    foot: { sx: 1.16, x: 0.9 },
    shell: { y: 1.0, rot: 8, x: 0.6 },
    neck: { rot: 62, sy: 0.9 },
    head: { rot: -50 },
  },
  stalks(-40, 16, -34, 16, 0.8),
);
const dtilt: AnimClip = {
  length: 24,
  active: [[7, 9]],
  swaps: DETERMINED,
  keys: [
    key(0, STAND, { ease: 'out' }),
    key(4, mix(CROUCH, { foot: { sx: 0.95, x: -0.3 } }), { ease: 'in' }),
    key(5, mix(SLITHER, { fx3: at(4.6, 0, 0, [0.5, 0.6]) }), {
      ease: 'out',
      swaps: { ...FIERCE, fx3: 'slimeWave' },
    }),
    ...strike(6, 9, mix(SLITHER, { fx3: at(4.4, 0, 0, [1.05, 1.0]) })),
    key(13, mix(SLITHER, { fx3: at(6.5, 0, 0, [0.9, 0.5]) }), {
      ease: 'inOut',
      swaps: { ...DETERMINED, fx3: 'slimePuddle' },
    }),
    key(16, undefined, { swaps: { ...DETERMINED, fx3: 'slimePuddle' } }),
    key(20, mix(CROUCH, { fx3: at(7.5, 0, 0, [0.6, 0.6]) }), { ease: 'inOut' }),
    done(22),
    key(24, STAND),
  ],
};

/* ---------------------------------------------------------------- dash attack and smashes */

const slide = (x: number, deg: number, dust = 0.7): Pose =>
  mix(SHELL_DOWN, { shell: { x: 1.0 + x, rot: deg }, fx4: at(x - 5.4, 0, 0, dust) });
const dashAttack: AnimClip = {
  length: 43,
  active: [
    [9, 12],
    [13, 24],
  ],
  swaps: DETERMINED,
  keys: [
    key(0, mix(CROUCH, { shell: { rot: 10 } }), { ease: 'in' }),
    key(
      5,
      mix(CROUCH, { foot: { sx: 1.1, x: 0.8 }, neck: { rot: 30, sy: 0.6 } }, stalks(-30, 20, -20, 20, 0.5)),
      { ease: 'linear' },
    ),
    key(7, slide(4.2, 10, 0.5), { ease: 'linear', swaps: { ...SPINNING, fxBack: 'dust' } }),
    key(12, slide(5.2, 30, 0.8), { ease: 'linear' }),
    key(24, slide(5.4, 70, 0.6), { ease: 'out' }),
    key(30, slide(5.0, 80, 0.3), { ease: 'inOut', swaps: { ...IN_SHELL, fxBack: 'dust' } }),
    key(34, mix(CROUCH, { foot: { x: 1.2 } }), { ease: 'inOut', swaps: HAPPY }),
    key(43, STAND),
  ],
};

/** Lever Punch: yanks a construction lever and a crane swings a girder down in front of him. */
const PIVOT = [11.5, -CABLE - 7] as const;
/** The hung girder swung `deg` (positive swings it towards Bob) and hoisted `lift` back up by the crane. */
const girderAt = (deg: number, lift = 0): Pose => ({
  fx4: at(PIVOT[0], PIVOT[1] - lift, deg),
  fx3: at(PIVOT[0], PIVOT[1] - lift, deg),
});
const LEVER_UP: Pose = { fx2: at(7.9, 0), fx1: at(7.9, -1.3, 8) };
const LEVER_DOWN: Pose = { fx2: at(7.9, 0), fx1: at(7.9, -1.3, -48) };
/** Holding the lever's knob (3.4 up the handle, its pivot 1.3 off the ground). */
const knob = (deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180;
  return [7.9 + Math.sin(r) * 3.4, -1.3 - Math.cos(r) * 3.4];
};
const GRIP_UP = hands(
  mix(LEAN, { neck: { rot: 18 } }, LEVER_UP),
  [knob(8)[0] - 0.3, knob(8)[1] + 0.2],
  knob(8),
);
const LEVER_SWAPS = { ...HANDS, fx1: 'leverHandle', fx2: 'leverBase' };
/** Pulling the lever down, hands on its knob, with `extra` layered on his body. */
const yank = (...extra: Pose[]): Pose =>
  hands(
    mix(READY, { neck: { rot: -6 }, shell: { rot: -10, x: -0.6 } }, ...extra, LEVER_DOWN),
    [knob(-48)[0] - 0.3, knob(-48)[1] + 0.2],
    knob(-48),
  );
/** The girder lands: he's jolted back off his foot, stalks flung back, shaking `shake` to and fro. */
const RECOIL = (shake: number): Pose =>
  yank(
    {
      body: { x: -0.5 + shake, sx: 0.96, sy: 1.05 },
      shell: { rot: -18, x: -1.0 },
      neck: { rot: -18 },
      head: { rot: -8 },
    },
    stalks(-30, -22, -26, -20, 1.08),
  );

const fsmash: AnimClip = {
  length: 55,
  active: [[16, 18]],
  swaps: DETERMINED,
  keys: [
    key(0, STAND, { ease: 'out', swaps: { ...DETERMINED, fx2: 'leverBase' } }),
    key(1, mix(STAND, LEVER_UP, { fx2: at(7.9, 0, 0, [1, 0.2]) }), { ease: 'out' }),
    key(5, GRIP_UP, { ease: 'inOut', swaps: { ...DETERMINED, ...LEVER_SWAPS } }),
    key(11, mix(GRIP_UP, { neck: { rot: 22 }, body: { sx: 0.95, sy: 1.08 } }, stalks(4, 8, 8, 10, 1.06)), {
      ease: 'in',
    }),
    key(
      13,
      mix(yank({ body: { sx: 1.08, sy: 0.88 }, shell: { rot: -14, x: -0.8, y: 0.4 } }), girderAt(-30)),
      {
        ease: 'linear',
        swaps: { ...FIERCE, ...LEVER_SWAPS, fxBack: 'girderHung', smearBack: 'girderSmear' },
      },
    ),
    key(15, mix(RECOIL(0.25), girderAt(-1)), { ease: 'step' }),
    key(16, mix(RECOIL(-0.25), girderAt(-1)), { ease: 'step' }),
    key(17, mix(RECOIL(0.2), girderAt(-1)), { ease: 'step' }),
    key(18, mix(RECOIL(-0.15), girderAt(-1)), { ease: 'out' }),
    key(22, mix(yank({ shell: { rot: -6, x: -0.3 } }, stalks(14, 12, 18, 14)), girderAt(4)), {
      ease: 'inOut',
      swaps: { ...DETERMINED, ...LEVER_SWAPS, fxBack: 'girderHung' },
    }),
    key(30, mix(yank({}, stalks(-8, -6, -4, -6)), girderAt(2, 4)), { ease: 'in' }),
    key(38, mix(READY, LEVER_DOWN, girderAt(0, 18)), {
      ease: 'inOut',
      swaps: { ...DETERMINED, fx1: 'leverHandle', fx2: 'leverBase', fxBack: 'girderHung' },
    }),
    key(
      44,
      mix(STAND, LEVER_DOWN, girderAt(0, 36), { fx2: at(7.9, 0, 0, [1, 0.3]), fx1: at(7.9, -0.4, -48, 0.3) }),
      {
        ease: 'inOut',
        swaps: { ...HAPPY, fx1: 'leverHandle', fx2: 'leverBase' },
      },
    ),
    done(46),
    key(55, STAND),
  ],
};

/** Shell Pop: ducks into the shell and pops it straight up off the floor. */
const POP = mix(SHELL_DOWN, {
  shell: { x: 1.3, y: -4.5, sx: 0.94, sy: 1.12 },
  fx1: at(0, -7.2, 180, [1, 1.1]),
  fx2: at(0, 0, 0, 0.8),
});
const usmash: AnimClip = {
  length: 49,
  active: [[12, 15]],
  swaps: DETERMINED,
  keys: [
    key(0, STAND, { ease: 'out' }),
    key(4, mix(CROUCH, stalks(-30, 20, -20, 20, 0.5)), { ease: 'in' }),
    key(6, mix(SHELL_DOWN, { shell: { x: 1.3, y: 2.6, sx: 1.12, sy: 0.88 } }), {
      ease: 'inOut',
      swaps: IN_SHELL,
    }),
    key(10, mix(SHELL_DOWN, { shell: { x: 1.3, y: 2.9, sx: 1.18, sy: 0.84 } }), { ease: 'linear' }),
    ...strike(11, 15, POP, { ...IN_SHELL, fx1: 'fallLines', fx2: 'dust' }, 'out'),
    key(21, mix(SHELL_DOWN, { shell: { x: 1.3, y: -2.0, rot: 8 } }), { ease: 'in', swaps: IN_SHELL }),
    key(28, mix(SHELL_DOWN, { shell: { x: 1.3, y: 0.4, sx: 1.12, sy: 0.88 } }), { ease: 'out' }),
    key(34, CROUCH, { ease: 'inOut', swaps: HAPPY }),
    key(49, STAND),
  ],
};

/** Spinning in the shell on the spot, a smear sweeping out to one side (`side` 1 ahead, -1 behind). */
const spinAt = (deg: number, side: 1 | -1 | 0, reach = 4.6): Pose =>
  mix(
    SHELL_DOWN,
    { shell: { x: 1.0 + 0.6 * side, rot: deg } },
    side ? { fx1: at(reach * side - 0.3 + 0.6 * side, -4.4, side > 0 ? 0 : 180) } : {},
  );

const dsmash: AnimClip = {
  length: 47,
  active: [
    [10, 11],
    [14, 15],
  ],
  swaps: DETERMINED,
  keys: [
    key(0, STAND, { ease: 'out' }),
    key(3, mix(CROUCH, stalks(-30, 20, -20, 20, 0.5)), { ease: 'in' }),
    key(5, spinAt(-40, 0), { ease: 'linear', swaps: SPINNING }),
    key(8, spinAt(80, 0), { ease: 'linear' }),
    ...strike(9, 11, spinAt(200, 1), { ...SPINNING, fx1: 'sideSmear' }),
    key(13, spinAt(400, -1), { ease: 'linear', swaps: { ...SPINNING, fx1: 'sideSmear' } }),
    key(15, spinAt(520, -1), { ease: 'out' }),
    key(16, undefined, { swaps: SPINNING }),
    key(28, spinAt(720, 0), { ease: 'out', swaps: IN_SHELL }),
    key(34, CROUCH, { ease: 'inOut', swaps: HAPPY }),
    key(47, STAND),
  ],
};

/* ---------------------------------------------------------------- getup attack */

const FLAT_START: Pose = mix(
  {
    body: { rot: -14, y: 0.6 },
    shell: { rot: -40, x: -0.8, y: 0.9 },
    neck: { rot: 50, sy: 0.8 },
    head: { rot: 30 },
  },
  stalks(60, 18, 52, 20, 0.9),
);
const getupAttack: AnimClip = {
  length: 45,
  active: [
    [17, 18],
    [25, 26],
  ],
  swaps: DETERMINED,
  keys: [
    key(0, FLAT_START, { ease: 'inOut', swaps: HURT }),
    key(6, spinAt(-60, 0), { ease: 'linear', swaps: SPINNING }),
    key(15, spinAt(120, 0), { ease: 'linear' }),
    ...strike(16, 18, spinAt(200, 1), { ...SPINNING, fx1: 'sideSmear' }),
    key(19, undefined, { swaps: SPINNING }),
    key(24, spinAt(400, -1), { ease: 'linear', swaps: { ...SPINNING, fx1: 'sideSmear' } }),
    key(26, spinAt(520, -1), { ease: 'out' }),
    key(27, undefined, { swaps: SPINNING }),
    key(34, spinAt(720, 0), { ease: 'out', swaps: IN_SHELL }),
    key(38, CROUCH, { ease: 'inOut', swaps: HAPPY }),
    key(45, STAND),
  ],
};

/* ---------------------------------------------------------------- aerials */

const nair: AnimClip = {
  length: 41,
  active: [
    [6, 9],
    [10, 24],
  ],
  swaps: DETERMINED,
  keys: [
    key(0, AIR, { ease: 'in' }),
    key(3, mix(AIR, { neck: { rot: -20, sy: 0.6 } }, stalks(-30, 20, -20, 20, 0.5)), { ease: 'linear' }),
    key(5, mix(ball(0), { fx1: at(0, -4.5, 0, 1.05) }), {
      ease: 'linear',
      swaps: { ...SPINNING, fx1: 'spinRing' },
    }),
    key(9, mix(ball(240), { fx1: at(0, -4.5, 120, 1.05) }), { ease: 'linear' }),
    key(24, mix(ball(960), { fx1: at(0, -4.5, 480, 1.0) }), { ease: 'out' }),
    key(26, undefined, { swaps: SPINNING }),
    key(32, ball(1080), { ease: 'out', swaps: IN_SHELL }),
    key(34, mix(AIR, { body: { rot: 1080 } }), { ease: 'inOut', swaps: HAPPY }),
    key(41, mix(AIR, { body: { rot: 1080 } })),
  ],
};

/** Shell Punch: tucked behind the shell, he shoots a fist out of it. */
const FAIR = hands(mix(AIR, LEAN, { foot: { rot: -14 }, neck: { rot: 34 } }), [5.6, -6.9], [9.4, -6.0]);
const fair: AnimClip = {
  length: 39,
  active: [[10, 12]],
  swaps: DETERMINED,
  keys: [
    key(0, AIR, { ease: 'out' }),
    key(6, hands(mix(AIR, READY, { neck: { rot: -14 } }), [2.8, -4.0], [3.4, -4.2]), {
      ease: 'in',
      swaps: { ...DETERMINED, ...FIST_F, ...FIST_B },
    }),
    ...strike(9, 12, mix(FAIR, POW(10.2, -6.1, 1.1)), { ...FIERCE, ...FIST_F, ...FIST_B, fx1: 'pow' }, 'out'),
    key(16, mix(FAIR, POW(10.4, -6.2, 0.3)), {
      ease: 'inOut',
      swaps: { ...DETERMINED, ...FIST_F, ...FIST_B },
    }),
    done(22),
    key(39, AIR),
  ],
};

/** Shell Bash: swings his shell back like a wrecking ball. */
const BASH = mix(
  AIR,
  { body: { x: -1.2, rot: -10 }, shell: { x: -3.2, rot: -18, sx: 1.1, sy: 1.05 }, neck: { rot: 12 } },
  stalks(14, 10, 18, 12),
  look(-0.3, 0),
);
const bair: AnimClip = {
  length: 35,
  active: [
    [9, 11],
    [12, 16],
  ],
  swaps: DETERMINED,
  keys: [
    key(0, AIR, { ease: 'out' }),
    key(6, mix(AIR, { body: { rot: 8 }, shell: { x: 0.8, rot: 14 } }, look(-0.3, 0)), { ease: 'in' }),
    ...strike(8, 11, mix(BASH, { fx1: at(-5.2, -5.6, 180, 0.9) }), { ...FIERCE, fx1: 'sideSmear' }),
    key(12, BASH, { ease: 'linear', swaps: FIERCE }),
    key(16, mix(BASH, { shell: { x: -2.6, rot: -12 } }), { ease: 'out' }),
    done(18),
    key(35, AIR),
  ],
};

/** Eyestalk Flick: both stalks stretch and flick straight up overhead. */
const FLICK = (lean: number): Pose =>
  mix(
    AIR,
    { neck: { rot: -2 }, head: { rot: 0 }, foot: { rot: -6 } },
    { stalkB1: { rot: -3 + lean, sy: 1.76 }, stalkB2: { rot: -7 + lean, sy: 1.76 } },
    { stalkF1: { rot: 3.7 + lean, sy: 1.14 }, stalkF2: { rot: -6 + lean, sy: 1.14 } },
    { fx3: at(3.4, -8.0, 10, 1.2) },
  );
const uair: AnimClip = {
  length: 31,
  active: [[6, 10]],
  swaps: DETERMINED,
  keys: [
    key(0, AIR, { ease: 'out' }),
    key(4, mix(AIR, stalks(36, 26, 40, 26, 0.85)), { ease: 'in' }),
    ...strike(5, 10, FLICK(0), { ...FIERCE, smearBack: 'whipSmear' }),
    key(14, FLICK(-26), { ease: 'inOut', swaps: DETERMINED }),
    key(20, mix(AIR, stalks(-10, 10, -6, 12)), { ease: 'inOut' }),
    key(31, AIR),
  ],
};

/** Shell Plunge: curls up and flips dome-down, hangs, then plunges with speed lines. */
const POUND: Pose = mix(SHELL_DOWN, { shell: { x: 1.3, y: 1.4, rot: 180 }, fx1: at(0, -5.4) });
const dair: AnimClip = {
  length: 49,
  active: [
    [16, 20],
    [21, 45],
  ],
  swaps: DETERMINED,
  keys: [
    key(0, AIR, { ease: 'out' }),
    key(4, mix(AIR, { neck: { rot: -20, sy: 0.6 } }, stalks(-30, 20, -20, 20, 0.5)), { ease: 'in' }),
    key(6, mix(SHELL_DOWN, { shell: { x: 1.3, y: -1.0, rot: 30 } }), { ease: 'inOut', swaps: SPINNING }),
    key(12, mix(SHELL_DOWN, { shell: { x: 1.3, y: 0.4, rot: 180, sx: 0.96, sy: 1.04 } }), {
      ease: 'in',
      swaps: IN_SHELL,
    }),
    key(15, POUND, { ease: 'linear', swaps: { ...IN_SHELL, fx1: 'fallLines' } }),
    key(20, mix(POUND, { shell: { x: 1.3, y: 1.4, rot: 180, sx: 0.94, sy: 1.08 } }), { ease: 'linear' }),
    key(49, mix(POUND, { shell: { x: 1.3, y: 1.4, rot: 180, sx: 0.94, sy: 1.08 } })),
  ],
};

/** The plunge's landing: the shell slams down, a shockwave and dust burst out both sides. */
const SLAM: Pose = mix(SHELL_DOWN, {
  shell: { x: 1.3, y: 2.6, rot: 180, sx: 1.2, sy: 0.82 },
  fx1: at(7.6, 0, 0, [1.25, 1.15]),
  fx2: at(-7.6, 0, 0, [-1.25, 1.15]),
  fx3: at(0, 0, 0, [1.7, 1.2]),
});
const dairLand: AnimClip = {
  length: 29,
  active: [[1, 3]],
  swaps: HAPPY,
  keys: [
    ...strike(0, 3, SLAM, { ...IN_SHELL, fx1: 'dust', fx2: 'dust', smearBack: 'shockwave' }, 'out'),
    key(
      8,
      mix(SLAM, {
        shell: { x: 1.3, y: 1.6, rot: 180, sx: 0.95, sy: 1.05 },
        fx1: at(9.5, 0, 0, 0.6),
        fx2: at(-9.5, 0, 0, [-0.6, 0.6]),
        fx3: at(0, 0, 0, [2.4, 0.6]),
      }),
      { ease: 'inOut' },
    ),
    key(10, undefined, { swaps: IN_SHELL }),
    key(16, mix(SHELL_DOWN, { shell: { x: 1.3, y: 0.6, rot: 360 } }), { ease: 'out' }),
    key(
      17,
      mix(CROUCH, { shell: { rot: 360 }, neck: { rot: -20, sy: 0.6 } }, stalks(-30, 20, -20, 20, 0.4)),
      {
        ease: 'out',
        swaps: HAPPY,
      },
    ),
    key(21, mix(CROUCH, { body: { sx: 1.05, sy: 0.92 }, shell: { rot: 360 } }), { ease: 'inOut' }),
    key(29, mix(STAND, { shell: { rot: 360 } })),
  ],
};

/* ---------------------------------------------------------------- grabs and throws */

const REACH = (x: number): Pose =>
  hands(mix(LEAN, { foot: { sx: 1.08, x: 0.5 }, neck: { rot: 28 } }), [x - 0.9, -5.6], [x, -6.0]);
const HOLD: Pose = hands(mix(LEAN, { neck: { rot: 16 } }), [5.9, -5.4], [6.6, -6.0]);

const grab: AnimClip = {
  length: 39,
  active: [[9, 10]],
  swaps: DETERMINED,
  keys: [
    key(0, READY, { ease: 'out', swaps: { ...DETERMINED, ...HANDS } }),
    key(6, hands(READY, [3.6, -3.2], [4.2, -3.4]), { ease: 'in' }),
    ...strike(8, 10, REACH(7.6), { ...FIERCE, ...HANDS }, 'out'),
    key(16, REACH(6.4), { ease: 'inOut', swaps: { ...DETERMINED, ...HANDS } }),
    key(24, hands(READY, [3.6, -3.2], [4.2, -3.4]), { ease: 'inOut' }),
    key(30, undefined, { swaps: DETERMINED }),
    key(39, STAND),
  ],
};

const dashGrab: AnimClip = {
  length: 47,
  active: [[11, 12]],
  swaps: DETERMINED,
  keys: [
    key(0, mix(CROUCH, { shell: { rot: 8 } }), { ease: 'out', swaps: { ...DETERMINED, ...HANDS } }),
    key(7, hands(mix(READY, { foot: { sx: 1.1 } }), [3.6, -3.2], [4.2, -3.4]), { ease: 'in' }),
    ...strike(
      10,
      12,
      mix(REACH(8.6), { foot: { sx: 1.16, x: 1.0 }, fx4: at(-6.8, 0, 0, 0.5) }),
      { ...FIERCE, ...HANDS, fxBack: 'dust' },
      'out',
    ),
    key(20, REACH(6.8), { ease: 'inOut', swaps: { ...DETERMINED, ...HANDS } }),
    key(30, hands(READY, [3.6, -3.2], [4.2, -3.4]), { ease: 'inOut' }),
    key(36, undefined, { swaps: DETERMINED }),
    key(47, STAND),
  ],
};

/** The engine turns him round on frame 1, so he starts mirrored and swings round into the grab. */
const pivotGrab: AnimClip = {
  length: 43,
  active: [[12, 13]],
  swaps: DETERMINED,
  keys: [
    key(0, mix(READY, { body: { sx: -1 } }), { ease: 'out', swaps: { ...DETERMINED, ...HANDS } }),
    key(5, mix(WIND_UP, { body: { sx: -1, sy: 0.94 } }), { ease: 'step' }),
    key(6, mix(READY, COME_ROUND), { ease: 'out' }),
    key(8, READY, { ease: 'out' }),
    ...strike(11, 13, REACH(9.2), { ...FIERCE, ...HANDS }, 'out'),
    key(20, REACH(7.0), { ease: 'inOut', swaps: { ...DETERMINED, ...HANDS } }),
    key(32, hands(READY, [3.6, -3.2], [4.2, -3.4]), { ease: 'inOut' }),
    key(36, undefined, { swaps: DETERMINED }),
    key(43, STAND),
  ],
};

const grabHold: AnimClip = {
  length: 30,
  loop: true,
  swaps: { ...DETERMINED, ...HANDS },
  keys: [key(0, HOLD), key(15, add(HOLD, { shell: { y: 0.1, rot: 1 } }, stalks(3, 4, 3, 4)))],
};

/** Slime: squeezes, and slime squelches over the one he holds. */
const pummel: AnimClip = {
  length: 6,
  active: [[1, 1]],
  swaps: { ...FIERCE, ...HANDS, fx3: 'slimeSplat' },
  keys: [
    key(
      0,
      mix(hands(mix(LEAN, { neck: { rot: 20 } }), [6.6, -5.2], [6.9, -6.4]), { fx3: at(7.2, -6.2, 0, 1.2) }),
      { ease: 'out' },
    ),
    key(3, mix(HOLD, { fx3: at(7.0, -6.0, 10, 0.7) }), { ease: 'inOut' }),
    key(5, undefined, { swaps: { ...DETERMINED, ...HANDS } }),
    key(6, HOLD),
  ],
};

/** Shell Shove: whirls round and shoves them off with the shell. */
const fthrow: AnimClip = {
  length: 33,
  active: [[14, 14]],
  swaps: DETERMINED,
  keys: [
    key(0, HOLD, { ease: 'out', swaps: { ...DETERMINED, ...HANDS } }),
    key(6, mix(HOLD, { shell: { rot: 8 } }), { ease: 'in' }),
    key(10, WIND_UP, { ease: 'step', swaps: DETERMINED }),
    key(11, mix(BUMP, { body: { sx: -1.04, x: 2.6, sy: 0.96 } }), { ease: 'out' }),
    ...strike(13, 15, mix(BUMP, { body: { sx: -1, x: 3.4 } }), { ...FIERCE, fx2: 'speedLines' }, 'out'),
    key(20, mix(BUMP, { body: { sx: -1, x: 2.6 } }), { ease: 'inOut', swaps: DETERMINED }),
    key(24, mix(BUMP, { body: { sx: -0.96, x: 1.8, sy: 0.95 } }), { ease: 'step' }),
    key(25, COME_ROUND, { ease: 'out' }),
    key(33, STAND),
  ],
};

/** Roll Over: tucks in and rolls back over them, flinging them behind. */
const bthrow: AnimClip = {
  length: 45,
  active: [[24, 24]],
  swaps: DETERMINED,
  keys: [
    key(0, HOLD, { ease: 'out', swaps: { ...DETERMINED, ...HANDS } }),
    key(8, mix(hands(mix(READY, { neck: { rot: -10 } }), [5.0, -6.6], [5.6, -7.2])), { ease: 'in' }),
    key(12, ball(0, 1.0, -0.6), { ease: 'linear', swaps: SPINNING }),
    key(18, ball(-160, 3.0, -6.5), { ease: 'linear' }),
    key(24, mix(ball(-320, 1.0, -2.0), { fx1: at(-4.0, -6.0, 180, 1) }), {
      ease: 'out',
      swaps: { ...SPINNING, fx1: 'sideSmear' },
    }),
    key(28, ball(-360, 0, 0), { ease: 'out', swaps: IN_SHELL }),
    key(32, mix(CROUCH, { body: { rot: -360 } }), { ease: 'inOut', swaps: HAPPY }),
    key(45, mix(STAND, { body: { rot: -360 } })),
  ],
};

/** Crane Magnet: calls down a crane magnet that hauls them up and lets go. */
const magnetAt = (y: number, x = 6.8): Pose => ({ fx1: at(x, y) });
const POINT_UP = hands(mix(READY, { neck: { rot: -12 } }), [3.6, -3.4], [6.0, -8.2]);
const uthrow: AnimClip = {
  length: 51,
  active: [[30, 30]],
  swaps: DETERMINED,
  keys: [
    key(0, mix(HOLD, magnetAt(-40)), { ease: 'out', swaps: { ...DETERMINED, ...HANDS, fx1: 'magnet' } }),
    key(8, mix(POINT_UP, magnetAt(-32), look(0.1, -0.35)), {
      ease: 'inOut',
      swaps: { ...HAPPY, ...FIST_B, ...HANDS, fx1: 'magnet' },
    }),
    key(18, mix(POINT_UP, magnetAt(-15.5), look(0.1, -0.35)), { ease: 'out' }),
    key(26, mix(POINT_UP, magnetAt(-17.5), look(0.1, -0.35)), { ease: 'in' }),
    key(30, mix(POINT_UP, magnetAt(-24), look(0.1, -0.4)), { ease: 'out' }),
    key(40, mix(READY, magnetAt(-42)), { ease: 'inOut', swaps: { ...HAPPY, fx1: 'magnet' } }),
    done(41),
    key(51, STAND),
  ],
};

/** Shell Sit: hops up in the shell and sits on them shell-first. */
const dthrow: AnimClip = {
  length: 39,
  active: [[20, 20]],
  swaps: DETERMINED,
  keys: [
    key(0, HOLD, { ease: 'out', swaps: { ...DETERMINED, ...HANDS } }),
    key(6, mix(CROUCH, stalks(-30, 20, -20, 20, 0.5)), { ease: 'in', swaps: DETERMINED }),
    key(8, ball(0, 0.5, -1.5), { ease: 'out', swaps: IN_SHELL }),
    key(14, ball(20, 5.0, -9.5), { ease: 'in' }),
    key(19, ball(0, 6.6, -5.0, [1.12, 0.9]), { ease: 'linear' }),
    key(21, ball(0, 6.6, -4.6, [1.2, 0.84]), { ease: 'out' }),
    key(27, ball(-10, 3.0, -6.0), { ease: 'in' }),
    key(31, mix(CROUCH), { ease: 'inOut', swaps: HAPPY }),
    key(39, STAND),
  ],
};

export const attacks: Record<string, AnimClip> = {
  jab,
  jab2,
  jab3,
  ftilt,
  utilt,
  dtilt,
  dashAttack,
  fsmash,
  usmash,
  dsmash,
  getupAttack,
  nair,
  fair,
  bair,
  uair,
  dair,
  dairLand,
  grab,
  dashGrab,
  pivotGrab,
  grabHold,
  pummel,
  fthrow,
  bthrow,
  uthrow,
  dthrow,
};

void HURT;
