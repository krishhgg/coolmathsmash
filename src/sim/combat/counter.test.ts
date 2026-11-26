import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { defineFighter } from '../../fighters/types';
import { hashState } from '../../engine/hash';
import { isIntangible } from '../actions/registry';
import { COUNTER } from '../constants';
import { spawnEntity } from '../entities/entities';
import type { SimEvent } from '../events';
import type { FighterState } from '../fighter';
import { createMatch, type MatchState } from '../match';
import { surfaceRange } from '../movement';
import { posedStage } from '../movingStage';
import { COUNTER_TEST_FIGHTERS } from '../testing/counter';
import { marioReference } from '../testing/reference';
import { attack, runPorts } from '../testing/sim';
import { knockback } from './formulas';

for (const def of COUNTER_TEST_FIGHTERS) registerFighter(def);

/** The Mario reference with a 45% hit (probe's box otherwise), to reach the counter's 50% cap. */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'test-counter-heavy',
    name: 'Counter heavy hitter',
    moves: {
      ...marioReference.moves,
      heavy: {
        kind: 'other',
        faf: 30,
        hits: [
          {
            frames: [1, 3],
            boxes: [{ id: 0, x: 8, y: 8, radius: 8, damage: 45, angle: 45, kbg: 100, bkb: 30 }],
          },
        ],
      },
    },
  }),
);

/** Fresh moves deal 1.05x (stale-move negation) and 1v1 adds 1.2x to the meter. */
const FRESH = 1.05;
const ONE_V_ONE = 1.2;

type Counter = Extract<SimEvent, { type: 'counter' }>;
type Hit = Extract<SimEvent, { type: 'hit' }>;

function place(f: FighterState, x: number, y: number, facing: 1 | -1): void {
  Object.assign(f, { pos: { x, y }, prevPos: { x, y }, vel: { x: 0, y: 0 }, kb: { x: 0, y: 0 }, facing });
}

/**
 * The attacker (P1, the Mario reference by default) at x -10 facing right and the counterer (P2) 8 units in front,
 * facing it unless `facing` says otherwise. More attackers stand at x 6, facing left.
 */
function duel(opts: { attacker?: string; counterer?: string; facing?: 1 | -1; more?: number } = {}): {
  m: MatchState;
  a: FighterState;
  v: FighterState;
} {
  const attacker = opts.attacker ?? marioReference.id;
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [
      { fighter: attacker },
      { fighter: opts.counterer ?? 'test-counter' },
      ...Array.from({ length: opts.more ?? 0 }, () => ({ fighter: attacker })),
    ],
  });
  runPorts(
    m,
    10,
    m.fighters.map(() => ({})),
  );
  const [a, v, ...rest] = m.fighters as [FighterState, FighterState, ...FighterState[]];
  place(a, -10, 0, 1);
  place(v, -2, 0, opts.facing ?? -1);
  for (const f of rest) place(f, 6, 0, -1);
  return { m, a, v };
}

const idle = (m: MatchState) => m.fighters.map(() => ({}));
const ofType = <T extends SimEvent['type']>(m: MatchState, type: T) =>
  m.events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

/**
 * P2 starts its down special, and the attackers start `move` so that its first active frame (`lead`) is P2's
 * frame `at`. Returns the duel after that frame, whose events are `m.events`.
 */
function counterAt(at: number, move = 'probe', lead = 1, d = duel()) {
  attack(d.m, 1, 'downB');
  runPorts(d.m, at - lead, idle(d.m));
  for (const f of d.m.fighters) if (f !== d.v) attack(d.m, f.port, move);
  runPorts(d.m, lead, idle(d.m));
  expect(d.v.move === 'downB' ? d.v.actionFrame : at).toBe(at);
  return d;
}

/** Step until P2's counterattack hits (at most 60 frames); returns the hit and the frames it took. */
function untilAnswer(m: MatchState): { hit: Hit; frames: number } {
  for (let frames = 1; frames <= 60; frames++) {
    runPorts(m, 1, idle(m));
    const hit = ofType(m, 'hit').find((e) => e.attacker === 1);
    if (hit) return { hit, frames };
  }
  throw new Error('the counterattack never hit');
}

