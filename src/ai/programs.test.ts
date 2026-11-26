import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch } from '../sim/match';
import { hazardTestbed } from '../stages/hazardTestbed';
import { registerStage } from '../stages/registry';
import { press } from './inputs';
import { canFastFall, groundMove } from './programs';
import { stageInfo } from './stage';

registerStage(hazardTestbed);

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

  it("don't fast fall past the corner of a damage zone they would land clear of", () => {
    // A Red Ball drifting left over the hazard testbed's water (x 36 to 60, up to 4 high) at full air speed, as in
    // the testbed test in hazards.test.ts. A fast fall from here lands at x 28.8, clear of the water, but passes its
    // top corner with 0.02 units to spare, and from 36.14 it clipped the corner.
    const m = createMatch({
      seed: 1,
      stage: 'hazard-testbed',
      stocks: 3,
      ports: [{ fighter: 'redball' }, { fighter: 'fireboy' }],
    });
    const f = m.fighters[0]!;
    const fall = (x: number, vx: number) =>
      Object.assign(f, {
        pos: { x, y: 12.7 },
        prevPos: { x, y: 12.7 },
        vel: { x: vx, y: -0.82 },
        ground: null,
        action: 'fall',
        fastFalling: false,
      });
    fall(36.1, -1.28);
    expect(canFastFall(f, stageInfo(m))).toBe(false);
    fall(25, 0);
    expect(canFastFall(f, stageInfo(m))).toBe(true);
  });
});
