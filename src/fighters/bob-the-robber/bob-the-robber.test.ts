import { describe, expect, it } from 'vitest';
import ref from '../../sim/reference/physics-constants.json';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { createMatch } from '../../sim/match';
import { koPercent, type KoHit } from '../../sim/testing/ko';
import { attack, run, runPorts, testMatch, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { stats } from './stats';

const ID = 'bob-the-robber';
/** Damage as it lands in a 1v1 match on a fresh move: Ultimate's 1.2x one-on-one and 1.05x freshness. */
const landed = (damage: number) => damage * 1.2 * 1.05;

interface Spot {
  /** How far Mario stands to Bob's right. */
  dx: number;
  /** Both airborne (aerials), Bob `dy` above Mario. */
  air?: boolean;
  dy?: number;
  /** Bob faces left, away from Mario and the ledge, so back hits send Mario toward it. */
  back?: boolean;
}

/**
 * Bob (P1) about to start `move`, with the reference Mario (P2, weight 98) at `percent` standing at Battlefield's
 * right ledge, or both in the air above it: the roster's "kill ~N%" convention (Mario at the ledge, fresh, no rage).
 */
function versusMario(move: string, percent: number, spot: Spot) {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: ID }, { fighter: 'reference-mario' }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  const facing = spot.back ? -1 : 1;
  const mx = 75;
  const bx = mx - spot.dx;
  const y = spot.air ? 30 : 0;
  const ground = spot.air ? null : a.ground;
  /** Fresh objects per fighter: the sim mutates velocities in place, so the two must not share one. */
  const common = () => ({
    vel: { x: 0, y: 0 },
    ground: ground && { ...ground },
    action: spot.air ? 'fall' : 'idle',
  });
  Object.assign(a, common(), { pos: { x: bx, y: y + (spot.dy ?? 0) }, facing, jumpsUsed: 1, intangible: 0 });
  a.prevPos = { ...a.pos };
  Object.assign(v, common(), { pos: { x: mx, y }, facing: -1, damage: percent, intangible: 0 });
  v.prevPos = { ...v.pos };
  attack(m, 0, move);
  return { m, a, v };
}

/**
 * Plays `move` out on Mario: the damage it dealt, and whether the launch carried him over the side or top blast
 * zone before he could act again (a Mario who survives the launch and then drifts or falls away was not KO'd).
 */
function strike(move: string, percent: number, spot: Spot) {
  const { m, a, v } = versusMario(move, percent, spot);
  let launched = false;
  for (let i = 0; i < 400 && v.action !== 'ko'; i++) {
    runPorts(m, 1, [{}, {}]);
    launched ||= v.launch !== null || v.hitstun > 0;
    if (launched && v.launch === null && v.hitstun <= 0 && a.move === null) break;
  }
  return { dealt: v.damage - percent, ko: v.action === 'ko' && v.pos.y > -100 };
}

/** Action frames on which `move` has a hitbox out, from a standing (or airborne) start. */
function activeFrames(move: string, air = false): number[] {
  const m = testMatch({ fighter: ID });
  const f = m.fighters[0]!;
  if (air) Object.assign(f, { pos: { x: 0, y: 60 }, prevPos: { x: 0, y: 60 }, ground: null, action: 'fall' });
  attack(m, 0, move);
  const frames: number[] = [];
  for (let i = 0; i < 120; i++) {
    run(m, 1);
    if (f.move !== move) break;
    if (activeHitboxes(f).length > 0) frames.push(f.actionFrame);
  }
  return frames;
}

describe('Bob the Robber: stats', () => {
  it('uses the roster templates: Lucario weight, Wolf walk, Hero run, Toon Link air speed, Sonic gravity, Link fall', () => {
    expect(stats).toMatchObject({
      weight: 92,
      walkSpeed: 1.208,
      dashInitialSpeed: 2.0,
      runSpeed: 1.84,
      airSpeed: 1.05,
      gravity: 0.09,
      fallSpeed: 1.6,
      fastFallSpeed: 2.56,
      jumps: 2,
      fullHopHeight: 33,
      shortHopHeight: 16,
      doubleJumpHeight: 33,
    });
    expect(stats.airAccelBase + stats.airAccelAdd).toBeCloseTo(0.08, 6);
  });
});

