import { describe, expect, it } from 'vitest';
import { VERTICAL_LAUNCH_FALL_SPEED } from '../combat/formulas';
import { HITSTUN_CANCEL_AERIAL, HITSTUN_CANCEL_AIR_DODGE } from '../constants';
import type { FighterState } from '../fighter';
import type { MatchState } from '../match';
import { marioReference as mario } from '../testing/reference';
import { placeInAir, run, testMatch, type Hold } from '../testing/sim';

/**
 * Fighter 0 airborne with a pending set-knockback launch (45 degrees unless `angle` says otherwise), as a hit leaves
 * it once hitlag ends. Set knockback gets no balloon speed-up and no tumble gravity bonus, so the launch speed is
 * kb x 0.03 and drops by 0.051 a frame: frame n of hitstun starts at kb x 0.03 - 0.051 x (n - 1).
 */
function launched(kb: number, opts: { fighter?: string; angle?: number } = {}): MatchState {
  const m = testMatch({ fighter: opts.fighter });
  const f = placeInAir(m, -100, 40);
  Object.assign(f, {
    action: 'tumble',
    actionFrame: 0,
    hitstun: 0,
    launch: { kb, angle: opts.angle ?? 45, dir: 1, setKnockback: true },
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
    expect(pressOn(launched(130, { fighter: 'snailbob' }), frame, { cx: 100 }).f.move).toBe('fair');
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

const dodge: Hold = { buttons: ['shield'] };

describe('hitstun cancel by air dodge', () => {
  it('opens after 40 frames of hitstun: no air dodge on frame 40, an air dodge on frame 41', () => {
    // kb 130: launch speed 3.9, already below 2.5 at 1.911 by frame 40.
    const on40 = pressOn(launched(130), HITSTUN_CANCEL_AIR_DODGE.after, dodge);
    expect(on40.speed).toBeCloseTo(1.911, 3);
    expect(on40.f.action).toBe('tumble');

    const on41 = pressOn(launched(130), HITSTUN_CANCEL_AIR_DODGE.after + 1, dodge);
    expect(on41.speed).toBeCloseTo(1.86, 3);
    expect(on41.hitstun).toBe(12);
    expect(on41.f.action).toBe('airDodge');
  });

  it('waits for the launch speed to drop below 2.5', () => {
    // kb 160: 63 frames of hitstun, launch speed 4.8. Frame 46 starts at 2.505, frame 47 at 2.454.
    for (const frame of [41, 46]) {
      const r = pressOn(launched(160), frame, dodge);
      expect(r.speed, `frame ${frame}`).toBeGreaterThanOrEqual(HITSTUN_CANCEL_AIR_DODGE.below);
      expect(r.f.action, `frame ${frame}`).toBe('tumble');
    }
    const on47 = pressOn(launched(160), 47, dodge);
    expect(on47.speed).toBeCloseTo(2.454, 3);
    expect(on47.f.action).toBe('airDodge');
  });

  it('stays shut at a launch speed of exactly 2.5', () => {
    // kb 160 on frame 41, its launch set to (1.5, 2): speed exactly 2.5.
    const m = launched(160);
    const f = m.fighters[0]!;
    run(m, HITSTUN_CANCEL_AIR_DODGE.after);
    f.kb = { x: 1.5, y: 2 };
    expect(speed(f)).toBe(HITSTUN_CANCEL_AIR_DODGE.below);
    run(m, 1, dodge);
    expect(f.hitstun).toBeGreaterThan(0);
    expect(f.action).toBe('tumble');
  });
});

describe('a hitstun cancel ends hitstun', () => {
  /**
   * kb 130 straight up: a near-vertical launch, which falls with DamageFlyTop gravity capped at 1.8 only while
   * hitstun lasts (51 frames here). Cancel on `frame` with `hold`, then fall for 80 frames. Without the cancel ending
   * hitstun the fighter would keep that 1.8 cap; with it, it eases back to its own fall speed of 1.5.
   */
  function cancelUpLaunch(frame: number, hold: Hold, action: string) {
    const m = launched(130, { angle: 90 });
    const r = pressOn(m, frame, hold);
    expect(r.f.flyTop).toBe(true);
    expect(r.hitstun).toBeGreaterThan(0);
    expect(r.f.action).toBe(action);
    const stunAfter = r.f.hitstun;
    let fastest = 0;
    for (let i = 0; i < 80; i++) {
      run(m, 1);
      fastest = Math.min(fastest, r.f.vel.y);
    }
    expect(r.f.ground).toBeNull();
    return { stunAfter, fastest, vy: r.f.vel.y };
  }

  it("after an aerial: hitstun reads 0 and the fall eases back to the fighter's own fall speed", () => {
    const r = cancelUpLaunch(HITSTUN_CANCEL_AERIAL.after + 1, attack, 'aerial');
    expect(r.stunAfter).toBe(0);
    expect(r.fastest).toBeGreaterThan(-VERTICAL_LAUNCH_FALL_SPEED);
    expect(r.vy).toBeCloseTo(-mario.stats.fallSpeed, 6);
  });

  it("after an air dodge: hitstun reads 0 and the fall eases back to the fighter's own fall speed", () => {
    const r = cancelUpLaunch(HITSTUN_CANCEL_AIR_DODGE.after + 1, dodge, 'airDodge');
    expect(r.stunAfter).toBe(0);
    expect(r.fastest).toBeGreaterThan(-VERTICAL_LAUNCH_FALL_SPEED);
    expect(r.vy).toBeCloseTo(-mario.stats.fallSpeed, 6);
  });
});
