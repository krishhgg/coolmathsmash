import { describe, expect, it } from 'vitest';
import { hashState } from '../../engine/hash';
import { isIntangible } from '../../sim/actions/registry';
import { knockback } from '../../sim/combat/formulas';
import { spawnEntity } from '../../sim/entities/entities';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { attack, runPorts } from '../../sim/testing/sim';
import { moves } from './moves';
import { DOUBLE_TEAM, SHADOW_STEP_BEHIND } from './specials';

const ID = 'bob-the-robber';
/** Fresh moves deal 1.05x (stale-move negation) and a 1v1 adds 1.2x to the meter. */
const FRESH = 1.05;
const ONE_V_ONE = 1.2;

type Hit = Extract<SimEvent, { type: 'hit' }>;

function place(f: FighterState, x: number, y: number, facing: 1 | -1): void {
  Object.assign(f, { pos: { x, y }, prevPos: { x, y }, vel: { x: 0, y: 0 }, kb: { x: 0, y: 0 }, facing });
}

/** The attacker (P1, the Mario reference unless `attacker` says otherwise) at x -10 facing right, Bob (P2) 8 in front facing it. */
function duel(attacker: string = marioReference.id): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: attacker }, { fighter: ID }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  place(a, -10, 0, 1);
  place(v, -2, 0, -1);
  return { m, a, v };
}

const idle = (m: MatchState) => m.fighters.map(() => ({}));
const ofType = <T extends SimEvent['type']>(m: MatchState, type: T) =>
  m.events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

/**
 * Bob starts Shadow Step and the attacker starts `move` so that its first active frame (`lead`) is Bob's frame `at`.
 * Returns the duel after that frame, whose events are `m.events`.
 */
function counterAt(at: number, move = 'probe', lead = 1, d = duel()) {
  attack(d.m, 1, 'downB');
  runPorts(d.m, at - lead, idle(d.m));
  attack(d.m, 0, move);
  runPorts(d.m, lead, idle(d.m));
  expect(d.v.move === 'downB' ? d.v.actionFrame : at).toBe(at);
  return d;
}

/** Steps until Bob's strike hits (at most 60 frames); returns the hit and the frames it took. */
function untilStrike(m: MatchState): { hit: Hit; frames: number } {
  for (let frames = 1; frames <= 60; frames++) {
    runPorts(m, 1, idle(m));
    const hit = ofType(m, 'hit').find((e) => e.attacker === 1);
    if (hit) return { hit, frames };
  }
  throw new Error('the strike never hit');
}

