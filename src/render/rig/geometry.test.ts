import { describe, expect, it } from 'vitest';
import { flattenPath, poseBounds, slotsCovering, transformPath } from './geometry';
import { samplePose } from './sample';
import type { FighterArt } from './types';

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

describe('poseBounds', () => {
  // A 2 by 2 body standing on the floor, and a decoration slot (a dust puff, say) that `brake` fills with the
  // same square two units lower, so it hangs below the floor.
  const art: FighterArt = {
    height: 2,
    icon: '',
    palettes: { default: {} },
    rig: {
      bones: [
        { name: 'root', x: 0, y: 0 },
        { name: 'fx', parent: 'root', x: 0, y: 2 },
      ],
      slots: [
        { name: 'body', bone: 'root', symbol: 'square' },
        { name: 'puff', bone: 'fx', symbol: null, decor: true },
      ],
      symbols: { square: [{ d: 'M-1 -2L1 -2L1 0L-1 0Z', fill: '#000000' }] },
    },
    clips: {
      idle: { length: 0, keys: [{ frame: 0 }] },
      brake: { length: 0, swaps: { puff: 'square' }, keys: [{ frame: 0 }] },
    },
  };

  it('measures the slots drawn in the pose', () => {
    expect(poseBounds(art, samplePose(art, 'idle', 0, 0))).toEqual([-1, -2, 1, 0]);
  });

  it('counts decorations, which the renderer draws like any other slot', () => {
    expect(poseBounds(art, samplePose(art, 'brake', 0, 0))).toEqual([-1, -2, 1, 2]);
  });

  it('still leaves decorations out of hit tests', () => {
    expect(slotsCovering(art, samplePose(art, 'brake', 0, 0), 0, 1)).toEqual([]);
  });
});
