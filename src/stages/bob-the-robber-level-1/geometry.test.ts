import { describe, expect, it } from 'vitest';
import { getStage } from '../registry';
import { compileStage, edgeMaxX, edgeMinX } from '../../sim/stage';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { stage } from './geometry';

describe("Bob's First Heist", () => {
  it('registers one 180-unit floor, two soft tiers and Battlefield blast zones', () => {
    expect(getStage('bob-the-robber-level-1')).toBe(stage);
    const compiled = compileStage(stage);
    const floors = compiled.edges.filter((edge) => edge.kind === 'floor');
    expect(floors.map((floor) => [edgeMinX(floor), edgeMaxX(floor), floor.a.y, floor.b.y])).toEqual([
      [-90, 90, 0, 0],
    ]);
    expect(stage.platforms).toEqual([
      { x1: -60, x2: 60, y: 38 },
      { x1: -20, x2: 20, y: 76 },
    ]);
    expect(stage.ledges).toHaveLength(2);
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 192, bottom: -140 });
  });

  it('lands on the vent and can drop through each tier to the solid floor', () => {
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, 0, 90);
    until(m, (fighter) => fighter.action === 'idle');
    expect(f.ground).toEqual({ kind: 'platform', index: 1 });
    expect(f.pos.y).toBe(76);

    run(m, 1, { y: -100 });
    until(m, (fighter) => fighter.action === 'idle');
    expect(f.ground).toEqual({ kind: 'platform', index: 0 });
    expect(f.pos.y).toBe(38);

    run(m, 1, { y: -100 });
    until(m, (fighter) => fighter.action === 'idle');
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos.y).toBe(0);
  });

  it('double-jumps through each soft platform from below', () => {
    const m = testMatch({ stage: stage.id, x: 0 });
    const f = m.fighters[0]!;
    for (const [index, y] of [38, 76].entries()) {
      run(m, 10, { buttons: ['jump'] });
      run(m, 1);
      run(m, 30, { buttons: ['jump'] });
      expect(f.pos.y).toBeGreaterThan(y);
      until(m, (fighter) => fighter.action === 'idle');
      expect(f.ground).toEqual({ kind: 'platform', index });
      expect(f.pos.y).toBe(y);
      run(m, 1);
    }
  });

  it.each([
    [-90, -1, 0],
    [90, 1, 1],
  ] as const)('grabs the outer solid ledge at x=%s', (x, side, ledge) => {
    expect(stage.ledges[ledge]).toEqual({ x, y: 0, side });
    expect(compileStage(stage).ledgeSolid[ledge]).toBe(0);
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, x + 4 * side, 4);
    until(m, (fighter) => fighter.action === 'ledgeCatch');
    expect(f.ledge).toBe(ledge);
    expect(f.facing).toBe(-side);
  });

  it('starts and respawns all four ports on safe routes back to the floor', () => {
    const m = testMatch({ stage: stage.id, players: 4 });
    expect(stage.spawns).toHaveLength(4);
    expect(stage.respawns).toHaveLength(4);
    for (const f of m.fighters) {
      const [x, y, facing] = stage.spawns[f.port]!;
      expect(f.pos).toEqual({ x, y });
      expect(f.facing).toBe(facing);
      expect(f.ground?.kind).toBe('solid');
      Object.assign(f, { action: 'ko', respawnTimer: 1, ground: null });
    }
    run(m, 2);
    for (const f of m.fighters) {
      const [x, y] = stage.respawns[f.port]!;
      expect(f.action).toBe('respawn');
      expect(f.pos).toEqual({ x, y });
      expect(y).toBeGreaterThan(76);
      expect(y).toBeLessThan(stage.camera.top);
      expect(Math.abs(x)).toBeLessThan(60);
    }
    run(m, 400);
    expect(m.fighters.map((f) => f.ground)).toEqual([
      { kind: 'platform', index: 1 },
      { kind: 'platform', index: 1 },
      { kind: 'platform', index: 0 },
      { kind: 'platform', index: 0 },
    ]);
    expect(m.fighters.map((f) => f.stocks)).toEqual([3, 3, 3, 3]);
  });
});
