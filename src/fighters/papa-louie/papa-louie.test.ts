import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import { attack, placeInAir, runPorts, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { stats } from './stats';
import { firstActive, holding, strike, versus } from './testing';
import { koPercent, type KoHit } from '../../sim/testing/ko';

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

describe('Papa Louie: jab combo (poke, poke, flat slap)', () => {
  const mash = (i: number, every = 8, until = 24): Hold =>
    i % every === 0 && i < until ? { buttons: ['attack'] } : {};

  it('Attack again inside each window chains jab -> jab2 -> jab3', () => {
    const m = versus();
    const f = m.fighters[0]!;
    const seen: string[] = [];
    for (let i = 0; i < 80; i++) {
      runPorts(m, 1, [mash(i), {}]);
      if (f.move && seen.at(-1) !== f.move) seen.push(f.move);
    }
    expect(seen).toEqual(['jab', 'jab2', 'jab3']);
  });

  it('a single press plays only the first poke and ends at its first actionable frame', () => {
    const m = versus();
    const f = m.fighters[0]!;
    runPorts(m, 1, [{ buttons: ['attack'] }, {}]);
    let frames = 1;
    while (f.move === 'jab') {
      runPorts(m, 1, [{}, {}]);
      frames++;
    }
    expect(frames).toBe(moves.jab!.faf);
    expect(f.action).toBe('idle');
  });

  it('mashing through hitlag lands all three hits on a standing Mario: 8.5%, fresh (x1.05) and x1.2 in 1v1', () => {
    const m = versus();
    const [a, v] = m.fighters;
    Object.assign(v!, {
      pos: { x: a!.pos.x + 9 * a!.facing, y: a!.pos.y },
      ground: a!.ground,
      action: 'idle',
    });
    v!.intangible = 0;
    for (let i = 0; i < 100; i++) runPorts(m, 1, [mash(i, 4, 44), {}]);
    expect(v!.damage).toBeCloseTo((2.5 + 2 + 4) * 1.05 * 1.2, 6);
  });
});

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

/**
 * Kill percents with koPercent: the Mario reference at the Battlefield ledge, fresh, no rage, no DI (aerials hit him
 * in the air). Each move takes its Ultimate analogue's angle, BKB and KBG (13.0.1 data from dragdown.wiki) and KOs
 * within 5 points of the analogue's own hit. Where the roster gives Papa more damage than the analogue, he KOs
 * earlier, so those moves are pinned to the analogue's knockback at Papa's damage instead.
 */
describe('Papa Louie: kill percents against Ultimate analogues', () => {
  const ko = (move: string, air = false) => koPercent({ hit: { fighter: 'papa-louie', move }, air })!;
  const ANALOGUES: [string, string, KoHit, boolean?][] = [
    ['fsmash', "Mario's forward smash (sweetspot)", { damage: 17.8, angle: 361, kbg: 99, bkb: 25 }],
    ['ftilt', "Luigi's forward tilt", { damage: 9, angle: 361, kbg: 75, bkb: 50 }],
    ['nair', "Mario's neutral air (clean)", { damage: 8, angle: 361, kbg: 100, bkb: 20 }, true],
    ['fthrow', "Luigi's forward throw", { damage: 9, angle: 45, kbg: 65, bkb: 60 }],
    ['bthrow', "Mario's back throw", { damage: 11, angle: 45, kbg: 66, bkb: 70, direction: 'back' }],
    ['uthrow', "Luigi's up throw", { damage: 8, angle: 90, kbg: 72, bkb: 70 }],
  ];
  it.each(ANALOGUES)('%s KOs within 5 points of %s', (move, _, hit, air = false) => {
    expect(Math.abs(ko(move, air) - koPercent({ hit, air })!)).toBeLessThanOrEqual(5);
  });

  const HARDER: [string, number, string, KoHit, boolean?][] = [
    ['usmash', 15, "Mario's 14% up smash", { damage: 14, angle: 83, kbg: 94, bkb: 32 }],
    ['dsmash', 13, "Mario's 12% down smash (back)", { damage: 12, angle: 30, kbg: 100, bkb: 30 }],
    ['dashAttack', 10, "Mario's 8% dash attack (clean)", { damage: 8, angle: 50, kbg: 43, bkb: 100 }],
    ['bair', 11, "Mario's 10.5% back air (clean)", { damage: 10.5, angle: 361, kbg: 106, bkb: 12 }, true],
    ['uair', 8, "Mario's 7% up air", { damage: 7, angle: 75, kbg: 135, bkb: 10 }, true],
  ];
  it.each(HARDER)(
    '%s at %s%% KOs earlier than %s, as that knockback does at his damage',
    (move, damage, _, hit, air = false) => {
      const papa = ko(move, air);
      expect(papa).toBeLessThan(koPercent({ hit, air })!);
      expect(Math.abs(papa - koPercent({ hit: { ...hit, damage }, air })!)).toBeLessThanOrEqual(5);
    },
  );

  it('forward smash is his strongest finisher, then down smash, then up smash', () => {
    expect(ko('fsmash')).toBeLessThan(ko('dsmash'));
    expect(ko('dsmash')).toBeLessThan(ko('usmash'));
  });

  it('back throw into the oven is his kill throw, well ahead of forward and up throw', () => {
    expect(ko('bthrow') + 30).toBeLessThan(ko('fthrow'));
    expect(ko('fthrow')).toBeLessThan(ko('uthrow'));
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

describe('Papa Louie: Paddle Propeller (up special)', () => {
  it('rises about 60 units from frame 6, then leaves him helpless with 22 frames of landing lag', () => {
    const m = versus();
    const f = m.fighters[0]!;
    const y0 = f.pos.y;
    runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
    expect(f.move).toBe('upB');
    let top = y0;
    let firstRise = 0;
    let helpless = false;
    for (let i = 0; i < 600 && !(helpless && f.ground); i++) {
      runPorts(m, 1, [{}, {}]);
      if (!firstRise && f.pos.y > y0 + 0.5) firstRise = f.actionFrame;
      top = Math.max(top, f.pos.y);
      helpless ||= f.action === 'helpless';
    }
    expect(firstRise).toBeLessThanOrEqual(7);
    expect(top - y0).toBeGreaterThan(50);
    expect(top - y0).toBeLessThan(70);
    expect(helpless).toBe(true);
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(22);
  });

  it('steers with the stick', () => {
    const drift = (x: number) => {
      const m = versus();
      const f = m.fighters[0]!;
      const x0 = f.pos.x;
      runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
      runPorts(m, 34, [{ x }, {}]);
      return f.pos.x - x0;
    };
    expect(drift(100)).toBeGreaterThan(15);
    expect(drift(-100)).toBeLessThan(-15);
  });

  it('carries a Mario standing beside him up through all six hits: 9%, fresh (x1.05) and x1.2 in 1v1', () => {
    const m = versus();
    const [a, v] = m.fighters;
    Object.assign(v!, { pos: { x: a!.pos.x + 3, y: a!.pos.y }, ground: a!.ground, action: 'idle' });
    v!.intangible = 0;
    runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
    runPorts(m, 60, [{}, {}]);
    expect(v!.damage).toBeCloseTo(9 * 1.05 * 1.2, 6);
  });
});

describe('Papa Louie: Paddle Deflect (down special)', () => {
  it("the paddle's edge hits a Mario beside him for 7% on frame 5", () => {
    expect(firstActive('downB')).toBe(5);
    const { v } = strike('downB', { x: 7 }, 0);
    expect(v.damage).toBeCloseTo(7 * 1.05 * 1.2, 6);
  });

  it('slows his fall in the air', () => {
    const fallAfter = (move: boolean) => {
      const m = versus();
      const f = placeInAir(m, 0, 80);
      runPorts(m, 20, [{}, {}]);
      if (move) runPorts(m, 1, [{ y: -100, buttons: ['special'] }, {}]);
      else runPorts(m, 1, [{}, {}]);
      const y = f.pos.y;
      runPorts(m, 15, [{}, {}]);
      return y - f.pos.y;
    };
    expect(fallAfter(true)).toBeLessThan(fallAfter(false) * 0.6);
  });
});
