import { describe, expect, it } from 'vitest';
import { flattenPath, transformPath } from './geometry';

describe('transformPath', () => {
  // Every command, absolute and relative, with a relative move after a close (relative to the subpath start).
  const d = 'M1 2L3 2H4V5l-1 1h-1v-2Q0 3 1 2Zm2 0q1 1 2 0C6 -1 7 1 8 0c1 1 2 1 3 0Z';
  const m = { a: 0.8, b: 0.6, c: -0.6, d: 0.8, tx: 2.5, ty: -1 };

  it('writes absolute M L Q C Z commands only', () => {
    expect(transformPath(d, m)).toMatch(/^[MLQCZ0-9. -]+$/);
  });

  it('maps every point of the outline through the matrix', () => {
    const want = flattenPath(d).map((poly) =>
      poly.map((v, i) => (i % 2 ? m.b * poly[i - 1]! + m.d * v + m.ty : m.a * v + m.c * poly[i + 1]! + m.tx)),
    );
    const got = flattenPath(transformPath(d, m));
    expect(got.length).toBe(want.length);
    got.forEach((poly, p) => {
      expect(poly.length).toBe(want[p]!.length);
      poly.forEach((v, i) => expect(v).toBeCloseTo(want[p]![i]!, 2));
    });
  });
});
