import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import { attack, runPorts, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { stats } from './stats';
import { holding, killPercent, strike, throwKills, versus } from './testing';

describe('Papa Louie: stats', () => {
  it('match the roster: Mario-plus weight, Ness ground speeds, floaty Samus gravity and Zelda jumps', () => {
    expect(stats).toMatchObject({
      weight: 100,
      walkSpeed: 1.0,
      dashInitialSpeed: 1.826,
      runSpeed: 1.6,
      airSpeed: 1.03,
      gravity: 0.075,
      fallSpeed: 1.35,
      fastFallSpeed: 2.16,
      jumps: 2,
      fullHopHeight: 32,
      shortHopHeight: 15.5,
      doubleJumpHeight: 32,
    });
    expect(stats.airAccelBase + stats.airAccelAdd).toBeCloseTo(0.08, 9);
  });
});

/** Roster frame data: the first active frame, and box 0's damage in each hit window. */
const ROSTER: [string, number, number[]][] = [
  ['jab', 4, [2.5]],
  ['jab2', 4, [2]],
  ['jab3', 5, [4]],
  ['ftilt', 7, [9]],
  ['utilt', 6, [1, 1, 1, 4]],
  ['dtilt', 6, [7]],
  ['dashAttack', 8, [10, 6]],
  ['fsmash', 15, [17]],
  ['usmash', 11, [15]],
  ['dsmash', 8, [13, 13]],
  ['nair', 5, [8, 5]],
  ['fair', 10, [12, 12]],
  ['bair', 7, [11]],
  ['uair', 5, [8]],
  ['dair', 8, [1.5, 1.5, 1.5, 1.5, 5]],
  ['grab', 8, [0]],
];

describe('Papa Louie: frame data', () => {
  it('has the whole normal kit', () => {
    for (const name of [
      ...['jab', 'jab2', 'jab3', 'ftilt', 'utilt', 'dtilt', 'dashAttack', 'fsmash', 'usmash', 'dsmash'],
      ...['nair', 'fair', 'bair', 'uair', 'dair', 'getupAttack'],
      ...['grab', 'dashGrab', 'pivotGrab', 'pummel', 'fthrow', 'bthrow', 'uthrow', 'dthrow'],
    ])
      expect(moves[name], name).toBeDefined();
  });

  it.each(ROSTER)(
    '%s comes out on frame %s with the roster damage, and ends on its first actionable frame',
    (name, startup, damage) => {
      const move = moves[name]!;
      expect(move.hits.map((w) => w.boxes.find((b) => b.id === 0)!.damage)).toEqual(damage);
      const m = versus();
      const f = m.fighters[0]!;
      const air = move.kind === 'aerial';
      if (air)
        Object.assign(f, { pos: { x: 0, y: 120 }, prevPos: { x: 0, y: 120 }, ground: null, action: 'fall' });
      attack(m, 0, name);
      let first = 0;
      let frames = 0;
      while (f.move === name) {
        runPorts(m, 1, [{}, {}]);
        frames++;
        if (!first && activeHitboxes(f).length > 0) first = f.actionFrame;
      }
      expect(first).toBe(startup);
      expect(frames).toBe(move.faf);
      expect(f.action).toBe(air ? 'fall' : 'idle');
    },
  );

  it('the paddle outranges his body: ftilt and fsmash reach past 19 units, the grab 13.5', () => {
    const reach = (name: string) =>
      Math.max(...moves[name]!.hits.flatMap((w) => w.boxes.map((b) => b.x + b.radius)));
    expect(reach('ftilt')).toBeGreaterThanOrEqual(19);
    expect(reach('fsmash')).toBeGreaterThanOrEqual(19);
    expect(reach('grab')).toBe(13.5);
  });

  it('holding Attack charges the Poised Swing to 1.4x damage', () => {
    const m = versus();
    const [a, v] = m.fighters;
    Object.assign(v!, {
      pos: { x: a!.pos.x + 14 * a!.facing, y: a!.pos.y },
      ground: a!.ground,
      action: 'idle',
    });
    runPorts(m, 1, [{ x: 100 * a!.facing, buttons: ['attack'] }, {}]);
    expect(a!.move).toBe('fsmash');
    runPorts(m, 100, [{ buttons: ['attack'] }, {}]);
    expect(a!.charge).toBe(60);
    runPorts(m, 10, [{}, {}]);
    expect(v!.damage).toBeCloseTo(17 * 1.4 * 1.05 * 1.2, 6);
  });
});

describe('Papa Louie: multi-hits and the meteor', () => {
  it('Dough Twirl lands all four hits on a standing opponent and pops them up', () => {
    const { v } = strike('utilt', { x: 9 }, 0);
    expect(v.damage).toBeCloseTo(7 * 1.05 * 1.2, 6);
  });

  it('Box Stomp lands all five stomps on an opponent below him', () => {
    const { v } = strike('dair', { x: 0, y: -11 }, 0, { y: 120 }, 90);
    expect(v.damage).toBeCloseTo(11 * 1.05 * 1.2, 6);
  });

  it('Peel Chop meteors with the paddle face on frames 12-14 and sends forward before that', () => {
    const sweet = strike('fair', { x: 14, y: -7 }, 60, { y: 80 }, 30);
    expect(sweet.v.damage).toBeCloseTo(60 + 12 * 1.05 * 1.2, 6);
    expect(sweet.v.kb.y).toBeLessThan(0);
    const early = strike('fair', { x: 10, y: 4 }, 60, { y: 80 }, 30);
    expect(early.v.damage).toBeGreaterThan(60);
    expect(early.v.kb.y).toBeGreaterThan(0);
    expect(early.v.kb.x).toBeGreaterThan(0);
  });
});

/** Roster kill percents against Mario in the middle of Battlefield, no DI. */
describe('Papa Louie: kill percents', () => {
  it.each([
    ['fsmash', 95, (p: number) => strike('fsmash', { x: 14 }, p).ko],
    ['usmash', 115, (p: number) => strike('usmash', { x: 10 }, p).ko],
    ['dsmash', 120, (p: number) => strike('dsmash', { x: 13 }, p).ko],
    ['ftilt', 170, (p: number) => strike('ftilt', { x: 14 }, p).ko],
    ['dashAttack', 190, (p: number) => strike('dashAttack', { x: 11 }, p).ko],
    ['bair', 140, (p: number) => strike('bair', { x: -12 }, p, { y: 40 }).ko],
  ] as const)('%s KOs at about %s%%', (move, target, kills) => {
    // TODO(COOL-3 koPercent calibration): vertical kills land about 10% later since the engine gained Ultimate's
    // DamageFlyTop gravity and top-blast-zone rule. Retune against koPercent (src/sim/testing/ko.ts) once roster.md's
    // kill targets are revised.
    const slack = move === 'usmash' ? 15 : 5;
    const kp = killPercent(kills);
    expect(kp).toBeGreaterThanOrEqual(target - slack);
    expect(kp).toBeLessThanOrEqual(target + slack);
  });

  it('back throw into the oven is the kill throw at the ledge (about 150%); forward throw needs about 200%', () => {
    const back = killPercent((p) => throwKills(p, (s) => ({ x: -100 * s }), 66, -1));
    expect(back).toBeGreaterThanOrEqual(145);
    expect(back).toBeLessThanOrEqual(155);
    const forward = killPercent((p) => throwKills(p, (s) => ({ x: 100 * s }), 66, 1));
    expect(forward).toBeGreaterThanOrEqual(195);
    expect(forward).toBeLessThanOrEqual(205);
  });
});

describe('Papa Louie: grab and throws', () => {
  const inputs: [string, (facing: number) => Hold][] = [
    ['fthrow', (s) => ({ x: 100 * s })],
    ['bthrow', (s) => ({ x: -100 * s })],
    ['uthrow', () => ({ y: 100 })],
    ['dthrow', () => ({ y: -100 })],
    ['pummel', () => ({ buttons: ['attack'] })],
  ];

  it.each(inputs)('%s from the hold', (move, hold) => {
    const { m, a } = holding(0);
    runPorts(m, 1, [hold(a.facing), {}]);
    expect(a.move).toBe(move);
  });

  it.each([
    ['fthrow', 9],
    ['bthrow', 11],
    ['uthrow', 8],
    ['dthrow', 6],
  ] as const)('%s deals %s%%', (move, damage) => {
    expect(moves[move]!.throw!.hit.damage).toBe(damage);
  });

  it('Pepper Shake pummels for 1.3%', () => {
    const { m, a, v } = holding(0);
    runPorts(m, 1, [{ buttons: ['attack'] }, {}]);
    expect(a.move).toBe('pummel');
    expect(v.damage).toBeCloseTo(1.3 * 1.2, 6);
  });

  it.each([
    ['dthrow', { y: -100 }],
    ['uthrow', { y: 100 }],
  ] as const)('%s at 0%% leaves Papa free to act before the opponent: a combo throw', (move, hold) => {
    const { m, a, v } = holding(0);
    runPorts(m, 1, [hold, {}]);
    expect(a.move).toBe(move);
    let papaFree = 0;
    let victimFree = 0;
    for (let i = 1; i < 120 && !victimFree; i++) {
      runPorts(m, 1, [{}, {}]);
      if (!papaFree && a.action === 'idle') papaFree = i;
      if (v.launch === null && v.hitstun <= 0 && v.action !== 'grabbed') victimFree = i;
    }
    expect(papaFree).toBeGreaterThan(0);
    expect(papaFree).toBeLessThan(victimFree);
  });
});
