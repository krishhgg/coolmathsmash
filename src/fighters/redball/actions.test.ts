import { describe, expect, it } from 'vitest';
import { run, testMatch, until } from '../../sim/testing/sim';
import { stats } from './stats';

function runningTowardLedge(direction: 1 | -1) {
  const m = testMatch({ fighter: 'redball', x: -40 * direction });
  const f = m.fighters[0]!;
  until(m, (g) => g.vel.x * direction >= stats.runSpeed, { x: 100 * direction }, 60);
  f.pos.x = 40 * direction;
  return { m, f, reverse: { x: -100 * direction } };
}

describe('Red Ball running turnaround', () => {
  it.each([-1, 1] as const)('skids for 12 frames before dashing back from side %i', (side) => {
    const { m, f, reverse } = runningTowardLedge(side);
    for (let frame = 1; frame < 12; frame++) {
      run(m, 1, reverse);
      expect(f.action).toBe('turn');
      expect(f.vel.x * side).toBeCloseTo(Math.max(0, stats.runSpeed - frame * 0.2));
      expect(f.pos.x * side).toBeLessThan(53);
    }
    run(m, 1, reverse);
    expect(f.action).toBe('dash');
    expect(f.vel.x).toBeCloseTo(-side * stats.dashInitialSpeed);
    expect(f.ground).not.toBeNull();
  });

  it('comes to a stop instead of dashing back if the stick is released', () => {
    const { m, f, reverse } = runningTowardLedge(1);
    run(m, 6, reverse);
    run(m, 6);
    expect(f.action).toBe('idle');
    expect(f.vel.x).toBeCloseTo(0);
  });

  it('can still jump during the skid', () => {
    const { m, f, reverse } = runningTowardLedge(1);
    run(m, 6, reverse);
    run(m, 1, { ...reverse, buttons: ['jump'] });
    expect(f.action).toBe('jumpSquat');
  });
});
