import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';

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
    expect(v.damage).toBeCloseTo(17.8 * 1.4 * 1.05 * 1.2, 6);
  });

  it('dair connects up to five times through its rehit windows', () => {
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
  });
});
