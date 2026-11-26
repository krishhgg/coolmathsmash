import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai/index';
import { planScenario, type GameScenario } from '../../harness/scenarios';
import { neutralInput } from '../../input/types';
import { knockback } from '../../sim/combat/formulas';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { FINAL_SMASH, finalReach } from '../../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { statusOf } from '../../sim/statuses';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { PARALYZED } from '../bob-the-robber/entities';
import { registerFighter } from '../registry';
import { art } from './art';
import { entities } from './entities';
import { FAF, REACH, STOMP, WAVE, finalSmash, finalSmashAir } from './finalSmash';
import { scenarios } from './scenarios';
import { stats } from './stats';

registerFighter(marioReference);

type Hit = Extract<SimEvent, { type: 'hit' }>;
const SPECIAL: Hold = { buttons: ['special'] };
/** Fresh: the move's first use deals x1.05 (no 1v1 multiplier with three or more players). */
const FRESH = 1.05;
/** Ganon's charge, front box (13.0.1): what the shockwave's 45% launch is, for kill percents. */
const GANON_CHARGE = { damage: 45, angle: 42, kbg: 25, bkb: 122 };

/**
 * The Duck at `duck` facing right and a Mario-weight fighter at each of `xs` facing him, on Battlefield's main stage
 * (three or more players, so no 1v1 multiplier), settled, the targets at `percent`. With `air` the Duck starts 40 up.
 * Activates the Final Smash and returns after that frame.
 */
function evolve(
  duck: number,
  xs: number[],
  opts: { percent?: number; air?: boolean; hold?: Hold[] } = {},
): { m: MatchState; d: FighterState; foes: FighterState[] } {
  const targets = xs.length === 1 ? [...xs, -78] : xs;
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'duck' }, ...targets.map(() => ({ fighter: marioReference.id }))],
  });
  [duck, ...targets].forEach((x, i) => {
    const f = m.fighters[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i === 0 ? 1 : -1 });
  });
  step(m, 30);
  const [d, ...foes] = m.fighters as [FighterState, ...FighterState[]];
  for (const f of foes) f.damage = opts.percent ?? 0;
  if (opts.air) Object.assign(d, { pos: { x: duck, y: 40 }, prevPos: { x: duck, y: 40 }, action: 'fall' });
  d.ground = opts.air ? null : d.ground;
  d.finalReady = true;
  step(m, 1, [SPECIAL, ...(opts.hold ?? [])]);
  return { m, d, foes: foes.slice(0, xs.length) };
}

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

/** Steps to the Duck's move frame `frame`, returning everything seen on the way. */
const to = (m: MatchState, d: FighterState, frame: number, holds: Hold[] = []) =>
  step(m, frame - d.actionFrame, holds);

const hits = (seen: SimEvent[], victim?: number): Hit[] =>
  seen.filter((e): e is Hit => e.type === 'hit' && (victim === undefined || e.victim === victim));

/**
 * The lowest % (to 0.5) from which the whole Final Smash KOs a Mario-weight fighter at `target` (the KO calculator's
 * rule: it crosses a blast zone before its hitstun ends), and its % when the shockwave lands then.
 */
function koFrom(duck: number, target: number): { start: number; atWave: number } {
  const trial = (percent: number) => {
    const { m, foes } = evolve(duck, [target], { percent });
    const v = foes[0]!;
    let atWave = -1;
    let stunned = false;
    for (let i = 0; i < 400; i++) {
      const before = v.damage;
      const seen = step(m, 1);
      if (hits(seen, v.port).some((h) => h.damage > 20)) atWave = before;
      if (seen.some((e) => e.type === 'ko' && e.port === v.port)) return { ko: true, atWave };
      stunned ||= atWave >= 0 && v.hitstun > 0;
      if (stunned && v.hitlag === 0 && v.hitstun <= 0) break;
    }
    return { ko: false, atWave };
  };
  let lo = 0;
  let hi = 150;
  if (trial(0).ko) return { start: 0, atWave: trial(0).atWave };
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if (trial(mid).ko) hi = mid;
    else lo = mid;
  }
  return { start: hi, atWave: trial(hi).atWave };
}

