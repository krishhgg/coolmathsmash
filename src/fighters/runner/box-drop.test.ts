import { describe, expect, it } from 'vitest';
import { FRESHNESS_BONUS, ONE_V_ONE_DAMAGE } from '../../sim/combat/formulas';
import { activeHitboxes, applyHit } from '../../sim/combat/hits';
import { createMatch } from '../../sim/match';
import { marioReference } from '../../sim/testing/reference';
import { attack, placeInAir, run, testMatch, until, type Hold } from '../../sim/testing/sim';

const DOWN_SPECIAL: Hold = { y: -100, buttons: ['special'] };

function duel(x = 32) {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'runner' }, { fighter: marioReference.id }],
  });
  run(m, 10);
  const runner = m.fighters[0]!;
  const mario = m.fighters[1]!;
  runner.pos.x = 20;
  mario.pos.x = x;
  return { m, runner, mario };
}

describe('Runner: Box Drop', () => {
  it('stalls through F11, then drops vertically with a meteor only on F12–16', () => {
    const m = testMatch({ fighter: 'runner' });
    const runner = placeInAir(m, 20, 45);
    runner.vel = { x: 1, y: 1 };
    run(m, 1, DOWN_SPECIAL);
    const active: number[] = [];
    for (let frame = 1; frame <= 17; frame++) {
      expect(runner).toMatchObject({
        move: 'downBAir',
        actionFrame: frame,
        ground: null,
        pos: { x: 20, y: 45 - Math.max(0, frame - 11) * 6 },
      });
      if (activeHitboxes(runner).length) active.push(frame);
      if (frame < 17) run(m, 1, { x: 100 });
    }
    expect(active).toEqual([12, 13, 14, 15, 16]);
  });

  it('deals 15% and launches an airborne victim downward', () => {
    const { m, mario } = duel(23);
    placeInAir(m, 20, 45);
    Object.assign(mario, { pos: { x: 23, y: 31 }, ground: null, action: 'fall' });
    run(m, 1, DOWN_SPECIAL);
    run(m, 11);
    expect(mario.damage).toBeCloseTo(15 * FRESHNESS_BONUS * ONE_V_ONE_DAMAGE, 6);
    expect(mario.launch?.angle).toBe(270);
    run(m, mario.hitlag + 1);
    expect(mario.kb.y).toBeLessThan(0);
  });

  it.each([
    ['grounded activation', 0, 32, 1],
    ['landing during the meteor window', 5, 8, -1],
    ['landing after the meteor window', 38, 32, 1],
  ] as const)('deals a 12%% outward impact on %s', (_, height, x, dir) => {
    const { m, runner, mario } = duel(x);
    if (height > 0) placeInAir(m, 20, height);
    run(m, 1, DOWN_SPECIAL);
    run(m, 10);
    expect(mario.damage).toBe(0);
    run(m, Math.max(1, Math.ceil(height / 6)));
    expect(runner).toMatchObject({ action: 'attack', move: 'downB', actionFrame: 12, pos: { y: 0 } });
    expect(mario.damage).toBeCloseTo(12 * FRESHNESS_BONUS * ONE_V_ONE_DAMAGE, 6);
    expect(mario.launch).toMatchObject({ angle: 25, dir });
    if (height > 0) expect(m.events).toContainEqual({ type: 'land', port: 0, lag: 0 });
  });

  it('does not hit the same victim again on landing after the meteor connects', () => {
    const { m, runner, mario } = duel(23);
    placeInAir(m, 20, 11);
    run(m, 1, DOWN_SPECIAL);
    run(m, 11);
    const damage = mario.damage;
    expect(damage).toBeCloseTo(15 * FRESHNESS_BONUS * ONE_V_ONE_DAMAGE, 6);
    until(m, (f) => f.move === 'downB');
    expect(runner.actionFrame).toBe(12);
    expect(runner.hitVictims).toEqual([1]);
    expect(mario.damage).toBe(damage);
  });

  it.each([
    ['ground startup', 0, 11, 24, false],
    ['first grounded armor frame', 0, 12, 24, true],
    ['final grounded armor frame', 0, 131, 24, true],
    ['grounded recovery', 0, 132, 24, false],
    ['a hit at the threshold', 0, 30, 25, false],
    ['airborne plunge', 45, 12, 24, false],
  ] as const)('applies the 25%% damage threshold on %s', (_, height, frame, damage, armored) => {
    const { m, runner } = duel(60);
    if (height > 0) placeInAir(m, 20, height);
    run(m, 1, DOWN_SPECIAL);
    run(m, frame - 1);
    expect(runner.actionFrame).toBe(frame);
    const mario = attack(m, 1, 'probe');
    mario.moveStale = 1;
    const box = marioReference.moves.probe.hits[0]!.boxes[0]!;
    applyHit(m, mario, runner, { ...box, damage });
    expect(runner.damage).toBeCloseTo(damage * ONE_V_ONE_DAMAGE, 6);
    expect(runner.hitlag).toBeGreaterThan(0);
    if (armored) {
      expect(runner.move).toBe('downB');
      expect(runner.launch).toBeNull();
      expect(runner.hitstun).toBe(0);
    } else {
      expect(runner.move).toBeNull();
      expect(runner.launch).not.toBeNull();
    }
  });

  it('allows early release with Special only after 18 armored frames and recovers for 31 frames', () => {
    const m = testMatch({ fighter: 'runner' });
    const runner = m.fighters[0]!;
    run(m, 1, DOWN_SPECIAL);
    run(m, 16);
    run(m, 1, { buttons: ['special'] });
    expect(runner.actionFrame).toBe(18);
    run(m, 11);
    expect(runner.actionFrame).toBe(29);
    run(m, 1, { buttons: ['special'] });
    expect(runner).toMatchObject({ move: 'downB', actionFrame: 132 });
    run(m, 30);
    expect(runner).toMatchObject({ move: 'downB', actionFrame: 162 });
    run(m, 1);
    expect(runner).toMatchObject({ move: null, action: 'idle' });
  });
});
