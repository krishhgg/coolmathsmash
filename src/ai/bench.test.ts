import { describe, expect, it } from 'vitest';
import { runCpuMatch } from './bench';

/** A slice of the CPU benchmark (npm run bench:ai) that runs with the unit tests, so CI guards the level curve. */
describe('CPU benchmark (CI slice)', () => {
  it('level 9 beats level 3 at fixed seeds, on either port', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const nine = seed % 2;
      const levels = nine === 0 ? [9, 3] : [3, 9];
      const r = runCpuMatch({ seed, levels });
      expect(r.winner, `seed ${seed}`).toBe(nine);
    }
  }, 120_000);

  it('levels 7 and 9 do not self-destruct', () => {
    for (let seed = 1; seed <= 3; seed++) {
      for (const levels of [
        [9, 7],
        [7, 9],
      ]) {
        const r = runCpuMatch({ seed, levels });
        expect(
          r.kos.filter((k) => k.selfDestruct),
          `seed ${seed} L${levels.join(' vs L')}`,
        ).toEqual([]);
      }
    }
  }, 120_000);
});
