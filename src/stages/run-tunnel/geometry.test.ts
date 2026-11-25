import { describe, expect, it } from 'vitest';
import { RESPAWN_PLATFORM_MAX } from '../../sim/constants';
import { compileStage, edgeMaxX, edgeMinX } from '../../sim/stage';
import { placeInAir, run, runPorts, testMatch, until } from '../../sim/testing/sim';
import { getStage } from '../registry';
import { stage } from './geometry';

describe('Run Tunnel', () => {
  it('registers a 176-unit floor with two 16-unit gaps and only two outer ledges', () => {
    expect(getStage('run-tunnel')).toBe(stage);
    const { edges, ledgeSolid } = compileStage(stage);
    expect(
      edges.filter((e) => e.kind === 'floor').map((e) => [edgeMinX(e), edgeMaxX(e), e.a.y, e.b.y]),
    ).toEqual([
      [-88, -48, 0, 0],
      [-32, 32, 0, 0],
      [48, 88, 0, 0],
    ]);
    expect(stage.ledges).toEqual([
      { x: -88, y: 0, side: -1 },
      { x: 88, y: 0, side: 1 },
    ]);
    expect(ledgeSolid).toEqual([0, 2]);
    expect(stage.blastZones).toEqual({ left: -230, right: 230, top: 180, bottom: -120 });
  });

  it.each([-40, 40])('falls through the roof and floor gaps at x = %i to the bottom blast zone', (x) => {
    const match = testMatch({ stage: stage.id });
    const fighter = placeInAir(match, x, 80);
    until(match, (f) => f.pos.y < 0);
    expect(fighter.ground).toBeNull();
    expect(fighter.pos.x).toBe(x);
    until(match, (f) => f.action === 'ko');
    expect(match.events).toContainEqual(expect.objectContaining({ type: 'ko', side: 'bottom' }));
  });

  it('has four 32-unit soft roof segments at y = 70 that can be jumped and dropped through', () => {
    expect(stage.platforms).toEqual([
      { x1: -76, x2: -44, y: 70 },
      { x1: -36, x2: -4, y: 70 },
      { x1: 4, x2: 36, y: 70 },
      { x1: 44, x2: 76, y: 70 },
    ]);

    const match = testMatch({ stage: stage.id });
    const fighter = placeInAir(match, -20, 64);
    run(match, 1, { buttons: ['jump'] });
    until(match, (f) => f.pos.y > 70);
    expect(fighter.ground).toBeNull();
    until(match, (f) => f.action === 'idle');
    expect(fighter.ground).toEqual({ kind: 'platform', index: 1 });
    expect(fighter.pos.y).toBe(70);

    run(match, 1, { y: -100 });
    expect(fighter.ground).toBeNull();
    until(match, (f) => f.action === 'idle');
    expect(fighter.pos.y).toBe(0);
  });

  it('keeps all four ports safe at match start and after a neutral respawn', () => {
    const match = testMatch({ stage: stage.id, players: 4 });
    match.fighters.forEach((fighter, port) => {
      const [x, y, facing] = stage.spawns[port]!;
      expect(fighter.pos).toEqual({ x, y });
      expect(fighter.facing).toBe(facing);
      expect(fighter.ground?.kind).toBe('solid');
      fighter.action = 'ko';
      fighter.respawnTimer = 1;
    });

    run(match, RESPAWN_PLATFORM_MAX + 90);
    match.fighters.forEach((fighter, port) => {
      const [x] = stage.respawns[port]!;
      expect(fighter.action).toBe('idle');
      expect(fighter.pos).toEqual({ x, y: 70 });
      expect(fighter.ground?.kind).toBe('platform');
    });

    runPorts(
      match,
      1,
      match.fighters.map(() => ({ y: -100 })),
    );
    run(match, 90);
    match.fighters.forEach((fighter, port) => {
      expect(fighter.pos).toEqual({ x: stage.respawns[port]![0], y: 0 });
      expect(fighter.ground?.kind).toBe('solid');
    });
  });
});
