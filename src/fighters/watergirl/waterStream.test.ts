import { describe, expect, it } from 'vitest';
import { knockback, LAUNCH_SPEED_PER_KB } from '../../sim/combat/formulas';
import { createMatch } from '../../sim/match';
import { placeInAir, run, runPorts, testMatch } from '../../sim/testing/sim';
import type { FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';
import { stats as fireboy } from '../fireboy/stats';
import { registerFighter } from '../registry';
import { defineFighter, type MoveDef } from '../types';
import { fighter } from '.';
import { entities, PUMP } from './entities';
import { pumpTier, STREAM, waterStream } from './waterStream';

/** Watergirl at x = -40 facing Fireboy at `gap` units in front of her, both standing on Battlefield. */
function duel(gap = 18): { m: MatchState; w: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'watergirl' }, { fighter: 'fireboy' }],
  });
  run(m, 10);
  const [w, v] = m.fighters as [FighterState, FighterState];
  Object.assign(w, { pos: { x: -40, y: 0 }, prevPos: { x: -40, y: 0 }, facing: 1 });
  Object.assign(v, { pos: { x: -40 + gap, y: 0 }, prevPos: { x: -40 + gap, y: 0 }, facing: -1 });
  run(m, 5);
  return { m, w, v };
}

/** Uses Water Stream, holding Special for `hold` frames, and steps until it ends; `each` runs after every frame. */
function stream(m: MatchState, hold = 1, others: { buttons?: 'shield'[] } = {}, each = () => {}) {
  const w = m.fighters[0]!;
  const pumps: { frame: number; kind: string; vx: number }[] = [];
  const known = new Set(m.entities.map((e) => e.id));
  let frames = 0;
  do {
    runPorts(m, 1, [frames < hold ? { buttons: ['special'] } : {}, others]);
    frames++;
    each();
    for (const e of m.entities)
      if (!known.has(e.id) && e.owner === 0) {
        known.add(e.id);
        pumps.push({ frame: w.actionFrame, kind: e.kind, vx: e.vel.x });
      }
  } while (w.move === 'neutralB' || w.move === 'neutralBHeavy');
  return { pumps, frames };
}

/** Watergirl with Water Stream counting the runs of its script in `scriptRuns`. */
let scriptRuns = 0;
const counted = (move: MoveDef): MoveDef => ({
  ...move,
  script: (x) => {
    scriptRuns++;
    move.script!(x);
  },
});
const counter = defineFighter({
  ...fighter,
  id: 'test-watergirl-runs',
  name: 'Test: Water Stream runs',
  moves: {
    ...fighter.moves,
    neutralB: counted(waterStream.neutralB!),
    neutralBHeavy: counted(waterStream.neutralBHeavy!),
  },
});
registerFighter(counter);

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

