import { describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from '../../sim/match';
import type { FighterState } from '../../sim/fighter';
import type { EntityState } from '../../sim/entities/types';
import { runPorts, type Hold } from '../../sim/testing/sim';
import { stats } from './stats';

/** P1 Raft Wars kids (facing right) against Mario far away, both settled; \`air\` puts P1 at that height. */
function setup(air?: number, x = -30): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'raftwars' }, { fighter: 'reference-mario' }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  const at = { x, y: air ?? 0 };
  Object.assign(a, { pos: { ...at }, prevPos: { ...at }, vel: { x: 0, y: 0 }, facing: 1, intangible: 0 });
  if (air !== undefined) Object.assign(a, { ground: null, action: 'fall', jumpsUsed: 1 });
  else a.action = 'idle';
  const away = { x: x < 0 ? 75 : -75, y: 0 };
  Object.assign(v, { pos: { ...away }, prevPos: { ...away }, facing: -1, action: 'idle', intangible: 0 });
  return { m, a, v };
}

const balls = (m: MatchState, kind?: string): EntityState[] =>
  m.entities.filter((e) => e.owner === 0 && (!kind || e.kind === 'raftwars/' + kind));

/** Start a move with one frame of \`hold\` (and \`before\` held for a while first). */
function start(m: MatchState, hold: Hold, before?: { hold: Hold; frames: number }): void {
  if (before) runPorts(m, before.frames, [before.hold, {}]);
  runPorts(m, 1, [hold, {}]);
}

const SHOTS: [string, string, Hold, number, { hold: Hold; frames: number } | undefined, boolean][] = [
  ['jab', 'jabBall', { buttons: ['attack'] }, 5, undefined, false],
  ['ftilt', 'shot', { x: 50, buttons: ['attack'] }, 9, { hold: { x: 50 }, frames: 8 }, false],
  ['utilt', 'lob', { y: 50, buttons: ['attack'] }, 8, { hold: { y: 50 }, frames: 8 }, false],
  ['dtilt', 'skip', { y: -60, buttons: ['attack'] }, 9, { hold: { y: -60 }, frames: 8 }, false],
  ['nair', 'ringBall', { buttons: ['attack'] }, 8, undefined, true],
  ['fair', 'airShot', { x: 100, buttons: ['attack'] }, 9, undefined, true],
  ['bair', 'recoilShot', { x: -100, buttons: ['attack'] }, 10, undefined, true],
  ['uair', 'upShot', { y: 100, buttons: ['attack'] }, 8, undefined, true],
  ['dair', 'downShot', { y: -100, buttons: ['attack'] }, 10, undefined, true],
];

describe('Raft Wars kids: the launcher (jab, tilts, aerials)', () => {
  it.each(SHOTS)('%s fires %s on its first active frame', (move, kind, hold, frame, before, air) => {
    const { m, a } = setup(air ? 60 : undefined);
    start(m, hold, before);
    expect(a.move).toBe(move);
    let fired = 0;
    while (a.move === move && !fired) {
      if (balls(m, kind).length > 0) fired = a.actionFrame;
      else runPorts(m, 1, [{}, {}]);
    }
    expect(fired).toBe(frame);
    expect(balls(m, kind).length).toBe(move === 'nair' ? 4 : 1);
  });

  /** How far a shot's ball gets from where it appeared before it is gone. */
  function range(hold: Hold, kind: string, before?: { hold: Hold; frames: number }): number {
    const { m } = setup(undefined, -75);
    start(m, hold, before);
    let from: number | null = null;
    let to = 0;
    for (let i = 0; i < 120; i++) {
      const b = balls(m, kind)[0];
      if (b) {
        from ??= b.pos.x;
        to = b.pos.x;
      } else if (from !== null) break;
      runPorts(m, 1, [{}, {}]);
    }
    return to - (from ?? 0);
  }

  it('the jab balls reach 40 units, the straight shot 100 and the skip shot about 100 along the ground', () => {
    expect(range({ buttons: ['attack'] }, 'jabBall')).toBeCloseTo(36, 0);
    expect(range({ x: 50, buttons: ['attack'] }, 'shot', { hold: { x: 50 }, frames: 8 })).toBeCloseTo(96, 0);
    expect(range({ y: -60, buttons: ['attack'] }, 'skip', { hold: { y: -60 }, frames: 8 })).toBeGreaterThan(
      90,
    );
  });

  it('holding Attack keeps the jab firing every 8 frames; letting go ends it', () => {
    const { m, a } = setup();
    start(m, { buttons: ['attack'] });
    const ids = new Set<number>();
    for (let i = 0; i < 60; i++) {
      runPorts(m, 1, [{ buttons: ['attack'] }, {}]);
      for (const b of balls(m, 'jabBall')) ids.add(b.id);
    }
    expect(a.move).toBe('jab');
    expect(ids.size).toBeGreaterThanOrEqual(7);
    runPorts(m, 18, [{}, {}]);
    expect(a.move).toBeNull();
  });

  it('the lob goes up about 44 units and comes back down', () => {
    const { m } = setup(undefined, 70);
    start(m, { y: 50, buttons: ['attack'] }, { hold: { y: 50 }, frames: 8 });
    let top = 0;
    let y0: number | null = null;
    let last = 0;
    for (let i = 0; i < 100; i++) {
      runPorts(m, 1, [{}, {}]);
      const b = balls(m, 'lob')[0];
      if (!b) continue;
      y0 ??= b.pos.y;
      top = Math.max(top, b.pos.y - y0);
      last = b.pos.y - y0;
    }
    expect(top).toBeGreaterThan(40);
    expect(top).toBeLessThan(48);
    expect(last).toBeLessThan(0);
  });

  it('a straight shot hits for 6% from 70 units away', () => {
    const { m, v } = setup();
    Object.assign(v, { pos: { x: 40, y: 0 }, prevPos: { x: 40, y: 0 } });
    start(m, { x: 50, buttons: ['attack'] }, { hold: { x: 50 }, frames: 8 });
    for (let i = 0; i < 60 && v.damage === 0; i++) runPorts(m, 1, [{}, {}]);
    expect(v.damage).toBeCloseTo(6 * 1.05 * 1.2, 6);
  });

  it('back air shoves them forward past their air speed, forward air nudges them back', () => {
    for (const x of [-100, 100]) {
      const { m, a } = setup(60);
      start(m, { x, buttons: ['attack'] });
      runPorts(m, x < 0 ? 10 : 9, [{}, {}]);
      expect(Math.sign(a.vel.x)).toBe(-Math.sign(x));
      if (x < 0) expect(a.vel.x).toBeGreaterThan(stats.airSpeed);
    }
  });

  it('down air lifts them when it fires', () => {
    const { m, a } = setup(60);
    runPorts(m, 20, [{}, {}]);
    expect(a.vel.y).toBeLessThan(0);
    start(m, { cy: -100 });
    expect(a.move).toBe('dair');
    runPorts(m, 9, [{}, {}]);
    expect(a.vel.y).toBeGreaterThan(1);
  });

  it('the back air ball launches its target backward', () => {
    const { m, a, v } = setup(30);
    Object.assign(v, {
      pos: { x: -46, y: 33 },
      prevPos: { x: -46, y: 33 },
      ground: null,
      action: 'fall',
      damage: 60,
    });
    start(m, { x: -100, buttons: ['attack'] });
    expect(a.move).toBe('bair');
    for (let i = 0; i < 60 && v.kb.x === 0; i++) runPorts(m, 1, [{}, {}]);
    expect(v.kb.x).toBeLessThan(0);
  });
});
