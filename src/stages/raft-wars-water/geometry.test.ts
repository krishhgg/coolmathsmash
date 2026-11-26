import { describe, expect, it } from 'vitest';
import { isIntangible } from '../../sim/actions/registry';
import { createMatch, type MatchState } from '../../sim/match';
import { motionOffset } from '../../sim/movingStage';
import { compileStage } from '../../sim/stage';
import { marioReference } from '../../sim/testing/reference';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { RAFT, stage, SWELL, WATER_Y } from './geometry';

const pieces = [...stage.solids, ...stage.platforms];

function lagoon(hazards: boolean, players = 1): MatchState {
  const m = createMatch({
    seed: 1,
    stage: stage.id,
    stocks: 3,
    hazards,
    ports: Array.from({ length: players }, () => ({ fighter: marioReference.id })),
  });
  run(m, 10);
  return m;
}

describe('Raft War Lagoon collision', () => {
  it('has one 150-unit deck with two outward ledges over open water, and Battlefield blast zones', () => {
    const { edges, ledgeSolid } = compileStage(stage);
    const floors = edges.filter((e) => e.kind === 'floor');
    expect(floors.map(({ a, b }) => [Math.min(a.x, b.x), Math.max(a.x, b.x), a.y, b.y])).toEqual([
      [-75, 75, 0, 0],
    ]);
    expect(ledgeSolid).toEqual([0, 0]);
    expect(stage.ledges).toEqual([
      { x: -75, y: 0, side: -1 },
      { x: 75, y: 0, side: 1 },
    ]);
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 192, bottom: -140 });
    expect(stage.solids).toHaveLength(1);
    expect(RAFT.bottom).toBeLessThan(WATER_Y);
    expect(stage.camera.bottom).toBeLessThan(WATER_Y);
    expect(stage.blastZones.bottom).toBeLessThan(stage.camera.bottom);
  });

  it("pins the lookout decks and the crow's nest inside the raft", () => {
    expect(stage.platforms.map(({ x1, x2, y }) => ({ x1, x2, y }))).toEqual([
      { x1: -56, x2: -24, y: 25 },
      { x1: 24, x2: 56, y: 25 },
      { x1: -15, x2: 15, y: 49 },
    ]);
    for (const p of stage.platforms) {
      expect(p.x1).toBeGreaterThan(RAFT.left);
      expect(p.x2).toBeLessThan(RAFT.right);
    }
  });
});

describe('Raft War Lagoon swell', () => {
  it('moves every piece as one, as a hazard, so the art can carry the whole raft', () => {
    for (const piece of pieces) {
      expect(piece.motion).toBe(SWELL);
      expect(piece.hazard).toBe(true);
      expect(piece.schedule).toBeUndefined();
    }
  });

  it('rises 1.6 units and settles back every 300 frames, never sinking below its authored place', () => {
    const ys = Array.from({ length: 300 }, (_, f) => motionOffset(SWELL, f));
    expect(ys.every(([dx]) => dx === 0)).toBe(true);
    expect(Math.min(...ys.map(([, dy]) => dy))).toBe(0);
    expect(Math.max(...ys.map(([, dy]) => dy))).toBeCloseTo(1.6);
    expect(motionOffset(SWELL, 0)).toEqual([0, 0]);
    expect(motionOffset(SWELL, 150)[1]).toBeCloseTo(1.6);
    expect(motionOffset(SWELL, 300)).toEqual([0, 0]);
    for (let f = 1; f < 300; f++) {
      const step = Math.abs(motionOffset(SWELL, f)[1] - motionOffset(SWELL, f - 1)[1]);
      expect(step).toBeLessThan(0.02);
    }
  });

  it('bobs with hazards on and stays at its authored place with hazards off', () => {
    const on = lagoon(true);
    const off = lagoon(false);
    let rose = 0;
    for (let i = 0; i < 300; i++) {
      run(on, 1);
      run(off, 1);
      rose = Math.max(rose, on.stage.solids[0]!.y);
      for (const st of [...off.stage.solids, ...off.stage.platforms])
        expect(st).toMatchObject({ x: 0, y: 0, on: true });
      for (const st of on.stage.platforms) expect(st.y).toBe(on.stage.solids[0]!.y);
    }
    expect(rose).toBeCloseTo(1.6);
  });

  it('carries a fighter standing on the deck up and down without lifting them off it', () => {
    const m = lagoon(true);
    const f = m.fighters[0]!;
    for (let i = 0; i < 320; i++) {
      run(m, 1);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect(f.pos.y).toBeCloseTo(m.stage.solids[0]!.y, 6);
    }
  });
});

