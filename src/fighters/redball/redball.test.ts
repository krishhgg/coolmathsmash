import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import { DASH_SPEED_KEEP_FRAMES } from '../../sim/constants';
import type { FighterState } from '../../sim/fighter';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { koPercent, type KoHit, type KoSetup } from '../../sim/testing/ko';
import { versusMario } from './versus';
import { DAIR_DROP_FRAME, moves } from './moves';
import { stats } from './stats';

const redball = () => testMatch({ fighter: 'redball' });

describe('Red Ball: attributes (roster sheet)', () => {
  it('has the roster stats: weight 82, 4 jumps, slow dash into a high top speed, floaty fall', () => {
    expect(stats).toMatchObject({
      weight: 82,
      walkSpeed: 1.0,
      dashInitialSpeed: 1.65,
      runSpeed: 2.2,
      airSpeed: 1.281,
      gravity: 0.08,
      fallSpeed: 1.4,
      fastFallSpeed: 2.24,
      jumps: 4,
      fullHopHeight: 34,
      shortHopHeight: 16.5,
      doubleJumpHeight: 28,
    });
    expect(stats.airAccelBase + stats.airAccelAdd).toBeCloseTo(0.12, 6);
  });

  it('jumps three times in the air, then has no jump left', () => {
    const m = redball();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['jump'] });
    run(m, 20, { buttons: ['jump'] });
    expect(f.ground).toBeNull();
    for (let i = 0; i < 3; i++) {
      run(m, 12);
      const before = f.vel.y;
      run(m, 1, { buttons: ['jump'] });
      expect(f.vel.y).toBeGreaterThan(before);
    }
    expect(f.jumpsUsed).toBe(4);
    run(m, 12);
    const vy = f.vel.y;
    run(m, 1, { buttons: ['jump'] });
    expect(f.vel.y).toBeLessThan(vy);
  });

  it('rolls up to top speed slowly: about 30 frames from the end of the dash speed hold', () => {
    const m = redball();
    const f = m.fighters[0]!;
    // The run acceleration starts once the dash stops holding its speed (Ultimate's dash_speed_keep_frame).
    until(m, (g) => g.action === 'dash' && g.actionFrame === DASH_SPEED_KEEP_FRAMES, { x: 100 });
    const frames = until(m, (g) => Math.abs(g.vel.x) >= stats.runSpeed - 1e-9, { x: 100 });
    expect(frames).toBeGreaterThanOrEqual(26);
    expect(frames).toBeLessThanOrEqual(34);
    expect(f.action).toBe('run');
  });
});

/** The frames on which `move` has hitboxes out, playing it from standing (or high in the air for aerials). */
function activeFrames(move: string): number[] {
  const m = redball();
  const f = moves[move]!.kind === 'aerial' ? placeInAir(m, 0, 120) : m.fighters[0]!;
  attack(m, 0, move);
  const active: number[] = [];
  for (let i = 0; i < moves[move]!.faf + 5 && f.move === move; i++) {
    run(m, 1);
    if (f.move === move && activeHitboxes(f).length > 0) active.push(f.actionFrame);
  }
  return active;
}

