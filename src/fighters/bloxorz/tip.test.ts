import { describe, expect, it } from 'vitest';
import { hurtbox, touches } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';
import { attack, run, testMatch, type Hold } from '../../sim/testing/sim';
import { getFighter } from '../registry';
import { stats } from './stats';
import { DASH, LYING, RUN, STANDING, TIP_DISTANCE, TIP_SHAKE, WALK, tipSpeed } from './tip';

const block = () => {
  const m = testMatch({ fighter: 'bloxorz' });
  m.fighters[0]!.facing = 1;
  return m;
};

/** Run `frames` frames holding `hold`; returns the shake events and the per-frame x velocity. */
function track(m: MatchState, frames: number, hold: Hold = {}) {
  const f = m.fighters[0]!;
  const shakes: number[] = [];
  const vx: number[] = [];
  for (let i = 0; i < frames; i++) {
    run(m, 1, hold);
    vx.push(f.pos.x - f.prevPos.x);
    if (m.events.some((e) => e.type === 'shake')) shakes.push(i + 1);
  }
  return { shakes, vx };
}

describe('Bloxorz block: tipping', () => {
  it('the tip timings give the roster sheet speeds: walk 0.9, dash 1.5, run 1.5', () => {
    expect(TIP_DISTANCE / WALK.period).toBeCloseTo(stats.walkSpeed, 9);
    expect(TIP_DISTANCE / DASH.period).toBeCloseTo(stats.dashInitialSpeed, 9);
    expect(TIP_DISTANCE / RUN.period).toBeCloseTo(stats.runSpeed, 2);
    const sum = (n: number) => Array.from({ length: n }, (_, t) => tipSpeed(t, n)).reduce((a, b) => a + b);
    expect(sum(WALK.tip)).toBeCloseTo(18, 9);
    expect(sum(RUN.tip)).toBeCloseTo(18, 9);
  });

  it('walking tips 18 units every 20 frames, Standing to Lying and back, still between tips', () => {
    const m = block();
    const f = m.fighters[0]!;
    const x0 = f.pos.x;
    const { vx } = track(m, WALK.period, { x: 50 });
    expect(f.action).toBe('walk');
    expect(f.pos.x - x0).toBeCloseTo(18, 6);
    expect(f.fighter).toBe(LYING);
    expect(vx.slice(WALK.tip).every((v) => v === 0)).toBe(true);
    expect(Math.max(...vx)).toBeGreaterThan(1.5);
    track(m, WALK.period, { x: 50 });
    expect(f.pos.x - x0).toBeCloseTo(36, 6);
    expect(f.fighter).toBe(STANDING);
  });

  it('every tip lands with a 2-pixel, 4-frame screen shake', () => {
    const m = block();
    let shakes = 0;
    for (let i = 0; i < 3 * WALK.period; i++) {
      run(m, 1, { x: 50 });
      shakes += m.events.filter(
        (e) => e.type === 'shake' && e.amplitude === TIP_SHAKE.amplitude && e.frames === TIP_SHAKE.frames,
      ).length;
    }
    expect(shakes).toBe(3);
  });

  it('letting go of the stick mid-tip finishes the tip, then stops', () => {
    const m = block();
    const f = m.fighters[0]!;
    const x0 = f.pos.x;
    run(m, 4, { x: 50 });
    run(m, 30);
    expect(f.action).toBe('idle');
    expect(f.pos.x - x0).toBeCloseTo(18, 6);
    expect(f.fighter).toBe(LYING);
  });

  it('a flick dashes one 12-frame tip, then the run tips every 12 frames', () => {
    const m = block();
    const f = m.fighters[0]!;
    const x0 = f.pos.x;
    run(m, DASH.period, { x: 100 });
    expect(f.action).toBe('dash');
    expect(f.pos.x - x0).toBeCloseTo(18, 6);
    run(m, 2 * RUN.period, { x: 100 });
    expect(f.action).toBe('run');
    expect(f.pos.x - x0).toBeCloseTo(54, 6);
    expect(f.fighter).toBe(LYING);
  });

  it('turns round with no skid: holding back while running, the next tip goes the other way', () => {
    const m = block();
    const f = m.fighters[0]!;
    run(m, DASH.period + RUN.period, { x: 100 });
    const x1 = f.pos.x;
    const actions = new Set<string>();
    for (let i = 0; i < RUN.period; i++) {
      run(m, 1, { x: -100 });
      actions.add(f.action);
    }
    expect(actions.has('turn')).toBe(false);
    expect(actions.has('runBrake')).toBe(false);
    expect(f.facing).toBe(-1);
    expect(f.pos.x - x1).toBeCloseTo(-18, 6);
  });

  it('crouching lays a standing block on its side: low enough to duck a high hit', () => {
    const m = block();
    const f = m.fighters[0]!;
    const high = {
      box: { id: 0, x: 0, y: 0, radius: 2, damage: 1, angle: 0, kbg: 0, bkb: 0 },
      x: f.pos.x,
      y: f.pos.y + 16,
    };
    expect(touches(high, hurtbox(f, getFighter(f.fighter).stats))).toBe(true);
    run(m, 1, { y: -100 });
    expect(f.action).toBe('crouch');
    expect(f.fighter).toBe(LYING);
    expect(touches(high, hurtbox(f, getFighter(f.fighter).stats))).toBe(false);
    run(m, 10);
    expect(f.action).toBe('idle');
    expect(f.fighter).toBe(LYING);
  });

  it('Tip Over is the Lying variant when lying: 8% on frame 8 instead of 11% on frame 12', () => {
    const ftilt = (lying: boolean) => {
      const m = block();
      if (lying) run(m, 2, { y: -100 });
      run(m, 10);
      run(m, 1, { x: 50, buttons: ['attack'] });
      const f = m.fighters[0]!;
      expect(f.move).toBe('ftilt');
      const move = getFighter(f.fighter).moves!.ftilt!;
      return [move.hits[0]!.frames[0], move.hits[0]!.boxes[0]!.damage];
    };
    expect(ftilt(false)).toEqual([12, 11]);
    expect(ftilt(true)).toEqual([8, 8]);
  });

  it('Stand Up from Lying leaves the block standing', () => {
    const m = block();
    const f: FighterState = m.fighters[0]!;
    run(m, 2, { y: -100 });
    run(m, 10);
    expect(f.fighter).toBe(LYING);
    attack(m, 0, 'utilt');
    run(m, 40);
    expect(f.action).toBe('idle');
    expect(f.fighter).toBe(STANDING);
  });

  it('the dash attack turns the block over on each of its three tips', () => {
    const m = block();
    const f = m.fighters[0]!;
    attack(m, 0, 'dashAttack');
    const shapes: string[] = [];
    for (let i = 0; i < 35; i++) {
      run(m, 1);
      if (shapes.at(-1) !== f.fighter) shapes.push(f.fighter);
    }
    expect(shapes).toEqual([STANDING, LYING, STANDING, LYING]);
  });
});
