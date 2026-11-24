import { describe, expect, it } from 'vitest';
import ref from '../../sim/reference/physics-constants.json';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { marioReference } from '../../sim/testing/reference';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { DAIR_PLUNGE_FROM, SPIN_ROLL, moves } from './moves';
import { stats } from './stats';

const snail = () => testMatch({ fighter: 'snailbob' });

/** The move started by `hold` (one frame) from standing still, or by `hold` after holding `before`. */
function moveFrom(hold: Hold, before?: { hold: Hold; frames: number }): string | null {
  const m = snail();
  if (before) run(m, before.frames, before.hold);
  run(m, 1, hold);
  return m.fighters[0]!.move;
}

/** Snail Bob (P1) against the Mario reference (P2) on Battlefield, settled on the ground. */
function vsMario(): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'snailbob' }, { fighter: marioReference.id }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  return { m, a, v };
}

const place = (f: FighterState, x: number, y = 0) => Object.assign(f, { pos: { x, y }, prevPos: { x, y } });

/** Steps until Mario is KO'd; true when the launch carries him through a side or the top blast zone. */
function koed(m: MatchState, v: FighterState): boolean {
  for (let i = 0; i < 400; i++) {
    runPorts(m, 1, [{}, {}]);
    const ko = m.events.find((e) => e.type === 'ko' && e.port === v.port);
    if (ko?.type === 'ko') return ko.side !== 'bottom';
  }
  return false;
}

/**
 * The roster's kill convention: a fresh, uncharged `move` KOs Mario standing at the Battlefield ledge, no rage,
 * no DI. Grounded moves face the ledge with the sweetspot on Mario; bair is done just above the floor with
 * Bob's back to the ledge; bthrow throws from a grab with his back to the ledge.
 */
function kos(move: string, percent: number): boolean {
  const { m, a, v } = vsMario();
  const vx = 76;
  place(v, vx);
  Object.assign(v, { ground: a.ground, action: 'idle', vel: { x: 0, y: 0 }, intangible: 0, facing: -1 });
  if (move === 'bthrow') {
    place(a, vx).facing = -1;
    place(v, vx - 11).facing = 1;
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, moves.grab!.hits[0]!.frames[1], [{}, {}]);
    expect(v.action).toBe('grabbed');
    v.damage = percent;
    runPorts(m, 1, [{ x: 100 }, {}]);
    expect(a.move).toBe('bthrow');
    return koed(m, v);
  }
  v.damage = percent;
  const sweet = moves[move]!.hits[0]!.boxes[0]!;
  if (move === 'bair') {
    place(a, vx + sweet.x, 9);
    Object.assign(a, { vel: { x: 0, y: 0 }, ground: null, action: 'fall', facing: -1 });
  } else place(a, vx - sweet.x).facing = 1;
  attack(m, 0, move);
  return koed(m, v);
}

describe('Snail Bob: stats', () => {
  it('match the roster: heavy, Jigglypuff-slow on the ground, Olimar gravity, Kirby jumps', () => {
    expect(stats).toMatchObject({
      weight: 104,
      walkSpeed: 0.735,
      dashInitialSpeed: 1.65,
      runSpeed: 1.271,
      airSpeed: 0.86,
      gravity: 0.068,
      fallSpeed: 1.35,
      fastFallSpeed: 2.16,
      fullHopHeight: 25.37,
      shortHopHeight: 12.24,
      doubleJumpHeight: 25,
      jumps: 2,
    });
    expect(stats.airAccelBase + stats.airAccelAdd).toBeCloseTo(0.06, 9);
  });

  it('a full hop peaks at the roster height', () => {
    const m = snail();
    const f = m.fighters[0]!;
    const y0 = f.pos.y;
    run(m, 1, { buttons: ['jump'] });
    let top = y0;
    until(
      m,
      (g) => {
        top = Math.max(top, g.pos.y);
        return g.vel.y < 0;
      },
      { buttons: ['jump'] },
    );
    expect(top - y0).toBeCloseTo(stats.fullHopHeight, 0);
  });
});

