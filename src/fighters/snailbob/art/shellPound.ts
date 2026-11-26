import type { Pose } from '../../../render/rig/author';
import { flattenPath } from '../../../render/rig/geometry';
import type { AnimClip } from '../../../render/rig/types';
import { lipHole, lipPeek, shell } from './parts';
import {
  CROUCH,
  DAZED,
  DETERMINED,
  HAPPY,
  IN_SHELL,
  SPINNING,
  STAND,
  AIR,
  at,
  key,
  mix,
  stalks,
} from './poses';
import { BODY_Y, SHELL_X, SHELL_Y } from './rig';

/**
 * Shell Pound (down special), keyed to src/fighters/snailbob/shellPound.ts like specials.ts: frame 1 is the move's
 * first frame, each clip lasts FAF - 1 and its `active` windows are the move's hit windows. The sim moves him (the
 * hop, the hang and the 9-unit drop); the clips only pose him, with the shell's lowest point on his feet.
 */

/** In the shell, the shell's centre on the body pivot, so turning `body` turns it in place. */
const BALL: Pose = { shell: { x: -SHELL_X, y: BODY_Y - SHELL_Y } };
/** The shell's outline and both of its mouths, in shell space: its lowest point is what meets the floor. */
const RIM = [...shell, ...lipPeek, ...lipHole].flatMap((s) => flattenPath(s.d, 4)).flat();

/**
 * Pulled into the shell, turned `deg` clockwise and scaled (sx, sy) about its centre, and lifted so the lowest point
 * of its rim sits `lift` above his feet. On the floor that is 0; in the air it keeps the shell where the sim's
 * position is, so the hop and the drop carry it without the drawing jumping.
 */
function ball(deg = 0, sx = 1, sy = 1, lift = 0, x = 0): Pose {
  const r = (deg * Math.PI) / 180;
  let low = -Infinity;
  for (let i = 0; i < RIM.length; i += 2)
    low = Math.max(low, sx * RIM[i]! * Math.sin(r) + sy * RIM[i + 1]! * Math.cos(r));
  return mix(BALL, { body: { rot: deg, sx, sy, x, y: -BODY_Y - low - lift } });
}

/** Frames of src/fighters/snailbob/shellPound.ts (POUND): the hop, the drops and the late hits they hold. */
const HOP = 11;
const DROP = 37;
const LATE = 40;
const DROP_AIR = 31;
const LATE_AIR = 33;
const LAND_FAF = 55;

/** Tucked in with the eyes peeking out of the shell's mouth, and tucked in all the way for the drop. */
const PEEK = IN_SHELL;
const SHUT = { ...IN_SHELL, lip: 'lipHole' };
/** The drop: stretched tall and thin, fall lines streaming off the top of the shell. */
const DROP_POSE: Pose = mix(ball(0, 0.86, 1.16), { fx1: at(0, -10.9, 0, [1.25, 1.4]) });
const DROPPING = { ...SHUT, fx1: 'fallLines' };
/**
 * The scoop: a smear sweeping up off the front of the shell over the rising hit's boxes. It keeps its place until it
 * is hidden, so it never swings under him on the way out.
 */
const SCOOP: Pose = { fx1: at(2.4, -3.4, -38, [1.35, 1.25]) };
/** Pulling in: the neck and stalks shrink towards the shell. */
const PULL_IN: Pose = mix(CROUCH, { neck: { rot: -18, sy: 0.6 } }, stalks(-30, 20, -20, 20, 0.45));

/**
 * Shell Pound from the ground: he pulls into his shell and coils down on the floor, springs up on frame 11 with the
 * shell's front edge scooping upward (the smear covers the rising hit's three boxes, and a puff of dust kicks up
 * behind), somersaults forward once on the way up, and hangs upright with his eyes peeking down. He gathers himself,
 * then drops on frame 37 stretched thin with fall lines streaming off the top; the late hit's frame (40) holds that
 * drawing while the sim holds the frame, however far he falls.
 */
