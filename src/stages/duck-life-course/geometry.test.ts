import { describe, expect, it } from 'vitest';
import { placeInAir, run, runPorts, testMatch, until } from '../../sim/testing/sim';
import { stage as battlefield } from '../battlefield/geometry';
import { stage } from './geometry';

describe('Duck Life Course competitive layout', () => {
  it('uses Battlefield platform spacing and blast zones without active stage pieces', () => {
    expect(stage.platforms).toEqual(battlefield.platforms);
    expect(stage.blastZones).toEqual(battlefield.blastZones);
    expect(stage.ledges).toEqual(battlefield.ledges);
    expect(stage.solids).toHaveLength(1);
    expect(stage.solids[0]).not.toHaveProperty('motion');
    expect(stage.solids[0]).not.toHaveProperty('schedule');
  });

  it.each(stage.platforms.map((p, index) => ({ ...p, index })))(
    'lands on lane $index from above and drops through onto the track',
    ({ x1, x2, y, index }) => {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, (x1 + x2) / 2, y + 16);
      until(m, (g) => g.action === 'idle', {}, 90);
      expect(f.ground).toEqual({ kind: 'platform', index });
      expect(f.pos.y).toBeCloseTo(y);

      run(m, 1, { y: -100 });
      expect(f.ground).toBeNull();
      until(m, (g) => g.ground !== null, {}, 90);
      expect(f.ground?.kind).toBe('solid');
      expect(f.pos.y).toBe(0);
    },
  );

  it.each(stage.ledges.map((ledge, index) => ({ ...ledge, index })))(
    'catches and climbs back onto the track from ledge $index',
    ({ x, y, side, index }) => {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x + side * 5, y + 4, side === -1 ? 1 : -1);
      until(m, (g) => g.action === 'ledgeHang', {}, 60);
      expect(f.ledge).toBe(index);
      expect(f.facing).toBe(-side);
      expect((f.pos.x - x) * side).toBeGreaterThan(0);

      run(m, 1, { x: -side * 100 });
      expect(f.action).toBe('ledgeClimb');
      until(m, (g) => g.action === 'idle', {}, 60);
      expect(f.ground?.kind).toBe('solid');
      expect(f.pos.y).toBe(y);
      expect((f.pos.x - x) * side).toBeLessThan(0);
    },
  );

  it('starts and respawns all four ports in distinct positions over the track', () => {
    const m = testMatch({ stage: stage.id, players: 4 });
    expect(new Set(stage.spawns.map(([x]) => x)).size).toBe(4);
    expect(new Set(stage.respawns.map(([x]) => x)).size).toBe(4);

    for (const [port, f] of m.fighters.entries()) {
      const [x, y, facing] = stage.spawns[port]!;
      expect(f.pos).toEqual({ x, y });
      expect(f.facing).toBe(facing);
      expect(f.ground?.kind).toBe('solid');
      f.ground = null;
      f.pos.y = stage.blastZones.bottom - 5;
      f.prevPos.y = f.pos.y;
      f.action = 'fall';
    }
    run(m, 1);
    expect(m.fighters.every((f) => f.action === 'ko' && f.stocks === 2)).toBe(true);
    until(m, (g) => g.action === 'respawn', {}, 150);
    for (const [port, f] of m.fighters.entries()) {
      const [x, y] = stage.respawns[port]!;
      expect(f.action).toBe('respawn');
      expect(f.pos).toEqual({ x, y });
    }
    run(m, 25);
    runPorts(
      m,
      1,
      m.fighters.map(() => ({ y: -100 })),
    );
    run(m, 90);
    expect(m.fighters.every((f) => f.ground !== null)).toBe(true);
  });
});
