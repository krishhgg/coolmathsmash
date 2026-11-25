import { describe, expect, it } from 'vitest';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { stage } from './geometry';

describe('Forest Temple geometry', () => {
  it.each([
    [-70, 12, 0],
    [70, 12, 0],
  ])('lands on the temple floor at x=%i', (x, fromY, y) => {
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, x, fromY);
    until(m, (g) => g.ground !== null);
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos.y).toBe(y);
  });

  it('has a solid basin underneath the goo', () => {
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, 0, 12);
    f.intangible = 60;
    until(m, (g) => g.ground !== null);
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos.y).toBe(-6);
    expect(f.damage).toBe(0);
  });

  it.each([
    [-42, 24.12, 0],
    [0, 47.19, -6],
    [42, 24.12, 0],
  ])('lands on and drops through the slab at x=%i', (x, y, floor) => {
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, x, y + 12);
    until(m, (g) => g.action === 'idle' && g.ground !== null);
    expect(f.ground?.kind).toBe('platform');
    expect(f.pos.y).toBe(y);
    run(m, 1, { y: -100 });
    expect(f.ground).toBeNull();
    f.intangible = 60;
    until(m, (g) => g.ground !== null);
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos.y).toBe(floor);
  });

  it.each(stage.ledges.map((ledge, index) => ({ ...ledge, index })))(
    'catches the ledge at x=$x',
    ({ x, y, side, index }) => {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x + side * 3, y + 4, side === -1 ? 1 : -1);
      until(m, (g) => g.action === 'ledgeCatch', {}, 60);
      expect(f.ledge).toBe(index);
    },
  );
});
