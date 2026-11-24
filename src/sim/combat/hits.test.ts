import { describe, expect, it } from 'vitest';
import ref from '../reference/physics-constants.json';
import { SHIELD_DEPLETION } from '../constants';
import type { FighterState } from '../fighter';
import type { MatchState } from '../match';
import { marioReference as mario } from '../testing/reference';
import { attack, input, run, runPorts, testMatch, type Hold } from '../testing/sim';
import { stepMatch } from '../match';

function stepAll(m: MatchState, frames: number, hold: (port: number) => Hold): void {
  for (let i = 0; i < frames; i++)
    stepMatch(
      m,
      m.players.map((p) => input(hold(p.port))),
    );
}
import { hitlagFrames, hitstunFrames, knockback, LAUNCH_DECAY, shieldstunFrames, speedUp } from './formulas';

const kb10 = ref.knockback.test_vectors.find((v) => v.id === 'kb10_fresh_bonus')!;

/**
 * The launch velocity a fighter left with, read back after `frames` (sped-up) frames of flight: the launch speed only
 * decays, by 0.051 per frame along its own direction.
 */
function launchedAt(f: FighterState, frames: number): { x: number; y: number } {
  const speed = Math.hypot(f.kb.x, f.kb.y);
  const k = (speed + LAUNCH_DECAY * frames) / speed;
  return { x: f.kb.x * k, y: f.kb.y * k };
}

