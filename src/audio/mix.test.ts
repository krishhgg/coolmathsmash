import { describe, expect, it } from 'vitest';
import { PAN_WIDTH, Variation, panForX, semitoneRate } from './mix';

describe('mix helpers', () => {
  it('pan by screen position: centre is 0, screen edges are ±PAN_WIDTH, off-screen clamps', () => {
    expect(panForX(30, 30, 4)).toBe(0);
    expect(panForX(30 + 640 / 4, 30, 4)).toBeCloseTo(PAN_WIDTH);
    expect(panForX(30 - 320 / 4, 30, 4)).toBeCloseTo(-PAN_WIDTH / 2);
    expect(panForX(-500, 0, 4)).toBe(-PAN_WIDTH);
  });

  it('turn semitones into playback rates', () => {
    expect(semitoneRate(0)).toBe(1);
    expect(semitoneRate(12)).toBe(2);
    expect(semitoneRate(-12)).toBe(0.5);
  });

  it('vary deterministically, within the spread, never picking the same variant twice in a row', () => {
    const a = new Variation(7);
    const b = new Variation(7);
    const xs = Array.from({ length: 200 }, () => a.spread(1.5));
    expect(xs).toEqual(Array.from({ length: 200 }, () => b.spread(1.5)));
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(1.5);
    let last = -1;
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const pick = a.pick(3, last);
      expect(pick).not.toBe(last);
      seen.add(pick);
      last = pick;
    }
    expect(seen).toEqual(new Set([0, 1, 2]));
    expect(a.pick(1, 0)).toBe(0);
  });
});
