import { describe, expect, it } from 'vitest';
import { compileStage } from '../../sim/stage';
import { placeInAir, run, testMatch, until } from '../../sim/testing/sim';
import { stage as battlefield } from '../battlefield/geometry';
import { stage } from './geometry';

const onTrailer = { kind: 'solid', index: 0 };

describe('Truck Convoy competitive geometry', () => {
  it('has one flat 160-unit floor, Battlefield side platforms, and the lower legal blast zone', () => {
    const { edges, ledgeSolid } = compileStage(stage);
    expect(edges.filter(({ kind }) => kind === 'floor')).toEqual([
      expect.objectContaining({ a: { x: -80, y: 0 }, b: { x: 80, y: 0 } }),
    ]);
    expect(ledgeSolid).toEqual([0, 0]);
    expect(stage.platforms).toEqual([battlefield.platforms[0], battlefield.platforms[2]]);
    expect(stage.blastZones).toEqual({ left: -220, right: 220, top: 192, bottom: -140 });
  });

  it('spawns four fighters on the trailer and respawns each in clear air over the stage', () => {
    const m = testMatch({ stage: stage.id, players: 4 });
    expect(m.fighters.map(({ pos, facing, ground }) => [pos.x, pos.y, facing, ground])).toEqual(
      stage.spawns.map((spawn) => [...spawn, onTrailer]),
    );
    expect(new Set(stage.spawns.map(([x]) => x)).size).toBe(4);

    for (const f of m.fighters) {
      Object.assign(f, { action: 'fall', ground: null, pos: { x: f.pos.x, y: stage.blastZones.bottom - 1 } });
    }
    run(m, 1);
    expect(m.fighters.every(({ action }) => action === 'ko')).toBe(true);
    until(m, (f) => f.action === 'respawn');
    run(m, 1);
    expect(m.fighters.map(({ pos, ground }) => [pos.x, pos.y, ground])).toEqual(
      stage.respawns.map((point) => [...point, null]),
    );
    expect(new Set(stage.respawns.map(([x]) => x)).size).toBe(4);
    expect(m.fighters.every(({ action }) => action === 'respawn')).toBe(true);

    run(m, 380);
    for (const f of m.fighters) {
      expect(f.ground).not.toBeNull();
      expect(f.pos.x).toBeGreaterThan(stage.camera.left);
      expect(f.pos.x).toBeLessThan(stage.camera.right);
    }
  });

  it.each([0, 1])('lands on roof %i, then drops through it and lands on the trailer', (index) => {
    const { x1, x2, y } = stage.platforms[index]!;
    const x = (x1 + x2) / 2;
    const m = testMatch({ stage: stage.id, x });
    const f = placeInAir(m, x, y + 25);
    until(m, ({ action }) => action === 'idle');
    expect(f.ground).toEqual({ kind: 'platform', index });
    expect(f.pos.y).toBeCloseTo(y);
    run(m, 1, { y: -100 });
    expect(f.ground).toBeNull();
    until(m, ({ ground }) => ground !== null);
    expect(f.ground).toEqual(onTrailer);
    expect(f.pos.y).toBeCloseTo(0);
  });

  it.each([0, 1])('catches trailer ledge %i and climbs onto the main deck', (index) => {
    const { x, y, side } = stage.ledges[index]!;
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, x + 5 * side, y + 4, side === -1 ? 1 : -1);
    until(m, ({ action }) => action === 'ledgeHang');
    expect(f.ledge).toBe(index);
    expect(f.facing).toBe(-side);
    run(m, 1, { x: -50 * side });
    expect(f.action).toBe('ledgeClimb');
    until(m, ({ action }) => action === 'idle');
    expect(f.ground).toEqual(onTrailer);
    expect(f.pos.y).toBeCloseTo(0);
  });

  it('has no road collision below the deck', () => {
    const m = testMatch({ stage: stage.id });
    const f = placeInAir(m, 100, -30);
    until(m, ({ action, ground }) => {
      expect(ground).toBeNull();
      return action === 'ko';
    });
    expect(f.pos.y).toBeLessThanOrEqual(stage.blastZones.bottom);
  });
});
