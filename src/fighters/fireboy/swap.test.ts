import { describe, expect, it } from 'vitest';
import { isIntangible } from '../../sim/actions/registry';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { stats as watergirl } from '../watergirl/stats';

const fireboy = () => testMatch({ fighter: 'fireboy' });

describe('Fireboy and Watergirl swap', () => {
  it('down special becomes Watergirl on frame 18, intangible 18-32, actionable on frame 51', () => {
    const m = fireboy();
    const f = m.fighters[0]!;
    Object.assign(f, { damage: 42, stocks: 2 });
    const x0 = f.pos.x;
    run(m, 1, { y: -100, buttons: ['special'] });
    expect(f.move).toBe('downB');
    const seen: { frame: number; fighter: string; intangible: boolean }[] = [];
    while (f.move === 'downB') {
      seen.push({ frame: f.actionFrame, fighter: f.fighter, intangible: isIntangible(f) });
      run(m, 1);
    }
    expect(seen.filter((s) => s.fighter === 'fireboy').map((s) => s.frame)).toEqual(range(1, 17));
    expect(seen.filter((s) => s.intangible).map((s) => s.frame)).toEqual(range(18, 32));
    expect(seen.at(-1)!.frame).toBe(50);
    expect(f.action).toBe('idle');
    expect(f).toMatchObject({ fighter: 'watergirl', damage: 42, stocks: 2 });
    expect(f.pos.x).toBeCloseTo(x0, 6);
  });

  it('reports the transform as a sim event', () => {
    const m = fireboy();
    run(m, 1, { y: -100, buttons: ['special'] });
    until(m, () => m.events.some((e) => e.type === 'transform'));
    expect(m.events.find((e) => e.type === 'transform')).toEqual({
      type: 'transform',
      port: 0,
      from: 'fireboy',
      to: 'watergirl',
    });
  });

  it("after the swap Watergirl's own stats apply, and her down special swaps back", () => {
    const m = fireboy();
    const f = m.fighters[0]!;
    run(m, 1, { y: -100, buttons: ['special'] });
    until(m, (g) => g.action === 'idle');
    const y0 = f.pos.y;
    let top = y0;
    until(m, (g) => g.ground === null, { buttons: ['jump'] });
    until(
      m,
      (g) => {
        top = Math.max(top, g.pos.y);
        return g.ground !== null;
      },
      { buttons: ['jump'] },
    );
    expect(top - y0).toBeCloseTo(watergirl.fullHopHeight, 0);
    run(m, 10);
    run(m, 1, { y: -100, buttons: ['special'] });
    until(m, (g) => g.action === 'idle');
    expect(f.fighter).toBe('fireboy');
  });

  it('works in the air without giving back a jump', () => {
    const m = fireboy();
    const f = placeInAir(m, -70, 60);
    f.jumpsUsed = 2;
    run(m, 1, { y: -100, buttons: ['special'] });
    expect(f.move).toBe('downB');
    run(m, 20);
    expect(f.fighter).toBe('watergirl');
    expect(f.jumpsUsed).toBe(2);
  });
});

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
