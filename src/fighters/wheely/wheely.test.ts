import { describe, expect, it } from 'vitest';
import { activeHitboxes, hurtbox } from '../../sim/combat/hits';
import { TURN_FLIP, TURN_FRAMES } from './actions';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
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
  it('turning round at speed is a three-point turn: brake, swing round on frame 12, pull away by frame 20', () => {
    const m = testMatch({ fighter: 'wheely', x: -60 });
    const f = m.fighters[0]!;
    run(m, 60, { x: 100 });
    expect(f.action).toBe('run');
    const facing: number[] = [];
    run(m, 1, { x: -100 });
    while (f.action === 'turn') {
      facing[f.actionFrame - 1] = f.facing;
      run(m, 1, { x: -100 });
    }
    expect(facing.length).toBe(TURN_FRAMES - 1);
    expect(facing.indexOf(-1) + 1).toBe(TURN_FLIP);
    expect(f.action).toBe('run');
    expect(f.vel.x).toBeCloseTo(-stats.dashInitialSpeed, 1);
  });

  it('his body is a lying capsule from bumper to bumper', () => {
    const m = testMatch({ fighter: 'wheely' });
    const f = m.fighters[0]!;
    const body = hurtbox(f, stats);
    expect(body.r).toBeCloseTo(stats.height / 2, 6);
    expect((body.hw ?? 0) + body.r).toBeCloseTo(9, 6);
  });

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
    ['fsmash', 'Mario fsmash', { damage: 17.8, angle: 361, kbg: 99, bkb: 25 }],
    ['usmash', 'Mario usmash', { damage: 14, angle: 83, kbg: 94, bkb: 32 }],
    ['dsmash', 'Little Mac dsmash', { damage: 13, angle: 30, kbg: 94, bkb: 25 }],
    ['bthrow', 'King K. Rool bthrow', { damage: 11, angle: 35, kbg: 56, bkb: 70, direction: 'back' }],
    ['fthrow', 'Ridley fthrow', { damage: 9, angle: 42, kbg: 56, bkb: 60 }],
  ] as const)('%s KOs within 5 points of %s', (move, _analogue, hit) => {
    const ko = koPercent({ hit: { fighter: 'wheely', move } });
    const analogue = koPercent({ hit });
    expect(ko).not.toBeNull();
    expect(analogue).not.toBeNull();
    expect(Math.abs(ko! - analogue!)).toBeLessThanOrEqual(5);
  });

  it('back aerial uses Wario bair knockback, with 13% damage instead of 12%', () => {
    const hit = { angle: 361, kbg: 106, bkb: 21, direction: 'back' } as const;
    const ko = koPercent({ hit: { fighter: 'wheely', move: 'bair' }, air: true });
    const damageMatched = koPercent({ hit: { ...hit, damage: 13 }, air: true });
    expect(ko).not.toBeNull();
    expect(damageMatched).not.toBeNull();
    expect(Math.abs(ko! - damageMatched!)).toBeLessThanOrEqual(5);
    expect(ko).toBeLessThan(koPercent({ hit: { ...hit, damage: 12 }, air: true })!);
  });

  it('forward smash kills earliest, then back aerial, then up smash', () => {
    const ko = (move: string, air = false) => koPercent({ hit: { fighter: 'wheely', move }, air })!;
    expect(ko('fsmash')).toBeLessThan(ko('bair', true));
    expect(ko('bair', true)).toBeLessThan(ko('usmash'));
    expect(ko('usmash')).toBeLessThan(ko('ftilt'));
  });

  it('back throw is the kill throw, well ahead of forward and up throw', () => {
    const ko = (move: string) => koPercent({ hit: { fighter: 'wheely', move } })!;
    expect(ko('bthrow')).toBeLessThan(ko('fthrow') - 40);
    expect(ko('fthrow')).toBeLessThan(ko('uthrow'));
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
