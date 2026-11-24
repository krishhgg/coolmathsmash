/**
 * Vertical integration shared by the simulation and the jump-height solver: each airborne frame moves by the
 * current velocity, then gravity is applied (capped at the fall speed).
 */
export function apexHeight(v0: number, gravity: number): number {
  let y = 0;
  let v = v0;
  let best = 0;
  while (v > 0) {
    y += v;
    best = Math.max(best, y);
    v -= gravity;
  }
  return best;
}

/** Initial vertical speed whose discrete apex is exactly `height` above take-off. */
export function jumpVelocity(height: number, gravity: number): number {
  let lo = 0;
  let hi = Math.sqrt(2 * gravity * height) + gravity * 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (apexHeight(mid, gravity) < height) lo = mid;
    else hi = mid;
  }
  return hi;
}
