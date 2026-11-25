import { describe, expect, it } from 'vitest';
import { hashState } from '../../engine/hash';
import { FIGHTERS } from '../../fighters/registry';
import { isIntangible } from '../../sim/actions/registry';
import { createMatch, type MatchState } from '../../sim/match';
import { motionOffset, stageStateAt } from '../../sim/movingStage';
import { compileStage } from '../../sim/stage';
import { marioReference } from '../../sim/testing/reference';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { HAULER_MOTION, HAULERS, RIG, stage } from './geometry';

function convoy(hazards: boolean, players = 1): MatchState {
  return createMatch({
    seed: 1,
    stage: stage.id,
    stocks: 3,
    hazards,
    ports: Array.from({ length: players }, () => ({ fighter: marioReference.id })),
  });
}

/** Stand fighter 0 on hauler deck `index` (wherever it is this frame) and let it settle. */
function standOnHauler(m: MatchState, index: number): void {
  const p = stage.platforms[index]!;
  const at = m.stage.platforms[index]!;
  placeInAir(m, (p.x1 + p.x2) / 2 + at.x, p.y + at.y + 6);
  until(m, (f) => f.ground !== null, {}, 60);
  expect(m.fighters[0]!.ground).toEqual({ kind: 'platform', index });
}

describe('Truck Convoy collision', () => {
  it('has one 160-unit deck, two outward ledges on the carrier and Battlefield blast zones', () => {
    const { edges, ledgeSolid } = compileStage(stage);
    const floors = edges.filter((e) => e.kind === 'floor');
    expect(floors).toHaveLength(1);
    expect(floors[0]).toMatchObject({ a: { x: RIG.left, y: 0 }, b: { x: RIG.right, y: 0 } });
    expect(ledgeSolid).toEqual([0, 0]);
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 192, bottom: -140 });
    const xs = stage.solids[0]!.points.map(([x]) => x);
    const ys = stage.solids[0]!.points.map(([, y]) => y);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([
      RIG.left,
      RIG.right,
      RIG.bottom,
      RIG.top,
    ]);
  });

  it('puts the hauler decks over the carrier, above the tallest fighter standing on it', () => {
    expect(stage.platforms.map(({ x1, x2, y }) => ({ x1, x2, y }))).toEqual([
      { x1: -61, x2: -23, y: 26 },
      { x1: 23, x2: 61, y: 26 },
    ]);
    expect(stage.platforms.every((p) => p.hazard === true)).toBe(true);
    const tallest = Math.max(...Object.values(FIGHTERS).map((f) => f.stats.height));
    expect(HAULERS.y - RIG.top).toBeGreaterThan(tallest);
  });

  it('settles four spawns on the deck, facing inward without overlapping', () => {
    const m = testMatch({ stage: stage.id, players: 4 });
    for (const [port, f] of m.fighters.entries()) {
      const [x, y, facing] = stage.spawns[port]!;
      expect(f.pos).toEqual({ x, y });
      expect(f.facing).toBe(facing);
      expect(f.pos.x * f.facing).toBeLessThan(0);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect(Math.abs(x)).toBeLessThan(RIG.right - 20);
    }
    expect(new Set(m.fighters.map((f) => f.pos.x)).size).toBe(4);
  });

  it.each([true, false])('KOs and respawns all four ports above the deck (hazards %s)', (hazards) => {
    const m = convoy(hazards, 4);
    run(m, 10);
    for (const f of m.fighters) {
      f.pos.y = stage.blastZones.bottom - 1;
      f.ground = null;
      f.action = 'fall';
    }
    run(m, 1);
    expect(m.fighters.map((f) => [f.action, f.stocks])).toEqual(Array(4).fill(['ko', 2]));
    until(m, (f) => f.action === 'respawn', {}, 120);
    for (const [port, f] of m.fighters.entries()) {
      const [x, y] = stage.respawns[port]!;
      expect(f.pos).toEqual({ x, y });
      expect(isIntangible(f)).toBe(true);
      expect(Math.abs(x)).toBeLessThan(RIG.right - 20);
      expect(y).toBeGreaterThan(HAULERS.y + 24 + 4);
      expect(y).toBeLessThan(stage.camera.top - 20);
    }
    expect(new Set(m.fighters.map((f) => f.pos.x)).size).toBe(4);
    until(m, (f) => f.action !== 'respawn' && f.ground !== null, {}, 600);
    expect(m.fighters[0]!.ground).not.toBeNull();
  });

  it.each(stage.platforms.map((p, i) => [i, p] as const))(
    'jumps through, lands on and drops through hauler deck %i',
    (index, { x1, x2, y }) => {
      const m = testMatch({ stage: stage.id, x: (x1 + x2) / 2 });
      const f = m.fighters[0]!;
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      run(m, 30, { buttons: ['jump'] });
      expect(f.pos.y).toBeGreaterThan(y);
      until(m, (g) => g.action === 'idle', {}, 60);
      expect(f.ground).toEqual({ kind: 'platform', index });
      expect(f.pos.y).toBeCloseTo(y);
      run(m, 1, { y: -100 });
      expect(f.ground).toBeNull();
      until(m, (g) => g.ground !== null, {}, 60);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect(f.pos.y).toBeCloseTo(RIG.top);
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
      run(m, 1, { x: -side * 50 });
      expect(f.action).toBe('ledgeClimb');
      until(m, (g) => g.action === 'idle', {}, 60);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect((f.pos.x - x) * side).toBeLessThan(0);
    },
  );
});

