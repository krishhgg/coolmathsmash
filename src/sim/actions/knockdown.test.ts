import { describe, expect, it } from 'vitest';
import {
  DOWN_AUTO_GETUP,
  DOWN_BOUNCE_FRAMES,
  GETUP_ROLL,
  GETUP_STAND,
  TECH_IN_PLACE,
  TECH_LOCKOUT,
  TECH_ROLL,
  TECH_WINDOW,
} from '../constants';
import type { MatchState } from '../match';
import { marioReference as mario } from '../testing/reference';
import { placeInAir, run, testMatch, until, type Hold } from '../testing/sim';
import { isIntangible } from './registry';

/**
 * Fighter 0 tumbling onto the main stage from 80 u up, clear of the platforms. By default it is in hitstun and
 * has used its air dodge, so Shield presses are only tech presses (no hitstun-cancel air dodge).
 */
function tumbling(fighter?: string, hitstun = 100): MatchState {
  const m = testMatch({ fighter });
  const f = placeInAir(m, -70, 80);
  Object.assign(f, { action: 'tumble', actionFrame: 1, hitstun, airDodgeUsed: hitstun > 0 });
  return m;
}

/** Frames until fighter 0 touches the ground from tumbling(). */
const fallFrames = (() => {
  const m = tumbling();
  return until(m, (f) => f.ground !== null);
})();

/** Tumble to the ground, pressing Shield on each step listed in `presses` (counted back from the landing step). */
function landWith(presses: number[], hold: Hold = {}): MatchState {
  const m = tumbling();
  const landing = fallFrames - 1;
  run(m, fallFrames, (i) => (presses.includes(landing - i) ? { ...hold, buttons: ['shield'] } : hold));
  expect(m.fighters[0]!.ground).not.toBeNull();
  return m;
}

/** Frames (1-based) of the current action on which fighter 0 is intangible, until it leaves `action`. */
function intangibleFrames(m: MatchState, action: string): number[] {
  const f = m.fighters[0]!;
  const frames: number[] = [];
  run(m, 1);
  while (f.action === action) {
    if (isIntangible(f)) frames.push(f.actionFrame);
    run(m, 1);
  }
  return frames;
}

describe('tech', () => {
  it('a tumble landing with no Shield press is a missed tech: a 26-frame bounce, then lying down', () => {
    const m = landWith([]);
    const f = m.fighters[0]!;
    expect(f.action).toBe('downBound');
    run(m, DOWN_BOUNCE_FRAMES - 1);
    expect(f.action).toBe('downBound');
    run(m, 1);
    expect(f.action).toBe('down');
  });

  it('Shield pressed up to 10 frames before touching down techs; 11 frames before is too early', () => {
    for (let k = 0; k < TECH_WINDOW; k++)
      expect(landWith([k]).fighters[0]!.action, `${k}`).toBe('techInPlace');
    expect(landWith([TECH_WINDOW]).fighters[0]!.action).toBe('downBound');
  });

  it('a press locks out further tech presses for 40 frames', () => {
    expect(fallFrames).toBeGreaterThan(TECH_LOCKOUT);
    expect(landWith([TECH_LOCKOUT - 1, 0]).fighters[0]!.action).toBe('downBound');
    expect(landWith([TECH_LOCKOUT, 0]).fighters[0]!.action).toBe('techInPlace');
  });

  it('a tech in place is intangible on frames 1-21 and actionable on frame 27', () => {
    const m = landWith([3]);
    const f = m.fighters[0]!;
    expect(intangibleFrames(m, 'techInPlace')).toEqual(range(TECH_IN_PLACE.intangible));
    expect(f.action).toBe('idle');
    expect(f.actionFrame).toBe(1);
  });

  it('a tech roll follows the stick and covers a roll', () => {
    const m = landWith([3], { x: 100 });
    const f = m.fighters[0]!;
    expect(f.action).toBe('techRoll');
    const x0 = f.pos.x;
    expect(intangibleFrames(m, 'techRoll')).toEqual(range(TECH_ROLL.intangible));
    expect(f.pos.x - x0).toBeCloseTo(mario.stats.rollDistance, 1);
  });

  it('after hitstun, Shield air dodges, and touching down within the tech window still techs', () => {
    const m = tumbling(undefined, 0);
    const f = m.fighters[0]!;
    run(m, fallFrames - 4);
    run(m, 1, { buttons: ['shield'] });
    expect(f.action).toBe('airDodge');
    until(m, (g) => g.ground !== null);
    expect(f.action).toBe('techInPlace');
  });

  it('landing faster than the floor tech limit cannot be teched', () => {
    const m = tumbling();
    const f = m.fighters[0]!;
    f.kb = { x: 0, y: -4 };
    until(m, (g) => g.ground !== null, { buttons: ['shield'] });
    expect(f.action).toBe('downBound');
  });
});

describe('getups', () => {
  function lying(fighter?: string): MatchState {
    const m = tumbling(fighter);
    until(m, (f) => f.action === 'down');
    return m;
  }

  it('stick up stands up, intangible on frames 1-23, actionable on frame 30', () => {
    const m = lying();
    run(m, 1, { y: 100 });
    expect(m.fighters[0]!.action).toBe('getupStand');
    m.fighters[0]!.actionFrame = 0;
    expect(intangibleFrames(m, 'getupStand')).toEqual(range(GETUP_STAND.intangible));
    expect(m.fighters[0]!.actionFrame).toBe(1);
  });

  it('the stick sideways rolls that way', () => {
    const m = lying();
    const f = m.fighters[0]!;
    const x0 = f.pos.x;
    run(m, 1, { x: 100 });
    expect(f.action).toBe('getupRoll');
    f.actionFrame = 0;
    expect(intangibleFrames(m, 'getupRoll')).toEqual(range(GETUP_ROLL.intangible));
    expect(f.pos.x - x0).toBeCloseTo(mario.stats.rollDistance, 1);
  });

  it('Attack plays the getup attack, intangible through frame 26', () => {
    const m = lying('fireboy');
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['attack'] });
    expect(f.move).toBe('getupAttack');
    const frames: number[] = [];
    while (f.move === 'getupAttack') {
      if (isIntangible(f)) frames.push(f.actionFrame);
      run(m, 1);
    }
    expect(frames).toEqual(range([1, 26]));
  });

  it('a fighter left lying down gets up by itself', () => {
    const m = lying();
    run(m, DOWN_AUTO_GETUP - 2);
    expect(m.fighters[0]!.action).toBe('down');
    run(m, 1);
    expect(m.fighters[0]!.action).toBe('getupStand');
  });
});

function range([from, to]: [number, number]): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