describe('Evolved Stomp (Final Smash), on Ganon, The Demon King', () => {
  it("takes Ganon's frames: the slam on 54 to 58, the charge from 128, actionable on 226", () => {
    expect([finalSmash.faf, finalSmashAir.faf]).toEqual([226, 226]);
    expect(finalSmash.air).toBe('finalSmashAir');
    for (const move of [finalSmash, finalSmashAir]) {
      expect(move.final).toBeDefined();
      expect(move.hits).toEqual([]);
      expect(move.spawn).toEqual([{ frame: 54, entity: 'stomp', x: 0, y: 0 }]);
    }
    expect(entities.stomp!.hits!.map((w) => w.frames)).toEqual([[1, 5]]);
    expect(entities.wave!.hits!.map((w) => w.frames)).toEqual([[1, WAVE.lifetime]]);
    expect(STOMP.frame).toBeGreaterThan(FINAL_SMASH.freeze + 1);

    const { m, d, foes } = evolve(-40, [-20]);
    expect([d.move, d.finalReady]).toEqual(['finalSmash', false]);
    let seen = to(m, d, STOMP.frame - 1);
    expect(hits(seen)).toEqual([]);
    expect(m.entities.filter((e) => e.kind.startsWith('duck/'))).toEqual([]);
    seen = to(m, d, STOMP.frame);
    expect(m.entities.map((e) => e.kind)).toEqual(['duck/stomp']);
    expect(hits(seen, foes[0]!.port)).toEqual([
      expect.objectContaining({ move: 'finalSmash', damage: 10 * FRESH }),
    ]);
    to(m, d, WAVE.frame - 1);
    expect(m.entities.some((e) => e.kind === 'duck/wave')).toBe(false);
    to(m, d, WAVE.frame);
    expect(m.entities.filter((e) => e.kind === 'duck/wave')).toHaveLength(1);
    to(m, d, FAF - 1);
    expect([d.move, d.actionFrame]).toEqual(['finalSmash', FAF - 1]);
    step(m, 1);
    expect(d.action).toBe('idle');
  });

  it("deals Ganon's numbers: a paralysing 10% meteor, then 45% in front and 35% behind at 42 degrees, BK 122, KS 25", () => {
    const slam = entities.stomp!.hits![0]!.boxes;
    expect(slam.map((b) => [b.x, b.y, b.radius])).toEqual([
      [50, 25, 25],
      [34, 25, 25],
      [18, 25, 25],
    ]);
    for (const b of slam)
      expect(b).toMatchObject({
        damage: 10,
        angle: 270,
        kbg: 100,
        bkb: 0,
        wbkb: 250,
        hitlag: 2,
        status: PARALYZED,
      });
    const wave = entities.wave!.hits![0]!.boxes;
    const r = WAVE.radius;
    expect(wave.map((b) => [b.id, b.x, b.y + r, b.radius, b.damage])).toEqual([
      [0, 25, 12, 10, 45],
      [1, 5, 12, 15, 35],
      [2, -7.5, 12, 15, 35],
      [3, -20, 12, 15, 35],
      [4, 13, 30, 18, 35],
      [5, -2.5, 30, 18, 35],
      [6, -18, 30, 18, 35],
    ]);
    for (const b of wave) expect(b).toMatchObject({ angle: 42, kbg: 25, bkb: 122, hitlag: 0 });
    expect(entities.waveAir!.hits).toBe(entities.wave!.hits);
  });

  it("deals a fighter in front 55% in all (Ganon's slam and charge front box), fresh, with the formula's knockback", () => {
    const { m, d, foes } = evolve(-40, [-10]);
    const v = foes[0]!;
    const seen = hits(to(m, d, 160), v.port);
    expect(seen.map((h) => h.damage)).toEqual([10 * FRESH, 45 * FRESH]);
    expect(Math.abs(v.damage / FRESH - 55)).toBeLessThanOrEqual(5);
    expect(v.damage).toBeCloseTo(55 * FRESH, 6);
    const [slam, wave] = seen as [Hit, Hit];
    expect(slam.kb).toBeCloseTo(
      knockback({ percent: 0, damage: 10, kbg: 100, bkb: 0, wbkb: 250, weight: 98 }),
      6,
    );
    const kb = knockback({ percent: 10 * FRESH, damage: 45, kbg: 25, bkb: 122, weight: 98, stale: FRESH });
    expect(wave.kb).toBeCloseTo(kb, 6);
  });

  it('pins everyone the slam covers for 90 frames, and the shockwave meets them all before they drop out', () => {
    const { m, d, foes } = evolve(-40, [-30, 0, 33]);
    to(m, d, STOMP.frame);
    for (const v of foes) expect(statusOf(v, PARALYZED)?.frames).toBe(90);
    const seen = to(m, d, STOMP.frame + 90);
    for (const v of foes) {
      const wave = hits(seen, v.port).find((h) => h.damage > 20);
      expect(wave, `foe at ${v.pos.x}`).toBeDefined();
    }
    // The last of them, 73 units in front, meets the front box on its final frame or two of paralysis.
    expect(statusOf(foes[2]!, PARALYZED)).toBeUndefined();
  });

  it("covers Ganon's area: the slam out to 75 in front, the shockwave along the floor to the ledge", () => {
    const { m, d, foes } = evolve(-40, [-30, 30, 45]);
    const [near, edge, beyond] = foes as [FighterState, FighterState, FighterState];
    const slam = hits(to(m, d, STOMP.frame + 5));
    expect(slam.map((h) => h.victim)).toEqual([near.port, edge.port]);
    expect(hits(slam, beyond.port)).toEqual([]);
    const seen = to(m, d, FAF - 1);
    expect(hits(seen, beyond.port)).toEqual([expect.objectContaining({ damage: 45 * FRESH })]);
    const gone = seen.find((e) => e.type === 'entityDestroy' && e.kind === 'duck/wave');
    expect(gone).toMatchObject({ reason: 'script' });
    // It broke up where Battlefield's main floor ends, at x 80.
    expect((gone as { x: number }).x).toBeGreaterThan(79);
    expect((gone as { x: number }).x).toBeLessThan(85);
  });

  it('leaves fighters outside it untouched: one 50 units behind him, and one in the air past the far ledge', () => {
    const { m, d, foes } = evolve(10, [-40, 130]);
    const [behind, past] = foes as [FighterState, FighterState];
    const seen: SimEvent[] = [];
    for (let f = d.actionFrame; f < FAF; f++) {
      // Hold the one past the ledge in place in the air, out where the shockwave stops short of.
      Object.assign(past, { pos: { x: 130, y: 5 }, prevPos: { x: 130, y: 5 }, vel: { x: 0, y: 0 } });
      seen.push(...step(m, 1));
    }
    expect(hits(seen, behind.port)).toEqual([]);
    expect(hits(seen, past.port)).toEqual([]);
  });

  it('is unblockable: a shield takes neither stomp', () => {
    const shield: Hold = { buttons: ['shield'] };
    const { m, d, foes } = evolve(-40, [-10], { hold: [shield] });
    const v = foes[0]!;
    expect(v.action).toBe('shield');
    const seen = to(m, d, WAVE.frame + 2, [{}, shield]);
    expect(seen.filter((e) => (e.type === 'shieldHit' || e.type === 'parry') && e.victim === v.port)).toEqual(
      [],
    );
    expect(hits(seen, v.port).map((h) => h.damage)).toEqual([10 * FRESH, 45 * FRESH]);
  });

  it('in the air holds still through the move, and the shockwave flies straight on at his height', () => {
    const { m, d } = evolve(-40, [60], { air: true });
    expect(d.move).toBe('finalSmashAir');
    const at = { ...d.pos };
    to(m, d, WAVE.frame);
    expect(d.pos).toEqual(at);
    const wave = m.entities.find((e) => e.kind === 'duck/waveAir')!;
    expect(wave.pos).toEqual({ x: at.x, y: at.y + WAVE.radius });
    step(m, 30);
    expect(wave.pos.y).toBe(at.y + WAVE.radius);
    expect(wave.pos.x - at.x).toBeCloseTo(WAVE.speed * 30, 6);
    to(m, d, FAF - 1);
    expect(d.pos).toEqual(at);
    expect(m.entities.some((e) => e.kind === 'duck/waveAir')).toBe(false);
  });

  it("KOs within 5 points of Ganon's charge from the centre, and from 0% at the ledge, as Ganon's does", () => {
    // The KO calculator's percent for Ganon's 45% front box, on the same Mario-weight target, is the % when the hit
    // lands; the Duck's own target has taken the slam's 10.5% by then.
    const centre = koPercent({ hit: GANON_CHARGE, from: 'centre' })!;
    const inMatch = koFrom(-40, 0);
    expect(centre).toBeCloseTo(40.7, 1);
    expect(Math.abs(inMatch.atWave - centre)).toBeLessThanOrEqual(5);
    expect(inMatch.start).toBeGreaterThan(20);
    expect(koPercent({ hit: GANON_CHARGE })).toBe(0);
    expect(koFrom(20, 75).start).toBe(0);
  }, 60_000);

  it('lets CPUs use it once someone is inside the slam, 75 units in front', () => {
    expect(REACH).toBe(STOMP.to + STOMP.radius);
    expect(finalReach('duck')).toEqual({ ahead: 75, low: -stats.height, high: 2 * stats.height });
    const duel = (gap: number) => {
      const m = createMatch({
        seed: 2,
        stage: 'battlefield',
        stocks: 3,
        ports: [{ fighter: 'duck' }, { fighter: marioReference.id }],
      });
      const [me, opp] = m.fighters as [FighterState, FighterState];
      for (const [f, x, facing] of [
        [me, -gap / 2, 1],
        [opp, gap / 2, -1],
      ] as const)
        Object.assign(f, {
          pos: { x, y: 1 },
          prevPos: { x, y: 1 },
          vel: { x: 0, y: 0 },
          ground: null,
          facing,
        });
      for (let i = 0; i < 20; i++) stepMatch(m, [neutralInput(), neutralInput()]);
      me.finalReady = true;
      const cpu = createCpu({ port: 0, level: 9, seed: 5 });
      for (let i = 0; i < 600; i++) {
        const ahead = (opp.pos.x - me.pos.x) * me.facing;
        stepMatch(m, [cpu.input(m), neutralInput()]);
        if (m.events.some((e) => e.type === 'finalSmash' && e.port === 0)) return { frame: i, ahead };
      }
      return null;
    };
    const near = duel(60);
    expect(near?.frame).toBeLessThan(15);
    const far = duel(150);
    expect(far).not.toBe(null);
    expect(far!.ahead).toBeLessThanOrEqual(REACH + 3);
  }, 60_000);

  it('has a clip for each version on its frame data, and the burst and shockwave drawn as props for their lives', () => {
    expect(art.clips.finalSmash?.length).toBe(FAF - 1);
    expect(art.clips.finalSmashAir?.length).toBe(FAF - 1);
    expect(art.clips.finalSmash?.active).toEqual([
      [STOMP.frame, STOMP.frame],
      [WAVE.frame, WAVE.frame],
    ]);
    const props = art.projectiles!;
    expect([props.stomp?.symbol, props.wave?.symbol, props.waveAir?.symbol]).toEqual([
      'fxBurst',
      'fxWave',
      'fxWave',
    ]);
    for (const [symbol, life] of [
      ['fxBurst', STOMP.lifetime],
      ['fxWave', WAVE.lifetime],
    ] as const) {
      const loop = art.rig.symbols[symbol] as { loop: string[]; fps: number };
      expect(loop.loop.length * (60 / loop.fps)).toBe(life);
      for (const name of loop.loop) expect(art.rig.symbols[name]).toBeDefined();
    }
  });

  it('captures its scenarios', () => {
    for (const name of ['duck-final-smash-stomp', 'duck-final-smash-wave']) {
      const s = scenarios.extra!.find((x): x is GameScenario => x.name === name)!;
      expect(planScenario(s).status, name).toBe('captured');
    }
  });
});
