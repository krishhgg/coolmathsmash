import { describe, expect, it } from 'vitest';
import type { FighterState } from '../../sim/fighter';
import { createMatch } from '../../sim/match';
import { compileStage } from '../../sim/stage';
import { marioReference } from '../../sim/testing/reference';
import { placeInAir, run, until } from '../../sim/testing/sim';
import { WATER_Y } from './art/lagoon';
import { BOAT_SOLID, CABIN_PLATFORM, stage } from './geometry';
import { tideHeight } from './tide';

const compiled = compileStage(stage);
function match({
  players = 1,
  hazards = false,
  x,
}: { players?: number; hazards?: boolean; x?: number } = {}) {
  const m = createMatch({
    seed: 1,
    stage: stage.id,
    stocks: 3,
    hazards,
    ports: Array.from({ length: players }, () => ({ fighter: marioReference.id })),
  });
  if (x !== undefined) m.fighters[0]!.pos.x = x;
  run(m, 10);
  return m;
}
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
    expect(stage.platforms).toHaveLength(1);
    expect(stage.platforms[CABIN_PLATFORM]).toMatchObject({ x1: -15, x2: 15, y: 28 });
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
    const m = match({ x: 0 });
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
    const m = match({ players: 4 });
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

describe('Raft War Lagoon tide and bobbing', () => {
  it('rises every 40 seconds, holds 14 units up for eight seconds and eases back', () => {
    expect([0, 2399, 2400, 2490, 2580, 2820, 3060, 3150, 3240, 4799, 4890].map(tideHeight)).toEqual([
      0, 0, 0, 7, 14, 14, 14, 7, 0, 0, 7,
    ]);
    for (const frame of [2400, 2580, 3060, 3240])
      expect(Math.abs(tideHeight(frame + 1) - tideHeight(frame - 1))).toBeLessThan(0.002);
  });

  it('carries riders on the deck and cabin in sync through the bob, tide and retreat', () => {
    const m = match({ players: 4, hazards: true });
    const roofRider = placeInAir(m, 0, 48);
    const shoreRider = m.fighters[1]!;
    const deckRider = m.fighters[2]!;
    until(m, (f) => f.ground?.kind === 'platform');
    for (const [frame, lift] of [
      [60, 3],
      [180, -3],
      [240, 0],
      [2640, 14],
      [2820, 11],
      [3360, 0],
    ] as const) {
      run(m, frame - m.frame);
      expect(m.stage.solids[BOAT_SOLID]!.y).toBeCloseTo(lift);
      expect(m.stage.platforms[CABIN_PLATFORM]).toEqual(m.stage.solids[BOAT_SOLID]);
      expect(solidUnder(deckRider)).toBe(BOAT_SOLID);
      expect(deckRider.pos.y).toBeCloseTo(lift);
      expect(roofRider.ground).toEqual({ kind: 'platform', index: CABIN_PLATFORM });
      expect(roofRider.pos.y).toBeCloseTo(28 + lift);
      expect(shoreRider.pos.y).toBe(0);
    }
  });

  it('carries a hanging fighter up with the boat and lets them climb onto the deck', () => {
    const m = match({ hazards: true });
    run(m, 2450 - m.frame);
    const f = placeInAir(m, -49, m.stage.solids[BOAT_SOLID]!.y + 4, 1);
    until(m, (g) => g.action === 'ledgeHang');
    expect(f.ledge).toBe(2);
    const before = f.pos.y;
    const relativeY = before - m.stage.solids[BOAT_SOLID]!.y;
    run(m, 70);
    expect(f.action).toBe('ledgeHang');
    expect(f.pos.y).toBeGreaterThan(before + 2);
    expect(f.pos.y - m.stage.solids[BOAT_SOLID]!.y).toBeCloseTo(relativeY);
    run(m, 1, { x: 100 });
    until(m, (g) => g.ground !== null);
    expect(solidUnder(f)).toBe(BOAT_SOLID);
    expect(f.pos.y).toBeCloseTo(m.stage.solids[BOAT_SOLID]!.y);
  });

  it('keeps the legal hull, roof, ledges and spawns still even at a high tide frame', () => {
    const m = match({ players: 4 });
    const still = structuredClone(m.stage);
    run(m, 2820 - m.frame);
    expect(m.stage).toEqual(still);
    expect(m.fighters.map((f) => [f.pos.x, f.pos.y, f.facing])).toEqual(stage.spawns);
    const f = placeInAir(m, -49, 4, 1);
    until(m, (g) => g.action === 'ledgeHang');
    expect(f.ledge).toBe(2);
    run(m, 1, { x: 100 });
    until(m, (g) => g.ground !== null);
    expect(solidUnder(f)).toBe(BOAT_SOLID);
    expect(f.pos.y).toBe(0);
  });
});
