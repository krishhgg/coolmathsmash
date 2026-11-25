import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { TETHER } from '../constants';
import type { SimEvent } from '../events';
import type { FighterState } from '../fighter';
import type { MatchState } from '../match';
import { lineTether, pointGrapple, quickGrapple, tetherTester } from '../testing/tethers';
import { attack, runPorts, testMatch, type Hold } from '../testing/sim';
import { tetherOrigin } from './tether';

const HAND = tetherTester.stats.height * TETHER.handHeight;

/** Tether testers on Battlefield, standing at `xs` (P1 facing right, the others left), plus the events seen. */
function setup(...xs: number[]) {
  const m = testMatch({ fighter: tetherTester.id, players: xs.length });
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
  runPorts(m, 20, []);
  const events: SimEvent[] = [];
  const step = (frames: number, holds: Hold[] | ((i: number) => Hold[]) = []) => {
    for (let i = 0; i < frames; i++) {
      runPorts(m, 1, typeof holds === 'function' ? holds(i) : holds);
      events.push(...m.events.filter((e) => e.type.startsWith('tether')));
    }
  };
  return { m, a: m.fighters[0]!, b: m.fighters[1], events, step };
}

function putInAir(f: FighterState, x: number, y: number, facing: 1 | -1): void {
  Object.assign(f, { pos: { x, y }, prevPos: { x, y }, vel: { x: 0, y: 0 }, ground: null, facing });
  Object.assign(f, { action: 'fall', actionFrame: 1, jumpsUsed: 1, intangible: 0 });
}

/** The first event of `type`. */
function first<T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }> {
  return events.find((e): e is Extract<SimEvent, { type: T }> => e.type === type)!;
}

function expectAt(p: { x: number; y: number }, x: number, y: number): void {
  expect(p.x).toBeCloseTo(x, 9);
  expect(p.y).toBeCloseTo(y, 9);
}

/** Step until `pred` holds (at most `limit` frames). */
function until(
  step: (n: number, h?: Hold[]) => void,
  pred: () => boolean,
  hold: Hold[] = [],
  limit = 200,
): void {
  for (let i = 0; i < limit && !pred(); i++) step(1, hold);
  expect(pred()).toBe(true);
}

