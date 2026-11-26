import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { neutralInput } from '../../input/types';
import { isIntangible } from '../../sim/actions/registry';
import { activeHitboxes } from '../../sim/combat/hits';
import { knockback } from '../../sim/combat/formulas';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { finalReach } from '../../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { registerFighter } from '../registry';
import { art } from './art';
import { finalSmash, finalSmashAir, finalSmashCinematic } from './finalSmash';
import { FULL_THROTTLE, FULL_THROTTLE_RANGE } from './finalSmashData';

registerFighter(marioReference);

const MARIO = marioReference.id;
const SPECIAL: Hold = { buttons: ['special'] };
const [FROM, TO] = FULL_THROTTLE.hit;
/** Captain Falcon's Blue Falcon (SmashWiki, "Captain Falcon (SSBU)/Final Smash"): [Z offset, radius] at Y 12. */
const BLUE_FALCON = [
  [13, 16],
  [30, 18],
  [45, 16],
];
/** Its final launch: 10%, Sakurai angle, BK 100, KS 135. */
const FINAL_LAUNCH = { damage: 10, angle: 361, bkb: 100, kbg: 135 };

function step(m: MatchState, frames: number, holds: Hold[] = []): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < frames; i++) {
    stepMatch(
      m,
      m.players.map((p) => input(holds[p.port])),
    );
    seen.push(...m.events);
  }
  return seen;
}

/**
 * Wheely at `xs[0]` facing right and Mario-weight fighters at the other spots ([x, y], or x on the main floor) facing
 * him, on Battlefield after they settle. Three or more ports: no 1v1 damage multiplier.
 */
function match(spots: (number | [number, number])[], percent = 0): MatchState {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: spots.map((_, i) => ({ fighter: i === 0 ? 'wheely' : MARIO })),
  });
  m.fighters.forEach((f, i) => {
    const [x, y] = typeof spots[i] === 'number' ? [spots[i], 0] : spots[i]!;
    Object.assign(f, { pos: { x, y: y + 1 }, prevPos: { x, y: y + 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i === 0 ? 1 : -1 });
  });
  step(m, 30);
  for (const f of m.fighters.slice(1)) f.damage = percent;
  return m;
}

/** Fire it: neutral special with the charge. */
function fire(m: MatchState): SimEvent[] {
  m.fighters[0]!.finalReady = true;
  return step(m, 1, [SPECIAL]);
}

/** Run until Wheely is actionable again (at most `limit` frames); every event on the way. */
function playOut(m: MatchState, limit = 400, holds: Hold[] = []): SimEvent[] {
  const a = m.fighters[0]!;
  const seen: SimEvent[] = [];
  for (let i = 0; i < limit && a.move !== null; i++) seen.push(...step(m, 1, holds));
  return seen;
}

const catches = (seen: SimEvent[]) => seen.filter((e) => e.type === 'commandGrab');

