import { describe, expect, it } from 'vitest';
import type { FighterState } from '../../sim/fighter';
import { createMatch } from '../../sim/match';
import { placeInAir, run, runPorts, testMatch, until } from '../../sim/testing/sim';

const ID = 'bob-the-robber';
const landed = (damage: number) => damage * 1.2 * 1.05;

describe('Bob the Robber: Baton Twirl Rush (side special)', () => {
  it('advances about 40 units on the ground', () => {
    const m = testMatch({ fighter: ID, x: -40 });
    const f = m.fighters[0]!;
    f.facing = 1;
    const x0 = f.pos.x;
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f.move).toBe('sideB');
    until(m, (g) => g.move !== 'sideB');
    expect(f.pos.x - x0).toBeGreaterThan(35);
    expect(f.pos.x - x0).toBeLessThan(45);
  });

  it.each([0, 60, 120])(
    'carries a Mario at %i percent through all five twirls into the bonk: 12.5 in all',
    (percent) => {
      const m = createMatch({
        seed: 1,
        stage: 'battlefield',
        stocks: 3,
        ports: [{ fighter: ID }, { fighter: 'reference-mario' }],
      });
      runPorts(m, 10, [{}, {}]);
      const [a, v] = m.fighters as [FighterState, FighterState];
      Object.assign(a, { pos: { x: -40, y: 0 }, facing: 1 });
      Object.assign(v, {
        pos: { x: -30, y: 0 },
        ground: { ...a.ground! },
        action: 'idle',
        intangible: 0,
        damage: percent,
      });
      a.prevPos = { ...a.pos };
      v.prevPos = { ...v.pos };
      runPorts(m, 1, [{ x: 100, buttons: ['special'] }, {}]);
      expect(a.move).toBe('sideB');
      let hits = 0;
      let last = percent;
      for (let i = 0; i < 70; i++) {
        runPorts(m, 1, [{}, {}]);
        if (v.damage > last) hits++;
        last = v.damage;
      }
      expect(hits).toBe(6);
      expect(v.damage - percent).toBeCloseTo(landed(12.5), 6);
      expect(v.kb.x).toBeGreaterThan(0);
      expect(v.kb.y).toBeGreaterThan(0);
    },
  );

  it('in the air it carries Bob forward without holding him up', () => {
    const fall = (special: boolean) => {
      const m = testMatch({ fighter: ID });
      const f = placeInAir(m, -140, 60, 1);
      run(m, 1, special ? { x: 100, buttons: ['special'] } : {});
      run(m, 40);
      return f.pos;
    };
    const rush = fall(true);
    const drop = fall(false);
    expect(rush.y).toBeLessThanOrEqual(drop.y + 1e-9);
    expect(rush.x - drop.x).toBeGreaterThan(30);
  });
});

describe('Bob the Robber: Grappling Hook (up special)', () => {
  it('zips about 55 units up, then leaves Bob helpless', () => {
    const m = testMatch({ fighter: ID });
    const f = placeInAir(m, 0, 60, 1);
    const y0 = f.pos.y;
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    let top = y0;
    until(m, (g) => {
      top = Math.max(top, g.pos.y);
      return g.action === 'helpless';
    });
    expect(top - y0).toBeGreaterThan(48);
    expect(top - y0).toBeLessThan(62);
  });

  it('holding forward flattens the line and holding back steepens it', () => {
    const reach = (x: number) => {
      const m = testMatch({ fighter: ID });
      const f = placeInAir(m, 0, 60, 1);
      run(m, 1, { y: 100, buttons: ['special'] });
      run(m, 30, { x });
      return f.pos.x;
    };
    expect(reach(100)).toBeGreaterThan(reach(0) + 8);
    expect(reach(-100)).toBeLessThan(reach(0) - 8);
  });

  it.each([
    ['forward', 100, 55],
    ['neutral', 0, 70],
    ['back', -100, 85],
  ] as const)(
    'held %s at the start, the zip keeps a straight line, whatever the stick does after',
    (_, x, deg) => {
      const m = testMatch({ fighter: ID });
      const f = placeInAir(m, 0, 60, 1);
      run(m, 1, { y: 100, buttons: ['special'] });
      run(m, 13, { x });
      const path: { x: number; y: number }[] = [];
      for (let i = 0; i < 12; i++) {
        run(m, 1, { x: i % 2 ? 100 : -100 });
        path.push({ ...f.pos });
      }
      for (let i = 1; i < path.length; i++) {
        const step = (Math.atan2(path[i]!.y - path[i - 1]!.y, path[i]!.x - path[i - 1]!.x) * 180) / Math.PI;
        expect(Math.abs(step - deg)).toBeLessThan(2.5);
      }
    },
  );

  it('from the ground it hangs at floor level while the hook flies, then zips and ends helpless', () => {
    const m = testMatch({ fighter: ID });
    const f = m.fighters[0]!;
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    const y0 = f.pos.y;
    until(m, (g) => g.actionFrame === 13);
    expect(f.move).toBe('upB');
    expect(f.pos.y).toBeGreaterThanOrEqual(y0);
    until(m, (g) => g.action === 'helpless');
    expect(f.pos.y - y0).toBeGreaterThan(48);
  });

  it('recovers to the ledge from well below it', () => {
    const m = testMatch({ fighter: ID });
    const f = placeInAir(m, 96, -40, -1);
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    until(m, (g) => g.action === 'ledgeHang' || g.action === 'helpless');
    expect(f.action).toBe('ledgeHang');
  });

  it('lands out of the helpless fall with its own landing lag', () => {
    const m = testMatch({ fighter: ID });
    const f = m.fighters[0]!;
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    until(m, (g) => g.ground !== null && g.action === 'land');
    expect(f.landingLag).toBe(22);
  });
});
