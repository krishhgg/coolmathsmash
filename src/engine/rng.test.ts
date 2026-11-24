import { describe, expect, it } from 'vitest';
import { nextRandom, randomInt } from './rng';

describe('seeded rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = { rng: 1234 };
    const b = { rng: 1234 };
    const sa = Array.from({ length: 50 }, () => nextRandom(a));
    const sb = Array.from({ length: 50 }, () => nextRandom(b));
    expect(sa).toEqual(sb);
    expect(new Set(sa).size).toBe(50);
    for (const v of sa) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of sa) expect(v).toBeLessThan(1);
  });

  it('draws integers in range', () => {
    const s = { rng: 7 };
    for (let i = 0; i < 200; i++) {
      const v = randomInt(s, 6);
      expect(Number.isInteger(v) && v >= 0 && v < 6).toBe(true);
    }
  });
});