describe('Full Throttle (Final Smash), on Blue Falcon', () => {
  it("takes Blue Falcon's timing: a 26-frame freeze, its boxes on frames 28-30, FAF 98 on the ground and in the air", () => {
    expect([FROM, TO]).toEqual([28, 30]);
    for (const move of [finalSmash, finalSmashAir]) {
      expect(move.faf).toBe(97 + 1);
      expect(move.final).toEqual(expect.objectContaining({ freeze: 26, still: true }));
      expect(move.commandGrab).toBe('finalSmashCinematic');
      expect(move.hits.map((w) => w.frames)).toEqual([
        [28, 28],
        [29, 29],
        [30, 30],
      ]);
      for (const w of move.hits) for (const b of w.boxes) expect([b.grab, b.damage]).toEqual([true, 0]);
    }
    expect(finalSmash.air).toBe('finalSmashAir');
    expect(finalSmashCinematic.final).toEqual({ still: true });
  });

  it("puts its box on each of the Blue Falcon's three in turn: radius 16, 18 and 16 at 13, 30 and 45 ahead, 12 up", () => {
    const m = match([-60, 80]);
    const a = m.fighters[0]!;
    const start = { ...a.pos };
    fire(m);
    step(m, FROM - 2);
    const placed: number[][] = [];
    for (let f = FROM; f <= TO; f++) {
      step(m, 1);
      expect([a.move, a.actionFrame]).toEqual(['finalSmash', f]);
      const [h] = activeHitboxes(a);
      placed.push([h!.x - start.x, h!.y - start.y, h!.box.radius]);
    }
    placed.forEach(([x, y, r], k) => {
      expect(x).toBeCloseTo(BLUE_FALCON[k]![0]!, 6);
      expect(y).toBeCloseTo(12, 6);
      expect(r).toBe(BLUE_FALCON[k]![1]);
    });
    expect(FULL_THROTTLE_RANGE).toBe(45 + 16);
  });

  it('catches a fighter anywhere in that area, through a shield, and pulls it no further than a box radius', () => {
    for (const gap of [14, 20, 29, 36, 47, 56, 62]) {
      const m = match([-60, -60 + gap]);
      const [a, v] = m.fighters as [FighterState, FighterState];
      const shield: Hold = { buttons: ['shield'] };
      step(m, 5, [{}, shield]);
      expect(v.action, `gap ${gap}`).toBe('shield');
      fire(m);
      let before = v.pos.x;
      let seen: SimEvent[] = [];
      for (let i = 0; i < TO && catches(seen).length === 0; i++) {
        before = v.pos.x;
        seen = step(m, 1, [{}, shield]);
      }
      expect(catches(seen), `gap ${gap}`).toEqual([
        { type: 'commandGrab', attacker: 0, victim: 1, move: 'finalSmash' },
      ]);
      expect([a.move, v.action]).toEqual(['finalSmashCinematic', 'grabbed']);
      expect(Math.abs(v.pos.x - before), `gap ${gap}`).toBeLessThanOrEqual(18);
    }
  });

  it('leaves fighters outside it alone: past the far box, behind him, and over his head', () => {
    const cases: [number, number | [number, number]][] = [
      [-60, -60 + 70],
      [-60, -76],
      // On Battlefield's top platform, 47 up: the boxes reach 30.
      [-10, [5, 47.19]],
    ];
    for (const [x, spot] of cases) {
      const m = match([x, spot]);
      const [a, v] = m.fighters as [FighterState, FighterState];
      fire(m);
      const seen = playOut(m);
      expect(catches(seen), JSON.stringify(spot)).toEqual([]);
      expect(seen.filter((e) => e.type === 'hit' || e.type === 'pummel' || e.type === 'throw')).toEqual([]);
      expect([v.damage, a.action]).toEqual([0, 'idle']);
    }
  });

  it("deals Blue Falcon's 40%: the crash's 10% and the run-over's 20% held, then the final launch's 10% at BK 100, KS 135", () => {
    const m = match([-60, -40, 75]);
    const [a, v, w] = m.fighters as [FighterState, FighterState, FighterState];
    fire(m);
    step(m, FROM - 1);
    expect([a.move, v.action]).toEqual(['finalSmashCinematic', 'grabbed']);
    const damage: number[] = [];
    const frames: number[] = [];
    const held = { ...w.pos };
    let launched = false;
    for (let i = 0; i < 400 && a.move !== null; i++) {
      const before = v.damage;
      step(m, 1, [{}, { x: 100, buttons: i % 2 ? ['attack'] : [] }, { x: -100 }]);
      if (v.damage !== before) {
        damage.push(v.damage);
        frames.push(a.actionFrame);
      }
      if (a.grabPartner >= 0) expect(w.pos).toEqual(held);
      if (a.actionFrame === FULL_THROTTLE.launch.frame && a.move === 'finalSmashCinematic') {
        launched = true;
        expect(v.launch).toEqual({
          kb: knockback({ percent: 30, ...FINAL_LAUNCH, weight: 98, stale: 1.05, rage: 1 }),
          angle: 361,
          dir: 1,
          setKnockback: false,
        });
      }
    }
    expect(launched).toBe(true);
    // Three fighters, no 1v1 multiplier; the release lands fresh (x1.05).
    expect(damage).toEqual([10, 30, expect.closeTo(30 + 10 * 1.05, 6)]);
    expect(frames).toEqual([FULL_THROTTLE.crash.frame, FULL_THROTTLE.ram.frame, FULL_THROTTLE.launch.frame]);
    expect(Math.abs(damage.at(-1)! - 40)).toBeLessThanOrEqual(5);
    expect(w.damage).toBe(0);
    expect(finalSmashCinematic.holdHits).toEqual([
      { frame: 1, damage: 10, hitlag: 0 },
      { frame: 70, damage: 20, hitlag: 0 },
    ]);
    expect(finalSmashCinematic.throw).toEqual({ frame: 106, hit: { ...FINAL_LAUNCH, hitlag: 0 } });
  });

  it('keeps him intangible from the press to the end of the cinematic', () => {
    const m = match([-60, -40]);
    const a = m.fighters[0]!;
    fire(m);
    for (let i = 0; i < 400 && a.move !== null; i++) {
      expect(isIntangible(a), `${a.move}@${a.actionFrame}`).toBe(true);
      step(m, 1);
    }
    expect([a.action, isIntangible(a)]).toEqual(['idle', false]);
  });

  it("KOs within 5 points of Blue Falcon's final launch, at the ledge and at centre stage", () => {
    for (const from of ['ledge', 'centre'] as const) {
      const ours = koPercent({ hit: { fighter: 'wheely', move: 'finalSmashCinematic' }, from })!;
      const blueFalcon = koPercent({ hit: FINAL_LAUNCH, from })!;
      expect(Math.abs(ours - blueFalcon), from).toBeLessThanOrEqual(5);
    }
    // The launch lands after the 30% held: it KOs Mario at the ledge from 0%, and at centre stage from about 20%.
    expect(koPercent({ hit: FINAL_LAUNCH })!).toBeLessThan(30);
    expect(koPercent({ hit: FINAL_LAUNCH, from: 'centre' })! - 30).toBeCloseTo(20.5, 0);
  });

  it("KOs from centre stage in a real match within 5 points of Blue Falcon's, its 30% held hits included", () => {
    /** Wheely 14 left of centre, Mario at centre at `percent`: does the whole move KO him before his hitstun ends? */
    const kos = (percent: number) => {
      const m = match([-14, 0, 75], percent);
      const [a, v] = m.fighters as [FighterState, FighterState];
      fire(m);
      for (let i = 0; i < 400 && !(a.move === 'finalSmashCinematic' && a.grabPartner < 0); i++) step(m, 1);
      expect(a.actionFrame).toBe(FULL_THROTTLE.launch.frame);
      for (let i = 0; i < 600; i++) {
        if (v.hitlag <= 0 && v.launch === null && v.hitstun <= 0) return false;
        step(m, 1);
        if (v.action === 'ko') return true;
      }
      return false;
    };
    let lo = 0;
    let hi = 100;
    expect(kos(hi)).toBe(true);
    expect(kos(lo)).toBe(false);
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (kos(mid)) hi = mid;
      else lo = mid;
    }
    const blueFalcon = koPercent({ hit: FINAL_LAUNCH, from: 'centre' })! - 30;
    expect(Math.abs(hi - blueFalcon)).toBeLessThanOrEqual(5);
  });

  it('holds everyone it misses still through the cinematic, and frees them on the release', () => {
    const m = match([-60, -40, 40]);
    const [a, , w] = m.fighters as [FighterState, FighterState, FighterState];
    fire(m);
    step(m, FROM - 1);
    expect(a.move).toBe('finalSmashCinematic');
    const held = { ...w.pos };
    while (a.grabPartner >= 0) {
      step(m, 1, [{}, {}, { x: -100 }]);
      if (a.grabPartner >= 0) expect(w.pos).toEqual(held);
    }
    step(m, 10, [{}, {}, { x: -100 }]);
    expect(w.pos.x).toBeLessThan(held.x);
  });

  it('on a miss dashes about 49 units, brakes, and is actionable on frame 98; the others move from frame 28', () => {
    const m = match([-60, 60]);
    const [a, v] = m.fighters as [FighterState, FighterState];
    const x = a.pos.x;
    fire(m);
    step(m, FROM - 2);
    expect([a.actionFrame, v.pos.x]).toEqual([FROM - 1, 60]);
    step(m, 3, [{}, { x: -100 }]);
    expect(v.pos.x).toBeLessThan(60);
    step(m, finalSmash.faf - TO - 1);
    expect([a.move, a.actionFrame]).toEqual(['finalSmash', finalSmash.faf - 1]);
    expect(a.pos.x - x).toBeGreaterThan(45);
    expect(a.pos.x - x).toBeLessThan(55);
    step(m, 1);
    expect(a.action).toBe('idle');
  });

  it('stops at the end of the floor instead of driving off it', () => {
    const m = match([60, -60]);
    const a = m.fighters[0]!;
    fire(m);
    playOut(m);
    expect(a.ground).not.toBe(null);
    expect(a.pos.x).toBeLessThanOrEqual(80);
    expect(a.action).toBe('idle');
  });

  it('in the air holds his height, dashes level, catches an airborne fighter and holds it there through the cinematic', () => {
    const m = match([
      [-60, 40],
      [-25, 40],
    ]);
    const [a, v] = m.fighters as [FighterState, FighterState];
    for (const [f, x] of [
      [a, -60],
      [v, -25],
    ] as const)
      Object.assign(f, {
        pos: { x, y: 40 },
        prevPos: { x, y: 40 },
        vel: { x: 0, y: 0 },
        ground: null,
        action: 'fall',
        actionFrame: 1,
      });
    fire(m);
    expect(a.move).toBe('finalSmashAir');
    const y = a.pos.y;
    let caught = false;
    for (let i = 0; i < 400 && a.move !== null; i++) {
      step(m, 1, [{ x: 100, y: -100 }]);
      caught ||= v.action === 'grabbed';
      if (a.move !== null) expect(a.pos.y).toBe(y);
      if (v.action === 'grabbed') expect(v.pos.y).toBe(y);
    }
    expect(caught).toBe(true);
    // Two fighters: the 1v1 multiplier (x1.2) on all of it.
    expect(v.damage).toBeCloseTo(1.2 * (30 + 10 * 1.05), 6);
  });

  it('has a clip for each move on its frame data', () => {
    expect(art.clips.finalSmash?.length).toBe(finalSmash.faf - 1);
    expect(art.clips.finalSmashAir?.length).toBe(finalSmashAir.faf - 1);
    expect(art.clips.finalSmashCinematic?.length).toBe(finalSmashCinematic.faf - 1);
    expect(art.clips.finalSmashCinematic?.active).toEqual([[106, 106]]);
    for (const name of ['fxTurbo', 'fxBoom', 'fxCrash']) expect(art.rig.symbols[name], name).toBeDefined();
  });

  it("lets CPUs fire it at anyone within the Blue Falcon's 61 units in front", () => {
    expect(finalReach('wheely')).toEqual({ ahead: 61, low: -6, high: 30 });
  });

  it('a CPU holding the charge fires it at an opponent in reach and traps them', { timeout: 60_000 }, () => {
    const m = match([-60, -10]);
    const [me, opp] = m.fighters as [FighterState, FighterState];
    me.finalReady = true;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    let trapped = false;
    for (let i = 0; i < 120 && !trapped; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      trapped = m.events.some((e) => e.type === 'commandGrab' && e.attacker === 0);
    }
    expect(trapped).toBe(true);
    expect([me.move, opp.action]).toEqual(['finalSmashCinematic', 'grabbed']);
  });
});
