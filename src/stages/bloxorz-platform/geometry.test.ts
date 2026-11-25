import { describe, expect, it } from 'vitest';
import { createMatch } from '../../sim/match';
import { posedStage } from '../../sim/movingStage';
import { compileStage, edgeMaxX, edgeMinX } from '../../sim/stage';
import { marioReference } from '../../sim/testing/reference';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { stage } from './geometry';

describe('Bloxorz Board geometry', () => {
  const compiled = compileStage(stage);

  it('is a 176-wide board in two solids with the 16-wide goal hole between x = -8 and 8', () => {
    const current = posedStage(testMatch({ stage: stage.id }));
    const floors = current.edges.filter((e) => e.kind === 'floor' && current.present.solids[e.solid]);
    expect(floors.map((e) => [edgeMinX(e), edgeMaxX(e), e.a.y, e.b.y])).toEqual([
      [-88, -8, 0, 0],
      [8, 88, 0, 0],
    ]);
    expect(compiled.ledgeSolid).toEqual([0, 1]);
  });

  it('has the roster bridge tiles: two 32-wide platforms at y = 26', () => {
    expect(stage.platforms.map((p) => [p.x2 - p.x1, p.y])).toEqual([
      [32, 26],
      [32, 26],
    ]);
  });

  it('lands a fighter on both halves and on the bridges', () => {
    for (const [x, from, y] of [
      [-75, 40, 0],
      [75, 40, 0],
      [-50, 66, 26],
      [50, 66, 26],
    ] as const) {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x, from);
      until(m, (g) => g.ground !== null);
      expect(f.pos.y).toBeCloseTo(y);
    }
  });

  it('drops through the goal hole to the bottom blast zone instead of landing', () => {
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, 0, 30);
    until(m, (g) => g.action === 'ko', {}, 400);
    expect(f.pos.y).toBeLessThan(stage.blastZones.bottom);
  });

  it('walks off the tile edge into the hole', () => {
    const m = testMatch({ stage: stage.id, x: -26 });
    const f = m.fighters[0]!;
    run(m, 1, { x: 100 });
    until(m, (g) => g.ground === null, { x: 100 });
    expect(f.pos.x).toBeGreaterThan(-12);
    expect(f.pos.x).toBeLessThan(0);
  });

  it('fills the hole and lets a fighter land and cross it with hazards off', () => {
    const m = createMatch({
      seed: 1,
      stage: stage.id,
      stocks: 3,
      hazards: false,
      ports: [{ fighter: marioReference.id }],
    });
    const f = placeInAir(m, 0, 30);
    until(m, (g) => g.action === 'idle');
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos).toEqual({ x: 0, y: 0 });
    for (let i = 0; i < 17; i++) {
      run(m, 1, { x: 100 });
      expect(f.ground?.kind).toBe('solid');
    }
    expect(f.pos.x).toBeGreaterThan(8);
    expect(m.stage.platforms.every((p) => p.on)).toBe(true);
  });

  it('lands P1 safely after the respawn platform times out with no input', () => {
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, 0, stage.blastZones.bottom - 1);
    until(m, (g) => g.action === 'respawn');
    until(m, (g) => g.ground !== null);
    expect(f.ground?.kind).toBe('solid');
    expect(f.stocks).toBe(2);
  });

  it('drops through each bridge and lands on the board below it', () => {
    for (const x of [-50, 50]) {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x, 60);
      until(m, (g) => g.action === 'idle');
      expect(f.ground?.kind).toBe('platform');
      run(m, 1, { y: -100 });
      expect(f.ground).toBeNull();
      until(m, (g) => g.ground !== null);
      expect(f.ground?.kind).toBe('solid');
      expect(f.pos.y).toBeCloseTo(0);
    }
  });

  it('grabs the two outer ledges', () => {
    for (const [x, facing, index] of [
      [-91, -1, 0],
      [91, 1, 1],
    ] as const) {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x, 4, facing);
      until(m, (g) => g.action === 'ledgeCatch');
      expect(f.ledge).toBe(index);
    }
  });
});