describe('Red Ball: frame data (roster sheet)', () => {
  // Dash attack, down smash, back air and back throw deal their Ultimate analogue's damage (KILLS below).
  it.each([
    ['jab', 3, 2],
    ['jab2', 3, 2],
    ['jab3', 4, 3],
    ['ftilt', 6, 8],
    ['utilt', 5, 7],
    ['dtilt', 5, 6],
    ['dashAttack', 6, 12],
    ['fsmash', 15, 16],
    ['usmash', 11, 15],
    ['dsmash', 9, 12],
    ['nair', 4, 8],
    ['fair', 8, 10],
    ['bair', 7, 13],
    ['uair', 5, 9],
    ['dair', 12, 14],
    ['grab', 10, 0],
  ] as const)('%s is first active on frame %i and its strongest hit deals %i%%', (move, first, damage) => {
    expect(activeFrames(move)[0]).toBe(first);
    const strongest = Math.max(...moves[move]!.hits.flatMap((w) => w.boxes.map((b) => b.damage)));
    expect(strongest).toBe(damage);
  });

  it.each([
    ['pummel', 1],
    ['fthrow', 8],
    ['bthrow', 11],
    ['uthrow', 8],
    ['dthrow', 7],
  ] as const)('%s deals %i%%', (move, damage) => {
    const def = moves[move]!;
    expect(def.pummel?.damage ?? def.throw?.hit.damage).toBe(damage);
  });

  it('Attack three times is bump, bump, lick: 2 + 2 + 3%', () => {
    const { m, a, v } = versusMario();
    Object.assign(v, { pos: { x: a.pos.x + 8 * a.facing, y: a.pos.y }, intangible: 0 });
    v.prevPos = { ...v.pos };
    const moves: string[] = [];
    for (let i = 0; i < 60; i++) {
      runPorts(m, 1, [i % 8 === 0 ? { buttons: ['attack'] } : {}, {}]);
      if (a.move && a.move !== moves[moves.length - 1]) moves.push(a.move);
    }
    expect(moves).toEqual(['jab', 'jab2', 'jab3']);
    expect(v.damage).toBeCloseTo((2 + 2 + 3) * 1.05 * 1.2, 6);
  });

  it('each move plays out to its first actionable frame', () => {
    for (const move of ['jab', 'ftilt', 'fsmash', 'dsmash', 'grab']) {
      const m = redball();
      const f = m.fighters[0]!;
      attack(m, 0, move);
      run(m, moves[move]!.faf - 1);
      expect(f.move, move).toBe(move);
      run(m, 1);
      expect(f.action, move).toBe('idle');
    }
  });
});

/**
 * Kill moves on the Mario reference standing at Battlefield's ledge (CREW.md, "Knockback values and kill percents").
 * Each copies the hit of an Ultimate analogue (13.0.1, SmashWiki hitbox data): Jigglypuff, whom he plays like, for
 * the forward and up smash, dash attack and back air; Sonic's two-sided split kick for the down smash; Mario's back
 * throw for his kill throw. So each must KO within 5% of the analogue's own hit from the same setup.
 */
const KILLS: [move: string, analogue: string, hit: KoHit][] = [
  ['fsmash', "Jigglypuff's forward smash", { damage: 16, angle: 361, bkb: 10, kbg: 110 }],
  ['bair', "Jigglypuff's back air", { damage: 13, angle: 42, bkb: 30, kbg: 120 }],
  ['dsmash', "Sonic's down smash", { damage: 12, angle: 30, bkb: 50, kbg: 80 }],
  ['dashAttack', "Jigglypuff's dash attack", { damage: 12, angle: 43, bkb: 57, kbg: 83 }],
  ['usmash', "Jigglypuff's up smash", { damage: 15, angle: 87, bkb: 20, kbg: 100 }],
  ['bthrow', "Mario's back throw", { damage: 11, angle: 45, bkb: 70, kbg: 66 }],
];

const ko = (move: string) => koPercent({ hit: { fighter: 'redball', move } }) ?? Infinity;

describe('Red Ball: kill moves on Mario at the Battlefield ledge (Ultimate analogues)', () => {
  it.each(KILLS)('%s KOs within 5%% of %s', (move, _analogue, hit) => {
    expect(Math.abs(ko(move) - koPercent({ hit })!)).toBeLessThanOrEqual(5);
  });

  it('forward smash and back air kill first, then down smash and dash attack, then up smash, back throw last', () => {
    const [fsmash, bair, dsmash, dashAttack, usmash, bthrow] = KILLS.map(([move]) => ko(move)) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    expect(Math.max(fsmash, bair)).toBeLessThan(Math.min(dsmash, dashAttack));
    expect(Math.max(dsmash, dashAttack)).toBeLessThan(usmash);
    expect(usmash).toBeLessThan(bthrow);
  });

  it('forward throw and the tilts do not kill before 150%', () => {
    for (const move of ['fthrow', 'ftilt', 'utilt']) expect(ko(move), move).toBeGreaterThan(150);
  });
});

