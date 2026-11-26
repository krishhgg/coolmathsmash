/**
 * The numbers behind Bloxorz block's tipping (src/fighters/bloxorz/tip.ts), kept free of imports (but src/sim/math.ts,
 * which imports nothing) so the block's art can build its tip clips from the same values without pulling in the
 * fighter registry.
 */

import * as SimMath from '../../sim/math';

/** One tip moves the block's centre half a cube plus a cube. */
export const TIP_DISTANCE = 18;

/**
 * Tip timing in frames: a tip every `period` frames, rotating for the first `tip` of them and resting for the rest.
 * Walk averages 18 / 20 = 0.9 units a frame, the dash's single tip and the run 18 / 12 = 1.5.
 */
export const WALK = { period: 20, tip: 14 } as const;
export const DASH = { period: 12, tip: 12 } as const;
export const RUN = { period: 12, tip: 10 } as const;

/** Horizontal speed on frame `t` (from 0) of a tip lasting `frames`: eased in and out, summing to exactly 18. */
export function tipSpeed(t: number, frames: number): number {
  let total = 0;
  for (let k = 0; k < frames; k++) total += SimMath.sin((Math.PI * (k + 0.5)) / frames);
  return (TIP_DISTANCE * SimMath.sin((Math.PI * (t + 0.5)) / frames)) / total;
}
