import { describe, expect, it } from 'vitest';
import { DAMAGE_MAX } from './combat/hits';
import type { SimEvent } from './events';
import type { FighterState } from './fighter';
import type { MatchState } from './match';
import { marioReference as mario } from './testing/reference';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from './testing/sim';

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
