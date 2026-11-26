import type { Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { COIN_DRAWINGS } from './coins';
import { hold } from './laser';
import { MAGNET_POLES } from './parts';
import { FIST_B, GRIT, GUARD, SMIRK, STANCE, feet, fist, key, mix, shortTurns, type Pt } from './poses';

/**
 * Coin Magnet's clip, keyed frame for frame on the move (src/fighters/johnny/upgrade.ts, MAGNET): the magnet comes
 * up on frames 1-4, frames 5-16 are the 12-frame charge cycle the move repeats while Special is held (the magnet
 * buzzing every other frame, the body rocking back against the pull over the whole cycle, six coin drawings two
 * frames each), and frames 17-22 put it away. Frame 16 leads into frame 5 as smoothly as into 17, so the loop has no
 * seam.
 */

const DEG = 180 / Math.PI;
const LOOP = [5, 16] as const;
const CYCLE = LOOP[1] - LOOP[0] + 1;

/** The magnet in the near fist. */
const MAGNET = { foreF: 'magnet', foreFLine: 'magnetLine' };

/** Rig-space point between the poles for the near hand on `hand` with the magnet tilted `tilt` degrees. */
function poles(hand: Pt, tilt: number): Pt {
  const t = tilt / DEG;
  return [hand[0] + MAGNET_POLES[0] * Math.cos(t), hand[1] + MAGNET_POLES[0] * Math.sin(t)];
}

/** The magnet held out at `hand`, tilted `tilt`, with the fx1 bone (the coins' space) on its poles. */
function magnetAt(pose: Pose, hand: Pt, tilt: number): Pose {
  const [x, y] = poles(hand, tilt);
  return mix(hold(pose, hand, tilt), { fx1: { x, y, rot: tilt } });
}

/** Feet wide and planted, leaning back against the pull; the far fist on his belt. */
function brace(lean: number): Pose {
  return fist(
    feet(
      { hip: { y: 0.45 + 0.1 * lean }, body: { rot: -2 - lean, x: -0.25 }, armF: { x: 0.7 } },
      [3.6, 0],
      [-2.7, 0],
    ),
    'B',
    [3.3, -6.5],
  );
}

/** The hand held out at chest height, the magnet a little above level. */
const HAND: Pt = [4.6, -9.3];
const TILT = -6;

/** One frame of the cycle: phase 0 to 1 rocks the body once, `buzz` (1 or -1) shakes the magnet. */
function cycle(phase: number, buzz: number): Pose {
  const lean = Math.sin(phase * 2 * Math.PI);
  return magnetAt(brace(lean), [HAND[0] - 0.15 * lean, HAND[1] + 0.1 * buzz], TILT + 1.4 * buzz);
}

const loopKeys: Key[] = Array.from({ length: CYCLE }, (_, i) => {
  const frame = LOOP[0] + i;
  const coins = i % 2 === 0 ? { swaps: { fx1: `coins${(i / 2) % COIN_DRAWINGS}` } } : {};
  return key(frame, cycle(i / CYCLE, i % 2 === 0 ? 1 : -1), { ease: 'linear', ...coins });
});

const RAISE = hold(mix(brace(0), { body: { rot: 1 } }), [1.6, -6.9], 42);
const READY = magnetAt(brace(-0.5), [HAND[0] + 0.1, HAND[1] + 0.3], TILT + 4);
const PULL = magnetAt(brace(0.6), [HAND[0] - 0.9, HAND[1] + 0.2], TILT - 4);
const LOWER = hold(mix(brace(0), { body: { rot: 0 } }), [1.0, -5.6], 48);

export const magnet: Record<string, AnimClip> = {
  downB: {
    length: 22,
    active: [],
    swaps: { ...SMIRK, ...MAGNET, ...FIST_B },
    keys: shortTurns([
      key(0, STANCE, { ease: 'out', swaps: { ...GRIT, ...GUARD } }),
      key(2, RAISE, { ease: 'out', swaps: { ...GRIT } }),
      key(4, READY, { ease: 'linear', swaps: { fx1: 'coinField' } }),
      ...loopKeys,
      key(17, PULL, { ease: 'out', swaps: { fx1: 'coinSparkle' } }),
      key(18, undefined, { swaps: {} }),
      key(19, LOWER, { ease: 'inOut' }),
      key(20, LOWER, { ease: 'inOut', swaps: { ...GRIT, ...GUARD } }),
      key(22, STANCE),
    ]),
  },
};