describe('Truck Convoy traffic', () => {
  it('moves both haulers together, falling back and pulling ahead by the drift', () => {
    const at = (frame: number) => motionOffset(HAULER_MOTION, frame);
    expect(at(0)).toEqual([0, 0]);
    expect(at(240)).toEqual([0, 0]);
    expect(at(480)).toEqual([-HAULERS.drift, 0]);
    expect(at(840)).toEqual([0, 0]);
    expect(at(1200)).toEqual([HAULERS.drift, 0]);
    expect(at(HAULERS.period)).toEqual([0, 0]);
    let fastest = 0;
    for (let f = 1; f <= HAULERS.period; f++) fastest = Math.max(fastest, Math.abs(at(f)[0] - at(f - 1)[0]));
    expect(fastest).toBeLessThan(0.5);
  });

  it('keeps the decks apart, inside the camera, and with their inner end over the carrier', () => {
    for (let frame = 0; frame < HAULERS.period; frame += 6) {
      const [dx, dy] = motionOffset(HAULER_MOTION, frame);
      expect(dy).toBe(0);
      const [a, b] = stage.platforms.map((p) => ({ x1: p.x1 + dx, x2: p.x2 + dx }));
      expect(b!.x1 - a!.x2).toBeGreaterThan(40);
      for (const p of [a!, b!]) {
        expect(p.x1).toBeGreaterThan(stage.camera.left + 60);
        expect(p.x2).toBeLessThan(stage.camera.right - 60);
        expect(Math.min(Math.abs(p.x1), Math.abs(p.x2))).toBeLessThan(RIG.right - 15);
      }
    }
  });

  it('carries a rider on a hauler deck as it falls back, and leaves the carrier still', () => {
    const m = convoy(true);
    run(m, 120);
    standOnHauler(m, 0);
    const f = m.fighters[0]!;
    const x0 = f.pos.x;
    expect(m.stage.platforms[0]!.x).toBe(0);
    run(m, 480 - m.frame);
    expect(f.ground).toEqual({ kind: 'platform', index: 0 });
    expect(f.pos.x - x0).toBeCloseTo(-HAULERS.drift, 4);
    expect(stage.platforms[0]!.x1 + m.stage.platforms[0]!.x).toBeLessThan(RIG.left - 15);
    expect(m.stage.solids[0]).toEqual({ x: 0, y: 0, dx: 0, dy: 0, on: true });
  });

  it('parks the haulers level with the carrier when hazards are off', () => {
    let state = stageStateAt(stage, 0, undefined, false);
    for (let frame = 1; frame <= HAULERS.period; frame++) {
      state = stageStateAt(stage, frame, state, false);
      for (const p of state.platforms) expect(p).toEqual({ x: 0, y: 0, dx: 0, dy: 0, on: true });
    }
    const m = convoy(false);
    run(m, 300);
    standOnHauler(m, 1);
    const x0 = m.fighters[0]!.pos.x;
    run(m, 600);
    expect(m.fighters[0]!.ground).toEqual({ kind: 'platform', index: 1 });
    expect(m.fighters[0]!.pos.x).toBe(x0);
  });

  it('replays the same traffic to the same state', () => {
    const play = () => {
      const m = convoy(true, 2);
      run(m, 900, (i) => ({ x: i % 200 < 100 ? 60 : -60, buttons: i % 37 === 0 ? ['jump'] : [] }));
      return hashState(m);
    };
    expect(play()).toBe(play());
  });
});
