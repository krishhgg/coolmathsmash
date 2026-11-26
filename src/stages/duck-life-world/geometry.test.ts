import { describe, expect, it } from 'vitest';
import { isIntangible } from '../../sim/actions/registry';
import { compileStage, edgeMaxX, edgeMinX } from '../../sim/stage';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { getStage } from '../registry';
import { COURSE, stage } from './geometry';

describe('Duck Life Course collision', () => {
  it("registers Battlefield's floor, soft platforms, ledges and blast zones with a static layout", () => {
    expect(getStage('duck-life-world')).toBe(stage);
    const compiled = compileStage(stage);
    const floors = compiled.edges.filter((edge) => edge.kind === 'floor');
    expect(floors.map((e) => [edgeMinX(e), edgeMaxX(e), e.a.y, e.b.y])).toEqual([[-80, 80, 0, 0]]);
    expect(stage.platforms).toEqual([
      { x1: -59.42, x2: -24.79, y: 24.12 },
      { x1: -17.32, x2: 17.32, y: 47.19 },
      { x1: 24.79, x2: 59.42, y: 24.12 },
    ]);
    expect(stage.ledges).toEqual([
      { x: -80, y: 0, side: -1 },
      { x: 80, y: 0, side: 1 },
    ]);
    expect(compiled.ledgeSolid).toEqual([0, 0]);
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 192, bottom: -140 });
    expect(stage.camera).toEqual({ left: -170, right: 170, top: 130, bottom: -80 });
    // The course scrolls in the backdrop only: nothing here moves, vanishes or hurts, so hazards on and off play
    // the same layout.
    for (const piece of [...stage.solids, ...stage.platforms]) {
      expect(piece.motion).toBeUndefined();
      expect(piece.schedule).toBeUndefined();
      expect(piece.conveyor).toBeUndefined();
    }
    expect(stage.zones).toBeUndefined();
    expect(stage.hitboxes).toBeUndefined();
  });

  it('has a hull that is mirror-symmetric and no deeper than the art says', () => {
    const points = stage.solids[0]!.points;
    const key = ([x, y]: [number, number]) => `${x},${y}`;
    expect(new Set(points.map(([x, y]) => key([-x, y])))).toEqual(new Set(points.map(key)));
    expect(Math.min(...points.map(([, y]) => y))).toBe(COURSE.bottom);
    expect(Math.min(...points.map(([x]) => x))).toBe(COURSE.left);
    expect(Math.max(...points.map(([x]) => x))).toBe(COURSE.right);
  });

  it('settles four spawns on the turf facing inward without overlapping', () => {
    expect(stage.spawns).toHaveLength(4);
    const m = testMatch({ stage: stage.id, players: 4 });
    for (const [port, f] of m.fighters.entries()) {
      const [x, y, facing] = stage.spawns[port]!;
      expect(f.pos).toEqual({ x, y });
      expect(f.facing).toBe(facing);
      expect(f.pos.x * f.facing).toBeLessThan(0);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect(Math.abs(x)).toBeLessThan(COURSE.right - 10);
    }
    expect(new Set(m.fighters.map((f) => f.pos.x)).size).toBe(4);
    run(m, 120);
    expect(m.fighters.every((f) => f.ground?.kind === 'solid' && f.stocks === 3)).toBe(true);
  });

  it('KOs and respawns all four ports at distinct points that land them on the stage', () => {
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
      expect(x).toBeGreaterThan(COURSE.left);
      expect(x).toBeLessThan(COURSE.right);
      expect(y).toBeGreaterThan(47.19);
      expect(y).toBeLessThan(stage.camera.top);
    }
    expect(new Set(m.fighters.map((f) => f.pos.x)).size).toBe(4);
    run(m, 400);
    expect(m.fighters.map((f) => f.ground)).toEqual([
      { kind: 'platform', index: 0 },
      { kind: 'platform', index: 2 },
      { kind: 'solid', index: 0 },
      { kind: 'solid', index: 0 },
    ]);
    expect(m.fighters.map((f) => f.stocks)).toEqual([2, 2, 2, 2]);
  });

  it.each(stage.platforms.map((p, i) => [i, p] as const))(
    'lands on and drops through race beam %i',
    (index, { x1, x2, y }) => {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, (x1 + x2) / 2, y + 20);
      until(m, (g) => g.action === 'idle', {}, 120);
      expect(f.ground).toEqual({ kind: 'platform', index });
      expect(f.pos.y).toBeCloseTo(y);
      run(m, 1, { y: -100 });
      expect(f.ground).toBeNull();
      until(m, (g) => g.ground?.kind === 'solid', {}, 120);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect(f.pos.y).toBeCloseTo(COURSE.top);
    },
  );

  it.each([0, 2])('jumps up through side beam %i from the turf', (index) => {
    const { x1, x2, y } = stage.platforms[index]!;
    const m = testMatch({ stage: stage.id, x: (x1 + x2) / 2 });
    const f = m.fighters[0]!;
    run(m, 30, { buttons: ['jump'] });
    expect(f.pos.y).toBeGreaterThan(y);
    until(m, (g) => g.action === 'idle', {}, 90);
    expect(f.ground).toEqual({ kind: 'platform', index });
  });

  it.each(stage.ledges.map((ledge, i) => [i, ledge] as const))(
    'catches and climbs ledge %i from outside the hull',
    (index, { x, y, side }) => {
      const m = testMatch({ stage: stage.id });
      const f = placeInAir(m, x + side * 4, y + 4, side);
      until(m, (g) => g.action === 'ledgeHang', {}, 60);
      expect(f.ledge).toBe(index);
      expect(f.facing).toBe(-side);
      run(m, 1, { x: -side * 50 });
      expect(f.action).toBe('ledgeClimb');
      until(m, (g) => g.action === 'idle', {}, 60);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect((f.pos.x - x) * side).toBeLessThan(0);
      expect(f.pos.y).toBeCloseTo(y);
    },
  );

  it.each([
    [-1, -22],
    [1, -22],
    [-1, -34],
    [1, -34],
  ] as const)('gets back from below the side %i lip at y %i with a double jump', (side, y) => {
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, side * 90, y, side === 1 ? -1 : 1);
    run(m, 1, { buttons: ['jump'] });
    until(m, (g) => g.action === 'ledgeHang' || g.ground !== null, { x: -side * 30 }, 120);
    if (f.action === 'ledgeHang') expect(f.ledge).toBe(side === -1 ? 0 : 1);
    else expect(f.ground).toEqual({ kind: 'solid', index: 0 });
  });
});
