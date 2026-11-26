import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { neutralInput } from '../../input/types';
import { knockback } from '../../sim/combat/formulas';
import type { EntityState } from '../../sim/entities/types';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { FINAL_SMASH, finalReach } from '../../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { finalDirectTester } from '../../sim/testing/finalSmash';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { registerFighter } from '../registry';
import { art } from './art';
import { RAIN, RAIN_FRAMES, RAIN_LANES, STARSTORM_HIT, ball, finalSmash } from './finalSmash';
import './index';

registerFighter(marioReference);

/**
 * PK Starstorm, Ness's Final Smash in Ultimate, the move Ball Rain copies (SmashWiki, "PK Starstorm" and "Ness
 * (SSBU)/Final Smash"): 16 meteors spawned on frames 51 to 357, the first gap 23 frames and each later one half a
 * frame shorter (rounded up), each meteor 8% at 42 degrees, BK 67, KS 110, radius 16, active for 200 frames.
 */
const STARSTORM = {
  frames: [51, 74, 97, 119, 141, 162, 183, 203, 223, 242, 261, 279, 297, 314, 331, 347],
  last: 357,
  lifetime: 200,
  radius: 16,
};

/**
 * The analogue's KO %: one PK Starstorm meteor on the Mario reference (weight 98) on Battlefield, no DI, through
 * Ultimate's knockback and launch (sim/testing/ko.ts, which reproduces SSBU-Calculator's KO calculator within about
 * 2%). SmashWiki gives no KO % for PK Starstorm.
 */
const STARSTORM_KO = { ledge: 89.3, centre: 136.2 };

const SPECIAL: Hold = { buttons: ['special'] };
type Hit = Extract<SimEvent, { type: 'hit' }>;
const balls = (m: MatchState) => m.entities.filter((e) => e.kind === 'redball/ball');

/**
 * Red Ball at `redX` facing right, a Mario-weight target at `targetX` on the floor at `percent`, and a third fighter
 * (`third`, default the Mario reference) near the left ledge (three players: no 1v1 damage multiplier). Red Ball starts
 * Ball Rain on the last frame stepped.
 */
function rain(
  opts: {
    targetX?: number;
    percent?: number;
    redX?: number;
    air?: boolean;
    hold?: Hold;
    third?: string;
  } = {},
) {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [
      { fighter: 'redball' },
      { fighter: marioReference.id },
      { fighter: opts.third ?? marioReference.id },
    ],
  });
  const xs = [opts.redX ?? -60, opts.targetX ?? 0, -78];
  m.fighters.forEach((f, i) => {
    const x = xs[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i === 1 ? -1 : 1 });
  });
  const step = (frames: number, holds: Hold[] = []): SimEvent[] => {
    const seen: SimEvent[] = [];
    for (let i = 0; i < frames; i++) {
      stepMatch(
        m,
        m.players.map((p) => input(holds[p.port])),
      );
      seen.push(...m.events);
    }
    return seen;
  };
  step(30);
  const [a, v] = m.fighters as [FighterState, FighterState];
  v.damage = opts.percent ?? 0;
  if (opts.air)
    Object.assign(a, {
      pos: { x: a.pos.x, y: 40 },
      prevPos: { x: a.pos.x, y: 40 },
      ground: null,
      action: 'fall',
    });
  a.finalReady = true;
  step(1, [SPECIAL, opts.hold ?? {}]);
  return { m, a, v, step };
}

const hitsOn = (seen: SimEvent[], port: number) =>
  seen.filter((e): e is Hit => e.type === 'hit' && e.victim === port);

/** Does the first ball to hit the target KO it (a blast zone before its hitstun ends, as koPercent counts)? */
function firstBallKos(targetX: number, percent: number): boolean {
  const { v, step } = rain({ targetX, percent });
  for (let i = 0; i < finalSmash.faf + RAIN.lifetime; i++) {
    if (hitsOn(step(1), v.port).length === 0) continue;
    for (let j = 0; j < 600; j++) {
      if (v.action === 'ko') return true;
      if (v.hitlag <= 0 && v.launch === null && v.hitstun <= 0) return false;
      step(1);
    }
    return false;
  }
  return false;
}

