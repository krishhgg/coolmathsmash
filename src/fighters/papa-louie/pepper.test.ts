import { describe, expect, it } from 'vitest';
import { spawnEntity } from '../../sim/entities/entities';
import { attack, runPorts } from '../../sim/testing/sim';
import { versus } from './testing';

const BOMB = 'papa-louie/pepperBomb';
const BURST = 'papa-louie/pepperBurst';

describe('Papa Louie: Pepper Bomb', () => {
  it('throws a bomb on frame 14 and lobs it up and forward', () => {
    const m = versus();
    const f = m.fighters[0]!;
    attack(m, 0, 'neutralB');
    runPorts(m, 13, [{}, {}]);
    expect(m.entities).toHaveLength(0);
    runPorts(m, 1, [{}, {}]);
    const [bomb] = m.entities;
    expect(f.actionFrame).toBe(14);
    expect(bomb).toMatchObject({ kind: BOMB, owner: 0, age: 1, facing: f.facing, move: 'neutralB' });
    expect(bomb!.pos.x).toBeCloseTo(f.pos.x + f.facing * 6);
    expect(bomb!.pos.y).toBeCloseTo(f.pos.y + 9);
    expect(bomb!.vel.x * f.facing).toBeGreaterThan(0);
    expect(bomb!.vel.y).toBeGreaterThan(0);
  });

  it('bounces twice on the floor and then bursts on the third landing', () => {
    const m = versus();
    const bomb = spawnEntity(m, { kind: BOMB, owner: 0, pos: { x: -60, y: 20 } });
    for (let i = 0; i < 100 && !bomb.dead; i++) runPorts(m, 1, [{}, {}]);
    expect(bomb.dead).toBe(true);
    expect(bomb.data.bounces).toBe(3);
    const [burst] = m.entities;
    expect(burst).toMatchObject({ kind: BURST, pos: { x: -60, y: 1.5 }, age: 1, owner: 0 });
    runPorts(m, 1, [{}, {}]);
    expect(m.entities).toHaveLength(0);
  });

  it('skips the throw if two bombs are already in flight', () => {
    const m = versus();
    for (const x of [-60, 60]) spawnEntity(m, { kind: BOMB, owner: 0, pos: { x, y: 45 } });
    attack(m, 0, 'neutralB');
    runPorts(m, 14, [{}, {}]);
    expect(m.entities.map((e) => e.id)).toEqual([1, 2]);
    expect(m.nextEntityId).toBe(3);
  });

  it('bursts on contact and deals a fresh 10% projectile hit', () => {
    const m = versus();
    const v = m.fighters[1]!;
    const bomb = spawnEntity(m, {
      kind: BOMB,
      owner: 0,
      pos: { x: v.pos.x, y: v.pos.y + 7 },
      move: 'neutralB',
    });
    runPorts(m, 1, [{}, {}]);
    expect(v.damage).toBeCloseTo(10 * 1.05 * 1.2, 6);
    expect(bomb.dead).toBe(true);
  });
});
