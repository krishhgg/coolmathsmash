import { describe, expect, it, vi } from 'vitest';
import { neutralInput, type InputFrame } from '../input/types';
import { entityPlatform, spawnEntity } from '../sim/entities/entities';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { compiledStage } from '../sim/step';
import { Cpu } from './cpu';
import { createCpu } from './index';
import {
  canRecover,
  cpuRecovers,
  drill,
  registerWide150,
  spots,
  WIDE_150,
  type Spot,
} from './testing/recovery';

registerWide150();

const STAGES = ['battlefield', 'snail-bob-construction', WIDE_150.id];
const possible = new Map<string, boolean>();

/** Whether any drift, double jump and up special timing gets back from the spot (cached per stage and spot). */
function recoverable(stage: string, spot: Spot): boolean {
  const key = `${stage} ${spot.x} ${spot.y}`;
  let ok = possible.get(key);
  if (ok === undefined) {
    ok = canRecover(stage, spot);
    possible.set(key, ok);
  }
  return ok;
}

describe('CPU recovery from under and beside the stage', () => {
  it.each(STAGES.flatMap((stage) => [4, 7, 9].map((level) => [stage, level] as const)))(
    'on %s, a level %d CPU gets back from every spot it physically can',
    (stage, level) => {
      const all = spots(stage);
      const lost: string[] = [];
      let back = 0;
      for (const spot of all) {
        const r = cpuRecovers(stage, spot, level, 5);
        if (r === 'safe') back++;
        else if (recoverable(stage, spot)) lost.push(`${spot.where} (${spot.x}, ${spot.y}): ${r}`);
      }
      expect(lost).toEqual([]);
      expect(back / all.length).toBeGreaterThan(0.9);
    },
    60_000,
  );

  it.each(STAGES)('on %s, drifts out from 13 under the middle before the up special', (stage) => {
    const start = spots(stage).find((s) => s.where === 'under' && s.x === 0)!;
    const m = drill(stage, start.x, start.y);
    const f = m.fighters[0]!;
    const ledge = Math.max(...compiledStage(stage).geo.ledges.map((l) => Math.abs(l.x)));
    const cpu = createCpu({ port: 0, level: 7, seed: 5 });
    let upAt: number | null = null;
    for (let i = 0; i < 600 && f.ground === null && f.action !== 'ledgeHang' && f.stocks === 3; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      if (upAt === null && f.move === 'upB') upAt = f.pos.x;
    }
    expect(f.stocks).toBe(3);
    expect(upAt).not.toBeNull();
    expect(Math.abs(upAt!)).toBeGreaterThan(ledge / 2);
  });
});

describe('CPU on a Duck Raft off the stage', () => {
  /**
   * Port 0, a `fighter`, standing on a Duck Raft centred at (x, y): its own, or that of port 1, a Raft Wars standing
   * in the middle of Battlefield.
   */
  function onRaft(fighter: string, own: boolean, x: number, y: number): { m: MatchState; raft: number } {
    const ports = [{ fighter }, { fighter: own ? 'fireboy' : 'raftwars' }];
    const m = createMatch({ seed: 1, stage: 'battlefield', stocks: 3, ports });
    const raft = spawnEntity(m, { kind: 'raftwars/duckRaft', owner: own ? 0 : 1, pos: { x, y } });
    const deck = entityPlatform(raft)!;
    Object.assign(m.fighters[0]!, {
      pos: { x, y: deck.y },
      prevPos: { x, y: deck.y },
      vel: { x: 0, y: 0 },
      kb: { x: 0, y: 0 },
      ground: { kind: 'entity', index: raft.id, ...deck },
      action: 'idle',
      actionFrame: 1,
      facing: x > 0 ? -1 : 1,
    });
    Object.assign(m.fighters[1]!, { pos: { x: 0, y: 0 }, prevPos: { x: 0, y: 0 } });
    return { m, raft: raft.id };
  }

  it("gets back to the stage from its own raft or an opponent's off either side, while the raft is still out", () => {
    // Beside the stage from 9 to 89 units under the ledge, and under the stage. Stood on, a raft lasts 75 frames, and
    // a CPU that waited that long fell from 89 under. Leaving at once, it jumps from the raft with its double jump and
    // up special still to come.
    const spots = [
      [95, -10],
      [105, -30],
      [100, -60],
      [100, -90],
      [48, -60],
    ];
    for (const [fighter, own] of [
      ['raftwars', true],
      ['fireboy', false],
    ] as const) {
      for (const [x, y] of spots) {
        for (const side of [1, -1]) {
          for (const seed of [1, 2, 3, 4]) {
            const { m, raft } = onRaft(fighter, own, side * x!, y!);
            const f = m.fighters[0]!;
            const cpu = createCpu({ port: 0, level: 9, seed });
            let stood = 0;
            let end = '';
            for (let i = 0; i < 400 && !end; i++) {
              stepMatch(m, [cpu.input(m), neutralInput()]);
              if (f.ground?.kind === 'entity') stood++;
              if (f.stocks < 3) end = 'KO';
              else if (f.action === 'ledgeCatch' || (f.ground !== null && f.ground.kind !== 'entity'))
                end = 'back';
            }
            const at = `${fighter} from (${side * x!}, ${y}), seed ${seed}`;
            expect(end, at).toBe('back');
            expect(stood, at).toBeLessThan(15);
            expect(
              m.entities.some((e) => e.id === raft && !e.dead),
              at,
            ).toBe(true);
          }
        }
      }
    }
  }, 60_000);

  it('plays on a raft over the stage as on any ground, and recovers from one off it', () => {
    const recover = vi.spyOn(Cpu.prototype as unknown as { recover(): InputFrame }, 'recover');
    for (const [x, y] of [
      [0, 12],
      [-60, 5],
      [70, 30],
    ]) {
      for (const seed of [1, 2, 3, 4]) {
        const { m } = onRaft('fireboy', false, x!, y!);
        const cpu = createCpu({ port: 0, level: 9, seed });
        for (let i = 0; i < 60; i++) stepMatch(m, [cpu.input(m), neutralInput()]);
      }
    }
    expect(recover).not.toHaveBeenCalled();
    const { m } = onRaft('fireboy', false, 100, -10);
    createCpu({ port: 0, level: 9, seed: 1 }).input(m);
    expect(recover).toHaveBeenCalledOnce();
    recover.mockRestore();
  }, 60_000);
});
