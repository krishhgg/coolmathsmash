import { describe, expect, it } from 'vitest';
import { compileStage } from '../../sim/stage';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { stage } from './geometry';

describe('Construction Site collision', () => {
  it('has one continuous 160-unit floor and two outward ledges', () => {
    const { edges, ledgeSolid } = compileStage(stage);
    const floors = edges.filter((edge) => edge.kind === 'floor');
    expect(floors.map(({ a, b }) => [b.x, b.y, a.x, a.y])).toEqual([[-80, 0, 80, 0]]);
    expect(ledgeSolid).toEqual([0, 0]);
    const match = testMatch({ stage: stage.id, players: 4 });
    expect(match.fighters.map((f) => f.ground?.kind)).toEqual(Array<string>(4).fill('solid'));
  });

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