describe("Bob the Robber: Shadow Step (down special), Lucario's Double Team", () => {
  it("has Double Team's frame data, moved onto the counterattack's clock after the 11 frozen frames", () => {
    expect(moves.downB).toMatchObject({
      faf: 71,
      hits: [],
      intangible: [4, 4],
      counter: { window: [5, 24], move: 'downBHit', multiplier: 0, freeze: 12 },
    });
    const strike = moves.downBHit!;
    expect([strike.faf, strike.intangible, strike.hits.map((w) => w.frames)]).toEqual([
      49,
      [1, 18],
      [[6, 17]],
    ]);
    for (const b of strike.hits[0]!.boxes)
      expect(b).toMatchObject({ damage: 12.5, angle: 70, kbg: 105, bkb: 50, hitlag: 2.2 });
    expect(strike.hits[0]!.boxes.map((b) => b.radius)).toEqual([3.5, 3.5, 5]);
  });

  it('catches on frames 5-24: frames 3 and 25 take the hit, and nothing touches Bob on his intangible frame 4', () => {
    const outcome = (at: number) => {
      const { m, v } = counterAt(at);
      if (ofType(m, 'counter').length > 0) return 'caught';
      return ofType(m, 'hit').some((e) => e.victim === v.port) ? 'hit' : 'nothing';
    };
    expect([3, 4, 5, 14, 24, 25].map(outcome)).toEqual([
      'hit',
      'nothing',
      'caught',
      'caught',
      'caught',
      'hit',
    ]);
  });

  it('takes no damage from the caught hit and freezes the attacker 12 frames, Bob 11', () => {
    const { m, a, v } = counterAt(10);
    expect(ofType(m, 'hit')).toEqual([]);
    expect(ofType(m, 'counter')).toMatchObject([{ port: 1, attacker: 0, move: 'downBHit' }]);
    expect(ofType(m, 'move')).toEqual([{ type: 'move', port: 1, move: 'downBHit' }]);
    expect([v.damage, v.launch, v.hitstun]).toEqual([0, null, 0]);
    expect([a.hitlag, v.hitlag]).toEqual([DOUBLE_TEAM.freeze, DOUBLE_TEAM.freeze - 1]);
  });

  it("strikes 17 frames after the catch, Double Team's kick frame, for a fixed 12.5% whatever it caught", () => {
    for (const [move, lead, caught] of [
      ['probe', 1, 12],
      ['jab', 2, 2.5],
    ] as const) {
      const { m, a } = counterAt(10, move, lead);
      expect(ofType(m, 'counter')[0]!.damage).toBeCloseTo(caught * FRESH, 9);
      const { hit, frames } = untilStrike(m);
      expect(frames, move).toBe(DOUBLE_TEAM.attack.hits[0]);
      expect(hit.damage, move).toBeCloseTo(12.5 * FRESH * ONE_V_ONE, 9);
      const kb = knockback({ percent: 0, damage: 12.5, kbg: 105, bkb: 50, weight: 98, stale: FRESH });
      expect(hit.kb, move).toBeCloseTo(kb, 9);
      expect(a.damage, move).toBeCloseTo(hit.damage, 9);
    }
  });

  it('is intangible for 29 frames after the catch and can act on the 60th, as Double Team is', () => {
    const { m, a, v } = counterAt(10);
    // Out of reach, so the strike whiffs and nothing else holds Bob up.
    place(a, 60, 0, 1);
    for (let frame = 1; frame < DOUBLE_TEAM.attack.faf; frame++) {
      runPorts(m, 1, idle(m));
      expect(isIntangible(v), `frame ${frame}`).toBe(frame <= DOUBLE_TEAM.attack.intangible[1]);
      expect(v.move, `frame ${frame}`).toBe('downBHit');
    }
    runPorts(m, 1, idle(m));
    expect([v.action, v.move]).toEqual(['idle', null]);
  });

  it('reappears behind the attacker on their floor, facing their back, and launches them the way they face', () => {
    const { m, a, v } = counterAt(10);
    expect([v.pos.x, v.pos.y, v.facing, v.action]).toEqual([a.pos.x - SHADOW_STEP_BEHIND, 0, 1, 'attack']);
    expect(v.ground).toEqual(a.ground);
    untilStrike(m);
    expect(a.launch!.dir).toBe(1);

    const facingLeft = duel();
    place(facingLeft.a, 10, 0, -1);
    place(facingLeft.v, 2, 0, 1);
    const turned = counterAt(10, 'probe', 1, facingLeft);
    expect([turned.v.pos.x, turned.v.facing]).toEqual([turned.a.pos.x + SHADOW_STEP_BEHIND, -1]);
    untilStrike(turned.m);
    expect(turned.a.launch!.dir).toBe(-1);
  });

  it('follows an airborne attacker into the air and strikes them there', () => {
    const { m, a, v } = duel();
    place(v, -2, 40, -1);
    Object.assign(v, { ground: null, action: 'fall', actionFrame: 1, jumpsUsed: 1 });
    attack(m, 1, 'downB');
    runPorts(m, 9, idle(m));
    expect(v.action).toBe('aerial');
    Object.assign(a, { ground: null, action: 'fall', actionFrame: 1, jumpsUsed: 1 });
    place(a, -10, v.pos.y, 1);
    attack(m, 0, 'probe');
    runPorts(m, 1, idle(m));
    expect(ofType(m, 'counter')).toHaveLength(1);
    expect([v.pos.x, v.pos.y, v.ground, v.action]).toEqual([
      -10 - SHADOW_STEP_BEHIND,
      a.pos.y,
      null,
      'aerial',
    ]);
    const { hit, frames } = untilStrike(m);
    expect(frames).toBe(DOUBLE_TEAM.attack.hits[0]);
    expect(hit.damage).toBeCloseTo(12.5 * FRESH * ONE_V_ONE, 9);
    expect([v.ground, a.launch!.dir]).toEqual([null, 1]);
  });

  it('lands out of an air catch still swinging, and the strike comes out on time', () => {
    const { m, a, v } = duel();
    attack(m, 1, 'downB');
    runPorts(m, 9, idle(m));
    Object.assign(a, { ground: null, action: 'fall', actionFrame: 1, jumpsUsed: 1 });
    place(a, -10, 0.5, 1);
    attack(m, 0, 'probe');
    runPorts(m, 1, idle(m));
    expect([v.action, v.ground]).toEqual(['aerial', null]);
    let landed = 0;
    for (let frame = 1; frame < DOUBLE_TEAM.attack.hits[0]; frame++) {
      runPorts(m, 1, idle(m));
      if (!landed && v.ground) landed = frame;
    }
    expect(landed).toBeGreaterThan(0);
    expect([v.action, v.move]).toEqual(['attack', 'downBHit']);
    const { frames } = untilStrike(m);
    expect(frames).toBe(1);
  });

  it('lets grabs through', () => {
    const d = duel('fireboy');
    attack(d.m, 1, 'downB');
    runPorts(d.m, 4, idle(d.m));
    runPorts(d.m, 1, [{ buttons: ['grab'] }, {}]);
    const seen: string[] = [];
    let grabbedOn = 0;
    for (let i = 0; i < 12 && d.v.action !== 'grabbed'; i++) {
      grabbedOn = d.v.actionFrame + 1;
      runPorts(d.m, 1, idle(d.m));
      seen.push(...d.m.events.map((e) => e.type));
    }
    expect(d.v.action).toBe('grabbed');
    expect(grabbedOn).toBeGreaterThanOrEqual(DOUBLE_TEAM.window[0]);
    expect(grabbedOn).toBeLessThanOrEqual(DOUBLE_TEAM.window[1]);
    expect(seen).not.toContain('counter');
  });

  it('answers a caught projectile in place, facing it, and freezes nobody else', () => {
    const { m, a, v } = duel('fireboy');
    place(a, -60, 0, 1);
    place(v, -2, 0, 1);
    attack(m, 1, 'downB');
    runPorts(m, 9, idle(m));
    const ball = spawnEntity(m, {
      kind: 'fireboy/fireball',
      owner: 0,
      pos: { x: -8, y: 8 },
      vel: { x: 1.4, y: 0 },
    });
    let caught = false;
    for (let i = 0; i < 5 && !caught; i++) {
      runPorts(m, 1, idle(m));
      caught = ofType(m, 'counter').some((e) => e.entity === ball.id);
    }
    expect(caught).toBe(true);
    expect(ofType(m, 'entityDestroy')).toMatchObject([{ id: ball.id, reason: 'hit' }]);
    expect([v.pos.x, v.facing, v.move, v.damage, a.hitlag]).toEqual([-2, -1, 'downBHit', 0, 0]);
  });

  it('plays out the same every time', () => {
    const play = () => {
      const { m } = counterAt(10);
      runPorts(m, 90, idle(m));
      return hashState(m);
    };
    expect(play()).toBe(play());
  });
});

/**
 * Double Team's kick (12.5% at base aura, 70 degrees, BKB 50, KBG 105; SmashWiki, Lucario (SSBU)/Down special) on the
 * reference Mario at Battlefield's ledge: fresh, no rage, no DI.
 */
const DOUBLE_TEAM_KICK = { damage: 12.5, angle: 70, kbg: 105, bkb: 50 };

describe('Bob the Robber: Shadow Step kill percent against Double Team (Mario at the Battlefield ledge)', () => {
  it("the strike KOs within 5 points of Double Team's kick", () => {
    const kick = koPercent({ hit: DOUBLE_TEAM_KICK });
    expect(kick).not.toBeNull();
    const strike = koPercent({ hit: { fighter: ID, move: 'downBHit' } });
    expect(strike).not.toBeNull();
    expect(Math.abs(strike! - kick!)).toBeLessThanOrEqual(5);
    for (const box of moves.downBHit!.hits[0]!.boxes)
      expect(Math.abs(koPercent({ hit: box })! - kick!), `box ${box.id}`).toBeLessThanOrEqual(5);
  });
});