const downB: AnimClip = {
  length: LATE,
  active: [
    [HOP, HOP],
    [DROP, LATE - 1],
    [LATE, LATE],
  ],
  swaps: DETERMINED,
  keys: [
    key(0, STAND, { ease: 'out' }),
    key(2, PULL_IN, { ease: 'in' }),
    key(4, ball(0, 1.06, 0.94), { ease: 'out', swaps: PEEK }),
    key(7, ball(-6, 1.12, 0.86, 0, -0.5), { ease: 'in' }),
    key(HOP - 1, ball(-10, 1.2, 0.8, 0, -0.9), { ease: 'in' }),
    key(HOP, mix(ball(20, 0.9, 1.14, 0, 1.0), SCOOP, { fx4: at(-3.6, 0, 0, 0.9) }), {
      ease: 'out',
      swaps: { ...SHUT, fx1: 'sideSmear', fxBack: 'dust' },
    }),
    key(12, mix(ball(32, 0.93, 1.1, 0, 0.6), SCOOP), {
      ease: 'linear',
      swaps: { ...SHUT, fx1: 'sideSmear' },
    }),
    key(13, mix(ball(50, 0.96, 1.06), SCOOP), { ease: 'linear', swaps: SPINNING }),
    key(17, ball(170), { ease: 'linear' }),
    key(21, ball(280), { ease: 'out' }),
    key(26, ball(360, 1.04, 0.96), { ease: 'inOut', swaps: PEEK }),
    key(31, ball(357, 1, 1, 0.4), { ease: 'inOut' }),
    key(34, ball(352, 1.1, 0.9, 0.6), { ease: 'in' }),
    key(DROP - 1, ball(350, 1.16, 0.84, 0.8), { ease: 'in' }),
    key(DROP, DROP_POSE, { ease: 'linear', swaps: DROPPING }),
    key(LATE, DROP_POSE),
  ],
};

/**
 * Shell Pound in the air: he pulls into his shell with a jolt as his speed drops, hangs bobbing with his eyes
 * peeking down, gathers himself, and drops on frame 31 as from the ground, holding frame 33 until he lands.
 */
const downBAir: AnimClip = {
  length: LATE_AIR,
  active: [
    [DROP_AIR, LATE_AIR - 1],
    [LATE_AIR, LATE_AIR],
  ],
  swaps: DETERMINED,
  keys: [
    key(0, AIR, { ease: 'out' }),
    key(3, mix(AIR, { neck: { rot: -20, sy: 0.6 } }, stalks(-30, 20, -20, 20, 0.5)), { ease: 'in' }),
    key(5, ball(-18, 1.08, 0.92, 1.0), { ease: 'out', swaps: PEEK }),
    key(9, ball(8, 0.98, 1.02, 1.6), { ease: 'inOut' }),
    key(15, ball(-2, 1.02, 0.98, 1.2), { ease: 'inOut' }),
    key(21, ball(3, 1, 1, 1.6), { ease: 'inOut' }),
    key(26, ball(-6, 1.1, 0.9, 1.8), { ease: 'in' }),
    key(DROP_AIR - 1, ball(-10, 1.16, 0.84, 2.0), { ease: 'in' }),
    key(DROP_AIR, DROP_POSE, { ease: 'linear', swaps: DROPPING }),
    key(LATE_AIR, DROP_POSE),
  ],
};

