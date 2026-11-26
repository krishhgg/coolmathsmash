import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai/index';
import { planScenario, type GameScenario } from '../../harness/scenarios';
import { neutralInput } from '../../input/types';
import { samplePose } from '../../render/rig/sample';
import { knockback } from '../../sim/combat/formulas';
import { compiledStage } from '../../sim/context';
import { destroyEntity } from '../../sim/entities/entities';
import type { EntityState } from '../../sim/entities/types';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { FINAL_SMASH, finalReach } from '../../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { registerFighter } from '../registry';
import { art } from './art';
import { shotMuzzle } from './art/fullArsenal';
import {
  ARSENAL,
  BLAST,
  REACH,
  SHOTS,
  arcHeight,
  finalSmash,
  finalSmashAir,
  fullArsenalEntities as entities,
} from './fullArsenal';
import { scenarios } from './scenarios';

registerFighter(marioReference);

type Hit = Extract<SimEvent, { type: 'hit' }>;
const SPECIAL: Hold = { buttons: ['special'] };
/** Fresh: the move's first use deals x1.05. With two players the 1v1 multiplier adds x1.2 on top. */
const FRESH = 1.05;
const ONE_V_ONE = 1.2;
/** Covering Fire's missile (rubendal/ssbu 13.0.1, `snake_missile` Explosion), for KO percents. */
const MISSILE = { damage: 15, angle: 55, kbg: 80, bkb: 100 };

/**
 * The kids at `kids` facing right and a Mario-weight fighter at each of `xs` facing them, on Battlefield, settled, the
 * foes at `percent`. With `air` the kids start `height` (default 40) up. Activates the Final Smash and returns after that frame.
 */
function arsenal(
  kids: number,
  xs: number[],
  opts: { percent?: number; air?: boolean; height?: number; hold?: Hold[] } = {},
): { m: MatchState; k: FighterState; foes: FighterState[] } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'raftwars' }, ...xs.map(() => ({ fighter: marioReference.id }))],
  });
  [kids, ...xs].forEach((x, i) => {
    const f = m.fighters[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i === 0 ? 1 : -1 });
  });
  step(m, 30);
  const [k, ...foes] = m.fighters as [FighterState, ...FighterState[]];
  for (const f of foes) f.damage = opts.percent ?? 0;
  const high = opts.height ?? 40;
  if (opts.air)
    Object.assign(k, {
      pos: { x: kids, y: high },
      prevPos: { x: kids, y: high },
      ground: null,
      action: 'fall',
    });
  k.finalReady = true;
  step(m, 1, [SPECIAL, ...(opts.hold ?? [])]);
  return { m, k, foes };
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

const hits = (seen: SimEvent[], victim?: number): Hit[] =>
  seen.filter((e): e is Hit => e.type === 'hit' && (victim === undefined || e.victim === victim));
const of = (m: MatchState, name: string): EntityState[] =>
  m.entities.filter((e) => e.kind === `raftwars/${name}`);
const spawned = (seen: SimEvent[], name: string) =>
  seen.filter((e) => e.type === 'entitySpawn' && e.kind === `raftwars/${name}`);

/** Steps until the crosshair has come and gone (the hunt is over), returning everything seen; at most `max` frames. */
function hunt(m: MatchState, holds: Hold[] = [], max = 400): SimEvent[] {
  const seen: SimEvent[] = [];
  let started = of(m, 'reticle').length > 0;
  for (let i = 0; i < max && !(started && of(m, 'reticle').length === 0); i++) {
    seen.push(...step(m, 1, holds));
    started ||= of(m, 'reticle').length > 0;
  }
  return seen;
}

/**
 * In a 1v1 on Battlefield, the lowest % (to 0.5) from which the barrage KOs a Mario-weight fighter at `foe` (the KO
 * calculator's rule: it crosses a blast zone before its hitstun ends), and its % just before the last burst then.
 */
