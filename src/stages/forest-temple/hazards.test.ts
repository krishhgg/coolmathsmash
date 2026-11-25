import { describe, expect, it } from 'vitest';
import { createMatch } from '../../sim/match';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { POOL_FILL, stage } from './geometry';

describe('Forest Temple goo', () => {
  it.each(['fireboy', 'watergirl'])('pops %s out for two damage', (fighter) => {
    const m = testMatch({ stage: stage.id, fighter });
    const f = placeInAir(m, 0, 12);
    until(m, (g) => g.damage > 0, {}, 60);
    expect(f.damage).toBe(2);
    expect(f.stageHitLock).toBe(10);
    expect(m.events).toContainEqual(
      expect.objectContaining({ type: 'stageHit', element: 'goo', source: 'zone', damage: 2 }),
    );
    until(m, (g) => g.hitlag === 0, {}, 60);
    run(m, 1);
    expect(f.kb.y).toBeGreaterThan(0);
  });

  it.each([-1, 1] as const)('crosses the hazards-off fill in direction %i without a step', (dir) => {
    const m = createMatch({
      seed: 1,
      stocks: 3,
      stage: stage.id,
      hazards: false,
      ports: [{ fighter: 'fireboy' }],
    });
    const f = placeInAir(m, -25 * dir, 12);
    until(m, (g) => g.action === 'idle', {}, 60);
    expect(m.stage.solids[stage.solids.indexOf(POOL_FILL)]?.on).toBe(true);
    for (let i = 0; i < 120 && f.pos.x * dir < 25; i++) {
      run(m, 1, { x: dir * 60 });
      expect(f.ground?.kind).toBe('solid');
      expect(f.pos.y).toBe(0);
      expect(f.damage).toBe(0);
      expect(m.events.some(({ type }) => type === 'stageHit')).toBe(false);
    }
    expect(f.pos.x * dir).toBeGreaterThanOrEqual(25);
  });
});
