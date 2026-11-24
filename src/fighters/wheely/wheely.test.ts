import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { attack, placeInAir, run, runPorts, testMatch, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { stats } from './stats';

/** Wheely (P1) against the Mario reference (P2) on Battlefield, settled on the ground. */
function duel(): MatchState {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'wheely' }, { fighter: 'reference-mario' }],
  });
  runPorts(m, 10, [{}, {}]);
  return m;
}

/** Steps until P2's launch has carried it past a side or top blast zone (true) or died out (false). */
function launchKos(m: MatchState, v: FighterState, before: number): boolean {
  let hit = false;
  for (let i = 0; i < 500; i++) {
    runPorts(m, 1, [{}, {}]);
    if (v.damage > before) hit = true;
    if (v.action === 'ko') return Math.abs(v.pos.x) > 200 || v.pos.y > 150;
    if (hit && v.hitlag <= 0 && v.launch === null && Math.hypot(v.kb.x, v.kb.y) < 0.01) return false;
  }
  throw new Error('the move never connected');
}

/**
 * Mario at the right ledge of Battlefield at \`percent\`, hit by \`move\` from Wheely \`gap\` units away: grounded and
 * facing the ledge, or (\`air\`) in the air at the ledge's height facing away for a back aerial.
 */
function kos(move: string, percent: number, gap: number, air = false): boolean {
  const m = duel();
  const [a, v] = m.fighters as [FighterState, FighterState];
  const y = air ? 8 : a.pos.y;
  const x = 76 - gap;
  Object.assign(a, { pos: { x, y }, prevPos: { x, y }, vel: { x: 0, y: 0 } });
  a.facing = air ? -1 : 1;
  if (air) Object.assign(a, { ground: null, action: 'fall', jumpsUsed: 1 });
  Object.assign(v, {
    pos: { x: 76, y },
    prevPos: { x: 76, y },
    vel: { x: 0, y: 0 },
    ground: air ? null : a.ground,
    action: air ? 'fall' : 'idle',
    damage: percent,
    intangible: 0,
  });
  attack(m, 0, move);
  return launchKos(m, v, percent);
}

/** Wheely holding Mario at \`percent\` near the right ledge, throwing toward it. */
function throwKos(move: 'fthrow' | 'bthrow', percent: number): boolean {
  const m = duel();
  const [a, v] = m.fighters as [FighterState, FighterState];
  Object.assign(a, { pos: { x: 64, y: 0.5 }, prevPos: { x: 64, y: 0.5 }, ground: null, action: 'fall' });
  runPorts(m, 10, [{}, {}]);
  a.facing = move === 'bthrow' ? -1 : 1;
  const at = { x: a.pos.x + 13 * a.facing, y: a.pos.y };
  Object.assign(v, { pos: { ...at }, prevPos: { ...at }, ground: a.ground, action: 'idle', intangible: 0 });
  v.damage = percent;
  runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
  runPorts(m, 10, [{}, {}]);
  expect(v.action).toBe('grabbed');
  runPorts(m, 1, [{ x: 100 }, {}]);
  expect(a.move).toBe(move);
  return launchKos(m, v, percent);
}

describe('Wheely: horn jab', () => {
  it('Attack three times is Beep, Beep, HONK for 2 + 2 + 4', () => {
    const m = duel();
    const [a, v] = m.fighters as [FighterState, FighterState];
    const at = { x: a.pos.x + 12 * a.facing, y: a.pos.y };
    Object.assign(v, { pos: { ...at }, prevPos: { ...at }, ground: a.ground, action: 'idle', intangible: 0 });
    const seen: string[] = [];
    for (let i = 0; i < 60; i++) {
      runPorts(m, 1, [i % 8 === 0 && i < 24 ? { buttons: ['attack'] } : {}, {}]);
      if (a.move && seen[seen.length - 1] !== a.move) seen.push(a.move);
    }
    expect(seen).toEqual(['jab', 'jab2', 'jab3']);
    expect(v.damage).toBeCloseTo((2 + 2 + 4) * 1.2 * 1.05, 6);
  });
});

