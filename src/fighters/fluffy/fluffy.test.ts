import { describe, expect, it } from 'vitest';
import { activeHitboxes } from '../../sim/combat/hits';
import { HELPLESS_LANDING_LAG, TETHER } from '../../sim/constants';
import type { ButtonName } from '../../input/types';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { koPercent, type KoSetup } from '../../sim/testing/ko';
import { attack, run, runPorts, testMatch, type Hold } from '../../sim/testing/sim';
import { GRAPPLE_KICK, moves, SKY_ANCHORS } from './moves';
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
  // The kill moves deal their analogue's damage instead of the roster's: fsmash, bair and the four other aerials.
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
    ['nair', 5, 11],
    ['fair', 9, 8],
    ['bair', 9, 10.5],
    ['uair', 6, 6.5],
    ['dair', 12, 11],
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

  /**
   * Sourced kill percents for the other aerials: SSBU-Calculator's KO calculator (rubendal/SSBU-Calculator 233590e,
   * js/knockback.js Distance, run headless with ko.test.ts's setup: Mario airborne at Battlefield's ledge, x 79.9,
   * fresh, no rage, no DI) on the analogue's 13.0.1 hitbox from ultimate-hitboxes.com (RSN-Bran/ultimate-hitboxes
   * ead416b, server/data). SmashWiki's Jigglypuff (SSBU)/Neutral aerial and Min Min (SSBU)/Up aerial and /Down aerial
   * tables give the same values; its Min Min (SSBU)/Forward aerial page gives the Dragon arm KBG 87, not 90, which
   * KOs at 143.2. The down air's late hit is its own box; koPercent on the move counts the meteor, below.
   */
  it.each([
    {
      move: 'nair',
      hit: { fighter: 'fluffy', move: 'nair' },
      analogue: "Jigglypuff's clean nair", // 11%, 361°, BKB 30, KBG 100
      sourced: 108.8,
    },
    {
      move: 'fair',
      hit: { fighter: 'fluffy', move: 'fair' },
      analogue: "Min Min's Dragon fair", // 8%, 361°, BKB 50, KBG 90
      sourced: 137.3,
    },
    {
      move: 'uair',
      hit: { fighter: 'fluffy', move: 'uair' },
      analogue: "Min Min's 6.5% uair box", // 6.5%, 70°, BKB 40, KBG 130
      sourced: 173.8,
    },
    {
      move: 'dair late hit',
      hit: moves.dair!.hits[1]!.boxes[0]!,
      analogue: "Min Min's late dair", // 9%, 55°, BKB 80, KBG 60
      sourced: 195.3,
    },
  ] satisfies { move: string; hit: KoSetup['hit']; analogue: string; sourced: number }[])(
    '$move KOs within 5 points of $analogue at $sourced%',
    ({ hit, sourced }) => {
      const percent = koPercent({ hit, air: true });
      expect(percent).not.toBeNull();
      expect(Math.abs(percent! - sourced)).toBeLessThanOrEqual(5);
    },
  );

  /**
   * The down air's meteor, on Mario airborne 10 units past the ledge, where a downward hit can KO. The calculator
   * puts Min Min's meteor (11%, 285°, BKB 30, KBG 90) at 54.6% there, but under balloon speed-up its KO check reads
   * a launch speed from earlier in the launch, which KOs meteors 6 to 8 points early (#263). So the meteor is held to
   * Min Min's hit through koPercent from the same setup instead.
   */
  it("dair's meteor KOs within 5 points of Min Min's meteor 10 units past the ledge", () => {
    const setup = { air: true, from: { x: 90, y: 0 } };
    const minMin = koPercent({ hit: { damage: 11, angle: 285, kbg: 90, bkb: 30 }, ...setup })!;
    expect(Math.abs(ko('dair', setup) - minMin)).toBeLessThanOrEqual(5);
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

  it('with nothing in range it anchors in the sky, spending one of the sky anchors Point Grapple also uses', () => {
    const { f, events, actions, step, fire } = grapple(150, -20, -1);
    f.skyAnchorsUsed = 1;
    fire();
    step(18);
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherLatch']);
    expect(events[1]).toMatchObject({ kind: 'sky', x: 150 });
    expect([f.action, f.skyAnchorsUsed]).toEqual(['tetherPull', 2]);
    for (let i = 0; i < 60 && f.action === 'tetherPull'; i++) step(1);
    expect(actions).toEqual(['aerial', 'tetherPull', 'helpless']);
  });

  it('with no sky anchors left, a shot that finds nothing leaves Fluffy helpless, with no second up special', () => {
    const { f, events, step, fire } = grapple(150, -20, -1);
    f.skyAnchorsUsed = SKY_ANCHORS;
    fire();
    step(moves.upB!.faf - 1);
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherRelease']);
    expect([f.action, f.tether]).toEqual(['helpless', null]);
    expect(f.landingLag).toBe(HELPLESS_LANDING_LAG);
    step(1, { y: 100, buttons: ['special'] });
    step(5);
    expect([f.action, f.move]).toEqual(['helpless', null]);
  });

  it('touching down before the move ends still costs the helpless landing lag', () => {
    const { f, step, fire } = grapple(-64, 3, 1);
    f.skyAnchorsUsed = SKY_ANCHORS;
    fire();
    let frame = 0;
    for (let i = 0; i < moves.upB!.faf && f.ground === null; i++) {
      frame = f.actionFrame;
      step(1);
    }
    expect(f.ground).not.toBeNull();
    expect(frame).toBeLessThan(moves.upB!.faf);
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(HELPLESS_LANDING_LAG);
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

describe('Fluffy: Point Grapple (neutral special)', () => {
  const HAND = stats.height * TETHER.handHeight;

  /**
   * Fluffy (P1) at (x, y), airborne unless y is 0, alone or against the Mario reference (P2), with steppers that
   * hold P2's input and collect the tether, hit and shield events and the actions Fluffy goes through.
   */
  function grapple(x: number, y: number, facing: 1 | -1, m = testMatch({ fighter: 'fluffy' })) {
    const f = m.fighters[0]!;
    const floor = f.ground;
    const events: SimEvent[] = [];
    const actions: string[] = [];
    let other: Hold = {};
    /** Put Fluffy at rest at (px, py); his sky anchors carry over. */
    const put = (px: number, py: number) => {
      place(f, px, py, facing, py === 0 ? floor : null);
      Object.assign(f, { jumpsUsed: py === 0 ? 0 : 1, tether: null, aim: null, move: null });
      actions.length = 0;
      events.length = 0;
    };
    const step = (frames: number, hold: Hold = {}) => {
      for (let i = 0; i < frames; i++) {
        runPorts(m, 1, [hold, other]);
        events.push(...m.events.filter((e) => /^(tether|hit|shieldHit|parry|ko)/.test(e.type)));
        if (f.action !== actions.at(-1)) actions.push(f.action);
      }
    };
    /** Neutral special, as a player inputs it: the press, with the stick still neutral. */
    const press = () => {
      step(1, { buttons: ['special'] });
      expect(f.move).toBe('neutralB');
    };
    /** A quick tap: special pressed, the stick pushed (sx, sy) while it is held, and released 3 frames in. */
    const tap = (sx: number, sy: number) => {
      press();
      step(2, { x: sx, y: sy, buttons: ['special'] });
      step(1, { x: sx, y: sy });
    };
    /** The kinds of tether latch over the next `frames` frames. */
    const latches = (frames: number) => {
      const from = events.length;
      step(frames);
      return events.slice(from).flatMap((e) => (e.type === 'tetherLatch' ? [e.kind] : []));
    };
    const hold = (h: Hold) => (other = h);
    put(x, y);
    return { m, f, events, actions, put, step, press, tap, latches, hold };
  }

  /** Fluffy at (x, 0) facing right and the Mario reference standing at (mx, 0) facing him. */
  function vsMarioAt(x: number, mx: number) {
    const s = grapple(x, 0, 1, vsMario());
    const v = s.m.fighters[1]!;
    place(v, mx, 0, -1, s.m.fighters[0]!.ground);
    return { ...s, v };
  }

  it('walks the reticle 6 units a frame with the stick up to 160 while the move waits on frame 11, and turns to it', () => {
    const { f, events, step, press } = grapple(-40, 0, 1);
    press();
    step(10, { x: -100, buttons: ['special'] });
    expect(f.aim).toEqual({ x: -60, y: 0 });
    expect([f.actionFrame, f.facing, f.tether]).toEqual([11, -1, null]);
    step(30, { x: -100, buttons: ['special'] });
    expect(f.aim).toEqual({ x: -160, y: 0 });
    expect([f.actionFrame, events]).toEqual([11, []]);
  });

  it('releasing special fires the grabber at the reticle on frame 12, and the line reaches it 12 frames later', () => {
    const { f, events, step, press } = grapple(-40, 0, 1);
    press();
    step(30, { x: -100, buttons: ['special'] });
    step(1);
    expect(f.actionFrame).toBe(12);
    expect(events).toEqual([{ type: 'tetherFire', port: 0, x: -200, y: HAND }]);
    step(10);
    expect([f.action, f.tether?.kind]).toEqual(['attack', 'out']);
    step(1);
    expect(events[1]).toEqual({ type: 'tetherLatch', port: 0, kind: 'sky', x: -200, y: HAND });
    expect([f.action, f.tether?.moveFrame]).toEqual(['tetherPull', 23]);
  });

  it('a quick tap with a direction fires the full 160 that way', () => {
    const { f, events, step, tap } = grapple(-40, 0, 1);
    tap(100, 100);
    step(8);
    expect(f.actionFrame).toBe(12);
    const d = 160 * Math.SQRT1_2;
    expect(events[0]).toMatchObject({ type: 'tetherFire' });
    const shot = events[0] as Extract<SimEvent, { type: 'tetherFire' }>;
    expect(shot.x).toBeCloseTo(-40 + d, 9);
    expect(shot.y).toBeCloseTo(HAND + d, 9);
  });

  it('latches the ledge from below and reels him into a ledge grab, which gives back his sky anchors', () => {
    const { f, events, actions, step, tap } = grapple(104, -30, -1);
    f.skyAnchorsUsed = SKY_ANCHORS;
    tap(-100, 100);
    for (let i = 0; i < 60 && f.action !== 'ledgeCatch'; i++) step(1);
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherLatch', 'tetherRelease']);
    expect(events[1]).toEqual({ type: 'tetherLatch', port: 0, kind: 'ledge', x: 80, y: 0 });
    expect(actions).toEqual(['aerial', 'tetherPull', 'ledgeCatch']);
    expect([f.ledge, f.skyAnchorsUsed]).toEqual([1, 0]);
  });

  it('latches the platform above and reels him up to it, then falls (not helpless) or hangs while Jump is held', () => {
    const shoot = (jump: boolean) => {
      const s = grapple(-40, 0, 1);
      s.f.skyAnchorsUsed = SKY_ANCHORS;
      // Jump goes down while he aims, as a fresh press during the reel would let go instead.
      const held: ButtonName[] = jump ? ['jump'] : [];
      s.press();
      s.step(6, { y: 100, buttons: ['special', ...held] });
      for (let i = 0; i < 60 && s.f.action !== 'fall' && s.f.action !== 'tetherHang'; i++)
        s.step(1, { buttons: held });
      const latch = s.events[1] as Extract<SimEvent, { type: 'tetherLatch' }>;
      expect([latch.type, latch.kind, latch.x]).toEqual(['tetherLatch', 'surface', -40]);
      expect(latch.y).toBeCloseTo(24.12, 9);
      expect(s.f.skyAnchorsUsed).toBe(0);
      return s;
    };
    const fall = shoot(false);
    expect(fall.actions).toEqual(['attack', 'tetherPull', 'fall']);
    expect(fall.f.pos.y).toBeCloseTo(24.12 - HAND, 9);
    const hang = shoot(true);
    expect(hang.actions).toEqual(['attack', 'tetherPull', 'tetherHang']);
    hang.step(30, { buttons: ['jump'] });
    expect(hang.f.action).toBe('tetherHang');
    hang.step(1);
    expect(hang.f.action).toBe('fall');
  });

  it('anchors to empty air and reels him in at 4 units a frame, three times an airtime; the fourth shot whiffs', () => {
    const { f, events, actions, put, step, tap, latches } = grapple(-100, 80, 1);
    for (let i = 1; i <= SKY_ANCHORS; i++) {
      put(-100, 80);
      tap(100, 0);
      expect(latches(30)).toEqual(['sky']);
      expect([f.action, f.skyAnchorsUsed]).toEqual(['tetherPull', i]);
      const at = { ...f.pos };
      step(1);
      expect(Math.hypot(f.pos.x - at.x, f.pos.y - at.y)).toBeCloseTo(4, 9);
    }
    put(-100, 80);
    tap(100, 0);
    expect(latches(moves.neutralB!.faf)).toEqual([]);
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherRelease']);
    expect(actions).toEqual(['aerial', 'fall']);
  });

  it('landing gives the sky anchors back', () => {
    const { f, put, step, tap, latches } = grapple(-40, 5, 1);
    f.skyAnchorsUsed = SKY_ANCHORS;
    for (let i = 0; i < 60 && !f.ground; i++) step(1);
    expect([f.ground, f.skyAnchorsUsed]).toEqual([expect.anything(), 0]);
    put(-100, 80);
    tap(100, 0);
    expect(latches(30)).toEqual(['sky']);
  });

  it('with the sky anchors spent, Quick Grapple finds nothing either and leaves him helpless', () => {
    const { f, events, put, step, tap, latches } = grapple(-100, 80, 1);
    for (let i = 0; i < SKY_ANCHORS; i++) {
      put(-100, 80);
      tap(100, 0);
      expect(latches(30)).toEqual(['sky']);
    }
    put(150, 0 - 20);
    step(1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    step(moves.upB!.faf);
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherRelease']);
    expect(f.action).toBe('helpless');
  });

  it('the line stops at a fighter, and he flies into them for 10% on arrival', () => {
    const { f, v, events, actions, step, tap } = vsMarioAt(-30, 30);
    tap(100, 0);
    for (let i = 0; i < 60 && f.action !== 'tetherPull'; i++) step(1);
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherFighterHit']);
    expect(f.tether).toMatchObject({ kind: 'fighter', port: 1 });
    expect(v.damage).toBe(0);
    for (let i = 0; i < 60 && f.action === 'tetherPull'; i++) step(1);
    expect(events.map((e) => e.type)).toEqual(['tetherFire', 'tetherFighterHit', 'hit', 'tetherRelease']);
    expect(events[2]).toMatchObject({ attacker: 0, victim: 1, move: 'neutralB' });
    // Fresh (x1.05), and the meter takes x1.2 in 1v1.
    expect(v.damage).toBeCloseTo(10 * 1.05 * 1.2, 9);
    expect(actions).toEqual(['attack', 'tetherPull', 'fall']);
    for (let i = 0; i < 30 && v.hitlag > 0; i++) step(1);
    step(1);
    // Launched away from him at 55 degrees, lifted a little by the tumble gravity bonus (Mario's 55.7).
    const launched = (Math.atan2(v.kb.y, v.kb.x) * 180) / Math.PI;
    expect(Math.abs(launched - GRAPPLE_KICK.angle)).toBeLessThan(1);
  });

  it('a shield blocks the fly-in: shieldstun and shield damage, no % and no launch', () => {
    const { f, v, events, step, tap, hold } = vsMarioAt(-30, 30);
    hold({ buttons: ['shield'] });
    step(5);
    expect(v.action).toBe('shield');
    const shield = v.shieldHp;
    tap(100, 0);
    for (let i = 0; i < 60 && !events.some((e) => e.type === 'shieldHit'); i++) step(1);
    expect(events.map((e) => e.type)).toEqual([
      'tetherFire',
      'tetherFighterHit',
      'shieldHit',
      'tetherRelease',
    ]);
    expect(events[2]).toMatchObject({ attacker: 0, victim: 1, move: 'neutralB', damage: 10 * 1.05 });
    expect([v.action, v.damage, f.action]).toEqual(['shieldStun', 0, 'fall']);
    expect(v.shieldHp).toBeLessThan(shield - 10);
  });

  it("the fly-in has Corrin's Dragon Lunge kick knockback (55 degrees, 98 growth, 70 base) at the roster's 10%", () => {
    expect(GRAPPLE_KICK).toMatchObject({ damage: 10, angle: 55, kbg: 98, bkb: 70, direction: 'away' });
  });

  it('the fly-in kills Mario at the ledge between forward smash and down smash', () => {
    const { damage, angle, kbg, bkb } = GRAPPLE_KICK;
    const kick = koPercent({ hit: { damage, angle, kbg, bkb } })!;
    expect(kick).toBeGreaterThan(koPercent({ hit: { fighter: 'fluffy', move: 'fsmash' } })!);
    expect(kick).toBeLessThan(koPercent({ hit: { fighter: 'fluffy', move: 'dsmash' } })!);
  });

  it('a real fly-in kills where koPercent says: from 2% over its threshold, and not from 2% under', () => {
    const { damage, angle, kbg, bkb } = GRAPPLE_KICK;
    const threshold = koPercent({ hit: { damage, angle, kbg, bkb }, from: { x: 70, y: 0 } })!;
    /** Does the real Point Grapple, flying in from 60 units away, KO Mario before his hitstun runs out? */
    const kos = (percent: number) => {
      const { v, events, step, tap } = vsMarioAt(10, 70);
      v.damage = percent;
      tap(100, 0);
      for (let i = 0; i < 60 && !events.some((e) => e.type === 'hit'); i++) step(1);
      expect(events.some((e) => e.type === 'hit')).toBe(true);
      for (let i = 0; i < 600; i++) {
        if (v.action === 'ko') return true;
        if (v.hitlag <= 0 && v.launch === null && v.hitstun <= 0) return false;
        step(1);
      }
      return false;
    };
    expect(kos(threshold + 2)).toBe(true);
    expect(kos(threshold - 2)).toBe(false);
  });
});
