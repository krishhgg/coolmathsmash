import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../sim/events';
import { statusOf } from '../../sim/statuses';
import { runPorts, type Hold } from '../../sim/testing/sim';
import { SQUARED } from './statuses';
import { versusMario } from './versus';

const KIND = 'redball/squared';

/** Red Ball down-throws Mario from 0% (1v1); returns the match and the % the throw added. */
function downThrow() {
  const { m, a, v } = versusMario();
  Object.assign(v, { pos: { x: a.pos.x + 10 * a.facing, y: a.pos.y }, action: 'idle', ground: a.ground });
  v.prevPos = { ...v.pos };
  Object.assign(v, { intangible: 0, facing: -a.facing });
  runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
  for (let i = 0; i < 20 && v.action !== 'grabbed'; i++) runPorts(m, 1, [{}, {}]);
  expect(v.action).toBe('grabbed');
  runPorts(m, 1, [{ y: -100 }, {}]);
  expect(a.move).toBe('dthrow');
  const events: SimEvent[] = [];
  for (let i = 0; i < 30 && !events.some((e) => e.type === 'statusStart'); i++) {
    runPorts(m, 1, [{}, {}]);
    events.push(...m.events);
  }
  return { m, a, v, events, added: v.damage };
}

describe('Red Ball: Squared (Sit-Squash leaves them squared)', () => {
  it("uses Ultimate's flower numbers (SmashWiki, Flower (effect))", () => {
    expect(SQUARED).toMatchObject({
      frames: 20,
      perDamage: 40,
      max: 3000,
      stack: 'add',
      tick: { every: 21, damage: 1 },
      mash: { stick: 16, button: 28.8 },
    });
  });

  it('down throw squares Mario for floor(20 + 40 x the % it added): 372 frames from a fresh 7% in 1v1', () => {
    const { v, events, added } = downThrow();
    expect(added).toBeCloseTo(7 * 1.05 * 1.2, 9); // fresh bonus, 1v1 multiplier
    const hit = events.findIndex((e) => e.type === 'hit');
    const start = events.findIndex((e) => e.type === 'statusStart');
    expect(hit).toBeGreaterThanOrEqual(0);
    expect(start).toBeGreaterThan(hit);
    expect(events[start]).toEqual({ type: 'statusStart', port: 1, status: KIND, frames: 372, source: 0 });
    expect(statusOf(v, KIND)!.frames).toBe(372);
  });

  it('no other throw squares', () => {
    const { m, a, v } = versusMario();
    Object.assign(v, { pos: { x: a.pos.x + 10 * a.facing, y: a.pos.y }, action: 'idle', ground: a.ground });
    v.prevPos = { ...v.pos };
    Object.assign(v, { intangible: 0, facing: -a.facing });
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    for (let i = 0; i < 20 && v.action !== 'grabbed'; i++) runPorts(m, 1, [{}, {}]);
    runPorts(m, 1, [{ x: 100 * a.facing }, {}]);
    expect(a.move).toBe('fthrow');
    runPorts(m, 40, [{}, {}]);
    expect(v.statuses).toEqual([]);
  });

  it('deals 1% (1.2% in 1v1) on every 21st frame of it: 17 ticks over 372 frames, then ends', () => {
    const { m, v, added } = downThrow();
    const ends: SimEvent[] = [];
    let frames = 0;
    while (statusOf(v, KIND) && frames < 2000) {
      runPorts(m, 1, [{}, {}]);
      ends.push(...m.events.filter((e) => e.type === 'statusEnd'));
      frames++;
    }
    expect(ends).toEqual([{ type: 'statusEnd', port: 1, status: KIND, reason: 'expired' }]);
    expect(Math.floor(372 / 21)).toBe(17);
    expect(v.damage - added).toBeCloseTo(17 * 1.2, 9);
  });

  it('mashing shakes it off faster: 16 frames a new stick direction, 28.8 a button press', () => {
    const { m, v } = downThrow();
    const mash = (i: number): Hold => (i % 2 ? { x: 100 } : { x: -100, buttons: ['jump'] });
    let calm = 0;
    {
      const { m: m2, v: v2 } = downThrow();
      while (statusOf(v2, KIND)) {
        runPorts(m2, 1, [{}, {}]);
        calm++;
      }
    }
    let mashed = 0;
    while (statusOf(v, KIND)) {
      runPorts(m, 1, [{}, mash(mashed)]);
      mashed++;
    }
    expect(calm).toBe(372);
    // every 2 frames: 2 by itself, 2 x 16 for the two new directions, 28.8 for the press
    expect(mashed).toBe(Math.ceil(372 / (62.8 / 2)));
  });
});