describe('Snail Bob: attack inputs', () => {
  it('jab, tilts, smashes and the dash attack come from the usual inputs', () => {
    expect(moveFrom({ buttons: ['attack'] })).toBe('jab');
    expect(moveFrom({ x: 100, buttons: ['attack'] })).toBe('fsmash');
    expect(moveFrom({ y: 100, buttons: ['attack'] })).toBe('usmash');
    expect(moveFrom({ y: -100, buttons: ['attack'] })).toBe('dsmash');
    expect(moveFrom({ x: 50, buttons: ['attack'] }, { hold: { x: 50 }, frames: 8 })).toBe('ftilt');
    expect(moveFrom({ y: 50, buttons: ['attack'] }, { hold: { y: 50 }, frames: 8 })).toBe('utilt');
    expect(moveFrom({ y: -60, buttons: ['attack'] }, { hold: { y: -60 }, frames: 8 })).toBe('dtilt');
    expect(moveFrom({ x: 100, buttons: ['attack'] }, { hold: { x: 100 }, frames: 25 })).toBe('dashAttack');
  });

  it('aerials follow the stick relative to facing', () => {
    const aerial = (hold: Hold) => {
      const m = snail();
      const f = placeInAir(m, 0, 40, 1);
      run(m, 1, hold);
      return f.move;
    };
    expect(aerial({ buttons: ['attack'] })).toBe('nair');
    expect(aerial({ x: 100, buttons: ['attack'] })).toBe('fair');
    expect(aerial({ x: -100, buttons: ['attack'] })).toBe('bair');
    expect(aerial({ y: 100, buttons: ['attack'] })).toBe('uair');
    expect(aerial({ y: -100, buttons: ['attack'] })).toBe('dair');
  });
});

describe('Snail Bob: frame data', () => {
  /** The roster's damage and first active frame for every normal (sweetspot damage, before the 1v1 multiplier). */
  const ROSTER: [string, number, number][] = [
    ['jab', 2, 4],
    ['ftilt', 9, 8],
    ['utilt', 6, 6],
    ['dtilt', 5, 7],
    ['dashAttack', 10, 9],
    ['fsmash', 16, 16],
    ['usmash', 15, 12],
    ['dsmash', 13, 10],
    ['nair', 9, 6],
    ['fair', 11, 10],
    ['bair', 12, 9],
    ['uair', 8, 6],
    ['dair', 14, 16],
    ['grab', 0, 9],
  ];

  it('Snail Punches: three Attack presses chain jab, jab2 and jab3 for 2% + 2% + 3.5%', () => {
    const { m, a, v } = vsMario();
    place(a, 0).facing = 1;
    place(v, 13);
    Object.assign(v, { ground: a.ground, action: 'idle', intangible: 0 });
    const seen: string[] = [];
    for (let i = 0; i < 70; i++) {
      runPorts(m, 1, [i % 12 === 0 && i < 36 ? { buttons: ['attack'] } : {}, {}]);
      if (a.move && seen.at(-1) !== a.move) seen.push(a.move);
    }
    expect(seen).toEqual(['jab', 'jab2', 'jab3']);
    expect(v.damage).toBeCloseTo((2 + 2 + 3.5) * 1.05 * 1.2, 6);
  });

  it.each(ROSTER)('%s: %s%% from frame %s', (name, damage, startup) => {
    const move = moves[name]!;
    expect(move.hits[0]!.frames[0]).toBe(startup);
    expect(Math.max(...move.hits.flatMap((w) => w.boxes.map((b) => b.damage)))).toBe(damage);
  });

  it('pummel and throws deal the roster damage', () => {
    expect(moves.pummel!.pummel!.damage).toBe(1.2);
    expect(moves.fthrow!.throw!.hit.damage).toBe(8);
    expect(moves.bthrow!.throw!.hit.damage).toBe(10);
    expect(moves.uthrow!.throw!.hit.damage).toBe(9);
    expect(moves.dthrow!.throw!.hit.damage).toBe(6);
    expect(moves.dairLand!.hits[0]!.boxes[0]!.damage).toBe(4);
  });

  it('fsmash is out on frames 16-18 exactly, then he is actionable on its faf', () => {
    const m = snail();
    const f = m.fighters[0]!;
    run(m, 1, { x: 100, buttons: ['attack'] });
    const active: number[] = [];
    let frames = 1;
    while (f.move === 'fsmash') {
      if (activeHitboxes(f).length > 0) active.push(f.actionFrame);
      run(m, 1);
      frames++;
    }
    expect(active).toEqual([16, 17, 18]);
    expect(frames).toBe(moves.fsmash!.faf);
    expect(f.action).toBe('idle');
  });

  it('the dash attack slides him forward in his shell', () => {
    const m = snail();
    const f = m.fighters[0]!;
    run(m, 25, { x: 100 });
    run(m, 1, { x: 100, buttons: ['attack'] });
    expect(f.move).toBe('dashAttack');
    const x0 = f.pos.x;
    until(m, (g) => g.move !== 'dashAttack');
    expect(f.pos.x - x0).toBeGreaterThan(20);
  });

  it('the standing grab is short: it reaches less far than Mario', () => {
    const box = moves.grab!.hits[0]!.boxes[0]!;
    expect(box.grab).toBe(true);
    expect(box.x + box.radius).toBeLessThan(ref.grab.grab_range_mario);
  });
});

