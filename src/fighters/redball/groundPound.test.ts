import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { knowledge } from '../../ai/knowledge';
import { activeHitboxes } from '../../sim/combat/hits';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { statusOf } from '../../sim/statuses';
import { koPercent } from '../../sim/testing/ko';
import { placeInAir, run, runPorts, testMatch, type Hold } from '../../sim/testing/sim';
import { POUND } from './groundPound';
import { moves } from './moves';
import { stats } from './stats';
import { versusMario } from './versus';

const DOWN_B: Hold = { y: -100, buttons: ['special'] };
const SQUARED = 'redball/squared';
/** The 1v1 multiplier and the fresh-move bonus on every first hit here. */
const DEALT = 1.05 * 1.2;
/** Battlefield: the top platform's index and height, and the left side platform's. */
const TOP = { index: 1, y: 47.19 };
const SIDE = { index: 0, x: -42, y: 24.12 };

/** One row per frame of a Ground Pound from its press: what Red Ball is doing and the % of each box he has out. */
interface Row {
  move: string | null;
  action: string;
  frame: number;
  y: number;
  ground: boolean;
  boxes: number[];
}

function frames(m: MatchState, f: FighterState, count: number): Row[] {
  const rows: Row[] = [];
  run(m, 1, DOWN_B);
  for (let i = 0; i < count; i++) {
    rows.push({
      move: f.move,
      action: f.action,
      frame: f.actionFrame,
      y: f.pos.y,
      ground: f.ground !== null,
      boxes: activeHitboxes(f).map((b) => b.box.damage),
    });
    run(m, 1);
  }
  return rows;
}

/** Red Ball (P1) in the air at (x, y) facing `facing`, against the Mario reference (P2). */
function inAir(x: number, y: number, facing: 1 | -1 = 1) {
  const { m, a, v } = versusMario();
  Object.assign(a, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    ground: null,
    action: 'fall',
    actionFrame: 1,
    jumpsUsed: 1,
    facing,
  });
  return { m, a, v };
}

/** Moves Mario to stand at x on the main stage. */
function standMario(v: FighterState, x: number, facing: 1 | -1 = -1) {
  Object.assign(v, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, intangible: 0, facing });
}

/** Steps both ports (P2 holding `hold`) until `done` or `limit` frames, collecting the events. */
function play(m: MatchState, limit: number, done: () => boolean = () => false, hold: Hold = {}) {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit && !done(); i++) {
    runPorts(m, 1, [{}, hold]);
    events.push(...m.events);
  }
  return events;
}

