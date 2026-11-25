import { describe, expect, it } from 'vitest';
import { isIntangible } from '../../sim/actions/registry';
import { compileStage } from '../../sim/stage';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { DECK, stage } from './geometry';

describe("World's Hardest Stage collision", () => {
  it('has one 180-unit floor, two Battlefield side platforms and Final Destination blast zones', () => {
    const floors = compileStage(stage).edges.filter((e) => e.kind === 'floor');
    expect(floors).toMatchObject([{ a: { x: -90, y: 0 }, b: { x: 90, y: 0 } }]);
    expect(stage.platforms).toEqual([
      { x1: -59.42, x2: -24.79, y: 24.12 },
      { x1: 24.79, x2: 59.42, y: 24.12 },
    ]);
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 180, bottom: -140 });
  });

  it('settles four spawns on the green ends, facing inward without overlapping', () => {
    expect(stage.spawns).toHaveLength(4);
    const m = testMatch({ stage: stage.id, players: 4, fighter: 'wheely' });
    for (const [port, f] of m.fighters.entries()) {
      const [x, y, facing] = stage.spawns[port]!;
      expect(f.pos).toEqual({ x, y });
      expect(f.facing).toBe(facing);
      expect(f.pos.x * f.facing).toBeLessThan(0);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect(Math.abs(x)).toBeGreaterThan(DECK.right - DECK.safeWidth);
      expect(Math.abs(x)).toBeLessThan(DECK.right);
    }
    expect(new Set(m.fighters.map((f) => f.pos.x)).size).toBe(4);
  });

  it('KOs and respawns all four ports at distinct points above the deck', () => {
    expect(stage.respawns).toHaveLength(4);
    const m = testMatch({ stage: stage.id, players: 4 });
    for (const f of m.fighters) {
      f.pos.y = stage.blastZones.bottom - 1;
      f.ground = null;
      f.action = 'fall';
    }
    run(m, 1);
    for (const f of m.fighters) {
      expect(f.action).toBe('ko');
      expect(f.stocks).toBe(2);
    }
    until(m, (f) => f.action === 'respawn', {}, 120);
    for (const [port, f] of m.fighters.entries()) {
      const [x, y] = stage.respawns[port]!;
      expect(f.action).toBe('respawn');
      expect(f.pos).toEqual({ x, y });
      expect(isIntangible(f)).toBe(true);
      expect(x).toBeGreaterThan(DECK.left);
      expect(x).toBeLessThan(DECK.right);
      expect(y).toBeGreaterThan(24.12);
      expect(y).toBeLessThan(stage.camera.top);
    }
    expect(new Set(m.fighters.map((f) => f.pos.x)).size).toBe(4);
  });

  it.each(stage.platforms.map((p, i) => [i, p] as const))(
    'jumps through, lands on and drops through soft platform %i',
    (index, { x1, x2, y }) => {
      const m = testMatch({ stage: stage.id, x: (x1 + x2) / 2 });
      const f = m.fighters[0]!;
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      run(m, 30, { buttons: ['jump'] });
      expect(f.ground).toBeNull();
      expect(f.pos.y).toBeGreaterThan(y);
      until(m, (g) => g.action === 'idle', {}, 60);
      expect(f.ground).toEqual({ kind: 'platform', index });
      expect(f.pos.y).toBeCloseTo(y);
      run(m, 1, { y: -100 });
      expect(f.ground).toBeNull();
      until(m, (g) => g.ground !== null, {}, 60);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect(f.pos.y).toBeCloseTo(DECK.top);
    },
  );

  it.each(stage.ledges.map((ledge, i) => [i, ledge] as const))(
    'catches and climbs ledge %i from outside the hull',
    (index, { x, y, side }) => {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x + side * 4, y + 4, side);
      until(m, (g) => g.action === 'ledgeHang', {}, 60);
      expect(f.ledge).toBe(index);
      expect(f.facing).toBe(-side);
      expect((f.pos.x - x) * side).toBeGreaterThan(0);
      run(m, 1, { x: -side * 50 });
      expect(f.action).toBe('ledgeClimb');
      until(m, (g) => g.action === 'idle', {}, 60);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect((f.pos.x - x) * side).toBeLessThan(0);
      expect(f.pos.y).toBeCloseTo(y);
    },
  );
});
