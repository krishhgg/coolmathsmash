import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { attack, run, runPorts, testMatch, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { stats } from './stats';

/** Fluffy (P1) against the Mario reference (P2) on Battlefield, both settled. */
function vsMario(): MatchState {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'fluffy' }, { fighter: 'reference-mario' }],
  });
  runPorts(m, 10, [{}, {}]);
  return m;
}

/** Put f at rest at (x, y), standing on ground or in the air. */
function place(
  f: FighterState,
  x: number,
  y: number,
  facing: 1 | -1,
  ground: FighterState['ground'] | null,
): void {
  Object.assign(f, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    kb: { x: 0, y: 0 },
    facing,
    ground,
    action: ground ? 'idle' : 'fall',
    actionFrame: 1,
    intangible: 0,
  });
}

/** The furthest point in front of Fluffy that any box of the move reaches. */
const reach = (move: string) =>
  Math.max(...moves[move]!.hits.flatMap((w) => w.boxes.map((b) => b.x + b.radius)));

/** The move's first active frame. */
const startup = (move: string) => Math.min(...moves[move]!.hits.map((w) => w.frames[0]));

/** The strongest damage any box of the move deals. */
const damage = (move: string) => Math.max(...moves[move]!.hits.flatMap((w) => w.boxes.map((b) => b.damage)));

type KillMove = 'fsmash' | 'usmash' | 'bair' | 'bthrow';

/**
 * Whether the move KOs the Mario reference standing at Battlefield's right ledge at percent, off the side or top
 * blast zone (the roster's kill-% convention: fresh, no rage, no DI). Each setup lands the move's strongest hit:
 * forward smash from its full range, up smash from beside him, back air in the air facing the stage, and back
 * throw from a grab near the ledge.
 */
function kos(move: KillMove, percent: number): boolean {
  const m = vsMario();
  const [a, v] = m.fighters as [FighterState, FighterState];
  const ground = v.ground;
  const ledge = 76;
  place(v, ledge, 0, -1, ground);
  if (move === 'fsmash') place(a, ledge - 64, 0, 1, ground);
  if (move === 'usmash') place(a, ledge - 12, 0, 1, ground);
  if (move === 'bair') place(a, ledge - 21, 4, -1, null);
  if (move === 'bthrow') {
    place(a, ledge - 10, 0, -1, ground);
    place(v, ledge - 22, 0, 1, ground);
  }
  v.damage = percent;
  if (move === 'bthrow') {
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, 14, [{}, {}]);
    expect(v.action).toBe('grabbed');
    runPorts(m, 1, [{ x: 100 }, {}]);
    expect(a.move).toBe('bthrow');
  } else attack(m, 0, move);
  let side = '';
  for (let i = 0; i < 400 && v.action !== 'ko'; i++) {
    runPorts(m, 1, [{}, {}]);
    for (const e of m.events) if (e.type === 'ko') side = e.side;
  }
  expect(v.damage, move + ' connects').toBeGreaterThan(percent);
  return side === 'right' || side === 'top';
}

/** The lowest whole percent at which the move KOs, searched within 40% of the target. */
function killPercent(move: KillMove, target: number): number {
  for (let p = target - 40; p <= target + 40; p++) if (kos(move, p)) return p;
  return Infinity;
}

describe('Fluffy: stats (roster sheet 8)', () => {
  it('has the roster attributes: heavy, the slowest walker, runner and drifter, and Jigglypuff-floaty', () => {
    expect(stats).toMatchObject({
      weight: 118,
      walkSpeed: 0.62,
      dashInitialSpeed: 1.45,
      runSpeed: 1.18,
      airSpeed: 0.735,
      gravity: 0.053,
      fallSpeed: 0.98,
      fastFallSpeed: 1.568,
      jumps: 2,
      fullHopHeight: 18,
      shortHopHeight: 10,
      doubleJumpHeight: 20,
    });
    expect(stats.airAccelBase + stats.airAccelAdd).toBeCloseTo(0.04, 6);
  });

  it('a full hop peaks 18 units up and a short hop 10', () => {
    const apex = (frames: number) => {
      const m = testMatch({ fighter: 'fluffy' });
      const f = m.fighters[0]!;
      const y0 = f.pos.y;
      let top = y0;
      for (let i = 0; i < 120; i++) {
        run(m, 1, i < frames ? { buttons: ['jump'] } : {});
        top = Math.max(top, f.pos.y);
      }
      return top - y0;
    };
    expect(apex(6)).toBeCloseTo(18, 0);
    expect(apex(1)).toBeCloseTo(10, 0);
  });

  it('walks at 0.62 and runs at 1.18 units a frame', () => {
    const walk = testMatch({ fighter: 'fluffy' });
    run(walk, 50, (i): Hold => ({ x: i < 8 ? 25 + i * 10 : 100 }));
    expect(walk.fighters[0]!.action).toBe('walk');
    expect(walk.fighters[0]!.vel.x).toBeCloseTo(0.62, 5);
    const dash = testMatch({ fighter: 'fluffy', x: -60 });
    run(dash, 1, { x: 100 });
    expect(dash.fighters[0]!.vel.x).toBeCloseTo(1.45, 5);
    run(dash, 40, { x: 100 });
    expect(dash.fighters[0]!.action).toBe('run');
    expect(dash.fighters[0]!.vel.x).toBeCloseTo(1.18, 5);
  });
});

