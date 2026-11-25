// Imported before anything else on purpose: tether.ts must work whatever loads first (see src/sim/context.ts).
import { tetherOrigin } from './tether';
import { describe, expect, it } from 'vitest';
import { quickGrapple, tetherTester } from '../testing/tethers';
import { attack, placeInAir, runPorts, testMatch } from '../testing/sim';
import { ACTIONS } from './registry';

describe('tether.ts imported first', () => {
  it('still registers the tether actions', () => {
    expect(ACTIONS.tetherPull).toBeDefined();
    expect(ACTIONS.tetherHang).toBeDefined();
  });

  it('fires, anchors and reels in', () => {
    const m = testMatch({ fighter: tetherTester.id });
    const f = placeInAir(m, 0, 10);
    attack(m, 0, 'upB');
    for (let i = 0; i < 30 && f.action !== 'tetherPull'; i++) runPorts(m, 1, []);
    expect([f.action, f.move, f.tether?.kind]).toEqual(['tetherPull', 'upB', 'surface']);
    const y = tetherOrigin(f).y;
    runPorts(m, 1, []);
    expect(tetherOrigin(f).y - y).toBeCloseTo(quickGrapple.tether!.pullSpeed, 9);
  });
});
