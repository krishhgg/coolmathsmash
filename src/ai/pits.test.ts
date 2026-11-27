import { describe, expect, it } from 'vitest';
import { createMatch } from '../sim/match';
import { STAGES } from '../stages/registry';
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
});
