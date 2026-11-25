import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { koPercent, type KoHit, type KoSetup } from '../../sim/testing/ko';
import { attack, placeInAir, run, runPorts, testMatch, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { TIP_DISTANCE } from './tip';
import { stats } from './stats';

const block = () => testMatch({ fighter: 'bloxorz' });

/** The move started by `hold` (one frame) from standing still, or by `hold` after holding `before`. */
function moveFrom(hold: Hold, before?: { hold: Hold; frames: number }): string | null {
  const m = block();
  if (before) run(m, before.frames, before.hold);
  run(m, 1, hold);
  return m.fighters[0]!.move;
}

/** Action frames on which `move` has hitboxes out, played from standing (or in the air for aerials). */
function activeFrames(move: string): number[] {
  const m = block();
  const f = moves[move]!.kind === 'aerial' ? placeInAir(m, 0, 80) : m.fighters[0]!;
  attack(m, 0, move);
  const active: number[] = [];
  for (let i = 0; i < 120 && (f.move === move || i === 0); i++) {
    run(m, 1);
    if (f.move === move && activeHitboxes(f).length > 0) active.push(f.actionFrame);
  }
  return active;
}

/** P2 (the block) `offset` units in front of P1, both on the ground; returns both after `move` connects. */
function hitWith(move: string, offset: number, percent = 0) {
  const m = testMatch({ fighter: 'bloxorz', players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  Object.assign(a, { pos: { x: -30, y: 0 }, prevPos: { x: -30, y: 0 }, facing: 1, action: 'idle' });
  Object.assign(v, {
    pos: { x: -30 + offset, y: 0 },
    prevPos: { x: -30 + offset, y: 0 },
    action: 'idle',
    damage: percent,
    intangible: 0,
  });
  attack(m, 0, move);
  return { m, a, v };
}

describe('Bloxorz block: stats', () => {
  it('is a super-heavy on the roster sheet templates: Dedede weight and run, Ganondorf gravity and jumps', () => {
    expect(stats.weight).toBe(127);
    expect([stats.walkSpeed, stats.dashInitialSpeed, stats.runSpeed]).toEqual([0.9, 1.5, 1.496]);
    expect(stats.airSpeed).toBe(0.735);
    expect(stats.airAccelBase + stats.airAccelAdd).toBeCloseTo(0.04, 9);
    expect([stats.gravity, stats.fallSpeed, stats.fastFallSpeed]).toEqual([0.108, 1.95, 3.12]);
    expect([stats.fullHopHeight, stats.shortHopHeight, stats.doubleJumpHeight]).toEqual([25.49, 12.24, 26]);
    expect(stats.jumps).toBe(2);
  });

  it('stands as two 12-unit cubes, one on the other', () => {
    expect([stats.width, stats.height]).toEqual([12, 24]);
  });
});

describe('Bloxorz block: attack inputs', () => {
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
      const m = block();
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
});

describe('Bloxorz block: frame data (roster sheet)', () => {
  /** Move, first active frame and damage of its strongest hit, from the roster sheet's moveset table. */
  const SHEET: [string, number, number][] = [
    ['jab', 5, 3],
    ['jab2', 6, 4],
    ['ftilt', 12, 11],
    ['utilt', 9, 9],
    ['dtilt', 8, 7],
    ['dashAttack', 10, 4],
    ['fsmash', 20, 20],
    ['usmash', 14, 17],
    ['dsmash', 13, 15],
    ['nair', 8, 10],
    ['fair', 11, 12],
    ['bair', 10, 13],
    ['uair', 9, 11],
    ['dair', 16, 16],
  ];

  it.each(SHEET)('%s is first active on frame %i and hits for up to %d%%', (name, first, damage) => {
    const move = moves[name]!;
    expect(Math.min(...move.hits.map((w) => w.frames[0]))).toBe(first);
    expect(Math.max(...move.hits.flatMap((w) => w.boxes.map((b) => b.damage)))).toBe(damage);
    expect(activeFrames(name)[0]).toBe(first);
  });

  it('forward smash is out on frames 20-22 and charges on frame 12', () => {
    expect(activeFrames('fsmash')).toEqual([20, 21, 22]);
    expect(moves.fsmash!.charge).toBe(12);
  });

  it('the grab is a 9-frame pin that reaches 15 units, and the throws deal the sheet damage', () => {
    const grab = moves.grab!.hits[0]!;
    expect(grab.frames[0]).toBe(9);
    expect(grab.boxes[0]!.x + grab.boxes[0]!.radius).toBe(15);
    expect(moves.pummel!.pummel!.damage).toBe(1.5);
    expect(
      (['fthrow', 'bthrow', 'uthrow', 'dthrow'] as const).map((t) => moves[t]!.throw!.hit.damage),
    ).toEqual([9, 11, 10, 7]);
  });
});

describe('Bloxorz block: kill percents (Mario at the Battlefield ledge, fresh, no rage, no DI)', () => {
  const measure = (setup: KoSetup) => {
    const percent = koPercent(setup);
    expect(percent).not.toBeNull();
    return percent!;
  };
  const blockKo = (move: string, setup: Omit<KoSetup, 'hit'> = {}, fighter = 'bloxorz') =>
    measure({ hit: { fighter, move }, ...setup });

  // Ultimate analogues: SSBU-Calculator Data/ulthitboxes. Compare the launching hit, not earlier setup hits.
  const analogues: [string, string, KoHit, Omit<KoSetup, 'hit'>?][] = [
    ['fsmash', "Bowser's 20% forward smash", { damage: 20, angle: 361, kbg: 98, bkb: 25 }],
    [
      'usmash',
      "King K. Rool's initial up smash",
      { damage: 17, angle: 83, kbg: 90, bkb: 31 },
      { air: true, from: { x: 79.9, y: 22.5 } },
    ],
    ['dsmash', "Ganondorf's down smash finisher", { damage: 15, angle: 35, kbg: 81, bkb: 61 }],
    ['ftilt', "King K. Rool's 11% forward tilt", { damage: 11, angle: 361, kbg: 76, bkb: 64 }],
    ['bair', "Donkey Kong's early back air", { damage: 13, angle: 361, kbg: 97, bkb: 20 }, { air: true }],
    ['bthrow', "Donkey Kong's back throw", { damage: 11, angle: 40, kbg: 65, bkb: 60 }],
    ['fthrow', "Ridley's forward throw", { damage: 9, angle: 42, kbg: 56, bkb: 60 }],
    ['upB', "Ridley's up Wing Blitz", { damage: 18, angle: 64, kbg: 46, bkb: 85 }],
  ];
  it.each(analogues)('%s KOs within five points of %s', (move, _analogue, hit, setup = {}) => {
    expect(Math.abs(blockKo(move, setup) - measure({ hit, ...setup }))).toBeLessThanOrEqual(5);
  });

  it('Lying Tip Over matches Donkey Kong’s forward tilt and KOs later than Standing Tip Over', () => {
    const lying = blockKo('ftilt', {}, 'bloxorz-lying');
    const analogue = measure({ hit: { damage: 8, angle: 361, kbg: 78, bkb: 50 } });
    expect(Math.abs(lying - analogue)).toBeLessThanOrEqual(5);
    expect(blockKo('ftilt')).toBeLessThan(lying);
  });

  it('Monolith Slam KOs well before Tip Over', () => {
    expect(blockKo('fsmash')).toBeLessThan(blockKo('ftilt') - 20);
  });

  it('back throw is the kill throw: it KOs well before forward throw', () => {
    expect(blockKo('bthrow')).toBeLessThan(blockKo('fthrow') - 30);
  });

  it('its forward smash takes at least 10% more damage to KO a block than Mario', () => {
    const mario = blockKo('fsmash');
    expect(blockKo('fsmash', { target: 'bloxorz' })).toBeGreaterThan(mario * 1.1);
  });
});

describe('Bloxorz block: moves', () => {
  it('dash attack tips end over end three times, 18 units a tip', () => {
    const m = block();
    const f = m.fighters[0]!;
    f.facing = 1;
    const x0 = f.pos.x;
    attack(m, 0, 'dashAttack');
    run(m, moves.dashAttack!.faf);
    expect(Math.abs(f.pos.x - x0 - 3 * TIP_DISTANCE)).toBeLessThan(3);
  });

  it('dash attack carries the opponent along and hits three times for 12%', () => {
    const { m, v } = hitWith('dashAttack', 10);
    let hits = 0;
    let last = 0;
    for (let i = 0; i < moves.dashAttack!.faf; i++) {
      runPorts(m, 1, [{}, {}]);
      if (v.damage > last) hits++;
      last = v.damage;
    }
    expect(hits).toBe(3);
    expect(v.damage).toBeCloseTo(12 * 1.05 * 1.2, 6);
  });

  it('down smash hits on both sides', () => {
    for (const side of [1, -1]) {
      const { m, v } = hitWith('dsmash', 13 * side, 60);
      for (let i = 0; i < 30 && v.kb.x === 0; i++) runPorts(m, 1, [{}, {}]);
      expect(Math.sign(v.kb.x)).toBe(side);
    }
  });

  it('dair meteors an opponent below it early', () => {
    const m = testMatch({ fighter: 'bloxorz', players: 2 });
    const [, v] = m.fighters as [FighterState, FighterState];
    placeInAir(m, 0, 120, 1);
    Object.assign(v, {
      pos: { x: 0, y: 106 },
      prevPos: { x: 0, y: 106 },
      ground: null,
      action: 'fall',
      vel: { x: 0, y: 0 },
      damage: 50,
      intangible: 0,
    });
    attack(m, 0, 'dair');
    for (let i = 0; i < 60 && v.kb.y === 0; i++) runPorts(m, 1, [{}, {}]);
    expect(v.damage).toBeGreaterThan(50);
    expect(v.kb.y).toBeLessThan(0);
  });
});
