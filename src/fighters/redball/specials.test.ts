import { describe, expect, it } from 'vitest';
import type { FighterState } from '../../sim/fighter';
import { placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { versusMario } from './versus';
import { BOUNCE_SPEED, REV_FROM, REV_MAX, ROLLS } from './specials';
import { stats } from './stats';

const redball = () => testMatch({ fighter: 'redball' });
const SPECIAL: Hold = { buttons: ['special'] };

/** Press neutral special and hold it `held` frames in all; returns the roll it lets go into. */
function rev(held: number) {
  const m = redball();
  const f = m.fighters[0]!;
  run(m, 1, SPECIAL);
  expect(f.move).toBe('neutralB');
  run(m, held - 1, SPECIAL);
  until(m, (g) => g.move !== 'neutralB');
  return { m, f, move: f.move };
}

describe('Red Ball: Charge Roll (neutral special)', () => {
  it('a tap rolls weakest, a longer rev rolls harder, and a full rev lets go by itself', () => {
    expect(rev(1).move).toBe('chargeRoll1');
    expect(rev(REV_FROM + 25).move).toBe('chargeRoll2');
    expect(rev(REV_FROM + 50).move).toBe('chargeRoll3');
    const full = redball();
    const g = full.fighters[0]!;
    run(full, 1, SPECIAL);
    const frames = until(full, (h) => h.move !== 'neutralB', SPECIAL);
    expect(g.move).toBe('chargeRoll3');
    expect(frames).toBe(REV_FROM + REV_MAX - 1);
  });

  it('the harder the roll, the faster and further it goes', () => {
    const distance = (held: number) => {
      const { m, f } = rev(held);
      const x0 = f.pos.x;
      run(m, 20);
      return Math.abs(f.pos.x - x0);
    };
    const [weak, mid, full] = [1, REV_FROM + 25, REV_FROM + 60].map(distance);
    expect(mid).toBeGreaterThan(weak!);
    expect(full).toBeGreaterThan(mid!);
    expect(weak).toBeGreaterThan(ROLLS[0].speed * 18);
  });

  it.each(ROLLS.map((r, i) => [r.move, r.damage, [1, REV_FROM + 25, REV_FROM + 60][i]!] as const))(
    '%s deals %i%% and bounces Red Ball back off the target',
    (move, damage, held) => {
      const { m, a, v } = versusMario();
      Object.assign(v, {
        pos: { x: a.pos.x + 40 * a.facing, y: 0 },
        prevPos: { x: a.pos.x + 40 * a.facing, y: 0 },
      });
      runPorts(m, 1, [SPECIAL, {}]);
      runPorts(m, held - 1, [SPECIAL, {}]);
      for (let i = 0; i < 80 && a.move !== move; i++) runPorts(m, 1, [{}, {}]);
      expect(a.move).toBe(move);
      for (let i = 0; i < 80 && v.damage === 0; i++) runPorts(m, 1, [{}, {}]);
      expect(v.damage).toBeCloseTo(damage * 1.05 * 1.2, 6);
      for (let i = 0; i < 40 && a.action !== 'fall'; i++) runPorts(m, 1, [{}, {}]);
      expect(a.action).toBe('fall');
      expect(Math.sign(a.vel.x)).toBe(-a.facing);
    },
  );

  it('jump cancels the roll on the ground and keeps some of its speed', () => {
    const { m, f } = rev(REV_FROM + 60);
    run(m, 8);
    run(m, 1, { buttons: ['jump'] });
    expect(f.action).toBe('jumpSquat');
    until(m, (g) => g.ground === null);
    expect(Math.abs(f.vel.x)).toBeGreaterThan(1);
  });

  it('rolls through the air and keeps rolling when it lands', () => {
    const m = redball();
    const f = placeInAir(m, -40, 12);
    run(m, 1, SPECIAL);
    until(m, (g) => g.move !== 'neutralB');
    expect(f.move).toBe('chargeRoll1');
    until(m, (g) => g.ground !== null);
    expect(f.move).toBe('chargeRoll1');
    expect(f.action).toBe('attack');
  });
});

describe('Red Ball: Mega Bounce (up special)', () => {
  it('squashes, then springs about 80 units up and ends helpless with 22 frames of landing lag', () => {
    const m = redball();
    const f: FighterState = m.fighters[0]!;
    const y0 = f.pos.y;
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    let top = y0;
    until(m, (g) => {
      top = Math.max(top, g.pos.y);
      return g.ground !== null && g.action === 'land';
    });
    expect(top - y0).toBeGreaterThan(75);
    expect(top - y0).toBeLessThan(85);
    expect(f.landingLag).toBe(22);
  });

  it('stalls a fall while it squashes, then springs', () => {
    const m = redball();
    const f = placeInAir(m, 0, 80);
    run(m, 20);
    expect(f.vel.y).toBeLessThan(-1);
    run(m, 1, { y: 100, buttons: ['special'] });
    run(m, 3);
    expect(f.vel.y).toBeGreaterThanOrEqual(-0.1);
    until(m, (g) => g.actionFrame === 8);
    expect(f.vel.y).toBeCloseTo(BOUNCE_SPEED - stats.gravity, 6);
  });
});
