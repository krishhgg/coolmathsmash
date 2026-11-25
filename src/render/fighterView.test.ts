import { describe, expect, it } from 'vitest';
import { getFighter } from '../fighters/registry';
import { LEDGE_JUMP, SHIELD_MAX } from '../sim/constants';
import { placeInAir, run, testMatch, until } from '../sim/testing/sim';
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

describe('clipFor', () => {
  it('draws a ledge jump as the rise, then the jump clip counting from the frame the jump began', () => {
    const def = getFighter('fireboy');
    const art = fighterArt(def)!;
    const m = testMatch({ fighter: 'fireboy' });
    const f = placeInAir(m, -85, 4, 1);
    until(m, (g) => g.action === 'ledgeHang');
    const shown: string[] = [];
    for (let i = 0; i < 20; i++) {
      run(m, 1, i === 0 ? { buttons: ['jump'] } : {});
      shown.push(clipFor(def, art, f).join('@'));
    }
    const rise = Array.from({ length: LEDGE_JUMP.rise }, (_, i) => `ledgeJump@${i + 1}`);
    const jump = Array.from({ length: 20 - LEDGE_JUMP.rise }, (_, i) => `jump@${i + 1}`);
    expect(shown).toEqual([...rise, ...jump]);
    expect(f.action).toBe('jump');
  });
});
