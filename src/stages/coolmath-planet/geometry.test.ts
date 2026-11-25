import { describe, expect, it } from 'vitest';
import { compileStage, edgeMaxX, edgeMinX } from '../../sim/stage';
import { placeInAir, testMatch, until } from '../../sim/testing/sim';
import { stage } from './geometry';

describe('Coolmath Planet geometry', () => {
  const compiled = compileStage(stage);

  it('is Final Destination: 160 wide, no platforms, top blast zone 180', () => {
    const floors = compiled.edges.filter((e) => e.kind === 'floor');
    expect(floors).toHaveLength(1);
    const floor = floors[0]!;
    expect([edgeMinX(floor), edgeMaxX(floor), floor.a.y, floor.b.y]).toEqual([-80, 80, 0, 0]);
    expect(stage.platforms).toEqual([]);
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 180, bottom: -140 });
  });

  it('lands a fighter anywhere on the ring', () => {
    for (const x of [-70, -30, 0, 30, 70]) {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x, 40);
      until(m, (g) => g.ground !== null);
      expect(f.ground?.kind).toBe('solid');
      expect(f.pos.y).toBeCloseTo(0);
    }
  });

  it('grabs both ring ends', () => {
    for (const [x, facing, index] of [
      [-83, -1, 0],
      [83, 1, 1],
    ] as const) {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x, 4, facing);
      until(m, (g) => g.action === 'ledgeCatch');
      expect(f.ledge).toBe(index);
      expect(compiled.ledgeSolid[index]).toBe(0);
    }
  });
});
