import { describe, expect, it } from 'vitest';
import { getFighter, registerFighter } from '../fighters/registry';
import { defineFighter, type FighterDef } from '../fighters/types';
import { SHIELD_MAX } from '../sim/constants';
import { createFighter } from '../sim/fighter';
import { quickGrapple, tetherTester } from '../sim/testing/tethers';
import { attack, placeInAir, runPorts, testMatch, type Hold } from '../sim/testing/sim';
import { BADGE_BLINK_FRAMES, clipFor, fighterArt, shieldRadius, statusBadges } from './fighterView';

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

describe('statusBadges', () => {
  const squared = { kind: 'redball/squared', age: 1, since: 0, source: 0 };

  it('draws one badge per status that has a colour, steady until its last second, then blinking', () => {
    const f = createFighter(1, 'fireboy', [0, 0, 1], 3);
    expect(statusBadges(f, 0)).toEqual([]);
    f.statuses = [{ ...squared, frames: 300 }];
    expect(statusBadges(f, 4)).toEqual(['#3b3b46']);
    f.statuses = [{ ...squared, frames: BADGE_BLINK_FRAMES }];
    expect(statusBadges(f, 0)).toEqual(['#3b3b46']);
    expect(statusBadges(f, 4)).toEqual([]);
  });
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
});
