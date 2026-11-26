import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { koPercent, kos } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { attack, placeInAir, run, runPorts, testMatch, type Hold } from '../../sim/testing/sim';
import { allFighters } from '../registry';
import { GRAVITY_SWITCH, HOP, moves, RAPID_JAB, TREADMILL } from './moves';
import { stats } from './stats';

/** Runner (P1) against the Mario reference (P2) on Battlefield, settled on the ground. */
function vsMario(): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'runner' }, { fighter: marioReference.id }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  return { m, a, v };
}

function put(f: FighterState, x: number, facing: 1 | -1, ground: FighterState['ground']): void {
  Object.assign(f, {
    pos: { x, y: 0 },
    prevPos: { x, y: 0 },
    vel: { x: 0, y: 0 },
    facing,
    ground,
    action: 'idle',
    actionFrame: 1,
    intangible: 0,
  });
}

const THROW_INPUT: Record<string, (facing: number) => Hold> = {
  fthrow: (s) => ({ x: 100 * s }),
  bthrow: (s) => ({ x: -100 * s }),
  uthrow: () => ({ y: 100 }),
  dthrow: () => ({ y: -100 }),
};

/** Runner grabbing Mario at `percent`, 12 units apart on the main stage with her at `x` facing `facing`. */
function holding(percent: number, x = 0, facing: 1 | -1 = 1) {
  const { m, a, v } = vsMario();
  put(a, x, facing, v.ground);
  put(v, x + 12 * facing, -facing as 1 | -1, v.ground);
  v.damage = percent;
  runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
  runPorts(m, 6, [{}, {}]);
  expect(v.action).toBe('grabbed');
  return { m, a, v };
}

/** The action frames on which `move` has boxes out, started standing (or high in the air for aerials). */
function activeFrames(move: string): number[] {
  const m = testMatch({ fighter: 'runner' });
  const f = m.fighters[0]!;
  if (moves[move]!.kind === 'aerial') placeInAir(m, 0, 80);
  attack(m, 0, move);
  const frames: number[] = [];
  for (let i = 0; i < moves[move]!.faf; i++) {
    run(m, 1);
    if (f.move === move && activeHitboxes(f).length > 0) frames.push(f.actionFrame);
  }
  return frames;
}

describe('Runner: stats', () => {
  it("runs at Sonic's speed, the fastest on the roster, with Kirby's weight and only two jumps", () => {
    expect(stats.runSpeed).toBe(3.85);
    expect(stats.dashInitialSpeed).toBe(2.31);
    expect(stats.weight).toBe(79);
    expect(stats.jumps).toBe(2);
    for (const def of Object.values(allFighters()))
      expect(stats.runSpeed).toBeGreaterThanOrEqual(def.stats.runSpeed);
  });

  it('covers about twice the ground Fireboy does in one second of running', () => {
    const distance = (fighter: string) => {
      const m = testMatch({ fighter, x: -70 });
      const x0 = m.fighters[0]!.pos.x;
      run(m, 60, { x: 100 });
      return m.fighters[0]!.pos.x - x0;
    };
    expect(distance('runner')).toBeGreaterThan(1.8 * distance('fireboy'));
  });
});