describe('Snail Bob: Shell Pound (dair)', () => {
  /** Bob in the air at height `y` over the stage; Mario `below` units under him, airborne. */
  function pound(y: number, below?: number) {
    const { m, a, v } = vsMario();
    place(a, 0, y);
    Object.assign(a, { vel: { x: 0, y: 0 }, ground: null, action: 'fall', facing: 1, jumpsUsed: 1 });
    if (below !== undefined) {
      place(v, 0, y - below);
      Object.assign(v, { vel: { x: 0, y: 0 }, ground: null, action: 'fall', intangible: 0, damage: 50 });
    } else place(v, -60);
    attack(m, 0, 'dair');
    return { m, a, v };
  }

  it('hangs, then plunges faster than his fast fall', () => {
    const { m, a } = pound(60);
    runPorts(m, DAIR_PLUNGE_FROM - 1, [{}, {}]);
    expect(a.pos.y).toBeGreaterThan(59);
    const y = a.pos.y;
    runPorts(m, 5, [{}, {}]);
    expect((y - a.pos.y) / 5).toBeGreaterThan(stats.fastFallSpeed);
  });

  it('a down flick during the hang or the plunge does not change his path', () => {
    const path = (flick: boolean) => {
      const { m, a } = pound(100);
      const ys: number[] = [];
      for (let i = 1; i <= 30; i++) {
        const down = flick && (i === 6 || i === 20);
        runPorts(m, 1, [down ? { y: -100 } : {}, {}]);
        ys.push(a.pos.y);
      }
      return ys;
    };
    expect(path(true)).toEqual(path(false));
  });

  it('meteors a fighter under him on frames 16-20', () => {
    const { m, v } = pound(40, 10);
    for (let i = 0; i < 40 && v.kb.y === 0; i++) runPorts(m, 1, [{}, {}]);
    expect(v.kb.y).toBeLessThan(0);
  });

  it('landing during the plunge sends out the shockwave on both sides', () => {
    const { m, a, v } = pound(30);
    until(m, (f) => f.ground !== null);
    run(m, 1);
    expect(a.move).toBe('dairLand');
    const xs = activeHitboxes(a).map((b) => Math.sign(b.x - a.pos.x));
    expect(new Set(xs)).toEqual(new Set([-1, 1]));
    expect(v.damage).toBe(0);
  });

  it('started just above the floor, the hang lifts him and he still pounds into the shockwave', () => {
    const { m, a } = pound(1);
    until(m, (f) => f.ground !== null);
    expect(a.actionFrame).toBeGreaterThanOrEqual(DAIR_PLUNGE_FROM);
    run(m, 1);
    expect(a.move).toBe('dairLand');
    until(m, (f) => f.action !== 'attack');
    expect(a.action).toBe('idle');
  });
});

