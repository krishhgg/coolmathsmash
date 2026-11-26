import { describe, expect, it } from 'vitest';
import { HITSTUN_CANCEL_AERIAL } from '../constants';
import type { FighterState } from '../fighter';
import type { MatchState } from '../match';
import { placeInAir, run, testMatch, type Hold } from '../testing/sim';

/**
 * Fighter 0 airborne with a pending set-knockback launch at 45 degrees, as a hit leaves it once hitlag ends. Set
 * knockback gets no balloon speed-up and no tumble gravity bonus, so the launch speed is kb x 0.03 and drops by
 * 0.051 a frame: frame n of hitstun starts at kb x 0.03 - 0.051 x (n - 1).
 */
function launched(kb: number, fighter?: string): MatchState {
  const m = testMatch({ fighter });
  const f = placeInAir(m, -100, 40);
  Object.assign(f, {
    action: 'tumble',
    actionFrame: 0,
    hitstun: 0,
    launch: { kb, angle: 45, dir: 1, setKnockback: true },
  });
  return m;
}

const speed = (f: FighterState) => Math.hypot(f.kb.x, f.kb.y);

/** Run to the start of hitstun frame `frame`, then press `hold` on it. Returns fighter 0 and its speed then. */
function pressOn(m: MatchState, frame: number, hold: Hold) {
  const f = m.fighters[0]!;
  run(m, frame - 1);
  const before = { speed: speed(f), hitstun: f.hitstun };
  run(m, 1, hold);
  return { f, ...before };
}

const attack: Hold = { buttons: ['attack'] };

describe('hitstun cancel by aerial', () => {
  it('opens after 45 frames of hitstun: no aerial on frame 45, an aerial on frame 46', () => {
    // kb 130: 51 frames of hitstun (first actionable frame 52), launch speed 3.9 falling to 1.656 by frame 45.
    const on45 = pressOn(launched(130), HITSTUN_CANCEL_AERIAL.after, attack);
    expect(on45.speed).toBeCloseTo(1.656, 3);
    expect(on45.f.action).toBe('tumble');

    const on46 = pressOn(launched(130), HITSTUN_CANCEL_AERIAL.after + 1, attack);
    expect(on46.speed).toBeCloseTo(1.605, 3);
    expect(on46.hitstun).toBe(7);
    expect(on46.f.action).toBe('aerial');
    expect(on46.f.move).toBe('nair');
  });

  it('waits for the launch speed to drop below 2', () => {
    // kb 150: 59 frames of hitstun, launch speed 4.5. Frame 50 starts at 2.001, frame 51 at 1.95.
    for (const frame of [46, 50]) {
      const r = pressOn(launched(150), frame, attack);
      expect(r.speed, `frame ${frame}`).toBeGreaterThanOrEqual(HITSTUN_CANCEL_AERIAL.below);
      expect(r.f.action, `frame ${frame}`).toBe('tumble');
    }
    const on51 = pressOn(launched(150), 51, attack);
    expect(on51.speed).toBeCloseTo(1.95, 3);
    expect(on51.hitstun).toBe(10);
    expect(on51.f.action).toBe('aerial');
  });

  it('takes C-stick aerials, but not specials or jumps', () => {
    const frame = HITSTUN_CANCEL_AERIAL.after + 1;
    // The reference fighter has no fair; Snail Bob does. launched() leaves it facing right.
    expect(pressOn(launched(130, 'snailbob'), frame, { cx: 100 }).f.move).toBe('fair');
    expect(pressOn(launched(130), frame, { buttons: ['special'] }).f.action).toBe('tumble');
    expect(pressOn(launched(130), frame, { buttons: ['jump'] }).f.action).toBe('tumble');
  });

  it('counts real frames, not the sped-up hitstun of balloon knockback', () => {
    // An un-sped first actionable frame of 100 runs hitstun out on real frame 62; the window still opens on 46.
    const tumbling = () => {
      const m = testMatch();
      const f = placeInAir(m, -100, 40);
      Object.assign(f, {
        action: 'tumble',
        actionFrame: 0,
        hitstun: 100,
        speedUpFaf: 100,
        kb: { x: 1, y: 0 },
      });
      return m;
    };
    const on45 = pressOn(tumbling(), 45, attack);
    expect(on45.hitstun).toBeGreaterThan(0);
    expect(on45.f.action).toBe('tumble');
    const on46 = pressOn(tumbling(), 46, attack);
    expect(on46.hitstun).toBeGreaterThan(0);
    expect(on46.f.action).toBe('aerial');
  });

  it('changes nothing when hitstun ends before the window opens', () => {
    // kb 100: 39 frames of hitstun, actionable on frame 40 as before, though the launch is already below 2.
    const on39 = pressOn(launched(100), 39, attack);
    expect(on39.speed).toBeLessThan(HITSTUN_CANCEL_AERIAL.below);
    expect(on39.f.action).toBe('tumble');
    expect(pressOn(launched(100), 40, attack).f.action).toBe('aerial');
  });
});
