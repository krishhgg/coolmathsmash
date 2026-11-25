import { describe, expect, it } from 'vitest';
import { getFighter } from '../fighters/registry';
import { SHIELD_MAX } from '../sim/constants';
import { createFighter } from '../sim/fighter';
import { BADGE_BLINK_FRAMES, shieldRadius, statusBadges } from './fighterView';

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
