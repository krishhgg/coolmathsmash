import { describe, expect, it } from 'vitest';
import { isIntangible } from '../../sim/actions/registry';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { attack, placeInAir, run, runPorts, testMatch, until } from '../../sim/testing/sim';
import { moves as fireboyMoves } from '../fireboy/moves';
import type { MoveDef } from '../types';
import { moves } from './moves';

const watergirl = () => testMatch({ fighter: 'watergirl' });

/** Damage of a move's strongest hitbox, or of its pummel or throw. */
const damage = (move: MoveDef) =>
  move.pummel?.damage ??
  move.throw?.hit.damage ??
  Math.max(...move.hits.flatMap((w) => w.boxes.map((b) => b.damage)));

/** How far in front of the fighter a move's hitboxes reach. */
const reach = (move: MoveDef) => Math.max(...move.hits.flatMap((w) => w.boxes.map((b) => b.x + b.radius)));

/** Plays `move` from standing (aerials high in the air): frames with a hitbox out, and frames until it ends. */
function play(move: string): { active: number[]; frames: number } {
  const m = watergirl();
  const f = moves[move]!.kind === 'aerial' ? placeInAir(m, -70, 150) : m.fighters[0]!;
  attack(m, 0, move);
  const active: number[] = [];
  let frames = 0;
  while (frames < 200) {
    run(m, 1);
    frames++;
    if (f.move !== move) break;
    if (activeHitboxes(f).length > 0) active.push(f.actionFrame);
  }
  return { active, frames };
}