describe('Runner: frame data (roster.md)', () => {
  it.each([
    ['jab', 2, 1.8],
    ['ftilt', 5, 8],
    ['utilt', 4, 5],
    ['dtilt', 5, 6],
    ['dashAttack', 7, 9],
    ['fsmash', 12, 15],
    ['usmash', 10, 15],
    ['dsmash', 6, 14],
    ['nair', 6, 9],
    ['fair', 7, 4],
    ['bair', 6, 13],
    ['uair', 7, 9],
    ['dair', 10, 1.2],
    ['grab', 6, 0],
    ['neutralB', 14, 8],
  ] as const)('%s comes out on frame %i with a %s damage sweetspot', (move, startup, damage) => {
    expect(activeFrames(move)[0]).toBe(startup);
    expect(moves[move]!.hits[0]!.boxes[0]!.damage).toBe(damage);
  });

  it('nair weakens from 9% to 6%, fair is 4% + 5%, and dair is five 1.2% stomps and a 3% stamp', () => {
    const damages = (move: string) => moves[move]!.hits.map((w) => w.boxes[0]!.damage);
    expect(damages('nair')).toEqual([9, 6]);
    expect(damages('fair')).toEqual([4, 5]);
    expect(damages('dair')).toEqual([1.2, 1.2, 1.2, 1.2, 1.2, 3]);
  });

  it('the smash attacks charge before they hit', () => {
    for (const move of ['fsmash', 'usmash', 'dsmash'])
      expect(activeFrames(move)[0]).toBeGreaterThan(moves[move]!.charge!);
  });

  it.each([
    ['fthrow', 0, 8],
    ['bthrow', 0, 8],
    ['uthrow', 0, 10],
    ['dthrow', TREADMILL.frames.length * TREADMILL.damage, 2],
  ] as const)('%s deals %s (treadmill steps) + %s (throw), x1.2 in 1v1', (move, steps, hit) => {
    const { m, a, v } = holding(30);
    runPorts(m, 1, [THROW_INPUT[move]!(a.facing), {}]);
    expect(a.move).toBe(move);
    runPorts(m, moves[move]!.throw!.frame, [{}, {}]);
    expect(v.damage).toBeCloseTo(30 + (steps + hit * 1.05) * 1.2, 6);
  });

  it('the headbutt pummel deals 1.3%', () => {
    const { m, v } = holding(0);
    runPorts(m, 1, [{ buttons: ['attack'] }, {}]);
    runPorts(m, 2, [{}, {}]);
    expect(v.damage).toBeCloseTo(1.3 * 1.2, 6);
  });
});

/**
 * Kirby's Ultimate sweetspots and throw releases (damage, angle, BKB, KBG):
 * https://dragdown.wiki/wiki/SSBU/Kirby/Data. Back throw's 130° toward the back is 50° in the launch direction.
 */
const ANALOGUES = [
  ['fsmash', 'forward smash', [15, 361, 32, 109], false],
  ['dsmash', 'down smash', [14, 29, 25, 94], false],
  ['usmash', 'up smash', [15, 75, 36, 104], false],
  ['bair', 'back air', [13, 361, 15, 100], true],
  ['bthrow', 'back throw', [8, 50, 30, 120], false],
  ['ftilt', 'forward tilt', [8, 361, 40, 100], false],
  ['uthrow', 'up throw', [10, 78, 75, 74], false],
  ['uair', 'up air', [9, 70, 20, 108], true],
] as const;

describe('Runner: kill % against Mario at the Battlefield ledge (fresh, no rage, no DI)', () => {
  const from = { x: 79.9, y: 0 };

  it.each(ANALOGUES)(
    "%s kills within 5%% of Kirby's Ultimate %s",
    (move, _analogue, [damage, angle, bkb, kbg], air) => {
      const ours = koPercent({ hit: { fighter: 'runner', move }, from, air });
      const analogue = koPercent({ hit: { damage, angle, bkb, kbg }, from, air });
      expect(ours).not.toBeNull();
      expect(analogue).not.toBeNull();
      expect(Math.abs(ours! - analogue!)).toBeLessThanOrEqual(5);
    },
  );

  it('gives her smashes and back air stronger launch than her tilts, and back throw an edge over forward throw', () => {
    const kill = (move: string, air = false) => {
      const percent = koPercent({ hit: { fighter: 'runner', move }, from, air });
      expect(percent, move).not.toBeNull();
      return percent!;
    };
    const fsmash = kill('fsmash');
    const ftilt = kill('ftilt');
    for (const move of ['dsmash', 'usmash', 'bair']) {
      const percent = kill(move, move === 'bair');
      expect(percent, move).toBeGreaterThan(fsmash);
      expect(percent, move).toBeLessThan(ftilt);
    }
    expect(kill('bthrow')).toBeLessThan(kill('fthrow'));
    expect(kill('usmash')).toBeLessThan(kill('neutralB'));
  });

  it('forward throw is not a kill throw: Mario survives it at the ledge at 150%', () => {
    expect(kos({ hit: { fighter: 'runner', move: 'fthrow' }, from }, 150)).toBe(false);
  });

  /**
   * Measured, not sourced. Tile Flip (neutral special) names no Ultimate analogue, and no Ultimate hit has its
   * damage, angle, BKB and KBG (8%, 90 degrees, BKB 50, KBG 90; searched in the 13.0.1 hitbox data of
   * ultimate-hitboxes.com), so there is no Ultimate kill percent to hold it to. 198.4% is what koPercent gave on main
   * when this was written. Box Drop has its own kill tests (box-drop.test.ts); the air kick and Gravity Switch KO
   * only from 591.3% and 457.4%.
   */
  it('Tile Flip launches Mario straight up to a KO within 5 points of its measured 198.4%', () => {
    const percent = koPercent({ hit: { fighter: 'runner', move: 'neutralB' }, from });
    expect(percent).not.toBeNull();
    expect(Math.abs(percent! - 198.4)).toBeLessThanOrEqual(5);
  });
});

