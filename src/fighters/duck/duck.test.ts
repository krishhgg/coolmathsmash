import { describe, expect, it } from 'vitest';
import { createMatch } from '../../sim/match';
import type { FighterState } from '../../sim/fighter';
import { activeHitboxes } from '../../sim/combat/hits';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { koPercent, type KoSetup } from './ko';
import { moves } from './moves';
import { stats } from './stats';

const duck = () => testMatch({ fighter: 'duck' });

/** The move started by `hold` (one frame) from standing still, or by `hold` after holding `before`. */
function moveFrom(hold: Hold, before?: { hold: Hold; frames: number }): string | null {
  const m = duck();
  if (before) run(m, before.frames, before.hold);
  run(m, 1, hold);
  return m.fighters[0]!.move;
}

/** Frames of `move` with a hitbox out, played from standing (or from the air for aerials). */
function activeFrames(move: string): number[] {
  const m = duck();
  const f = moves[move]!.kind === 'aerial' ? placeInAir(m, 0, 80) : m.fighters[0]!;
  attack(m, 0, move);
  const active: number[] = [];
  for (let i = 0; i < moves[move]!.faf; i++) {
    run(m, 1);
    if (f.move !== move) break;
    if (activeHitboxes(f).length > 0) active.push(f.actionFrame);
  }
  return active;
}

describe('The Duck: stats', () => {
  it('is a light flyer: Fox-like weight, Peach gravity, Kirby fall speeds', () => {
    expect(stats.weight).toBe(76);
    expect(stats.gravity).toBe(0.07);
    expect([stats.fallSpeed, stats.fastFallSpeed]).toEqual([1.23, 1.968]);
    expect([stats.dashInitialSpeed, stats.runSpeed]).toEqual([1.98, 2.039]);
  });

  it('has five jumps: four midair flaps after the ground jump', () => {
    const m = duck();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['jump'] });
    run(m, 12);
    expect(f.ground).toBeNull();
    let flaps = 0;
    for (let i = 0; i < 6; i++) {
      const used = f.jumpsUsed;
      run(m, 1, { buttons: ['jump'] });
      run(m, 10);
      if (f.jumpsUsed > used) flaps++;
    }
    expect(flaps).toBe(4);
    expect(f.jumpsUsed).toBe(5);
  });
});

