import { describe, expect, it } from 'vitest';
import { runPorts } from '../../sim/testing/sim';
import { versus } from './testing';

describe('Papa Louie: toque glide', () => {
  it('holds Jump through the second jump to glide, then cannot glide again until he lands', () => {
    const m = versus();
    const f = m.fighters[0]!;
    runPorts(m, 9, [{ buttons: ['jump'] }, {}]);
    runPorts(m, 5, [{}, {}]);
    runPorts(m, 44, [{ buttons: ['jump'] }, {}]);
    expect(f.action).toBe('glide');
    expect(f.mobility.glideUsed).toBe(true);
    runPorts(m, 1, [{}, {}]);
    expect(f.action).toBe('fall');
    runPorts(m, 12, [{ buttons: ['jump'] }, {}]);
    expect(f.action).toBe('fall');
  });

  it('can glide out of Paddle Propeller, then becomes helpless when Jump is released', () => {
    const m = versus();
    const f = m.fighters[0]!;
    runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
    runPorts(m, 50, [{ buttons: ['jump'] }, {}]);
    expect(f.action).toBe('glide');
    runPorts(m, 10, [{ y: -100, buttons: ['jump'] }, {}]);
    expect(f.vel.y).toBeGreaterThanOrEqual(-0.6);
    expect(Math.abs(f.vel.x)).toBeLessThanOrEqual(1.2);
    runPorts(m, 1, [{}, {}]);
    expect(f.action).toBe('helpless');
    expect(f.landingLag).toBe(22);
  });

  it('uses neutral air when Attack is pressed during the glide', () => {
    const m = versus();
    const f = m.fighters[0]!;
    runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
    runPorts(m, 50, [{ buttons: ['jump'] }, {}]);
    expect(f.action).toBe('glide');
    runPorts(m, 1, [{ buttons: ['jump', 'attack'] }, {}]);
    expect(f.move).toBe('nair');
  });
});
