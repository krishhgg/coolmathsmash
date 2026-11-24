import { describe, expect, it } from 'vitest';
import ref from '../../sim/reference/physics-constants.json';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { koPercent, type KoHit, type KoSetup } from '../../sim/testing/ko';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';

const fireboy = () => testMatch({ fighter: 'fireboy' });

/** The move started by `hold` (one frame) from standing still, or by `hold` after holding `before`. */
function moveFrom(hold: Hold, before?: { hold: Hold; frames: number }): string | null {
  const m = fireboy();
  if (before) run(m, before.frames, before.hold);
  run(m, 1, hold);
  return m.fighters[0]!.move;
}

describe('Fireboy: attack inputs', () => {
  it('jab, tilts and smashes come from Attack with no, a held, or a just-tapped direction', () => {
    expect(moveFrom({ buttons: ['attack'] })).toBe('jab');
    expect(moveFrom({ x: 100, buttons: ['attack'] })).toBe('fsmash');
    expect(moveFrom({ y: 100, buttons: ['attack'] })).toBe('usmash');
    expect(moveFrom({ y: -100, buttons: ['attack'] })).toBe('dsmash');
    expect(moveFrom({ x: 50, buttons: ['attack'] }, { hold: { x: 50 }, frames: 8 })).toBe('ftilt');
    expect(moveFrom({ y: 50, buttons: ['attack'] }, { hold: { y: 50 }, frames: 8 })).toBe('utilt');
    expect(moveFrom({ y: -60, buttons: ['attack'] }, { hold: { y: -60 }, frames: 8 })).toBe('dtilt');
  });

  it('the C-stick smashes and turns around for a back smash', () => {
    const m = fireboy();
    const f = m.fighters[0]!;
    const facing = f.facing;
    run(m, 1, { cx: -100 * facing });
    expect(f.move).toBe('fsmash');
    expect(f.facing).toBe(-facing);
  });

  it('running into Attack is a dash attack', () => {
    const m = fireboy();
    run(m, 20, { x: 100 });
    expect(m.fighters[0]!.action).toBe('run');
    run(m, 1, { x: 100, buttons: ['attack'] });
    expect(m.fighters[0]!.move).toBe('dashAttack');
  });

  it('aerials follow the stick relative to facing, and the C-stick does the same', () => {
    const aerial = (hold: Hold) => {
      const m = fireboy();
      const f = placeInAir(m, 0, 40, 1);
      run(m, 1, hold);
      return f.move;
    };
    expect(aerial({ buttons: ['attack'] })).toBe('nair');
    expect(aerial({ x: 100, buttons: ['attack'] })).toBe('fair');
    expect(aerial({ x: -100, buttons: ['attack'] })).toBe('bair');
    expect(aerial({ y: 100, buttons: ['attack'] })).toBe('uair');
    expect(aerial({ y: -100, buttons: ['attack'] })).toBe('dair');
    expect(aerial({ cx: -100 })).toBe('bair');
  });
});

