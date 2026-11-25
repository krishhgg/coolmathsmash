import { describe, expect, it } from 'vitest';
import { moves } from '../../fighters/fireboy/moves';
import { stats } from '../../fighters/fireboy/stats';
import ref from '../reference/physics-constants.json';
import { knockback, launch, LAUNCH_DECAY, rageMultiplier, speedUp } from '../combat/formulas';
import { GRAB } from '../constants';
import type { FighterState } from '../fighter';
import type { MatchState } from '../match';
import { attack, runPorts, testMatch, type Hold } from '../testing/sim';
import { findGrabs } from './grab';

const G = ref.grab;

/** Fireboys standing on Battlefield's main stage: P1 at -10 facing right, the others `gaps` in front of him facing him. */
function duel(...gaps: number[]): { m: MatchState; a: FighterState; v: FighterState; c: FighterState } {
  const m = testMatch({ fighter: 'fireboy', players: gaps.length + 1 });
  const xs = [-10, ...gaps.map((g) => -10 + g)];
  m.fighters.forEach((f, i) => {
    const x = xs[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, {
      action: 'fall',
      actionFrame: 1,
      jumpsUsed: 1,
      facing: i === 0 ? 1 : -1,
      intangible: 0,
    });
  });
  step(m, 20);
  for (const f of m.fighters) expect(f.action).toBe('idle');
  const [a, v, c] = m.fighters as [FighterState, FighterState, FighterState];
  return { m, a, v, c };
}

/** Step every port: `holds[port]` (neutral when missing), or a function of the frame index. */
function step(m: MatchState, frames: number, holds: Hold[] | ((i: number) => Hold[]) = []): void {
  for (let i = 0; i < frames; i++) runPorts(m, 1, typeof holds === 'function' ? holds(i) : holds);
}

/** P1 grabs P2 standing 12 units away at `percent`; returns on the frame P2 is caught. */
function grabbed(percent = 0, gaps = [12]) {
  const d = duel(...gaps);
  d.v.damage = percent;
  step(d.m, 1, [{ buttons: ['grab'] }]);
  expect(d.a.move).toBe('grab');
  for (let i = 0; i < 10 && d.v.action !== 'grabbed'; i++) step(d.m, 1);
  expect(d.v.action).toBe('grabbed');
  expect(d.a.action).toBe('grabHold');
  return d;
}

/** Frames from the catch until P2 breaks free, P2 holding `hold(i)` on frame i of the hold (i = 0 first). */
function holdFrames(d: ReturnType<typeof grabbed>, hold: (i: number) => Hold = () => ({})): number {
  let n = 0;
  while (d.v.action === 'grabbed' && n < 1000) step(d.m, 1, () => [{}, hold(n++)]);
  expect(d.v.action).toBe('grabRelease');
  expect(d.a.action).toBe('grabRelease');
  return n;
}

describe('grab hold time (reference grab section)', () => {
  it.each(G.test_vectors.map((t) => [t.percent, t.expected_frames]))(
    'a fighter grabbed at %d percent breaks free after %d frames without mashing',
    (percent, frames) => {
      expect(holdFrames(grabbed(percent))).toBe(frames);
    },
  );

  it('the held fighter is kept just in front of the grabber, facing him', () => {
    const { a, v } = grabbed();
    expect(v.pos.x - a.pos.x).toBeCloseTo(stats.width + 1, 6);
    expect(v.pos.y).toBe(a.pos.y);
    expect(v.facing).toBe(-a.facing);
  });

  it('each new stick direction cuts the hold by the reference 8 frames', () => {
    const presses = 5;
    const stick = (i: number): Hold => (i < presses ? { x: i % 2 ? -100 : 100 } : {});
    const base = G.test_vectors[0]!.expected_frames;
    expect(holdFrames(grabbed(0), stick)).toBe(Math.ceil(base - presses * G.mash_per_stick_input));
    expect(holdFrames(grabbed(0), () => ({ x: -100 }))).toBe(Math.ceil(base - G.mash_per_stick_input));
  });

  it('each button press cuts the hold by the reference 14.4 frames', () => {
    const presses = 3;
    const press = (i: number): Hold => (i < presses * 2 && i % 2 === 0 ? { buttons: ['attack'] } : {});
    const base = G.test_vectors[0]!.expected_frames;
    expect(holdFrames(grabbed(0), press)).toBe(Math.ceil(base - presses * G.mash_per_button_input));
  });

  it('mashing never brings the hold under the reference 19 frames', () => {
    expect(holdFrames(grabbed(0), (i) => ({ x: i % 2 ? -100 : 100 }))).toBe(G.min_hold_frames);
    expect(holdFrames(grabbed(0), (i) => (i % 2 ? {} : { buttons: ['jump'] }))).toBe(G.min_hold_frames);
  });

  it('after a release both slide apart, and the freed fighter cannot be grabbed again for 60 frames', () => {
    /** P1 regrabs P2 with his grab box out on frames released+first and released+first+1. */
    const regrab = (first: number) => {
      const d = grabbed();
      holdFrames(d);
      expect(Math.sign(d.v.kb.x)).toBe(1);
      expect(Math.sign(d.a.kb.x)).toBe(-1);
      const released = d.m.frame - 1;
      const [start] = moves.grab!.hits[0]!.frames;
      while (d.m.frame < released + first - (start - 1)) step(d.m, 1);
      Object.assign(d.v.pos, { x: d.a.pos.x + 12 });
      expect(d.a.action).toBe('idle');
      step(d.m, 1, [{ buttons: ['grab'] }]);
      while (d.a.move === 'grab' && d.v.action !== 'grabbed') step(d.m, 1);
      return d.v.action === 'grabbed' ? d.m.frame - 1 - released : null;
    };
    expect(regrab(G.regrab_immunity_frames - 1)).toBeNull();
    expect(regrab(G.regrab_immunity_frames)).toBe(G.regrab_immunity_frames + 1);
  });
});