describe('Wheely: car handling', () => {
  it('starts slow and builds to top speed over the first 40 frames of the run', () => {
    const m = testMatch({ fighter: 'wheely' });
    const f = m.fighters[0]!;
    run(m, 1, { x: 100 });
    expect(f.action).toBe('dash');
    expect(Math.abs(f.vel.x)).toBeCloseTo(stats.dashInitialSpeed, 6);
    let frames = 0;
    while (f.action !== 'run') run(m, 1, { x: 100 });
    while (Math.abs(f.vel.x) < stats.runSpeed - 1e-9) {
      run(m, 1, { x: 100 });
      frames++;
    }
    expect(frames).toBeGreaterThanOrEqual(38);
    expect(frames).toBeLessThanOrEqual(42);
  });
});

/** [move, damage of the strongest box, first active frame], from the roster sheet. */
const FRAME_DATA: [string, number, number][] = [
  ['jab', 2, 3],
  ['jab2', 2, 3],
  ['jab3', 4, 4],
  ['ftilt', 9, 7],
  ['utilt', 8, 6],
  ['dtilt', 6, 5],
  ['dashAttack', 11, 8],
  ['fsmash', 17, 16],
  ['usmash', 14, 12],
  ['dsmash', 13, 11],
  ['nair', 9, 6],
  ['fair', 12, 10],
  ['bair', 13, 9],
  ['uair', 9, 7],
  ['dair', 13, 13],
  ['grab', 0, 9],
];

describe('Wheely: frame data', () => {
  it.each(FRAME_DATA)('%s: %s damage from frame %s', (move, damage, first) => {
    const m = testMatch({ fighter: 'wheely' });
    const f = moves[move]!.kind === 'aerial' ? placeInAir(m, 0, 60) : m.fighters[0]!;
    attack(m, 0, move);
    let seen = 0;
    let strongest = 0;
    for (let i = 0; i < moves[move]!.faf && !seen; i++) {
      run(m, 1);
      const boxes = activeHitboxes(f);
      if (boxes.length === 0) continue;
      seen = f.actionFrame;
      strongest = Math.max(...boxes.map((b) => b.box.damage));
    }
    expect(seen).toBe(first);
    expect(strongest).toBe(damage);
  });

  it.each([
    ['fthrow', 9],
    ['bthrow', 11],
    ['uthrow', 9],
    ['dthrow', 7],
  ] as const)('%s: %s damage', (move, damage) => {
    expect(moves[move]!.throw!.hit.damage).toBe(damage);
  });

  it('pummel is a 1.5% door slam', () => {
    expect(moves.pummel!.pummel!.damage).toBe(1.5);
  });

  it('the door scoop reaches further than Mario, as a heavy grab should', () => {
    const box = moves.grab!.hits[0]!.boxes[0]!;
    expect(box.x + box.radius).toBeGreaterThan(12);
  });

  it('forward smash lunges him forward', () => {
    const m = testMatch({ fighter: 'wheely' });
    const f = m.fighters[0]!;
    const x0 = f.pos.x;
    attack(m, 0, 'fsmash');
    run(m, 20);
    expect((f.pos.x - x0) * f.facing).toBeGreaterThan(8);
  });
});

describe('Wheely: kill percents (Mario at the Battlefield ledge, fresh, no DI)', () => {
  it.each([
    ['fsmash', 95, 10, false],
    ['usmash', 115, 3, false],
    ['bair', 135, 12, true],
  ] as const)('%s KOs at about %s percent', (move, percent, gap, air) => {
    expect(kos(move, percent + 5, gap, air)).toBe(true);
    expect(kos(move, percent - 10, gap, air)).toBe(false);
  });

  it('back throw is the kill throw: it KOs at about 150% and forward throw does not', () => {
    expect(throwKos('bthrow', 155)).toBe(true);
    expect(throwKos('bthrow', 140)).toBe(false);
    expect(throwKos('fthrow', 155)).toBe(false);
  });
});

