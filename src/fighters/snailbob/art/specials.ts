import type { Pose } from '../../../render/rig/author';
import { flattenPath } from '../../../render/rig/geometry';
import type { AnimClip, Key } from '../../../render/rig/types';
import { lipHole, shell } from './parts';
import {
  AIR,
  CROUCH,
  DETERMINED,
  FIST_F,
  HAPPY,
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
} from './poses';
import { BODY_Y, SHELL_X, SHELL_Y, rig } from './rig';

/**
 * Snail Bob's specials, keyed to src/fighters/snailbob/moves.ts like attacks.ts (frame 1 is the move's first frame,
 * length = FAF - 1).
 */

/** The booster and its exhaust, which every Rocket Hover key shows. */
const ROCKET_ON = { rocket: 'rocket', flame: 'flame' };
const LIT = { ...WIDE, mouth: 'grin', ...ROCKET_ON };

/** Bracing for the blast in midair: squashed, stalks bunched forward, the booster popping out behind the shell. */
const BRACE: Pose = mix(
  AIR,
  { body: { sx: 1.08, sy: 0.9 }, shell: { rot: 4, y: 0.4 }, neck: { rot: 10, sy: 0.9 }, head: { y: 0.3 } },
  stalks(10, 8, 14, 8, 0.85),
);
/** The blast: stretched tall, the stalks dragged down a little by the climb, the flame at its longest. */
const BLAST: Pose = mix(
  AIR,
  { body: { sx: 0.9, sy: 1.12 }, foot: { rot: -4 }, shell: { rot: -3 }, neck: { rot: 4 } },
  stalks(-8, -8, -4, -6, 0.9),
  look(0.1, -0.35),
  { flame: { sy: 1.3, sx: 1.1 } },
);
/** Riding the thrust: upright, the stalks trailing a little behind, looking up and ahead. */
const THRUST: Pose = mix(
  AIR,
  {
    body: { sx: 0.96, sy: 1.04 },
    foot: { rot: -4 },
    shell: { rot: -3 },
    neck: { rot: 2 },
    head: { rot: 0 },
  },
  stalks(-10, -6, -6, -4, 0.95),
  look(0.15, -0.3),
);

/**
 * Rocket Hover: he braces, a booster pops out behind his shell and fires, and he rides the flame up. The hover
 * outlasts the clip (it burns until the fuel or Special runs out), so the clip ends on the steady thrust pose,
 * and the flame symbol flickers on the match clock while that pose holds. A smoke puff marks the ignition.
 */
const upB: AnimClip = {
  length: 24,
  swaps: ROCKET_ON,
  keys: [
    key(0, mix(BRACE, { rocket: { sx: 0.4, sy: 0.4 }, flame: { sy: 0.2 } }), {
      ease: 'out',
      swaps: { ...DETERMINED, rocket: 'rocket', flame: null },
    }),
    key(2, mix(BRACE, { rocket: { sx: 1.08, sy: 1.08 }, flame: { sy: 0.3 }, fx4: at(-6.4, -0.8, 0, 0.5) }), {
      ease: 'out',
      swaps: { ...DETERMINED, ...ROCKET_ON, fxBack: 'dust' },
    }),
    key(5, mix(BLAST, { fx4: at(-6.6, 0.6, 0, 1.0) }), {
      ease: 'inOut',
      swaps: { ...LIT, fxBack: 'dust' },
    }),
    key(10, mix(add(THRUST, { body: { sy: 1.04 } }), { fx4: at(-6.8, 2.2, 0, [1.3, 0.8]) }), {
      ease: 'inOut',
    }),
    key(11, undefined, { swaps: LIT }),
    key(17, add(THRUST, { shell: { rot: 1.5 }, foot: { rot: 1.5 } }, stalks(-3, -3, -3, -3)), {
      ease: 'inOut',
    }),
    key(24, THRUST),
  ],
};

/* ---------------------------------------------------------------- Shell Spin (side special) */

