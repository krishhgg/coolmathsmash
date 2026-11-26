import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { neutralInput } from '../../input/types';
import { knockback } from '../../sim/combat/formulas';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { finalReach } from '../../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { getFighter, registerFighter } from '../registry';
import type { MoveDef } from '../types';
import { art } from './art';
import { FUZZ_FRENZY, LASH, SPIKED_BALL_HIT } from './finalSmash';

registerFighter(marioReference);

/**
 * Fluffy's moves through the registry, as the match plays them: importing moves.ts first in a test would load it
 * before the sim code it reaches through the registry (docs/fighters.md, "Adding a fighter").
 */
const move = (name: string): MoveDef => getFighter('fluffy').moves![name]!;

const SPECIAL: Hold = { buttons: ['special'] };

/** Jungle Rush's 33 hits: the catch's 12%, 18 hits of 1.2%, 13 of 1.1% and the final 14% (SmashWiki). */
const JUNGLE_RUSH_TOTAL = 12 + 18 * 1.2 + 13 * 1.1 + 14;
/** The % the catch takes before the release, in a match of three or more (no 1v1 multiplier). */
const BEFORE_RELEASE = 12 + 18 * 1.2 + 13 * 1.1;

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
 * Fluffy (P1) at x `at` facing right, the Mario reference (P2) `gap` units in front of him facing him, and a third
 * fighter (P3, the Mario reference) at x `third` (three players: no 1v1 damage multiplier). All settled on
 * Battlefield's floor, Fluffy holding the charge. `air` lifts Fluffy and P2 by that much.
 */
function frenzyMatch(o: { gap?: number; at?: number; third?: number; air?: number; percent?: number } = {}) {
  const { gap = 30, at = -40, third = 70, air = 0, percent = 0 } = o;
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'fluffy' }, { fighter: marioReference.id }, { fighter: marioReference.id }],
  });
  const xs = [at, at + gap, third];
  m.fighters.forEach((f, i) => {
    const x = xs[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i === 1 ? -1 : 1 });
  });
  step(m, 30);
  const [a, v, w] = m.fighters as [FighterState, FighterState, FighterState];
  for (const f of air ? [a, v] : []) {
    const y = f.pos.y + air;
    Object.assign(f, { pos: { x: f.pos.x, y }, prevPos: { x: f.pos.x, y }, ground: null, action: 'fall' });
    Object.assign(f, { vel: { x: 0, y: 0 }, actionFrame: 1, jumpsUsed: 1 });
  }
  v.damage = percent;
  a.finalReady = true;
  return { m, a, v, w };
}

/** Neutral special with the charge, then frames until Fluffy can act again; every event on the way. */
function frenzy(m: MatchState, holds: Hold[] = []): SimEvent[] {
  const a = m.fighters[0]!;
  const seen = step(m, 1, [SPECIAL, ...holds.slice(1)]);
  for (let i = 0; i < 600 && a.move !== null; i++) seen.push(...step(m, 1, holds));
  return seen;
}