describe('Fluffy: frame data (roster sheet 8)', () => {
  it.each([
    ['jab', 3, 2],
    ['ftilt', 7, 8],
    ['utilt', 6, 6],
    ['dtilt', 6, 6],
    ['dashAttack', 8, 9],
    ['fsmash', 16, 15],
    ['usmash', 13, 14],
    ['dsmash', 10, 12],
    ['nair', 5, 8],
    ['fair', 9, 10],
    ['bair', 9, 11],
    ['uair', 6, 7],
    ['dair', 12, 10],
    ['grab', 12, 0],
  ])('%s comes out on frame %i and deals %s%%', (move, frame, dmg) => {
    expect(startup(move)).toBe(frame);
    expect(damage(move)).toBe(dmg);
  });

  it.each([
    ['fthrow', 8],
    ['bthrow', 11],
    ['uthrow', 9],
    ['dthrow', 6],
  ])('%s deals %s%%', (move, dmg) => {
    expect(moves[move]!.throw!.hit.damage).toBe(dmg);
  });

  it('pummel squeezes for 1.3%', () => {
    expect(moves.pummel!.pummel!.damage).toBe(1.3);
  });

  it('the grabber gives him Min Min reach: forward tilt 45 units, forward smash and grab 70', () => {
    expect(reach('ftilt')).toBeCloseTo(45, 6);
    expect(reach('fsmash')).toBeCloseTo(70, 6);
    expect(reach('grab')).toBeCloseTo(70, 6);
    expect(reach('dashGrab')).toBeCloseTo(70, 6);
    expect(reach('pivotGrab')).toBeCloseTo(70, 6);
  });

  it('forward smash is out on frames 16-18 and he can act again on frame 62', () => {
    const m = testMatch({ fighter: 'fluffy' });
    const f = m.fighters[0]!;
    run(m, 1, { x: 100, buttons: ['attack'] });
    expect(f.move).toBe('fsmash');
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

  it('down air spikes on its first frames and pops up after', () => {
    const [early, late] = moves.dair!.hits;
    expect(early!.boxes[0]!.angle).toBe(270);
    expect(late!.boxes[0]!.angle).toBeLessThan(90);
  });
});

describe('Fluffy: tether grab', () => {
  /** Whether a standing grab catches the Mario reference distance units in front. */
  const catches = (distance: number) => {
    const m = vsMario();
    const [a, v] = m.fighters as [FighterState, FighterState];
    place(a, -40, 0, 1, a.ground);
    place(v, -40 + distance, 0, -1, a.ground);
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    expect(a.move).toBe('grab');
    runPorts(m, 20, [{}, {}]);
    return v.action === 'grabbed';
  };

  it('catches an opponent 10 or 64 units away but not 75', () => {
    expect(catches(10)).toBe(true);
    expect(catches(64)).toBe(true);
    expect(catches(75)).toBe(false);
  });

  it('reels the catch in next to him', () => {
    const m = vsMario();
    const [a, v] = m.fighters as [FighterState, FighterState];
    place(a, -40, 0, 1, a.ground);
    place(v, 20, 0, -1, a.ground);
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, 20, [{}, {}]);
    expect(v.action).toBe('grabbed');
    expect(v.pos.x - a.pos.x).toBeLessThan(12);
  });
});

describe('Fluffy: kill percents on Mario at the Battlefield ledge (roster targets)', () => {
  it.each([
    ['fsmash', 110],
    ['usmash', 120],
    ['bair', 150],
    ['bthrow', 150],
  ] as const)('%s kills near %i%%', (move, target) => {
    const p = killPercent(move, target);
    expect(p).toBeGreaterThanOrEqual(target - 8);
    expect(p).toBeLessThanOrEqual(target + 8);
  });
});

describe('Fluffy: Candy Frisbee (side special)', () => {
  /** Fluffy at x -40 facing right throws the candy; the Mario reference stands at x target (far away if omitted). */
  function throwCandy(target = 200) {
    const m = vsMario();
    const [a, v] = m.fighters as [FighterState, FighterState];
    place(a, -40, 0, 1, a.ground);
    if (target < 200) place(v, target, 0, -1, a.ground);
    else place(v, 70, 0, -1, a.ground);
    runPorts(m, 1, [{ x: 100, buttons: ['special'] }, {}]);
    expect(a.move).toBe('sideB');
    return { m, a, v };
  }

  it('flings the candy on frame 14; it flies out about 45 units, turns back and he catches it', () => {
    const { m, a } = throwCandy();
    runPorts(m, 12, [{}, {}]);
    expect(m.entities).toHaveLength(0);
    runPorts(m, 1, [{}, {}]);
    expect(a.actionFrame).toBe(14);
    expect(m.entities.map((e) => e.kind)).toEqual(['fluffy/candy']);
    let far = -Infinity;
    let caught = false;
    for (let i = 0; i < 120 && !caught; i++) {
      runPorts(m, 1, [{}, {}]);
      for (const e of m.entities) far = Math.max(far, e.pos.x);
      caught = m.events.some((e) => e.type === 'entityDestroy' && e.reason === 'script');
    }
    expect(caught).toBe(true);
    expect(far - a.pos.x).toBeGreaterThan(40);
    expect(far - a.pos.x).toBeLessThan(60);
  });

  it('hits for 7% on the way out and 5% on the way back', () => {
    const { m, v } = throwCandy(-15);
    let hits = 0;
    let last = 0;
    for (let i = 0; i < 120; i++) {
      runPorts(m, 1, [{}, {}]);
      if (v.damage > last) hits++;
      last = v.damage;
    }
    expect(hits).toBe(2);
    expect(v.damage).toBeCloseTo((7 + 5) * 1.05 * 1.2, 6);
  });

  it('only one candy flies at a time', () => {
    const { m } = throwCandy();
    runPorts(m, 50, [{}, {}]);
    expect(m.entities).toHaveLength(1);
    runPorts(m, 1, [{ x: 100, buttons: ['special'] }, {}]);
    runPorts(m, 14, [{}, {}]);
    expect(m.entities).toHaveLength(1);
  });
});
