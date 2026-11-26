import { describe, expect, it } from 'vitest';
import { createMatch } from '../../sim/match';
import type { FighterState } from '../../sim/fighter';
import { activeHitboxes } from '../../sim/combat/hits';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { koPercent, type KoHit, type KoSetup } from '../../sim/testing/ko';
import { moves } from './moves';
import { stats } from './stats';

const duck = () => testMatch({ fighter: 'duck' });

/** The move started by `hold` (one frame) from standing still, or by `hold` after holding `before`. */
function moveFrom(hold: Hold, before?: { hold: Hold; frames: number }): string | null {
  const m = duck();
  if (before) run(m, before.frames, before.hold);
  run(m, 1, hold);
  return m.fighters[0]!.move;
}

/** Frames of `move` with a hitbox out, played from standing (or from the air for aerials). */
function activeFrames(move: string): number[] {
  const m = duck();
  const f = moves[move]!.kind === 'aerial' ? placeInAir(m, 0, 80) : m.fighters[0]!;
  attack(m, 0, move);
  const active: number[] = [];
  for (let i = 0; i < moves[move]!.faf; i++) {
    run(m, 1);
    if (f.move !== move) break;
    if (activeHitboxes(f).length > 0) active.push(f.actionFrame);
  }
  return active;
}

describe('The Duck: stats', () => {
  it('is a light flyer: Fox-like weight, Peach gravity, Kirby fall speeds', () => {
    expect(stats.weight).toBe(76);
    expect(stats.gravity).toBe(0.07);
    expect([stats.fallSpeed, stats.fastFallSpeed]).toEqual([1.23, 1.968]);
    expect([stats.dashInitialSpeed, stats.runSpeed]).toEqual([1.98, 2.039]);
  });

  it('has five jumps: four midair flaps after the ground jump', () => {
    const m = duck();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['jump'] });
    run(m, 12);
    expect(f.ground).toBeNull();
    let flaps = 0;
    for (let i = 0; i < 6; i++) {
      const used = f.jumpsUsed;
      run(m, 1, { buttons: ['jump'] });
      run(m, 10);
      if (f.jumpsUsed > used) flaps++;
    }
    expect(flaps).toBe(4);
    expect(f.jumpsUsed).toBe(5);
  });
});

describe('The Duck: attack inputs', () => {
  it('jab, tilts and smashes come from Attack with no, a held, or a just-tapped direction', () => {
    expect(moveFrom({ buttons: ['attack'] })).toBe('jab');
    expect(moveFrom({ x: 100, buttons: ['attack'] })).toBe('fsmash');
    expect(moveFrom({ y: 100, buttons: ['attack'] })).toBe('usmash');
    expect(moveFrom({ y: -100, buttons: ['attack'] })).toBe('dsmash');
    expect(moveFrom({ x: 50, buttons: ['attack'] }, { hold: { x: 50 }, frames: 8 })).toBe('ftilt');
    expect(moveFrom({ y: 50, buttons: ['attack'] }, { hold: { y: 50 }, frames: 8 })).toBe('utilt');
    expect(moveFrom({ y: -60, buttons: ['attack'] }, { hold: { y: -60 }, frames: 8 })).toBe('dtilt');
    expect(moveFrom({ x: 100, buttons: ['attack'] }, { hold: { x: 100 }, frames: 20 })).toBe('dashAttack');
    expect(moveFrom({ buttons: ['grab'] })).toBe('grab');
  });

  it('aerials follow the stick relative to facing', () => {
    const aerial = (hold: Hold) => {
      const m = duck();
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

describe('The Duck: Seeds (neutral special)', () => {
  it.each([1, -1] as const)('taps to spit on frames 10, 15 and 20, facing %s', (facing) => {
    const m = duck();
    const f = m.fighters[0]!;
    f.facing = facing;
    run(m, 1, { buttons: ['special'] });
    expect(f.move).toBe('neutralB');
    const frames: number[] = [];
    for (let i = 0; i < 33; i++) {
      run(m, 1);
      for (const seed of m.entities.filter((e) => e.age === 1)) {
        expect(seed).toMatchObject({ kind: 'duck/seed', owner: 0, facing, move: 'neutralB' });
        expect(seed.pos.x * facing).toBeGreaterThan(f.pos.x * facing);
        expect(seed.vel.x * facing).toBeGreaterThan(0);
        frames.push(f.actionFrame);
      }
    }
    expect(frames).toEqual([10, 15, 20]);
    run(m, 24);
    expect(m.entities).toHaveLength(0);
  });

  it('each seed makes Fireboy flinch without freezing the Duck', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'duck' }, { fighter: 'fireboy' }],
    });
    const [a, v] = m.fighters as [FighterState, FighterState];
    a.pos.x = -25;
    v.pos.x = 18;
    run(m, 10);
    run(m, 1, { buttons: ['special'] });
    const hits: number[] = [];
    for (let i = 0; i < 60; i++) {
      run(m, 1);
      for (const e of m.events) {
        if (e.type !== 'hit' || e.move !== 'neutralB') continue;
        expect(e).toMatchObject({ attacker: 0, victim: 1, tumble: false });
        expect(e.entity).toBeDefined();
        expect(v.hitlag).toBeGreaterThan(0);
        expect(v.launch).not.toBeNull();
        expect(a.hitlag).toBe(0);
        hits.push(e.damage);
      }
    }
    expect(hits).toHaveLength(3);
    expect(hits[0]).toBeCloseTo(1.26);
    expect(v.damage).toBeCloseTo(hits.reduce((total, damage) => total + damage, 0));
  });

  it('finishes the burst after touching down', () => {
    const m = duck();
    const f = placeInAir(m, 0, 9);
    run(m, 1, { buttons: ['special'] });
    until(m, (g) => g.ground !== null);
    expect(f.move).toBe('neutralB');
    expect(m.entities).toHaveLength(2);
    until(m, (g) => g.actionFrame === 20);
    expect(m.entities).toHaveLength(3);
  });
});

