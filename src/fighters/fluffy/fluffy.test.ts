import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import { HELPLESS_LANDING_LAG, TETHER } from '../../sim/constants';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { koPercent, type KoSetup } from '../../sim/testing/ko';
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
    ['jab2', 3, 2],
    ['jab3', 5, 3],
    ['ftilt', 7, 8],
    ['utilt', 6, 6],
    ['dtilt', 6, 6],
    ['dashAttack', 8, 9],
    ['fsmash', 16, 16],
    ['usmash', 13, 14],
    ['dsmash', 10, 12],
    ['nair', 5, 8],
    ['fair', 9, 10],
    ['bair', 9, 10.5],
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
    expect(early!.boxes[0]!.angle).toBe(285);
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

describe('Fluffy: kill percents against his Ultimate analogues', () => {
  /** Where Fluffy's move KOs the Mario reference at Battlefield's ledge: fresh, no rage, no DI. */
  const ko = (move: string, setup: Partial<KoSetup> = {}) =>
    koPercent({ hit: { fighter: 'fluffy', move }, ...setup })!;

  /** Each kill move lands within 5 points of its analogue's own hit from the same setup, named in the row. */
  it.each([
    ['fsmash', "Min Min's Dragon fsmash, far hit", { damage: 16, angle: 361, kbg: 78, bkb: 40 }, {}],
    ['usmash', "Min Min's usmash", { damage: 14, angle: 75, kbg: 80, bkb: 48 }, {}],
    ['dsmash', "Min Min's dsmash, front hit", { damage: 13, angle: 361, kbg: 72, bkb: 50 }, {}],
    ['bair', "Mario's bair", { damage: 10.5, angle: 361, kbg: 106, bkb: 12 }, { air: true }],
    ['bthrow', "Mario's bthrow", { damage: 11, angle: 45, kbg: 66, bkb: 70 }, {}],
  ] as const)('%s kills within 5 points of %s', (move, _analogue, hit, setup) => {
    expect(Math.abs(ko(move, setup) - koPercent({ hit, ...setup })!)).toBeLessThanOrEqual(5);
  });

  it('forward smash kills earliest, then down smash, back air, back throw and up smash', () => {
    const order = [ko('fsmash'), ko('dsmash'), ko('bair', { air: true }), ko('bthrow'), ko('usmash')];
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(new Set(order).size).toBe(order.length);
  });
});

describe('Fluffy: jab (Fuzz Bump, Fuzz Bump, Tail Slap)', () => {
  /** The moves a Fluffy plays when Attack is pressed every pressEvery frames for frames frames. */
  function jabs(pressEvery: number, frames = 90): string[] {
    const m = testMatch({ fighter: 'fluffy' });
    const f = m.fighters[0]!;
    const seen: string[] = [];
    for (let i = 0; i < frames; i++) {
      run(m, 1, i % pressEvery === 0 ? { buttons: ['attack'] } : {});
      if (f.move && f.move !== seen[seen.length - 1]) seen.push(f.move);
    }
    return seen;
  }

  it('Attack again inside each window chains jab -> jab2 -> jab3 for 2%, 2% and 3%', () => {
    expect(jabs(8, 40)).toEqual(['jab', 'jab2', 'jab3']);
    expect([damage('jab'), damage('jab2'), damage('jab3')]).toEqual([2, 2, 3]);
  });

  it('a single press is one Fuzz Bump that ends on frame 20', () => {
    expect(jabs(1000)).toEqual(['jab']);
    expect(moves.jab!.faf).toBe(20);
  });
});

