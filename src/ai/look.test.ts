import { describe, expect, it } from 'vitest';
import { getFighter } from '../fighters/registry';
import { hurtbox } from '../sim/combat/hits';
import { input, testMatch } from '../sim/testing/sim';
import { run, soloMatch } from './look';

describe('look-ahead', () => {
  it('samples each frame with the stats of the form the fighter is in by then', () => {
    const m = testMatch({ fighter: 'bloxorz' });
    const solo = soloMatch(m, m.fighters[0]!);
    const samples = run(solo, 5, () => input({ y: -100 }));
    const g = solo.fighters[0]!;
    expect(g.fighter).toBe('bloxorz-lying');
    const hurt = samples.at(-1)!.hurt;
    expect(hurt).toEqual(hurtbox(g, getFighter('bloxorz-lying').stats));
    expect(hurt.hw).toBeGreaterThan(0);
  });
});