describe('counters (MoveDef.counter), Marth-style', () => {
  it("blocks a hit in the window and starts the counterattack, freezing both fighters for Marth's 21 frames", () => {
    const { m, a, v } = counterAt(10);
    expect(ofType(m, 'hit')).toEqual([]);
    const [c] = ofType(m, 'counter');
    expect(c).toMatchObject({ port: 1, attacker: 0, move: 'downBHit' });
    expect(c!.damage).toBeCloseTo(12 * FRESH, 9);
    expect(ofType(m, 'move')).toEqual([{ type: 'move', port: 1, move: 'downBHit' }]);
    expect([v.damage, v.launch, v.hitstun]).toEqual([0, null, 0]);
    expect([v.action, v.move, v.actionFrame]).toEqual(['attack', 'downBHit', 0]);
    expect([a.hitlag, v.hitlag]).toEqual([COUNTER.freeze, COUNTER.freeze - 1]);
  });

  it('lands the counterattack on its frame 5, 25 frames after the catch, at 1.2x the caught hit', () => {
    const { m, a, v } = counterAt(10);
    const frozenAt = a.actionFrame;
    for (let i = 1; i <= COUNTER.freeze; i++) {
      runPorts(m, 1, idle(m));
      expect(a.actionFrame).toBe(frozenAt);
      expect(isIntangible(v)).toBe(true);
    }
    // The last frozen frame was its frame 1; frames 2-5 follow.
    expect(v.actionFrame).toBe(1);
    const { hit, frames } = untilAnswer(m);
    expect(frames).toBe(4);
    expect([v.move, v.actionFrame]).toEqual(['downBHit', 5]);
    const answer = 12 * FRESH * COUNTER.multiplier;
    expect(hit.damage).toBeCloseTo(answer * FRESH * ONE_V_ONE, 9);
    const kb = knockback({ percent: 0, damage: answer, kbg: 60, bkb: 90, weight: 98, stale: FRESH });
    expect(hit.kb).toBeCloseTo(kb, 9);
    expect(a.damage).toBeCloseTo(hit.damage, 9);
  });

  it("never deals less than its box's 8% or more than 50%", () => {
    const light = counterAt(10, 'jab', 2);
    expect(ofType(light.m, 'counter')[0]!.damage).toBeCloseTo(2.5 * FRESH, 9);
    expect(untilAnswer(light.m).hit.damage).toBeCloseTo(8 * FRESH * ONE_V_ONE, 9);

    const heavy = counterAt(10, 'heavy', 1, duel({ attacker: 'test-counter-heavy' }));
    expect(ofType(heavy.m, 'counter')[0]!.damage).toBeCloseTo(45 * FRESH, 9);
    expect(untilAnswer(heavy.m).hit.damage).toBeCloseTo(COUNTER.max * FRESH * ONE_V_ONE, 9);
  });

  it('catches on frames 7-27: frame 4 and 28 take the hit, and nothing touches it on its intangible 5-6', () => {
    const outcome = (at: number) => {
      const { m, v } = counterAt(at);
      if (ofType(m, 'counter').length > 0) return 'caught';
      return ofType(m, 'hit').some((e) => e.victim === v.port) ? 'hit' : 'nothing';
    };
    expect([4, 5, 6, 7, 27, 28].map(outcome)).toEqual([
      'hit',
      'nothing',
      'nothing',
      'caught',
      'caught',
      'hit',
    ]);
  });

  it('turns around to answer a hit from behind', () => {
    const { m, a, v } = counterAt(10, 'probe', 1, duel({ facing: 1 }));
    expect(ofType(m, 'counter')).toHaveLength(1);
    expect(v.facing).toBe(-1);
    untilAnswer(m);
    expect(a.launch!.dir).toBe(-1);
  });

  it('lets grabs through', () => {
    const d = duel({ attacker: 'fireboy' });
    attack(d.m, 1, 'downB');
    runPorts(d.m, 4, idle(d.m));
    runPorts(d.m, 1, [{ buttons: ['grab'] }, {}]);
    const seen: string[] = [];
    for (let i = 0; i < 12 && d.v.action !== 'grabbed'; i++) {
      runPorts(d.m, 1, idle(d.m));
      seen.push(...d.m.events.map((e) => e.type));
    }
    expect(d.v.action).toBe('grabbed');
    expect(d.v.actionFrame).toBe(0);
    expect(seen).not.toContain('counter');
  });

  it('lets a grab through on the frame it catches a hit: the grab wins and nothing is answered', () => {
    const { m, a, v } = duel({ attacker: 'fireboy', more: 1 });
    const grabber = m.fighters[2]!;
    attack(m, 1, 'downB');
    runPorts(m, 4, idle(m));
    // Fireboy's grab box is out on its frames 6-7 and his jab's on 2-3: both reach P2 on its frame 10.
    attack(m, 2, 'grab');
    runPorts(m, 4, idle(m));
    attack(m, 0, 'jab');
    runPorts(m, 2, idle(m));
    expect([v.actionFrame, grabber.actionFrame, a.actionFrame]).toEqual([0, 0, 2]);
    expect(ofType(m, 'grab')).toMatchObject([{ attacker: 2, victim: 1 }]);
    expect(ofType(m, 'counter')).toEqual([]);
    expect(ofType(m, 'hit')).toEqual([]);
    expect([v.action, grabber.action]).toEqual(['grabbed', 'grabHold']);
    expect([v.hitlag, a.hitlag, v.intangible, v.damage]).toEqual([0, 0, 0, 0]);
  });

  it("hits an entity as hard as a fighter: a 50% counterattack breaks Snail Bob's 12 HP crate", () => {
    const d = duel({ attacker: 'test-counter-heavy' });
    // Behind P1, in reach of P2's counterattack (centre x -11) and out of reach of P1's own swing.
    const crate = spawnEntity(d.m, {
      kind: 'snailbob/crate',
      owner: 0,
      pos: { x: -22, y: 5 },
      vel: { x: 0, y: 0 },
    });
    counterAt(10, 'heavy', 1, d);
    expect(d.v.counterDamage).toBe(COUNTER.max);
    const hits: Extract<SimEvent, { type: 'entityHit' }>[] = [];
    for (let i = 0; i < 40 && !crate.dead; i++) {
      runPorts(d.m, 1, idle(d.m));
      hits.push(...ofType(d.m, 'entityHit'));
    }
    expect(hits).toMatchObject([{ id: crate.id, attacker: 1, damage: COUNTER.max }]);
    expect(crate.dead).toBe(true);
  });

  it('catches a projectile in place, using it up, and freezes nobody else', () => {
    const { m, a, v } = duel({ facing: 1 });
    place(a, -60, 0, 1);
    attack(m, 1, 'downB');
    runPorts(m, 9, idle(m));
    const ball = spawnEntity(m, {
      kind: 'fireboy/fireball',
      owner: 0,
      pos: { x: -8, y: 8 },
      vel: { x: 1.4, y: 0 },
    });
    let c: Counter | undefined;
    for (let i = 0; i < 5 && !c; i++) {
      runPorts(m, 1, idle(m));
      c = ofType(m, 'counter')[0];
    }
    expect(c).toMatchObject({ port: 1, attacker: 0, entity: ball.id, move: 'downBHit' });
    expect(c!.damage).toBeCloseTo(5.5, 9);
    expect(ofType(m, 'entityDestroy')).toMatchObject([{ id: ball.id, reason: 'hit' }]);
    expect([v.pos.x, v.facing, v.damage, a.hitlag]).toEqual([-2, -1, 0, 0]);
  });

  it('blocks every hit that lands on it that frame; the first sets it off', () => {
    const { m, a, v } = counterAt(10, 'jab', 2, duel({ more: 1 }));
    const third = m.fighters[2]!;
    expect(ofType(m, 'counter')).toMatchObject([{ port: 1, attacker: 0 }]);
    expect(ofType(m, 'hit')).toEqual([]);
    expect([v.damage, a.hitlag, third.hitlag]).toEqual([0, COUNTER.freeze, 0]);
  });
});

