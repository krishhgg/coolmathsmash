import { describe, expect, it } from 'vitest';
import { createMatch } from '../../sim/match';
import { run, testMatch, until } from '../../sim/testing/sim';

const G = 'raftwars/grenade';
const BURST = 'raftwars/grenadeBurst';

function throwGrenade(m: ReturnType<typeof createMatch>): void {
  run(m, 1, { x: 100, buttons: ['special'] });
  run(m, 16);
}

describe('Raft Wars Kids: Grenade (side special)', () => {
  it('spawns on frame 16, bounces, then bursts 90 frames after the throw', () => {
    const m = testMatch({ fighter: 'raftwars' });
    run(m, 1, { x: 100, buttons: ['special'] });
    run(m, 14);
    expect(m.entities).toHaveLength(0);
    run(m, 1);
    expect(m.fighters[0]!.actionFrame).toBe(16);
    const e = m.entities[0]!;
    expect(e.kind).toBe(G);
    expect(e.age).toBe(1);

    let bounced = false;
    for (let i = 1; i < 90; i++) {
      const falling = e.vel.y < 0;
      run(m, 1);
      if (falling && e.vel.y > 0) bounced = true;
      expect(m.entities.map((other) => other.kind)).toEqual([G]);
    }
    expect(bounced).toBe(true);
    run(m, 1);
    expect(m.entities.map((other) => [other.kind, other.age])).toEqual([[BURST, 1]]);
    expect(m.entities[0]!.pos).toEqual(e.pos);
  });

  it('caps each owner at two grenades and frees a slot after detonation', () => {
    const m = testMatch({ fighter: 'raftwars' });
    throwGrenade(m);
    until(m, (f) => f.action === 'idle');
    throwGrenade(m);
    until(m, (f) => f.action === 'idle');
    expect(m.entities.filter((e) => e.kind === G)).toHaveLength(2);
    const firstTwo = m.entities.map((e) => e.id);
    throwGrenade(m);
    expect(m.entities.map((e) => e.id)).toEqual(firstTwo);
    until(m, (f) => f.action === 'idle');
    expect(m.entities.filter((e) => e.kind === G)).toHaveLength(1);
    throwGrenade(m);
    expect(m.entities.filter((e) => e.kind === G)).toHaveLength(2);
  });

  it('does no contact damage and hits a fighter in the burst only once', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'raftwars' }, { fighter: 'reference-mario' }],
    });
    run(m, 10);
    throwGrenade(m);
    const e = m.entities[0]!;
    const victim = m.fighters[1]!;
    victim.pos = { ...e.pos };
    victim.intangible = 0;
    run(m, 1);
    expect(victim.damage).toBe(0);
    run(m, 88);
    victim.pos = { ...e.pos };
    victim.prevPos = { ...e.pos };
    victim.ground = null;
    victim.action = 'fall';
    victim.vel = { x: 0, y: 0 };
    run(m, 3);
    expect(victim.damage).toBeCloseTo(13 * 1.2 * 1.05);
  });
});
