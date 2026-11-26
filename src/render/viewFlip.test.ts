import { describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from '../sim/match';
import { marioReference } from '../sim/testing/reference';
import { registerFighter } from '../fighters/registry';
import { FLIP_EDGE, flipScale, flipScreenY, viewFlip } from './viewFlip';
import type { ViewFlip } from './rig/types';

registerFighter(marioReference);

const FLIP: ViewFlip = { turn: [40, 61], back: [231, 247] };

describe('view flip', () => {
  it('is upright before the turn, upside down from its last frame until the turn back, and upright after', () => {
    for (const f of [0, 1, 39, 247, 248, 400]) expect(flipScale(FLIP, f), `${f}`).toBe(1);
    for (const f of [61, 62, 150, 230]) expect(flipScale(FLIP, f), `${f}`).toBe(-1);
    expect(flipScale(FLIP, 40)).toBeLessThan(1);
    expect(flipScale(FLIP, 40)).toBeGreaterThan(0.95);
    expect(flipScale(FLIP, 231)).toBeGreaterThan(-1);
    expect(flipScale(FLIP, 231)).toBeLessThan(-0.95);
    expect(flipScale(FLIP, 246)).toBeGreaterThan(0.95);
  });

  it('turns smoothly through the middle, never thinner than FLIP_EDGE, and changes sign once each way', () => {
    let last = 1;
    let signs = 0;
    for (let f = 39; f <= 248; f += 0.25) {
      const s = flipScale(FLIP, f);
      expect(Math.abs(s), `${f}`).toBeGreaterThanOrEqual(FLIP_EDGE);
      expect(Math.abs(s - last), `${f}`).toBeLessThan(0.1);
      if (Math.sign(s) !== Math.sign(last)) signs++;
      last = s;
    }
    expect(signs).toBe(2);
  });

  it('is 1 for a match where no move turns the view, and mirrors screen ys about the middle', () => {
    const m: MatchState = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: marioReference.id }, { fighter: 'runner' }],
    });
    expect(viewFlip(m)).toBe(1);
    m.fighters[0]!.move = 'jab';
    m.fighters[1]!.move = 'fsmash';
    expect(viewFlip(m, 0.5)).toBe(1);
    expect(flipScreenY(100, -1, 720)).toBe(620);
    expect(flipScreenY(100, 1, 720)).toBe(100);
  });

  it("reads the fighter's move frame, between frames by alpha and held through hitlag", () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: marioReference.id }, { fighter: 'runner' }],
    });
    const r = m.fighters[1]!;
    Object.assign(r, { move: 'finalSmash', actionFrame: 50 });
    expect(viewFlip(m)).toBe(flipScale(FLIP, 50));
    expect(viewFlip(m, 0.5)).toBe(flipScale(FLIP, 49.5));
    r.hitlag = 3;
    expect(viewFlip(m, 0.5)).toBe(flipScale(FLIP, 50));
  });
});
