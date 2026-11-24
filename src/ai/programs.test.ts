import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch } from '../sim/match';
import { press } from './inputs';
import { groundMove } from './programs';

describe('CPU programs', () => {
  it('dash attack out of a fresh dash instead of forward smashing', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }],
    });
    const f = m.fighters[0]!;
    for (let i = 0; i < 300 && f.action !== 'idle'; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    f.facing = 1;
    stepMatch(m, [press({ x: 100 }), neutralInput()]);
    expect(f.action).toBe('dash');
    const p = groundMove('dashAttack', 1);
    for (let t = 0; t < 10 && f.action !== 'attack'; t++)
      stepMatch(m, [p.step(t, f) ?? neutralInput(), neutralInput()]);
    expect(f.move).toBe('dashAttack');
  });
});
