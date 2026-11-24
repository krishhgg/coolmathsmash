import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { createMatch } from '../../sim/match';
import { attack, placeInAir, run, runPorts, testMatch, until } from '../../sim/testing/sim';
import { moves as fireboy } from '../fireboy/moves';
import type { MoveDef } from '../types';
import { moves } from './moves';

const watergirl = () => testMatch({ fighter: 'watergirl' });

/** Specials whose engine systems (projectiles, windboxes, reflectors) belong to COOL-3 and aren't on main yet. */
const PENDING_SPECIALS = ['neutralB', 'sideB'];

const NORMALS = ['jab', 'ftilt', 'utilt', 'dtilt', 'dashAttack', 'nair', 'fair', 'bair', 'dair'];
const SMASHES = ['fsmash', 'usmash', 'dsmash'];

const strongest = (m: MoveDef) => Math.max(...m.hits.flatMap((w) => w.boxes.map((b) => b.damage)));
/** How far in front of her (behind, for back hits) the move's boxes reach. */
const reach = (m: MoveDef) =>
  Math.max(...m.hits.flatMap((w) => w.boxes.map((b) => Math.abs(b.x) + b.radius)));

describe('Watergirl: move list', () => {
  it("has every move Fireboy has, under the same names, so the swap and the renderer's clips line up", () => {
    const expected = Object.keys(fireboy).filter((n) => !PENDING_SPECIALS.includes(n));
    expect(Object.keys(moves).sort()).toEqual(expected.sort());
  });

  it('splashes instead of burning: no hit or throw of hers sets fire', () => {
    for (const [name, move] of Object.entries(moves)) {
      for (const w of move.hits) for (const b of w.boxes) expect(b.effect, name).toBeUndefined();
      expect(move.throw?.hit.effect, name).toBeUndefined();
    }
  });
});