describe('Fluffy: Stick Tight (down special)', () => {
  /** Fluffy in Stick Tight at 100%, hit by Fireboy's forward smash when Fluffy is on frame at of the move. */
  function smashed(at: number) {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'fluffy' }, { fighter: 'fireboy' }],
    });
    runPorts(m, 10, [{}, {}]);
    const [f, b] = m.fighters as [FighterState, FighterState];
    place(f, 0, 0, -1, f.ground);
    place(b, -12, 0, 1, f.ground);
    f.damage = 100;
    runPorts(m, 1, [{ y: -100, buttons: ['special'] }, {}]);
    expect(f.move).toBe('downB');
    runPorts(m, at - 15, [{}, {}]);
    attack(m, 1, 'fsmash');
    runPorts(m, 15, [{}, {}]);
    expect(f.damage).toBeGreaterThan(100);
    return f;
  }

  it('takes the damage but no knockback on frames 4-60 and keeps holding on', () => {
    const f = smashed(30);
    expect(f.launch).toBeNull();
    expect([f.action, f.move]).toEqual(['attack', 'downB']);
    expect(f.pos.x).toBeCloseTo(0, 6);
  });

  it('is launched as usual once the armor ends', () => {
    expect(smashed(62).action).toBe('tumble');
  });

  it('comes out on frame 4 and leaves 40 frames of end lag', () => {
    expect(moves.downB!.armor!.frames).toEqual([4, 60]);
    expect(moves.downB!.faf).toBe(61 + 40);
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

  it('turns toward Fluffy after he crosses to the far side of its path', () => {
    const { m, a } = throwCandy();
    run(m, 48);
    expect(m.entities[0]!.vel.x).toBeLessThan(0);
    place(a, 34, 0, -1, a.ground);
    run(m, 1);
    expect(m.entities[0]!.vel.x).toBeGreaterThan(0);
    run(m, 45);
    expect(m.entities).toHaveLength(0);
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

describe('Fluffy: Quick Grapple (up special)', () => {
  /** Fluffy alone on Battlefield at (x, y), airborne unless y is 0, with a stepper that collects tether events. */
  function grapple(x: number, y: number, facing: 1 | -1) {
    const m = testMatch({ fighter: 'fluffy' });
    const f = m.fighters[0]!;
    place(f, x, y, facing, y === 0 ? f.ground : null);
    f.jumpsUsed = y === 0 ? 0 : 1;
    const events: SimEvent[] = [];
    const actions: string[] = [];
    const step = (frames: number, hold: Hold = {}) => {
      for (let i = 0; i < frames; i++) {
        run(m, 1, hold);
        events.push(...m.events.filter((e) => e.type.startsWith('tether')));
        if (f.action !== actions.at(-1)) actions.push(f.action);
      }
    };
    /** Up special from the stick and button, as a player inputs it. */
    const fire = () => {
      step(1, { y: 100, buttons: ['special'] });
      expect(f.move).toBe('upB');
    };
    return { m, f, events, actions, step, fire };
  }

  it('fires straight up on frame 8 at 120 units, and a grounded shot stays on the ground until then', () => {
    const { f, events, step, fire } = grapple(-40, 0, 1);
    fire();
    step(6);
    expect([f.action, f.ground, f.tether]).toEqual(['attack', expect.anything(), null]);
    step(1);
    expect(f.actionFrame).toBe(8);
    const hand = f.pos.y + stats.height * TETHER.handHeight;
    expect(events.map((e) => e.type)).toEqual(['tetherFire']);
    const shot = events[0] as Extract<SimEvent, { type: 'tetherFire' }>;
    expect(shot.x).toBeCloseTo(f.pos.x, 9);
    expect(shot.y).toBeCloseTo(hand + 120, 9);
  });

  it('recovers from 40 units below the ledge by latching it and reeling into a ledge grab', () => {
    const { f, events, actions, step, fire } = grapple(88, -40, -1);
    fire();
    for (let i = 0; i < 60 && f.action !== 'ledgeCatch'; i++) step(1);
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherLatch', 'tetherRelease']);
    expect(events[1]).toEqual({ type: 'tetherLatch', port: 0, kind: 'ledge', x: 80, y: 0 });
    expect(actions).toEqual(['aerial', 'tetherPull', 'ledgeCatch']);
    expect([f.ledge, f.facing, f.tether]).toEqual([1, -1, null]);
  });

  it('stops falling in the air while the grabber flies, up to frame 18', () => {
    const { f, step, fire } = grapple(150, -40, -1);
    f.vel.y = -stats.fallSpeed;
    fire();
    step(17);
    expect(f.pos.y).toBeGreaterThan(-42);
  });

  it('a shot that finds nothing in range leaves Fluffy helpless, with no second up special', () => {
    const { f, events, step, fire } = grapple(150, -20, -1);
    fire();
    step(moves.upB!.faf - 1);
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherRelease']);
    expect([f.action, f.tether]).toEqual(['helpless', null]);
    expect(f.landingLag).toBe(HELPLESS_LANDING_LAG);
    step(1, { y: 100, buttons: ['special'] });
    step(5);
    expect([f.action, f.move]).toEqual(['helpless', null]);
  });

  it('reels up to the platform above and lets go into helpless fall, or hangs there while Jump is held', () => {
    const fromGround = (hold: Hold) => {
      const s = grapple(0, 0, 1);
      s.fire();
      for (let i = 0; i < 60 && s.f.action !== 'helpless' && s.f.action !== 'tetherHang'; i++)
        s.step(1, hold);
      expect(s.events[1]).toMatchObject({ type: 'tetherLatch', kind: 'surface', y: 47.19 });
      return s;
    };
    expect(fromGround({}).actions).toEqual(['attack', 'tetherPull', 'helpless']);
    const hang = fromGround({ buttons: ['jump'] });
    hang.step(30, { buttons: ['jump'] });
    expect(hang.f.action).toBe('tetherHang');
    hang.step(1);
    expect(hang.f.action).toBe('helpless');
  });
});
