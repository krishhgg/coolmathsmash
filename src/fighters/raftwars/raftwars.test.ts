import { describe, expect, it } from 'vitest';
import ref from '../../sim/reference/physics-constants.json';
import { activeHitboxes } from '../../sim/combat/hits';
import { createMatch, type MatchState } from '../../sim/match';
import type { FighterState } from '../../sim/fighter';
import { koPercent } from '../../sim/testing/ko';
import { runPorts, until, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { stats } from './stats';

/** P1 Raft Wars kids against P2 (the Mario reference by default), settled on Battlefield. */
function versus(opponent = 'reference-mario'): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'raftwars' }, { fighter: opponent }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  return { m, a, v };
}

/** Put both fighters on the main stage: P1 at `ax` facing `facing`, P2 at `vx` with `percent`. */
function place(a: FighterState, v: FighterState, ax: number, vx: number, facing: 1 | -1, percent = 0): void {
  for (const [f, x] of [
    [a, ax],
    [v, vx],
  ] as const) {
    Object.assign(f, {
      pos: { x, y: 0 },
      prevPos: { x, y: 0 },
      ground: a.ground,
      action: 'idle',
      vel: { x: 0, y: 0 },
    });
    f.intangible = 0;
  }
  if (v !== a) {
    v.facing = -facing as 1 | -1;
    v.damage = percent;
  }
  a.facing = facing;
}

/** Frames on which a move started from standing has a hitbox out. */
function activeFrames(move: string, hold: Hold, before?: { hold: Hold; frames: number }): number[] {
  const { m, a } = versus();
  place(a, a, 0, 0, 1);
  if (before) runPorts(m, before.frames, [before.hold, {}]);
  runPorts(m, 1, [hold, {}]);
  expect(a.move).toBe(move);
  const active: number[] = [];
  while (a.move === move) {
    if (activeHitboxes(a).length > 0) active.push(a.actionFrame);
    runPorts(m, 1, [{}, {}]);
  }
  return active;
}

describe('Raft Wars kids: stats', () => {
  it('match the roster sheet and its Ultimate templates', () => {
    expect(stats.weight).toBe(80);
    expect(stats.walkSpeed).toBe(0.9);
    expect(stats.dashInitialSpeed).toBe(1.73);
    expect(stats.runSpeed).toBe(1.48);
    expect(stats.airSpeed).toBe(0.95);
    expect(stats.airAccelBase + stats.airAccelAdd).toBeCloseTo(0.06, 9);
    expect(stats.gravity).toBe(0.085);
    expect([stats.fallSpeed, stats.fastFallSpeed]).toEqual([1.45, 2.32]);
    expect(stats.jumps).toBe(2);
    expect([stats.fullHopHeight, stats.shortHopHeight, stats.doubleJumpHeight]).toEqual([30, 14.6, 30]);
  });

  it('a full hop rises 30 units: just enough for a Battlefield side platform, which is their camping spot', () => {
    const { m, a } = versus();
    place(a, a, -20, -20, 1);
    const y0 = a.pos.y;
    let top = y0;
    runPorts(m, 1, [{ buttons: ['jump'] }, {}]);
    for (let i = 0; i < 80; i++) {
      runPorts(m, 1, [{ buttons: ['jump'] }, {}]);
      top = Math.max(top, a.pos.y);
    }
    expect(top - y0).toBeCloseTo(30, 0);
    expect(top - y0).toBeGreaterThan(ref.stages.battlefield.soft_platforms[0]!.y);
  });
});

