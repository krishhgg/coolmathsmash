import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { neutralInput } from '../../input/types';
import { knockback } from '../../sim/combat/formulas';
import { finalReach } from '../../sim/finalSmash';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { compiledStage } from '../../sim/step';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { registerFighter } from '../registry';
import { SHIP, finalSmash, finalSmashCinematic } from './finalSmash';
import { stats } from './stats';

registerFighter(marioReference);

const SPECIAL: Hold = { buttons: ['special'] };
const MARIO = marioReference.id;
/** Battlefield's right ledge. */
const LEDGE = () => compiledStage('battlefield').geo.ledges.find((l) => l.side === 1)!;

/**
 * Snail Bob at `bob` facing right with the charge, and Mario-weight fighters at `others` (x, or [x, y] for one in the
 * air), each facing him; three or more players, so no 1v1 damage multiplier. Returns once everyone stands still.
 */
function shipMatch(bob: number | [number, number], others: (number | [number, number])[]) {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'snailbob' }, ...others.map(() => ({ fighter: MARIO }))],
  });
  const spots = [bob, ...others].map((p): [number, number] => (typeof p === 'number' ? [p, 0] : p));
  m.fighters.forEach((f, i) => {
    const [x, y] = spots[i]!;
    Object.assign(f, { pos: { x, y: y + 1 }, prevPos: { x, y: y + 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i === 0 ? 1 : x > spots[0]![0] ? -1 : 1 });
  });
  step(m, 30);
  // Anyone placed in the air is held there until the activation, so the test decides where they are.
  m.fighters.forEach((f, i) => {
    const [x, y] = spots[i]!;
    if (y === 0) return;
    Object.assign(f, { pos: { x, y }, prevPos: { x, y }, vel: { x: 0, y: 0 }, ground: null, action: 'fall' });
  });
  const [a, ...vs] = m.fighters as [FighterState, ...FighterState[]];
  a.finalReady = true;
  return { m, a, vs };
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

const where = (f: FighterState) => ({ x: f.pos.x, y: f.pos.y, action: f.action, damage: f.damage });

/**
 * The whole Final Smash on a Mario-weight fighter at `percent`, caught and held at `at` with Snail Bob a hold's reach
 * behind it, and a third fighter far behind (no 1v1 multiplier): does the launch KO it before its hitstun ends
 * (koPercent's rule)?
 */
function kos(at: number, percent: number): boolean {
  const reach = (stats.width + marioReference.stats.width) / 2 + 1;
  const { m, a, vs } = shipMatch(at - reach, [at - 1, -70]);
  const v = vs[0]!;
  v.damage = percent;
  step(m, 1, [SPECIAL]);
  let thrown = false;
  for (let i = 0; i < 300 && !thrown; i++) thrown = step(m, 1).some((e) => e.type === 'throw');
  expect([thrown, a.move]).toEqual([true, 'finalSmashCinematic']);
  for (let i = 0; i < 600; i++) {
    if (v.action === 'ko') return true;
    if (v.hitlag <= 0 && v.launch === null && v.hitstun <= 0) return false;
    step(m, 1);
  }
  return false;
}

describe('Shell Ship (Final Smash), on the Blue Falcon', () => {
  it("takes the Blue Falcon's frames: the swoop catches on 28-30, a whiff is actionable on 98, the freeze ends before it", () => {
    expect(finalSmash.faf).toBe(98);
    expect(finalSmash.hits.map((w) => w.frames)).toEqual([[28, 30]]);
    expect(finalSmash.final).toEqual({ freeze: 26, still: true });
    expect(finalSmash.commandGrab).toBe('finalSmashCinematic');
    expect(finalSmash.air).toBeUndefined();
    // Nothing may come out while the others are held, frames 2 to freeze + 1.
    expect(SHIP.catch[0]).toBe(SHIP.freeze + 2);
    expect(finalSmashCinematic.final).toBeDefined();
    expect(finalSmashCinematic.holdHits!.map((h) => h.frame)).toEqual([SHIP.swoop, SHIP.laser]);
    expect(finalSmashCinematic.throw!.frame).toBe(SHIP.launch);
    expect(SHIP.launch).toBeLessThan(finalSmashCinematic.faf);
  });

  it("catches with the Blue Falcon's three boxes, 13, 30 and 45 ahead at height 12, radius 16, 18 and 16", () => {
    const boxes = finalSmash.hits[0]!.boxes;
    expect(boxes.map(({ id, x, y, radius, grab }) => ({ id, x, y, radius, grab }))).toEqual([
      { id: 0, x: 13, y: 12, radius: 16, grab: true },
      { id: 1, x: 30, y: 12, radius: 18, grab: true },
      { id: 2, x: 45, y: 12, radius: 16, grab: true },
    ]);
  });

  it("deals the Blue Falcon's 10%, 20% and 10% launch, 40% in all ('Deals 40% if all hits connect')", () => {
    const holds = finalSmashCinematic.holdHits!;
    expect(holds.map((h) => [h.damage, h.hitlag])).toEqual([
      [10, 0],
      [20, 0],
    ]);
    const launch = finalSmashCinematic.throw!.hit;
    expect(launch).toEqual({ damage: 10, angle: 361, kbg: 135, bkb: 100, hitlag: 0 });
    expect(holds.reduce((t, h) => t + h.damage, 0) + launch.damage).toBe(40);
  });

  it('catches a fighter 40 units ahead on frame 28, holds everyone else through the cinematic and launches it', () => {
    const { m, a, vs } = shipMatch(-60, [-20, 60]);
    const [v, w] = vs as [FighterState, FighterState];
    let seen = step(m, 1, [SPECIAL]);
    expect([a.move, a.finalReady]).toEqual(['finalSmash', false]);
    expect(seen.find((e) => e.type === 'finalSmash')).toEqual(
      expect.objectContaining({ port: 0, freeze: SHIP.freeze }),
    );
    seen = step(m, SHIP.catch[0] - 2);
    expect(a.actionFrame).toBe(SHIP.catch[0] - 1);
    expect(seen.some((e) => e.type === 'commandGrab')).toBe(false);
    seen = step(m, 1);
    expect(seen.filter((e) => e.type === 'commandGrab')).toEqual([
      { type: 'commandGrab', attacker: 0, victim: 1, move: 'finalSmash' },
    ]);
    expect([a.action, a.move, v.action]).toEqual(['grabThrow', 'finalSmashCinematic', 'grabbed']);
    const held = where(w);
    const dealt: [number, number][] = [];
    let launched = -1;
    for (let i = 0; i < 300 && launched < 0; i++) {
      const before = v.damage;
      seen = step(m, 1, [{}, { x: 100, buttons: i % 2 ? ['attack'] : [] }, { x: -100, buttons: ['jump'] }]);
      if (v.damage !== before) dealt.push([a.actionFrame, v.damage]);
      if (seen.some((e) => e.type === 'throw')) launched = a.actionFrame;
      else expect(where(w)).toEqual(held);
    }
    // Three players: no 1v1 multiplier. The two hold hits land as they are, the launch fresh (x1.05).
    expect(dealt).toEqual([
      [SHIP.swoop, 10],
      [SHIP.laser, 30],
      [SHIP.launch, expect.closeTo(30 + 10 * 1.05, 6)],
    ]);
    expect(launched).toBe(SHIP.launch);
    const kb = knockback({ percent: 30, damage: 10, kbg: 135, bkb: 100, weight: 98, stale: 1.05, rage: 1 });
    expect(v.launch).toEqual(expect.objectContaining({ kb, dir: 1 }));
    step(m, finalSmashCinematic.faf - SHIP.launch - 1);
    expect(a.move).toBe('finalSmashCinematic');
    step(m, 1);
    expect(a.action).toBe('idle');
  });

  it('leaves foes outside its boxes untouched: behind him, past the far box, and above the swoop', () => {
    // The far box's front edge is 61 ahead; Mario is 8 wide, so one standing 69 ahead is clear of it.
    const { m, a, vs } = shipMatch(-40, [-60, 29, [-10, 50], -12]);
    const [behind, far, above, v] = vs as [FighterState, FighterState, FighterState, FighterState];
    step(m, 1, [SPECIAL]);
    const outside = [behind, far, above];
    const before = outside.map((f) => f.damage);
    step(m, SHIP.catch[1] + 1);
    expect([a.grabPartner, v.action]).toEqual([v.port, 'grabbed']);
    for (let i = 0; i < 200 && a.move; i++) step(m, 1);
    expect(outside.map((f) => f.damage)).toEqual(before);
    expect(outside.map((f) => f.action)).not.toContain('grabbed');
    expect(v.damage).toBeGreaterThan(40);
  });

  it('catches only the nearest of two fighters in its boxes; the other holds still and takes nothing', () => {
    const { m, a, vs } = shipMatch(-60, [-20, -40]);
    const [far, near] = vs as [FighterState, FighterState];
    step(m, 1, [SPECIAL]);
    step(m, SHIP.catch[0]);
    expect([a.grabPartner, near.action, far.action]).toEqual([near.port, 'grabbed', 'idle']);
    const held = where(far);
    for (let i = 0; i < 200 && a.move; i++) {
      step(m, 1, [{}, { x: -100 }]);
      if (a.grabPartner >= 0) expect(where(far)).toEqual(held);
    }
    expect(far.damage).toBe(0);
  });

  it('catches through a shield, as unblockable Final Smashes do', () => {
    const { m, a, vs } = shipMatch(-60, [-30]);
    const v = vs[0]!;
    const shield: Hold = { buttons: ['shield'] };
    step(m, 1, [SPECIAL, shield]);
    step(m, SHIP.catch[0] - 1, [{}, shield]);
    expect([a.grabPartner, v.action]).toEqual([v.port, 'grabbed']);
  });

  it('whiffs with nobody in reach: the others move again after the freeze and Snail Bob acts on frame 98', () => {
    const { m, a, vs } = shipMatch(-60, [60]);
    const v = vs[0]!;
    step(m, 1, [SPECIAL]);
    step(m, SHIP.freeze);
    const x = v.pos.x;
    step(m, 10, [{}, { x: -100 }]);
    expect(v.pos.x).toBeLessThan(x);
    step(m, SHIP.faf - SHIP.freeze - 12, [{}, { x: 100 }]);
    expect([a.move, a.actionFrame]).toEqual(['finalSmash', SHIP.faf - 1]);
    step(m, 1);
    expect([a.action, a.grabPartner]).toEqual(['idle', -1]);
  });

  it('holds still in the air and still catches an airborne fighter in its boxes, at full size', () => {
    const { m, a, vs } = shipMatch([-40, 50], [[-5, 52]]);
    const v = vs[0]!;
    step(m, 1, [SPECIAL]);
    const at = { ...a.pos };
    expect(a.ground).toBe(null);
    for (let i = 0; i < 200 && a.move; i++) {
      step(m, 1);
      if (a.move) expect(a.pos).toEqual(at);
    }
    expect(v.damage).toBeGreaterThan(40);
  });

  it("KOs a Mario-weight fighter within 5 points of the Blue Falcon's launch, at the ledge and from the centre", () => {
    // The analogue's own launch (10%, 361°, KS 135, BK 100) from the same setups, as the % the victim has when it lands.
    const launch = { damage: 10, angle: 361, kbg: 135, bkb: 100 };
    const move = { fighter: 'snailbob', move: 'finalSmashCinematic' };
    const ledge = koPercent({ hit: move })!;
    const centre = koPercent({ hit: move, from: 'centre' })!;
    expect(Math.abs(ledge - koPercent({ hit: launch })!)).toBeLessThanOrEqual(5);
    expect(Math.abs(centre - koPercent({ hit: launch, from: 'centre' })!)).toBeLessThanOrEqual(5);
    // Its two hold hits add 30% first, so whoever it catches at the ledge is launched past the 20% it needs there.
    expect(ledge).toBeLessThan(30);
    expect(centre).toBeGreaterThan(30);
    expect(kos(LEDGE().x - 0.1, 0)).toBe(true);
    // The whole Final Smash, live, from the centre: KO'd from about centre - 30 when caught.
    const start = centre - 30;
    expect(kos(0, start + 3)).toBe(true);
    expect(kos(0, start - 3)).toBe(false);
  });

  it('lets CPUs use it with someone inside the swoop: 61 units ahead, from 6 below his feet to 30 above', () => {
    expect(finalReach('snailbob')).toEqual({ ahead: 61, low: -6, high: 30 });
    const m = createMatch({
      seed: 2,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'snailbob' }, { fighter: MARIO }],
    });
    const [me, opp] = m.fighters as [FighterState, FighterState];
    for (const [f, x, facing] of [
      [me, -30, 1],
      [opp, 20, -1],
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
    expect(used).toBeLessThan(15);
    expect(me.move).toBe('finalSmash');
  });
});