describe('Bob the Robber: frame data', () => {
  it.each([
    ['jab', 4],
    ['jab2', 3],
    ['jab3', 6],
    ['ftilt', 6],
    ['utilt', 6],
    ['dtilt', 6],
    ['dashAttack', 9],
    ['fsmash', 13],
    ['usmash', 10],
    ['dsmash', 7],
    ['grab', 7],
  ])('grounded %s is first active on frame %i (roster)', (move, first) => {
    expect(activeFrames(move)[0]).toBe(first);
  });

  it.each([
    ['nair', 5],
    ['fair', 7],
    ['bair', 9],
    ['uair', 6],
    ['dair', 14],
  ])('%s is first active on frame %i (roster)', (move, first) => {
    expect(activeFrames(move, true)[0]).toBe(first);
  });

  it.each([
    ['jab', 2.5],
    ['jab2', 2],
    ['jab3', 4.5],
    ['dtilt', 7],
    ['dashAttack', 10],
    ['nair', 8],
    ['bair', 12],
    ['uair', 9],
    ['dair', 13],
  ])('%s deals %s (roster)', (move, damage) => {
    expect(Math.max(...moves[move]!.hits[0]!.boxes.map((b) => b.damage))).toBe(damage);
  });

  it('the dair sack meteors on frames 14-16 only, then lingers at a normal angle', () => {
    const [meteor, late] = moves.dair!.hits;
    expect(meteor!.frames).toEqual([14, 16]);
    expect(meteor!.boxes.every((b) => b.angle > 225 && b.angle < 315)).toBe(true);
    expect(late!.boxes.every((b) => b.angle === 361)).toBe(true);
  });

  it('the standing grab reaches about 12 units in front, like Mario', () => {
    const box = moves.grab!.hits[0]!.boxes[0]!;
    expect(box.grab).toBe(true);
    expect(box.x + box.radius).toBeCloseTo(ref.grab.grab_range_mario, 6);
  });
});

describe('Bob the Robber: the baton', () => {
  it('Attack, Attack, Attack is the jab combo: two pokes and the bonk, 9% in all', () => {
    const { m, a, v } = versusMario('jab', 0, { dx: 9 });
    const seen: string[] = [];
    for (let i = 0; i < 90; i++) {
      runPorts(m, 1, [i % 6 === 0 ? { buttons: ['attack'] } : {}, {}]);
      if (a.move && seen.at(-1) !== a.move) seen.push(a.move);
      if (a.move === 'jab3') break;
    }
    expect(seen).toEqual(['jab', 'jab2', 'jab3']);
    for (let i = 0; i < 60 && a.move === 'jab3'; i++) runPorts(m, 1, [{}, {}]);
    expect(v.damage).toBeCloseTo(landed(2.5) + landed(2) + landed(4.5), 6);
  });

  it.each([
    ['ftilt', 17, 11, 10, 9, false],
    ['fsmash', 18, 18, 10, 15, false],
    ['fair', 17.5, 12, 10, 10, true],
  ] as const)('%s tips at the end of the baton and sours up close', (move, far, tip, near, sour, air) => {
    expect(strike(move, 0, { dx: far, air }).dealt).toBeCloseTo(landed(tip), 6);
    expect(strike(move, 0, { dx: near, air }).dealt).toBeCloseTo(landed(sour), 6);
  });

  it.each([
    ['utilt', 4, 7],
    ['usmash', 2, 15],
  ] as const)('%s connects every twirl on a grounded Mario', (move, dx, total) => {
    for (const percent of [0, 60]) expect(strike(move, percent, { dx }).dealt).toBeCloseTo(landed(total), 6);
  });

  it('dsmash sweeps in front, then behind', () => {
    expect(strike('dsmash', 0, { dx: 13 }).dealt).toBeCloseTo(landed(12), 6);
    expect(strike('dsmash', 0, { dx: 13, back: true }).dealt).toBeCloseTo(landed(13), 6);
  });

  it('the dair sack sends an airborne Mario straight down', () => {
    const { m, v } = versusMario('dair', 50, { dx: 1, air: true, dy: 12 });
    for (let i = 0; i < 60 && v.kb.y === 0; i++) runPorts(m, 1, [{}, {}]);
    expect(v.kb.y).toBeLessThan(0);
    expect(Math.abs(v.kb.x)).toBeLessThan(Math.abs(v.kb.y) * 0.1);
  });
});

/** One of Bob's hitboxes, by hit window and box id, as koPercent takes it. */
const hitbox = (move: string, window: number, id: number): KoHit =>
  moves[move]!.hits[window]!.boxes.find((b) => b.id === id)!;

