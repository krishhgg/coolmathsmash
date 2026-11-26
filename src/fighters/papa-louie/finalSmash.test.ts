import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { knockback } from '../../sim/combat/formulas';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { finalReach, freezeOf } from '../../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { registerFighter } from '../registry';
import { art } from './art';
import { CONVEYOR, finalSmash, finalSmashCinematic, oven } from './finalSmash';
import type { SymbolLoop } from '../../render/rig/types';

registerFighter(marioReference);

const SPECIAL: Hold = { buttons: ['special'] };
const MARIO = marioReference.id;
const PAPA_X = -40;

/**
 * Papa at x -40 facing right with the charge, a Mario-weight foe `gap` units in front at `percent`, and a third
 * fighter at `third` (three players: no 1v1 damage multiplier). Everyone has settled on Battlefield's main stage.
 */
function conveyorMatch(
  gap: number,
  percent = 0,
  third = 70,
): { m: MatchState; a: FighterState; v: FighterState; w: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'papa-louie' }, { fighter: MARIO }, { fighter: MARIO }],
  });
  const xs = [PAPA_X, PAPA_X + gap, third];
  m.fighters.forEach((f, i) => {
    const x = xs[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i ? -1 : 1 });
  });
  step(m, 30);
  const [a, v, w] = m.fighters as [FighterState, FighterState, FighterState];
  for (const f of m.fighters) expect(f.action).toBe('idle');
  v.damage = percent;
  a.finalReady = true;
  return { m, a, v, w };
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

/** Step until `done` holds (at most `limit` frames); returns the events seen on the way. */
function stepUntil(m: MatchState, done: () => boolean, limit = 400): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < limit && !done(); i++) seen.push(...step(m, 1));
  return seen;
}

const hitsOn = (seen: SimEvent[], port: number) =>
  seen.filter((e) => (e.type === 'hit' || e.type === 'pummel') && e.victim === port);