/** In the shell, the shell's centre on the body pivot, so turning `body` spins it in place. */
const BALL: Pose = { shell: { x: -SHELL_X, y: BODY_Y - SHELL_Y } };
/** The shell's outline and its mouth, in shell space: what touches the floor as the ball turns. */
const RIM = [...shell, ...lipHole].flatMap((s) => flattenPath(s.d, 4)).flat();

/**
 * The ball turned `deg` clockwise and scaled (sx, sy), lifted or lowered so the lowest point of its rim sits on
 * the floor: the shell is no circle, so rolling it on a fixed pivot would sink its corners into the stage.
 */
function rolled(deg: number, sx = 1, sy = 1): Pose {
  const r = (deg * Math.PI) / 180;
  let low = -Infinity;
  for (let i = 0; i < RIM.length; i += 2)
    low = Math.max(low, sx * RIM[i]! * Math.sin(r) + sy * RIM[i + 1]! * Math.cos(r));
  const y = -BODY_Y - low;
  return mix(BALL, { body: { rot: deg, sx, sy, y } });
}

/** Frames of src/fighters/snailbob/moves.ts: SPIN_REV_FRAME (held while Special is held) and SPIN_ROLL. */
const REV = 11;
const ROLL: [number, number] = [12, 44];
/** The roll's turn: from the rev's upright shell through three more turns, ending upright again. */
const ROLL_TURNS = 3;
const ROLL_END = 360 * (1 + ROLL_TURNS);
/** The whirl (fx1) centred on the ball, whose centre is at rig height `y`. */
const ringAt = (y: number): Pose => ({ fx1: at(0, y, 0, 1.0) });
const SPIN_FX = { ...SPINNING, fx1: 'revRing' };

/**
 * Shell Spin: he ducks into the shell, peeks out, then revs it on the spot like a wheel (the spiral and the smear
 * whirl on the match clock, so the rev keeps spinning while the sim holds frame 11 for as long as Special is
 * held). On frame 12 he lets go and the ball rolls forward three turns with speed lines behind it, its rim on the
 * floor at every angle; from frame 45 (the roll's end, or the bounce off a fighter he hit) it slows, he peeks out
 * and pops up standing.
 */
const sideB: AnimClip = (() => {
  const keys: Key[] = [
    key(0, STAND, { ease: 'out' }),
    key(2, mix(CROUCH, { neck: { rot: -18, sy: 0.6 } }, stalks(-30, 20, -20, 20, 0.45)), { ease: 'in' }),
    key(4, mix(SHELL_DOWN, { shell: { x: 1.0, y: 2.3, sx: 1.06, sy: 0.94 } }), {
      ease: 'out',
      swaps: IN_SHELL,
    }),
  ];
  /** The rev: turning in place, faster each frame, settling squashed on its rim on the rev frame. */
  const rev: [number, number, number][] = [
    [6, -10, 1.03],
    [7, 20, 1.05],
    [8, 80, 1.06],
    [9, 160, 1.07],
    [10, 260, 1.08],
    [REV, 360, 1.08],
  ];
  for (const [f, deg, squash] of rev) {
    const pose = rolled(deg, squash, 2 - squash);
    keys.push(
      key(
        f,
        mix(pose, ringAt(BODY_Y + pose.body!.y!), { fx2: at(-4.4, -2.4, 0, [0.7 + 0.04 * (f - 6), 0.8]) }),
        {
          ease: 'linear',
          ...(f === 6 ? { swaps: { ...SPIN_FX, spiral: 'spiralSpin', fx2: 'speedLines' } } : {}),
        },
      ),
    );
  }
  /** The roll: a key every frame so the lift follows the rim; it stretches a little as it launches. */
  for (let f = ROLL[0]; f <= ROLL[1]; f++) {
    const u = (f - REV) / (ROLL[1] - REV);
    const deg = 360 + (ROLL_END - 360) * u;
    const stretch = f < ROLL[0] + 3 ? 1 + 0.05 * (ROLL[0] + 3 - f) : 1;
    const pose = rolled(deg, stretch, 2 - stretch);
    const y = BODY_Y + pose.body!.y!;
    keys.push(
      key(f, mix(pose, ringAt(y), { fx2: at(-4.6, y, 0, [1.1, 1]) }), {
        ease: 'linear',
        ...(f === ROLL[0] ? { swaps: { ...SPIN_FX, fx2: 'speedLines' } } : {}),
      }),
    );
  }
  keys.push(
    key(45, rolled(ROLL_END + 25), { ease: 'out', swaps: SPINNING }),
    key(47, rolled(ROLL_END), { ease: 'out', swaps: IN_SHELL }),
    key(
      48,
      mix(
        CROUCH,
        { body: { rot: ROLL_END }, shell: { y: 1.8, sx: 1.06, sy: 0.92 }, neck: { rot: -20, sy: 0.55 } },
        stalks(-30, 20, -20, 20, 0.45),
      ),
      { ease: 'out', swaps: HAPPY },
    ),
    key(
      51,
      mix(CROUCH, { body: { rot: ROLL_END }, neck: { rot: -10, sy: 0.75 } }, stalks(-20, 16, -12, 14, 0.7)),
      { ease: 'inOut' },
    ),
    key(59, mix(STAND, { body: { rot: ROLL_END } })),
  );
  return { length: 59, active: [ROLL], swaps: DETERMINED, keys };
})();