describe('Runner: combo tools', () => {
  it('up tilt leaves her free before Mario leaves hitstun at 20%, so it chains into itself', () => {
    const { m, a, v } = vsMario();
    put(a, 0, 1, v.ground);
    put(v, 4, -1, v.ground);
    v.damage = 20;
    attack(m, 0, 'utilt');
    let free = 0;
    for (let i = 1; i < 60 && !free; i++) {
      runPorts(m, 1, [{}, {}]);
      if (a.action === 'idle') free = i;
    }
    expect(v.damage).toBeGreaterThan(20);
    expect(v.hitstun).toBeGreaterThan(0);
  });

  it('down throw treads on Mario four times, then pops him up with her free first: a combo throw', () => {
    const { m, a, v } = holding(0);
    runPorts(m, 1, [{ y: -100 }, {}]);
    expect(a.move).toBe('dthrow');
    let pummels = 0;
    let runnerFree = 0;
    let marioFree = 0;
    for (let i = 1; i < 120 && !marioFree; i++) {
      runPorts(m, 1, [{}, {}]);
      pummels += m.events.filter((e) => e.type === 'pummel').length;
      if (!runnerFree && a.action === 'idle') runnerFree = i;
      if (i > moves.dthrow!.throw!.frame && v.launch === null && v.hitstun <= 0) marioFree = i;
    }
    expect(pummels).toBe(TREADMILL.frames.length);
    expect(runnerFree).toBeGreaterThan(0);
    expect(runnerFree).toBeLessThan(marioFree);
  });

  it('the last hit of down air is a meteor', () => {
    const { m, v } = vsMario();
    const a = placeInAir(m, 0, 60);
    Object.assign(v, {
      pos: { x: 0, y: 55 },
      prevPos: { x: 0, y: 55 },
      ground: null,
      action: 'fall',
      damage: 60,
    });
    attack(m, 0, 'dair');
    const hits: [number, number | undefined][] = [];
    for (let i = 0; i < 120 && a.actionFrame < 28; i++) {
      Object.assign(a, { pos: { x: 0, y: 60 }, vel: { x: 0, y: 0 } });
      Object.assign(v, { pos: { x: 0, y: 55 }, vel: { x: 0, y: 0 }, kb: { x: 0, y: 0 } });
      runPorts(m, 1, [{}, {}]);
      if (m.events.some((e) => e.type === 'hit')) hits.push([a.actionFrame, v.launch?.angle]);
    }
    expect(hits.map(([frame]) => frame)).toEqual([10, 13, 16, 19, 22, 26]);
    expect(hits.at(-1)![1]).toBe(270);
  });

  it('down smash kicks both sides at once', () => {
    const side = (offset: number) => {
      const { m, a, v } = vsMario();
      put(a, 0, 1, v.ground);
      put(v, offset, -1, v.ground);
      attack(m, 0, 'dsmash');
      for (let i = 0; i < 8 && v.damage === 0; i++) runPorts(m, 1, [{}, {}]);
      return { frame: a.actionFrame, dir: v.launch?.dir };
    };
    expect(side(8.5)).toEqual({ frame: 6, dir: 1 });
    expect(side(-8.5)).toEqual({ frame: 6, dir: -1 });
  });
});

