import { describe, expect, it } from 'vitest';
import { entityHitboxes, spawnEntity } from '../../sim/entities/entities';
import type { FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { attack, placeInAir, runPorts } from '../../sim/testing/sim';
import { PEPPER_HIT, entities } from './entities';
import { versus } from './testing';

const BOMB = 'papa-louie/pepperBomb';
const BURST = 'papa-louie/pepperBurst';
/** Snake's Hand Grenade explosion in Ultimate (SmashWiki, Snake (SSBU)/Neutral special). */
const GRENADE = { damage: 9, angle: 80, kbg: 69, bkb: 60 };

describe('Papa Louie: Pepper Bomb (neutral special)', () => {
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

  it('comes out of the special button on the ground and in the air, and he acts again on frame 40', () => {
    for (const air of [false, true]) {
      const m = versus();
      const f = air ? placeInAir(m, -30, 120) : m.fighters[0]!;
      runPorts(m, 1, [{ buttons: ['special'] }, {}]);
      expect(f.move).toBe('neutralB');
      runPorts(m, 13, [{}, {}]);
      expect(m.entities.map((e) => e.kind)).toEqual([BOMB]);
      runPorts(m, 25, [{}, {}]);
      expect(f.move).toBe('neutralB');
      runPorts(m, 1, [{}, {}]);
      expect(f.move).toBeNull();
    }
  });

  it('bounces twice on the floor and bursts on the third landing', () => {
    const m = versus();
    const bomb = spawnEntity(m, { kind: BOMB, owner: 0, pos: { x: -60, y: 20 } });
    const floorTouches: number[] = [];
    for (let i = 0; i < 100 && !bomb.dead; i++) {
      runPorts(m, 1, [{}, {}]);
      if (!bomb.dead && bomb.pos.y === 1.5) floorTouches.push(bomb.age);
    }
    expect(bomb.dead).toBe(true);
    expect(bomb.data.landings).toBe(3);
    expect(floorTouches).toHaveLength(3);
    const [burst] = m.entities;
    expect(burst).toMatchObject({ kind: BURST, pos: { x: -60, y: 1.5 }, age: 1, owner: 0 });
    expect(burst!.id).toBe(bomb.id + 1);
  });

  it('bursts for two frames like the grenade, growing by its 20/12, and then is gone', () => {
    const m = versus();
    spawnEntity(m, { kind: BURST, owner: 0, pos: { x: -60, y: 1.5 } });
    const radii: number[] = [];
    for (let i = 0; i < 3; i++) {
      radii.push(...m.entities.flatMap((e) => entityHitboxes(e).map((b) => b.box.radius)));
      runPorts(m, 1, [{}, {}]);
    }
    expect(radii).toHaveLength(2);
    expect(radii[0]).toBe(3.8);
    expect(radii[1]).toBeCloseTo((3.8 * 20) / 12, 9);
    expect(m.entities).toHaveLength(0);
    expect(entities.pepperBurst).toMatchObject({ transcendent: true, reflectable: false, absorbable: false });
  });

  it('bursts where it is when the 150-frame fuse runs out before its third landing', () => {
    const m = versus();
    expect(entities.pepperBomb!.lifetime).toBe(150);
    const bomb = spawnEntity(m, { kind: BOMB, owner: 0, pos: { x: 140, y: 150 } });
    runPorts(m, 149, [{}, {}]);
    expect(bomb.dead).toBe(false);
    const at = { ...bomb.pos };
    runPorts(m, 1, [{}, {}]);
    expect(bomb.dead).toBe(true);
    expect(m.entities).toMatchObject([{ kind: BURST, pos: at, age: 1 }]);
  });

  it('skips the throw if two bombs are already out', () => {
    const m = versus();
    for (const x of [-60, 60]) spawnEntity(m, { kind: BOMB, owner: 0, pos: { x, y: 45 } });
    attack(m, 0, 'neutralB');
    runPorts(m, 14, [{}, {}]);
    expect(m.entities.map((e) => e.id)).toEqual([1, 2]);
    expect(m.nextEntityId).toBe(3);
  });

  it('bursts on a fighter for a fresh 9% projectile hit and is used up', () => {
    const m = versus();
    const v = m.fighters[1]!;
    const bomb = spawnEntity(m, {
      kind: BOMB,
      owner: 0,
      pos: { x: v.pos.x, y: v.pos.y + 7 },
      move: 'neutralB',
    });
    runPorts(m, 1, [{}, {}]);
    expect(v.damage).toBeCloseTo(9 * 1.05 * 1.2, 6);
    expect(bomb.dead).toBe(true);
    expect(m.entities).toHaveLength(0);
  });
});

/**
 * The Mario reference at the Battlefield ledge, fresh, no rage, no DI, as in papa-louie.test.ts. The bomb takes
 * the grenade's whole hit, so it KOs where the grenade does; the second test lands a real bomb through the entity
 * path on either side of that percent.
 */
describe('Papa Louie: Pepper Bomb kill percent against Snake’s Hand Grenade', () => {
  const pepper = koPercent({ hit: PEPPER_HIT })!;

  it('KOs within 5 points of the grenade explosion', () => {
    expect(Math.abs(pepper - koPercent({ hit: GRENADE })!)).toBeLessThanOrEqual(5);
  });

  /** Mario at `percent` on the stage at `x`, hit by a bomb at his middle; true when the launch KOs him. */
  function bombKos(percent: number, x: number): boolean {
    const m: MatchState = versus();
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(a, { pos: { x: -40, y: a.pos.y }, prevPos: { x: -40, y: a.pos.y } });
    Object.assign(v, { pos: { x, y: v.pos.y }, prevPos: { x, y: v.pos.y }, damage: percent });
    spawnEntity(m, { kind: BOMB, owner: 0, pos: { x: x - 1, y: v.pos.y + 7 }, move: 'neutralB' });
    for (let i = 0; i < 400; i++) {
      runPorts(m, 1, [{}, {}]);
      if (v.action === 'ko') return true;
      if (v.damage > percent && v.hitlag === 0 && v.launch === null && v.hitstun <= 0) return false;
    }
    return false;
  }

  it.each([
    ['at the ledge', 70],
    ['at centre stage', 0],
  ])('a thrown bomb KOs Mario %s from 3 points above that percent and not 3 below', (_, x) => {
    expect(bombKos(pepper + 3, x)).toBe(true);
    expect(bombKos(pepper - 3, x)).toBe(false);
  });
});