/**
 * Measured, not sourced. Forward air, up air, down air and the Charge Roll name no Ultimate analogue: moves.ts gives
 * the aerials "Ultimate-style knockback for moves of their size and speed", and specials.ts models the charge on
 * Sonic's spin charge without copying its hits. No Ultimate hit has their damage, angle, BKB and KBG (searched in
 * the 13.0.1 hitbox data of ultimate-hitboxes.com), so there is no Ultimate kill percent to hold them to. These are
 * the percents koPercent gave on main when they were written, so a change to their knockback shows up here. Mario
 * reference, Battlefield, fresh, no rage, no DI: at the ledge, airborne for the aerials, and the down air's meteor
 * 10 units past the ledge, where a downward hit can KO.
 */
const MEASURED: [move: string, measured: number, setup: Pick<KoSetup, 'air' | 'from'>][] = [
  ['fair', 138.6, { air: true }],
  ['uair', 157.8, { air: true }],
  ['dair', 59.2, { air: true, from: { x: 90, y: 0 } }],
  ['chargeRoll1', 206.2, {}],
  ['chargeRoll2', 122.7, {}],
  ['chargeRoll3', 78.3, {}],
];

describe('Red Ball: kill percents with no Ultimate analogue (measured)', () => {
  it.each(MEASURED)('%s KOs within 5 points of its measured %d%%', (move, measured, setup) => {
    const percent = koPercent({ hit: { fighter: 'redball', move }, ...setup });
    expect(percent).not.toBeNull();
    expect(Math.abs(percent! - measured)).toBeLessThanOrEqual(5);
  });

  it('a longer rev rolls into a harder hit: each Charge Roll tier KOs at least 40 points earlier', () => {
    const [roll1, roll2, roll3] = MEASURED.slice(3).map(([move]) => ko(move));
    expect(roll2! + 40).toBeLessThan(roll1!);
    expect(roll3! + 40).toBeLessThan(roll2!);
  });
});

describe('Red Ball: down air (Cube Squash)', () => {
  /** Red Ball dropping onto Mario from `height` above him, both above the main stage. */
  function squash(height: number) {
    const { m, a, v } = versusMario();
    Object.assign(a, {
      pos: { x: 0, y: 40 + height },
      prevPos: { x: 0, y: 40 + height },
      vel: { x: 0, y: 0 },
      ground: null,
      action: 'fall',
      jumpsUsed: 3,
      facing: 1,
    });
    Object.assign(v, {
      pos: { x: 0, y: 40 },
      prevPos: { x: 0, y: 40 },
      vel: { x: 0, y: 0 },
      ground: null,
      action: 'fall',
      damage: 50,
      intangible: 0,
    });
    return { m, a, v };
  }

  /** Red Ball falling high above the stage, already fast-falling or not, then down + Attack. */
  function dairFrom(fastFalling: boolean) {
    const m = redball();
    const f = placeInAir(m, 0, 120);
    run(m, 10);
    if (fastFalling) {
      run(m, 1, { y: -100 });
      run(m, 4);
      expect(f.fastFalling).toBe(true);
    }
    run(m, 1, { y: -100, buttons: ['attack'] });
    expect(f.move).toBe('dair');
    return { m, f };
  }

  it.each([false, true])(
    'hangs through the wind-up, fast-falling before or not (%s), then drops at fast-fall speed',
    (fastFalling) => {
      const { m, f } = dairFrom(fastFalling);
      const y0 = f.pos.y;
      for (let i = 1; i < DAIR_DROP_FRAME - 1; i++) {
        run(m, 1, { y: -100 });
        expect(f.fastFalling).toBe(false);
      }
      expect(Math.abs(y0 - f.pos.y)).toBeLessThan(0.2);
      run(m, 3);
      expect(f.vel.y).toBeCloseTo(-stats.fastFallSpeed, 6);
    },
  );

  it('started just above the floor, it hovers through the wind-up, then drops and lands with its 18 frames of lag', () => {
    const m = redball();
    const f = placeInAir(m, 0, 0.1);
    attack(m, 0, 'dair');
    run(m, DAIR_DROP_FRAME - 1);
    expect(f.ground).toBeNull();
    until(m, (g) => g.ground !== null);
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(18);
  });

  it('the clean hit meteors, and Red Ball bounces back up with a midair jump back and can act', () => {
    const { m, a, v } = squash(14);
    attack(m, 0, 'dair');
    let hitFrame = 0;
    for (let i = 0; i < 40 && !hitFrame; i++) {
      runPorts(m, 1, [{}, {}]);
      if (v.damage > 50) hitFrame = a.actionFrame;
    }
    expect(hitFrame).toBeGreaterThanOrEqual(12);
    expect(hitFrame).toBeLessThanOrEqual(14);
    until(m, () => v.launch === null && v.kb.y !== 0);
    expect(v.kb.y).toBeLessThan(0);
    runPorts(m, 1, [{}, {}]);
    expect(a.action).toBe('fall');
    expect(a.vel.y).toBeGreaterThan(0);
    expect(a.jumpsUsed).toBe(2);
  });
});

