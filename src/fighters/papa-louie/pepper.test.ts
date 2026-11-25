import { describe, expect, it } from 'vitest';
import { spawnEntity } from '../../sim/entities/entities';
import { attack, runPorts } from '../../sim/testing/sim';
import { moves } from './moves';
import { versus } from './testing';

const bombs = (m: { entities: { kind: string }[] }) =>
  m.entities.filter((e) => e.kind === 'papa-louie/pepperBomb');

describe('Papa Louie: Pepper Bomb (neutral special)', () => {
  it('comes out of his hand on frame 14 at 10%', () => {
    expect(moves.neutralB!.spawn).toEqual([
      { frame: 14, entity: 'pepperBomb', x: 6, y: 9, vx: 2.1, vy: 2.4, max: 2 },
    ]);
    const m = versus();
    attack(m, 0, 'neutralB');
    const f = m.fighters[0]!;
    while (bombs(m).length === 0) runPorts(m, 1, [{}, {}]);
    expect(f.actionFrame).toBe(14);
    expect(bombs(m)[0]).toMatchObject({ owner: 0, age: 1, facing: 1, move: 'neutralB' });
    expect(bombs(m)[0]!.kind).toBe('papa-louie/pepperBomb');
    expect(m.entities[0]!.pos.y).toBeGreaterThan(f.pos.y + 8);
  });

  it('bounces twice on the floor, then bursts by itself', () => {
    const m = versus();
    const bomb = spawnEntity(m, {
      kind: 'papa-louie/pepperBomb',
      owner: 0,
      pos: { x: -60, y: 20 },
      vel: { x: 0, y: 0 },
    });
    let bounces = 0;
    let last = bomb.vel.y;
    while (!bomb.dead && bounces <= 3) {
      runPorts(m, 1, [{}, {}]);
      if (bomb.vel.y > 0 && last <= 0) bounces++;
      last = bomb.vel.y;
    }
    expect(bomb.dead).toBe(true);
    expect(bounces).toBe(2);
  });

  it('holds at two on screen', () => {
    const m = versus();
    attack(m, 0, 'neutralB');
    while (bombs(m).length < 1) runPorts(m, 1, [{}, {}]);
    runPorts(m, 40, [{}, {}]);
    attack(m, 0, 'neutralB');
    for (let i = 0; i < 40 && bombs(m).length < 2; i++) runPorts(m, 1, [{}, {}]);
    expect(bombs(m)).toHaveLength(2);
    runPorts(m, 40, [{}, {}]);
    attack(m, 0, 'neutralB');
    runPorts(m, 20, [{}, {}]);
    expect(bombs(m).length).toBeLessThanOrEqual(2);
  });

  it('bursts on a fighter it touches, for 10%', () => {
    const m = versus();
    const [a, v] = m.fighters as [
      { pos: { x: number; y: number } },
      { pos: { x: number; y: number }; damage: number },
    ];
    attack(m, 0, 'neutralB');
    while (bombs(m).length === 0) runPorts(m, 1, [{}, {}]);
    spawnEntity(m, {
      kind: 'papa-louie/pepperBomb',
      owner: 0,
      pos: { x: v.pos.x + 6, y: v.pos.y + 8 },
      move: null,
    });
    const before = bombs(m).length;
    runPorts(m, 3, [{}, {}]);
    expect(v.damage).toBeCloseTo(10 * 1.2, 6);
    expect(bombs(m).length).toBeLessThan(before + 1);
    expect(a.pos).toBeDefined();
  });
});