/* ---------------------------------------------------------------- Crate Drop (neutral special) */

/**
 * The remote draws behind his eyestalks, so his eyes stay in front as he looks at it, and behind his front arm, so
 * his fist closes over its grip.
 */
export const REMOTE_Z = { fx1: rig.slots.findIndex((s) => s.name === 'stalkB1Line') - 0.5 };
/** The red button and the antenna tip, in the remote's own space (parts.ts). */
const BUTTON: [number, number] = [0, -1.98];
const ANTENNA: [number, number] = [0.63, -4.42];
/** How big he holds the remote: big enough that its button reads at match scale. */
const REMOTE = 1.5;

/**
 * Holding the remote up in his front fist with its grip at (x, y), tilted `deg`, scaled `s`: the click (fx3) sits
 * on the button and the radio waves (fx2) on the antenna tip.
 */
export function holding(base: Pose, x: number, y: number, deg = 0, s = REMOTE): Pose {
  const r = (deg * Math.PI) / 180;
  const on = ([px, py]: [number, number]): [number, number] => [
    x + s * (px * Math.cos(r) - py * Math.sin(r)),
    y + s * (px * Math.sin(r) + py * Math.cos(r)),
  ];
  const [bx, by] = on(BUTTON);
  const [ax, ay] = on(ANTENNA);
  return hands(mix(base, { fx1: at(x, y, deg, s), fx2: at(ax, ay), fx3: at(bx, by, 0, 0.55) }), null, [
    x,
    y + 0.1,
  ]);
}

/** Pleased with himself, eyes on the remote. */
export const PROUD: Pose = mix(
  { neck: { rot: -6 }, head: { rot: -4 } },
  stalks(-6, 6, 0, 8),
  look(0.3, 0.35),
);
/** Winding up to press: leaning back a little, the remote lifted. */
export const WIND: Pose = mix(
  { shell: { rot: -7, x: -0.5 }, neck: { rot: -12 }, head: { rot: -6 } },
  stalks(-10, 4, -4, 6, 1.03),
  look(0.3, 0.3),
);
/** The press: leaning onto the button, squashed. */
export const PRESS: Pose = mix(
  { shell: { rot: 4, x: 0.3, y: 0.3, sx: 1.03, sy: 0.96 }, foot: { sx: 1.03 }, neck: { rot: 6, sy: 0.95 } },
  stalks(4, 6, 8, 6, 0.97),
  look(0.35, 0.4),
);
/** Looking up and ahead for the crate. */
export const SKYWARD: Pose = mix(
  { shell: { rot: -4 }, neck: { rot: -4 }, head: { rot: -6 } },
  stalks(-6, -2, -2, 0, 1.06),
  look(0.3, -0.6),
);
/** Following it down to the landing spot ahead. */
export const TRACK: Pose = mix(
  { neck: { rot: 4 }, head: { rot: 2 } },
  stalks(-2, 2, 2, 4, 1.03),
  look(0.5, 0.05),
);
/** The crate lands: a flinch, stalks thrown back. */
export const FLINCH: Pose = mix(
  {
    shell: { rot: -8, x: -0.5, y: 0.35, sx: 1.03, sy: 0.95 },
    foot: { sx: 1.03 },
    neck: { rot: -10, sy: 0.92 },
  },
  stalks(-20, -8, -16, -6, 0.95),
  look(0.45, 0),
);