describe('counters that reappear behind (CounterDef.behind)', () => {
  it("reappears behind the attacker facing their back and kicks for Double Team's fixed 12.5%", () => {
    const { m, a, v } = counterAt(10, 'probe', 1, duel({ counterer: 'test-counter-behind' }));
    expect(ofType(m, 'counter')).toHaveLength(1);
    expect([v.pos.x, v.prevPos.x, v.facing, v.action]).toEqual([-22, -22, 1, 'attack']);
    expect(v.ground).toEqual(a.ground);
    const { hit } = untilAnswer(m);
    expect(hit.damage).toBeCloseTo(12.5 * FRESH * ONE_V_ONE, 9);
    expect(a.launch!.dir).toBe(1);
  });

  it("stays on the attacker's floor when behind them is past its end", () => {
    const d = duel({ counterer: 'test-counter-behind' });
    const [lo] = surfaceRange(posedStage(d.m), d.a.ground!);
    place(d.a, lo + 3, 0, 1);
    place(d.v, lo + 11, 0, -1);
    const { v } = counterAt(10, 'probe', 1, d);
    expect([v.pos.x, v.pos.y, v.action]).toEqual([lo, 0, 'attack']);
    expect(v.ground).toEqual(d.a.ground);
  });

  it('follows an airborne attacker into the air', () => {
    const { m, a, v } = duel({ counterer: 'test-counter-behind' });
    attack(m, 1, 'downB');
    runPorts(m, 9, idle(m));
    Object.assign(a, { ground: null, action: 'fall', actionFrame: 1, jumpsUsed: 1 });
    place(a, -10, 6, 1);
    attack(m, 0, 'probe');
    runPorts(m, 1, idle(m));
    expect(ofType(m, 'counter')).toHaveLength(1);
    expect([v.pos.x, v.pos.y, v.ground, v.action]).toEqual([-22, a.pos.y, null, 'aerial']);
    expect(v.jumpsUsed).toBeGreaterThanOrEqual(1);
  });

  it('plays out the same every time', () => {
    const run = () => {
      const { m } = counterAt(10, 'probe', 1, duel({ counterer: 'test-counter-behind' }));
      runPorts(m, 60, idle(m));
      return hashState(m);
    };
    expect(run()).toBe(run());
  });
});