describe('Wheely: launch directions', () => {
  /** Where \`move\` sends Mario standing (or floating) \`offset\` units in front of Wheely, who faces right. */
  function launch(move: string, offset: number, dy = 0): { x: number; y: number } {
    const m = duel();
    const [a, v] = m.fighters as [FighterState, FighterState];
    a.facing = 1;
    if (dy) placeInAir(m, 0, 40, 1);
    Object.assign(v, {
      pos: { x: a.pos.x + offset, y: a.pos.y + dy },
      prevPos: { x: a.pos.x + offset, y: a.pos.y + dy },
      ground: dy ? null : a.ground,
      action: dy ? 'fall' : 'idle',
      vel: { x: 0, y: 0 },
      damage: 100,
      intangible: 0,
    });
    attack(m, 0, move);
    for (let i = 0; i < 80 && v.kb.x === 0 && v.kb.y === 0; i++) runPorts(m, 1, [{}, {}]);
    return { x: Math.sign(v.kb.x), y: Math.sign(v.kb.y) };
  }

  it('down smash spins out on both sides, each side launching away', () => {
    expect(launch('dsmash', 10).x).toBe(1);
    expect(launch('dsmash', -10).x).toBe(-1);
  });

  it('down air meteors a target under the wheels', () => {
    expect(launch('dair', 0, -6).y).toBe(-1);
  });

  it('up tilt pops the target up for juggles', () => {
    expect(launch('utilt', 8).y).toBe(1);
  });
});

describe('Wheely: grabs', () => {
  const holdFor: Record<string, (s: number) => Hold> = {
    fthrow: (s) => ({ x: 100 * s }),
    bthrow: (s) => ({ x: -100 * s }),
    uthrow: () => ({ y: 100 }),
    dthrow: () => ({ y: -100 }),
  };

  it.each(Object.keys(holdFor))('%s comes out of the hold', (move) => {
    const m = duel();
    const [a, v] = m.fighters as [FighterState, FighterState];
    const at = { x: a.pos.x + 12 * a.facing, y: a.pos.y };
    Object.assign(v, { pos: { ...at }, prevPos: { ...at }, ground: a.ground, action: 'idle', intangible: 0 });
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, 10, [{}, {}]);
    expect(v.action).toBe('grabbed');
    runPorts(m, 1, [holdFor[move]!(a.facing), {}]);
    expect(a.move).toBe(move);
  });
});

describe('Wheely: specials', () => {
  it('Charge Through (side special) floors it about 50 units and hits for 10% on the way', () => {
    const m = duel();
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(a, { pos: { x: -40, y: 0 }, prevPos: { x: -40, y: 0 } });
    a.facing = 1;
    Object.assign(v, {
      pos: { x: -10, y: 0 },
      prevPos: { x: -10, y: 0 },
      ground: a.ground,
      action: 'idle',
      intangible: 0,
    });
    runPorts(m, 1, [{ x: 100, buttons: ['special'] }, {}]);
    expect(a.move).toBe('sideB');
    while (a.move === 'sideB') runPorts(m, 1, [{}, {}]);
    expect(a.pos.x + 40).toBeGreaterThan(45);
    expect(v.damage).toBeCloseTo(10 * 1.05 * 1.2, 6);
  });

  it('Charge Through in the air drives level, then leaves him helpless', () => {
    const m = testMatch({ fighter: 'wheely' });
    const f = placeInAir(m, -160, 60, 1);
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f.move).toBe('sideB');
    run(m, 13);
    const y = f.pos.y;
    run(m, 15);
    expect(f.pos.y).toBeCloseTo(y, 6);
    while (f.move === 'sideB') run(m, 1);
    expect(f.action).toBe('helpless');
  });

  it('Ramp Jump (up special) launches on a long diagonal, then leaves him helpless', () => {
    const m = testMatch({ fighter: 'wheely' });
    const f = m.fighters[0]!;
    const start = { ...f.pos };
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    let top = start.y;
    let reach = 0;
    while (f.vel.y > 0 || f.actionFrame < 10) {
      run(m, 1);
      top = Math.max(top, f.pos.y);
      reach = Math.hypot(f.pos.x - start.x, f.pos.y - start.y);
    }
    expect(top - start.y).toBeGreaterThan(55);
    expect(reach).toBeGreaterThan(80);
    expect(reach).toBeLessThan(110);
    while (f.move === 'upB') run(m, 1);
    expect(f.action).toBe('helpless');
  });

  it('Ramp Jump recovers to the ledge from below and beside the stage', () => {
    const m = testMatch({ fighter: 'wheely' });
    const f = placeInAir(m, 125, -50, -1);
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    for (let i = 0; i < 120 && f.action !== 'ledgeCatch' && f.action !== 'ledgeHang' && !f.ground; i++)
      run(m, 1, { x: -100 });
    expect(['ledgeCatch', 'ledgeHang', 'land', 'idle']).toContain(f.action);
  });
});