describe('The Duck: jab combo (peck, peck, wing slap)', () => {
  it('Attack again inside each window chains jab -> jab2 -> jab3', () => {
    const m = duck();
    const f = m.fighters[0]!;
    const seen: string[] = [];
    for (let i = 0; i < 70; i++) {
      run(m, 1, i % 8 === 0 && i < 24 ? { buttons: ['attack'] } : {});
      if (f.move && seen.at(-1) !== f.move) seen.push(f.move);
    }
    expect(seen).toEqual(['jab', 'jab2', 'jab3']);
  });

  it('a single press plays only the first peck and ends at its first actionable frame', () => {
    const m = duck();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['attack'] });
    let frames = 1;
    while (f.move === 'jab') {
      run(m, 1);
      frames++;
    }
    expect(frames).toBe(moves.jab!.faf);
    expect(f.action).toBe('idle');
  });

  it('a press before the window is buffered and continues the combo when it opens', () => {
    const m = duck();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['attack'] });
    run(m, 2);
    run(m, 1, { buttons: ['attack'] });
    until(m, (g) => g.move !== 'jab');
    expect(f.move).toBe('jab2');
    expect(f.actionFrame).toBe(1);
  });

  it('Attack with a direction during the window does not continue the jab', () => {
    const m = duck();
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['attack'] });
    run(m, 7);
    run(m, 1, { y: -60, buttons: ['attack'] });
    expect(f.move).toBe('jab');
  });

  it('all three hits connect on a standing opponent: 8%, fresh (x1.05) and x1.2 in 1v1', () => {
    const m = testMatch({ fighter: 'duck', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(v, { pos: { x: a.pos.x + 6 * a.facing, y: a.pos.y }, ground: a.ground, action: 'idle' });
    v.intangible = 0;
    for (let i = 0; i < 70; i++) runPorts(m, 1, [i % 8 === 0 && i < 24 ? { buttons: ['attack'] } : {}, {}]);
    expect(v.damage).toBeCloseTo((2 + 2 + 4) * 1.05 * 1.2, 6);
  });
});