describe('Runner: Jog Flurry (jab: two punches, a kick flurry, a shove)', () => {
  /** Mario standing 7 units in front of her; she presses Attack every 4 frames for `mash` frames. */
  function flurry(mash: number, frames = 150) {
    const { m, a, v } = vsMario();
    put(a, 0, 1, v.ground);
    put(v, 7, -1, v.ground);
    const seen: string[] = [];
    let flurries = 0;
    let last = { move: '', frame: 0 };
    let shovedAt = -1;
    for (let i = 0; i < frames; i++) {
      runPorts(m, 1, [i % 4 === 0 && i < mash ? { buttons: ['attack'] } : {}, {}]);
      if (a.move && seen.at(-1) !== a.move) seen.push(a.move);
      if (a.move === 'jabRapid' && (last.move !== 'jabRapid' || a.actionFrame < last.frame)) flurries++;
      last = { move: a.move ?? '', frame: a.actionFrame };
      if (shovedAt < 0 && v.action === 'tumble') shovedAt = i;
    }
    return { a, v, seen, flurries, shovedAt };
  }

  it('Attack again chains jab -> jab2 -> the kick flurry, and the shove launches when she stops', () => {
    const { a, v, seen, flurries, shovedAt } = flurry(40);
    expect(seen).toEqual(['jab', 'jab2', 'jabRapid']);
    expect(flurries).toBe(1);
    expect(shovedAt).toBeGreaterThan(40);
    expect(a.action).toBe('idle');
    expect(v.damage).toBeCloseTo((1.8 + 1.8 + 0.3 * RAPID_JAB.kicks.length + 3) * 1.05 * 1.2, 6);
  });

  it('mashing keeps the flurry going, and the shove only comes out once she stops', () => {
    const short = flurry(40);
    const long = flurry(80);
    expect(long.flurries).toBeGreaterThan(short.flurries);
    expect(long.shovedAt).toBeGreaterThan(80);
    expect(long.v.damage).toBeGreaterThan(short.v.damage);
  });

  it('keeps all four kicks in every loop: a kick every other frame for as long as she mashes', () => {
    const m = testMatch({ fighter: 'runner' });
    const f = attack(m, 0, 'jabRapid');
    const ticks: number[] = [];
    for (let i = 0; i < 40; i++) {
      run(m, 1, i % 3 === 0 ? { buttons: ['attack'] } : {});
      if (f.move === 'jabRapid' && activeHitboxes(f).length > 0) ticks.push(i);
    }
    expect(ticks).toEqual(Array.from({ length: 20 }, (_, i) => 2 * i));
  });

  it('kicks every other frame, then shoves three frames after the loop window closes', () => {
    expect(activeFrames('jabRapid')).toEqual([...RAPID_JAB.kicks, RAPID_JAB.shove[0], RAPID_JAB.shove[1]]);
    expect(RAPID_JAB.shove[0]).toBe(RAPID_JAB.loop + 1 + 3);
    expect(moves.jabRapid!.next).toEqual({ window: [RAPID_JAB.loop, RAPID_JAB.loop + 1], move: 'jabRapid' });
  });
});

describe('Runner: Tile Flip (neutral special)', () => {
  it('on the ground the tile in front launches Mario straight up', () => {
    const { m, a, v } = vsMario();
    put(a, 0, 1, v.ground);
    put(v, 11, -1, v.ground);
    v.damage = 50;
    runPorts(m, 1, [{ buttons: ['special'] }, {}]);
    expect(a.move).toBe('neutralB');
    for (let i = 0; i < 20 && !v.launch; i++) runPorts(m, 1, [{}, {}]);
    expect(a.actionFrame).toBe(14);
    expect(v.launch?.angle).toBe(90);
  });

  it('in the air it is the hop kick, and chaining it still loses height', () => {
    const m = testMatch({ fighter: 'runner' });
    const f = placeInAir(m, 0, 150);
    run(m, 1, { buttons: ['special'] });
    expect(f.move).toBe('neutralBAir');
    run(m, HOP.frame - 1);
    expect(f.vel.y).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) {
      run(m, moves.neutralBAir!.faf - f.actionFrame);
      run(m, 1, { buttons: ['special'] });
      expect(f.move).toBe('neutralBAir');
    }
    expect(f.pos.y).toBeLessThan(150);
  });
});