/** The slam: squashed flat on the floor, the shockwave ring and two dust clouds bursting out on both sides. */
const SLAM: Pose = mix(ball(0, 1.26, 0.76), {
  fx1: at(6.2, 0, 0, 1.15),
  fx2: at(-6.2, 0, 0, [-1.15, 1.15]),
  fx3: at(0, -0.72, 0, [1.9, 1.3]),
});
/** Dizzy stars over his head, circling clockwise: `n` quarter turns of the pair, as in the dizzy clip. */
const starsAt = (x: number, y: number, n: number): Pose => ({ fx1: at(x, y, 90 * n, 1.3) });
const DIZZY_SHELL = { ...PEEK, fx1: 'stars' };
/** Out of the shell, still seeing stars. */
const POP_OUT: Pose = mix(
  CROUCH,
  { shell: { y: 1.8, sx: 1.06, sy: 0.92 }, neck: { rot: -20, sy: 0.55 } },
  stalks(-30, 20, -20, 20, 0.45),
);
const WOOZY = (side: 1 | -1): Pose =>
  mix(
    CROUCH,
    { body: { rot: -2 * side }, neck: { rot: -6 + 8 * side, sy: 0.85 }, head: { rot: 10 * side } },
    stalks(-22 + 10 * side, 16, -8 + 10 * side, 24, 0.8),
  );

/**
 * Shell Pound's landing: the shell slams down squashed flat with a shockwave and dust on both sides (the landing hit,
 * frames 1-2), rebounds and settles. Then he sits stunned in the shell through the long landing lag, eyes peeking
 * out and stars circling over it, pops out still dizzy, shakes it off and stands up on the last frame (54).
 */
const downBLand: AnimClip = {
  length: LAND_FAF - 1,
  active: [[1, 2]],
  swaps: HAPPY,
  keys: [
    key(0, SLAM, { ease: 'linear', swaps: { ...SHUT, fx1: 'dust', fx2: 'dust', smearBack: 'shockwave' } }),
    key(2, SLAM, { ease: 'out' }),
    key(
      5,
      mix(ball(0, 0.94, 1.08), {
        fx1: at(8.6, 0, 0, 0.75),
        fx2: at(-8.6, 0, 0, [-0.75, 0.75]),
        fx3: at(0, -0.42, 0, [2.6, 0.7]),
      }),
      { ease: 'inOut' },
    ),
    key(
      8,
      mix(ball(0, 1.04, 0.96), {
        fx1: at(10.2, 0, 0, 0.35),
        fx2: at(-10.2, 0, 0, [-0.35, 0.35]),
        fx3: at(0, -0.21, 0, [3.1, 0.35]),
      }),
      { ease: 'in' },
    ),
    key(9, mix(ball(0, 1.04, 0.96), starsAt(-0.2, -11.4, 0)), { ease: 'out', swaps: DIZZY_SHELL }),
    key(12, mix(ball(4), starsAt(0.3, -11.2, 1)), { ease: 'inOut' }),
    key(16, mix(ball(-4), starsAt(-0.3, -11.4, 2)), { ease: 'inOut' }),
    key(20, mix(ball(3), starsAt(0.3, -11.2, 3)), { ease: 'inOut' }),
    key(24, mix(ball(-3), starsAt(-0.3, -11.4, 4)), { ease: 'inOut' }),
    key(28, mix(ball(0, 1.06, 0.94), starsAt(0.1, -11.3, 5)), { ease: 'in' }),
    key(30, mix(POP_OUT, starsAt(3.6, -13.6, 6)), { ease: 'out', swaps: { ...DAZED, fx1: 'stars' } }),
    key(34, mix(WOOZY(1), starsAt(4.4, -14.6, 7)), { ease: 'inOut' }),
    key(38, mix(WOOZY(-1), starsAt(3.8, -14.8, 8)), { ease: 'inOut' }),
    key(42, mix(WOOZY(1), starsAt(4.4, -14.6, 9)), { ease: 'inOut' }),
    key(44, mix(WOOZY(-1), { neck: { rot: 4 }, head: { rot: -16 } }), { ease: 'inOut', swaps: DETERMINED }),
    key(47, mix(CROUCH, stalks(-10, 10, -4, 12, 0.85)), { ease: 'inOut', swaps: HAPPY }),
    key(LAND_FAF - 1, STAND),
  ],
};

export const shellPound: Record<string, AnimClip> = { downB, downBAir, downBLand };