/** The tether tester on the testbed stage, at (`x`, 1) on the floor. */
function onTestbed(x: number) {
  const m = testMatch({ fighter: tetherTester.id, stage: 'testbed' });
  const a = m.fighters[0]!;
  Object.assign(a, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
  Object.assign(a, { action: 'fall', actionFrame: 1, jumpsUsed: 1, facing: 1, intangible: 0 });
  runPorts(m, 20, []);
  const events: SimEvent[] = [];
  const step = (frames: number, holds: Hold[] = []) => {
    for (let i = 0; i < frames; i++) {
      runPorts(m, 1, holds);
      events.push(...m.events.filter((e) => e.type.startsWith('tether')));
    }
  };
  return { m, a, events, step };
}

describe('tethers', () => {
  it('Quick Grapple fires straight up on frame 8, anchors under a platform and reels in at 4 units a frame', () => {
    const { m, a, events, step } = setup(0);
    attack(m, 0, 'upB');
    step(quickGrapple.tether!.frame - 1);
    expect(a.tether).toBeNull();
    step(1);
    const o = tetherOrigin(a);
    expect(events.map((e) => e.type)).toEqual(['tetherFire']);
    expectAt(first(events, 'tetherFire'), o.x, o.y + 120);
    expect(a.tether).toMatchObject({ kind: 'out', frame: m.frame - 1 });
    expectAt(a.tether!.anchor, o.x, o.y + 120 / quickGrapple.tether!.travel);
    until(step, () => a.action === 'tetherPull');
    expect(a.tether?.kind).toBe('surface');
    expectAt(a.tether!.anchor, 0, 47.19);
    expect(first(events, 'tetherLatch')).toMatchObject({ port: 0, kind: 'surface' });
    expectAt(first(events, 'tetherLatch'), 0, 47.19);
    const y = a.pos.y;
    step(1);
    expect(a.pos.y - y).toBeCloseTo(4, 9);
    expect(a.ground).toBeNull();
  });

  it('holding the hang button on arrival hangs at the anchor; letting go of it drops into a fall', () => {
    const { m, a, events, step } = setup(0);
    attack(m, 0, 'upB');
    step(quickGrapple.tether!.frame + 1);
    const jump: Hold[] = [{ buttons: ['jump'] }];
    until(step, () => a.action === 'tetherHang', jump);
    expect(a.pos.y).toBeCloseTo(47.19 - HAND, 9);
    step(30, jump);
    expect([a.action, a.pos.y]).toEqual(['tetherHang', expect.closeTo(47.19 - HAND, 9)]);
    step(1);
    expect([a.action, a.tether]).toEqual(['fall', null]);
    expect(events.at(-1)).toEqual({ type: 'tetherRelease', port: 0 });
  });

  it('arriving without the hang button drops straight into a fall', () => {
    const { m, a, step } = setup(0);
    attack(m, 0, 'upB');
    until(step, () => a.action === 'tetherPull');
    until(step, () => a.action !== 'tetherPull');
    expect([a.action, a.tether]).toEqual(['fall', null]);
    expect(a.vel.x).toBeCloseTo(0, 9);
    expect(a.vel.y).toBeCloseTo(-tetherTester.stats.gravity, 9);
  });

  it('an anchor on a moving platform rides it', () => {
    const { m, a, step } = onTestbed(0);
    attack(m, 0, 'upB');
    const jump: Hold[] = [{ buttons: ['jump'] }];
    until(step, () => a.action === 'tetherHang', jump);
    expect(a.tether!.surface).toEqual({ kind: 'platform', index: 0 });
    const before = { x: a.pos.x, offset: m.stage.platforms[0]!.x };
    step(60, jump);
    const moved = m.stage.platforms[0]!.x - before.offset;
    expect(moved).toBeGreaterThan(1);
    expect(Math.abs(a.pos.x - before.x - moved)).toBeLessThan(0.5);
    expect(a.pos.y).toBeCloseTo(a.tether!.anchor.y - HAND, 6);
  });

  it('a platform that goes away drops the line', () => {
    const { m, a, events, step } = onTestbed(0);
    while (m.frame < 160) step(1);
    attack(m, 0, 'upB');
    const jump: Hold[] = [{ buttons: ['jump'] }];
    until(step, () => a.action === 'tetherHang', jump);
    expect(a.tether!.surface).toEqual({ kind: 'platform', index: 1 });
    while (m.frame < 202) step(1, jump);
    expect(a.tether).toBeNull();
    expect(events.at(-1)).toEqual({ type: 'tetherRelease', port: 0 });
  });

  it('the stick bends Quick Grapple by up to 30 degrees towards where it points', () => {
    for (const [x, deg] of [
      [100, 60],
      [-100, 120],
    ] as const) {
      const { m, a, step } = setup(-70);
      attack(m, 0, 'upB');
      step(quickGrapple.tether!.frame, [{ x }]);
      const r = (deg * Math.PI) / 180;
      expect(a.aim!.x).toBeCloseTo(Math.cos(r) * 120, 9);
      expect(a.aim!.y).toBeCloseTo(Math.sin(r) * 120, 9);
    }
  });

  it('with nothing in reach it anchors in the sky at full range, unless onAnchor refuses', () => {
    const { m, a, events, step } = setup(-70);
    attack(m, 0, 'upB');
    until(step, () => a.action === 'tetherPull');
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherLatch']);
    expect(first(events, 'tetherLatch').kind).toBe('sky');
    expectAt(first(events, 'tetherLatch'), -70, HAND + 120);

    const refusing = {
      ...tetherTester,
      id: 'test-tether-no-sky',
      moves: {
        ...tetherTester.moves,
        upB: { ...quickGrapple, tether: { ...quickGrapple.tether!, onAnchor: () => false } },
      },
    };
    registerFighter(refusing);
    const r = setup(-70);
    r.a.fighter = refusing.id;
    attack(r.m, 0, 'upB');
    r.step(quickGrapple.faf + 2);
    expect(r.events.map((e) => e.type)).toEqual(['tetherFire', 'tetherRelease']);
    expect([r.a.action, r.a.tether]).toEqual(['idle', null]);
  });

  it('a jump press while reeling lets go keeping the reel velocity', () => {
    const { m, a, step } = setup(-70);
    attack(m, 0, 'upB');
    until(step, () => a.action === 'tetherPull');
    step(3);
    step(1, [{ buttons: ['jump'] }]);
    expect([a.action, a.tether]).toEqual(['fall', null]);
    expect(a.vel.x).toBeCloseTo(0, 9);
    expect(a.vel.y).toBeCloseTo(4 - tetherTester.stats.gravity, 9);
  });

  it('Point Grapple walks the reticle with the stick while special is held, then fires at it', () => {
    const { a, events, step } = setup(-40);
    step(1, [{ buttons: ['special'] }]);
    expect(a.move).toBe('neutralB');
    step(10, [{ x: 100, buttons: ['special'] }]);
    expect(a.aim).toEqual({ x: 60, y: 0 });
    expect(a.actionFrame).toBe(pointGrapple.tether!.frame - 1);
    expect(events).toEqual([]);
    step(40, [{ x: 100, buttons: ['special'] }]);
    expect(a.aim).toEqual({ x: 160, y: 0 });
    step(1);
    const o = tetherOrigin(a);
    expect(events[0]).toEqual({ type: 'tetherFire', port: 0, x: o.x + 160, y: o.y });
  });

  it('released with the reticle still on the fighter, it fires nothing and the move plays out', () => {
    const { a, events, step } = setup(-40);
    step(1, [{ buttons: ['special'] }]);
    step(pointGrapple.faf + 1);
    expect(events).toEqual([]);
    expect([a.action, a.aim, a.tether]).toEqual(['idle', null, null]);
  });

  it('a reel blocked by the stage gives up after range / pullSpeed + slack frames', () => {
    const { m, a, events, step } = setup(-40);
    putInAir(a, 0, -60, 1);
    attack(m, 0, 'upB');
    until(step, () => a.action === 'tetherPull');
    expect(first(events, 'tetherLatch').kind).toBe('surface');
    let pulled = 0;
    for (let i = 0; i < 80 && a.action === 'tetherPull'; i++) {
      step(1);
      pulled++;
    }
    expect(pulled).toBe(Math.ceil(120 / 4) + TETHER.pullSlack);
    expect([a.action, a.tether]).toEqual(['fall', null]);
  });

  it('the fighter keeps drifting while it aims in the air, and aiming down does not fast-fall him', () => {
    const { a, step } = setup(-40);
    putInAir(a, -40, 60, 1);
    step(1, [{ buttons: ['special'] }]);
    const x = a.pos.x;
    step(10, [{ x: 100, y: -100, buttons: ['special'] }]);
    expect(a.action).toBe('aerial');
    expect(a.pos.x - x).toBeGreaterThan(3);
    expect(a.fastFalling).toBe(false);
    expectAt(a.aim!, 60 * Math.SQRT1_2, -60 * Math.SQRT1_2);
  });

  it('a quick release within 6 frames with the stick held fires at full range in that 8-way direction', () => {
    for (const [held, quick] of [
      [5, true],
      [7, false],
    ] as const) {
      const { a, events, step } = setup(-40);
      const o = tetherOrigin(a);
      step(1, [{ buttons: ['special'] }]);
      step(held, [{ x: 70, y: 70, buttons: ['special'] }]);
      step(pointGrapple.tether!.frame, [{ x: 70, y: 70 }]);
      const fire = first(events, 'tetherFire');
      const d = quick ? 160 / Math.SQRT2 : held * 0.7 * 6;
      expectAt(fire, o.x + d, o.y + d);
    }
  });

  it('the Line Tether snaps to a ledge it passes within 10 units of and reels into a ledge grab', () => {
    const { m, a, events, step } = setup(0);
    putInAir(a, 95, -26, -1);
    attack(m, 0, 'sideB');
    const hang = { x: 80 + tetherTester.stats.width / 2 + 0.5, y: -tetherTester.stats.height * 0.85 };
    const reel: number[] = [];
    for (let i = 0; i < 60 && a.action !== 'ledgeCatch'; i++) {
      step(1);
      if (a.action === 'tetherPull') reel.push(Math.hypot(a.pos.x - hang.x, a.pos.y - hang.y));
    }
    expect(a.action).toBe('ledgeCatch');
    expect(reel.at(-1)).toBeLessThanOrEqual(TETHER.ledgeArrive);
    expect(reel.at(-2)).toBeGreaterThan(TETHER.ledgeArrive);
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherLatch', 'tetherRelease']);
    expect(events[1]).toEqual({ type: 'tetherLatch', port: 0, kind: 'ledge', x: 80, y: 0 });
    expect([a.ledge, a.facing, a.tether]).toEqual([1, -1, null]);
  });

  it('a held ledge, or the line hitting anything else, whiffs and the move plays out', () => {
    const { m, a, b, events, step } = setup(0, 30);
    putInAir(b!, 86, -12, -1);
    step(30);
    expect(b!.action.startsWith('ledge')).toBe(true);
    putInAir(a, 95, -26, -1);
    attack(m, 0, 'sideB');
    step(lineTether.tether!.frame + 10);
    expect(events.filter((e) => 'port' in e && e.port === 0).map((e) => e.type)).toEqual([
      'tetherFire',
      'tetherRelease',
    ]);
    expect([a.action, a.tether]).toEqual(['aerial', null]);
  });

  it('a hit knocks the fighter off his tether', () => {
    const { m, a, b, events, step } = setup(-70, 30);
    attack(m, 0, 'upB');
    until(step, () => a.action === 'tetherHang', [{ buttons: ['jump'] }]);
    putInAir(b!, a.pos.x + 6, a.pos.y - 4, -1);
    attack(m, 1, 'nair');
    until(step, () => a.tether === null, [{ buttons: ['jump'] }], 10);
    expect(['hitstun', 'tumble']).toContain(a.action);
    expect(events.at(-1)).toEqual({ type: 'tetherRelease', port: 0 });
  });
});

export type { MatchState };