describe('The Duck: frame data (roster sheet)', () => {
  /** Roster "### 7. The Duck": damage of the strongest hitbox and first active frame. */
  const ROSTER: [string, number, number][] = [
    ['jab', 2, 3],
    ['jab2', 2, 3],
    ['jab3', 4, 4],
    ['ftilt', 9, 7],
    ['utilt', 6, 5],
    ['dtilt', 6, 4],
    ['dashAttack', 11, 7],
    ['fsmash', 16, 14],
    ['usmash', 14, 10],
    ['dsmash', 12, 7],
    ['nair', 8, 4],
    ['fair', 11, 9],
    ['bair', 12, 8],
    ['uair', 8, 5],
    ['dair', 12, 12],
    ['grab', 0, 7],
  ];
  it.each(ROSTER)('%s: %s damage, first active frame %s', (move, damage, first) => {
    const def = moves[move]!;
    expect(Math.max(...def.hits.flatMap((w) => w.boxes.map((b) => b.damage)))).toBe(damage);
    expect(activeFrames(move)[0]).toBe(first);
  });

  it.each([
    ['pummel', 1.2],
    ['fthrow', 8],
    ['bthrow', 10],
    ['uthrow', 8],
    ['dthrow', 6],
  ] as const)('%s: %s damage', (move, damage) => {
    const def = moves[move]!;
    expect(def.pummel?.damage ?? def.throw?.hit.damage).toBe(damage);
  });

  it('dair meteors at the foot: its first hit sends straight down', () => {
    const foot = moves.dair!.hits[0]!.boxes[0]!;
    expect(foot.angle).toBe(270);
    expect(foot.id).toBe(0);
  });
});

/**
 * Kill percents against the Mario reference on Battlefield (fresh, no rage, no DI), at the ledge unless specified.
 * Compare each move with its Ultimate 13.0.1 analogue's hit in the same setup.
 */
describe('The Duck: kill percents (koPercent vs Ultimate analogues)', () => {
  const ANALOGUES: [string, string, KoHit, Pick<KoSetup, 'air' | 'from'>][] = [
    ['jab3', "Mario's jab 3", { damage: 4, angle: 361, kbg: 80, bkb: 60 }, {}],
    ['ftilt', "Pikachu's ftilt", { damage: 9, angle: 361, kbg: 100, bkb: 15 }, {}],
    ['utilt', "Wario's utilt", { damage: 6, angle: 92, kbg: 130, bkb: 28, direction: 'away' }, {}],
    ['dtilt', "Pikachu's dtilt", { damage: 6, angle: 361, kbg: 100, bkb: 12 }, {}],
    ['fsmash', "Yoshi's fsmash", { damage: 15.5, angle: 361, kbg: 102, bkb: 30 }, {}],
    ['usmash', "Pikachu's usmash", { damage: 14, angle: 87, kbg: 89, bkb: 50 }, {}],
    ['dsmash', "Mario's dsmash", { damage: 12, angle: 30, kbg: 100, bkb: 30 }, {}],
    ['dashAttack', "Pikachu's dash attack", { damage: 11, angle: 60, kbg: 88, bkb: 70 }, {}],
    ['nair', "Mario's nair", { damage: 8, angle: 361, kbg: 100, bkb: 20 }, { air: true }],
    ['fair', "Bowser Jr.'s fair", { damage: 11, angle: 45, kbg: 93, bkb: 33 }, { air: true }],
    [
      'bair',
      "Dr. Mario's bair",
      { damage: 12, angle: 361, kbg: 95, bkb: 10, direction: 'back' },
      { air: true },
    ],
    [
      'uair',
      "Villager's one-turnip uair",
      { damage: 8, angle: 85, kbg: 100, bkb: 40 },
      { air: true, from: 'centre' },
    ],
    ['fthrow', "Mario's fthrow", { damage: 8, angle: 45, kbg: 65, bkb: 60 }, {}],
    ['bthrow', "Luigi's bthrow", { damage: 10, angle: 45, kbg: 65, bkb: 80, direction: 'back' }, {}],
    ['uthrow', "Luigi's uthrow", { damage: 8, angle: 90, kbg: 72, bkb: 70 }, {}],
  ];
  it.each(ANALOGUES)('%s KOs within 5 of %s', (move, _, hit, opts) => {
    const duck = koPercent({ hit: { fighter: 'duck', move }, ...opts });
    const analogue = koPercent({ hit, ...opts });
    expect(duck).not.toBeNull();
    expect(analogue).not.toBeNull();
    expect(Math.abs(duck! - analogue!)).toBeLessThanOrEqual(5);
  });

  const ko = (move: string, opts: Pick<KoSetup, 'air' | 'from'> = {}) =>
    koPercent({ hit: { fighter: 'duck', move }, ...opts }) ?? Infinity;

  it('fsmash leads his grounded finishers, and usmash kills before ftilt', () => {
    const fsmash = ko('fsmash');
    for (const other of ['dsmash', 'usmash', 'dashAttack', 'ftilt']) expect(fsmash).toBeLessThan(ko(other));
    expect(ko('usmash')).toBeLessThan(ko('ftilt'));
  });

  it('bair and fair are his aerial kill moves, well ahead of nair; Wing Fling (bthrow) is his kill throw', () => {
    for (const aerial of ['bair', 'fair']) {
      expect(ko(aerial, { air: true }) + 20).toBeLessThan(ko('nair', { air: true }));
    }
    for (const other of ['fthrow', 'uthrow', 'dthrow']) expect(ko('bthrow') + 30).toBeLessThan(ko(other));
  });
});

