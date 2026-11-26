import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { runCpuMatch } from '../../ai/bench';
import { neutralInput } from '../../input/types';
import { createMatch, stepMatch } from '../../sim/match';
import { RAFT, stage, WATER_Y } from './geometry';

/** CPUs read the stage from its authored geometry (src/ai/stage.ts); these check they still play the bobbing raft. */
describe('CPUs on Raft War Lagoon', () => {
  it('fight it out at levels 7 and 9 without falling in the water on their own', () => {
    for (const [seed, levels] of [
      [1, [9, 7]],
      [2, [7, 9]],
    ] as const) {
      const r = runCpuMatch({
        seed,
        levels: [...levels],
        stage: stage.id,
        stocks: 2,
        maxFrames: 3 * 60 * 60,
      });
      expect(r.kos.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(
        r.kos.filter((k) => k.selfDestruct),
        `seed ${seed} L${levels.join(' vs L')}`,
      ).toEqual([]);
    }
  }, 120_000);

  /** Off both ends, under the water at both ledges, and 8 units under the middle of the logs. */
  const spots: [number, number, number][] = [
    [-108, -8, 0],
    [112, 24, 75],
    [-96, WATER_Y - 30, 150],
    [100, WATER_Y - 22, 225],
    [0, RAFT.bottom - 8, 110],
  ];
  it.each(spots)('a level 7 CPU climbs back onto the raft from (%d, %d) at swell frame %d', (x, y, phase) => {
    const m = createMatch({
      seed: 1,
      stage: stage.id,
      stocks: 3,
      ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }],
    });
    for (let i = 0; i < phase; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    const f = m.fighters[0]!;
    Object.assign(f, {
      pos: { x, y },
      prevPos: { x, y },
      vel: { x: 0, y: 0 },
      ground: null,
      action: 'fall',
      actionFrame: 1,
      jumpsUsed: 1,
      airDodgeUsed: false,
      facing: x < 0 ? 1 : -1,
    });
    m.fighters[1]!.pos = { x: 0, y: 0 };
    const cpu = createCpu({ port: 0, level: 7, seed: 5 });
    let safe = false;
    for (let i = 0; i < 420 && !safe; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      safe = f.ground !== null || f.action === 'ledgeHang';
    }
    expect(f.stocks).toBe(3);
    expect(safe).toBe(true);
  });
});