/** The lowest % (to 0.1) from which the first ball KOs a Mario-weight target standing at `targetX`. */
function ballKoPercent(targetX: number): number | null {
  if (!firstBallKos(targetX, 999)) return null;
  let lo = 0;
  let hi = 9990;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (firstBallKos(targetX, mid / 10)) hi = mid;
    else lo = mid;
  }
  return hi / 10;
}

describe('Ball Rain (Final Smash), on PK Starstorm', () => {
  it("drops PK Starstorm's 16 balls on its frames: 51, then gaps of 23 shrinking by half a frame, up to 357", () => {
    expect(RAIN_FRAMES).toEqual(STARSTORM.frames);
    expect(finalSmash.faf).toBe(STARSTORM.last + 1);
    expect(finalSmash.final).toEqual({ still: true, range: 160 });
    expect(finalSmash.hits).toEqual([]);
    const gaps = RAIN_FRAMES.slice(1).map((f, i) => f - RAIN_FRAMES[i]!);
    expect(gaps).toEqual(gaps.map((_, n) => Math.ceil(23 - 0.5 * n)));
    expect(RAIN_FRAMES.at(-1)! + gaps.at(-1)! - 1).toBeGreaterThan(STARSTORM.last);

    const { m, a, step } = rain();
    const dropped: number[] = [];
    for (let i = 1; i < finalSmash.faf; i++) {
      if (step(1).some((e) => e.type === 'entitySpawn' && e.kind === 'redball/ball'))
        dropped.push(a.actionFrame);
      if (i < finalSmash.faf - 1) expect(a.move).toBe('finalSmash');
    }
    expect(dropped).toEqual(STARSTORM.frames);
    expect(a.action).toBe('idle');
    expect(balls(m).length).toBeGreaterThan(0);
  });

  it('spreads them from the top of the middle of the stage across 16 lanes, alternating sides, each faster', () => {
    expect([...RAIN_LANES].sort((p, q) => p - q)).toEqual(Array.from({ length: 16 }, (_, i) => -90 + 12 * i));
    for (let i = 1; i < RAIN_LANES.length; i++)
      expect(Math.sign(RAIN_LANES[i]!)).toBe(-Math.sign(RAIN_LANES[i - 1]!));
    // Any 4 balls in a row land in 4 different quarters of the 192-unit-wide spread.
    for (let i = 0; i + 4 <= 16; i += 4)
      expect(new Set(RAIN_LANES.slice(i, i + 4).map((x) => Math.floor((x + 96) / 48))).size).toBe(4);

    const { m, step } = rain();
    const seen = new Map<number, { at: { x: number; y: number }; cross?: number; speed: number }>();
    for (let i = 0; i < finalSmash.faf + 80; i++) {
      step(1);
      for (const e of balls(m)) {
        if (!seen.has(e.id)) seen.set(e.id, { at: { ...e.pos }, speed: Math.hypot(e.vel.x, e.vel.y) });
        const s = seen.get(e.id)!;
        if (s.cross === undefined && e.prevPos.y > 0 && e.pos.y <= 0) {
          const t = e.prevPos.y / (e.prevPos.y - e.pos.y);
          s.cross = e.prevPos.x + (e.pos.x - e.prevPos.x) * t;
        }
        expect(e.facing).toBe(e.vel.x < 0 ? -1 : 1);
      }
    }
    const order = [...seen.values()];
    expect(order).toHaveLength(16);
    for (const [i, s] of order.entries()) {
      expect(s.at).toEqual({ x: 0, y: 192 - RAIN.drop });
      expect(s.cross).toBeCloseTo(RAIN_LANES[i]!, 6);
      expect(s.speed).toBeCloseTo(RAIN.speed + RAIN.speedUp * i, 6);
    }
  });

  it("is PK Starstorm's meteor: 8%, angle 42, BK 67, KS 110, radius 16, 200 frames, unblockable and through the stage", () => {
    expect(ball.radius).toBe(STARSTORM.radius);
    expect(ball.lifetime).toBe(STARSTORM.lifetime);
    expect(ball.hits).toEqual([
      {
        frames: [1, STARSTORM.lifetime],
        boxes: [{ id: 0, x: 0, y: 0, radius: 16, damage: 8, angle: 42, kbg: 110, bkb: 67 }],
      },
    ]);
    expect([ball.pierce, ball.transcendent, ball.reflectable, ball.absorbable]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect([ball.floor, ball.wall]).toEqual(['pass', 'pass']);
  });

  it('deals 8% (x1.05 fresh) per ball, launching the way the ball flies, and 25.2% from 3 balls at centre stage', () => {
    const { m, a, v, step } = rain();
    const seen: SimEvent[] = [];
    const launches: { ball: 1 | -1; dir: 1 | -1; angle: number }[] = [];
    for (let i = 0; i < finalSmash.faf + RAIN.lifetime; i++) {
      const frame = step(1);
      seen.push(...frame);
      for (const h of hitsOn(frame, v.port))
        launches.push({
          ball: m.entities.find((e) => e.id === h.entity)!.facing,
          dir: v.launch!.dir,
          angle: v.launch!.angle,
        });
    }
    const hits = hitsOn(seen, v.port);
    expect(hits).toHaveLength(3);
    // Speed-based: each launches at 42 degrees towards the side its ball is flying.
    for (const l of launches) expect([l.dir, l.angle]).toEqual([l.ball, 42]);
    expect(launches).toHaveLength(3);
    const kb = (percent: number) =>
      knockback({ percent, damage: 8, kbg: 110, bkb: 67, weight: 98, stale: 1.05, rage: 1 });
    let percent = 0;
    for (const h of hits) {
      expect(h).toEqual(expect.objectContaining({ attacker: 0, move: 'finalSmash' }));
      expect(h.damage).toBeCloseTo(8 * 1.05, 9);
      expect(h.entity).toBeDefined();
      expect(h.kb).toBeCloseTo(kb(percent), 6);
      percent += h.damage;
    }
    expect(percent).toBeCloseTo(25.2, 6);
    // The whole rain stales the move once.
    expect(a.staleQueue.filter((n) => n === 'finalSmash')).toEqual(['finalSmash']);
    expect(m.entities.filter((e) => e.kind === 'redball/ball')).toEqual([]);
  });

  it('hands every ball of the rain the first hit’s stale multiplier: 8.4% from each, 128% raw from all 16', () => {
    expect(STARSTORM_HIT.damage * RAIN_FRAMES.length).toBe(128);
    const { m, a, step } = rain({ targetX: 40 });
    a.staleQueue = ['finalSmash', 'jab'];
    const seen = step(finalSmash.faf + RAIN.lifetime);
    const all = seen.filter((e): e is Hit => e.type === 'hit' && e.attacker === 0);
    expect(all.length).toBeGreaterThanOrEqual(3);
    // Fixed from the queue as it stood: finalSmash in slot 1, x(1 - 0.09).
    for (const h of all) expect(h.damage).toBeCloseTo(8 * 0.91, 6);
    expect(a.staleQueue.slice(0, 3)).toEqual(['finalSmash', 'finalSmash', 'jab']);
    expect(m.entities).toEqual([]);
  });

  it("keeps one stale multiplier when another fighter's Final Smash freezes the rain halfway", () => {
    const { m, a, v, step } = rain({ third: finalDirectTester.id });
    const other = m.fighters[2]!;
    // Move frame 100: balls 1 and 2 are out, ball 2 hits the target after the freeze, balls 4 and 8 drop after it.
    const seen = step(99);
    expect(a.actionFrame).toBe(100);
    other.finalReady = true;
    seen.push(...step(1, [{}, {}, SPECIAL]));
    expect(other.move).toBe('finalSmash');
    seen.push(...step(FINAL_SMASH.freeze));
    expect(a.actionFrame).toBe(101);
    seen.push(...step(finalSmash.faf + RAIN.lifetime));
    const hits = hitsOn(seen, v.port);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    for (const h of hits) expect(h.damage).toBeCloseTo(8 * 1.05, 9);
    expect(a.staleQueue.filter((n) => n === 'finalSmash')).toEqual(['finalSmash']);
  });

  it(`KOs a Mario-weight target from the ledge at ${STARSTORM_KO.ledge}% and centre stage at ${STARSTORM_KO.centre}%, as PK Starstorm's meteor does`, () => {
    const analogue = {
      ledge: koPercent({ hit: STARSTORM_HIT }),
      centre: koPercent({ hit: STARSTORM_HIT, from: 'centre' }),
    };
    expect(analogue.ledge).toBeCloseTo(STARSTORM_KO.ledge, 1);
    expect(analogue.centre).toBeCloseTo(STARSTORM_KO.centre, 1);
    expect(Math.abs(ballKoPercent(79.9)! - STARSTORM_KO.ledge)).toBeLessThanOrEqual(5);
    expect(Math.abs(ballKoPercent(0)! - STARSTORM_KO.centre)).toBeLessThanOrEqual(5);
  });

  it('goes through shields and parries: a shielding target is hit, no shield hit or parry', () => {
    const shield: Hold = { buttons: ['shield'] };
    const { v, step } = rain({ hold: shield });
    expect(v.action).toBe('shield');
    let seen: SimEvent[] = [];
    for (let i = 0; i < finalSmash.faf && hitsOn(seen, v.port).length === 0; i++)
      seen = seen.concat(step(1, [{}, shield]));
    expect(seen.filter((e) => (e.type === 'shieldHit' || e.type === 'parry') && e.victim === v.port)).toEqual(
      [],
    );
    expect(hitsOn(seen, v.port)).toEqual([expect.objectContaining({ attacker: 0, move: 'finalSmash' })]);
  });

  it('keeps raining after Red Ball acts on frame 358: the last ball is still falling', () => {
    const { m, a, step } = rain();
    step(finalSmash.faf - 2);
    expect([a.move, a.actionFrame]).toEqual(['finalSmash', finalSmash.faf - 1]);
    step(1);
    expect(a.action).toBe('idle');
    const last = balls(m).at(-1) as EntityState;
    expect(last.age).toBe(finalSmash.faf - RAIN_FRAMES.at(-1)! + 1);
    expect(last.pos.y).toBeGreaterThan(0);
  });

  it('in the air holds Red Ball still until he falls on frame 358', () => {
    const { a, step } = rain({ air: true });
    expect([a.move, a.vel]).toEqual(['finalSmash', { x: 0, y: 0 }]);
    const at = { ...a.pos };
    step(finalSmash.faf - 2);
    expect(a.pos).toEqual(at);
    expect(a.ground).toBe(null);
    step(1);
    expect(a.action).toBe('fall');
  });

  it('lets CPUs call it on anyone within 160 units in front', () => {
    expect(finalReach('redball')).toEqual({ ahead: 160, low: -11, high: 22 });
    const m = createMatch({
      seed: 2,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'redball' }, { fighter: marioReference.id }],
    });
    const [me, opp] = m.fighters as [FighterState, FighterState];
    for (const [f, x, facing] of [
      [me, -70, 1],
      [opp, 70, -1],
    ] as const)
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    for (let i = 0; i < 20; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    me.finalReady = true;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    let used = -1;
    for (let i = 0; i < 30 && used < 0; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      if (m.events.some((e) => e.type === 'finalSmash' && e.port === 0)) used = i;
    }
    expect(used).toBeGreaterThanOrEqual(0);
    expect(me.move).toBe('finalSmash');
  });

  it('has a clip on its frame data and the ball drawn in his rig as a prop', () => {
    expect(art.clips.finalSmash?.length).toBe(finalSmash.faf - 1);
    expect(art.projectiles?.ball?.symbol).toBe('fxRainBall');
    expect(art.rig.symbols.fxRainBall).toBeDefined();
  });
});
