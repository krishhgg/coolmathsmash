import { seedOf, signed } from './random';

/** A burst of screen shake, in screen pixels, decaying to nothing over `life` frames. */
export interface Shake {
  frame: number;
  amp: number;
  life: number;
  seed: number;
}

export function spawnShake(frame: number, port: number, amp: number, life: number): Shake {
  return { frame, amp, life, seed: seedOf(frame, port, 8) };
}

/** The summed shake offset at `frame` (pixels, y down): a fresh jolt every frame, shrinking as each shake ages. */
export function shakeOffset(shakes: readonly Shake[], frame: number): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const s of shakes) {
    const age = frame - s.frame;
    if (age < 0 || age >= s.life) continue;
    const k = s.amp * (1 - age / s.life) ** 1.5;
    x += signed(s.seed, age * 2) * k;
    y += signed(s.seed, age * 2 + 1) * k;
  }
  return { x, y };
}