describe('Watergirl: frame data', () => {
  it.each([
    ['ftilt', 5],
    ['utilt', 5],
    ['dtilt', 5],
    ['dashAttack', 6],
    ['fsmash', 15],
    ['usmash', 9],
    ['dsmash', 5],
    ['nair', 3],
    ['fair', 12],
    ['bair', 6],
    ['uair', 4],
    ['dair', 5],
    ['upB', 6],
    ['grab', 6],
  ] as const)(
    '%s comes out on frame %i and every window closes before the first actionable frame',
    (name, first) => {
      const move = moves[name]!;
      expect(move.hits[0]!.frames[0]).toBe(first);
      for (const w of move.hits) expect(w.frames[1]).toBeLessThan(move.faf);
    },
  );

  it('fsmash is out on frames 15-17 exactly', () => {
    const m = watergirl();
    const f = m.fighters[0]!;
    run(m, 1, { x: 100, buttons: ['attack'] });
    expect(f.move).toBe('fsmash');
    const active: number[] = [];
    while (f.move === 'fsmash') {
      if (activeHitboxes(f).length > 0) active.push(f.actionFrame);
      run(m, 1);
    }
    expect(active).toEqual([15, 16, 17]);
    expect(f.action).toBe('idle');
  });

  it('dsmash hits in front first, then behind, and each side launches its own way', () => {
    const [front, back] = moves.dsmash!.hits;
    expect(front!.frames[1]).toBeLessThan(back!.frames[0]);
    expect(launch('dsmash', 9, false).x).toBeGreaterThan(0);
    expect(launch('dsmash', -9, false).x).toBeLessThan(0);
    expect(launch('bair', -9, true).x).toBeLessThan(0);
  });

  it('dair drills five times, then the last hit pops the opponent up', () => {
    const m = testMatch({ fighter: 'watergirl', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    placeInAir(m, 0, 30, 1);
    Object.assign(v, { pos: { x: 0, y: 22 }, prevPos: { x: 0, y: 22 }, ground: null, action: 'fall' });
    Object.assign(v, { vel: { x: 0, y: 0 }, intangible: 0 });
    runPorts(m, 1, [{ cy: -100 }, {}]);
    expect(a.move).toBe('dair');
    let hits = 0;
    let last = 0;
    for (let i = 0; i < 80 && (hits < 6 || v.launch !== null); i++) {
      runPorts(m, 1, [{}, {}]);
      if (v.damage > last) hits++;
      last = v.damage;
    }
    expect(hits).toBe(6);
    expect(v.kb.y).toBeGreaterThan(0);
  });
});

describe('Watergirl against Fireboy', () => {
  it.each([...NORMALS, ...SMASHES].filter((n) => n !== 'uair'))('%s hits for less than his', (name) => {
    expect(strongest(moves[name]!)).toBeLessThan(strongest(fireboy[name]!));
  });

  it('uair is the exception: the roster gives both twins 7%, hers covers more', () => {
    expect(strongest(moves.uair!)).toBe(strongest(fireboy.uair!));
    expect(reach(moves.uair!)).toBeGreaterThan(reach(fireboy.uair!));
  });

  it('her f-tilt reaches about 6 units further: an opponent 20 units away is hit by hers and not his', () => {
    expect(reach(moves.ftilt!) - reach(fireboy.ftilt!)).toBeCloseTo(6, 6);
    expect(launch('ftilt', 20, false, 'fireboy').damage).toBe(0);
    expect(launch('ftilt', 20, false).damage).toBeGreaterThan(0);
  });

  it('her fair is a longer sideways hit where his sweetspot meteors', () => {
    expect(reach(moves.fair!)).toBeGreaterThan(reach(fireboy.fair!));
    expect(moves.fair!.hits[0]!.frames[0]).toBeLessThan(fireboy.fair!.hits[0]!.frames[0]);
    expect(launch('fair', 9, true, 'fireboy').y).toBeLessThan(0);
    expect(launch('fair', 9, true).y).toBeGreaterThan(0);
    expect(launch('fair', 15, true).y).toBeGreaterThan(0);
  });

  it('up special rides about 20% higher than Flame Jump, then leaves her helpless', () => {
    const rise = (fighter: string) => {
      const m = testMatch({ fighter });
      const f = m.fighters[0]!;
      const y0 = f.pos.y;
      run(m, 1, { y: 100, buttons: ['special'] });
      expect(f.move).toBe('upB');
      let top = y0;
      until(m, (g) => {
        top = Math.max(top, g.pos.y);
        return g.action === 'helpless';
      });
      until(m, (g) => {
        top = Math.max(top, g.pos.y);
        return g.ground !== null;
      });
      expect(f.action).toBe('land');
      expect(f.landingLag).toBe(20);
      return top - y0;
    };
    const ratio = rise('watergirl') / rise('fireboy');
    expect(ratio).toBeGreaterThan(1.15);
    expect(ratio).toBeLessThan(1.25);
  });

  it('up special splashes an opponent above her with five weak hits', () => {
    const m = testMatch({ fighter: 'watergirl', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    const at = { x: a.pos.x, y: a.pos.y + 10 };
    Object.assign(v, {
      pos: { ...at },
      prevPos: { ...at },
      ground: null,
      action: 'fall',
      vel: { x: 0, y: 0 },
    });
    v.intangible = 0;
    runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
    expect(a.move).toBe('upB');
    const hits: number[] = [];
    for (let i = 0; i < 80; i++) {
      const before = v.damage;
      runPorts(m, 1, [{}, {}]);
      if (v.damage > before) hits.push(v.damage - before);
    }
    expect(hits).toHaveLength(5);
    for (const d of hits) expect(d).toBeLessThan(3);
  });
});

/**
 * Kill percents against the Mario reference at Battlefield's right ledge (fresh, no rage, no DI). The roster's
 * kill-% targets are retired, so these pin only the order of her moves, the order against Fireboy, and loose bounds.
 * TODO(COOL-3 #66): switch kos/koPercent below to koPercent from src/sim/testing/ko.ts once #66 merges.
 */
describe('Watergirl: kill power', () => {
  /** Each kill move with where the opponent stands from her (negative: behind) and how high both start. */
  const KILLS = {
    fsmash: [13.5, 0],
    usmash: [3, 0],
    dsmash: [-9, 0],
    ftilt: [15, 0],
    utilt: [3, 0],
    fair: [12, 6],
    bair: [-9, 6],
    nair: [3, 6],
  } as const;
  const ko = (move: keyof typeof KILLS, fighter = 'watergirl') => {
    const [distance, air] = KILLS[move];
    return koPercent(fighter, move, distance, air);
  };

  it.each(['fsmash', 'usmash', 'dsmash'] as const)('%s KOs later than Fireboy: he hits harder', (move) => {
    expect(ko(move)).toBeGreaterThan(ko(move, 'fireboy'));
  });

  it('fsmash is her strongest finisher, and every smash KOs before her tilts', () => {
    expect(ko('fsmash')).toBeLessThan(Math.min(ko('usmash'), ko('dsmash'), ko('fair'), ko('bair')));
    expect(Math.max(ko('fsmash'), ko('usmash'), ko('dsmash'))).toBeLessThan(
      Math.min(ko('ftilt'), ko('utilt')),
    );
  });

  it('bair KOs before nair; jab and dtilt are not kill moves by 200%', () => {
    expect(ko('bair')).toBeLessThan(ko('nair'));
    expect(kos('watergirl', 'jab', 7.5, 0, 200)).toBe(false);
    expect(kos('watergirl', 'dtilt', 10, 0, 200)).toBe(false);
  });

  it.each(Object.keys(KILLS) as (keyof typeof KILLS)[])('%s KOs somewhere between 40% and 220%', (move) => {
    expect(ko(move)).toBeGreaterThanOrEqual(40);
    expect(ko(move)).toBeLessThanOrEqual(220);
  });
});

describe('Watergirl: swap', () => {
  it('Fireboy -> Watergirl -> Fireboy: each twin plays their own moves on one damage %', () => {
    const m = testMatch({ fighter: 'fireboy' });
    const f = m.fighters[0]!;
    f.damage = 42;
    const ftiltBoxes = () => {
      attack(m, 0, 'ftilt');
      until(m, (g) => activeHitboxes(g).length > 0);
      const boxes = activeHitboxes(f).map((h) => h.box);
      until(m, (g) => g.action === 'idle');
      return boxes;
    };
    const swapTo = (fighter: string) => {
      run(m, 1, { y: -100, buttons: ['special'] });
      expect(f.move).toBe('downB');
      until(m, (g) => g.action === 'idle');
      expect(f).toMatchObject({ fighter, damage: 42 });
    };
    expect(ftiltBoxes()).toEqual(fireboy.ftilt!.hits[0]!.boxes);
    swapTo('watergirl');
    expect(ftiltBoxes()).toEqual(moves.ftilt!.hits[0]!.boxes);
    swapTo('fireboy');
    expect(ftiltBoxes()).toEqual(fireboy.ftilt!.hits[0]!.boxes);
  });
});

/**
 * `fighter` (Watergirl unless named) facing right does `move` on an opponent at 100% placed `offset` units in
 * front (behind when negative), both on the floor or both in the air; returns the opponent's launch and damage.
 */
function launch(move: string, offset: number, air: boolean, fighter = 'watergirl') {
  const m = testMatch({ fighter, players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  if (air) placeInAir(m, 0, 30, 1);
  else a.facing = 1;
  const at = { x: a.pos.x + offset, y: a.pos.y };
  Object.assign(v, {
    pos: { ...at },
    prevPos: { ...at },
    ground: air ? null : a.ground,
    action: air ? 'fall' : 'idle',
  });
  Object.assign(v, { vel: { x: 0, y: 0 }, damage: 100, intangible: 0 });
  attack(m, 0, move);
  for (let i = 0; i < 40 && v.kb.x === 0 && v.kb.y === 0; i++) runPorts(m, 1, [{}, {}]);
  return { x: v.kb.x, y: v.kb.y, damage: v.damage - 100 };
}

/** True when `move` from `fighter` KOs the Mario reference standing at Battlefield's right ledge from `percent`. */
function kos(fighter: string, move: string, distance: number, air: number, percent: number): boolean {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter }, { fighter: 'reference-mario' }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  const ground = a.ground;
  const place = (f: FighterState, x: number, facing: 1 | -1) =>
    Object.assign(f, {
      pos: { x, y: air },
      prevPos: { x, y: air },
      vel: { x: 0, y: 0 },
      ground: air > 0 ? null : ground,
      action: air > 0 ? 'fall' : 'idle',
      actionFrame: 1,
      facing,
      intangible: 0,
      jumpsUsed: air > 0 ? 1 : 0,
    });
  place(a, 78 - Math.abs(distance), distance >= 0 ? 1 : -1);
  place(v, 78, -1);
  v.damage = percent;
  attack(m, 0, move);
  for (let i = 0; i < 400; i++) {
    runPorts(m, 1, [{}, {}]);
    if (v.action === 'ko') return true;
    if (i > 60 && v.launch === null && v.hitstun <= 0 && v.kb.x === 0 && v.kb.y === 0) return false;
  }
  return false;
}

/** The lowest whole percent at which the move KOs (binary search over 0-400). */
function koPercent(fighter: string, move: string, distance: number, air: number): number {
  let lo = 0;
  let hi = 400;
  if (!kos(fighter, move, distance, air, hi)) return Infinity;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (kos(fighter, move, distance, air, mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
