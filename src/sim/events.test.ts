import { describe, expect, it } from 'vitest';
import { registerFighter } from '../fighters/registry';
import { DAMAGE_MAX } from './combat/hits';
import { spawnEntity } from './entities/entities';
import type { SimEvent } from './events';
import type { FighterState } from './fighter';
import { createMatch, type MatchState } from './match';
import { lungeTester } from './testing/beast';
import { COUNTER_TEST_FIGHTERS, counterTesterMarth } from './testing/counter';
import { gadgets } from './testing/gadgets';
import { MOBILITY_TEST_FIGHTERS, testFloater, testHover } from './testing/mobility';
import { marioReference as mario } from './testing/reference';
import { tetherTester } from './testing/tethers';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from './testing/sim';

registerFighter(gadgets);
for (const def of COUNTER_TEST_FIGHTERS) registerFighter(def);

function of<T extends SimEvent['type']>(m: MatchState, type: T): Extract<SimEvent, { type: T }>[] {
  return m.events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}

/** Step until an event of `type` is emitted (holding `hold` on port 0) and return it. */
function next<T extends SimEvent['type']>(
  m: MatchState,
  type: T,
  hold: Hold = {},
): Extract<SimEvent, { type: T }> {
  until(m, () => of(m, type).length > 0, hold);
  return of(m, type)[0]!;
}

/** Two reference fighters on the main stage, P1 at -10 facing P2 at -2. */
function duel(): { m: MatchState; a: FighterState; v: FighterState } {
  const m = testMatch({ players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  for (const [f, x, facing] of [
    [a, -10, 1],
    [v, -2, -1],
  ] as const) {
    Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, facing, action: 'idle' });
  }
  return { m, a, v };
}

