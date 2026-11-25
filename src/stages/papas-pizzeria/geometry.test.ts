import { describe, expect, it } from 'vitest';
import { compileStage, edgeMaxX, edgeMinX } from '../../sim/stage';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { stage } from './geometry';

describe("Papa's Pizzeria geometry", () => {
  const compiled = compileStage(stage);

  it('is sized against Battlefield: a 150-wide counter at y = 0 with Battlefield blast zones', () => {
    const floors = compiled.edges.filter((e) => e.kind === 'floor');
    expect(floors).toHaveLength(1);
    const floor = floors[0]!;
    expect([edgeMinX(floor), edgeMaxX(floor), floor.a.y, floor.b.y]).toEqual([-75, 75, 0, 0]);
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 192, bottom: -140 });
    expect(stage.ledges.map((l) => [l.x, l.y, l.side])).toEqual([
      [-75, 0, -1],
      [75, 0, 1],
    ]);
  });

  it('has the roster topping platforms: two 36-wide pepperoni slices at 26, a 30-wide mushroom cap at 50', () => {
    expect(stage.platforms.map((p) => [p.x2 - p.x1, p.y])).toEqual([
      [36, 26],
      [30, 50],
      [36, 26],
    ]);
  });

  it('lands a fighter on the counter and on every topping', () => {
    for (const [x, from, y] of [
      [0, 15, 0],
      [-45, 60, 26],
      [45, 60, 26],
      [0, 90, 50],
    ] as const) {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x, from);
      until(m, (g) => g.ground !== null);
      expect(f.pos.y).toBeCloseTo(y);
    }
  });

  it('drops through a topping on a down flick', () => {
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, -45, 60);
    until(m, (g) => g.action === 'idle');
    expect(f.ground?.kind).toBe('platform');
    run(m, 1, { y: -100 });
    expect(f.ground).toBeNull();
    until(m, (g) => g.ground !== null);
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos.y).toBeCloseTo(0);
  });

  it('grabs both counter ledges', () => {
    for (const [x, facing, index] of [
      [-78, -1, 0],
      [78, 1, 1],
    ] as const) {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x, 4, facing);
      until(m, (g) => g.action === 'ledgeCatch');
      expect(f.ledge).toBe(index);
      expect(compiled.ledgeSolid[index]).toBe(0);
    }
  });
});
