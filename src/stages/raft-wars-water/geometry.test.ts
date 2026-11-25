import { describe, expect, it } from 'vitest';
import type { FighterState } from '../../sim/fighter';
import { compileStage } from '../../sim/stage';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { WATER_Y } from './art/lagoon';
import { stage } from './geometry';

const compiled = compileStage(stage);
const match = (players = 1) => testMatch({ stage: stage.id, players });
const solidUnder = (f: FighterState) =>
  f.ground?.kind === 'solid' ? compiled.edges[f.ground.index]!.solid : null;

describe('Raft War Lagoon legal geometry', () => {
  it('has two 60-unit shores, a centered 90-unit boat, and Final Destination blast zones', () => {
    expect(
      compiled.edges
        .filter(({ kind }) => kind === 'floor')
        .map(({ a, b }) => [Math.min(a.x, b.x), Math.max(a.x, b.x), a.y, b.y]),
    ).toEqual([
      [-140, -80, 0, 0],
      [-45, 45, 0, 0],
      [80, 140, 0, 0],
    ]);
    expect(stage.platforms).toEqual([{ x1: -15, x2: 15, y: 28 }]);
    expect(stage.ledges).toHaveLength(6);
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 180, bottom: -140 });
  });

  it.each([
    { x: -110, solid: 0 },
    { x: 0, solid: 1 },
    { x: 110, solid: 2 },
  ])('lands on solid $solid at x = $x', ({ x, solid }) => {
    const m = match();
    const f = placeInAir(m, x, 18);
    until(m, (g) => g.ground !== null);
    expect(solidUnder(f)).toBe(solid);
    expect(f.pos.y).toBe(0);
  });

  it('lands on the one-way cabin roof, then drops through to the boat deck', () => {
    const m = match();
    const f = placeInAir(m, 0, 49);
    until(m, (g) => g.action === 'idle');
    expect(f.ground).toEqual({ kind: 'platform', index: 0 });
    expect(f.pos.y).toBe(28);
    run(m, 1, { y: -100 });
    expect(f.ground).toBeNull();
    until(m, (g) => g.ground !== null);
    expect(solidUnder(f)).toBe(1);
    expect(f.pos.y).toBe(0);
  });

  it('jumps through the cabin roof from below and lands on top', () => {
    const m = testMatch({ stage: stage.id, x: 0 });
    expect(solidUnder(m.fighters[0]!)).toBe(1);
    until(m, (f) => f.pos.y > 28, { buttons: ['jump'] });
    until(m, (f) => f.ground !== null);
    expect(m.fighters[0]?.ground).toEqual({ kind: 'platform', index: 0 });
  });

  it.each(stage.ledges.map((ledge, index) => ({ ...ledge, index })))(
    'can grab and climb ledge $index at x = $x',
    ({ x, y, side, index }) => {
      const m = match();
      const f = placeInAir(m, x + side * 4, y + 4, side);
      until(m, (g) => g.action === 'ledgeHang');
      expect(f.ledge).toBe(index);
      expect(f.facing).toBe(-side);
      run(m, 1, { x: -side * 100 });
      until(m, (g) => g.ground !== null);
      expect(solidUnder(f)).toBe(compiled.ledgeSolid[index]);
      expect(f.pos.y).toBe(0);
    },
  );

  it.each([-62.5, 62.5])('falls through the painted water at x = %s and KOs at the blast zone', (x) => {
    const m = match();
    const f = placeInAir(m, x, 2);
    until(m, (g) => g.pos.y < WATER_Y - 4);
    expect(f.action).toBe('fall');
    expect(f.ground).toBeNull();
    expect(f.stocks).toBe(3);
    until(m, (g) => g.action === 'ko');
    expect(f.pos.y).toBeLessThanOrEqual(-140);
    expect(f.stocks).toBe(2);
  });

  it('settles all four spawns and all four respawns onto their intended pieces', () => {
    const m = match(4);
    const expectedSolids = [0, 2, 1, 1];
    expect(stage.spawns).toHaveLength(4);
    expect(stage.respawns).toHaveLength(4);
    expect(m.fighters.map(solidUnder)).toEqual(expectedSolids);
    expect(m.fighters.map((f) => [f.pos.x, f.pos.y, f.facing])).toEqual(stage.spawns);

    for (const f of m.fighters) {
      f.action = 'fall';
      f.ground = null;
      f.pos.y = stage.blastZones.bottom - 1;
    }
    until(m, (f) => f.action === 'respawn');
    run(m, 1);
    expect(m.fighters.map((f) => f.stocks)).toEqual([2, 2, 2, 2]);
    expect(m.fighters.map((f) => f.action)).toEqual(Array(4).fill('respawn'));
    expect(m.fighters.map((f) => [f.pos.x, f.pos.y])).toEqual(stage.respawns);
    run(m, 400);
    expect(m.fighters.map(solidUnder)).toEqual(expectedSolids);
  });
});