describe("Red Ball: Ground Pound (down special) on Yoshi's Yoshi Bomb", () => {
  it('has Yoshi Bomb’s frame data and hitboxes (SmashWiki, Yoshi (SSBU)/Down special; ultimateframedata.com)', () => {
    expect(POUND).toMatchObject({
      takeoff: 7,
      fall: 27,
      airFall: 19,
      rise: 1.4,
      speed: 4.8,
      passFrames: 7,
      wave: [3, 12],
      landFaf: 40,
    });
    const slam = { damage: 15, angle: 80, bkb: 60, kbg: 72, radius: 6.8, hitlag: 0.7 };
    expect(moves.downB).toMatchObject({ air: 'downBAir', ledgeFrom: 27 });
    expect(moves.downB!.hits).toMatchObject([
      {
        frames: [7, 7],
        boxes: [{ damage: 4, angle: 80, bkb: 0, kbg: 100, wbkb: 80, radius: 7, hitlag: 0.5 }],
      },
      { frames: [27, 34], rehit: true, boxes: [slam] },
    ]);
    const air = { damage: 12, angle: 80, bkb: 70, kbg: 68, radius: 6.4, hitlag: 0.7 };
    expect(moves.downBAir).toMatchObject({ ledgeFrom: 19 });
    expect(moves.downBAir!.hits).toMatchObject([
      { frames: [19, 19], boxes: [{ ...air, x: 0, y: 0 }] },
      { frames: [20, 26], boxes: [{ ...air, x: 0, y: 5.5 }] },
    ]);
    const star = { damage: 4, angle: 50, bkb: 50, kbg: 40, radius: 4, hitlag: 0, status: SQUARED };
    expect(moves.downBLand).toMatchObject({
      faf: 40,
      hits: [
        {
          frames: [3, 12],
          boxes: [
            { ...star, x: 8, y: 1 },
            { ...star, x: -8, y: 1, direction: 'back' },
          ],
        },
      ],
    });
  });

  it('on the ground: rise hit on 7, peak 1.4 full hops up on 26, drops 4.8 a frame from 27, acts on frame 76', () => {
    // Left of the side platform, so nothing is above or below him.
    const m = testMatch({ fighter: 'redball', x: -70 });
    const f = m.fighters[0]!;
    const rows = frames(m, f, 80);
    const at = (frame: number) => rows[frame - 1]!;
    for (let i = 1; i <= 6; i++) expect(at(i), `frame ${i}`).toMatchObject({ move: 'downB', ground: true });
    expect(at(7)).toMatchObject({ ground: false, boxes: [4] });
    expect(rows.flatMap((r, i) => (r.boxes.includes(4) && r.move === 'downB' ? [i + 1] : []))).toEqual([7]);
    const peak = 1.4 * stats.fullHopHeight;
    expect(Math.max(...rows.map((r) => r.y))).toBeCloseTo(peak, 6);
    expect(at(26).y).toBeCloseTo(peak, 6);
    for (let i = 27; i <= 35; i++) {
      expect(at(i).y, `frame ${i}`).toBeCloseTo(peak - POUND.speed * (i - 26), 6);
      expect(at(i).boxes, `frame ${i}`).toEqual([15]);
    }
    // Touches down on 36 and lands into the shockwave, out on its frames 3-12 (move frames 39-48).
    expect(at(36)).toMatchObject({ move: 'downB', ground: true, y: 0 });
    expect(at(37)).toMatchObject({ move: 'downBLand', frame: 1 });
    const wave = rows.flatMap((r) => (r.move === 'downBLand' && r.boxes.length ? [r.frame] : []));
    expect(wave).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(rows.flatMap((r) => (r.move === 'downBLand' ? r.boxes : [])).every((d) => d === 4)).toBe(true);
    expect(at(75)).toMatchObject({ move: 'downBLand', frame: 39 });
    expect(at(76)).toMatchObject({ move: null, action: 'idle' });
  });

  it('in the air: pops 6 up, drops from 19 with the clean hit, the late hit from 20, and falls until it lands', () => {
    const m = testMatch({ fighter: 'redball', x: -70 });
    const f = placeInAir(m, -70, 60);
    const rows = frames(m, f, 80);
    const at = (frame: number) => rows[frame - 1]!;
    expect(at(1).move).toBe('downBAir');
    expect(at(18).y).toBeCloseTo(60 + POUND.airPop, 6);
    expect(Math.max(...rows.map((r) => r.y))).toBeCloseTo(60 + POUND.airPop, 6);
    expect(rows.slice(0, 18).every((r) => r.boxes.length === 0)).toBe(true);
    expect(at(19).boxes).toEqual([12]);
    for (let i = 19; i <= 31; i++) expect(at(i).y, `frame ${i}`).toBeCloseTo(66 - POUND.speed * (i - 18), 6);
    // The move holds on its last frame through the drop, so it never ends in the air.
    expect(rows.slice(25, 31).map((r) => r.frame)).toEqual([26, 26, 26, 26, 26, 26]);
    expect(at(32)).toMatchObject({ move: 'downBAir', ground: true, y: 0 });
    expect(at(33)).toMatchObject({ move: 'downBLand', frame: 1 });
    expect(at(72)).toMatchObject({ action: 'idle' });
  });

  it('the rise hit pops Mario up at 80 degrees with set knockback: the same launch at 0% and 120%', () => {
    const launch = (percent: number) => {
      const { m, a, v } = versusMario();
      Object.assign(a, { pos: { x: 0, y: 0 }, prevPos: { x: 0, y: 0 }, facing: 1 });
      standMario(v, 7);
      v.damage = percent;
      runPorts(m, 1, [DOWN_B, {}]);
      play(m, 10, () => v.damage > percent);
      expect(a.actionFrame).toBe(7);
      expect(v.damage - percent).toBeCloseTo(4 * DEALT, 9);
      play(m, 30, () => v.launch === null && v.hitlag === 0);
      return v.kb;
    };
    const fresh = launch(0);
    const high = launch(120);
    expect(Math.hypot(high.x, high.y)).toBeCloseTo(Math.hypot(fresh.x, fresh.y), 6);
    expect((Math.atan2(fresh.y, fresh.x) * 180) / Math.PI).toBeCloseTo(80, 0);
  });

  it('rises through the top platform, slams Mario standing on it for 15%, and drops through it to the stage', () => {
    const { m, a, v } = versusMario();
    Object.assign(a, { pos: { x: 0, y: 0 }, prevPos: { x: 0, y: 0 }, facing: 1 });
    Object.assign(v, {
      pos: { x: 0, y: 60 },
      prevPos: { x: 0, y: 60 },
      ground: null,
      action: 'fall',
      intangible: 0,
    });
    play(m, 60, () => v.ground !== null);
    expect(v.ground).toEqual({ kind: 'platform', index: TOP.index });
    runPorts(m, 1, [DOWN_B, {}]);
    const events = play(m, 50, () => a.move === 'downBLand');
    const hits = events.filter((e) => e.type === 'hit' && e.victim === 1);
    expect(hits).toHaveLength(1);
    expect(v.damage).toBeCloseTo(15 * DEALT, 9);
    expect(a).toMatchObject({ move: 'downBLand', ground: { kind: 'solid' }, pos: { y: 0 } });
  });

  it('in the air the clean hit lands on frame 19 for 12%', () => {
    const { m, a, v } = inAir(0, 18);
    standMario(v, 0);
    runPorts(m, 1, [DOWN_B, {}]);
    play(m, 30, () => v.damage > 0);
    expect(a).toMatchObject({ move: 'downBAir', actionFrame: 19 });
    expect(v.damage).toBeCloseTo(12 * DEALT, 9);
  });

  it.each([
    ['in front of', 1],
    ['behind', -1],
  ] as const)('the landing shockwave squares Mario standing 12 units %s him for 221 frames', (_, side) => {
    const { m, a, v } = inAir(0, 30);
    standMario(v, 12 * side);
    runPorts(m, 1, [DOWN_B, {}]);
    const events = play(m, 80, () => a.action === 'idle');
    const hits = events.filter((e) => e.type === 'hit' && e.victim === 1);
    expect(hits).toMatchObject([{ attacker: 0, move: 'downBLand' }]);
    expect((hits[0] as Extract<SimEvent, { type: 'hit' }>).damage).toBeCloseTo(4 * DEALT, 9);
    // floor(20 + 40 x 5.04), Squared's flower formula on the % the 4% hit added in 1v1.
    expect(events.find((e) => e.type === 'statusStart')).toEqual({
      type: 'statusStart',
      port: 1,
      status: SQUARED,
      frames: 221,
      source: 0,
    });
    expect(statusOf(v, SQUARED)).toBeDefined();
  });

  it('a shield takes the shockwave and stops the square', () => {
    const { m, a, v } = inAir(0, 30);
    standMario(v, 12);
    runPorts(m, 2, [{}, { buttons: ['shield'] }]);
    runPorts(m, 1, [DOWN_B, { buttons: ['shield'] }]);
    const events = play(m, 80, () => a.action === 'idle', { buttons: ['shield'] });
    expect(events.some((e) => e.type === 'shieldHit' && e.victim === 1)).toBe(true);
    expect(v.damage).toBe(0);
    expect(v.statuses).toEqual([]);
  });

  it('catches the ledge from the start of the drop, not during the pop', () => {
    // Beside Battlefield's right ledge, facing it, with the corner in reach from the first frame.
    const { m, a } = inAir(86, -8, -1);
    runPorts(m, 1, [DOWN_B, {}]);
    play(m, POUND.airFall - 2);
    expect(a).toMatchObject({ action: 'aerial', move: 'downBAir', actionFrame: POUND.airFall - 1 });
    runPorts(m, 1, [{}, {}]);
    expect(a).toMatchObject({ action: 'ledgeCatch', ledge: 1 });
  });

  it('with no ledge in reach the drop never ends: off the stage he falls through the bottom blast zone', () => {
    const { m, a } = inAir(130, 0, -1);
    runPorts(m, 1, [DOWN_B, {}]);
    const seen = new Set<string>();
    play(m, 120, () => {
      if (a.action !== 'ko') seen.add(`${a.action} ${a.move}`);
      return a.stocks < 3;
    });
    expect(a.stocks).toBe(2);
    expect([...seen]).toEqual(['aerial downBAir']);
  });

  it('passes through a platform in the drop’s first 7 frames and lands on one after them, unless down is held', () => {
    const landOn = (height: number, hold: Hold = {}) => {
      const m = testMatch({ fighter: 'redball' });
      const f = placeInAir(m, SIDE.x, SIDE.y + height);
      run(m, 1, DOWN_B);
      for (let i = 0; i < 120 && f.move !== 'downBLand'; i++) run(m, 1, hold);
      return f.ground;
    };
    // 10 above: crosses the platform on drop frame 4 and lands on the stage below.
    expect(landOn(10)).toMatchObject({ kind: 'solid' });
    // 60 above: still 32 above it when the 7 frames end, so it lands on it.
    expect(landOn(60)).toEqual({ kind: 'platform', index: SIDE.index });
    expect(landOn(60, { y: -100 })).toMatchObject({ kind: 'solid' });
  });

  it('slams KO within 5% of Yoshi Bomb’s own hits on Mario at the ledge; the shockwave does not kill', () => {
    const ko = (move: string) => koPercent({ hit: { fighter: 'redball', move } }) ?? Infinity;
    const yoshiGround = koPercent({ hit: { damage: 15, angle: 80, kbg: 72, bkb: 60 } })!;
    const yoshiAir = koPercent({ hit: { damage: 12, angle: 80, kbg: 68, bkb: 70 } })!;
    expect(Math.abs(ko('downB') - yoshiGround)).toBeLessThanOrEqual(5);
    expect(Math.abs(ko('downBAir') - yoshiAir)).toBeLessThanOrEqual(5);
    expect(ko('downB')).toBeLessThan(ko('downBAir'));
    expect(ko('downBLand')).toBeGreaterThan(150);
  });

  it('a CPU reads it from the ground and uses it in a match without errors', () => {
    const probe = knowledge('redball', 'battlefield').ground.downB!;
    expect(probe).toMatchObject({
      first: POUND.takeoff - 1,
      damage: 15,
      endDx: 0,
      endDy: 0,
      endsGrounded: true,
    });
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'redball' }, { fighter: 'reference-mario' }],
    });
    const red = createCpu({ port: 0, level: 9, seed: 1 });
    const mario = createCpu({ port: 1, level: 5, seed: 11 });
    const used: string[] = [];
    for (let i = 0; i < 3600; i++) {
      stepMatch(m, [red.input(m), mario.input(m)]);
      for (const e of m.events) if (e.type === 'move' && e.port === 0) used.push(e.move);
    }
    expect(used).toContain('downB');
    expect(used).toContain('downBLand');
  });
});