describe('Raft War Lagoon starts and respawns', () => {
  it('settles four spawns on the deck, facing inward, apart and clear of the edges', () => {
    expect(stage.spawns).toHaveLength(4);
    const m = testMatch({ stage: stage.id, players: 4 });
    for (const [port, f] of m.fighters.entries()) {
      const [x, y, facing] = stage.spawns[port]!;
      expect(f.pos.x).toBe(x);
      expect(f.pos.y).toBeCloseTo(y + m.stage.solids[0]!.y, 6);
      expect(f.facing).toBe(facing);
      expect(f.pos.x * f.facing).toBeLessThan(0);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect(Math.abs(x)).toBeLessThan(RAFT.right - 20);
    }
    expect(new Set(m.fighters.map((f) => f.pos.x)).size).toBe(4);
  });

  it.each([0, 75, 150, 225])(
    'KOs all four ports in the water and respawns them on the raft (swell frame %i)',
    (phase) => {
      expect(stage.respawns).toHaveLength(4);
      const m = lagoon(true, 4);
      run(m, phase);
      for (const f of m.fighters) {
        f.pos = { x: f.pos.x, y: stage.blastZones.bottom - 1 };
        f.ground = null;
        f.action = 'fall';
      }
      run(m, 1);
      for (const f of m.fighters) {
        expect(f.action).toBe('ko');
        expect(f.stocks).toBe(2);
      }
      until(m, (f) => f.action === 'respawn', {}, 180);
      for (const [port, f] of m.fighters.entries()) {
        const [x, y] = stage.respawns[port]!;
        expect(f.action).toBe('respawn');
        expect(f.pos).toEqual({ x, y });
        expect(isIntangible(f)).toBe(true);
        expect(x).toBeGreaterThan(RAFT.left);
        expect(x).toBeLessThan(RAFT.right);
        expect(y).toBeGreaterThan(49 + 1.6 + 15);
        expect(y).toBeLessThan(stage.camera.top);
      }
      expect(new Set(m.fighters.map((f) => f.pos.x)).size).toBe(4);
      until(m, () => m.fighters.every((f) => f.ground !== null), {}, 600);
      for (const f of m.fighters) expect(f.stocks).toBe(2);
    },
  );

  it('KOs a fighter who falls past the raft into the water', () => {
    const m = lagoon(true);
    const f = placeInAir(m, RAFT.right + 12, WATER_Y - 4);
    f.jumpsUsed = 99;
    until(m, (g) => g.action === 'ko', {}, 240);
    expect(f.stocks).toBe(2);
  });
});

describe('Raft War Lagoon platforms and ledges', () => {
  it.each(stage.platforms.map((p, i) => [i, p] as const))(
    'lands on and drops through platform %i while the raft bobs',
    (index, { x1, x2, y }) => {
      const m = lagoon(true);
      run(m, 40 + index * 50);
      const f = placeInAir(m, (x1 + x2) / 2, y + 20);
      until(m, (g) => g.action === 'idle', {}, 90);
      expect(f.ground).toEqual({ kind: 'platform', index });
      expect(f.pos.y).toBeCloseTo(y + m.stage.platforms[index]!.y, 6);
      run(m, 1, { y: -100 });
      expect(f.ground).toBeNull();
      until(m, (g) => g.ground !== null, {}, 90);
      expect(f.ground).toEqual({ kind: 'solid', index: 0 });
      expect(f.pos.y).toBeCloseTo(m.stage.solids[0]!.y, 6);
    },
  );

  it.each([0, 1])('jumps up through lookout deck %i from the raft', (index) => {
    const { x1, x2 } = stage.platforms[index]!;
    const m = lagoon(true);
    const f = m.fighters[0]!;
    f.pos.x = (x1 + x2) / 2;
    run(m, 2);
    expect(f.ground).toEqual({ kind: 'solid', index: 0 });
    run(m, 30, { buttons: ['jump'] });
    expect(f.ground).toBeNull();
    until(m, (g) => g.action === 'idle', {}, 90);
    expect(f.ground).toEqual({ kind: 'platform', index });
  });

  it.each(stage.ledges.map((ledge, i) => [i, ledge] as const))(
    'catches and climbs ledge %i from the water side',
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
      expect(f.pos.y).toBeCloseTo(y + m.stage.solids[0]!.y, 6);
    },
  );
});