describe('shield grab', () => {
  it('comes out 4 frames after shieldstun ends (grab box out on post-shieldstun frame 6 + 4)', () => {
    const { m, a, v } = duel(12);
    step(m, 5, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shield');
    attack(m, 0, 'ftilt');
    let grabHeld = false;
    let after = 0;
    let began = 0;
    for (let i = 0; i < 60 && !began; i++) {
      const stunned = v.action === 'shieldStun';
      grabHeld ||= stunned;
      step(m, 1, [{}, { buttons: grabHeld ? ['shield', 'grab'] : ['shield'] }]);
      if (after > 0 || (stunned && v.action !== 'shieldStun')) after++;
      if (v.move === 'grab') began = after;
    }
    const [start] = moves.grab!.hits[0]!.frames;
    const out = began + start - 1;
    expect(out).toBe(start + ref.shield.out_of_shield.shield_grab_after_shieldstun_frames);
    step(m, start - 1, [{}, { buttons: ['shield', 'grab'] }]);
    expect(a.action).toBe('grabbed');
  });

  it('Shield + Attack grabs out of a shield, and a fresh shield (no shieldstun) grabs at once', () => {
    const { m, v } = duel(30);
    step(m, 6, [{}, { buttons: ['shield'] }]);
    step(m, 1, [{}, { buttons: ['shield', 'attack'] }]);
    expect(v.move).toBe('grab');
    const fresh = duel(30);
    step(fresh.m, 3, [{}, { buttons: ['shield'] }]);
    step(fresh.m, 1, [{}, { buttons: ['shield', 'grab'] }]);
    expect(fresh.v.move).toBe('grab');
  });
});

describe('who gets grabbed', () => {
  it('grabs go through shields', () => {
    const { m, a, v } = duel(12);
    step(m, 5, [{}, { buttons: ['shield'] }]);
    step(m, 1, [{ buttons: ['grab'] }, { buttons: ['shield'] }]);
    step(m, 8, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('grabbed');
    expect(a.action).toBe('grabHold');
  });

  it('nobody behind the grabber, and grab boxes are half size against airborne fighters', () => {
    /** Whom P1's grab box (on its first active frame) catches with P2 `gap` in front of him, in `action`. */
    const near = (gap: number, action = 'idle') => {
      const d = duel(30);
      d.v.action = action;
      attack(d.m, 0, 'grab');
      d.a.actionFrame = moves.grab!.hits[0]!.frames[0];
      d.v.pos.x = d.a.pos.x + gap;
      return findGrabs(d.m).map((g) => g.v.port);
    };
    expect(near(0.5)).toEqual([1]);
    expect(near(-0.5)).toEqual([]);
    expect(near(8, 'down')).toEqual([]);

    /** P1's grab against P2 `gap` away, lifted into the air just before the grab box comes out. */
    const caught = (gap: number, airborne: boolean) => {
      const d = duel(gap);
      step(d.m, 1, [{ buttons: ['grab'] }]);
      step(d.m, 4);
      if (airborne) Object.assign(d.v, { ground: null, action: 'fall', pos: { x: d.v.pos.x, y: 2 } });
      step(d.m, 1);
      return d.v.action === 'grabbed';
    };
    const box = moves.grab!.hits[0]!.boxes[0]!;
    const airReach = box.x + box.radius / 2 + stats.width / 2;
    expect(caught(airReach - 0.5, true)).toBe(true);
    expect(caught(airReach + 0.5, true)).toBe(false);
    expect(caught(airReach + 0.5, false)).toBe(true);
  });

  it('two fighters grabbing each other on the same frame clank: both release and take 1% (1.2% in 1v1)', () => {
    const { m, a, v } = duel(12);
    step(m, 1, [{ buttons: ['grab'] }, { buttons: ['grab'] }]);
    step(m, 6);
    expect(a.action).toBe('grabRelease');
    expect(v.action).toBe('grabRelease');
    expect(a.damage).toBeCloseTo(1.2, 6);
    expect(v.damage).toBeCloseTo(1.2, 6);
  });

  it('an attack landing on the same frame as a grab beats it', () => {
    const { m, a, v } = duel(12);
    step(m, 1, [{}, { buttons: ['grab'] }]);
    step(m, 2);
    attack(m, 0, 'jab');
    step(m, 3);
    expect(v.action).toBe('hitstun');
    expect(a.action).not.toBe('grabbed');
  });
});

describe('pummel and throws', () => {
  it('a pummel deals 1.3% with hitlag and keeps the hold', () => {
    const { m, a, v } = grabbed(20);
    step(m, 1, [{ buttons: ['attack'] }]);
    expect(a.action).toBe('grabPummel');
    expect(v.damage).toBeCloseTo(20 + 1.3 * 1.2, 6);
    expect(a.hitlag).toBe(14);
    expect(v.hitlag).toBe(14);
    step(m, 30);
    expect(v.action).toBe('grabbed');
    expect(a.action).toBe('grabHold');
  });

  it('a throw launches with the knockback formula on its release frame, without hitlag', () => {
    const { m, a, v } = grabbed(100);
    a.damage = 60;
    const t = moves.fthrow!.throw!;
    step(m, 1, [{ x: 100 }]);
    expect(a.move).toBe('fthrow');
    step(m, t.frame - 2);
    expect(v.action).toBe('grabbed');
    step(m, 1);
    expect(a.actionFrame).toBe(t.frame);
    const kb = knockback({
      percent: 100,
      damage: t.hit.damage,
      kbg: t.hit.kbg,
      bkb: t.hit.bkb,
      weight: stats.weight,
      stale: 1.05,
      rage: rageMultiplier(60),
    });
    expect(v.launch).toEqual({ kb, angle: t.hit.angle, dir: a.facing, setKnockback: false });
    expect(v.damage).toBeCloseTo(100 + t.hit.damage * 1.05 * 1.2, 6);
    expect(v.action).toBe('tumble');
    expect(v.hitlag).toBe(0);
    expect(a.hitlag).toBe(0);
    expect(a.staleQueue[0]).toBe('fthrow');

    const from = { ...v.pos };
    step(m, 1);
    const l = launch({ kb, angle: t.hit.angle, aerial: false, gravity: stats.gravity });
    const sped = speedUp(Math.floor(kb * 0.4)).steps[0]!;
    const speed = Math.hypot(v.kb.x, v.kb.y) + LAUNCH_DECAY * sped;
    expect(speed).toBeCloseTo(Math.hypot(l.vx, l.vy), 5);
    expect(Math.atan2(v.kb.y, v.kb.x * a.facing)).toBeCloseTo(Math.atan2(l.vy, l.vx), 5);
    expect(Math.sign(v.pos.x - from.x)).toBe(a.facing);
    expect(v.ground).toBeNull();
  });

  it('a started throw cannot be mashed out of', () => {
    const { m, a, v } = grabbed(0);
    const { frame, hit } = moves.bthrow!.throw!;
    step(m, 1, [{ x: -100 }]);
    expect(a.move).toBe('bthrow');
    for (let i = 2; i < frame; i++) {
      step(m, 1, [{}, { x: i % 2 ? -100 : 100, buttons: i % 2 ? [] : ['jump'] }]);
      expect(v.action).toBe('grabbed');
      expect(v.grabPartner).toBe(a.port);
      expect(v.damage).toBe(0);
    }
    step(m, 1);
    expect(a.actionFrame).toBe(frame);
    expect(v.grabPartner).toBe(-1);
    expect(v.action).toBe('tumble');
    expect(v.launch).toMatchObject({ angle: hit.angle, dir: -a.facing });
    expect(v.launch!.kb).toBeCloseTo(knockback({ ...hit, percent: 0, weight: stats.weight, stale: 1.05 }));
    expect(v.damage).toBeCloseTo(hit.damage * 1.05 * 1.2, 6);
  });

  it('back throw carries the opponent behind the thrower and launches them that way', () => {
    const { m, a, v } = grabbed(100);
    const t = moves.bthrow!.throw!;
    step(m, 1, [{ x: -100 }]);
    expect(a.move).toBe('bthrow');
    step(m, t.frame - 1);
    expect(a.actionFrame).toBe(t.frame);
    expect(v.pos.x - a.pos.x).toBeCloseTo(-(stats.width + 1) * a.facing, 6);
    step(m, 1);
    expect(Math.sign(v.kb.x)).toBe(-a.facing);
    expect(a.facing).toBe(1);
  });
});

describe('grabs with more players', () => {
  it('a held fighter armours through hits from others until they add up to 10%', () => {
    const { m, a, v, c } = grabbed(0, [12, 18]);
    expect(v.pos.x).toBeCloseTo(-1, 6);
    attack(m, 2, 'jab');
    step(m, 4);
    expect(v.damage).toBeCloseTo(3 * 1.05, 6);
    expect(v.action).toBe('grabbed');
    step(m, 30);
    expect(v.action).toBe('grabbed');
    attack(m, 2, 'ftilt');
    step(m, 6);
    expect(v.damage).toBeGreaterThanOrEqual(G.escape_when_hit_for_total_damage);
    expect(v.action).toBe('hitstun');
    expect(a.action).toBe('grabRelease');
    expect(c.action).toBe('attack');
  });

  it('hitting the grabber frees the held fighter; a throw is invincible until it lets go', () => {
    const { m, a, v, c } = grabbed(0, [12, -10]);
    c.facing = 1;
    attack(m, 2, 'ftilt');
    step(m, 6);
    expect(a.damage).toBeGreaterThan(0);
    expect(v.action).toBe('grabRelease');

    const t = grabbed(0, [12, -10]);
    t.c.facing = 1;
    step(t.m, 1, [{ x: -100 }]);
    attack(t.m, 2, 'ftilt');
    step(t.m, 6);
    expect(t.a.damage).toBe(0);
    expect(t.v.action).toBe('grabbed');
  });

  it('one hit on both grab partners launches the holder and frees the held fighter, whatever their ports', () => {
    for (const holder of [0, 1]) {
      const d = duel(12, 30);
      const [a, v] = holder === 0 ? [d.a, d.v] : [d.v, d.a];
      step(d.m, 1, holder === 0 ? [{ buttons: ['grab'] }] : [{}, { buttons: ['grab'] }]);
      for (let i = 0; i < 10 && v.action !== 'grabbed'; i++) step(d.m, 1);
      expect(v.action).toBe('grabbed');
      const x = (a.pos.x + v.pos.x) / 2;
      Object.assign(d.c, { pos: { x, y: 6 }, prevPos: { x, y: 6 }, vel: { x: 0, y: 0 }, ground: null });
      attack(d.m, 2, 'nair');
      for (let i = 0; i < 6 && v.damage === 0; i++) step(d.m, 1);
      expect(a.damage).toBeCloseTo(8 * 1.05, 6);
      expect(v.damage).toBeCloseTo(8 * 1.05, 6);
      expect(a.launch).not.toBeNull();
      expect(['hitstun', 'tumble']).toContain(a.action);
      expect(v.launch).toBeNull();
      expect(v.action).toBe('grabRelease');
    }
  });
});

describe('grab release', () => {
  /** P1 holds P2 with his feet at (x, y) on `ground`, facing `facing`, until the hold runs out at 0%; returns on the frame both are released. */
  function releasedAt(x: number, y: number, facing: 1 | -1 = 1, ground?: FighterState['ground']) {
    const d = grabbed();
    Object.assign(d.a, { pos: { x, y }, prevPos: { x, y }, facing, ground: ground ?? d.a.ground });
    holdFrames(d);
    return d;
  }

  it('pushed off the stage, the held fighter stays in grab release as long as the holder', () => {
    const { m, a, v } = releasedAt(70, 0);
    let airborne = false;
    for (let i = 0; i < GRAB.releaseLag; i++) {
      step(m, 1);
      airborne ||= v.ground === null;
      expect(v.action).toBe('grabRelease');
      expect(a.action).toBe('grabRelease');
    }
    expect(airborne).toBe(true);
    step(m, 1);
    expect(v.action).toBe('fall');
    expect(a.action).toBe('idle');
  });

  it('pushed off a platform, the held fighter keeps its grab release through the landing', () => {
    const { m, a, v } = releasedAt(34, 24.12, -1, { kind: 'platform', index: 2 });
    let landed = false;
    for (let i = 0; i < GRAB.releaseLag; i++) {
      step(m, 1);
      landed ||= v.ground?.kind === 'solid';
      expect(v.action).toBe('grabRelease');
    }
    expect(landed).toBe(true);
    step(m, 1);
    expect(v.action).toBe('idle');
    expect(a.action).toBe('idle');
  });
});