describe('Raft Wars kids: frame data', () => {
  const smashes: [string, Hold, number[]][] = [
    ['fsmash', { x: 100, buttons: ['attack'] }, [14, 15, 16]],
    ['usmash', { y: 100, buttons: ['attack'] }, [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]],
    ['dsmash', { y: -100, buttons: ['attack'] }, [10, 11, 12]],
  ];
  it.each(smashes)('%s is active on the roster frames', (move, hold, frames) => {
    expect(activeFrames(move, hold)).toEqual(frames);
  });

  it('dash attack comes out of a run on frame 8 and slides about 30 units on the float', () => {
    const { m, a } = versus();
    place(a, a, -60, -60, 1);
    runPorts(m, 20, [{ x: 100 }, {}]);
    expect(a.action).toBe('run');
    runPorts(m, 1, [{ x: 100, buttons: ['attack'] }, {}]);
    expect(a.move).toBe('dashAttack');
    const x0 = a.pos.x;
    const active: number[] = [];
    while (a.move === 'dashAttack') {
      if (activeHitboxes(a).length > 0) active.push(a.actionFrame);
      runPorts(m, 1, [{}, {}]);
    }
    expect(active[0]).toBe(8);
    expect(active.at(-1)).toBe(22);
    expect(a.pos.x - x0).toBeGreaterThan(25);
    expect(a.pos.x - x0).toBeLessThan(40);
  });

  it('a grab is out on frame 7 and reaches 10.5 units, shorter than Mario', () => {
    expect(activeFrames('grab', { buttons: ['grab'] })).toEqual([7, 8]);
    const box = moves.grab!.hits[0]!.boxes[0]!;
    expect(box.x + box.radius).toBe(10.5);
    expect(box.x + box.radius).toBeLessThan(ref.grab.grab_range_mario);
  });

  it.each([
    ['dashAttack', 9],
    ['fsmash', 17],
    ['usmash', 14],
    ['dsmash', 12],
  ] as const)('%s deals %s%% (the roster, or the kill analogue below)', (move, damage) => {
    expect(Math.max(...moves[move]!.hits.flatMap((w) => w.boxes.map((b) => b.damage)))).toBe(damage);
  });

  it.each([
    ['fthrow', 9],
    ['bthrow', 9],
    ['uthrow', 8],
    ['dthrow', 6],
  ] as const)('%s deals %s%% (the roster, or the kill analogue below)', (move, damage) => {
    expect(moves[move]!.throw!.hit.damage).toBe(damage);
  });

  it('pummel deals 1.2%', () => {
    expect(moves.pummel!.pummel!.damage).toBe(1.2);
  });

  it('down smash splashes both sides at once and launches each side away', () => {
    for (const side of [1, -1]) {
      const { m, a, v } = versus();
      place(a, v, 0, 9 * side, 1, 60);
      runPorts(m, 1, [{ y: -100, buttons: ['attack'] }, {}]);
      until(m, () => v.kb.x !== 0, {}, 60);
      expect(Math.sign(v.kb.x)).toBe(side);
    }
  });
});

/**
 * Kill percents with koPercent: the Mario reference at Battlefield's ledge, fresh, no rage, no DI. Each move takes its
 * knockback from an Ultimate analogue (13.0.1 hitbox data) and KOs within 5 points of it; `ko` is the analogue's own
 * hitbox through koPercent, which reproduces Ultimate's KO calculator within about 2% (src/sim/testing/ko.test.ts).
 * For Bottle Rocket, #100 places Mario's feet at y=16.5 for the strong box at y=24, so the mortar comparison
 * starts airborne at (79.9, 16.5), not on the floor.
 */
const analogues = [
  { move: 'fsmash', analogue: "Isabelle's forward smash (17%, 361, KBG 99, BKB 25)", ko: 68.6 },
  { move: 'upB', analogue: "Snake's Remote Missile (14%, 50, KBG 70, BKB 75)", ko: 96.2 },
  { move: 'dsmash', analogue: "Snake's down smash (12%, 25, KBG 87, BKB 30)", ko: 104.8 },
  { move: 'usmash', analogue: "Snake's up smash mortar (14%, 65, KBG 60, BKB 87)", ko: 132.3 },
  { move: 'bthrow', analogue: "Snake's back throw (9%, 140, KBG 65, BKB 65)", ko: 156.8 },
  { move: 'fthrow', analogue: "Snake's forward throw (9%, 40, KBG 65, BKB 60)", ko: 166.6 },
];

describe('Raft Wars kids: kill percents on Mario at the ledge', () => {
  it.each(analogues)('$move KOs within 5 points of $analogue: $ko%', ({ move, ko }) => {
    expect(Math.abs(koPercent({ hit: { fighter: 'raftwars', move } })! - ko)).toBeLessThanOrEqual(5);
  });

  it('Floaty Shove kills first, then the Rocket Ride explosion, down smash, up smash, back throw, forward throw', () => {
    const order = analogues.map(({ move }) => koPercent({ hit: { fighter: 'raftwars', move } })!);
    expect(order).toEqual([...order].sort((x, y) => x - y));
  });

  it('dash attack, up throw and down throw are not kill moves: none KOs before 180%', () => {
    for (const move of ['dashAttack', 'uthrow', 'dthrow'])
      expect(koPercent({ hit: { fighter: 'raftwars', move } })!).toBeGreaterThan(180);
  });
});

