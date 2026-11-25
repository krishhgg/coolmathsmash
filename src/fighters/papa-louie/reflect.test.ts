import { describe, expect, it } from 'vitest';
import { activeReflectors } from '../../sim/entities/contacts';
import { spawnEntity } from '../../sim/entities/entities';
import { attack, runPorts } from '../../sim/testing/sim';
import { versus } from './testing';

describe('Papa Louie: paddle reflects projectiles', () => {
  it.each([
    ['ftilt', 7, 9],
    ['downB', 5, 20],
  ] as const)('%s only reflects from frame %i through %i', (move, start, end) => {
    const m = versus();
    const f = m.fighters[0]!;
    attack(m, 0, move);
    for (let frame = 1; frame <= end + 1; frame++) {
      runPorts(m, 1, [{}, {}]);
      expect(f.actionFrame).toBe(frame);
      expect(activeReflectors(f)).toHaveLength(frame >= start && frame <= end ? 1 : 0);
    }
  });

  it.each([
    ['ftilt', 1.4, 1.4],
    ['downB', 1.5, 1.25],
  ] as const)('%s returns Fireball with %sx damage and %sx speed', (move, damage, speed) => {
    const m = versus();
    attack(m, 0, move);
    const f = m.fighters[0]!;
    while (activeReflectors(f).length === 0) runPorts(m, 1, [{}, {}]);
    const at = activeReflectors(f)[0]!;
    const fireball = spawnEntity(m, {
      kind: 'fireboy/fireball',
      owner: 1,
      pos: { x: at.x, y: at.y },
      vel: { x: -2 * f.facing, y: 0 },
    });
    runPorts(m, 1, [{}, {}]);
    expect(fireball.owner).toBe(0);
    expect(fireball.damageMul).toBeCloseTo(damage);
    expect(fireball.vel.x).toBeCloseTo(2 * speed * f.facing);
  });
});