export const REMOTE_ON = { ...FIST_F, fx1: 'remote' };
export const PRESSED = { ...FIST_F, fx1: 'remotePressed' };

/**
 * Crate Drop: he pops a yellow crane remote out into his fist, winds up and jabs its big red button (frame 12),
 * the antenna sends out radio waves as the crate spawns high above on frame 14, and he looks up and follows it
 * down. It lands about 20 ahead on frame 29: he flinches, grins at it, and puts the remote away. The engine draws
 * the crate itself (art.projectiles: `crateFall`, then `crate` once it lands).
 */
const neutralB: AnimClip = {
  length: 45,
  active: [[14, 14]],
  swaps: HAPPY,
  keys: [
    key(0, STAND, { ease: 'out' }),
    key(3, holding(PROUD, 8.0, -3.9, -8, 0.4), {
      ease: 'out',
      swaps: { ...DETERMINED, ...REMOTE_ON },
      z: REMOTE_Z,
    }),
    key(5, holding(PROUD, 8.8, -4.3, -4, REMOTE * 1.08), { ease: 'inOut' }),
    key(8, holding(PROUD, 8.8, -4.3, -4), { ease: 'inOut' }),
    key(11, holding(WIND, 8.3, -5.1, -12), { ease: 'in' }),
    key(12, holding(PRESS, 9.1, -3.9, 4), { ease: 'out', swaps: { ...DETERMINED, ...PRESSED, fx3: 'pow' } }),
    key(13, undefined, { swaps: { ...DETERMINED, ...PRESSED, fx3: 'pow', fx2: 'signal' } }),
    key(14, undefined, { swaps: { ...DETERMINED, ...PRESSED, fx2: 'signal' } }),
    key(16, holding(PRESS, 9.0, -4.1, 2), {
      ease: 'inOut',
      swaps: { ...WIDE, mouth: 'grin', ...REMOTE_ON, fx2: 'signal' },
    }),
    key(20, holding(SKYWARD, 8.6, -4.7, -8), { ease: 'inOut' }),
    key(23, undefined, { swaps: { ...WIDE, mouth: 'grin', ...REMOTE_ON } }),
    key(27, holding(TRACK, 8.8, -4.4, -4), { ease: 'in' }),
    key(29, holding(FLINCH, 8.2, -4.3, -14), { ease: 'out', swaps: { ...STARTLED, ...REMOTE_ON } }),
    key(33, holding(add(TRACK, { neck: { rot: 4 } }), 8.8, -4.4, -4), {
      ease: 'inOut',
      swaps: { ...HAPPY, mouth: 'grin', ...REMOTE_ON },
    }),
    key(36, holding(PROUD, 9.0, -4.2, 0), { ease: 'in' }),
    key(37, holding(PROUD, 8.8, -3.6, 4, 0.3), { ease: 'in' }),
    key(38, undefined, { swaps: HAPPY, z: {} }),
    key(45, STAND),
  ],
};

export const specials: Record<string, AnimClip> = { upB, sideB, neutralB };