describe("Fuzz Frenzy (Final Smash), on Donkey Kong's Jungle Rush", () => {
  it("takes Jungle Rush's timing: lash out on 29-34, a whiff actionable on 100, the cinematic on 210 with its release on 139", () => {
    const fs = move('finalSmash');
    const cinematic = move('finalSmashCinematic');
    expect(fs.faf).toBe(100);
    expect(fs.hits.map((w) => w.frames)).toEqual([[29, 34]]);
    expect(fs.commandGrab).toBe('finalSmashCinematic');
    expect(fs.final).toEqual({ freeze: 27, still: true });
    expect(cinematic.final).toEqual({ still: true });
    expect(cinematic.faf).toBe(210);
    expect(cinematic.throw?.frame).toBe(139);
    // The hold opens the lash on the first frame it can: the others are held on frames 2 to freeze + 1.
    expect(fs.hits[0]!.frames[0]).toBe(FUZZ_FRENZY.freeze + 2);
    const hits = cinematic.holdHits!;
    expect(hits[0]).toEqual({ frame: 1, damage: 12, hitlag: 5 });
    const bumps = hits.slice(1, 19);
    const rolls = hits.slice(19);
    expect(bumps.map((h) => h.frame)).toEqual(Array.from({ length: 18 }, (_, i) => 6 + 4 * i));
    expect(rolls.map((h) => h.frame)).toEqual(Array.from({ length: 13 }, (_, i) => 79 + 4 * i));
    expect(bumps.at(-1)!.frame).toBe(74);
    expect(rolls.at(-1)!.frame).toBe(127);
    for (const h of bumps) expect([h.damage, h.hitlag]).toEqual([1.2, 0.4]);
    for (const h of rolls) expect([h.damage, h.hitlag]).toEqual([1.1, 0.4]);
  });

  it("has Jungle Rush's hit area and damage: a radius-13 capsule from 8 to 28 forward at 10 up, 61.9% over 33 hits", () => {
    expect(LASH.map((b) => [b.x, b.y, b.radius, b.grab])).toEqual(
      [8, 13, 18, 23, 28].map((x) => [x, 10, 13, true]),
    );
    expect(finalReach('fluffy')).toEqual({ ahead: 41, low: -3, high: 23 });
    expect(SPIKED_BALL_HIT).toEqual({ damage: 14, angle: 70, kbg: 96, bkb: 90, hitlag: 1 });
    const cinematic = move('finalSmashCinematic');
    const total = cinematic.holdHits!.reduce((sum, h) => sum + h.damage, 0) + cinematic.throw!.hit.damage;
    // The catch and the barrage as hold hits, then the release.
    expect(cinematic.holdHits!.length + 1).toBe(33);
    expect(total).toBeCloseTo(JUNGLE_RUSH_TOTAL, 6);
    expect(JUNGLE_RUSH_TOTAL).toBeCloseTo(61.9, 6);
  });

  it('starts from neutral special with the charge, holds the others for 27 frames, and catches the foe in front on 29', () => {
    const { m, a, v, w } = frenzyMatch();
    const at = { v: { ...v.pos }, w: { ...w.pos } };
    const seen = step(m, 1, [SPECIAL]);
    expect([a.move, a.finalReady]).toEqual(['finalSmash', false]);
    expect(seen).toContainEqual(expect.objectContaining({ type: 'finalSmash', port: 0, freeze: 27 }));
    step(m, 26);
    expect(m.finalHold?.fighters).toEqual([1, 2]);
    step(m, 1);
    expect(a.actionFrame).toBe(28);
    expect(v.action).toBe('idle');
    const caught = step(m, 1);
    expect(caught).toContainEqual({ type: 'commandGrab', attacker: 0, victim: 1, move: 'finalSmash' });
    expect([a.action, a.move, v.action]).toEqual(['grabThrow', 'finalSmashCinematic', 'grabbed']);
    // Reeled in to the hold, 10 units in front; the third fighter hasn't moved.
    expect(v.pos.x - a.pos.x).toBeCloseTo(10, 6);
    expect(v.pos.x).not.toBeCloseTo(at.v.x, 1);
    expect(w.pos).toEqual(at.w);
  });

  it("deals Jungle Rush's damage in a match, 62.6% with the release fresh (within 5 of its 61.9%), then the Spiked Ball launches", () => {
    const { m, v } = frenzyMatch();
    const seen = frenzy(m);
    const chews = seen.filter((e): e is Extract<SimEvent, { type: 'pummel' }> => e.type === 'pummel');
    const want = [12, ...Array<number>(18).fill(1.2), ...Array<number>(13).fill(1.1)];
    expect(chews).toHaveLength(want.length);
    chews.forEach((e, i) => expect(e.damage).toBeCloseTo(want[i]!, 6));
    const release = seen.filter((e): e is Extract<SimEvent, { type: 'hit' }> => e.type === 'hit');
    expect(release).toHaveLength(1);
    expect(release[0]).toMatchObject({ attacker: 0, victim: 1, move: 'finalSmashCinematic', tumble: true });
    expect(release[0]!.damage).toBeCloseTo(14 * 1.05, 6);
    const kb = knockback({
      percent: BEFORE_RELEASE,
      damage: 14,
      kbg: 96,
      bkb: 90,
      weight: 98,
      stale: 1.05,
      rage: 1,
    });
    expect(release[0]!.kb).toBeCloseTo(kb, 6);
    expect(v.damage).toBeCloseTo(BEFORE_RELEASE + 14 * 1.05, 6);
    expect(Math.abs(v.damage - JUNGLE_RUSH_TOTAL)).toBeLessThanOrEqual(5);
    expect(v.action).toBe('tumble');
  });

  it('catches only the nearest foe and holds everyone else still, untouched, until the release', () => {
    // The third fighter stands 40 units in front, inside the lash's reach too, behind the one 30 units away.
    const { m, a, w } = frenzyMatch({ third: 0 });
    expect(w.pos.x - a.pos.x).toBe(40);
    step(m, 1, [SPECIAL]);
    step(m, 28);
    expect(a.move).toBe('finalSmashCinematic');
    const at = { ...w.pos };
    const seen: SimEvent[] = [];
    for (let i = 0; i < 400 && a.grabPartner >= 0; i++) {
      seen.push(...step(m, 1, [{}, {}, { x: -100, buttons: ['attack'] }]));
      if (a.grabPartner >= 0) expect(m.finalHold?.fighters).toEqual([2]);
    }
    expect(w.pos).toEqual(at);
    expect(w.damage).toBe(0);
    expect(seen.filter((e) => 'victim' in e && e.victim === 2)).toEqual([]);
    expect(seen.filter((e) => e.type === 'move' && e.port === 2)).toEqual([]);
    // Free again once the Spiked Ball lets go.
    step(m, 5, [{}, {}, { x: -100 }]);
    expect(w.pos).not.toEqual(at);
  });

  it.each([
    { where: '10 units in front', gap: 10, caught: true },
    { where: '30 units in front', gap: 30, caught: true },
    { where: '44 units in front (41 of reach and half his body)', gap: 44, caught: true },
    { where: '47 units in front', gap: 47, caught: false },
    { where: '12 units behind', gap: -12, caught: false },
  ])('a foe $where: caught $caught', ({ gap, caught }) => {
    const { m, v } = frenzyMatch({ gap });
    const seen = frenzy(m);
    expect(seen.some((e) => e.type === 'commandGrab')).toBe(caught);
    if (!caught) expect(v.damage).toBe(0);
  });

  it('catches through a shield, since a Final Smash is unblockable', () => {
    const { m, v } = frenzyMatch();
    const shield: Hold = { buttons: ['shield'] };
    step(m, 3, [{}, shield]);
    expect(v.action).toBe('shield');
    const seen = frenzy(m, [{}, shield]);
    expect(seen.filter((e) => e.type === 'shieldHit' || e.type === 'parry')).toEqual([]);
    expect(seen).toContainEqual(expect.objectContaining({ type: 'commandGrab', victim: 1 }));
    expect(v.damage).toBeGreaterThan(60);
  });

  it('whiffs with nobody in reach: nobody takes damage and Fluffy acts again on frame 100', () => {
    const { m, a, v, w } = frenzyMatch({ gap: 80 });
    step(m, 1, [SPECIAL]);
    step(m, 98);
    expect([a.move, a.actionFrame]).toEqual(['finalSmash', 99]);
    step(m, 1);
    expect(a.action).toBe('idle');
    expect([v.damage, w.damage]).toEqual([0, 0]);
  });

  it('in the air holds still through the lash and the cinematic, catches an airborne foe, then falls', () => {
    const { m, a, v } = frenzyMatch({ air: 30 });
    const at = { ...a.pos };
    step(m, 1, [SPECIAL]);
    expect(a.move).toBe('finalSmash');
    const seen: SimEvent[] = [];
    for (let i = 0; i < 400 && a.move !== null; i++) {
      seen.push(...step(m, 1));
      if (a.move) expect(a.pos).toEqual(at);
    }
    expect(seen).toContainEqual(expect.objectContaining({ type: 'commandGrab', victim: 1 }));
    expect(v.damage).toBeGreaterThan(60);
    expect(a.action).toBe('fall');
  });

  it("KOs within 5 points of Jungle Rush's final hit from the same setup, and a real one KOs where koPercent says", () => {
    const fluffy = koPercent({ hit: { fighter: 'fluffy', move: 'finalSmashCinematic' } })!;
    const analogue = koPercent({ hit: { damage: 14, angle: 70, kbg: 96, bkb: 90 } })!;
    expect(Math.abs(fluffy - analogue)).toBeLessThanOrEqual(5);
    // The release lands on the catch at the ledge (x 79.9) with BEFORE_RELEASE already added.
    const kos = (percent: number) => {
      const { m, v } = frenzyMatch({ at: 69.9, gap: 10, third: -70, percent });
      frenzy(m);
      for (let i = 0; i < 600; i++) {
        if (v.action === 'ko') return true;
        if (v.hitlag <= 0 && v.launch === null && v.hitstun <= 0) return false;
        step(m, 1);
      }
      return false;
    };
    const start = fluffy - BEFORE_RELEASE;
    expect(kos(start + 2)).toBe(true);
    expect(kos(start - 2)).toBe(false);
  });

  it('lets a CPU fire it with a foe inside its reach in front, and the lash catches them', () => {
    const reach = finalReach('fluffy')!;
    const m = createMatch({
      seed: 2,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'fluffy' }, { fighter: marioReference.id }],
    });
    const [me, opp] = m.fighters as [FighterState, FighterState];
    for (const [f, x, facing] of [
      [me, -20, 1],
      [opp, -20 + reach.ahead - 10, -1],
    ] as const)
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    for (let i = 0; i < 20; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    me.finalReady = true;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    const seen: SimEvent[] = [];
    for (let i = 0; i < 120; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      seen.push(...m.events);
    }
    const used = seen.findIndex((e) => e.type === 'finalSmash' && e.port === 0);
    expect(used).toBeGreaterThanOrEqual(0);
    expect(seen).toContainEqual({ type: 'commandGrab', attacker: 0, victim: 1, move: 'finalSmash' });
  }, 60_000);

  it('has a clip for the lash and the cinematic on their frame data, keyed on the lash and the release', () => {
    expect(art.clips.finalSmash?.length).toBe(99);
    expect(art.clips.finalSmash?.active).toEqual([[29, 34]]);
    expect(art.clips.finalSmashCinematic?.length).toBe(209);
    expect(art.clips.finalSmashCinematic?.active).toEqual([[139, 139]]);
  });
});
