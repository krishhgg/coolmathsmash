import { describe, expect, it } from 'vitest';
import { stageStateAt } from '../../sim/movingStage';
import { compileStage } from '../../sim/stage';
import { compiledStage } from '../../sim/step';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { registerStage } from '../registry';
import { hazardStage, isBraking, ROAD } from './hazardGeometry';

const testId = 'test-moving-truck-convoy';
registerStage({ ...hazardStage, id: testId });

describe('Truck Convoy with hazards on', () => {
  it('has three 72-unit decks, 24-unit roofs and two attached ledges per truck', () => {
    expect(hazardStage.solids.slice(0, 3).map(({ points }) => points[1]![0] - points[0]![0])).toEqual([
      72, 72, 72,
    ]);
    expect(hazardStage.platforms.map(({ x1, x2, y }) => [x2 - x1, y])).toEqual([
      [24, 22],
      [24, 22],
      [24, 22],
    ]);
    expect(compileStage(hazardStage).ledgeSolid).toEqual([0, 0, 1, 1, 2, 2]);
    expect(hazardStage.blastZones).toEqual({ left: -220, right: 220, top: 192, bottom: -110 });
  });

  it('keeps positive moving gaps and synchronises each roof throughout the full rotation', () => {
    let gap = Infinity;
    for (let frame = 0; frame <= 3 * 1800 + 240; frame++) {
      const { solids, platforms } = stageStateAt(hazardStage, frame);
      for (const [i, p] of platforms.entries()) {
        expect(p).toEqual(solids[i]);
        if (i > 0) {
          const left = hazardStage.solids[i]!.points[0]![0] + solids[i]!.x;
          const priorRight = hazardStage.solids[i - 1]!.points[1]![0] + solids[i - 1]!.x;
          gap = Math.min(gap, left - priorRight);
        }
      }
    }
    expect(gap).toBeGreaterThan(3);
  });

  it('warns for one second, rotates one absence at a time, and returns each truck after four seconds', () => {
    const absences = [0, 0, 0];
    for (let frame = 0; frame < 6 * 1800 + 240; frame++) {
      const gone = stageStateAt(hazardStage, frame)
        .solids.slice(0, 3)
        .flatMap((s, i) => (s.on ? [] : [i]));
      const event = Math.floor(frame / 1800);
      expect(gone).toEqual(event > 0 && frame % 1800 < 240 ? [(event - 1) % 3] : []);
      for (const i of gone) absences[i]!++;
    }
    expect(absences).toEqual([480, 480, 480]);
    for (let i = 0; i < 3; i++) {
      const off = (i + 1) * 1800;
      expect(isBraking(i, off - 61)).toBe(false);
      for (let f = off - 60; f < off; f++) {
        expect([0, 1, 2].filter((j) => isBraking(j, f))).toEqual([i]);
      }
      expect(isBraking(i, off)).toBe(false);
    }
  });

  it('carries a deck rider and drops them into a fall on disappearance', () => {
    const m = testMatch({ stage: testId });
    const f = m.fighters[0]!;
    const start = f.pos.x - m.stage.solids[0]!.x;
    run(m, 80);
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos.x).not.toBeCloseTo(hazardStage.spawns[0]![0]);
    expect(f.pos.x - m.stage.solids[0]!.x).toBeCloseTo(start, 8);
    run(m, 1800 - m.frame);
    expect(f.action).toBe('fall');
    expect(f.ground).toBeNull();
    expect(m.events).toContainEqual({ type: 'stagePiece', piece: 'solid', index: 0, on: false });
    expect(m.events).toContainEqual({ type: 'stagePiece', piece: 'platform', index: 0, on: false });
  });

  it('carries a roof rider who lands while the truck is drifting', () => {
    const m = testMatch({ stage: testId });
    const f = placeInAir(m, hazardStage.spawns[0]![0], 42);
    until(m, ({ action }) => action === 'idle');
    expect(f.ground).toEqual({ kind: 'platform', index: 0 });
    const start = f.pos.x - m.stage.platforms[0]!.x;
    run(m, 80);
    expect(f.ground).toEqual({ kind: 'platform', index: 0 });
    expect(f.pos.x - m.stage.platforms[0]!.x).toBeCloseTo(start, 8);
  });

  it('moves a hanging fighter with the ledge', () => {
    const m = testMatch({ stage: testId });
    const f = placeInAir(m, hazardStage.ledges[0]!.x + m.stage.solids[0]!.x - 4, 4);
    until(m, ({ action }) => action === 'ledgeHang');
    expect(f.ledge).toBe(0);
    const start = f.pos.x - m.stage.solids[0]!.x;
    run(m, 20);
    expect(f.action).toBe('ledgeHang');
    expect(f.pos.x - m.stage.solids[0]!.x).toBeCloseTo(start, 8);
  });

  it('carries a road rider left at four units per frame to the blast zone', () => {
    const m = testMatch({ stage: testId });
    const f = placeInAir(m, -195, ROAD.y + 6);
    until(m, ({ ground }) => ground !== null);
    expect(f.pos.y).toBeCloseTo(ROAD.y);
    expect(f.ground?.kind).toBe('solid');
    expect(compiledStage(testId).edges[f.ground!.index]!.solid).toBe(3);
    const x = f.pos.x;
    run(m, 3);
    expect(f.pos.x).toBeCloseTo(x - 12);
    until(m, ({ action }) => action === 'ko');
    expect(m.events).toContainEqual(expect.objectContaining({ type: 'ko', side: 'left' }));
  });
});
