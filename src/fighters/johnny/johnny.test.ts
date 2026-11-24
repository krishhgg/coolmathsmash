import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import type { HitWindow } from '../types';
import { moves } from './moves';
import { stats } from './stats';
import { kos } from './testing';

const johnny = () => testMatch({ fighter: 'johnny' });

/** The move started by `hold` (one frame) from standing still, or by `hold` after holding `before`. */
function moveFrom(hold: Hold, before?: { hold: Hold; frames: number }): string | null {
  const m = johnny();
  if (before) run(m, before.frames, before.hold);
  run(m, 1, hold);
  return m.fighters[0]!.move;
}

/** Plays `move` from frame 1 (grounded, or high in the air for aerials): its active frames and when it ends. */
function playOut(move: string): { active: number[]; ended: number } {
  const m = johnny();
  const f = moves[move]!.kind === 'aerial' ? placeInAir(m, 0, 120) : m.fighters[0]!;
  attack(m, 0, move);
  const active: number[] = [];
  let frame = 0;
  while (f.move === move) {
    run(m, 1);
    frame++;
    if (f.move === move && activeHitboxes(f).length > 0) active.push(f.actionFrame);
  }
  return { active, ended: frame };
}

describe('Johnny Upgrade: stats', () => {
  it("are Captain Falcon's, with the run a step below his (the roster's template)", () => {
    expect(stats).toMatchObject({
      weight: 104,
      walkSpeed: 0.987,
      dashInitialSpeed: 1.98,
      runSpeed: 2.4,
      airSpeed: 1.218,
      gravity: 0.12,
      fallSpeed: 1.865,
      fastFallSpeed: 2.984,
      jumps: 2,
      fullHopHeight: 37.31,
      shortHopHeight: 17.98,
      doubleJumpHeight: 37.31,
    });
    expect(stats.airAccelBase + stats.airAccelAdd).toBeCloseTo(0.075, 6);
  });

  it('a full hop peaks at his 37.31-unit full hop height and the run reaches 2.4 units a frame', () => {
    const m = johnny();
    const f = m.fighters[0]!;
    const y0 = f.pos.y;
    run(m, 1, { buttons: ['jump'] });
    let top = y0;
    until(
      m,
      (g) => {
        top = Math.max(top, g.pos.y);
        return g.vel.y < 0;
      },
      { buttons: ['jump'] },
    );
    expect(top - y0).toBeCloseTo(37.31, 0);
    const n = johnny();
    run(n, 30, { x: 100 });
    expect(n.fighters[0]!.action).toBe('run');
    expect(n.fighters[0]!.vel.x).toBeCloseTo(2.4, 6);
  });
});

describe('Johnny Upgrade: attack inputs', () => {
  it('jab, tilts and smashes come from Attack with no, a held, or a just-tapped direction', () => {
    expect(moveFrom({ buttons: ['attack'] })).toBe('jab');
    expect(moveFrom({ x: 100, buttons: ['attack'] })).toBe('fsmash');
    expect(moveFrom({ y: 100, buttons: ['attack'] })).toBe('usmash');
    expect(moveFrom({ y: -100, buttons: ['attack'] })).toBe('dsmash');
    expect(moveFrom({ x: 50, buttons: ['attack'] }, { hold: { x: 50 }, frames: 8 })).toBe('ftilt');
    expect(moveFrom({ y: 50, buttons: ['attack'] }, { hold: { y: 50 }, frames: 8 })).toBe('utilt');
    expect(moveFrom({ y: -60, buttons: ['attack'] }, { hold: { y: -60 }, frames: 8 })).toBe('dtilt');
    expect(moveFrom({ x: 100, buttons: ['attack'] }, { hold: { x: 100 }, frames: 20 })).toBe('dashAttack');
  });

  it('aerials follow the stick relative to facing', () => {
    const aerial = (hold: Hold) => {
      const m = johnny();
      const f = placeInAir(m, 0, 40, 1);
      run(m, 1, hold);
      return f.move;
    };
    expect(aerial({ buttons: ['attack'] })).toBe('nair');
    expect(aerial({ x: 100, buttons: ['attack'] })).toBe('fair');
    expect(aerial({ x: -100, buttons: ['attack'] })).toBe('bair');
    expect(aerial({ y: 100, buttons: ['attack'] })).toBe('uair');
    expect(aerial({ y: -100, buttons: ['attack'] })).toBe('dair');
  });

  it('Grab is a standing grab, a dash grab out of a run and a pivot grab with the stick back', () => {
    expect(moveFrom({ buttons: ['grab'] })).toBe('grab');
    expect(moveFrom({ x: 100, buttons: ['grab'] }, { hold: { x: 100 }, frames: 20 })).toBe('dashGrab');
    expect(moveFrom({ x: -100, buttons: ['grab'] }, { hold: { x: 100 }, frames: 3 })).toBe('pivotGrab');
  });
});

