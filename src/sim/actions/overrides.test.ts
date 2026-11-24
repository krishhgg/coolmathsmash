import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { defineFighter } from '../../fighters/types';
import { stickX, stickY } from '../control';
import { emit } from '../events';
import { hurtbox, touches, type PlacedHitbox } from '../combat/hits';
import type { FighterState } from '../fighter';
import { marioReference } from '../testing/reference';
import { run, testMatch } from '../testing/sim';
import { isIntangible, setAction } from './registry';

/**
 * A test-only fighter whose walk is its own: it steps 3 units every 10 frames (and asks for a screen shake each
 * step), and holding the stick down while walking puts it into an action no other fighter has.
 */
const stepper = defineFighter({
  ...marioReference,
  id: 'test-stepper',
  name: 'Stepper',
  actions: {
    walk: {
      physics: 'ground',
      friction: false,
      update(x) {
        const { f, c } = x;
        if (stickY(c) <= -0.5) return setAction(x, 'sit');
        if (stickX(c) === 0) return setAction(x, 'idle');
        f.vel.x = 0;
        if (f.actionFrame % 10 === 1) {
          f.vel.x = 3 * Math.sign(stickX(c));
          emit(x.m, { type: 'shake', port: f.port, amplitude: 2, frames: 4 });
        }
      },
    },
    sit: {
      physics: 'ground',
      intangible: (f) => f.actionFrame <= 5,
      update() {},
    },
  },
});
registerFighter(stepper);

/** A test-only block lying on its side: 24 wide, 12 tall. */
const lying = defineFighter({
  ...marioReference,
  id: 'test-lying-block',
  name: 'Lying block',
  stats: { ...marioReference.stats, width: 24, height: 12 },
});
registerFighter(lying);

describe('per-fighter action overrides', () => {
  it("a fighter's own walk replaces the shared one for that fighter only", () => {
    const m = testMatch({ fighter: 'test-stepper' });
    const f = m.fighters[0]!;
    const x0 = f.pos.x;
    run(m, 30, { x: 50 });
    expect(f.action).toBe('walk');
    expect(f.pos.x - x0).toBeCloseTo(9, 6);

    const mario = testMatch();
    const g = mario.fighters[0]!;
    const y0 = g.pos.x;
    run(mario, 30, { x: 50 });
    expect(g.pos.x - y0).not.toBeCloseTo(9, 1);
  });

  it('an override can enter an action only its fighter has, with its own intangibility', () => {
    const m = testMatch({ fighter: 'test-stepper' });
    const f: FighterState = m.fighters[0]!;
    run(m, 5, { x: 50 });
    run(m, 1, { x: 50, y: -60 });
    expect(f.action).toBe('sit');
    expect(isIntangible(f)).toBe(true);
    run(m, 6);
    expect(f.action).toBe('sit');
    expect(isIntangible(f)).toBe(false);
  });

  it('every step reports a screen shake', () => {
    const m = testMatch({ fighter: 'test-stepper' });
    let shakes = 0;
    for (let i = 0; i < 30; i++) {
      run(m, 1, { x: 50 });
      shakes += m.events.filter((e) => e.type === 'shake' && e.amplitude === 2 && e.frames === 4).length;
    }
    expect(shakes).toBe(3);
  });
});

describe('hurtbox shape', () => {
  const at = (x: number, y: number, radius = 1): PlacedHitbox => ({
    box: { id: 0, x: 0, y: 0, radius, damage: 1, angle: 0, kbg: 0, bkb: 0 },
    x,
    y,
  });

  it('a fighter wider than it is tall lies as a horizontal capsule, half its height thick', () => {
    const m = testMatch({ fighter: 'test-lying-block' });
    const f = m.fighters[0]!;
    const body = hurtbox(f, lying.stats);
    expect(body).toMatchObject({ y1: f.pos.y + 6, y2: f.pos.y + 6, r: 6, hw: 6 });
    expect(touches(at(f.pos.x + 12.5, f.pos.y + 6), body)).toBe(true);
    expect(touches(at(f.pos.x - 12.5, f.pos.y + 6), body)).toBe(true);
    expect(touches(at(f.pos.x, f.pos.y + 13.5), body)).toBe(false);
  });

  it('an upright fighter keeps its vertical capsule', () => {
    const m = testMatch();
    const f = m.fighters[0]!;
    const body = hurtbox(f, marioReference.stats);
    expect(body.hw ?? 0).toBe(0);
    expect(touches(at(f.pos.x, f.pos.y + 15.5), body)).toBe(true);
    expect(touches(at(f.pos.x + 5.5, f.pos.y + 7), body)).toBe(false);
  });
});
