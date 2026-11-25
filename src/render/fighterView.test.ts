import { describe, expect, it } from 'vitest';
import { getFighter } from '../fighters/registry';
import { SHIELD_MAX } from '../sim/constants';
import { DEFAULT_MATCH, createMatch } from '../sim/match';
import { clipFor, fighterArt, shieldRadius } from './fighterView';

describe('clipFor', () => {
  const f = createMatch({ ...DEFAULT_MATCH, ports: [{ fighter: 'redball' }, { fighter: 'fireboy' }] })
    .fighters[0]!;

  it('plays the move clip on the move’s frame data while a move runs', () => {
    const redball = getFighter('redball');
    Object.assign(f, { action: 'aerial', move: 'sideBAir', actionFrame: 15 });
    expect(clipFor(redball, fighterArt(redball)!, f)).toEqual(['sideBAir', 15]);
  });

  it('plays a tether reel’s own clip from the reel’s first frame, keeping the move clip without one', () => {
    const redball = getFighter('redball');
    Object.assign(f, { action: 'tetherPull', move: 'sideBAir', actionFrame: 3 });
    expect(clipFor(redball, fighterArt(redball)!, f)).toEqual(['tetherPull', 3]);
    const fireboy = getFighter('fireboy');
    Object.assign(f, { action: 'tetherPull', move: 'upB', actionFrame: 3 });
    expect(clipFor(fireboy, fighterArt(fireboy)!, f)[0]).toBe('upB');
  });
});

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
