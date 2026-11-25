import { describe, expect, it } from 'vitest';
import { attack, testMatch, until } from '../../sim/testing/sim';

describe('Red Ball: Wind-up Ram', () => {
  it.each([true, false])('keeps the lunge but brakes at the end (connected: %s)', (connects) => {
    const m = testMatch({ fighter: 'redball', players: 2 });
    const a = m.fighters[0]!;
    const v = m.fighters[1]!;
    a.pos.x = -13;
    v.pos.x = connects ? 0 : 65;
    attack(m, 0, 'fsmash');

    until(m, (g) => g.actionFrame === 18, {}, 100);
    expect(a.pos.x + 13).toBeGreaterThanOrEqual(12);
    expect(a.pos.x + 13).toBeLessThan(14);
    expect(v.damage > 0).toBe(connects);
    const endOfLunge = a.pos.x;

    until(m, (g) => g.actionFrame === 22, {}, 10);
    expect(a.vel.x).toBe(0);
    expect(a.pos.x - endOfLunge).toBeLessThanOrEqual(2.1);
    const endOfSlide = a.pos.x;

    until(m, (g) => g.action === 'idle');
    expect(a.pos.x).toBeCloseTo(endOfSlide);
  });
});
