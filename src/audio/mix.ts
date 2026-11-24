import { VIEW_WIDTH } from '../config';

/** Small pure helpers for placing and varying sounds. */

export const semitoneRate = (semitones: number) => 2 ** (semitones / 12);
export const dbGain = (db: number) => 10 ** (db / 20);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How far sounds are allowed to pan: full left/right is too much on headphones. */
export const PAN_WIDTH = 0.75;

/**
 * Stereo pan for a world x position as seen by a camera centred on `viewX` at `zoom` px per unit: the left
 * screen edge is -PAN_WIDTH, the right edge +PAN_WIDTH, off-screen positions clamp to the edges.
 */
export function panForX(x: number, viewX: number, zoom: number): number {
  const screen = ((x - viewX) * zoom) / (VIEW_WIDTH / 2);
  return clamp(screen, -1, 1) * PAN_WIDTH;
}

/**
 * The random pitch spread of repeated sounds. It is a seeded xorshift rather than Math.random so offline
 * renders (PR clips) come out identical every time; it never touches the simulation.
 */
export class Variation {
  private s: number;
  constructor(seed = 0x2545f491) {
    this.s = seed >>> 0 || 1;
  }
  /** Uniform in [0, 1). */
  next(): number {
    let s = this.s;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.s = s >>> 0;
    return this.s / 4294967296;
  }
  /** Uniform in [-spread, spread]. */
  spread(spread: number): number {
    return spread === 0 ? 0 : (this.next() * 2 - 1) * spread;
  }
  /** An index in [0, n) that differs from `last` whenever n > 1. */
  pick(n: number, last: number): number {
    if (n <= 1) return 0;
    const i = Math.floor(this.next() * (n - 1));
    return i >= last ? i + 1 : i;
  }
}