describe('Fireboy: frame data', () => {
  it('fsmash is out on frames 15-17 exactly', () => {
    const m = fireboy();
    const f = m.fighters[0]!;
    run(m, 1, { x: 100, buttons: ['attack'] });
    const active: number[] = [];
    while (f.move === 'fsmash') {
      if (activeHitboxes(f).length > 0) active.push(f.actionFrame);
      run(m, 1);
    }
    expect(active).toEqual([15, 16, 17]);
    expect(f.action).toBe('idle');
  });

  it('holding Attack charges a smash for up to 60 frames and 1.4x damage', () => {
    const m = testMatch({ fighter: 'fireboy', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(v, { pos: { x: a.pos.x + 12 * a.facing, y: a.pos.y }, ground: a.ground, action: 'idle' });
    runPorts(m, 1, [{ x: 100 * a.facing, buttons: ['attack'] }, {}]);
    runPorts(m, 100, [{ buttons: ['attack'] }, {}]);
    expect(a.charge).toBe(60);
    run(m, 10);
    expect(v.damage).toBeCloseTo(18 * 1.4 * 1.05 * 1.2, 6);
  });

  it('dair can rehit a falling opponent', () => {
    const m = testMatch({ fighter: 'fireboy', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    placeInAir(m, 0, 30, 1);
    Object.assign(v, {
      pos: { x: 0, y: 22 },
      prevPos: { x: 0, y: 22 },
      ground: null,
      action: 'fall',
      vel: { x: 0, y: 0 },
    });
    v.intangible = 0;
    let hits = 0;
    let last = 0;
    runPorts(m, 1, [{ cy: -100 }, {}]);
    expect(a.move).toBe('dair');
    for (let i = 0; i < 60; i++) {
      runPorts(m, 1, [{}, {}]);
      if (v.damage > last) hits++;
      last = v.damage;
    }
    expect(hits).toBeGreaterThanOrEqual(3);
    expect(hits).toBeLessThanOrEqual(5);
  });

  it('dair can land all six hits when started on the rise', () => {
    const m = testMatch({ fighter: 'fireboy', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    placeInAir(m, 0, 60).vel.y = 1.5;
    Object.assign(v, {
      pos: { x: 0, y: 52 },
      prevPos: { x: 0, y: 52 },
      ground: null,
      action: 'fall',
      vel: { x: 0, y: 0 },
      intangible: 0,
    });
    run(m, 1, { cy: -100 });
    expect(a.move).toBe('dair');
    const hits: number[] = [];
    until(m, (f) => {
      if (m.events.some((e) => e.type === 'hit' && e.attacker === 0)) hits.push(f.actionFrame);
      return f.move !== 'dair';
    });
    expect(hits).toEqual([5, 7, 9, 11, 13, 23]);
    expect(v.damage).toBeCloseTo((1.4 * 5 + 5) * 1.05 * 1.2, 6);
  });

  it('up special rises well above a full hop, then leaves Fireboy helpless', () => {
    const m = fireboy();
    const f = m.fighters[0]!;
    const y0 = f.pos.y;
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    let top = y0;
    until(m, (g) => {
      top = Math.max(top, g.pos.y);
      return g.action === 'helpless';
    });
    expect(top - y0).toBeGreaterThan(40);
    until(m, (g) => g.ground !== null);
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(30);
  });

  it('Flame Jump carries a nearby opponent through all seven hits', () => {
    const m = testMatch({ fighter: 'fireboy', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    const pos = { x: a.pos.x + 6 * a.facing, y: a.pos.y };
    Object.assign(v, { pos, prevPos: { ...pos }, ground: a.ground, action: 'idle', intangible: 0 });
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(a.move).toBe('upB');
    const hits: number[] = [];
    until(m, (f) => {
      if (m.events.some((e) => e.type === 'hit' && e.attacker === 0)) hits.push(f.actionFrame);
      return f.move !== 'upB';
    });
    expect(hits).toEqual([3, 7, 9, 11, 13, 15, 17]);
    expect(v.damage).toBeCloseTo((5 + 0.6 * 5 + 3) * 1.05 * 1.2, 6);
  });

  it('up special out of a fast fall still rises and arcs, without fast-falling afterwards', () => {
    const m = fireboy();
    const f = placeInAir(m, 0, 60);
    run(m, 4);
    run(m, 1, { y: -100 });
    expect(f.fastFalling).toBe(true);
    run(m, 1);
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    expect(f.fastFalling).toBe(false);
    until(m, (g) => g.actionFrame === 30);
    expect(f.vel.y).toBeGreaterThan(0);
  });

  it('a C-stick resting inside the dead zone does not hold a smash charge; one held out does', () => {
    for (const [cx, charged] of [
      [10, false],
      [60, true],
    ] as const) {
      const m = fireboy();
      const f = m.fighters[0]!;
      run(m, 1, { cx: 100 });
      expect(f.move).toBe('fsmash');
      run(m, 20, { cx });
      expect(f.charge > 0).toBe(charged);
    }
  });
});

describe('Fireboy: launch direction', () => {
  /** P2 `offset` units in front of (or behind, when negative) P1, who is put into `move` facing right. */
  function launch(move: string, offset: number, air: boolean): number {
    const m = testMatch({ fighter: 'fireboy', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    if (air) placeInAir(m, 0, 30, 1);
    else a.facing = 1;
    Object.assign(v, {
      pos: { x: a.pos.x + offset, y: a.pos.y },
      prevPos: { x: a.pos.x + offset, y: a.pos.y },
      ground: air ? null : a.ground,
      action: air ? 'fall' : 'idle',
      vel: { x: 0, y: 0 },
      damage: 100,
    });
    v.intangible = 0;
    attack(m, 0, move);
    until(m, () => v.kb.x !== 0);
    return Math.sign(v.kb.x);
  }

  it('bair and the rear hit of dsmash launch backward', () => {
    expect(launch('bair', -8, true)).toBe(-1);
    expect(launch('dsmash', -8, false)).toBe(-1);
    expect(launch('dsmash', 8, false)).toBe(1);
  });

  it('nair sends a target behind Fireboy away from him', () => {
    expect(launch('nair', -3, true)).toBe(-1);
    expect(launch('nair', 3, true)).toBe(1);
  });
});

describe('Fireboy: grabs', () => {
  it('Grab or Shield + Attack is a standing grab, a dash grab out of a dash or run, and a shield grab from shield', () => {
    expect(moveFrom({ buttons: ['grab'] })).toBe('grab');
    expect(moveFrom({ buttons: ['shield', 'attack'] })).toBe('grab');
    expect(moveFrom({ x: 100, buttons: ['grab'] }, { hold: { x: 100 }, frames: 3 })).toBe('dashGrab');
    expect(moveFrom({ x: 100, buttons: ['grab'] }, { hold: { x: 100 }, frames: 20 })).toBe('dashGrab');
    const shield = { hold: { buttons: ['shield'] } as Hold, frames: 5 };
    expect(moveFrom({ buttons: ['shield', 'grab'] }, shield)).toBe('grab');
    expect(moveFrom({ buttons: ['shield', 'attack'] }, shield)).toBe('grab');
  });

  it('Grab with the stick held back out of a dash is a pivot grab: he turns round and keeps sliding', () => {
    const m = fireboy();
    const f = m.fighters[0]!;
    run(m, 3, { x: 100 });
    expect(f.action).toBe('dash');
    run(m, 1, { x: -100, buttons: ['grab'] });
    expect(f.move).toBe('pivotGrab');
    expect(f.facing).toBe(-1);
    expect(f.vel.x).toBeGreaterThan(0);
  });

  it('a whiffed grab plays out to its first actionable frame', () => {
    const m = fireboy();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['grab'] });
    let frames = 1;
    while (f.move === 'grab') {
      run(m, 1);
      frames++;
    }
    expect(frames).toBe(moves.grab!.faf);
    expect(f.action).toBe('idle');
  });

  it('the standing grab reaches about 12 units in front, like Mario', () => {
    const box = moves.grab!.hits[0]!.boxes[0]!;
    expect(box.grab).toBe(true);
    expect(box.x + box.radius).toBeCloseTo(ref.grab.grab_range_mario, 6);
  });
});

/** Fireboy (P1) holding a second Fireboy at `percent`, both on P1's ground 12 units apart; `x` places P1. */
function holding(percent = 0, x?: number, facing?: 1 | -1) {
  const m = testMatch({ fighter: 'fireboy', players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  if (x !== undefined) {
    Object.assign(a, { pos: { x, y: 0.5 }, prevPos: { x, y: 0.5 }, ground: null, action: 'fall' });
    runPorts(m, 10, [{}, {}]);
  }
  a.facing = facing ?? a.facing;
  const at = { x: a.pos.x + 12 * a.facing, y: a.pos.y };
  Object.assign(v, {
    pos: { ...at },
    prevPos: { ...at },
    ground: a.ground,
    action: 'idle',
    facing: -a.facing,
  });
  Object.assign(v, { intangible: 0, damage: percent });
  runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
  runPorts(m, 6, [{}, {}]);
  expect(v.action).toBe('grabbed');
  return { m, a, v };
}

describe('Fireboy: pummel and throws', () => {
  const inputs: [string, (facing: number) => Hold][] = [
    ['fthrow', (s) => ({ x: 100 * s })],
    ['bthrow', (s) => ({ x: -100 * s })],
    ['uthrow', () => ({ y: 100 })],
    ['dthrow', () => ({ y: -100 })],
    ['fthrow', (s) => ({ cx: 100 * s })],
    ['bthrow', (s) => ({ cx: -100 * s })],
    ['uthrow', () => ({ cy: 100 })],
    ['dthrow', () => ({ cy: -100 })],
    ['pummel', () => ({ buttons: ['attack'] })],
    ['pummel', () => ({ buttons: ['grab'] })],
  ];
  it.each(inputs)('%s from the hold', (move, hold) => {
    const { m, a } = holding();
    runPorts(m, 1, [hold(a.facing), {}]);
    expect(a.move).toBe(move);
  });

  it.each([
    ['fthrow', 8, inputs[0]![1]],
    ['bthrow', 11, inputs[1]![1]],
    ['uthrow', 7, inputs[2]![1]],
    ['dthrow', 5, inputs[3]![1]],
  ] as const)('%s deals %s%% (Mario-like) and lets go on its release frame', (move, damage, hold) => {
    const t = moves[move]!.throw!;
    expect(t.hit.damage).toBe(damage);
    expect(t.frame).toBeLessThan(moves[move]!.faf);
    const { m, a, v } = holding(50);
    runPorts(m, 1, [hold(a.facing), {}]);
    runPorts(m, t.frame - 2, [{}, {}]);
    expect(v.action).toBe('grabbed');
    runPorts(m, 1, [{}, {}]);
    expect(v.launch).not.toBeNull();
    expect(v.damage).toBeCloseTo(50 + damage * 1.05 * 1.2, 6);
  });

  it('back throw is the kill throw: from the ledge it KOs off the side at 130% where forward throw does not', () => {
    /** Thrown toward the right ledge from near it; true when the opponent crosses the side blast zone. */
    const ko = (move: 'fthrow' | 'bthrow') => {
      const { m, a, v } = holding(130, 66, move === 'fthrow' ? 1 : -1);
      runPorts(m, 1, [{ x: 100 }, {}]);
      expect(a.move).toBe(move);
      for (let i = 0; i < 300 && v.action !== 'ko'; i++) runPorts(m, 1, [{}, {}]);
      return v.action === 'ko' && v.pos.x > 240;
    };
    expect(ko('bthrow')).toBe(true);
    expect(ko('fthrow')).toBe(false);
  });

  it('down throw at 0% leaves Fireboy free to act before the opponent: a combo throw', () => {
    const { m, a, v } = holding(0);
    runPorts(m, 1, [{ y: -100 }, {}]);
    expect(a.move).toBe('dthrow');
    let fireboyFree = 0;
    let victimFree = 0;
    for (let i = 1; i < 120 && !victimFree; i++) {
      runPorts(m, 1, [{}, {}]);
      if (!fireboyFree && a.action === 'idle') fireboyFree = i;
      if (v.launch === null && v.hitstun <= 0 && v.action !== 'grabbed') victimFree = i;
    }
    expect(fireboyFree).toBeGreaterThan(0);
    expect(fireboyFree).toBeLessThan(victimFree);
  });
});

describe('Fireboy: 1-2-Kick jab chain', () => {
  const mash = (i: number, every = 8, until = 24): Hold =>
    i % every === 0 && i < until ? { buttons: ['attack'] } : {};

  it('Attack again inside each window chains jab -> jab2 -> jab3', () => {
    const m = fireboy();
    const f = m.fighters[0]!;
    const seen: string[] = [];
    for (let i = 0; i < 80; i++) {
      run(m, 1, mash(i));
      if (f.move && seen.at(-1) !== f.move) seen.push(f.move);
    }
    expect(seen).toEqual(['jab', 'jab2', 'jab3']);
  });

  it("a single press plays only the first punch and ends on Mario's first actionable frame", () => {
    const m = fireboy();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['attack'] });
    let frames = 1;
    while (f.move === 'jab') {
      run(m, 1, {});
      frames++;
    }
    expect(frames).toBe(20);
    expect(f.action).toBe('idle');
  });

  it('mashing lands all three hits on a standing opponent: 2.2 + 1.7 + 4.5, fresh (x1.05) and x1.2 in 1v1', () => {
    const m = testMatch({ fighter: 'fireboy', players: 2 });
    const [a, v] = m.fighters;
    Object.assign(v!, {
      pos: { x: a!.pos.x + 9 * a!.facing, y: a!.pos.y },
      ground: a!.ground,
      action: 'idle',
    });
    v!.intangible = 0;
    for (let i = 0; i < 100; i++) runPorts(m, 1, [mash(i, 4, 44), {}]);
    expect(v!.damage).toBeCloseTo((2.2 + 1.7 + 4.5) * 1.05 * 1.2, 6);
  });

  it("uses Mario's jab frame data", () => {
    expect([moves.jab!, moves.jab2!, moves.jab3!].map((j) => [j.hits[0]!.frames, j.faf])).toEqual([
      [[2, 3], 20],
      [[2, 3], 22],
      [[3, 4], 34],
    ]);
  });
});

describe('Fireboy: kill percents (koPercent: Mario at the Battlefield ledge, fresh, no DI)', () => {
  function atLedge(hit: KoSetup['hit'], air = false): number {
    const percent = koPercent({ hit, from: 'ledge', air });
    if (percent === null) throw new Error(`No KO threshold for ${JSON.stringify(hit)}`);
    return percent;
  }

  const ko = (move: string, air = false) => atLedge({ fighter: 'fireboy', move }, air);

  /**
   * Mario's hitboxes and SSBU-Calculator thresholds from ko.test.ts. Where roster damage differs, apply the KO
   * difference between the two raw damage values to the calculator threshold.
   */
  it.each([
    ['fsmash', { damage: 17.8, angle: 361, kbg: 99, bkb: 25 }, 18, 64.8, false],
    ['usmash', { damage: 14, angle: 83, kbg: 94, bkb: 32 }, 14, 124.5, false],
    ['bthrow', { damage: 11, angle: 45, kbg: 66, bkb: 70, direction: 'back' }, 11, 130.5, false],
    ['uthrow', { damage: 7, angle: 90, kbg: 72, bkb: 70 }, 7, 240.6, false],
    ['uair', { damage: 7, angle: 75, kbg: 135, bkb: 10 }, 7, 186.2, true],
  ] satisfies [string, KoHit, number, number, boolean][])(
    "%s KOs within 5 points of Mario's",
    (move, hit, damage, reference, air) => {
      const delta = hit.damage === damage ? 0 : atLedge({ ...hit, damage }, air) - atLedge(hit, air);
      expect(Math.abs(ko(move, air) - (reference + delta))).toBeLessThanOrEqual(5);
    },
  );

  it('at the ledge fsmash KOs earlier than bair, then usmash and bthrow', () => {
    const bair = ko('bair', true);
    const usmash = ko('usmash');
    expect(ko('fsmash')).toBeLessThan(bair);
    expect(bair).toBeLessThan(usmash);
    expect(usmash).toBeLessThan(ko('bthrow'));
  });
});