describe('Raft Wars kids: throws', () => {
  it('down throw at 0% leaves them free to act before the opponent: a combo starter', () => {
    const { m, a, v } = versus();
    place(a, v, 0, 9, 1);
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, 8, [{}, {}]);
    expect(v.action).toBe('grabbed');
    runPorts(m, 1, [{ y: -100 }, {}]);
    expect(a.move).toBe('dthrow');
    let kidsFree = 0;
    let victimFree = 0;
    for (let i = 1; i < 120 && !victimFree; i++) {
      runPorts(m, 1, [{}, {}]);
      if (!kidsFree && a.action === 'idle') kidsFree = i;
      if (v.launch === null && v.hitstun <= 0 && v.action !== 'grabbed') victimFree = i;
    }
    expect(kidsFree).toBeGreaterThan(0);
    expect(kidsFree).toBeLessThan(victimFree);
  });
});

describe('Raft Wars kids: Rocket Ride (up special)', () => {
  /** Up special from the ground at x = 0 with the stick at `x` after the first frame; the path until helpless. */
  function ride(stick = 0): { a: FighterState; m: MatchState; top: number; dx: number } {
    const { m, a } = versus();
    place(a, a, 0, 0, 1);
    runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
    expect(a.move).toBe('upB');
    expect(a.ground).toBeNull();
    let top = 0;
    while (a.action !== 'helpless') {
      runPorts(m, 1, [{ x: stick }, {}]);
      top = Math.max(top, a.pos.y);
    }
    return { a, m, top, dx: a.pos.x };
  }

  it('rides about 110 units up and forward, then falls helpless and lands with 24 frames of lag', () => {
    const { a, m, top, dx } = ride();
    expect(top).toBeGreaterThan(95);
    expect(top).toBeLessThan(120);
    expect(dx).toBeGreaterThan(20);
    expect(dx).toBeLessThan(40);
    for (let i = 0; i < 400 && a.ground === null; i++) runPorts(m, 1, [{}, {}]);
    expect(a.action).toBe('land');
    expect(a.landingLag).toBe(24);
  });

  it('steers within 30 degrees of vertical: forward goes further out, back goes backward', () => {
    const forward = ride(100).dx;
    const back = ride(-100).dx;
    expect(forward).toBeGreaterThan(ride().dx);
    expect(forward).toBeLessThan(75);
    expect(back).toBeLessThan(-40);
    expect(back).toBeGreaterThan(-75);
  });

  it('the explosion at the end of the ride is the big hit', () => {
    const end = ride();
    const { m, a, v } = versus();
    place(a, v, 0, 200, 1);
    const at = { x: end.a.pos.x, y: end.top };
    runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
    until(m, () => a.actionFrame === 46, {}, 60);
    Object.assign(v, {
      pos: { ...at },
      prevPos: { ...at },
      ground: null,
      action: 'fall',
      vel: { x: 0, y: 0 },
    });
    until(m, () => a.actionFrame === 53, {}, 60);
    expect(v.damage).toBeGreaterThanOrEqual(12 * 1.2);
  });

  it.each([
    ['neutral', 0, 1],
    ['back', -100, -1],
  ] as const)(
    'a ceiling does not knock the rocket off course: pressed against the underside it still steers (stick %s from frame 20)',
    (_, stick, direction) => {
      const { m, a } = versus();
      Object.assign(a, {
        pos: { x: 0, y: -58 },
        prevPos: { x: 0, y: -58 },
        ground: null,
        action: 'fall',
        vel: { x: 0, y: 0 },
        facing: 1,
        jumpsUsed: 2,
      });
      runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
      expect(a.move).toBe('upB');
      let blocked = 0;
      let x20 = 0;
      while (a.actionFrame < 40) {
        const { x, y } = a.pos;
        runPorts(m, 1, [{ x: a.actionFrame >= 20 ? stick : 0 }, {}]);
        if (a.actionFrame === 20) x20 = a.pos.x;
        if (a.actionFrame <= 12) continue;
        expect(a.pos.y - y).toBeGreaterThan(-0.1);
        if (a.pos.y - y > 1) continue;
        blocked++;
        expect(Math.abs(a.pos.x - x)).toBeLessThan(2.95 * Math.sin(Math.PI / 6) + 0.1);
      }
      expect(blocked).toBeGreaterThan(10);
      expect(Math.sign(a.pos.x - x20)).toBe(direction);
    },
  );

  it('grabs the ledge on the way up from below the stage', () => {
    const { m, a } = versus();
    Object.assign(a, {
      pos: { x: 92, y: -30 },
      prevPos: { x: 92, y: -30 },
      ground: null,
      action: 'fall',
      vel: { x: 0, y: 0 },
      facing: -1,
      jumpsUsed: 2,
    });
    runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
    expect(a.move).toBe('upB');
    let caught = false;
    for (let i = 0; i < 90 && !caught; i++) {
      runPorts(m, 1, [{}, {}]);
      caught = a.action === 'ledgeCatch' || a.action === 'ledgeHang';
    }
    expect(caught).toBe(true);
  });
});
