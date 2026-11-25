import { describe, expect, it } from 'vitest';
import { runCpuMatch } from '../../ai/bench';
import { stage } from './geometry';

/** CPUs read the authored layout; the haulers' home spans sit over the deck, so moving them never misleads them. */
describe('CPUs on Truck Convoy', () => {
  it.each([true, false])(
    'fight a 2-stock match without self-destructing (hazards %s)',
    (hazards) => {
      const r = runCpuMatch({
        seed: 3,
        levels: [9, 7],
        fighters: ['wheely', 'fireboy'],
        stage: stage.id,
        hazards,
        stocks: 2,
        maxFrames: 3 * 60 * 60,
      });
      expect(r.kos.filter((k) => k.selfDestruct)).toEqual([]);
      expect(r.kos.length).toBeGreaterThan(0);
    },
    300_000,
  );
});
