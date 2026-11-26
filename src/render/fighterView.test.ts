import { describe, expect, it } from 'vitest';
import { allFighters, getFighter, registerFighter } from '../fighters/registry';
import { defineFighter, type FighterDef } from '../fighters/types';
import { GETUP_ROLL, SHIELD_MAX, TECH_ROLL } from '../sim/constants';
import { createFighter } from '../sim/fighter';
import { quickGrapple, tetherTester } from '../sim/testing/tethers';
import { attack, placeInAir, runPorts, testMatch, type Hold } from '../sim/testing/sim';
import { clipFor, fighterArt, shieldRadius } from './fighterView';

describe('shieldRadius', () => {
  const fireboy = getFighter('fireboy');

  it('shrinks from full size to 15% as the shield empties', () => {
    expect(shieldRadius(fireboy, SHIELD_MAX)).toBeCloseTo(fireboy.stats.shieldSize);
    expect(shieldRadius(fireboy, 0)).toBeCloseTo(fireboy.stats.shieldSize * 0.15);
  });

  it('never goes negative when shield HP overshoots below zero during hitlag', () => {
    expect(shieldRadius(fireboy, -SHIELD_MAX)).toBe(0);
  });
});

describe('clipFor on tech and getup rolls', () => {
  const ROLLS = { techRoll: TECH_ROLL, getupRoll: GETUP_ROLL };
  const rolling = Object.values(allFighters()).filter((def) => fighterArt(def)?.clips.techRoll);

  /** The clip and clip frame for `action` on `frame`, facing `facing` and rolling `dir` times the facing. */
  function pick(def: FighterDef, action: string, facing: 1 | -1, dir: 1 | -1, frame: number) {
    const f = createFighter(0, def.id, [0, 0, facing], 3);
    Object.assign(f, { action, actionFrame: frame, move: null, dodgeDir: { x: dir * facing, y: 0 } });
    return clipFor(def, fighterArt(def)!, f);
  }

  it('covers every fighter with art that has roll clips', () => {
    const without = Object.values(allFighters()).filter(
      (def) => fighterArt(def) && !fighterArt(def)!.clips.techRoll,
    );
    for (const def of without) expect(fighterArt(def)!.clips.rollBack, def.id).toBeUndefined();
    expect(rolling.length).toBeGreaterThanOrEqual(10);
  });

  it.each(rolling.map((def) => [def.id, def] as const))(
    '%s draws a backward tech or getup roll with its back roll, as long as the action',
    (_, def) => {
      for (const [action, { faf }] of Object.entries(ROLLS))
        for (const facing of [1, -1] as const)
          for (const [dir, want] of [
            [1, action],
            [-1, `${action}Back`],
          ] as const) {
            const label = `${def.id} ${action} facing ${facing} rolling ${dir * facing}`;
            expect(pick(def, action, facing, dir, 1)[0], label).toBe(want);
            expect(fighterArt(def)!.clips[want]!.length, label).toBe(faf - 1);
            expect(pick(def, action, facing, dir, faf - 1), label).toEqual([want, faf - 1]);
          }
    },
  );
});

describe('clipFor through a tether reel', () => {
  /** Fluffy's art on the Quick Grapple fixture, so her upB clip (with its `reel` hold) plays on a real tether. */
  const fluffy = getFighter('fluffy');
  const grappler = defineFighter({
    ...fluffy,
    id: 'test-fluffy-grapple',
    moves: { ...fluffy.moves, upB: quickGrapple },
    selectable: false,
  });
  registerFighter(grappler);

  /**
   * Quick Grapple fired from the air at (`x`, 10) on Battlefield: each frame's action and the clip that draws it,
   * for `frames` frames.
   */
  function grapple(def: FighterDef, x: number, frames: number, holds: Hold[] = []) {
    const m = testMatch({ fighter: def.id });
    const f = placeInAir(m, x, 10);
    attack(m, 0, 'upB');
    const seen: { action: string; clip: string; frame: number }[] = [];
    for (let i = 0; i < frames; i++) {
      runPorts(m, 1, holds);
      const [clip, frame] = clipFor(def, fighterArt(def)!, f);
      seen.push({ action: f.action, clip, frame });
    }
    return seen;
  }

  /** The frames from the move's start to the reel's end (the aerial, then the tether actions). */
  const throughReel = (seen: ReturnType<typeof grapple>) =>
    seen.filter((s) => s.action === 'aerial' || s.action.startsWith('tether'));

  it.each([
    ['Fluffy', grappler],
    ['the tether tester', tetherTester],
  ])('keeps playing the move clip when %s starts reeling in', (_, def) => {
    const reel = throughReel(grapple(def, 0, 60));
    const pull = reel.findIndex((s) => s.action === 'tetherPull');
    expect(reel[pull - 1]!.action).toBe('aerial');
    expect(reel.every((s) => s.clip === 'upB')).toBe(true);
    expect(reel[pull]!.frame).toBeGreaterThan(reel[pull - 1]!.frame);
    for (let i = 1; i < reel.length; i++) expect(reel[i]!.frame).toBeGreaterThanOrEqual(reel[i - 1]!.frame);
  });

  it('holds the clip on its reel frame through a long reel', () => {
    const hold = fighterArt(grappler)!.clips.upB!.reel!;
    const reel = throughReel(grapple(grappler, 66, 80)).filter((s) => s.action === 'tetherPull');
    expect(reel.length).toBeGreaterThan(20);
    expect(reel.every((s) => s.frame <= hold)).toBe(true);
    expect(reel.at(-1)!.frame).toBe(hold);
  });

  it('holds the pose the reel arrived in while hanging', () => {
    const seen = grapple(grappler, 0, 60, [{ buttons: ['jump'] }]);
    const hang = seen.findIndex((s) => s.action === 'tetherHang');
    expect(seen[hang - 1]!.action).toBe('tetherPull');
    expect(seen.slice(hang).every((s) => s.action === 'tetherHang')).toBe(true);
    expect(seen[hang]!.frame).toBeGreaterThanOrEqual(seen[hang - 1]!.frame);
    expect(new Set(seen.slice(hang).map((s) => `${s.clip}@${s.frame}`))).toEqual(
      new Set([`upB@${seen[hang]!.frame}`]),
    );
  });
  it('plays the art’s own tetherPull clip from the reel’s first frame instead, when it has one', () => {
    const redball = getFighter('redball');
    const m = testMatch({ fighter: 'redball' });
    const f = placeInAir(m, 104, -6, -1);
    runPorts(m, 1, [{ x: -100, buttons: ['special'] }]);
    const seen: { action: string; clip: string; frame: number }[] = [];
    for (let i = 0; i < 30 && f.action !== 'ledgeCatch'; i++) {
      runPorts(m, 1, []);
      const [clip, frame] = clipFor(redball, fighterArt(redball)!, f);
      seen.push({ action: f.action, clip, frame });
    }
    const pull = seen.filter((s) => s.action === 'tetherPull');
    expect(pull.length).toBeGreaterThan(2);
    expect(pull.map((s) => [s.clip, s.frame])).toEqual(pull.map((_, i) => ['tetherPull', i + 1]));
    expect(seen.filter((s) => s.action === 'aerial').every((s) => s.clip === 'sideBAir')).toBe(true);
  });
});
