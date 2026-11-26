import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { defineFighter } from '../../fighters/types';
import { SHIELD_DEPLETION } from '../constants';
import { spawnEntity } from '../entities/entities';
import { gadgets } from '../testing/gadgets';
import { attack, run, runPorts, testMatch } from '../testing/sim';

const push = { id: 0, x: 0, y: 0, radius: 5, pushOnly: true, damage: 0, angle: 30, bkb: 90, kbg: 0 };
const wind = defineFighter({
  ...gadgets,
  id: 'test-wind',
  moves: {
    ...gadgets.moves,
    gust: {
      kind: 'other',
      faf: 20,
      hits: [{ frames: [1, 2], boxes: [{ ...push, x: 10, y: 8, shieldDamage: 20 }] }],
    },
  },
  entities: {
    ...gadgets.entities,
    stream: { radius: 2, lifetime: 120, hits: [{ frames: [1, 120], boxes: [push] }] },
  },
});
registerFighter(wind);

function duel(x = -12) {
  const m = testMatch({ fighter: wind.id, players: 2 });
  const [a, v] = m.fighters;
  a!.pos.x = x;
  a!.facing = 1;
  v!.pos.x = 0;
  v!.facing = -1;
  return { m, a: a!, v: v! };
}

describe('push-only hitboxes', () => {
  it('moves a grounded fighter without damage, hitlag, hitstun or interrupting their attack', () => {
    const { m, a, v } = duel();
    v.damage = 73;
    attack(m, 1, 'reflect');
    attack(m, 0, 'gust');
    run(m, 1);

    expect(v.kb.x).toBeGreaterThan(0);
    expect(v.kb.y).toBe(0);
    expect(v).toMatchObject({ damage: 73, hitlag: 0, hitstun: 0, action: 'attack', move: 'reflect' });
    expect(a.hitlag).toBe(0);
    expect(a.staleQueue).toEqual([]);
    expect(m.events.some((e) => e.type === 'hit')).toBe(false);
    run(m, 1);
    expect(v.pos.x).toBeGreaterThan(0);
    expect(v.ground).not.toBeNull();
  });

  it('leaves a held shield alone, including extra shield damage authored on the box', () => {
    const { m, v } = duel();
    runPorts(m, 3, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shield');
    const hp = v.shieldHp;
    attack(m, 0, 'gust');
    runPorts(m, 1, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shield');
    expect(v.shieldHp).toBeCloseTo(hp - SHIELD_DEPLETION, 6);
    expect(v.kb.x).toBe(0);
    expect(v.hitlag).toBe(0);
  });

  it('a reflected wind projectile pushes its old owner without dealing damage', () => {
    const { m, a, v } = duel(-40);
    attack(m, 1, 'reflect');
    const stream = spawnEntity(m, {
      kind: 'test-wind/stream',
      owner: 0,
      pos: { x: -10, y: 8 },
      vel: { x: 2, y: 0 },
    });
    run(m, 4);
    expect(stream.owner).toBe(v.port);
    expect(stream.vel.x).toBeLessThan(0);
    for (let i = 0; i < 30 && !stream.dead; i++) run(m, 1);
    expect(stream.dead).toBe(true);
    expect(a.kb.x).toBeLessThan(0);
    expect(a).toMatchObject({ damage: 0, hitlag: 0, hitstun: 0 });
  });

  it('an absorber destroys a wind projectile and heals nothing', () => {
    const { m, v } = duel(-40);
    v.damage = 50;
    attack(m, 1, 'absorb');
    const stream = spawnEntity(m, {
      kind: 'test-wind/stream',
      owner: 0,
      pos: { x: -10, y: 8 },
      vel: { x: 2, y: 0 },
    });
    run(m, 4);
    expect(m.entities).not.toContain(stream);
    expect(v.damage).toBe(50);
    expect(v.kb.x).toBe(0);
  });

  it('neither a melee windbox nor a wind projectile damages or freezes a hittable entity', () => {
    const { m, a, v } = duel();
    v.pos.x = 40;
    const crate = spawnEntity(m, { kind: 'test-wind/crate', owner: 1, pos: { x: -2, y: 8 } });
    const stream = spawnEntity(m, { kind: 'test-wind/stream', owner: 0, pos: { x: -2, y: 8 } });
    attack(m, 0, 'gust');
    run(m, 1);
    expect(crate).toMatchObject({ hp: 30, hitlag: 0 });
    expect(a.hitlag).toBe(0);
    expect(stream.dead).toBe(false);
  });
});
