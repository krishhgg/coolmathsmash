import { describe, expect, it } from 'vitest';
import { createMatch } from '../../sim/match';
import { compileStage } from '../../sim/stage';
import { marioReference } from '../../sim/testing/reference';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { stage } from './geometry';

describe('Construction Site collision', () => {
  it('has one continuous 160-unit floor and two outward ledges', () => {
    const { edges, ledgeSolid } = compileStage(stage);
    const floors = edges.filter((edge) => edge.kind === 'floor');
    expect(floors.map(({ a, b }) => [b.x, b.y, a.x, a.y])).toEqual([
      [-80, 0, -52, 0],
      [-52, 0, -28, 0],
      [-28, 0, 28, 0],
      [28, 0, 52, 0],
      [52, 0, 80, 0],
    ]);
    expect(ledgeSolid).toEqual([0, 4]);
    const match = testMatch({ stage: stage.id, players: 4 });
    expect(match.fighters.map((f) => f.ground?.kind)).toEqual(Array<string>(4).fill('solid'));
  });

  it('runs continuously across both closed trapdoors', () => {
    const match = testMatch({ stage: stage.id, x: -67 });
    const f = match.fighters[0]!;
    until(match, (g) => g.pos.x >= 60, { x: 100 }, 130);
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos.y).toBe(0);
  });

  it.each([
    { index: 1, x: -40, opens: 360 },
    { index: 3, x: 40, opens: 960 },
  ])(
    'drops the rider when trapdoor $index opens, but keeps it welded in legal play',
    ({ index, x, opens }) => {
      for (const hazards of [true, false]) {
        const match = createMatch({
          seed: 1,
          stage: stage.id,
          stocks: 3,
          ports: [{ fighter: marioReference.id }],
          hazards,
        });
        const f = placeInAir(match, x, 8);
        run(match, opens - 1);
        expect(f.ground?.kind).toBe('solid');
        expect(match.stage.solids.every((piece) => piece.on)).toBe(true);
        run(match, 1);
        expect(match.stage.solids[index]!.on).toBe(!hazards);
        expect(match.stage.solids.filter((piece) => !piece.on)).toHaveLength(hazards ? 1 : 0);
        expect(
          match.events.some((event) => event.type === 'stagePiece' && !event.on && event.index === index),
        ).toBe(hazards);
        run(match, 20);
        expect(f.ground?.kind).toBe(hazards ? undefined : 'solid');
        if (hazards) expect(f.pos.y).toBeLessThan(-6);
        else expect(f.pos.y).toBe(0);
        run(match, 160);
        expect(match.stage.solids.every((piece) => piece.on)).toBe(true);
      }
    },
  );

  it.each(stage.platforms)('lands on and drops through the scaffold from $x1 to $x2', (p) => {
    const match = testMatch({ stage: stage.id });
    const f = placeInAir(match, (p.x1 + p.x2) / 2, 48);
    until(match, (g) => g.action === 'idle');
    expect(f.ground?.kind).toBe('platform');
    expect(f.pos.y).toBeCloseTo(p.y);
    run(match, 1, { y: -100 });
    expect(f.ground).toBeNull();
    until(match, (g) => g.ground?.kind === 'solid');
    expect(f.pos.y).toBeCloseTo(0);
  });

  it.each(stage.ledges.map((ledge, index) => ({ ...ledge, index })))('grabs ledge $index', (ledge) => {
    const match = testMatch({ stage: stage.id });
    const f = placeInAir(match, ledge.x + ledge.side * 5, 4, ledge.side === 1 ? -1 : 1);
    until(match, (g) => g.action === 'ledgeHang', {}, 60);
    expect(f.ledge).toBe(ledge.index);
  });
});
