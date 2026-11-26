import { describe, expect, it } from 'vitest';
import { getFighter } from '../fighters/registry';
import { Btn, neutralInput } from '../input/types';
import { hurtbox } from '../sim/combat/hits';
import { createMatch, stepMatch } from '../sim/match';
import { input, testMatch } from '../sim/testing/sim';
import { STICK, press } from './inputs';
import { run, sample, setEntities, soloMatch } from './look';

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

  it("plays the owner's entities in a look-ahead of its opponent: a grenade in the air bursts on it as in the match", () => {
    // Raft Wars throws a grenade at a Red Ball standing 90 units away. 40 frames later it is in the air, and its
    // burst hits the Red Ball 65 frames after that.
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'raftwars' }, { fighter: 'redball' }],
    });
    for (let i = 0; i < 30; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    Object.assign(m.fighters[0]!, { pos: { x: -45, y: 0 }, prevPos: { x: -45, y: 0 }, facing: 1 });
    Object.assign(m.fighters[1]!, { pos: { x: 45, y: 0 }, prevPos: { x: 45, y: 0 }, facing: -1 });
    stepMatch(m, [press({ x: STICK.special, buttons: Btn.Special }), neutralInput()]);
    for (let i = 1; i < 40; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    expect(m.entities.map((e) => e.kind)).toEqual(['raftwars/grenade']);

    const ahead = (entities: boolean) => {
      const solo = soloMatch(m, m.fighters[1]!);
      if (entities) setEntities(solo, m.fighters[0]!, m.entities, 1);
      return run(solo, 90).map((s) => [s.action, s.x, s.y, s.vx, s.vy]);
    };
    const real = structuredClone(m);
    const stats = getFighter('redball').stats;
    const played = Array.from({ length: 90 }, () => {
      stepMatch(real, [neutralInput(), neutralInput()]);
      return sample(real.fighters[1]!, stats);
    }).map((s) => [s.action, s.x, s.y, s.vx, s.vy]);
    const launched = played.findIndex(([action]) => action !== 'idle');
    expect(launched).toBe(65);
    expect(ahead(true)).toEqual(played);
    // Without the grenade, the look-ahead has the Red Ball standing there the whole time.
    expect(ahead(false).every(([action]) => action === 'idle')).toBe(true);
    // With nothing out, the look-ahead stays as it was; set again, the entities replace the ones it had.
    const solo = soloMatch(m, m.fighters[1]!);
    setEntities(solo, m.fighters[0]!, [], 1);
    expect([solo.fighters.length, solo.entities.length]).toEqual([1, 0]);
    setEntities(solo, m.fighters[0]!, m.entities, 1);
    setEntities(solo, m.fighters[0]!, m.entities, 1);
    expect(solo.entities.map((e) => [e.kind, e.owner])).toEqual([['raftwars/grenade', 1]]);
    setEntities(solo, m.fighters[0]!, [], 1);
    expect([solo.fighters[1]!.action, solo.entities.length]).toEqual(['out', 0]);
  });
});