/** Where `hit` KOs the reference Mario at Battlefield's ledge: fresh, no rage, no DI (koPercent's defaults). */
function ko(hit: KoHit, air = false): number {
  const percent = koPercent({ hit, air });
  expect(percent, 'never KOs').not.toBeNull();
  return percent!;
}

/**
 * Kill percents against Ultimate (CREW.md "Knockback values and kill percents"). Each kill move takes its angle, BKB
 * and KBG from an Ultimate move in the same role at Bob's damage (13.0.1 data), so from the same setup it must KO
 * within 5 points of that move's own numbers.
 */
describe('Bob the Robber: kill percents against Ultimate analogues (Mario at the Battlefield ledge)', () => {
  it.each(
    (
      [
        [
          'fsmash tip',
          hitbox('fsmash', 0, 2),
          false,
          "Marth's fsmash tipper",
          { damage: 18, angle: 361, kbg: 80, bkb: 80 },
        ],
        [
          'fsmash sourspot',
          hitbox('fsmash', 0, 1),
          false,
          "Lucina's fsmash",
          { damage: 15, angle: 361, kbg: 73, bkb: 65 },
        ],
        [
          'ftilt tip',
          hitbox('ftilt', 0, 2),
          false,
          "Lucina's ftilt",
          { damage: 11, angle: 361, kbg: 74, bkb: 42 },
        ],
        [
          'usmash finisher',
          hitbox('usmash', 4, 0),
          false,
          "Young Link's usmash finisher (7% box)",
          { damage: 7, angle: 100, kbg: 108, bkb: 75 },
        ],
        [
          'dsmash front',
          hitbox('dsmash', 0, 1),
          false,
          "Marth's dsmash front tipper",
          { damage: 12, angle: 361, kbg: 88, bkb: 57 },
        ],
        [
          'dsmash back',
          hitbox('dsmash', 1, 1),
          false,
          "Meta Knight's dsmash back hit",
          { damage: 13, angle: 35, kbg: 78, bkb: 50, direction: 'back' },
        ],
        [
          'dash attack',
          hitbox('dashAttack', 0, 0),
          false,
          "Marth's dash attack",
          { damage: 10, angle: 45, kbg: 55, bkb: 70 },
        ],
        ['nair', hitbox('nair', 0, 0), true, "Mario's nair", { damage: 8, angle: 361, kbg: 100, bkb: 20 }],
        [
          'fair tip',
          hitbox('fair', 0, 2),
          true,
          "Inkling's fair (12% box)",
          { damage: 12, angle: 361, kbg: 90, bkb: 30 },
        ],
        [
          'fair sourspot',
          hitbox('fair', 0, 1),
          true,
          "Inkling's fair (10% box)",
          { damage: 10, angle: 361, kbg: 90, bkb: 30 },
        ],
        [
          'bair',
          hitbox('bair', 0, 1),
          true,
          "Lucina's bair",
          { damage: 11.875, angle: 361, kbg: 90, bkb: 40, direction: 'back' },
        ],
        ['uair', hitbox('uair', 0, 0), true, "Roy's uair", { damage: 9, angle: 80, kbg: 105, bkb: 40 }],
        [
          'bthrow',
          moves.bthrow!.throw!.hit,
          false,
          "Joker's bthrow",
          { damage: 10, angle: 49, kbg: 66, bkb: 70, direction: 'back' },
        ],
      ] satisfies [string, KoHit, boolean, string, KoHit][]
    ).map(([move, hit, air, analogue, reference]) => ({ move, hit, air, analogue, reference })),
  )('$move KOs within 5 points of $analogue', ({ hit, air, reference }) => {
    expect(Math.abs(ko(hit, air) - ko(reference, air))).toBeLessThanOrEqual(5);
  });

  it('tips kill before sourspots, the fsmash tip earliest of all, and back throw is the kill throw', () => {
    const fsmashTip = ko(hitbox('fsmash', 0, 2));
    expect(fsmashTip).toBeLessThan(ko(hitbox('fsmash', 0, 1)));
    expect(ko(hitbox('ftilt', 0, 2))).toBeLessThan(ko(hitbox('ftilt', 0, 1)));
    expect(ko(hitbox('fair', 0, 2), true)).toBeLessThan(ko(hitbox('fair', 0, 1), true));
    for (const [hit, air] of [
      [hitbox('dsmash', 0, 1), false],
      [hitbox('usmash', 4, 0), false],
      [hitbox('bair', 0, 1), true],
      [hitbox('fair', 0, 2), true],
    ] as const)
      expect(fsmashTip).toBeLessThan(ko(hit, air));
    const thrown = (move: string) => koPercent({ hit: moves[move]!.throw!.hit }) ?? Infinity;
    expect(ko(moves.bthrow!.throw!.hit)).toBeLessThan(
      Math.min(thrown('fthrow'), thrown('uthrow'), thrown('dthrow')),
    );
  });
});