/** `fighter` (P1, facing right) does `move` at a second one `offset` units ahead at 100%; returns its knockback. */
function launch(fighter: string, move: string, offset: number, air: boolean) {
  const m = testMatch({ fighter, players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  if (air) placeInAir(m, -70, 150, 1);
  else a.facing = 1;
  const at = { x: a.pos.x + offset, y: a.pos.y };
  Object.assign(v, {
    pos: { ...at },
    prevPos: { ...at },
    ground: air ? null : a.ground,
    action: air ? 'fall' : 'idle',
    vel: { x: 0, y: 0 },
    damage: 100,
  });
  v.intangible = 0;
  attack(m, 0, move);
  for (let i = 0; i < moves[move]!.faf && v.kb.x === 0 && v.kb.y === 0; i++) runPorts(m, 1, [{}, {}]);
  return { ...v.kb };
}

describe('Watergirl: damage (roster sheet, W column)', () => {
  it.each([
    ['jab', 2],
    ['jab2', 1.5],
    ['jab3', 4],
    ['ftilt', 7],
    ['utilt', 5.5],
    ['dtilt', 6.5],
    ['dashAttack', 8],
    ['fsmash', 15],
    ['usmash', 13],
    ['dsmash', 11],
    ['nair', 7.5],
    ['fair', 11],
    ['bair', 10],
    ['uair', 7],
    ['pummel', 1.3],
    ['fthrow', 8],
    ['bthrow', 10],
    ['uthrow', 7],
    ['dthrow', 5],
  ] as const)('%s: %s%%', (move, dmg) => {
    expect(damage(moves[move]!)).toBe(dmg);
  });

  it('multi-hit moves: dsmash 10 then 11, dair 1.2 x5 + 5, Geyser 2 x4 + 2', () => {
    const windows = (move: string) => moves[move]!.hits.map((w) => Math.max(...w.boxes.map((b) => b.damage)));
    expect(windows('dsmash')).toEqual([10, 11]);
    expect(windows('dair')).toEqual([1.2, 1.2, 1.2, 1.2, 1.2, 5]);
    expect(windows('upB')).toEqual([2, 2, 2, 2, 2]);
  });

  it('nothing she does burns', () => {
    for (const move of Object.values(moves)) {
      for (const b of move.hits.flatMap((w) => w.boxes)) expect(b.effect).toBeUndefined();
      expect(move.throw?.hit.effect).toBeUndefined();
    }
  });
});

describe("Watergirl: frame data (Mario's moves; Toon Link's fair)", () => {
  it.each([
    ['jab', [2, 3], 20],
    ['jab2', [2, 3], 22],
    ['jab3', [3, 4], 34],
    ['ftilt', [5, 7], 26],
    ['utilt', [5, 11], 30],
    ['dtilt', [5, 7], 28],
    ['dashAttack', [6, 25], 38],
    ['fsmash', [15, 17], 48],
    ['usmash', [9, 12], 40],
    ['dsmash', [5, 14], 44],
    ['nair', [3, 27], 46],
    ['fair', [14, 15], 39],
    ['bair', [6, 10], 34],
    ['uair', [4, 7], 31],
    ['dair', [5, 23], 38],
  ] as const)('%s is out on frames %j and ends on frame %s', (move, [first, last], faf) => {
    const { active, frames } = play(move);
    expect([active[0], active.at(-1)]).toEqual([first, last]);
    expect(frames).toBe(faf);
  });

  it('down smash hits in front on frames 5-6, then behind on frame 14', () => {
    expect(play('dsmash').active).toEqual([5, 6, 14]);
  });

  it("her grabs are Fireboy's, and she keeps his Temple Mirror but not his fireball", () => {
    for (const move of ['grab', 'dashGrab', 'pivotGrab', 'pummel'])
      expect(moves[move]).toEqual(fireboyMoves[move]);
    expect(moves.sideB).toBe(fireboyMoves.sideB);
    expect(moves.neutralB).toBeUndefined();
  });
});

describe('Watergirl: 1-2-Kick', () => {
  it('Attack inside each window chains jab -> jab2 -> jab3, and all three hits land: 7.5%', () => {
    const m = testMatch({ fighter: 'watergirl', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(v, { pos: { x: a.pos.x + 6 * a.facing, y: a.pos.y }, ground: a.ground, action: 'idle' });
    v.intangible = 0;
    const seen: string[] = [];
    for (let i = 0; i < 70; i++) {
      runPorts(m, 1, [i % 10 === 0 && i < 30 ? { buttons: ['attack'] } : {}, {}]);
      if (a.move && seen.at(-1) !== a.move) seen.push(a.move);
    }
    expect(seen).toEqual(['jab', 'jab2', 'jab3']);
    expect(v.damage).toBeCloseTo((2 + 1.5 + 4) * 1.05 * 1.2, 6);
  });

  it('a single press plays only the first punch', () => {
    const m = watergirl();
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
});

describe('Watergirl: the spacer next to Fireboy', () => {
  it("Hair Whip reaches 6 units past Fireboy's and hits an opponent 17.5 units away that his misses", () => {
    expect(reach(moves.ftilt!) - reach(fireboyMoves.ftilt!)).toBeCloseTo(6, 6);
    expect(launch('watergirl', 'ftilt', 17.5, false).x).toBeGreaterThan(0);
    expect(launch('fireboy', 'ftilt', 17.5, false)).toEqual({ x: 0, y: 0 });
  });

  it("forward air reaches farther than Fireboy's too", () => {
    expect(reach(moves.fair!)).toBeGreaterThan(reach(fireboyMoves.fair!));
    expect(launch('watergirl', 'fair', 17.5, true).x).toBeGreaterThan(0);
    expect(launch('fireboy', 'fair', 17.5, true)).toEqual({ x: 0, y: 0 });
  });

  it("her forward air launches up and forward where Fireboy's sweetspot meteors", () => {
    const hers = launch('watergirl', 'fair', 11, true);
    expect(hers.x).toBeGreaterThan(0);
    expect(hers.y).toBeGreaterThan(0);
    expect(launch('fireboy', 'fair', 11, true).y).toBeLessThan(0);
  });

  it('back air and the rear hit of down smash launch backward', () => {
    expect(launch('watergirl', 'bair', -8, true).x).toBeLessThan(0);
    expect(launch('watergirl', 'dsmash', -9, false).x).toBeLessThan(0);
    expect(launch('watergirl', 'dsmash', 9, false).x).toBeGreaterThan(0);
  });

  it('dair connects all six hits rising out of a jump, as Mario does (Ally combo)', () => {
    const m = testMatch({ fighter: 'watergirl', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    runPorts(m, 1, [{ buttons: ['jump'] }, {}]);
    for (let i = 0; i < 10 && a.ground; i++) runPorts(m, 1, [{ buttons: ['jump'] }, {}]);
    expect(a.ground).toBeNull();
    const at = { x: a.pos.x, y: a.pos.y };
    Object.assign(v, {
      pos: { ...at },
      prevPos: { ...at },
      ground: null,
      action: 'fall',
      vel: { x: 0, y: 0 },
    });
    v.intangible = 0;
    runPorts(m, 1, [{ cy: -100 }, {}]);
    expect(a.move).toBe('dair');
    let hits = 0;
    let last = 0;
    for (let i = 0; i < 60; i++) {
      runPorts(m, 1, [{}, {}]);
      if (v.damage > last) hits++;
      last = v.damage;
    }
    expect(hits).toBe(6);
    expect(v.damage).toBeCloseTo((1.2 * 5 + 5) * 1.05 * 1.2, 6);
  });
});

describe('Watergirl: Geyser (up special)', () => {
  /** Height gained by `fighter`'s up special from standing, to the top of the helpless fall. */
  function rise(fighter: string): number {
    const m = testMatch({ fighter });
    const f = m.fighters[0]!;
    const y0 = f.pos.y;
    let top = y0;
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    until(m, (g) => {
      top = Math.max(top, g.pos.y);
      return g.ground !== null;
    });
    return top - y0;
  }

  it("rides about 20% higher than Fireboy's Flame Jump from the same start", () => {
    const ratio = rise('watergirl') / rise('fireboy');
    expect(ratio).toBeGreaterThan(1.15);
    expect(ratio).toBeLessThan(1.25);
  });

  it("leaves her helpless, landing with Mario's 30 frames of Super Jump Punch landing lag", () => {
    const m = watergirl();
    const f = m.fighters[0]!;
    run(m, 1, { y: 100, buttons: ['special'] });
    until(m, (g) => g.action === 'helpless');
    until(m, (g) => g.ground !== null);
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(30);
  });

  it('carries an opponent standing beside her through all five hits: 10%', () => {
    const m = testMatch({ fighter: 'watergirl', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    const at = { x: a.pos.x + 4 * a.facing, y: a.pos.y };
    Object.assign(v, { pos: { ...at }, prevPos: { ...at }, ground: a.ground, action: 'idle' });
    v.intangible = 0;
    runPorts(m, 1, [{ y: 100, buttons: ['special'] }, {}]);
    let hits = 0;
    let last = 0;
    for (let i = 0; i < 60; i++) {
      runPorts(m, 1, [{}, {}]);
      if (v.damage > last) hits++;
      last = v.damage;
    }
    expect(hits).toBe(5);
    expect(v.damage).toBeCloseTo(10 * 1.05 * 1.2, 6);
  });
});

describe('Watergirl: swap back to Fireboy', () => {
  it('down special becomes Fireboy on frame 18, intangible 18-32, actionable on frame 51, keeping % and stocks', () => {
    const m = watergirl();
    const f = m.fighters[0]!;
    Object.assign(f, { damage: 42, stocks: 2 });
    run(m, 1, { y: -100, buttons: ['special'] });
    expect(f.move).toBe('downB');
    const seen: { frame: number; fighter: string; intangible: boolean }[] = [];
    while (f.move === 'downB') {
      seen.push({ frame: f.actionFrame, fighter: f.fighter, intangible: isIntangible(f) });
      run(m, 1);
    }
    expect(seen.filter((s) => s.fighter === 'watergirl').map((s) => s.frame)).toEqual(range(1, 17));
    expect(seen.filter((s) => s.intangible).map((s) => s.frame)).toEqual(range(18, 32));
    expect(seen.at(-1)!.frame).toBe(50);
    expect(f).toMatchObject({ action: 'idle', fighter: 'fireboy', damage: 42, stocks: 2 });
  });

  it('works in the air without giving back a jump', () => {
    const m = watergirl();
    const f = placeInAir(m, -70, 150);
    f.jumpsUsed = 2;
    run(m, 1, { y: -100, buttons: ['special'] });
    const intangible: number[] = [];
    while (f.move === 'downB') {
      expect(f.ground).toBeNull();
      if (isIntangible(f)) intangible.push(f.actionFrame);
      run(m, 1);
    }
    expect(intangible).toEqual(range(18, 32));
    expect(f).toMatchObject({ fighter: 'fireboy', jumpsUsed: 2 });
  });

  it('landing during the swap neither cancels it nor cuts it short', () => {
    for (const height of [3, 25]) {
      const m = watergirl();
      const f = placeInAir(m, -70, height);
      run(m, 1, { y: -100, buttons: ['special'] });
      const frames: number[] = [];
      while (f.move === 'downB') {
        frames.push(f.actionFrame);
        run(m, 1);
      }
      expect(f.ground, `from ${height}`).not.toBeNull();
      expect(frames, `from ${height}`).toEqual(range(1, 50));
      expect(f).toMatchObject({ fighter: 'fireboy', action: 'idle' });
    }
  });

  it('Fireboy swaps back into her, jab combo and all', () => {
    const m = watergirl();
    const f = m.fighters[0]!;
    run(m, 1, { y: -100, buttons: ['special'] });
    until(m, (g) => g.action === 'idle');
    expect(f.fighter).toBe('fireboy');
    run(m, 1, { y: -100, buttons: ['special'] });
    until(m, (g) => g.action === 'idle');
    expect(f.fighter).toBe('watergirl');
    run(m, 1, { buttons: ['attack'] });
    run(m, 5);
    run(m, 1, { buttons: ['attack'] });
    expect(f.move).toBe('jab2');
  });
});

// TODO(#66): kill-% tests with koPercent (src/sim/testing/ko.ts) against each move's Ultimate analogue.

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
