import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import type { FighterState } from '../fighter';
import { createMatch, type MatchState } from '../match';
import { counterTester, reflectStep, shadowStep } from '../testing/counter';
import { runPorts } from '../testing/sim';
import type { SimEvent } from '../events';

const heaver = counterTester('test-counter-heaver', 25);
const reflector = counterTester('test-counter-reflector', 10, reflectStep);
registerFighter(heaver);
registerFighter(reflector);

function place(f: FighterState, x: number, y: number, facing: 1 | -1): void {
  Object.assign(f, { pos: { x, y }, prevPos: { x, y }, vel: { x: 0, y: 0 }, ground: null });
  Object.assign(f, { action: 'fall', actionFrame: 1, jumpsUsed: 1, facing, intangible: 0 });
}

/** P1 (the attacker) at -10 facing right and P2 (the counter tester) 6 in front of him facing back. */
function duel(
  attacker = 'fireboy',
  defender = 'test-counter',
): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: attacker }, { fighter: defender }],
  });
  const [a, v] = m.fighters as [FighterState, FighterState];
  place(a, -10, 1, 1);
  place(v, -4, 1, -1);
  runPorts(m, 20, [{}, {}]);
  expect([a.action, v.action]).toEqual(['idle', 'idle']);
  return { m, a, v };
}

/**
 * P2 counters from its first frame, and P1 jabs so that the jab's hitbox meets P2 on the defender's counter frame
 * `at` (the jab is out on its own frames 3-4). Returns the frame of P2's move on which the contact happened, and
 * that frame's events.
 */
function jabAt(at: number, attacker = 'fireboy', defender = 'test-counter') {
  const d = duel(attacker, defender);
  const { m, v } = d;
  runPorts(m, 1, [{}, { y: -100, buttons: ['special'] }]);
  expect([v.action, v.move]).toEqual(['attack', 'downB']);
  while (v.actionFrame < at - 2) runPorts(m, 1, [{}, {}]);
  runPorts(m, 1, [{ buttons: ['attack'] }, {}]);
  for (let i = 0; i < 12; i++) {
    const frame = v.actionFrame;
    const x = v.pos.x;
    runPorts(m, 1, [{}, {}]);
    const events = [...m.events];
    if (events.some((e) => e.type === 'counter' || (e.type === 'hit' && e.victim === 1)))
      return { ...d, frame, x, events };
  }
  throw new Error('no contact within 12 frames');
}

describe('counters (MoveDef.counter)', () => {
  it('cancels a hit inside the window and answers it from 20 units behind, facing their back', () => {
    const { a, v, frame, events } = jabAt(14);
    expect(frame).toBeGreaterThanOrEqual(shadowStep.counter!.window[0]);
    expect(frame).toBeLessThanOrEqual(shadowStep.counter!.window[1]);
    expect(events.filter((e) => e.type === 'hit' && e.victim === 1)).toEqual([]);
    const counter = events.find((e) => e.type === 'counter') as Extract<SimEvent, { type: 'counter' }>;
    expect([counter.attacker, counter.victim, counter.move, counter.damage]).toEqual([1, 0, 'downB', 8]);
    expect(v.damage).toBe(0);
    expect([v.action, v.facing]).toEqual(['attack', 1]);
    expect(v.pos.x).toBeCloseTo(Math.min(-10, a.pos.x) - 20, 6);
    expect(a.pos.x).toBeLessThan(-10);
    expect([a.action === 'tumble' || a.action === 'hitstun', a.damage]).toEqual([true, 8 * 1.2]);
  });

  it('answers in place when the counter has no behind distance, at its own multiplier', () => {
    const { a, v, x, events } = jabAt(14, 'fireboy', 'test-counter-reflector');
    const counter = events.find((e) => e.type === 'counter') as Extract<SimEvent, { type: 'counter' }>;
    expect(counter.damage).toBe(6);
    expect(counter.x).toBeCloseTo(x, 4);
    expect(v.pos.x).toBeCloseTo(x, 4);
    expect(a.damage).toBeCloseTo(6 * 1.2, 6);
  });

  it('clamps the answer to max against a heavy hit', () => {
    const { a, events } = jabAt(14, 'test-counter-heaver', 'test-counter');
    const counter = events.find((e) => e.type === 'counter') as Extract<SimEvent, { type: 'counter' }>;
    expect(counter.damage).toBe(shadowStep.counter!.max);
    expect(a.damage).toBeCloseTo(20 * 1.2, 6);
  });

  it('takes a hit before the window opens', () => {
    const { v, frame, events } = jabAt(3);
    expect(frame).toBeLessThan(shadowStep.counter!.window[0]);
    expect(events.filter((e) => e.type === 'counter')).toEqual([]);
    expect(v.damage).toBeCloseTo(3 * 1.05 * 1.2, 6);
    expect(v.action === 'hitstun' || v.action === 'tumble').toBe(true);
  });

  it('takes a hit after the window closes', () => {
    const { v, frame, events } = jabAt(30);
    expect(frame).toBeGreaterThan(shadowStep.counter!.window[1]);
    expect(events.filter((e) => e.type === 'counter')).toEqual([]);
    expect(v.damage).toBeCloseTo(3 * 1.05 * 1.2, 6);
  });

  it('catches one hit a frame: a second attacker hitting the same frame still lands', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }, { fighter: 'test-counter' }],
    });
    const [p1, p2, v] = m.fighters as [FighterState, FighterState, FighterState];
    place(p1, -10, 1, 1);
    place(p2, 2, 1, -1);
    place(v, -4, 1, -1);
    runPorts(m, 20, [{}, {}, {}]);
    runPorts(m, 1, [{}, {}, { y: -100, buttons: ['special'] }]);
    expect(v.move).toBe('downB');
    while (v.actionFrame < 12) runPorts(m, 1, [{}, {}, {}]);
    let caught: SimEvent[] = [];
    for (let i = 0; i < 6 && caught.length === 0; i++) {
      runPorts(m, 1, [{ buttons: ['attack'] }, { buttons: ['attack'] }, {}]);
      caught = m.events.filter((e) => e.type === 'counter');
    }
    expect(caught.length).toBe(1);
    expect(v.damage).toBeCloseTo(3 * 1.05, 6);
    expect([p1.damage, p2.damage].filter((d) => d > 0).length).toBe(1);
  });
});