/** Two reference fighters standing on Battlefield's main stage, `a` facing `v`. */
function duel(ax = -10, vx = -2): { m: MatchState; a: FighterState; v: FighterState } {
  const m = testMatch({ players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  for (const [f, x, facing] of [
    [a, ax, 1],
    [v, vx, -1],
  ] as const) {
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    Object.assign(f, { action: 'fall', actionFrame: 1, jumpsUsed: 1 });
  }
  run(m, 20);
  expect(a.action).toBe('idle');
  expect(v.action).toBe('idle');
  return { m, a, v };
}

/** Float `v` in the air at (x, y), as if falling. */
function airborne(v: FighterState, x: number, y: number): void {
  Object.assign(v, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    ground: null,
    action: 'fall',
    airFrames: 0,
  });
}

describe('hits (research vector kb10 end to end)', () => {
  it('adds damage x1.2 in 1v1, freezes both for hitlag, then launches at the reference velocity', () => {
    const { m, a, v } = duel();
    v.damage = kb10.pre_percent;
    airborne(v, a.pos.x + 8, 4);
    attack(m, 0, 'probe');
    run(m, 1);

    const stale = kb10.stale_multiplier;
    expect(v.damage).toBeCloseTo(kb10.pre_percent + kb10.damage * stale * 1.2, 6);
    const lag = hitlagFrames(kb10.damage * stale);
    expect(a.hitlag).toBe(lag);
    expect(v.hitlag).toBe(lag);
    expect(v.action).toBe('tumble');

    const frozen = { ...v.pos };
    const attackFrame = a.actionFrame;
    run(m, lag);
    expect(v.pos).toEqual(frozen);
    expect(a.actionFrame).toBe(attackFrame);

    run(m, 1);
    const faf = kb10.expected_first_actionable_frame_unsped;
    const step = speedUp(faf).steps[0]!;
    const launched = launchedAt(v, step);
    expect(launched.x).toBeCloseTo(kb10.expected_vx, 5);
    expect(launched.y).toBeCloseTo(kb10.expected_vy, 5);
    expect(v.pos.x - frozen.x).toBeLessThan(kb10.expected_vx * step);

    let frames = 1;
    while (v.hitstun > 0) {
      run(m, 1);
      frames++;
    }
    expect(frames).toBe(kb10.expected_first_actionable_frame_with_speedup);
    expect(v.action).toBe('tumble');
  });

  it('a weak grounded hit flinches without tumble and slides along the ground at 0.8x (Sakurai angle 0)', () => {
    const { m, a, v } = duel(-10, -3);
    attack(m, 0, 'jab');
    run(m, 2);
    expect(v.action).toBe('hitstun');
    const kb = knockback({ percent: 0, damage: 2.5, kbg: 30, bkb: 20, weight: 98, stale: 1.05 });
    run(m, v.hitlag + 1);
    expect(v.ground).not.toBeNull();
    expect(v.kb.y).toBe(0);
    expect(v.kb.x).toBeGreaterThan(0);
    let frames = 1;
    while (v.action === 'hitstun') {
      run(m, 1);
      frames++;
    }
    expect(frames).toBe(hitstunFrames(kb) + 1);
    expect(v.action).toBe('idle');
    expect(a.staleQueue).toEqual(['jab']);
  });

  it('hits each fighter once per move, ignores intangible fighters, and lets simultaneous hits trade', () => {
    const once = duel();
    attack(once.m, 0, 'probe');
    run(once.m, 4);
    expect(once.a.hitVictims).toEqual([1]);
    expect(once.v.damage).toBeCloseTo(12 * 1.05 * 1.2, 6);

    const ghost = duel();
    ghost.v.intangible = 10;
    attack(ghost.m, 0, 'probe');
    run(ghost.m, 4);
    expect(ghost.v.damage).toBe(0);

    const trade = duel(-6, 6);
    trade.v.staleQueue = ['probe'];
    trade.a.damage = 100;
    attack(trade.m, 0, 'probe');
    attack(trade.m, 1, 'probe');
    run(trade.m, 1);
    expect(trade.v.damage).toBeCloseTo(12 * 1.05 * 1.2, 6);
    expect(trade.a.damage - 100).toBeCloseTo(12 * 0.91 * 1.2, 6);
    expect(trade.a.staleQueue).toEqual(['probe']);
    expect(trade.v.staleQueue).toEqual(['probe', 'probe']);
    expect(trade.a.launch!.kb).toBeCloseTo(
      knockback({ percent: 100, damage: 12, kbg: 100, bkb: 30, weight: 98, stale: 0.91 }),
      6,
    );
  });

  it('one move activation stales once, even when it hits two fighters', () => {
    const m = testMatch({ players: 3 });
    const [a, b, c] = m.fighters as [FighterState, FighterState, FighterState];
    for (const [f, x] of [
      [a, -10],
      [b, -4],
      [c, -2],
    ] as const) {
      Object.assign(f, {
        pos: { x, y: 1 },
        prevPos: { x, y: 1 },
        vel: { x: 0, y: 0 },
        ground: null,
        action: 'fall',
      });
      Object.assign(f, { actionFrame: 1, jumpsUsed: 1, facing: 1 });
    }
    run(m, 20);
    attack(m, 0, 'probe');
    run(m, 1);
    expect(b.damage).toBeCloseTo(12 * 1.05, 6);
    expect(c.damage).toBeCloseTo(12 * 1.05, 6);
    expect(a.staleQueue).toEqual(['probe']);
  });

  it('two hits on one victim in a frame both read its state from before either landed', () => {
    const m = testMatch({ players: 3 });
    const [a, b, v] = m.fighters as [FighterState, FighterState, FighterState];
    for (const [f, x, facing] of [
      [a, -10, 1],
      [b, 6, -1],
      [v, -2, 1],
    ] as const) {
      Object.assign(f, {
        pos: { x, y: 1 },
        prevPos: { x, y: 1 },
        vel: { x: 0, y: 0 },
        ground: null,
        action: 'fall',
      });
      Object.assign(f, { actionFrame: 1, jumpsUsed: 1, facing });
    }
    run(m, 20);
    const crouch = (n: number) => stepAll(m, n, (port) => (port === 2 ? { y: -100 } : {}));
    crouch(5);
    expect(v.action).toBe('crouch');
    attack(m, 0, 'probe');
    attack(m, 1, 'flat');
    crouch(1);
    const flat = knockback({
      percent: 0,
      damage: 12,
      kbg: 100,
      bkb: 60,
      weight: 98,
      stale: 1.05,
      crouch: true,
    });
    expect(v.damage).toBeCloseTo(2 * 12 * 1.05, 6);
    expect(v.launch!.kb).toBeCloseTo(flat, 6);
    expect(v.launch!.dir).toBe(-1);
    expect(v.hitlag).toBe(Math.floor(hitlagFrames(12 * 1.05) * 0.67));
  });

  it('a flat grounded hit strong enough to tumble slides along the ground for its whole hitstun', () => {
    const { m, v } = duel(-10, -3);
    attack(m, 0, 'flat');
    run(m, 1);
    const kb = v.launch!.kb;
    expect(kb).toBeGreaterThanOrEqual(80);
    expect(kb).toBeLessThan(120);
    run(m, v.hitlag + 1);
    let frames = 1;
    while (v.hitstun > 0) {
      expect(v.ground).not.toBeNull();
      expect(v.action).toBe('hitstun');
      run(m, 1);
      frames++;
    }
    expect(frames).toBe(speedUp(hitstunFrames(kb) + 1).actionable);
  });

  it('stales a move that keeps hitting: the second hit deals 0.91x where the first got the 1.05x fresh bonus', () => {
    const { m, a, v } = duel();
    attack(m, 0, 'probe');
    run(m, 120);
    const first = v.damage;
    Object.assign(v, {
      pos: { x: a.pos.x + 8, y: 0 },
      prevPos: { x: a.pos.x + 8, y: 0 },
      kb: { x: 0, y: 0 },
    });
    v.action = 'idle';
    v.ground = a.ground;
    attack(m, 0, 'probe');
    run(m, 1);
    expect(first).toBeCloseTo(12 * 1.05 * 1.2, 6);
    expect(v.damage - first).toBeCloseTo(12 * 0.91 * 1.2, 6);
  });

  it('crouch cancelling takes 0.85x knockback and 0.67x hitlag', () => {
    const stand = duel();
    attack(stand.m, 0, 'probe');
    run(stand.m, 1);
    const crouch = duel();
    runPorts(crouch.m, 5, [{}, { y: -100 }]);
    expect(crouch.v.action).toBe('crouch');
    attack(crouch.m, 0, 'probe');
    runPorts(crouch.m, 1, [{}, { y: -100 }]);
    expect(crouch.v.launch!.kb).toBeCloseTo(stand.v.launch!.kb * 0.85, 6);
    expect(crouch.v.hitlag).toBe(Math.floor(stand.v.hitlag * 0.67));
  });

  it('DI: holding the stick perpendicular to a tumble launch bends it (up to 0.17 rad)', () => {
    const launchAngle = (stick: { x?: number; y?: number }) => {
      const m = testMatch({ players: 2 });
      const [v, a] = m.fighters as [FighterState, FighterState];
      Object.assign(a, { pos: { x: -10, y: 0 }, facing: 1, ground: m.fighters[0]!.ground, action: 'idle' });
      v.damage = 100;
      airborne(v, -2, 4);
      attack(m, 1, 'probe');
      runPorts(m, 1, [stick, {}]);
      runPorts(m, v.hitlag + 1, [stick, {}]);
      return (Math.atan2(v.kb.y, v.kb.x) * 180) / Math.PI;
    };
    const neutral = launchAngle({});
    expect(launchAngle({ x: 70.71, y: -70.71 })).toBeCloseTo(neutral - 9.74, 1);
    expect(launchAngle({ x: -70.71, y: 70.71 })).toBeCloseTo(neutral + 9.74, 1);
    expect(launchAngle({ y: -100 })).toBeCloseTo(neutral - 9.74 * Math.cos((neutral * Math.PI) / 180), 1);
  });

  it('a KO: a strong launch at high % carries the victim past the blast zone', () => {
    const { m, a, v } = duel();
    v.damage = 400;
    airborne(v, a.pos.x + 8, 4);
    attack(m, 0, 'probe');
    for (let i = 0; i < 240 && v.action !== 'ko'; i++) run(m, 1);
    expect(v.action).toBe('ko');
    expect(v.stocks).toBe(2);
  });
});

describe('shield hits', () => {
  it('takes shield damage x1.19 and shieldstun instead of %, pushes both apart, then keeps shielding', () => {
    const { m, a, v } = duel(-10, -3);
    runPorts(m, 5, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shield');
    const hp = v.shieldHp;
    attack(m, 0, 'probe');
    runPorts(m, 1, [{}, { buttons: ['shield'] }]);
    const damage = 12 * 1.05;
    expect(v.damage).toBe(0);
    expect(v.action).toBe('shieldStun');
    expect(hp - v.shieldHp).toBeCloseTo(damage * 1.19 + SHIELD_DEPLETION, 6);
    expect(v.hitstun).toBe(shieldstunFrames(damage, 'other'));
    expect(v.kb.x).toBeGreaterThan(0);
    expect(a.kb.x).toBeLessThan(0);
    runPorts(m, v.hitlag + v.hitstun + 1, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shield');
  });

  it('breaks an emptied shield once hitlag ends', () => {
    const { m, v } = duel(-10, -3);
    runPorts(m, 5, [{}, { buttons: ['shield'] }]);
    v.shieldHp = 5;
    attack(m, 0, 'probe');
    runPorts(m, 1, [{}, { buttons: ['shield'] }]);
    runPorts(m, v.hitlag + 1, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shieldBreak');
  });
});

describe('aerials', () => {
  it('pays the landing lag when landing mid-move, and only normal lag in an auto-cancel window', () => {
    const lag = (startY: number) => {
      const m = testMatch();
      const f = m.fighters[0]!;
      airborne(f, 0, startY);
      attack(m, 0, 'nair');
      while (f.action === 'aerial') run(m, 1);
      return f.action === 'land' ? f.landingLag : -1;
    };
    expect(lag(5)).toBe(6);
    expect(lag(0.05)).toBe(mario.stats.softLandingLag);
  });

  it('an auto-cancelled landing after a long airtime still takes the normal hard landing lag', () => {
    const m = testMatch();
    const f = m.fighters[0]!;
    airborne(f, 0, 0.05);
    f.airFrames = 30;
    attack(m, 0, 'nair');
    while (f.action === 'aerial') run(m, 1);
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(mario.stats.hardLandingLag);
  });
});