/** The roster's sheet (handoffs/research/roster.md, Johnny Upgrade): first active frame and damage of each hit. */
const ROSTER: [move: string, startup: number, damage: number[]][] = [
  ['jab', 3, [1.5]],
  ['jab2', 4, [1]],
  ['jab3', 3, [0.5, 0.5, 0.5, 0.5, 2]],
  ['ftilt', 7, [9]],
  ['utilt', 14, [11]],
  ['dtilt', 10, [10]],
  ['dashAttack', 7, [10]],
  ['fsmash', 18, [19]],
  ['usmash', 14, [6, 11]],
  ['dsmash', 16, [15]],
  ['nair', 7, [7, 8]],
  ['fair', 14, [20]],
  ['bair', 10, [13]],
  ['uair', 6, [8]],
  ['dair', 16, [14]],
  ['grab', 7, [0]],
];

describe('Johnny Upgrade: frame data', () => {
  it.each(ROSTER)('%s comes out on frame %i with the roster damage', (move, startup, damage) => {
    const def = moves[move]!;
    expect(def.hits[0]!.frames[0]).toBe(startup);
    const strongest = (w: number) => Math.max(...def.hits[w]!.boxes.map((b) => b.damage));
    if (damage.length > 1) expect(damage.map((_, i) => strongest(i))).toEqual(damage);
    else expect(strongest(0)).toBe(damage[0]);
    const { active, ended } = playOut(move);
    expect(active[0]).toBe(startup);
    expect(active).toEqual(def.hits.flatMap((w) => range(w.frames[0], w.frames[1])));
    expect(ended).toBe(def.faf);
  });

  it("throws deal the roster's damage and the pummel 1.3%", () => {
    const dmg = (move: string) => moves[move]!.throw!.hit.damage;
    expect([dmg('fthrow'), dmg('bthrow'), dmg('uthrow'), dmg('dthrow')]).toEqual([8, 10, 7, 7]);
    expect(moves.pummel!.pummel!.damage).toBe(1.3);
  });

  it("the knee's sweetspot is its first active frame only, with heavy hitlag; the rest is a weak 6%", () => {
    const [sweet, late] = moves.fair!.hits as [HitWindow, HitWindow];
    expect(sweet.frames).toEqual([14, 14]);
    expect(sweet.boxes[0]).toMatchObject({ id: 0, damage: 20, hitlag: 1.5 });
    expect(sweet.boxes[1]!.damage).toBe(6);
    expect(late.boxes.every((b) => b.damage === 6)).toBe(true);
  });

  it('dair meteors: its sole sends straight down', () => {
    expect(moves.dair!.hits[0]!.boxes[0]!.angle).toBe(270);
  });
});

/**
 * The roster's "kill ~N%": the move KOs the Mario reference (98) from Battlefield's ledge, fresh, without rage or
 * DI. Each one must KO at N + 5% and not at N - 5%.
 */
