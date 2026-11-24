import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { kills, koPercent, throwKills, versusMario } from './ko';
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

  it('rolls up to top speed slowly: about 30 frames of running from the end of the dash', () => {
    const m = redball();
    const f = m.fighters[0]!;
    until(m, (g) => g.action === 'run', { x: 100 });
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
  it.each([
    ['jab', 3, 2],
    ['jab2', 3, 2],
    ['jab3', 4, 3],
    ['ftilt', 6, 8],
    ['utilt', 5, 7],
    ['dtilt', 5, 6],
    ['dashAttack', 6, 11],
    ['fsmash', 15, 16],
    ['usmash', 11, 15],
    ['dsmash', 9, 13],
    ['nair', 4, 8],
    ['fair', 8, 10],
    ['bair', 7, 12],
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
    ['bthrow', 10],
    ['uthrow', 8],
    ['dthrow', 7],
  ] as const)('%s deals %i%%', (move, damage) => {
    const def = moves[move]!;
    expect(def.pummel?.damage ?? def.throw?.hit.damage).toBe(damage);
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
 * The roster sheet's kill percents on Mario at the Battlefield ledge. TODO: once COOL-3's knockback calibration
 * lands, retune against its koPercent helper and assert each within a few % of its target. Until then the engine
 * KOs early across the cast, so these only pin the order and that each one kills.
 */
const KILL_TARGETS = [
  ['fsmash', 100, (p: number) => kills('fsmash', p, 12)],
  ['usmash', 110, (p: number) => kills('usmash', p, 3)],
  ['bair', 135, (p: number) => kills('bair', p, 7.5, -1, 3)],
  ['bthrow', 160, (p: number) => throwKills('bthrow', p, { x: 100 })],
] as const;

describe('Red Ball: kill moves on Mario at the Battlefield ledge (roster sheet order)', () => {
  it('fsmash kills first, then usmash, bair and bthrow, all before 200%', () => {
    const measured = KILL_TARGETS.map(([, , ko]) => koPercent(ko));
    expect(measured).toEqual([...measured].sort((a, b) => a - b));
    expect(Math.max(...measured)).toBeLessThan(200);
  });

  it('forward throw and the tilts do not kill before 150%', () => {
    expect(koPercent((p) => throwKills('fthrow', p, { x: 100 }))).toBeGreaterThan(150);
    expect(koPercent((p) => kills('ftilt', p, 8))).toBeGreaterThan(150);
    expect(koPercent((p) => kills('utilt', p, 3))).toBeGreaterThan(150);
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