/**
 * Measured, not sourced. Baton Twirl Rush (side special, specials.ts) names no Ultimate analogue, and no Ultimate
 * hit has its bonk's damage, angle, BKB and KBG (5%, 45 degrees, BKB 55, KBG 110; searched in the 13.0.1 hitbox
 * data of ultimate-hitboxes.com), so there is no Ultimate kill percent to hold it to. 164.3% is what koPercent gave
 * on main when this was written: the bonk lands on Mario at the Battlefield ledge, fresh, no rage, no DI, and the
 * percent is his when it lands, after the five 1.5% carry hits. The Grappling Hook KOs only from 332.9%.
 */
describe('Bob the Robber: Baton Twirl Rush kill percent (measured, no Ultimate analogue)', () => {
  it('the bonk KOs within 5 points of its measured 164.3%', () => {
    const percent = koPercent({ hit: { fighter: ID, move: 'sideB' } });
    expect(percent).not.toBeNull();
    expect(Math.abs(percent! - 164.3)).toBeLessThanOrEqual(5);
  });
});

/** Bob (P1) at x facing `facing` holding Mario 11 units in front at `percent`. */
function holding(percent: number, x = 0, facing: 1 | -1 = 1) {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: ID }, { fighter: 'reference-mario' }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  Object.assign(a, { pos: { x, y: 0 }, facing, action: 'idle' });
  a.prevPos = { ...a.pos };
  Object.assign(v, { pos: { x: x + 11 * facing, y: 0 }, ground: a.ground, action: 'idle', facing: -facing });
  Object.assign(v, { damage: percent, intangible: 0 });
  v.prevPos = { ...v.pos };
  runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
  runPorts(m, 8, [{}, {}]);
  expect(v.action).toBe('grabbed');
  return { m, a, v };
}

describe('Bob the Robber: pummel and throws', () => {
  const inputs: [string, number, (facing: number) => Hold][] = [
    ['fthrow', 8, (s) => ({ x: 100 * s })],
    ['bthrow', 10, (s) => ({ x: -100 * s })],
    ['uthrow', 7, () => ({ y: 100 })],
    ['dthrow', 6, () => ({ y: -100 })],
  ];
  it.each(inputs)('%s deals %s (roster) and lets go on its release frame', (move, damage, hold) => {
    const t = moves[move]!.throw!;
    expect(t.hit.damage).toBe(damage);
    const { m, a, v } = holding(50);
    runPorts(m, 1, [hold(a.facing), {}]);
    expect(a.move).toBe(move);
    runPorts(m, t.frame - 2, [{}, {}]);
    expect(v.action).toBe('grabbed');
    runPorts(m, 1, [{}, {}]);
    expect(v.launch).not.toBeNull();
    expect(v.damage).toBeCloseTo(50 + landed(damage), 6);
  });

  it('pickpocket pummel deals 1.2%', () => {
    const { m, a, v } = holding(0);
    runPorts(m, 1, [{ buttons: ['attack'] }, {}]);
    expect(a.move).toBe('pummel');
    expect(v.damage).toBeCloseTo(1.2 * 1.2, 6);
  });

  it('down throw at 0% leaves Bob free to act before Mario: a combo starter', () => {
    const { m, a, v } = holding(0);
    runPorts(m, 1, [{ y: -100 }, {}]);
    expect(a.move).toBe('dthrow');
    let bobFree = 0;
    let marioFree = 0;
    for (let i = 1; i < 120 && !marioFree; i++) {
      runPorts(m, 1, [{}, {}]);
      if (!bobFree && a.action === 'idle') bobFree = i;
      if (v.launch === null && v.hitstun <= 0 && v.action !== 'grabbed') marioFree = i;
    }
    expect(bobFree).toBeGreaterThan(0);
    expect(bobFree).toBeLessThan(marioFree);
  });
});
