import { describe, expect, it } from 'vitest';
import { placeInAir, run, runPorts, stage, testMatch, until, type Hold } from '../../sim/testing/sim';
import { versusMario } from './ko';

const LASH: Hold = { x: 100, buttons: ['special'] };
const SHIELD: Hold = { buttons: ['shield'] };

describe('Red Ball: Tongue Lash', () => {
  it('catches a shielding fighter from tongue range on frame 12, reels them in, and releases for 6%', () => {
    const { m, a, v } = versusMario();
    const start = a.pos.x + 25;
    v.pos.x = v.prevPos.x = start;
    runPorts(m, 1, [LASH, SHIELD]);
    expect(a.move).toBe('sideB');
    runPorts(m, 10, [{}, SHIELD]);
    expect(v.action).toBe('shield');
    expect(v.pos.x).toBe(start);
    runPorts(m, 1, [{}, SHIELD]);
    expect(m.events).toContainEqual(expect.objectContaining({ type: 'commandGrab', move: 'sideB' }));
    expect(a.move).toBe('tongueLashPull');
    expect(v.action).toBe('grabbed');
    expect(v.pos.x - a.pos.x).toBeLessThan(15);
    until(m, () => v.damage !== 0);
    expect(v.damage).toBeCloseTo(6 * 1.05 * 1.2);
  });

  it.each([-1, 1] as const)('reels in toward the ledge on side %i', (side) => {
    const m = testMatch({ fighter: 'redball' });
    const ledge = stage().geo.ledges.find((l) => l.side === side)!;
    const f = placeInAir(m, ledge.x + side * 22, ledge.y - 12, -side as 1 | -1);
    run(m, 1, { ...LASH, x: -side * 100 });
    expect(f.move).toBe('sideB');
    expect(until(m, (g) => g.action === 'ledgeCatch')).toBeLessThan(20);
    expect(f.pos.x).toBeCloseTo(ledge.x + side * 5.5);
    expect(f.ledgeGrabs).toBe(1);
  });

  it.each([
    { name: 'out of tongue range', offset: 32, lock: 0 },
    { name: 'under a regrab lockout', offset: 22, lock: 45 },
  ])('cannot reel toward the ledge when $name', ({ offset, lock }) => {
    const m = testMatch({ fighter: 'redball' });
    const ledge = stage().geo.ledges.find((l) => l.side === 1)!;
    const x = ledge.x + offset;
    const f = placeInAir(m, x, ledge.y - 12, -1);
    f.ledgeLock = lock;
    run(m, 1, { ...LASH, x: -100 });
    run(m, 25);
    expect(f.ledge).toBe(-1);
    expect(f.pos.x).toBeGreaterThan(x - 2);
  });
});