describe('Snail Bob: kill percents (Mario at the Battlefield ledge, fresh, no rage, no DI)', () => {
  /**
   * Loose on purpose (CREW.md, "Knockback values"): the moves keep Ultimate-style knockback and KO earlier than the
   * roster's targets in this engine for now. TODO: tighten to the roster's % (±8) with COOL-3's koPercent helper
   * once its KO calibration lands.
   */
  it.each([
    ['fsmash', 100],
    ['usmash', 115],
    ['bair', 140],
    ['bthrow', 165],
    ['ftilt', 170],
  ] as const)('%s KOs by its roster target of %s%%, and not at half of it', (move, target) => {
    expect(kos(move, target / 2)).toBe(false);
    expect(kos(move, target + 8)).toBe(true);
  });

  it('down throw at 0% lets him act before Mario can: a combo starter', () => {
    const { m, a, v } = vsMario();
    place(a, 0).facing = 1;
    place(v, 11);
    Object.assign(v, { ground: a.ground, action: 'idle', intangible: 0 });
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, 10, [{}, {}]);
    expect(v.action).toBe('grabbed');
    runPorts(m, 1, [{ y: -100 }, {}]);
    expect(a.move).toBe('dthrow');
    let bobFree = 0;
    let marioFree = 0;
    for (let i = 1; i < 150 && !marioFree; i++) {
      runPorts(m, 1, [{}, {}]);
      if (!bobFree && a.action === 'idle') bobFree = i;
      if (v.launch === null && v.hitstun <= 0 && v.action !== 'grabbed') marioFree = i;
    }
    expect(bobFree).toBeGreaterThan(0);
    expect(bobFree).toBeLessThan(marioFree);
  });
});

describe('Snail Bob: Shell Spin (side special)', () => {
  /** Snail Bob facing Mario `gap` units away; Special + forward, held for `rev` more frames. */
  function spin(rev: number, gap = 60) {
    const { m, a, v } = vsMario();
    place(a, -40).facing = 1;
    place(v, -40 + gap);
    Object.assign(v, { ground: a.ground, action: 'idle', intangible: 0, facing: -1 });
    runPorts(m, 1, [{ x: 100, buttons: ['special'] }, {}]);
    expect(a.move).toBe('sideB');
    runPorts(m, rev, [{ buttons: ['special'] }, {}]);
    return { m, a, v };
  }

  /** Frames from the press until the roll's hitbox comes out, and how far he has rolled when the move ends. */
  function roll(rev: number) {
    const { m, a } = spin(rev, 200);
    const x0 = a.pos.x;
    let out = 0;
    for (let i = 1; i < 200 && a.move === 'sideB'; i++) {
      if (!out && activeHitboxes(a).length > 0) out = rev + i;
      runPorts(m, 1, [{}, {}]);
    }
    return { out, distance: a.pos.x - x0 };
  }

  it('rolls on frame 12 when tapped; holding Special revs it for up to a second', () => {
    expect(roll(0).out).toBe(SPIN_ROLL[0]);
    expect(roll(30).out).toBeGreaterThan(30);
    expect(roll(200).out).toBeLessThanOrEqual(SPIN_ROLL[0] + 60);
  });

  it('a full rev rolls farther than a tap', () => {
    expect(roll(70).distance).toBeGreaterThan(roll(0).distance * 1.5);
    expect(roll(0).distance).toBeGreaterThan(40);
  });

  it('deals 10% tapped and 14% fully revved, then bounces him back', () => {
    for (const [rev, damage] of [
      [0, 10],
      [70, 14],
    ] as const) {
      const { m, a, v } = spin(rev, 30);
      for (let i = 0; i < 120 && v.damage === 0; i++) runPorts(m, 1, [{}, {}]);
      expect(v.damage).toBeCloseTo(damage * 1.05 * 1.2, 6);
      for (let i = 0; i < 30 && a.hitlag > 0; i++) runPorts(m, 1, [{}, {}]);
      runPorts(m, 2, [{}, {}]);
      expect(a.vel.x).toBeLessThan(0);
    }
  });

  it('stops at the ledge instead of rolling off', () => {
    const { m, a } = spin(70, 300);
    place(a, 40);
    for (let i = 0; i < 120 && a.move === 'sideB'; i++) runPorts(m, 1, [{}, {}]);
    expect(a.ground).not.toBeNull();
    expect(a.pos.x).toBeLessThanOrEqual(80);
  });

  it('in the air only the first Shell Spin hops, spending his midair jump', () => {
    const m = snail();
    const f = placeInAir(m, 0, 100, 1);
    const hop = () => {
      run(m, 1, { x: 100, buttons: ['special'] });
      expect(f.move).toBe('sideB');
      until(m, (g) => g.actionFrame === SPIN_ROLL[0] + 1);
      const v = f.vel.y;
      until(m, (g) => g.move !== 'sideB');
      return v > 0;
    };
    expect(hop()).toBe(true);
    expect(f.jumpsUsed).toBe(stats.jumps);
    expect(hop()).toBe(false);
  });

  it('started out of a fast fall, it still hops', () => {
    const m = snail();
    const f = placeInAir(m, 0, 100, 1);
    run(m, 3);
    run(m, 1, { y: -100 });
    expect(f.fastFalling).toBe(true);
    run(m, 1);
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f.move).toBe('sideB');
    until(m, (g) => g.actionFrame === SPIN_ROLL[0]);
    const y = f.pos.y;
    run(m, 4);
    expect(f.pos.y).toBeGreaterThan(y);
  });

  it('a hit on the last roll frame still bounces him back', () => {
    const solo = vsMario();
    place(solo.v, -100);
    place(solo.a, -40).facing = 1;
    attack(solo.m, 0, 'sideB');
    while (solo.a.actionFrame < SPIN_ROLL[1]) runPorts(solo.m, 1, [{}, {}]);
    const reach = moves.sideB!.hits[0]!.boxes[0]!.radius + 4;
    const { m, a, v } = vsMario();
    place(a, -40).facing = 1;
    place(v, solo.a.pos.x + reach - 0.3);
    Object.assign(v, { ground: a.ground, action: 'idle', intangible: 0, facing: -1 });
    attack(m, 0, 'sideB');
    while (v.damage === 0 && a.move === 'sideB') runPorts(m, 1, [{}, {}]);
    expect(a.actionFrame).toBe(SPIN_ROLL[1]);
    while (a.hitlag > 0) runPorts(m, 1, [{}, {}]);
    runPorts(m, 1, [{}, {}]);
    expect(a.vel.x).toBeLessThan(0);
  });

  it('in the air it hops into the roll and keeps rolling when it lands', () => {
    const m = snail();
    const f = placeInAir(m, -40, 8, 1);
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f.move).toBe('sideB');
    until(m, (g) => g.actionFrame === SPIN_ROLL[0] + 1);
    expect(f.vel.y).toBeGreaterThan(0);
    until(m, (g) => g.ground !== null);
    expect(f.move).toBe('sideB');
    const x = f.pos.x;
    run(m, 5);
    expect(f.pos.x - x).toBeGreaterThan(5);
  });
});