const KILLS: [move: string, percent: number][] = [
  ['fsmash', 80],
  ['fair', 90],
  ['dsmash', 105],
  ['usmash', 110],
  ['bair', 125],
  ['bthrow', 165],
];

describe('Johnny Upgrade: kill percents', () => {
  it.each(KILLS)('%s KOs from the ledge at about %i%%', (move, percent) => {
    expect(kos(move, percent + 5)).toBe(true);
    expect(kos(move, percent - 5)).toBe(false);
  });

  it('the jab, tilts and forward throw are not kill moves at 120%', () => {
    for (const move of ['jab', 'ftilt', 'dtilt', 'dashAttack', 'fthrow', 'uthrow', 'dthrow'])
      expect(kos(move, 120), move).toBe(false);
  });
});

describe('Johnny Upgrade: One-Two into Rush', () => {
  /** Johnny with a second Johnny standing 9 units in front of him; `press(i)` says when frame i presses Attack. */
  function rush(press: (i: number) => boolean, frames: number) {
    const m = testMatch({ fighter: 'johnny', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    const at = { x: a.pos.x + 9 * a.facing, y: a.pos.y };
    Object.assign(v, {
      pos: { ...at },
      prevPos: { ...at },
      ground: a.ground,
      action: 'idle',
      facing: -a.facing,
    });
    v.intangible = 0;
    const started: string[] = [];
    for (let i = 0; i < frames; i++) {
      runPorts(m, 1, [press(i) ? { buttons: ['attack'] } : {}, {}]);
      for (const e of m.events) if (e.type === 'move' && e.port === 0) started.push(e.move);
    }
    return { a, v, started };
  }

  it('Attack three times throws jab, jab2 and the Rush', () => {
    const { started } = rush((i) => i === 0 || i === 6 || i === 18, 60);
    expect(started).toEqual(['jab', 'jab2', 'jab3']);
  });

  it('mashing Attack keeps the Rush going; letting go ends it with the finishing punch, which sends them away', () => {
    const { a, v, started } = rush((i) => i < 90 && i % 4 === 0, 160);
    expect(started.slice(0, 2)).toEqual(['jab', 'jab2']);
    expect(started.filter((s) => s === 'jab3').length).toBeGreaterThanOrEqual(4);
    expect(a.action).toBe('idle');
    expect(Math.abs(v.pos.x - a.pos.x)).toBeGreaterThan(25);
  });

  it('holding Attack through the Rush keeps it going until he lets go', () => {
    const press = (i: number) => i === 0 || i === 6 || (i >= 18 && i < 110);
    const held = rush(press, 110);
    expect(held.started).toEqual(['jab', 'jab2', 'jab3']);
    expect(held.a.move).toBe('jab3');
    const flurry = held.v.damage;
    expect(flurry).toBeGreaterThan((1.5 + 1 + 0.5 * 12) * 1.2);
    const done = rush(press, 170);
    expect(done.a.action).toBe('idle');
    expect(Math.abs(done.v.pos.x - done.a.pos.x)).toBeGreaterThan(25);
  });

  it('a single press is just the first punch', () => {
    const { a, started } = rush((i) => i === 0, 40);
    expect(started).toEqual(['jab']);
    expect(a.action).toBe('idle');
  });
});

describe('Johnny Upgrade: specials', () => {
  it('side special winds up, bursts about 45 units forward and punches on frames 16-19', () => {
    const m = johnny();
    const f = m.fighters[0]!;
    const x0 = f.pos.x;
    run(m, 1, { x: 100 * f.facing, buttons: ['special'] });
    expect(f.move).toBe('sideB');
    const active: number[] = [];
    until(m, (g) => {
      if (activeHitboxes(g).length > 0) active.push(g.actionFrame);
      return g.move !== 'sideB';
    });
    expect(active).toEqual([16, 17, 18, 19]);
    expect((f.pos.x - x0) * f.facing).toBeGreaterThan(40);
    expect(moves.sideB!.hits[0]!.boxes[0]!.damage).toBe(10);
  });

  it('side special in the air flies level through the dash and ends helpless', () => {
    const m = johnny();
    const f = placeInAir(m, 0, 80, 1);
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f.move).toBe('sideB');
    run(m, 17);
    expect(f.pos.y).toBeGreaterThan(78);
    expect(f.pos.x).toBeGreaterThan(30);
    until(m, (g) => g.move !== 'sideB');
    expect(f.action).toBe('helpless');
  });

  it('up special kicks on frame 8, rises about 95 units, then leaves him helpless with 24 frames of landing lag', () => {
    const m = johnny();
    const f = m.fighters[0]!;
    const y0 = f.pos.y;
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    let top = y0;
    const active: number[] = [];
    until(m, (g) => {
      top = Math.max(top, g.pos.y);
      if (activeHitboxes(g).length > 0) active.push(g.actionFrame);
      return g.action === 'helpless';
    });
    expect(active[0]).toBe(8);
    expect(moves.upB!.hits.map((w) => w.boxes[0]!.damage)).toEqual([4, 8]);
    until(m, (g) => {
      top = Math.max(top, g.pos.y);
      return g.vel.y < 0;
    });
    expect(top - y0).toBeGreaterThan(88);
    expect(top - y0).toBeLessThan(100);
    until(m, (g) => g.ground !== null);
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(24);
  });

  it('the up special kick carries a standing opponent into the uppercut', () => {
    for (const percent of [0, 60, 120]) {
      const m = testMatch({ fighter: 'johnny', players: 2 });
      const [a, v] = m.fighters as [FighterState, FighterState];
      const at = { x: a.pos.x + 6 * a.facing, y: a.pos.y };
      Object.assign(v, {
        pos: { ...at },
        prevPos: { ...at },
        ground: a.ground,
        action: 'idle',
        facing: -a.facing,
      });
      Object.assign(v, { intangible: 0, damage: percent });
      runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
      const hits: number[] = [];
      for (let i = 0; i < 40; i++) {
        runPorts(m, 1, [{}, {}]);
        for (const e of m.events) if (e.type === 'hit' && e.attacker === 0) hits.push(a.actionFrame);
      }
      expect(hits, `at ${percent}%`).toEqual([8, 14]);
    }
  });

  it('up special from 60 units below the ledge recovers to it', () => {
    const m = johnny();
    const f = placeInAir(m, 92, -60, -1);
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    until(m, (g) => g.action === 'ledgeHang' || g.action === 'ledgeCatch' || g.pos.y < -100, { x: -40 });
    expect(f.pos.y).toBeGreaterThan(-100);
  });
});

describe('Johnny Upgrade: combo throws', () => {
  it.each([
    ['uthrow', { y: 100 }],
    ['dthrow', { y: -100 }],
  ] as const)('%s at 0%% leaves Johnny free to act before the opponent', (move, hold) => {
    const m = testMatch({ fighter: 'johnny', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    const at = { x: a.pos.x + 12 * a.facing, y: a.pos.y };
    Object.assign(v, {
      pos: { ...at },
      prevPos: { ...at },
      ground: a.ground,
      action: 'idle',
      facing: -a.facing,
    });
    v.intangible = 0;
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, 8, [{}, {}]);
    expect(v.action).toBe('grabbed');
    runPorts(m, 1, [hold, {}]);
    expect(a.move).toBe(move);
    let johnnyFree = 0;
    let victimFree = 0;
    for (let i = 1; i < 120 && !victimFree; i++) {
      runPorts(m, 1, [{}, {}]);
      if (!johnnyFree && a.action === 'idle') johnnyFree = i;
      if (v.launch === null && v.hitstun <= 0 && v.action !== 'grabbed') victimFree = i;
    }
    expect(johnnyFree).toBeGreaterThan(0);
    expect(johnnyFree).toBeLessThan(victimFree);
  });
});

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