describe('sim events', () => {
  it('a hit reports the % it added, its knockback and hitlag, and where it landed', () => {
    const { m, a, v } = duel();
    v.damage = 60;
    attack(m, 0, 'probe');
    run(m, 1);
    const [hit] = of(m, 'hit');
    expect(hit).toMatchObject({ attacker: 0, victim: 1, move: 'probe', effect: 'normal', tumble: true });
    expect(hit!.damage).toBeCloseTo(v.damage - 60, 9);
    expect(hit!.hitlag).toBe(a.hitlag);
    expect(hit!.kb).toBeGreaterThan(80);
    expect(hit!.x).toBeCloseTo(a.pos.x + 8, 9);
    expect(hit!.y).toBeCloseTo(a.pos.y + 8, 9);
    run(m, 1);
    expect(of(m, 'hit')).toEqual([]);
  });

  it('trading hits report both moves', () => {
    const { m, a, v } = duel();
    Object.assign(a, { pos: { x: -6, y: 0 }, prevPos: { x: -6, y: 0 } });
    Object.assign(v, { pos: { x: 6, y: 0 }, prevPos: { x: 6, y: 0 } });
    attack(m, 0, 'probe');
    attack(m, 1, 'probe');
    run(m, 1);
    expect(of(m, 'hit').map((e) => [e.attacker, e.victim, e.move])).toEqual([
      [0, 1, 'probe'],
      [1, 0, 'probe'],
    ]);
  });

  it('at the damage cap a hit reports only the % it added', () => {
    const { m, v } = duel();
    v.damage = 998.5;
    attack(m, 0, 'probe');
    run(m, 1);
    expect(v.damage).toBe(DAMAGE_MAX);
    expect(of(m, 'hit')[0]!.damage).toBeCloseTo(0.5, 9);
  });

  it('a shielded hit reports the shield health left', () => {
    const { m, v } = duel();
    runPorts(m, 5, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shield');
    attack(m, 0, 'probe');
    runPorts(m, 1, [{}, { buttons: ['shield'] }]);
    const [e] = of(m, 'shieldHit');
    expect(e).toMatchObject({ attacker: 0, victim: 1, move: 'probe', shieldHp: v.shieldHp });
    expect(of(m, 'hit')).toEqual([]);
  });

  it('a hit on the first frame of a shield drop reports a parry, not a shield hit', () => {
    const { m, v } = duel();
    runPorts(m, 5, [{}, { buttons: ['shield'] }]);
    attack(m, 0, 'probe');
    runPorts(m, 1, [{}, {}]);
    expect(of(m, 'parry')).toMatchObject([{ attacker: 0, victim: 1, move: 'probe', y: 8 }]);
    expect(of(m, 'shieldHit')).toEqual([]);
    expect(of(m, 'hit')).toEqual([]);
    expect(v.action).toBe('idle');
  });

  it('jumps report full hops, short hops and air jumps', () => {
    const m = testMatch();
    expect(next(m, 'jump', { buttons: ['jump'] }).kind).toBe('full');
    until(m, (f) => f.ground !== null);
    run(m, 5);
    run(m, 1, { buttons: ['jump'] });
    expect(next(m, 'jump').kind).toBe('short');
    run(m, 2);
    run(m, 1, { buttons: ['jump'] });
    expect(of(m, 'jump')).toEqual([{ type: 'jump', port: 0, kind: 'air' }]);
  });

  it('landing reports its landing lag', () => {
    const m = testMatch();
    placeInAir(m, -70, 20);
    const e = next(m, 'land');
    expect(e).toEqual({ type: 'land', port: 0, lag: m.fighters[0]!.landingLag });
    expect(e.lag).toBe(mario.stats.hardLandingLag);
  });

  it('starting a move reports it', () => {
    const m = testMatch({ fighter: 'fireboy' });
    run(m, 1, { buttons: ['attack'] });
    expect(of(m, 'move')).toEqual([{ type: 'move', port: 0, move: 'jab' }]);
  });

  it('a KO reports the blast zone side and the stocks left, then the respawn follows', () => {
    const m = testMatch();
    const f = placeInAir(m, 238, 50);
    f.vel.x = 5;
    const ko = next(m, 'ko');
    expect(ko).toMatchObject({ port: 0, side: 'right', stocks: 2 });
    expect(next(m, 'respawn')).toEqual({ type: 'respawn', port: 0 });
  });

  it('a shield break reports it', () => {
    const { m, v } = duel();
    runPorts(m, 5, [{}, { buttons: ['shield'] }]);
    v.shieldHp = 0.5;
    attack(m, 0, 'probe');
    for (let i = 0; i < 40 && of(m, 'shieldBreak').length === 0; i++)
      runPorts(m, 1, [{}, { buttons: ['shield'] }]);
    expect(of(m, 'shieldBreak')).toEqual([{ type: 'shieldBreak', port: 1 }]);
  });

  it('every action change is reported once, after the frame, with where it came from', () => {
    const m = testMatch();
    run(m, 1, { buttons: ['shield'] });
    expect(of(m, 'action')).toEqual([{ type: 'action', port: 0, from: 'idle', to: 'shield' }]);
    run(m, 1, { buttons: ['shield'] });
    expect(of(m, 'action')).toEqual([]);
  });

  it('grabs report the catch, pummels, the throw before its hit, releases and clanks', () => {
    const grabbed = () => {
      const m = testMatch({ fighter: 'fireboy', players: 2 });
      const [a, v] = m.fighters as [FighterState, FighterState];
      const at = { x: a.pos.x + 12 * a.facing, y: a.pos.y };
      Object.assign(v, {
        pos: { ...at },
        prevPos: { ...at },
        ground: a.ground,
        action: 'idle',
        intangible: 0,
      });
      runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
      for (let i = 0; i < 6 && of(m, 'grab').length === 0; i++) runPorts(m, 1, [{}, {}]);
      expect(of(m, 'grab')).toEqual([{ type: 'grab', attacker: 0, victim: 1, move: 'grab' }]);
      return { m, a, v };
    };
    const { m, a, v } = grabbed();
    const before = v.damage;
    runPorts(m, 1, [{ buttons: ['attack'] }, {}]);
    expect(of(m, 'pummel')).toEqual([{ type: 'pummel', attacker: 0, victim: 1, damage: v.damage - before }]);
    runPorts(m, 30, [{}, {}]);
    runPorts(m, 1, [{ x: 100 * a.facing }, {}]);
    for (let i = 0; i < 30 && of(m, 'throw').length === 0; i++) runPorts(m, 1, [{}, {}]);
    expect(m.events.filter((e) => e.type === 'throw' || e.type === 'hit').map((e) => e.type)).toEqual([
      'throw',
      'hit',
    ]);
    expect(of(m, 'throw')[0]).toEqual({ type: 'throw', attacker: 0, victim: 1, move: 'fthrow' });

    const held = grabbed();
    for (let i = 0; i < 120 && of(held.m, 'grabRelease').length === 0; i++) runPorts(held.m, 1, [{}, {}]);
    expect(of(held.m, 'grabRelease')).toEqual([{ type: 'grabRelease', holder: 0, held: 1 }]);

    const clank = testMatch({ fighter: 'fireboy', players: 2 });
    const [p1, p2] = clank.fighters as [FighterState, FighterState];
    const at = { x: p1.pos.x + 12 * p1.facing, y: p1.pos.y };
    Object.assign(p2, {
      pos: { ...at },
      prevPos: { ...at },
      ground: p1.ground,
      action: 'idle',
      facing: -p1.facing,
    });
    runPorts(clank, 1, [{ buttons: ['grab'] }, { buttons: ['grab'] }]);
    for (let i = 0; i < 6 && of(clank, 'grabClank').length === 0; i++) runPorts(clank, 1, [{}, {}]);
    expect(of(clank, 'grabClank')).toEqual([{ type: 'grabClank', ports: [0, 1] }]);
  });

  it('a scheduled stage piece reports vanishing and coming back (testbed)', () => {
    const m = testMatch({ stage: 'testbed' });
    const pieces: SimEvent[] = [];
    while (m.frame < 320) {
      run(m, 1);
      pieces.push(...of(m, 'stagePiece').map((e) => ({ ...e, frame: m.frame })));
    }
    expect(pieces).toEqual([
      { type: 'stagePiece', piece: 'platform', index: 1, on: false, frame: 200 },
      { type: 'stagePiece', piece: 'platform', index: 1, on: true, frame: 300 },
    ]);
  });

  it('a fighter squeezed by a moving solid reports where it popped out (testbed crusher)', () => {
    const m = testMatch({ stage: 'testbed', x: -50 });
    const e = next(m, 'squeeze');
    expect(e).toMatchObject({ port: 0, solid: 2, x: -50 });
    expect(e.y).toBeCloseTo(m.fighters[0]!.pos.y, 9);
  });

  it('command grabs report the catch, each chew as a pummel, then the throw and its hit', () => {
    const m = testMatch({ fighter: lungeTester.id, players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    const at = { x: a.pos.x + 14 * a.facing, y: a.pos.y };
    Object.assign(v, { pos: { ...at }, prevPos: { ...at }, ground: a.ground, action: 'idle', intangible: 0 });
    runPorts(m, 1, [{ x: 100 * a.facing, buttons: ['special'] }, {}]);
    const seen: SimEvent[] = [];
    for (let i = 0; i < 120 && !seen.some((e) => e.type === 'hit'); i++) {
      runPorts(m, 1, [{}, {}]);
      seen.push(
        ...m.events.filter((e) => ['commandGrab', 'grab', 'move', 'pummel', 'throw', 'hit'].includes(e.type)),
      );
    }
    expect(seen.map((e) => e.type)).toEqual(['commandGrab', 'pummel', 'pummel', 'throw', 'hit']);
    expect(seen[0]).toEqual({ type: 'commandGrab', attacker: 0, victim: 1, move: 'sideB' });
    expect(seen[3]).toEqual({ type: 'throw', attacker: 0, victim: 1, move: 'beastChew' });
  });

  it('a counter reports the catch and what the caught hit would have dealt, then its counterattack and hit', () => {
    const { m, v } = duel();
    v.fighter = counterTesterMarth.id;
    attack(m, 1, 'downB');
    runPorts(m, 9, [{}, {}]);
    attack(m, 0, 'probe');
    const seen: SimEvent[] = [];
    for (let i = 0; i < 40 && !seen.some((e) => e.type === 'hit'); i++) {
      runPorts(m, 1, [{}, {}]);
      seen.push(...m.events.filter((e) => ['counter', 'move', 'hit'].includes(e.type)));
    }
    expect(seen.map((e) => e.type)).toEqual(['counter', 'move', 'hit']);
    expect(seen[0]).toEqual({
      type: 'counter',
      port: 1,
      attacker: 0,
      move: 'downBHit',
      damage: 12 * 1.05,
      x: -2,
      y: 8,
    });
    expect(seen[1]).toEqual({ type: 'move', port: 1, move: 'downBHit' });
    expect(seen[2]).toMatchObject({ type: 'hit', attacker: 1, victim: 0, move: 'downBHit' });
  });

  it('tethers report the fire, the latch with what it anchored to, then the release', () => {
    const m = testMatch({ fighter: tetherTester.id, x: -70 });
    attack(m, 0, 'upB');
    const seen: SimEvent[] = [];
    for (let i = 0; i < 80 && !seen.some((e) => e.type === 'tetherRelease'); i++) {
      run(m, 1);
      seen.push(...m.events.filter((e) => e.type.startsWith('tether')));
    }
    expect(seen.map((e) => e.type)).toEqual(['tetherFire', 'tetherLatch', 'tetherRelease']);
    expect(seen[1]).toMatchObject({ type: 'tetherLatch', port: 0, kind: 'sky' });
    expect(seen[2]).toEqual({ type: 'tetherRelease', port: 0 });
  });

  it('a stage hazard hit reports the hazard, its element and the % it added (hazard testbed lava)', () => {
    const m = testMatch({ stage: 'hazard-testbed', x: -48 });
    const e = next(m, 'stageHit');
    expect(e).toMatchObject({ victim: 0, source: 'zone', index: 1, element: 'lava', damage: 12, x: -48 });
    expect(e.kb).toBeGreaterThan(80);
    expect(m.fighters[0]!.damage).toBe(24);
  });

  it('the event stream is deterministic', () => {
    const stream = () => {
      const { m } = duel();
      const all: SimEvent[] = [];
      for (let i = 0; i < 200; i++) {
        runPorts(m, 1, [{ x: i % 40 < 20 ? 100 : -100, buttons: i % 13 === 0 ? ['attack'] : [] }, {}]);
        all.push(...m.events);
      }
      return all;
    };
    const first = stream();
    expect(first.length).toBeGreaterThan(10);
    expect(stream()).toEqual(first);
  });
});

describe('air mobility events', () => {
  for (const def of MOBILITY_TEST_FIGHTERS) registerFighter(def);

  it('a float reports its start, nothing while an aerial carries it on, and its end', () => {
    const m = testMatch({ fighter: testFloater.id });
    const float = () => of(m, 'float').map((e) => e.phase);
    const jump: Hold = { buttons: ['jump'] };
    expect(next(m, 'float', jump).phase).toBe('start');
    run(m, 1, { buttons: ['jump', 'attack'] });
    expect(m.fighters[0]!.action).toBe('aerial');
    expect(float()).toEqual([]);
    until(m, () => float().length > 0, jump);
    expect(float()).toEqual(['end']);
    expect(m.fighters[0]!.mobility.floatFrames).toBe(testFloater.float.frames);
  });

  it('a fast fall out of a float reports one end', () => {
    const m = testMatch({ fighter: testFloater.id });
    const ends = () => of(m, 'float').filter((e) => e.phase === 'end').length;
    next(m, 'float', { buttons: ['jump'] });
    let count = 0;
    run(m, 1, { y: -100, buttons: ['jump'] });
    count += ends();
    for (let i = 0; i < 5; i++) {
      run(m, 1, { y: -100, buttons: ['jump'] });
      count += ends();
    }
    expect(m.fighters[0]!.action).toBe('fall');
    expect(count).toBe(1);
  });

  it('a float pushed onto the ground reports its end', () => {
    const m = testMatch({ fighter: testFloater.id });
    const f = placeInAir(m, 0, 1);
    f.jumpsUsed = testFloater.stats.jumps;
    run(m, 1, { buttons: ['jump'] });
    expect(f.action).toBe('float');
    expect(of(m, 'float')[0]?.phase).toBe('start');
    f.kb.y = -2;
    run(m, 1, { buttons: ['jump'] });
    expect(f.ground).not.toBeNull();
    expect(next(m, 'float', { buttons: ['jump'] }).phase).toBe('end');
    expect(f.mobility).toMatchObject({ floating: false, floatFrames: 0 });
  });

  it('a hover reports the frame its fuel runs out', () => {
    const m = testMatch({ fighter: testHover.id });
    const f = m.fighters[0]!;
    run(m, 1, { y: 50, buttons: ['special'] });
    next(m, 'fuelEmpty', { buttons: ['special'] });
    expect(f.mobility.hoverFuel).toBe(0);
    run(m, 5, { buttons: ['special'] });
    expect(of(m, 'fuelEmpty')).toEqual([]);
  });
});

describe('entity events', () => {
  /** Two `fighter`s standing on the main stage at x0 and x1, facing each other. */
  function pair(fighter: string, x0: number, x1: number): MatchState {
    const m = createMatch({ seed: 1, stage: 'battlefield', stocks: 3, ports: [{ fighter }, { fighter }] });
    m.fighters.forEach((f, i) => {
      const x = i === 0 ? x0 : x1;
      Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, facing: i === 0 ? 1 : -1, intangible: 0 });
    });
    runPorts(m, 20, [{}, {}]);
    return m;
  }

  it("a fireball reports its spawn, its hit with the entity's id, and being used up", () => {
    const m = pair('fireboy', -30, 0);
    runPorts(m, 1, [{ buttons: ['special'] }, {}]);
    for (let i = 0; i < 30 && of(m, 'entitySpawn').length === 0; i++) runPorts(m, 1, [{}, {}]);
    expect(of(m, 'entitySpawn')).toEqual([
      { type: 'entitySpawn', id: 1, kind: 'fireboy/fireball', owner: 0, x: -24, y: 8 },
    ]);
    for (let i = 0; i < 60 && of(m, 'hit').length === 0; i++) runPorts(m, 1, [{}, {}]);
    expect(of(m, 'hit')[0]).toMatchObject({
      attacker: 0,
      entity: 1,
      victim: 1,
      move: 'neutralB',
      effect: 'fire',
    });
    expect(of(m, 'entityDestroy')).toMatchObject([{ id: 1, kind: 'fireboy/fireball', reason: 'hit' }]);
    const types = m.events.map((e) => e.type);
    expect(types.indexOf('hit')).toBeLessThan(types.indexOf('entityDestroy'));
  });

  it('reflectors, absorbers and hits on hittable entities report who did it', () => {
    const reflect = pair('test-gadgets', -40, 0);
    attack(reflect, 1, 'reflect');
    spawnEntity(reflect, { kind: 'test-gadgets/bolt', owner: 0, pos: { x: -10, y: 8 }, vel: { x: 2, y: 0 } });
    for (let i = 0; i < 10 && of(reflect, 'reflect').length === 0; i++) runPorts(reflect, 1, [{}, {}]);
    expect(of(reflect, 'reflect')).toMatchObject([{ id: 1, kind: 'test-gadgets/bolt', port: 1 }]);

    const absorb = pair('test-gadgets', -40, 0);
    absorb.fighters[1]!.damage = 50;
    attack(absorb, 1, 'absorb');
    spawnEntity(absorb, { kind: 'test-gadgets/bolt', owner: 0, pos: { x: -14, y: 8 }, vel: { x: 2, y: 0 } });
    for (let i = 0; i < 10 && of(absorb, 'absorb').length === 0; i++) runPorts(absorb, 1, [{}, {}]);
    expect(of(absorb, 'absorb')).toMatchObject([{ id: 1, port: 1 }]);
    expect(of(absorb, 'absorb')[0]!.heal).toBeCloseTo(6 * 1.6, 9);
    expect(of(absorb, 'entityDestroy')).toMatchObject([{ id: 1, reason: 'absorbed' }]);

    const crate = pair('test-gadgets', -40, 60);
    const box = spawnEntity(crate, { kind: 'test-gadgets/crate', owner: 1, pos: { x: -32, y: 4 } });
    box.hp = 10;
    attack(crate, 0, 'strike');
    runPorts(crate, 1, [{}, {}]);
    expect(of(crate, 'entityHit')).toMatchObject([{ id: 1, attacker: 0, damage: 12, hp: -2 }]);
    expect(of(crate, 'entityDestroy')).toMatchObject([{ id: 1, reason: 'broken' }]);
  });
});