describe('Watergirl Water Stream (neutral special, F.L.U.D.D. in Ultimate)', () => {
  it('tapped: seven uncharged pumps on frames 21-51, 5 apart, and actionable on frame 68', () => {
    const { m, w } = duel(60);
    const { pumps, frames } = stream(m);
    expect(pumps.map((p) => p.frame)).toEqual(range(21, 51, 5));
    expect(new Set(pumps.map((p) => p.kind))).toEqual(new Set(['watergirl/pump0']));
    expect(pumps[0]!.vx).toBeCloseTo(STREAM.speed * Math.cos((12 * Math.PI) / 180), 6);
    expect(frames).toBe(68);
    expect(w.action).toBe('idle');
  });

  it('holding Special charges on frame 19, up to 80 frames, into faster, stronger pumps', () => {
    const { m, w } = duel(80);
    const { pumps, frames } = stream(m, 200);
    expect(pumps).toHaveLength(7);
    expect(new Set(pumps.map((p) => p.kind))).toEqual(new Set(['watergirl/pump8']));
    expect(pumps[0]!.vx).toBeCloseTo(2 * STREAM.speed * Math.cos((12 * Math.PI) / 180), 6);
    // 80 frames held on frame 19, then the heavy shoot: actionable 68 frames after release.
    expect(frames).toBe(80 + 19 + 68);
    expect(w.action).toBe('idle');
  });

  it('switches to the heavier shoot animation from 70 charge frames, as F.L.U.D.D. does', () => {
    const light = duel(80);
    const l = stream(light.m, 18 + 69);
    expect(light.w.charge).toBe(69);
    expect(l.frames).toBe(69 + 19 + 49);
    const heavy = duel(80);
    const h = stream(heavy.m, 18 + 70);
    expect(heavy.w.charge).toBe(70);
    expect(h.frames).toBe(70 + 19 + 68);
  });

  it('pump strength follows the charge: up to 55 more BKB and 1.2x the size at full charge', () => {
    expect(pumpTier(0)).toBe('pump0');
    expect(pumpTier(9)).toBe('pump0');
    expect(pumpTier(10)).toBe('pump1');
    expect(pumpTier(80)).toBe(`pump${PUMP.tiers}`);
    const box = (tier: number) => entities[`pump${tier}`]!.hits![0]!.boxes[0]!;
    expect(box(0)).toMatchObject({
      damage: 0,
      angle: 55,
      kbg: 100,
      bkb: 0,
      wbkb: 70,
      radius: 3.2,
      pushOnly: true,
    });
    expect(box(PUMP.tiers)).toMatchObject({ bkb: 55, radius: 4.8 });
  });

  it("can be reflected but not absorbed, as F.L.U.D.D.'s water (SmashWiki: reflectable, absorbable unset)", () => {
    for (let tier = 0; tier <= PUMP.tiers; tier++) {
      expect(entities[`pump${tier}`]!.reflectable, `pump${tier}`).toBeUndefined();
      expect(entities[`pump${tier}`]!.absorbable, `pump${tier}`).toBe(false);
    }
  });

  it('pushes Fireboy back without damage or hitstun, a full-charge pump with 55 more BKB', () => {
    const pushed = (hold: number) => {
      const { m, v } = duel(18);
      v.damage = 40;
      const x0 = v.pos.x;
      let first = 0;
      let hits = 0;
      stream(m, hold, {}, () => {
        if (!first && v.kb.x > 0) first = v.kb.x;
        hits += m.events.filter((e) => e.type === 'hit').length;
      });
      run(m, 30);
      expect(v).toMatchObject({ damage: 40, hitstun: 0 });
      expect(v.ground).not.toBeNull();
      expect(hits).toBe(0);
      return { first, moved: v.pos.x - x0 };
    };
    // A grounded target slides along the windbox's horizontal component (cos 55 of the launch speed).
    const push = (bkb: number) =>
      Math.cos((55 * Math.PI) / 180) *
      LAUNCH_SPEED_PER_KB *
      knockback({ percent: 40, damage: 0, kbg: 100, bkb, wbkb: 70, weight: fireboy.weight, crouch: false });
    const tap = pushed(1);
    const full = pushed(200);
    expect(tap.first).toBeCloseTo(push(0), 6);
    expect(full.first).toBeCloseTo(push(55), 6);
    expect(tap.moved).toBeGreaterThan(30);
    expect(full.moved).toBeGreaterThan(tap.moved);
  });

  it("doesn't move a shielding Fireboy", () => {
    const { m, v } = duel(18);
    runPorts(m, 3, [{}, { buttons: ['shield'] }]);
    const x0 = v.pos.x;
    stream(m, 1, { buttons: ['shield'] });
    expect(v.pos.x).toBeCloseTo(x0, 6);
    expect(v.action).toBe('shield');
  });

  it('in the air, releasing a charge pushes her back 0.02 units a frame per charge frame', () => {
    const { m } = duel(80);
    const w = placeInAir(m, -70, 150);
    const charge = 40;
    const held = STREAM.chargeFrame - 1 + charge;
    run(m, held, { buttons: ['special'] });
    expect(w.actionFrame).toBe(STREAM.chargeFrame - 1);
    const before = w.vel.x;
    run(m, 1);
    expect(w.actionFrame).toBe(STREAM.chargeFrame);
    expect(w.ground).toBeNull();
    expect(w.charge).toBe(charge);
    // The release frame's air friction takes back at most 0.015 of the 0.8 recoil.
    expect(w.vel.x - before).toBeCloseTo(-STREAM.recoil * charge, 1);
  });

  it('runs its script once a frame while it charges, into the heavy shoot too', () => {
    const m = testMatch({ fighter: counter.id });
    const w = m.fighters[0]!;
    run(m, 1, { buttons: ['special'] });
    expect(w.move).toBe('neutralB');
    const runs: number[] = [];
    while (w.charge < STREAM.heavyFrom + 5) {
      const before = scriptRuns;
      run(m, 1, { buttons: ['special'] });
      runs.push(scriptRuns - before);
    }
    expect(w.actionFrame).toBe(STREAM.chargeFrame - 1);
    expect(w.move).toBe('neutralBHeavy');
    expect(runs).toEqual(runs.map(() => 1));
  });
});
