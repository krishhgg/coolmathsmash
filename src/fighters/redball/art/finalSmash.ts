import { RAIN_FRAMES, finalSmash } from '../finalSmash';
import type { MoveClip } from './attacks';
import { R } from './parts';
import { DETERMINED, GRIT, fx, ground, key, mix, roll, type Pose } from './poses';

/**
 * Ball Rain, the Final Smash (src/fighters/redball/finalSmash.ts), on PK Starstorm's timeline. Through the activation
 * freeze Red Ball squashes and springs up twice, shouting at the sky, the second time in a white flare; then he bounces
 * on the spot, looking up and grinning, with a hop and a star popping over his head on each of the 16 frames a ball drops, and
 * settles on frame 357. The balls are the entity's prop (rainBall.ts, art index `projectiles.ball`).
 */

/** Shouting up at the sky. */
const CALL = { eyes: 'eyesDeterminedUp', brow: 'browAngry', mouth: 'mouthOpen' };
/** Watching the rain, delighted. */
const CHEER = { eyes: 'eyesUp', brow: null, mouth: 'mouthHappy' };

/** Face turned up and back towards the sky (a negative roll lifts the face). */
const UP = roll(-24);

/** Squashed or stretched on the floor (`sx`, `sy`) and hopped `lift` up: the pose, the ball's centre and its top. */
function at(sx: number, sy: number, lift = 0) {
  return { pose: ground(sx, sy, 0, lift), cy: -(lift + R * sy), top: -(lift + 2 * R * sy) };
}

/** A white flare glowing round the ball, stretched with it, and a pop burst behind both. */
function flare(b: ReturnType<typeof at>, sx: number, sy: number, burst: number): Pose {
  return mix(b.pose, UP, fx('fx2', 0, b.cy, sx * 1.3, 0, sy * 1.22), fx('fx3', 0, b.cy, burst));
}
/** The flare and the burst draw behind the ball. */
const BEHIND = { fx2: 0.5 };

/** The star that pops over his head on each drop, `s` big, with a burst of rays behind it. */
const pop = (b: ReturnType<typeof at>, s: number): Pose =>
  mix(b.pose, fx('fx4', 0, b.top - 3.6, s), fx('fx3', 0, b.top - 3.6, s * 0.95));
const STAR = { ...CHEER, fx4: 'star', fxBack: 'pop' };

function keys() {
  const spring = [at(0.74, 1.4, 1.2), at(0.82, 1.28, 3.6), at(0.86, 1.2, 3.8)];
  const flash = [at(0.72, 1.42, 1.6), at(0.8, 1.3, 4.4), at(0.84, 1.24, 5)];
  const out = [
    key(0, ground()),
    key(3, ground(1.12, 0.9), { swaps: GRIT, ease: 'out' }),
    key(7, ground(1.38, 0.66), { ease: 'out' }),
    key(9, mix(spring[0]!.pose, UP, fx('fx1', 0, 0, 0.9)), { swaps: { ...CALL, fx1: 'ring' }, ease: 'out' }),
    key(14, mix(spring[1]!.pose, UP, fx('fx1', 0, 0, 1.6)), { ease: 'inOut' }),
    key(17, mix(spring[2]!.pose, UP, fx('fx1', 0, 0, 1.9)), { swaps: CALL }),
    key(21, mix(ground(0.95, 1.06, 0, 1.2), roll(-12)), { ease: 'in' }),
    key(24, mix(ground(1.32, 0.72), roll(-6)), { swaps: GRIT, ease: 'out' }),
    key(27, flare(flash[0]!, 0.72, 1.42, 1.6), {
      swaps: { ...CALL, fx2: 'flash', fxBack: 'pop' },
      z: BEHIND,
      ease: 'out',
    }),
    key(31, flare(flash[1]!, 0.8, 1.3, 2.6)),
    key(33, flare(flash[2]!, 0.84, 1.24, 3), { swaps: CALL, z: {}, ease: 'inOut' }),
    key(38, mix(ground(0.96, 1.05, 0, 1.4), roll(-14)), { ease: 'in' }),
    key(41, mix(ground(1.26, 0.78), roll(-10)), { swaps: CHEER, ease: 'out' }),
    key(45, mix(ground(0.97, 1.03), roll(-16))),
  ];
  // A hop on each drop: squash, spring with a pop over his head, land, settle.
  const up = at(0.86, 1.17, 2.2);
  const top = at(0.92, 1.09, 2.6);
  for (const [i, d] of RAIN_FRAMES.entries()) {
    const lean = i % 2 ? -20 : -14;
    out.push(
      key(d - 4, mix(ground(1.16, 0.88), roll(lean + 4)), { ease: 'out' }),
      key(d, mix(pop(up, 1.6), roll(lean - 4)), { swaps: STAR, ease: 'out' }),
      key(d + 4, mix(pop(top, 2.6), roll(lean - 4)), { swaps: CHEER, ease: 'in' }),
      key(d + 7, mix(ground(1.1, 0.92), roll(lean)), { ease: 'out' }),
    );
    if (i < RAIN_FRAMES.length - 1) out.push(key(d + 11, mix(ground(0.98, 1.02), roll(lean - 2))));
  }
  const end = finalSmash.faf - 1;
  out.push(key(end - 3, ground(1.02, 0.98), { swaps: DETERMINED }), key(end, ground()));
  return out;
}

/** Ball Rain: FAF 358, PK Starstorm's last frame 357 plus one. No hitboxes of its own. */
export const finalSmashClip: MoveClip = { length: finalSmash.faf - 1, active: [], keys: keys() };
