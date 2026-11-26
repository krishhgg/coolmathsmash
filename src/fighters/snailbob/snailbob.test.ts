import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { neutralInput } from '../../input/types';
import ref from '../../sim/reference/physics-constants.json';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent, type KoHit } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { CRATE_FRAMES, CRATE_RADIUS, entities } from './entities';
import { fighter } from '.';
import { DAIR_PLUNGE_FROM, SPIN_REV_FRAME, SPIN_ROLL, moves } from './moves';
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
  /**
   * Each normal's sweetspot damage (before the 1v1 multiplier) and first active frame, from the roster. The kill
   * moves take their Ultimate analogue's damage with its knockback (CREW.md, "Knockback values"), within 2% of the
   * roster's.
   */
  const ROSTER: [string, number, number][] = [
    ['jab', 2, 4],
    ['ftilt', 10, 8],
    ['utilt', 6, 6],
    ['dtilt', 5, 7],
    ['dashAttack', 10, 9],
    ['fsmash', 15, 16],
    ['usmash', 14, 12],
    ['dsmash', 13, 10],
    ['nair', 9, 6],
    ['fair', 12, 10],
    ['bair', 13, 9],
    ['uair', 8, 6],
    ['dair', 16, 16],
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

  it('pummel, throws and the Shell Pound landing deal their damage', () => {
    expect(moves.pummel!.pummel!.damage).toBe(1.2);
    expect(moves.fthrow!.throw!.hit.damage).toBe(8);
    expect(moves.bthrow!.throw!.hit.damage).toBe(11);
    expect(moves.uthrow!.throw!.hit.damage).toBe(9);
    expect(moves.dthrow!.throw!.hit.damage).toBe(6);
    expect(moves.dairLand!.hits[0]!.boxes[0]!.damage).toBe(5);
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

describe('Snail Bob: kill percents (koPercent: Mario at the Battlefield ledge, fresh, no rage, no DI)', () => {
  const ko = (move: string) => koPercent({ hit: { fighter: 'snailbob', move } })!;
  /** Shell Pound's late plunge, the hit that KOs off the side; it shares its box id with the meteor, so pass it raw. */
  const dairLate = () => koPercent({ hit: moves.dair!.hits[1]!.boxes[0]!, air: true })!;

  /**
   * Each kill move against its Ultimate analogue's hitbox from the same setup (CREW.md, "Knockback values and kill
   * percents"): the move takes the analogue's damage, angle, BKB and KBG, so it KOs within a few points of it.
   */
  it.each([
    ['ftilt', "R.O.B.'s forward tilt, fingertip", { damage: 10, angle: 361, kbg: 77, bkb: 48 }],
    ['fsmash', "R.O.B.'s forward smash, sweetspot", { damage: 15, angle: 41, kbg: 105, bkb: 32 }],
    ['usmash', "R.O.B.'s up smash, strong exhaust", { damage: 14, angle: 80, kbg: 98, bkb: 40 }],
    ['dsmash', "Squirtle's down smash", { damage: 13, angle: 28, kbg: 74, bkb: 50 }],
    ['fair', "Bowser's forward aerial, arm", { damage: 12, angle: 361, kbg: 80, bkb: 40 }, true],
    [
      'bair',
      "R.O.B.'s back aerial, clean",
      { damage: 13, angle: 35, kbg: 83, bkb: 35, direction: 'back' },
      true,
    ],
    ['dair', "Toon Link's down aerial, late hit", { damage: 14, angle: 50, kbg: 98, bkb: 40 }, true],
    ['bthrow', "King K. Rool's back throw", { damage: 11, angle: 35, kbg: 56, bkb: 70, direction: 'back' }],
    ['sideB', "Sonic's Spin Dash, ground roll", { damage: 10, angle: 70, kbg: 70, bkb: 80 }],
  ] as [string, string, KoHit, boolean?][])('%s KOs within 5 points of %s', (move, _analogue, hit, air) => {
    const bob = move === 'dair' ? dairLate() : koPercent({ hit: { fighter: 'snailbob', move }, air })!;
    expect(Math.abs(bob - koPercent({ hit, air })!)).toBeLessThanOrEqual(5);
  });

  it('Lever Punch is his strongest smash, then Shell Spin, then Shell Pop', () => {
    expect(ko('fsmash')).toBeLessThan(ko('dsmash'));
    expect(ko('dsmash')).toBeLessThan(ko('usmash'));
  });

  it('every smash out-kills Shell Bump, and Shell Bump out-kills Shell Slide and Antenna Whip', () => {
    const ftilt = ko('ftilt');
    for (const smash of ['fsmash', 'usmash', 'dsmash']) expect(ko(smash)).toBeLessThan(ftilt);
    expect(ftilt).toBeLessThan(ko('dashAttack'));
    expect(ftilt).toBeLessThan(ko('utilt'));
  });

  it('Shell Bash is his aerial kill move: it out-kills Shell Punch, which out-kills Shell Tuck', () => {
    const air = (move: string) => koPercent({ hit: { fighter: 'snailbob', move }, air: true })!;
    expect(air('bair')).toBeLessThan(air('fair'));
    expect(air('fair')).toBeLessThan(air('nair'));
  });

  it('Roll Over is his kill throw', () => {
    for (const thr of ['fthrow', 'uthrow', 'dthrow']) expect(ko('bthrow')).toBeLessThan(ko(thr));
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

  it('revving in the air brakes once a frame: x0.85 forward, and x0.8 up or down to 0.4 a frame', () => {
    const m = snail();
    const f = placeInAir(m, 0, 100, 1);
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f.move).toBe('sideB');
    run(m, SPIN_REV_FRAME - 2, { buttons: ['special'] });
    expect(f.actionFrame).toBe(SPIN_REV_FRAME - 1);
    f.vel = { x: 2, y: 1 };
    // One run of the rev a frame, then the air physics with the stick neutral: air friction and gravity.
    let { x: vx, y: vy } = f.vel;
    for (let i = 0; i < 8; i++) {
      run(m, 1, { buttons: ['special'] });
      vx = Math.max(0, vx * 0.85 - stats.airFriction);
      vy = Math.max(vy * 0.8, -0.4) - stats.gravity;
    }
    expect([f.actionFrame, f.charge]).toEqual([SPIN_REV_FRAME - 1, 8]);
    expect(f.vel.x).toBeCloseTo(vx, 12);
    expect(f.vel.y).toBeCloseTo(vy, 12);
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

describe('Snail Bob: Crate Drop (neutral special)', () => {
  const crates = (m: MatchState, kind: string) => m.entities.filter((e) => e.kind === `snailbob/${kind}`);

  it('keeps the crate on the elevator when it lands mid-ascent', () => {
    const m = testMatch({ fighter: 'snailbob', stage: 'testbed' });
    run(m, 90);
    placeInAir(m, 110, 14);
    run(m, 1, { buttons: ['special'] });
    until(m, () => crates(m, 'crate').length > 0, {}, 75);
    const [crate] = crates(m, 'crate');
    expect(m.stage.solids[1]!.dy).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) {
      expect(crate!.pos.y).toBeCloseTo(m.stage.solids[1]!.y + CRATE_RADIUS, 6);
      expect(crate!.grounded).toBe(true);
      run(m, 1);
    }
  });

  it('drops a crate that lands about 20 units ahead around frame 30 and rests there for 4 s', () => {
    const m = snail();
    const f = m.fighters[0]!;
    const x0 = f.pos.x;
    run(m, 1, { buttons: ['special'] });
    expect(f.move).toBe('neutralB');
    let frame = 1;
    while (crates(m, 'crate').length === 0 && frame < 60) {
      run(m, 1);
      frame++;
    }
    expect(frame).toBeGreaterThanOrEqual(28);
    expect(frame).toBeLessThanOrEqual(34);
    expect(crates(m, 'crateFall')).toHaveLength(0);
    const [crate] = crates(m, 'crate');
    expect(crate!.pos.x - x0).toBeCloseTo(20, 0);
    expect(crate!.hp).toBe(12);
    run(m, CRATE_FRAMES - 1);
    expect(crates(m, 'crate')).toHaveLength(1);
    run(m, 1);
    expect(crates(m, 'crate')).toHaveLength(0);
  });

  it("hits whoever it lands on for Steve's anvil's 10% and still lands", () => {
    const { m, a, v } = vsMario();
    place(a, 0).facing = 1;
    place(v, 20);
    Object.assign(v, { ground: a.ground, action: 'idle', intangible: 0 });
    runPorts(m, 1, [{ buttons: ['special'] }, {}]);
    for (let i = 0; i < 40 && v.damage === 0; i++) runPorts(m, 1, [{}, {}]);
    expect(v.damage).toBeCloseTo(10 * 1.05 * 1.2, 6);
    runPorts(m, 20, [{}, {}]);
    expect(crates(m, 'crate')).toHaveLength(1);
  });

  /**
   * Sourced kill percent: Steve's lone falling anvil (Down Air (Anvil Only) in the 13.0.1 hitbox data of
   * ultimate-hitboxes.com, RSN-Bran/ultimate-hitboxes ead416b; SmashWiki's Steve (SSBU)/Down aerial gives the same
   * 10%, 70° on grounded targets, BKB 62, KBG 78) KOs Mario standing at Battlefield's ledge from 183.6% in
   * SSBU-Calculator's KO calculator (rubendal/SSBU-Calculator 233590e, js/knockback.js Distance, run headless with
   * ko.test.ts's setup: fresh, no rage, no DI). The crate's hit is the anvil's, so it KOs within 5 points of that.
   */
  it("its hit KOs Mario at the ledge within 5 points of Steve's anvil at 183.6%", () => {
    const { damage, angle, kbg, bkb } = entities.crateFall!.hits![0]!.boxes[0]!;
    const percent = koPercent({ hit: { damage, angle, kbg, bkb } });
    expect(percent).not.toBeNull();
    expect(Math.abs(percent! - 183.6)).toBeLessThanOrEqual(5);
  });

  it('keeps one crate at a time: the next one replaces it', () => {
    const m = snail();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['special'] });
    until(m, () => crates(m, 'crate').length > 0);
    const first = crates(m, 'crate')[0]!.id;
    until(m, (g) => g.action === 'idle');
    run(m, 1, { buttons: ['special'] });
    expect(f.move).toBe('neutralB');
    until(m, () => crates(m, 'crateFall').length > 0);
    expect(crates(m, 'crate')).toHaveLength(0);
    expect(crates(m, 'crateFall')).toHaveLength(1);
    until(m, () => crates(m, 'crate').some((e) => e.id !== first));
    expect(crates(m, 'crate')).toHaveLength(1);
  });

  it('enemy hits wear down the resting crate without launching it, then break it', () => {
    const { m, a, v } = vsMario();
    place(a, 0).facing = 1;
    place(v, -20).facing = 1;
    runPorts(m, 1, [{ buttons: ['special'] }, {}]);
    until(m, () => crates(m, 'crate').length > 0);
    const [crate] = crates(m, 'crate');
    const pos = { ...crate!.pos };
    place(v, pos.x - 10);
    runPorts(m, 3, [{}, { buttons: ['attack'] }]);
    expect(crate!.hp).toBeLessThan(12);
    expect(crate!.hp).toBeGreaterThan(0);
    expect(crate!.pos).toEqual(pos);
    expect(crate!.kb).toEqual({ x: 0, y: 0 });
    runPorts(m, 30, [{}, {}]);
    attack(m, 1, 'probe');
    runPorts(m, 3, [{}, {}]);
    expect(crates(m, 'crate')).toHaveLength(0);
  });
});

describe('Snail Bob: Rocket Hover (up special)', () => {
  const UP_B: Hold = { y: 50, buttons: ['special'] };
  const HOLD_B: Hold = { buttons: ['special'] };

  it("is R.O.B.'s Robo Burner: 143 frames of fuel, no hitbox, actionable on frame 25, never helpless", () => {
    expect(fighter.hover).toEqual({ fuel: 143, rise: 1, accel: 0.1 });
    expect(moves.upB).toMatchObject({ kind: 'other', faf: 25, action: 'hover', hits: [] });
    expect(moves.upB!.helpless).toBeUndefined();
  });

  it('burns the whole tank in 143 frames of thrust, rising about 140 units, then falls with his midair jump left', () => {
    const m = snail();
    const f = m.fighters[0]!;
    const y0 = f.pos.y;
    run(m, 1, UP_B);
    expect([f.move, f.action]).toEqual(['upB', 'hover']);
    let thrust = 1;
    let top = y0;
    while (f.action === 'hover') {
      const left = f.mobility.hoverFuel;
      run(m, 1, HOLD_B);
      if (f.mobility.hoverFuel < left) thrust++;
      top = Math.max(top, f.pos.y);
    }
    expect(thrust).toBe(143);
    expect(f.mobility.hoverFuel).toBe(0);
    expect(f.action).toBe('fall');
    expect(top - y0).toBeGreaterThan(135);
    expect(top - y0).toBeLessThan(143);
    run(m, 1, { buttons: ['jump'] });
    expect(f.action).toBe('doubleJump');
  });

  it('holds him in the move until frame 25 even when Special is tapped, then drops him into a normal fall', () => {
    const m = snail();
    const f = placeInAir(m, 100, 60);
    run(m, 1, UP_B);
    run(m, 23);
    expect([f.action, f.actionFrame]).toEqual(['hover', 24]);
    run(m, 1);
    expect(f.action).toBe('fall');
    expect(f.mobility.hoverFuel).toBe(142);
  });

  it('keeps the fuel he did not burn for another hover in the same airtime, without refilling in the air', () => {
    const m = snail();
    const f = placeInAir(m, 100, 60);
    run(m, 1, UP_B);
    run(m, 39, HOLD_B);
    run(m, 1);
    expect(f.action).toBe('fall');
    expect(f.mobility.hoverFuel).toBe(103);
    run(m, 30);
    expect(f.mobility.hoverFuel).toBe(103);
    run(m, 1, UP_B);
    expect([f.move, f.action]).toEqual(['upB', 'hover']);
    run(m, 9, HOLD_B);
    expect(f.mobility.hoverFuel).toBe(93);
  });

  it('refills an empty tank in 90 frames once he lands (Robo Burner: about 1.5 s on the ground)', () => {
    const m = snail();
    const f = m.fighters[0]!;
    run(m, 1, UP_B);
    until(m, (g) => g.action !== 'hover', HOLD_B, 200);
    until(m, (g) => g.ground !== null, {}, 200);
    expect(f.mobility.hoverFuel).toBe(0);
    run(m, 45);
    expect(f.mobility.hoverFuel).toBeCloseTo(71.5, 6);
    run(m, 44);
    expect(f.mobility.hoverFuel).toBeLessThan(143);
    run(m, 1);
    expect(f.mobility.hoverFuel).toBeCloseTo(143, 6);
  });

  it('brings him back onto Battlefield from below the ledge after Mario launches him, with no midair jump left', () => {
    const { m, a, v } = vsMario();
    Object.assign(place(a, 72), { facing: -1, damage: 20 });
    Object.assign(place(v, 64), { facing: 1 });
    runPorts(m, 2, [{}, {}]);
    attack(m, 1, 'probe');
    const step = (hold: Hold) => runPorts(m, 1, [hold, {}]);
    for (let i = 0; i < 300 && (a.ground || a.pos.y > -30); i++) step({});
    expect(a.damage).toBeGreaterThan(20);
    expect(a.hitstun).toBe(0);
    expect(a.pos.x).toBeGreaterThan(90);
    expect(a.pos.y).toBeLessThan(-30);
    a.jumpsUsed = stats.jumps;
    step(UP_B);
    expect(a.move).toBe('upB');
    // Rise to the ledge's height first, then drift in; over the stage, let go and drop onto it.
    for (let i = 0; i < 400 && !a.ground && !a.action.startsWith('ledge'); i++)
      step(a.pos.x > 70 ? { x: a.pos.y > -2 ? -100 : 0, buttons: ['special'] } : {});
    expect(a.stocks).toBe(3);
    expect(a.ground !== null || a.action.startsWith('ledge')).toBe(true);
    expect(Math.abs(a.pos.x)).toBeLessThanOrEqual(80);
  });

  it.each([4, 7, 9])(
    'a level %d CPU holds the hover from below the ledge after Mario launches him, back to the stage',
    (level) => {
      const { m, a, v } = vsMario();
      Object.assign(place(a, 72), { facing: -1, damage: 20 });
      Object.assign(place(v, 64), { facing: 1 });
      runPorts(m, 2, [{}, {}]);
      attack(m, 1, 'probe');
      for (let i = 0; i < 300 && (a.ground || a.pos.y > -30); i++) runPorts(m, 1, [{}, {}]);
      expect(a.pos.y).toBeLessThan(-30);
      a.jumpsUsed = stats.jumps;
      const cpu = createCpu({ port: 0, level, seed: 5 });
      let fuel = a.mobility.hoverFuel;
      let safe = false;
      for (let i = 0; i < 600 && !safe; i++) {
        stepMatch(m, [cpu.input(m), neutralInput()]);
        fuel = Math.min(fuel, a.mobility.hoverFuel);
        safe = a.ground !== null || a.action === 'ledgeHang';
      }
      expect(a.stocks).toBe(3);
      expect(safe).toBe(true);
      // Rode the tank up instead of tapping it: a tap burns one frame of fuel and falls.
      expect(fighter.hover.fuel - fuel).toBeGreaterThan(30);
    },
  );
});