/**
 * Measured, not sourced. Dive Ram (down special) names no Ultimate analogue, and no Ultimate hit has its dive's
 * damage, angle, BKB and KBG (13%, 300 degrees, BKB 40, KBG 70; searched in the 13.0.1 hitbox data of
 * ultimate-hitboxes.com), so there is no Ultimate kill percent to hold it to. These are the percents koPercent gave
 * on main when this was written, with the Mario reference fresh, no rage, no DI: the dive's semi-spike on an
 * airborne Mario 10 units past Battlefield's ledge, where a downward hit can KO, and the dive landing on Mario
 * standing at the ledge. The belly-flop slide KOs only from 212.2%.
 */
describe('The Duck: Dive Ram kill percents (measured, no Ultimate analogue)', () => {
  it.each([
    ['the dive spikes Mario 10 units past the ledge', 66, { air: true, from: { x: 90, y: 0 } }],
    ['the dive lands on Mario standing at the ledge', 195.8, {}],
  ] satisfies [string, number, Pick<KoSetup, 'air' | 'from'>][])(
    '%s: within 5 points of its measured %s%%',
    (_, measured, setup) => {
      const percent = koPercent({ hit: { fighter: 'duck', move: 'downB' }, ...setup });
      expect(percent).not.toBeNull();
      expect(Math.abs(percent! - measured)).toBeLessThanOrEqual(5);
    },
  );
});

describe('The Duck: throws', () => {
  it('down throw at 0% leaves the Duck free to act before the opponent: a combo starter', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'duck' }, { fighter: 'duck' }],
    });
    runPorts(m, 10, [{}, {}]);
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(v, { pos: { x: a.pos.x + 10 * a.facing, y: a.pos.y }, ground: a.ground, action: 'idle' });
    v.intangible = 0;
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, 8, [{}, {}]);
    expect(v.action).toBe('grabbed');
    runPorts(m, 1, [{ y: -100 }, {}]);
    expect(a.move).toBe('dthrow');
    let duckFree = 0;
    let victimFree = 0;
    for (let i = 1; i < 120 && !victimFree; i++) {
      runPorts(m, 1, [{}, {}]);
      if (!duckFree && a.action === 'idle') duckFree = i;
      if (v.launch === null && v.hitstun <= 0 && v.action !== 'grabbed') victimFree = i;
    }
    expect(duckFree).toBeGreaterThan(0);
    expect(duckFree).toBeLessThan(victimFree);
  });
});

describe('The Duck: Flight Training (up special)', () => {
  it('climbs about 100 units from frame 4, then leaves him helpless with 18 frames of landing lag', () => {
    const m = duck();
    const f = m.fighters[0]!;
    const y0 = f.pos.y;
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    let top = y0;
    let firstRise = 0;
    until(m, (g) => {
      if (!firstRise && g.pos.y > y0 + 0.5) firstRise = g.actionFrame;
      top = Math.max(top, g.pos.y);
      return g.action === 'helpless';
    });
    expect(firstRise).toBeLessThanOrEqual(5);
    expect(top - y0).toBeGreaterThan(90);
    expect(top - y0).toBeLessThan(110);
    until(m, (g) => g.ground !== null, {}, 900);
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(18);
  });

  it('steers with the stick', () => {
    const drift = (x: number) => {
      const m = duck();
      const f = m.fighters[0]!;
      const x0 = f.pos.x;
      run(m, 1, { y: 100, buttons: ['special'] });
      run(m, 40, { x });
      return f.pos.x - x0;
    };
    expect(drift(100)).toBeGreaterThan(30);
    expect(drift(-100)).toBeLessThan(-30);
    expect(Math.abs(drift(0))).toBeLessThan(2);
  });
});