describe('Conveyor Oven (Final Smash), on House of Boom', () => {
  it("takes House of Boom's timing: the others held for 23 frames, the jolt on 25-44, the catch on 45-48, FAF 120", () => {
    expect(finalSmash.final).toEqual({ freeze: 23, still: true });
    expect(freezeOf(finalSmash.final!)).toBe(23);
    expect(finalSmash.faf).toBe(119 + 1);
    expect(finalSmash.commandGrab).toBe('finalSmashCinematic');
    expect(finalSmash.hits.map((w) => w.frames)).toEqual([
      [25, 44],
      [45, 48],
    ]);
    expect(finalSmashCinematic.final).toEqual({ still: true });
  });

  it("jolts with House of Boom's pushbox: 0% at angle 40 with FKV 75 grounded and 70 aerial, and a 361 FKV 10 stun from 16 to 44", () => {
    const [ground, air, ...stun] = finalSmash.hits[0]!.boxes;
    for (const [b, wbkb, targets] of [
      [ground!, 75, 'ground'],
      [air!, 70, 'air'],
    ] as const)
      expect(b).toEqual({
        id: b.id,
        x: 16,
        y: 11,
        radius: 13,
        damage: 0,
        angle: 40,
        kbg: 100,
        bkb: 0,
        wbkb,
        hitlag: 0,
        targets,
      });
    expect(stun.map((b) => b.x)).toEqual([16, 23, 30, 37, 44]);
    for (const b of stun) {
      expect([b.y, b.radius, b.damage, b.angle, b.kbg, b.bkb, b.wbkb, b.hitlag]).toEqual([
        11, 8, 0, 361, 100, 0, 10, 2,
      ]);
      expect(b.targets).toBeUndefined();
    }
  });

  it("catches with the launcher's reach, radius 13 from 16 to 47 at 11 up: up to 60 units ahead, from -2 to 24 up", () => {
    const boxes = finalSmash.hits[1]!.boxes;
    expect(boxes.map((b) => b.x)).toEqual([16, 26.33, 36.67, 47]);
    for (const b of boxes) expect([b.y, b.radius, b.grab, b.damage]).toEqual([11, 13, true, 0]);
    expect(finalReach('papa-louie')).toEqual({ ahead: 60, low: -2, high: 24 });
  });

  it('catches a foe standing 60 units ahead on frame 45, not before, and no foe further than its reach', () => {
    const near = conveyorMatch(60);
    step(near.m, 1, [SPECIAL]);
    expect([near.a.move, near.a.finalReady]).toEqual(['finalSmash', false]);
    let seen = step(near.m, 43);
    expect(near.a.actionFrame).toBe(44);
    expect(seen.some((e) => e.type === 'commandGrab' || e.type === 'hit')).toBe(false);
    seen = step(near.m, 1);
    expect(seen.filter((e) => e.type === 'commandGrab')).toEqual([
      { type: 'commandGrab', attacker: 0, victim: 1, move: 'finalSmash' },
    ]);
    expect([near.a.action, near.a.move, near.v.action]).toEqual([
      'grabThrow',
      'finalSmashCinematic',
      'grabbed',
    ]);

    const far = conveyorMatch(70);
    step(far.m, 1, [SPECIAL]);
    seen = step(far.m, finalSmash.faf - 1);
    expect(hitsOn(seen, 1)).toEqual([]);
    expect(seen.some((e) => e.type === 'commandGrab')).toBe(false);
    expect(far.v.damage).toBe(0);
  });

  it("jolts a foe in the belt's near reach on frame 25 with the pushbox's set knockback, then catches it", () => {
    const { m, a, v } = conveyorMatch(12);
    step(m, 1, [SPECIAL]);
    step(m, 23);
    expect(a.actionFrame).toBe(24);
    const seen = step(m, 1);
    const kb = knockback({
      percent: 0,
      damage: 0,
      kbg: 100,
      bkb: 0,
      wbkb: 75,
      weight: 98,
      stale: 1,
      rage: 1,
    });
    const hits = seen.filter(
      (e): e is Extract<SimEvent, { type: 'hit' }> => e.type === 'hit' && e.victim === 1,
    );
    expect(hits).toEqual([expect.objectContaining({ damage: 0, hitlag: 0 })]);
    expect(hits[0]!.kb).toBeCloseTo(kb, 6);
    stepUntil(m, () => a.move === 'finalSmashCinematic');
    expect(v.action).toBe('grabbed');
  });

  it("pulls the catch along the belt 2.5 units a frame into Papa's hands and holds it there through the cinematic", () => {
    const { m, a, v } = conveyorMatch(58);
    step(m, 1, [SPECIAL]);
    stepUntil(m, () => a.move === 'finalSmashCinematic');
    const hands = PAPA_X + (9 + marioReference.stats.width) / 2 + 1;
    let last = v.pos.x;
    for (let f = 1; f < finalSmashCinematic.throw!.frame; f++) {
      step(m, 1, [{}, { x: 100, buttons: f % 2 ? ['attack', 'jump'] : [] }]);
      expect([v.action, a.actionFrame]).toEqual(['grabbed', f]);
      const moved = last - v.pos.x;
      last = v.pos.x;
      if (v.pos.x > hands) expect(moved).toBeCloseTo(CONVEYOR.pull, 6);
      else expect([v.pos.x, v.pos.y, v.ground !== null]).toEqual([hands, a.pos.y, true]);
    }
    expect(v.pos.x).toBe(hands);
  });

  it("deals House of Boom's 15% into the oven on 30 and its 45% final hit on 110: 62.25% with the fresh bonus, within 5 of 60%", () => {
    const { m, a, v } = conveyorMatch(30);
    step(m, 1, [SPECIAL]);
    stepUntil(m, () => a.move === 'finalSmashCinematic');
    const marks: [number, number][] = [];
    for (let i = 0; i < 200 && a.move === 'finalSmashCinematic'; i++) {
      const before = v.damage;
      step(m, 1);
      if (v.damage !== before) marks.push([a.actionFrame, v.damage]);
    }
    expect(marks).toEqual([
      [30, 15],
      [110, 15 + 45 * 1.05],
    ]);
    expect(Math.abs(v.damage - 60)).toBeLessThanOrEqual(5);
    const hit = finalSmashCinematic.throw!.hit;
    expect([hit.damage, hit.angle, hit.kbg, hit.bkb, hit.hitlag, hit.effect]).toEqual([
      45,
      35,
      34,
      60,
      undefined,
      'fire',
    ]);
    expect(finalSmashCinematic.holdHits).toEqual([{ frame: 30, damage: 15, hitlag: 0 }]);
  });

  it('holds everyone else still and untouched until the blast: a fighter out of reach and one behind Papa', () => {
    for (const third of [PAPA_X + 75, PAPA_X - 20]) {
      const { m, a, w } = conveyorMatch(30, 0, third);
      step(m, 1, [SPECIAL]);
      const seen = stepUntil(m, () => a.move === 'finalSmashCinematic');
      const at = { ...w.pos };
      for (let i = 0; i < 200 && a.grabPartner >= 0; i++) {
        seen.push(...step(m, 1, [{}, {}, { x: third > PAPA_X ? -100 : 100, buttons: ['attack'] }]));
        if (a.grabPartner >= 0) expect([w.pos, w.action]).toEqual([at, 'idle']);
      }
      expect(a.actionFrame).toBe(CONVEYOR.blast);
      expect(hitsOn(seen, 2)).toEqual([]);
      expect(w.damage).toBe(0);
    }
  });

  it("KOs Mario at the ledge from 31%, within 5 points of House of Boom's final hit, and from 62% at centre stage", () => {
    const move = { fighter: 'papa-louie', move: 'finalSmashCinematic' };
    const analogue = { damage: 45, angle: 35, kbg: 34, bkb: 60 };
    const ledge = koPercent({ hit: move })!;
    expect(Math.abs(ledge - koPercent({ hit: analogue })!)).toBeLessThanOrEqual(5);
    expect(ledge).toBeGreaterThanOrEqual(29);
    expect(ledge).toBeLessThanOrEqual(33);
    const centre = koPercent({ hit: move, from: 'centre' })!;
    expect(Math.abs(centre - koPercent({ hit: analogue, from: 'centre' })!)).toBeLessThanOrEqual(5);
    expect(centre).toBeGreaterThanOrEqual(60);
    expect(centre).toBeLessThanOrEqual(65);
  });

  it("puts the oven up round the catch on the cinematic's first frame and takes it away before Papa can act", () => {
    const { m, a } = conveyorMatch(30);
    step(m, 1, [SPECIAL]);
    stepUntil(m, () => a.move === 'finalSmashCinematic');
    expect(m.entities.some((e) => e.kind === 'papa-louie/oven')).toBe(false);
    step(m, 1);
    const e = m.entities.find((e) => e.kind === 'papa-louie/oven')!;
    expect([e.pos.x, e.pos.y, e.facing, e.final]).toEqual([a.pos.x + CONVEYOR.ovenX, a.pos.y, 1, true]);
    expect([oven.hits, oven.reflectable, oven.absorbable, oven.transcendent]).toEqual([
      [],
      false,
      false,
      true,
    ]);
    stepUntil(m, () => !m.entities.includes(e));
    expect(a.move).toBe('finalSmashCinematic');
    stepUntil(m, () => a.move === null);
    expect(a.action).toBe('idle');
  });

  it("plays all of House of Boom's 119 frames when it catches nobody, then lets Papa act", () => {
    const { m, a } = conveyorMatch(90);
    step(m, 1, [SPECIAL]);
    step(m, finalSmash.faf - 2);
    expect([a.action, a.move, a.actionFrame]).toEqual(['attack', 'finalSmash', finalSmash.faf - 1]);
    step(m, 1);
    expect(a.action).toBe('idle');
  });

  it('holds still in the air through the activation and the cinematic, and still traps a foe in reach', () => {
    const { m, a, v } = conveyorMatch(30);
    for (const f of [a, v])
      Object.assign(f, {
        pos: { x: f.pos.x, y: 50 },
        prevPos: { x: f.pos.x, y: 50 },
        ground: null,
        action: 'fall',
      });
    step(m, 1, [SPECIAL]);
    const at = { ...a.pos };
    let caught = false;
    for (let i = 0; i < 300 && a.move !== null; i++) {
      step(m, 1, [{ x: 100, y: -100 }]);
      caught ||= v.action === 'grabbed';
      if (a.move !== null) expect(a.pos).toEqual(at);
    }
    expect(caught).toBe(true);
    expect(v.damage).toBeCloseTo(15 + 45 * 1.05, 6);
  });

  it('has a clip for each move on its frame data, and the oven shuts on the 15% and blasts on the final hit', () => {
    expect(art.clips.finalSmash?.length).toBe(finalSmash.faf - 1);
    expect(art.clips.finalSmash?.active).toEqual([CONVEYOR.jolt, CONVEYOR.catch]);
    expect(art.clips.finalSmashCinematic?.length).toBe(finalSmashCinematic.faf - 1);
    expect(art.clips.finalSmashCinematic?.active).toEqual([[CONVEYOR.blast, CONVEYOR.blast]]);
    const prop = art.projectiles?.oven;
    expect(prop?.symbol).toBe('ovenFlipbook');
    const book = art.rig.symbols.ovenFlipbook as SymbolLoop;
    expect(book.fps).toBe(60);
    expect(book.loop.length).toBeGreaterThan(oven.lifetime!);
    expect(book.loop[CONVEYOR.inOven - 1]).toMatch(/^ovenOpen/);
    expect(book.loop[CONVEYOR.inOven]).toBe('ovenSlam');
    expect(book.loop[CONVEYOR.blast - 1]).toMatch(/^ovenShake/);
    expect(book.loop[CONVEYOR.blast]).toMatch(/^ovenBlast/);
    for (const name of book.loop) expect(art.rig.symbols[name], name).toBeDefined();
  });

  it('lets a CPU fire it at an opponent in its reach (finalReach), at once', () => {
    const m = createMatch({
      seed: 2,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'papa-louie' }, { fighter: MARIO }],
    });
    const [me, opp] = m.fighters as [FighterState, FighterState];
    for (const [f, x, facing] of [
      [me, -25, 1],
      [opp, 25, -1],
    ] as const)
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    step(m, 20);
    me.finalReady = true;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    let used = -1;
    for (let i = 0; i < 30 && used < 0; i++) {
      stepMatch(m, [cpu.input(m), input()]);
      if (m.events.some((e) => e.type === 'finalSmash' && e.port === 0)) used = i;
    }
    expect(used).toBeGreaterThanOrEqual(0);
    expect(used).toBeLessThan(15);
    expect(me.move).toBe('finalSmash');
    stepUntil(m, () => me.move !== 'finalSmash');
    expect([me.move, opp.action]).toEqual(['finalSmashCinematic', 'grabbed']);
  });
});