function koFrom(kids: number, foe: number): { start: number; atLast: number } {
  const trial = (percent: number) => {
    const { m, foes } = arsenal(kids, [foe], { percent });
    const v = foes[0]!;
    let atLast = -1;
    let stunned = false;
    for (let i = 0; i < 600; i++) {
      const before = v.damage;
      const seen = step(m, 1);
      if (hits(seen, v.port).length) atLast = before;
      if (seen.some((e) => e.type === 'ko' && e.port === v.port)) return { ko: true, atLast };
      stunned ||= atLast >= 0 && v.hitstun > 0;
      if (stunned && v.hitlag === 0 && v.hitstun <= 0) break;
    }
    return { ko: false, atLast };
  };
  if (trial(0).ko) return { start: 0, atLast: trial(0).atLast };
  let lo = 0;
  let hi = 150;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if (trial(mid).ko) hi = mid;
    else lo = mid;
  }
  return { start: hi, atLast: trial(hi).atLast };
}

describe('Full Arsenal (Final Smash), on Covering Fire', () => {
  it('puts the crosshair out on frame 42, holds frame 43 while it hunts, fires on 44 to 56 and acts on 78', () => {
    expect([finalSmash.faf, finalSmashAir.faf]).toEqual([78, 78]);
    expect(finalSmash.air).toBe('finalSmashAir');
    for (const move of [finalSmash, finalSmashAir]) {
      expect(move.final).toBeDefined();
      expect(move.hits).toEqual([]);
      expect(move.spawn).toBeUndefined();
    }
    expect(ARSENAL.reticle).toBe(FINAL_SMASH.freeze + 2);
    expect(ARSENAL.fire).toEqual([44, 47, 50, 53, 56]);
    // Snake's FinalEnd is interruptible on its frame 35, from the launch.
    expect(ARSENAL.faf).toBe(ARSENAL.fire[0] + 35 - 1);

    const { m, k } = arsenal(-40, [0, 60]);
    expect([k.move, k.finalReady]).toEqual(['finalSmash', false]);
    step(m, ARSENAL.reticle - 2);
    // Nothing is out while the others are held, on frames 2 to 41.
    expect(m.entities).toEqual([]);
    let seen = step(m, 1);
    expect(k.actionFrame).toBe(ARSENAL.reticle);
    expect(spawned(seen, 'reticle')).toHaveLength(1);
    // The hunt holds the move: the kids stay on the drawing of frame 42 until the crosshair goes.
    let held = 0;
    while (of(m, 'reticle').length) {
      step(m, 1);
      held++;
      if (of(m, 'reticle').length) expect(k.actionFrame).toBe(ARSENAL.reticle);
    }
    expect(held).toBeGreaterThan(1);
    expect(held).toBeLessThanOrEqual(ARSENAL.aimFrames);
    expect(of(m, 'lockMark')).toHaveLength(ARSENAL.locks);
    seen = [];
    while (k.action === 'attack') seen.push(...step(m, 1));
    const fired = seen.filter(
      (e) => e.type === 'entitySpawn' && SHOTS.some((s) => e.kind === `raftwars/${s}`),
    );
    expect(fired.map((e) => e.type === 'entitySpawn' && e.kind)).toEqual(SHOTS.map((s) => `raftwars/${s}`));
    expect(k.action).toBe('idle');
  });

  it("hunts until five marks or Covering Fire's five seconds, and fires five shots", () => {
    expect([ARSENAL.locks, SHOTS.length, ARSENAL.aimFrames]).toEqual([5, 5, 300]);
    // Held away from everyone the crosshair marks nobody: after 300 frames it leaves its five marks where it is.
    const up: Hold = { y: 100 };
    const { m, k } = arsenal(-40, [0]);
    step(m, ARSENAL.reticle - 1, [up]);
    const reticle = of(m, 'reticle')[0]!;
    const seen = hunt(m, [up]);
    expect(reticle.age).toBe(ARSENAL.aimFrames);
    const marks = of(m, 'lockMark');
    expect(marks.map((e) => e.data.target)).toEqual([-1, -1, -1, -1, -1]);
    expect(new Set(marks.map((e) => `${e.pos.x},${e.pos.y}`)).size).toBe(1);
    expect(spawned(seen, 'lockMark')).toHaveLength(5);
    const after = step(m, ARSENAL.faf);
    expect(hits(after)).toEqual([]);
    expect(spawned(after, 'volleyBlast')).toHaveLength(5);
    expect(k.action).toBe('idle');
  });

  it('steers the crosshair with the stick at 3 units a frame, and lets go to seek the nearest foe', () => {
    const left: Hold = { x: -100 };
    const { m } = arsenal(-40, [0]);
    step(m, ARSENAL.reticle - 1, [left]);
    const reticle = of(m, 'reticle')[0]!;
    expect([reticle.pos.x, reticle.pos.y]).toEqual([-40 + ARSENAL.start.x, ARSENAL.start.y]);
    step(m, 10, [left]);
    expect(reticle.pos.x).toBeCloseTo(-40 + ARSENAL.start.x - 10 * ARSENAL.speed, 6);
    expect(reticle.pos.y).toBeCloseTo(ARSENAL.start.y, 6);
    expect(of(m, 'lockMark')).toEqual([]);
    // Let go, it closes in on the foe and marks it once every 15 frames.
    const marked: number[] = [];
    while (of(m, 'reticle').length) if (spawned(step(m, 1), 'lockMark').length) marked.push(m.frame);
    expect(marked.slice(1).map((f, i) => f - marked[i]!)).toEqual([15, 15, 15, 15]);
    expect(of(m, 'lockMark').map((e) => e.data.target)).toEqual([1, 1, 1, 1, 1]);
  });

  it('spreads its marks over three foes in front and behind, and each foe takes the shots marked on it', () => {
    const { m, foes } = arsenal(-40, [0, 40, -78]);
    hunt(m);
    const marks = of(m, 'lockMark');
    const count = (port: number) => marks.filter((e) => e.data.target === port).length;
    expect(foes.map((f) => count(f.port)).sort()).toEqual([1, 2, 2]);
    const seen = step(m, ARSENAL.faf + ARSENAL.flight);
    for (const f of foes) {
      const got = hits(seen, f.port);
      expect(got, `foe at ${f.pos.x}`).toHaveLength(count(f.port));
      for (const h of got) expect(h.damage).toBeCloseTo(BLAST.damage * FRESH, 6);
    }
  });

  it("deals Covering Fire's missile: 15% at 55 degrees, KBG 80, BKB 100, radius 23, 75% if all five land", () => {
    const burst = entities.volleyBlast!;
    expect(burst.hits).toEqual([
      {
        frames: [1, BLAST.active],
        boxes: [
          { id: 0, x: 0, y: 0, radius: 23, damage: 15, angle: 55, kbg: 80, bkb: 100, direction: 'away' },
        ],
      },
    ]);
    expect([burst.pierce, burst.transcendent, burst.reflectable, burst.absorbable]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    for (const name of SHOTS) expect(entities[name]!.hits).toBeUndefined();

    // Three players, so no 1v1 multiplier.
    const { m, foes } = arsenal(-40, [0, -78]);
    const v = foes[0]!;
    hunt(m);
    const marked = of(m, 'lockMark').filter((e) => e.data.target === v.port).length;
    const seen = hits(step(m, ARSENAL.faf + ARSENAL.flight), v.port);
    expect(seen).toHaveLength(marked);
    expect(seen.map((h) => h.damage)).toEqual(seen.map(() => BLAST.damage * FRESH));
    // Each burst is one use's: the first fixes the stale multiplier and the rest share it.
    const kb = knockback({ percent: 0, damage: 15, kbg: 80, bkb: 100, weight: 98, stale: FRESH });
    expect(seen[0]!.kb).toBeCloseTo(kb, 6);
    const total = 5 * BLAST.damage;
    expect(Math.abs(total - 75)).toBeLessThanOrEqual(5);
  });

  it('lands all five on a lone foe inside the hitlag of the one before, then launches it', () => {
    const { m, foes } = arsenal(-40, [0]);
    const v = foes[0]!;
    hunt(m);
    const at: number[] = [];
    for (let i = 0; i < ARSENAL.faf + ARSENAL.flight; i++)
      if (hits(step(m, 1), v.port).length) at.push(m.frame);
    expect(at).toHaveLength(5);
    expect(at.slice(1).map((f, i) => f - at[i]!)).toEqual([3, 3, 3, 3]);
    expect(v.damage).toBeCloseTo(5 * BLAST.damage * FRESH * ONE_V_ONE, 6);
  });

  it('is unblockable: a shield takes none of the bursts', () => {
    const shield: Hold = { buttons: ['shield'] };
    const { m, foes } = arsenal(-40, [0, -78], { hold: [shield] });
    const v = foes[0]!;
    expect(v.action).toBe('shield');
    const seen = [...hunt(m, [{}, shield]), ...step(m, ARSENAL.faf + ARSENAL.flight, [{}, shield])];
    expect(seen.filter((e) => (e.type === 'shieldHit' || e.type === 'parry') && e.victim === v.port)).toEqual(
      [],
    );
    expect(hits(seen, v.port).length).toBeGreaterThan(0);
  });

  it("KOs within 5 points of Covering Fire's missile from the centre, and from 0% by the ledge", () => {
    // The KO calculator's percent for one missile on the same Mario-weight target, the % when it lands; the
    // barrage's last burst lands on a target that has taken the other four by then.
    const centre = koPercent({ hit: MISSILE, from: 'centre' })!;
    expect(centre).toBeCloseTo(92.4, 1);
    const inMatch = koFrom(-40, 0);
    expect(Math.abs(inMatch.atLast - centre)).toBeLessThanOrEqual(5);
    expect(inMatch.start).toBeGreaterThan(10);
    expect(koFrom(40, 75).start).toBe(0);
  }, 60_000);

  it('lobs a normal-height shot on the full arc: its control point 40 above the higher end', () => {
    const { m } = arsenal(-40, [0]);
    hunt(m);
    step(m, ARSENAL.fire[0] - ARSENAL.hold + 1);
    const shot = of(m, SHOTS[0])[0]!;
    const [y0, ty, cy] = [shot.data.y0, shot.data.ty, shot.data.cy].map(Number) as [number, number, number];
    expect(cy).toBe(Math.max(y0, ty) + ARSENAL.arc);
  });

  it('keeps every shot inside the top blast zone when used high up, so all five land and no mark is left', () => {
    // In the air at y 180 on Battlefield (top blast zone 192) the muzzle is at 189.1: the full arc would peak far
    // above the blast zone, where the shots would be destroyed before they land.
    const top = compiledStage('battlefield').geo.blastZones.top;
    const { m, k, foes } = arsenal(-40, [20], { air: true, height: 180 });
    expect(k.move).toBe('finalSmashAir');
    const v = foes[0]!;
    const seen = hunt(m);
    let highest = -Infinity;
    for (let i = 0; i < ARSENAL.faf + ARSENAL.flight; i++) {
      seen.push(...step(m, 1));
      for (const e of m.entities)
        if (SHOTS.some((s) => e.kind === `raftwars/${s}`)) highest = Math.max(highest, e.pos.y);
    }
    expect(highest).toBeLessThanOrEqual(top - ARSENAL.inset);
    expect(seen.filter((e) => e.type === 'entityDestroy' && e.reason === 'blastZone')).toEqual([]);
    expect(hits(seen, v.port)).toHaveLength(5);
    expect(of(m, 'lockMark')).toEqual([]);
  });

  it('puts the crosshair inside the top blast zone when used high up, so it hunts and marks the foe below', () => {
    // Feet at y 185 on Battlefield would put the crosshair at 197, past the top blast zone at 192.
    const top = compiledStage('battlefield').geo.blastZones.top;
    const { m, foes } = arsenal(-40, [20], { air: true, height: 185 });
    const v = foes[0]!;
    const seen = step(m, ARSENAL.reticle - 1);
    const reticle = of(m, 'reticle')[0];
    expect(reticle).toBeDefined();
    expect(reticle!.pos.y).toBeLessThanOrEqual(top - ARSENAL.inset);
    seen.push(...hunt(m));
    expect(seen.filter((e) => e.type === 'entityDestroy' && e.reason === 'blastZone')).toEqual([]);
    expect(seen.filter((e) => e.type === 'entitySpawn' && e.kind === 'raftwars/lockMark')).toHaveLength(5);
    seen.push(...step(m, ARSENAL.faf + ARSENAL.flight));
    expect(hits(seen, v.port)).toHaveLength(5);
  });

  it('lowers the arc near the top so the curve peaks at the ceiling, and leaves it alone lower down', () => {
    const peak = (y0: number, c: number, y1: number) =>
      Math.max(
        ...Array.from({ length: 1001 }, (_, i) => {
          const t = i / 1000;
          return (1 - t) ** 2 * y0 + 2 * t * (1 - t) * c + t * t * y1;
        }),
      );
    // Battlefield's top blast zone is 192, so the ceiling is 180. From 120 up the full arc fits under it.
    expect(arcHeight(129.1, 7, 180)).toBe(129.1 + ARSENAL.arc);
    // From 170 up it would peak at 185.4: lowered, it peaks at the ceiling.
    const c = arcHeight(179.1, 7, 180);
    expect(c).toBeLessThan(179.1 + ARSENAL.arc);
    expect(peak(179.1, c, 7)).toBeCloseTo(180, 3);
    // With an end at the ceiling the curve rises no higher than that end.
    expect(arcHeight(180, 7, 180)).toBe(180);
  });

  it('takes a lock mark away when its shot is gone without bursting', () => {
    const { m } = arsenal(-40, [0]);
    hunt(m);
    step(m, ARSENAL.fire[0] - ARSENAL.hold + 1);
    const shot = of(m, SHOTS[0])[0]!;
    const mark = of(m, 'lockMark').find((e) => e.data.shot === shot.id)!;
    expect(mark).toBeDefined();
    destroyEntity(m, shot, 'stage');
    step(m, 1);
    expect(of(m, 'lockMark').map((e) => e.id)).not.toContain(mark.id);
    expect(of(m, 'lockMark')).toHaveLength(4);
  });

  it('in the air holds still through the hunt and the barrage, firing from higher up', () => {
    const { m, k } = arsenal(-40, [20], { air: true });
    expect(k.move).toBe('finalSmashAir');
    const at = { ...k.pos };
    hunt(m);
    expect(k.pos).toEqual(at);
    const seen = step(m, ARSENAL.fire[0] - k.actionFrame);
    expect(k.pos).toEqual(at);
    const shot = spawned(seen, SHOTS[0])[0]!;
    expect(shot).toMatchObject({ x: at.x + ARSENAL.airMuzzle.x, y: at.y + ARSENAL.airMuzzle.y });
    step(m, ARSENAL.faf - k.actionFrame - 1);
    expect([k.move, k.pos]).toEqual(['finalSmashAir', at]);
    step(m, 1);
    expect(k.action).toBe('fall');
  });

  it('lets CPUs use it with anyone up to 160 units in front, and the crosshair finds them', () => {
    expect(REACH).toBe(160);
    expect(finalReach('raftwars')?.ahead).toBe(REACH);
    const m = createMatch({
      seed: 2,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'raftwars' }, { fighter: marioReference.id }],
    });
    const [me, opp] = m.fighters as [FighterState, FighterState];
    for (const [f, x, facing] of [
      [me, -60, 1],
      [opp, 60, -1],
    ] as const)
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    for (let i = 0; i < 20; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    me.finalReady = true;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    let used = -1;
    const seen: SimEvent[] = [];
    for (let i = 0; i < 600; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      seen.push(...m.events);
      if (used < 0 && m.events.some((e) => e.type === 'finalSmash' && e.port === 0)) used = i;
    }
    expect(used).toBeGreaterThanOrEqual(0);
    expect(used).toBeLessThan(15);
    expect(hits(seen, opp.port).filter((h) => h.move?.startsWith('finalSmash'))).toHaveLength(5);
  }, 60_000);

  it('has a clip for each version on its frame data, popping the launcher at the muzzle on every shot', () => {
    for (const [name, move] of [
      ['finalSmash', finalSmash],
      ['finalSmashAir', finalSmashAir],
    ] as const) {
      const clip = art.clips[name]!;
      expect(clip.length).toBe(move.faf - 1);
      expect(clip.active).toEqual([[ARSENAL.fire[0], ARSENAL.fire[0]]]);
      const held = samplePose(art, name, ARSENAL.reticle, ARSENAL.reticle);
      // The spyglass to the brother's eye, its lens glinting on a loop through the held frame.
      const glint = (art.rig.symbols.fxPower as { loop: string[] }).loop;
      expect(held.symbols.fx2).toBe('spyglass');
      expect(glint).toContain(held.symbols.fx1);
      const muzzle = name === 'finalSmash' ? ARSENAL.muzzle : ARSENAL.airMuzzle;
      const drawn = shotMuzzle(name === 'finalSmash' ? 'ground' : 'air');
      expect(Math.hypot(drawn[0] - muzzle.x, drawn[1] - muzzle.y), name).toBeLessThan(1.6);
      for (const f of ARSENAL.fire) {
        expect(samplePose(art, name, f - 1, f - 1).symbols.flash, `${name}@${f - 1}`).toBeNull();
        const pose = samplePose(art, name, f, f);
        expect(pose.symbols.flash, `${name}@${f}`).toBe('fxPop');
        const { tx, ty } = pose.world.muzzle!;
        expect(Math.hypot(tx - muzzle.x, -ty - muzzle.y), `${name}@${f}`).toBeLessThan(1.6);
      }
    }
  });

  it('draws the crosshair, the marks, every shot and the bursts as props, each burst playing its loop once', () => {
    const props = art.projectiles!;
    expect(
      ['reticle', 'lockMark', ...SHOTS, 'volleyBlast'].map((name) => [name, props[name]?.symbol]),
    ).toEqual([
      ['reticle', 'fxReticle'],
      ['lockMark', 'fxLock'],
      ['volleyBall', 'shotBall'],
      ['volleyGrenade', 'volleyGrenade'],
      ['volleyRocket', 'volleyRocket'],
      ['volleyGrenade', 'volleyGrenade'],
      ['volleyRocket', 'volleyRocket'],
      ['volleyBlast', 'fxBlast'],
    ]);
    // A prop's loop runs on the entity's age, from 1: the burst ends on its last drawing and never wraps to its first.
    const blast = art.rig.symbols.fxBlast as { loop: string[]; fps: number };
    const drawing = (age: number) => Math.floor((age * blast.fps) / 60) % blast.loop.length;
    expect(drawing(1)).toBe(0);
    expect(drawing(BLAST.lifetime)).toBe(blast.loop.length - 1);
    expect(Math.floor(((BLAST.lifetime + 1) * blast.fps) / 60)).toBe(blast.loop.length);
    for (const name of ['fxReticle', 'fxLock', 'volleyGrenade', 'volleyRocket', 'fxBlast']) {
      const loop = art.rig.symbols[name] as { loop: string[] };
      for (const s of loop.loop) expect(art.rig.symbols[s], s).toBeDefined();
    }
  });

  it('captures its scenarios', () => {
    for (const name of ['raftwars-final-smash-hunt', 'raftwars-final-smash']) {
      const s = scenarios.extra!.find((x): x is GameScenario => x.name === name)!;
      expect(planScenario(s).status, name).toBe('captured');
    }
  });
});