describe('The Duck: Dive Ram (down special)', () => {
  it('in the air: winds up, then dives steeply down and forward from frame 10', () => {
    const m = duck();
    const f = placeInAir(m, -40, 120, 1);
    run(m, 1, { y: -100, buttons: ['special'] });
    expect(f.move).toBe('downB');
    run(m, 9);
    const start = { ...f.pos };
    run(m, 10);
    const dx = f.pos.x - start.x;
    const dy = f.pos.y - start.y;
    expect(dx).toBeGreaterThan(10);
    expect(-dy).toBeGreaterThan(1.5 * dx);
  });

  it('landing mid-dive turns into the belly-flop slide, which ends standing', () => {
    const m = duck();
    const f = placeInAir(m, -40, 20, 1);
    run(m, 1, { y: -100, buttons: ['special'] });
    until(m, (g) => g.ground !== null);
    run(m, 1);
    expect(f.move).toBe('downB');
    expect(f.action).toBe('attack');
    expect(f.actionFrame).toBeGreaterThanOrEqual(45);
    until(m, (g) => g.move !== 'downB');
    expect(f.action).toBe('idle');
  });

  it('landing on the last dive frame still launches the slide at full speed', () => {
    const m = duck();
    const f = placeInAir(m, -75, 120, 1);
    run(m, 1, { y: -100, buttons: ['special'] });
    until(m, (g) => g.actionFrame === 43);
    Object.assign(f, { pos: { x: f.pos.x, y: 1 }, prevPos: { x: f.pos.x, y: 1 } });
    run(m, 1);
    expect(f.ground).not.toBeNull();
    expect(f.actionFrame).toBe(44);
    run(m, 1);
    expect(f.actionFrame).toBe(45);
    expect(f.vel.x).toBeGreaterThan(2.2);
  });

  it('on the ground it is a slide forward from frame 10 with the 8% hitbox', () => {
    const m = duck();
    const f = m.fighters[0]!;
    f.facing = 1;
    const x0 = f.pos.x;
    run(m, 1, { y: -100, buttons: ['special'] });
    expect(f.move).toBe('downB');
    run(m, 9);
    expect(f.actionFrame).toBe(45);
    expect(activeHitboxes(f)[0]!.box.damage).toBe(8);
    run(m, 10);
    expect(f.pos.x - x0).toBeGreaterThan(10);
    expect(f.ground).not.toBeNull();
  });

  it('a dive that runs out in the air leaves him helpless', () => {
    const m = duck();
    const f = placeInAir(m, 100, 150, 1);
    run(m, 1, { y: -100, buttons: ['special'] });
    until(m, (g) => g.action !== 'aerial');
    expect(f.action).toBe('helpless');
  });

  it('the dive semi-spikes an airborne opponent for 13%', () => {
    const m = testMatch({ fighter: 'duck', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    placeInAir(m, -20, 80, 1);
    Object.assign(v, {
      pos: { x: -14, y: 70 },
      prevPos: { x: -14, y: 70 },
      ground: null,
      action: 'fall',
      vel: { x: 0, y: 0 },
      damage: 60,
    });
    v.intangible = 0;
    runPorts(m, 1, [{ y: -100, buttons: ['special'] }, {}]);
    expect(a.move).toBe('downB');
    for (let i = 0; i < 30 && v.damage === 60; i++) runPorts(m, 1, [{}, {}]);
    expect(v.damage).toBeCloseTo(60 + 13 * 1.05 * 1.2, 6);
    runPorts(m, v.hitlag + 2, [{}, {}]);
    expect(v.kb.y).toBeLessThan(0);
    expect(v.kb.x).toBeGreaterThan(0);
  });
});