describe('The Duck: attack inputs', () => {
  it('jab, tilts and smashes come from Attack with no, a held, or a just-tapped direction', () => {
    expect(moveFrom({ buttons: ['attack'] })).toBe('jab');
    expect(moveFrom({ x: 100, buttons: ['attack'] })).toBe('fsmash');
    expect(moveFrom({ y: 100, buttons: ['attack'] })).toBe('usmash');
    expect(moveFrom({ y: -100, buttons: ['attack'] })).toBe('dsmash');
    expect(moveFrom({ x: 50, buttons: ['attack'] }, { hold: { x: 50 }, frames: 8 })).toBe('ftilt');
    expect(moveFrom({ y: 50, buttons: ['attack'] }, { hold: { y: 50 }, frames: 8 })).toBe('utilt');
    expect(moveFrom({ y: -60, buttons: ['attack'] }, { hold: { y: -60 }, frames: 8 })).toBe('dtilt');
    expect(moveFrom({ x: 100, buttons: ['attack'] }, { hold: { x: 100 }, frames: 20 })).toBe('dashAttack');
    expect(moveFrom({ buttons: ['grab'] })).toBe('grab');
  });

  it('aerials follow the stick relative to facing', () => {
    const aerial = (hold: Hold) => {
      const m = duck();
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

describe('The Duck: jab combo (peck, peck, wing slap)', () => {
  it('Attack again inside each window chains jab -> jab2 -> jab3', () => {
    const m = duck();
    const f = m.fighters[0]!;
    const seen: string[] = [];
    for (let i = 0; i < 70; i++) {
      run(m, 1, i % 8 === 0 && i < 24 ? { buttons: ['attack'] } : {});
      if (f.move && seen.at(-1) !== f.move) seen.push(f.move);
    }
    expect(seen).toEqual(['jab', 'jab2', 'jab3']);
  });

  it('a single press plays only the first peck and ends at its first actionable frame', () => {
    const m = duck();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['attack'] });
    let frames = 1;
    while (f.move === 'jab') {
      run(m, 1);
      frames++;
    }
    expect(frames).toBe(moves.jab!.faf);
    expect(f.action).toBe('idle');
  });

  it('a press before the window is buffered and continues the combo when it opens', () => {
    const m = duck();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['attack'] });
    run(m, 2);
    run(m, 1, { buttons: ['attack'] });
    until(m, (g) => g.move !== 'jab');
    expect(f.move).toBe('jab2');
    expect(f.actionFrame).toBe(1);
  });

  it('Attack with a direction during the window does not continue the jab', () => {
    const m = duck();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['attack'] });
    run(m, 7);
    run(m, 1, { y: -60, buttons: ['attack'] });
    expect(f.move).toBe('jab');
  });

  it('all three hits connect on a standing opponent: 8%, fresh (x1.05) and x1.2 in 1v1', () => {
    const m = testMatch({ fighter: 'duck', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(v, { pos: { x: a.pos.x + 6 * a.facing, y: a.pos.y }, ground: a.ground, action: 'idle' });
    v.intangible = 0;
    for (let i = 0; i < 70; i++) runPorts(m, 1, [i % 8 === 0 && i < 24 ? { buttons: ['attack'] } : {}, {}]);
    expect(v.damage).toBeCloseTo((2 + 2 + 4) * 1.05 * 1.2, 6);
  });
});

describe('The Duck: frame data (roster sheet)', () => {
  /** Roster "### 7. The Duck": damage of the strongest hitbox and first active frame. */
  const ROSTER: [string, number, number][] = [
    ['jab', 2, 3],
    ['jab2', 2, 3],
    ['jab3', 4, 4],
    ['ftilt', 9, 7],
    ['utilt', 6, 5],
    ['dtilt', 6, 4],
    ['dashAttack', 11, 7],
    ['fsmash', 16, 14],
    ['usmash', 14, 10],
    ['dsmash', 12, 7],
    ['nair', 8, 4],
    ['fair', 11, 9],
    ['bair', 12, 8],
    ['uair', 8, 5],
    ['dair', 12, 12],
    ['grab', 0, 7],
  ];
  it.each(ROSTER)('%s: %s damage, first active frame %s', (move, damage, first) => {
    const def = moves[move]!;
    expect(Math.max(...def.hits.flatMap((w) => w.boxes.map((b) => b.damage)))).toBe(damage);
    expect(activeFrames(move)[0]).toBe(first);
  });

  it.each([
    ['pummel', 1.2],
    ['fthrow', 8],
    ['bthrow', 10],
    ['uthrow', 8],
    ['dthrow', 6],
  ] as const)('%s: %s damage', (move, damage) => {
    const def = moves[move]!;
    expect(def.pummel?.damage ?? def.throw?.hit.damage).toBe(damage);
  });

  it('dair meteors at the foot: its first hit sends straight down', () => {
    const foot = moves.dair!.hits[0]!.boxes[0]!;
    expect(foot.angle).toBe(270);
    expect(foot.id).toBe(0);
  });
});

describe('The Duck: kill percents (Mario at the Battlefield ledge, fresh, no DI)', () => {
  const KILLS: [string, KoSetup, number][] = [
    ['ftilt', { move: 'ftilt', reach: 9 }, 165],
    ['fsmash', { move: 'fsmash', reach: 11 }, 100],
    ['usmash', { move: 'usmash', reach: 0, victimY: 10, at: 0 }, 115],
    ['bair', { move: 'bair', reach: -8.5, duckY: 4 }, 140],
    ['bthrow', { move: 'bthrow', reach: 0, throwInput: (s) => ({ x: -100 * s }) }, 155],
  ];
  it.each(KILLS)('%s KOs within 8 of the roster kill percent', (_, setup, target) => {
    const ko = koPercent(setup);
    expect(ko).toBeGreaterThanOrEqual(target - 8);
    expect(ko).toBeLessThanOrEqual(target + 8);
  });

  it('fsmash is his strongest grounded kill move, ahead of usmash and ftilt', () => {
    const fsmash = koPercent(KILLS[1]![1]);
    expect(fsmash).toBeLessThan(koPercent(KILLS[2]![1]));
    expect(fsmash).toBeLessThan(koPercent(KILLS[0]![1]));
  });
});

describe('The Duck: throws', () => {
  it('down throw at 0% leaves the Duck free to act before the opponent: a combo starter', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'duck' }, { fighter: 'duck' }],
    });
    runPorts(m, 10, [{}, {}]);
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(v, { pos: { x: a.pos.x + 10 * a.facing, y: a.pos.y }, ground: a.ground, action: 'idle' });
    v.intangible = 0;
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, 8, [{}, {}]);
    expect(v.action).toBe('grabbed');
    runPorts(m, 1, [{ y: -100 }, {}]);
    expect(a.move).toBe('dthrow');
    let duckFree = 0;
    let victimFree = 0;
    for (let i = 1; i < 120 && !victimFree; i++) {
      runPorts(m, 1, [{}, {}]);
      if (!duckFree && a.action === 'idle') duckFree = i;
      if (v.launch === null && v.hitstun <= 0 && v.action !== 'grabbed') victimFree = i;
    }
    expect(duckFree).toBeGreaterThan(0);
    expect(duckFree).toBeLessThan(victimFree);
  });
});
