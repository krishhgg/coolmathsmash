import { describe, expect, it } from 'vitest';
import { RESPAWN_DELAY, RESPAWN_PLATFORM_MAX } from '../../sim/constants';
import { compileStage, edgeMaxX, edgeMinX } from '../../sim/stage';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { stage } from './geometry';

describe("Johnny's Level", () => {
  it('has a 170-unit solid floor with a 6-unit drop on its right third', () => {
    const { edges, ledgeSolid } = compileStage(stage);
    const floors = edges
      .filter((e) => e.kind === 'floor')
      .sort((a, b) => edgeMinX(a) - edgeMinX(b))
      .map((e) => [edgeMinX(e), edgeMaxX(e), e.a.y, e.b.y]);
    expect(stage.solids).toHaveLength(1);
    expect(floors).toEqual([
      [-85, 85 / 3, 0, 0],
      [85 / 3, 85, -6, -6],
    ]);
    expect(stage.ledges).toEqual([
      { x: -85, y: 0, side: -1 },
      { x: 85, y: -6, side: 1 },
    ]);
    expect(ledgeSolid).toEqual([0, 0]);
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 192, bottom: -140 });
  });

  it('keeps fighters grounded while crossing the step in either direction', () => {
    const m = testMatch({ stage: stage.id, x: 20 });
    const f = m.fighters[0]!;
    until(m, (g) => g.pos.x >= 34, { x: 60 }, 60);
    expect(f.pos.y).toBe(-6);
    expect(f.ground?.kind).toBe('solid');
    until(m, (g) => g.pos.x <= 22, { x: -60 }, 60);
    expect(f.pos.y).toBe(0);
    expect(f.ground?.kind).toBe('solid');
  });

  it.each([
    { x1: -68, x2: -32, floor: 0 },
    { x1: 32, x2: 68, floor: -6 },
  ])('lets fighters land on and drop through the platform spanning $x1 to $x2', ({ x1, x2, floor }) => {
    const index = x1 < 0 ? 0 : 1;
    expect(stage.platforms[index]).toEqual({ x1, x2, y: 26 });
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, (x1 + x2) / 2, 40);
    until(m, (g) => g.action === 'idle', {}, 60);
    expect(f.pos.y).toBe(26);
    expect(f.ground).toEqual({ kind: 'platform', index });
    run(m, 1, { y: -100 });
    until(m, (g) => g.ground?.kind === 'solid', {}, 60);
    expect(f.pos.y).toBe(floor);
  });

  it.each([0, 1])('lets fighters catch outer ledge %i from outside', (index) => {
    const ledge = stage.ledges[index]!;
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, ledge.x + ledge.side * 5, ledge.y + 4, ledge.side === -1 ? 1 : -1);
    until(m, (g) => g.action === 'ledgeCatch', {}, 60);
    expect(f.ledge).toBe(index);
    expect(f.facing).toBe(-ledge.side);
  });

  it('settles all four starting and respawning fighters on safe surfaces', () => {
    const m = testMatch({ stage: stage.id, players: 4 });
    expect(m.fighters.map((f) => f.pos.y)).toEqual([0, -6, 0, 0]);
    for (const f of m.fighters) {
      expect(f.ground?.kind).toBe('solid');
      f.ground = null;
      f.pos.y = stage.blastZones.bottom - 1;
    }

    run(m, RESPAWN_DELAY + 2);
    expect(m.fighters.map((f) => f.action)).toEqual(Array(4).fill('respawn'));
    expect(new Set(m.fighters.map((f) => f.pos.x)).size).toBe(4);
    run(m, RESPAWN_PLATFORM_MAX + 90);
    expect(m.fighters.map((f) => f.pos.y)).toEqual([0, 0, 26, 26]);
    expect(m.fighters.map((f) => f.stocks)).toEqual([2, 2, 2, 2]);
    expect(m.fighters.every((f) => f.ground !== null)).toBe(true);
  });
});