describe('Runner: Gravity Switch (up special)', () => {
  it('falls upward about 90 units in its 50 frames, then leaves her helpless', () => {
    const m = testMatch({ fighter: 'runner', x: 70 });
    const f = m.fighters[0]!;
    const y0 = f.pos.y;
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    let top = y0;
    for (let i = 0; i < 80 && f.action !== 'helpless'; i++) {
      run(m, 1);
      top = Math.max(top, f.pos.y);
    }
    expect(f.action).toBe('helpless');
    expect(top - y0).toBeGreaterThan(80);
    expect(top - y0).toBeLessThan(100);
  });

  it('pressing Special again flips gravity back early', () => {
    const m = testMatch({ fighter: 'runner', x: 70 });
    const f = m.fighters[0]!;
    run(m, 1, { y: 100, buttons: ['special'] });
    run(m, GRAVITY_SWITCH.cancelFrom + 2);
    const y = f.pos.y;
    run(m, 1, { buttons: ['special'] });
    expect(f.action).toBe('helpless');
    run(m, 20);
    expect(f.pos.y).toBeLessThan(y + 5);
  });

  it('faces the direction she steers during the rise before touching a ceiling', () => {
    const m = testMatch({ fighter: 'runner', x: 70 });
    const f = placeInAir(m, 70, 8, -1);
    run(m, 1, { y: 100, buttons: ['special'] });
    const start = f.pos.x;
    run(m, 6, { x: 100 });
    expect(f.move).toBe('upB');
    expect(f.actionFrame).toBeLessThan(GRAVITY_SWITCH.cling[0]);
    expect(f.pos.x).toBeGreaterThan(start);
    expect(f.facing).toBe(1);
    run(m, 1, { x: -100 });
    expect(f.facing).toBe(-1);
  });

  it('clings to the underside of the top platform and runs along it upside down', () => {
    const m = testMatch({ fighter: 'runner', x: 0 });
    const f = m.fighters[0]!;
    run(m, 1, { y: 100, buttons: ['special'] });
    for (let i = 0; i < 60 && f.actionFrame < GRAVITY_SWITCH.cling[0]; i++) run(m, 1);
    const platform = 47.19;
    run(m, 2);
    expect(f.pos.y + stats.height).toBeCloseTo(platform, 6);
    const x0 = f.pos.x;
    run(m, 6, { x: 100 });
    expect(f.pos.y + stats.height).toBeCloseTo(platform, 6);
    expect(f.pos.x - x0).toBeGreaterThan(10);
    expect(f.facing).toBe(1);
  });

  it('activated while already pressed against the underside of the stage, she still clings to it', () => {
    const probe = testMatch({ fighter: 'runner' });
    const p = placeInAir(probe, 0, -60);
    run(probe, 1, { y: 100, buttons: ['special'] });
    for (let i = 0; i < 60 && p.actionFrame < GRAVITY_SWITCH.cling[0]; i++) run(probe, 1);
    run(probe, 1);
    const underside = p.pos.y + stats.height;

    const m = testMatch({ fighter: 'runner' });
    const f = placeInAir(m, 0, underside - stats.height * 0.75 - 0.5);
    run(m, 1, { buttons: ['jump'] });
    run(m, 6);
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    for (let i = 0; i < 20 && f.actionFrame < GRAVITY_SWITCH.cling[0]; i++) run(m, 1);
    expect(f.actionFrame).toBeGreaterThanOrEqual(GRAVITY_SWITCH.cling[0]);
    run(m, 2);
    expect(f.pos.y + stats.height).toBeCloseTo(underside, 6);
  });

  it('from under the stage she rises to its underside, runs out along it and catches the ledge', () => {
    const m = testMatch({ fighter: 'runner' });
    const f = placeInAir(m, -60, -90, -1);
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    const clinging = () =>
      f.actionFrame >= GRAVITY_SWITCH.cling[0] && f.actionFrame <= GRAVITY_SWITCH.cling[1];
    for (let i = 0; i < 60 && !clinging(); i++) run(m, 1);
    expect(clinging()).toBe(true);
    for (let i = 0; i < 70 && clinging(); i++) run(m, 1, { x: -100 });
    expect(f.actionFrame).toBeGreaterThanOrEqual(GRAVITY_SWITCH.pop[0]);
    for (let i = 0; i < 30 && !f.action.startsWith('ledge'); i++) run(m, 1, { x: 100 });
    expect(f.action.startsWith('ledge')).toBe(true);
    expect(f.ledge).toBe(0);
  });
});