describe('Red Ball: grabs and throws', () => {
  /** Red Ball holding Mario at `percent`. */
  function holding(percent: number) {
    const { m, a, v } = versusMario();
    Object.assign(v, { pos: { x: a.pos.x + 10 * a.facing, y: a.pos.y }, action: 'idle', ground: a.ground });
    v.prevPos = { ...v.pos };
    Object.assign(v, { damage: percent, intangible: 0, facing: -a.facing });
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    for (let i = 0; i < 20 && v.action !== 'grabbed'; i++) runPorts(m, 1, [{}, {}]);
    expect(v.action).toBe('grabbed');
    return { m, a, v };
  }

  it('the tongue grab reaches 13.5 units, further than Mario but slower', () => {
    const box = moves.grab!.hits[0]!.boxes[0]!;
    expect(box.grab).toBe(true);
    expect(box.x + box.radius).toBeCloseTo(13.5, 6);
  });

  it.each([
    ['fthrow', (s: number): Hold => ({ x: 100 * s })],
    ['bthrow', (s: number): Hold => ({ x: -100 * s })],
    ['uthrow', (): Hold => ({ y: 100 })],
    ['dthrow', (): Hold => ({ y: -100 })],
    ['pummel', (): Hold => ({ buttons: ['attack'] })],
  ] as const)('%s comes out of the hold', (move, hold) => {
    const { m, a } = holding(0);
    runPorts(m, 1, [hold(a.facing), {}]);
    expect(a.move).toBe(move);
  });

  it('down throw at 0% lets Red Ball act before Mario: a combo starter', () => {
    const { m, a, v } = holding(0);
    runPorts(m, 1, [{ y: -100 }, {}]);
    expect(a.move).toBe('dthrow');
    let free = 0;
    let victimFree = 0;
    for (let i = 1; i < 120 && !victimFree; i++) {
      runPorts(m, 1, [{}, {}]);
      if (!free && a.action === 'idle') free = i;
      if (v.launch === null && v.hitstun <= 0 && v.action !== 'grabbed') victimFree = i;
    }
    expect(free).toBeGreaterThan(0);
    expect(free).toBeLessThan(victimFree);
  });
});

describe('Red Ball: moves that roll', () => {
  it('dash attack keeps rolling forward through its active frames', () => {
    const m = redball();
    const f: FighterState = m.fighters[0]!;
    const x0 = f.pos.x;
    attack(m, 0, 'dashAttack');
    run(m, 16);
    expect((f.pos.x - x0) * f.facing).toBeGreaterThan(20);
  });

  it('forward smash lunges into its hit', () => {
    const m = redball();
    const f = m.fighters[0]!;
    const x0 = f.pos.x;
    attack(m, 0, 'fsmash');
    run(m, 18);
    expect((f.pos.x - x0) * f.facing).toBeGreaterThan(10);
  });
});
