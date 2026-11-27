import { describe, expect, it } from 'vitest';
import { createMatch } from '../sim/match';
import { STAGES } from '../stages/registry';
import { runCpuMatch } from './bench';
import { stageInfo, staticStage } from './stage';

describe('stages with a pit between their ends', () => {
  // A calm stage skips the CPU's checks of where its aerials and hops come down, since only the stage's ends can drop
  // a fighter there. Bloxorz Platform's 16-wide hole and the two gaps between Run Tunnel's blocks drop one too.
  it('are Bloxorz Platform and Run Tunnel, and neither is calm', () => {
    const pits = Object.keys(STAGES).filter((id) => staticStage(id).pits);
    expect(pits.sort()).toEqual(['bloxorz-platform', 'run-tunnel']);
    const calm = (stage: string) =>
      stageInfo(createMatch({ seed: 1, stage, stocks: 3, ports: [{ fighter: 'fireboy' }], hazards: false }))
        .calm;
    expect([calm('bloxorz-platform'), calm('run-tunnel'), calm('battlefield')]).toEqual([false, false, true]);
  });

  // Level 9 against level 9 on Bloxorz Platform (src/ai/bench.ts). Before, a CPU short hopped an aerial toward its
  // opponent across the hole: Red Ball's down air from x -27 dropped him through it on frame 382 and he was KO'd on
  // frame 565. Bloxorz's down air drifted over it until the CPU dropped the aerial to recover, which turned the drift
  // around above the hole (KO'd on frame 2604 here before, and on frame 3166 with only the calm check).
  it.each([
    [2, ['redball', 'runner'], 2372],
    [2, ['wheely', 'bloxorz'], 3166],
  ] as const)(
    'keep level 9 CPUs out of the hole in bench match seed %d, %j',
    (seed, fighters, last) => {
      const r = runCpuMatch({
        seed,
        levels: [9, 9],
        fighters: [...fighters],
        stage: 'bloxorz-platform',
        maxFrames: last + 60,
      });
      expect(r.kos.filter((k) => k.selfDestruct)).toEqual([]);
    },
    120_000,
  );
});