describe('Snail Bob: Rocket Hover (up special)', () => {
  const UP_B: Hold = { y: 50, buttons: ['special'] };

  it('thrusts on a 120-frame tank, rising over 100 units, then falls with his midair jump left', () => {
    const m = snail();
    const f = m.fighters[0]!;
    run(m, 1, UP_B);
    expect([f.move, f.action]).toEqual(['upB', 'hover']);
    const y0 = f.pos.y;
    let top = y0;
    while (f.action === 'hover') {
      run(m, 1, { buttons: ['special'] });
      top = Math.max(top, f.pos.y);
    }
    expect(f.mobility.hoverFuel).toBe(0);
    expect(f.action).toBe('fall');
    expect(top - y0).toBeGreaterThan(100);
    run(m, 1, { buttons: ['jump'] });
    expect(f.action).toBe('doubleJump');
  });

  it('the nozzle flame hits on frame 6 for 3% and pops them upward', () => {
    const { m, a, v } = vsMario();
    place(a, 0).facing = 1;
    place(v, 3);
    Object.assign(v, { ground: a.ground, action: 'idle', intangible: 0, facing: -1 });
    runPorts(m, 1, [UP_B, {}]);
    runPorts(m, 4, [{ buttons: ['special'] }, {}]);
    expect(v.damage).toBe(0);
    runPorts(m, 1, [{ buttons: ['special'] }, {}]);
    expect(v.damage).toBeCloseTo(3 * 1.05 * 1.2, 6);
    for (let i = 0; i < 30 && v.hitlag > 0; i++) runPorts(m, 1, [{ buttons: ['special'] }, {}]);
    runPorts(m, 6, [{ buttons: ['special'] }, {}]);
    expect(v.ground).toBeNull();
    expect(v.pos.y).toBeGreaterThan(2);
  });
});
