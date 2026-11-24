import { describe, expect, it } from 'vitest';
import type { FighterState } from '../../sim/fighter';
import { attack, placeInAir, run, runPorts, testMatch, until } from '../../sim/testing/sim';
import { moves } from './moves';
import { QUAKE_FRAME, QUAKE_REACH, ROLL_TIPS } from './specials';
import { TIP_DISTANCE, TIP_SHAKE } from './tip';

/** The block (P1) facing right at x = -40 and a second fighter `offset` units to its right, both standing. */
function versus(offset: number, opts: { fighter?: string; air?: number } = {}) {
  const m = testMatch({ fighter: 'bloxorz', players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  if (opts.fighter) v.fighter = opts.fighter;
  Object.assign(a, { pos: { x: -40, y: 0 }, prevPos: { x: -40, y: 0 }, facing: 1, action: 'idle' });
  const y = opts.air ?? 0;
  Object.assign(v, {
    pos: { x: -40 + offset, y },
    prevPos: { x: -40 + offset, y },
    action: opts.air ? 'fall' : 'idle',
    ground: opts.air ? null : v.ground,
    vel: { x: 0, y: 0 },
    intangible: 0,
  });
  return { m, a, v };
}

describe('Bloxorz block: Edge Rock jab chain', () => {
  it('Attack again during the jab rocks again (jab2), and both rocks land', () => {
    const { m, a, v } = versus(14);
    runPorts(m, 1, [{ buttons: ['attack'] }, {}]);
    expect(a.move).toBe('jab');
    let hits = 0;
    let last = 0;
    for (let i = 0; i < 40; i++) {
      runPorts(m, 1, [i === 8 ? { buttons: ['attack'] } : {}, {}]);
      if (v.damage > last) hits++;
      last = v.damage;
    }
    expect(hits).toBe(2);
    expect(v.damage).toBeCloseTo((3 + 4) * 1.05 * 1.2, 1);
  });
});

describe('Bloxorz block: Roll (side special)', () => {
  it('keeps tipping forward four times, 18 units a tip, from the side special input', () => {
    const m = testMatch({ fighter: 'bloxorz' });
    const f = m.fighters[0]!;
    f.facing = 1;
    const x0 = f.pos.x;
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f.move).toBe('sideB');
    run(m, moves.sideB!.faf);
    expect(f.action).toBe('idle');
    expect(Math.abs(f.pos.x - x0 - ROLL_TIPS * TIP_DISTANCE)).toBeLessThan(3);
  });

  it('first hits on frame 12 and lands 3% x3 + 5% on an opponent it rolls into', () => {
    expect(Math.min(...moves.sideB!.hits.map((w) => w.frames[0]))).toBe(12);
    const { m, a, v } = versus(12);
    attack(m, 0, 'sideB');
    const damage: number[] = [];
    let last = 0;
    for (let i = 0; i < 120 && a.action !== 'idle'; i++) {
      runPorts(m, 1, [{}, {}]);
      if (v.damage > last) damage.push(+((v.damage - last) / 1.2).toFixed(2));
      last = v.damage;
    }
    expect(a.action).toBe('idle');
    expect(damage.length).toBe(4);
    expect(damage.at(-1)).toBeGreaterThan(damage[0]!);
  });

  it('in the air it rolls across nearly level, then falls helpless', () => {
    const m = testMatch({ fighter: 'bloxorz' });
    const f = placeInAir(m, -60, 120, 1);
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f.move).toBe('sideB');
    run(m, 42);
    expect(f.pos.y).toBeGreaterThan(105);
    expect(f.pos.x - -60).toBeGreaterThan(60);
    until(m, (g) => g.move !== 'sideB');
    expect(f.action).toBe('helpless');
  });
});

describe('Bloxorz block: Heavy Switch (down special)', () => {
  const quakes = (offset: number, air?: number) => {
    const { m, v } = versus(offset, { fighter: 'reference-mario', air });
    m.config.ports[1]!.fighter = 'reference-mario';
    runPorts(m, 1, [{ y: -100, buttons: ['special'] }, {}]);
    expect(m.fighters[0]!.move).toBe('downB');
    for (let i = 0; i < QUAKE_FRAME + 4; i++) runPorts(m, 1, [{}, {}]);
    return v.damage > 0;
  };

  it(`quakes the ground out to ${QUAKE_REACH} units on both sides on frame ${QUAKE_FRAME}`, () => {
    expect(quakes(50)).toBe(true);
    expect(quakes(-50)).toBe(true);
    expect(quakes(75)).toBe(false);
  });

  it('misses an opponent in the air above the quake', () => {
    expect(quakes(30, 30)).toBe(false);
  });

  it('a lying block stands up for it', () => {
    const m = testMatch({ fighter: 'bloxorz' });
    const f = m.fighters[0]!;
    run(m, 2, { y: -100 });
    run(m, 10);
    expect(f.fighter).toBe('bloxorz-lying');
    attack(m, 0, 'downB');
    run(m, 10);
    expect(f.fighter).toBe('bloxorz');
  });

  it('in the air it drops like a pillar and quakes where it lands, with a big screen shake', () => {
    const m = testMatch({ fighter: 'bloxorz' });
    const f = placeInAir(m, 0, 40, 1);
    f.pos.x = -40;
    f.prevPos.x = -40;
    run(m, 1, { y: -100, buttons: ['special'] });
    expect(f.move).toBe('downB');
    let shake = 0;
    let frames = 0;
    for (; frames < 60 && !shake; frames++) {
      run(m, 1);
      shake = m.events.reduce((s, e) => (e.type === 'shake' ? Math.max(s, e.amplitude) : s), 0);
    }
    expect(f.ground).not.toBeNull();
    expect(shake).toBeGreaterThan(TIP_SHAKE.amplitude);
    expect(frames).toBeLessThan(30);
  });
});
