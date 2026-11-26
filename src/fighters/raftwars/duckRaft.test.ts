import { describe, expect, it } from 'vitest';
import { hashState } from '../../engine/hash';
import type { InputFrame } from '../../input/types';
import { entityPlatform } from '../../sim/entities/entities';
import type { EntityState } from '../../sim/entities/types';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { meter } from '../../sim/meters';
import { playReplay } from '../../sim/replay';
import { attack, input, placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { DUCK_RAFT } from './duckRaft';

const RAFT = 'raftwars/duckRaft';
const DOWN_B: Hold = { y: -100, buttons: ['special'] };

const rafts = (m: MatchState) => m.entities.filter((e) => e.kind === RAFT);
const destroyed = (m: MatchState, e: EntityState) =>
  m.events.find((ev) => ev.type === 'entityDestroy' && ev.id === e.id);

/** The kids (port 0, x -40 facing right) against Fireboy (port 1, x 40) on Battlefield, settled. */
function duel(): MatchState {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'raftwars' }, { fighter: 'fireboy' }],
  });
  run(m, 10);
  return m;
}

/** Down special from where the kids stand; returns the raft once it is out (frame 4). */
function throwRaft(m: MatchState): EntityState {
  run(m, 1, DOWN_B);
  run(m, DUCK_RAFT.place - 1);
  return rafts(m).at(-1)!;
}

/** Puts Fireboy at (x, y), falling, facing `facing`. */
function placeFireboy(m: MatchState, x: number, y: number, facing: 1 | -1 = -1) {
  const v = m.fighters[1]!;
  Object.assign(v, { pos: { x, y }, prevPos: { x, y }, vel: { x: 0, y: 0 }, ground: null, action: 'fall' });
  Object.assign(v, { actionFrame: 1, facing, jumpsUsed: 1, intangible: 0 });
  return v;
}

describe('Raft Wars Kids: Duck Raft (down special)', () => {
  it('throws the raft on frame 4 and acts again on frame 16, as Create Block places a block', () => {
    const m = testMatch({ fighter: 'raftwars' });
    const f = m.fighters[0]!;
    run(m, 1, DOWN_B);
    expect(f.move).toBe('downB');
    run(m, DUCK_RAFT.place - 2);
    expect(rafts(m)).toHaveLength(0);
    run(m, 1);
    expect(f.actionFrame).toBe(DUCK_RAFT.place);
    const raft = rafts(m)[0]!;
    expect(raft.age).toBe(1);
    run(m, DUCK_RAFT.faf - 1 - DUCK_RAFT.place);
    expect([f.move, f.actionFrame]).toEqual(['downB', DUCK_RAFT.faf - 1]);
    run(m, 1);
    expect([f.action, f.move]).toEqual(['idle', null]);
  });

  it('sets it down 14.5 in front of them on the ground, its hull on the floor and its deck 3.5 up', () => {
    const m = testMatch({ fighter: 'raftwars' });
    const f = m.fighters[0]!;
    const raft = throwRaft(m);
    expect(raft.pos).toEqual({ x: f.pos.x + 14.5 * f.facing, y: f.pos.y + DUCK_RAFT.bottom });
    expect(raft.facing).toBe(f.facing);
    expect(entityPlatform(raft)).toEqual({ x1: raft.pos.x - 7, x2: raft.pos.x + 7, y: 3.5 });
    expect(f.ground?.kind).toBe('solid');
  });

  it('puts it under their feet in the air, where they land on it and finish the move standing', () => {
    const m = testMatch({ fighter: 'raftwars' });
    const f = placeInAir(m, 0, 100);
    const raft = throwRaft(m);
    expect(raft.pos.x).toBe(f.pos.x);
    expect(entityPlatform(raft)!.y).toBeCloseTo(f.pos.y, 9);
    expect(f.ground).toMatchObject({ kind: 'entity', index: raft.id });
    expect(f.move).toBe('downB');
    until(m, (k) => k.action === 'idle');
    expect(f.actionFrame).toBe(1);
    expect(f.ground).toMatchObject({ kind: 'entity', index: raft.id });
  });

  it('holds another fighter, who lands on it, stands, and drops through it with down', () => {
    const m = duel();
    const raft = throwRaft(m);
    const deck = entityPlatform(raft)!;
    const v = placeFireboy(m, raft.pos.x, 20);
    runPorts(m, 40, [{}, {}]);
    expect(v.ground).toMatchObject({ kind: 'entity', index: raft.id });
    expect(v.action).toBe('idle');
    expect(v.pos.y).toBe(deck.y);
    runPorts(m, 1, [{}, { y: -100 }]);
    runPorts(m, 20, [{}, {}]);
    expect(v.ground?.kind).toBe('solid');
    expect(v.pos.y).toBe(0);
  });

  it('stays where it was thrown for its whole life, with or without someone on it', () => {
    const m = testMatch({ fighter: 'raftwars' });
    placeInAir(m, 0, 100);
    const raft = throwRaft(m);
    const at = { ...raft.pos };
    for (let i = 0; i < 70; i++) {
      run(m, 1);
      expect(raft.pos).toEqual(at);
    }
  });

  it('wears out after 600 frames alone and after 75 with someone on it, as a wood block does', () => {
    const alone = testMatch({ fighter: 'raftwars' });
    const left = throwRaft(alone);
    until(alone, () => left.dead);
    expect(left.age).toBe(600);
    expect(destroyed(alone, left)).toMatchObject({ reason: 'expired' });
    expect(rafts(alone)).toHaveLength(0);

    const ridden = testMatch({ fighter: 'raftwars' });
    const f = placeInAir(ridden, 0, 100);
    const under = throwRaft(ridden);
    until(ridden, () => under.dead);
    expect(under.age).toBe(75);
    expect(destroyed(ridden, under)).toMatchObject({ reason: 'expired' });
    run(ridden, 1);
    expect([f.ground, f.action]).toEqual([null, 'fall']);
  });

  it("loses a hit's damage off the same HP and breaks at 0", () => {
    const m = duel();
    const raft = throwRaft(m);
    until(m, (f) => f.action === 'idle');
    Object.assign(m.fighters[0]!, { pos: { x: -70, y: 0 }, prevPos: { x: -70, y: 0 } });
    const v = placeFireboy(m, raft.pos.x + 9, 0);
    runPorts(m, 10, [{}, {}]);
    expect(v.ground?.kind).toBe('solid');
    attack(m, 1, 'dtilt');
    until(m, () => raft.damage > 0);
    expect(raft.hp).toBeCloseTo(DUCK_RAFT.hp - raft.damage - Number(raft.data.wear) * DUCK_RAFT.drain, 9);
    expect(raft.dead).toBe(false);
    until(m, () => v.action === 'idle');
    attack(m, 1, 'fsmash');
    until(m, () => raft.dead);
    expect(destroyed(m, raft)).toMatchObject({ reason: 'broken' });
  });

  it("can't be hit by the kids themselves", () => {
    const m = testMatch({ fighter: 'raftwars' });
    const kids = m.fighters[0]!;
    const raft = throwRaft(m);
    until(m, (f) => f.action === 'idle');
    attack(m, 0, 'dsmash');
    Object.assign(kids, { pos: { x: raft.pos.x - 9, y: 0 } });
    run(m, 30);
    expect(raft.damage).toBe(0);
    expect(raft.dead).toBe(false);
  });

  it('keeps one raft per player: a new one takes the old one away', () => {
    const m = testMatch({ fighter: 'raftwars' });
    const first = throwRaft(m);
    until(m, (f) => f.action === 'idle');
    const second = throwRaft(m);
    expect(first.dead).toBe(true);
    expect(destroyed(m, first)).toMatchObject({ reason: 'script' });
    expect(rafts(m)).toEqual([second]);
  });

  it('allows one raft per trip to the stage: standing on a raft gives none back, the stage does', () => {
    const m = testMatch({ fighter: 'raftwars' });
    const f = placeInAir(m, 0, 100);
    const first = throwRaft(m);
    expect(meter(f, 'raft')).toBe(0);
    until(m, (k) => k.action === 'idle');
    run(m, 20);
    expect(f.ground).toMatchObject({ kind: 'entity', index: first.id });
    expect(meter(f, 'raft')).toBe(0);
    throwRaft(m);
    expect(rafts(m)).toEqual([first]);
    until(m, () => first.dead);
    until(m, (k) => k.ground?.kind === 'platform');
    // Meters tick before the fighter moves, so the frame after landing on the stage refills it.
    expect(meter(f, 'raft')).toBe(0);
    run(m, 1);
    expect(meter(f, 'raft')).toBe(1);
    run(m, 1, { buttons: ['jump'] });
    run(m, 12);
    expect(f.ground).toBeNull();
    const second = throwRaft(m);
    expect(second.id).toBeGreaterThan(first.id);
    expect(meter(f, 'raft')).toBe(0);
  });

  it('plays back bit for bit, rafts, landings, drops and breaks included', () => {
    const frames: InputFrame[][] = [];
    const press = (i: number): [Hold, Hold] => {
      if (i < 2) return [DOWN_B, {}];
      if (i >= 30 && i < 34) return [{}, { x: -100 }];
      if (i >= 40 && i < 42) return [{}, { buttons: ['jump'] }];
      if (i >= 90 && i < 92) return [DOWN_B, { y: -100 }];
      if (i >= 120 && i < 122) return [{ buttons: ['jump'] }, {}];
      if (i >= 130 && i < 132) return [DOWN_B, {}];
      return [{}, {}];
    };
    const config = {
      seed: 7,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'raftwars' }, { fighter: 'fireboy' }],
    };
    const live = createMatch(config);
    const hashes: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 900; i++) {
      const step = press(i).map((h) => input(h));
      frames.push(step);
      stepMatch(live, step);
      hashes.push(hashState(live));
      for (const ev of live.events) {
        if (ev.type === 'entitySpawn' && ev.kind === RAFT) seen.add('spawn');
        if (ev.type === 'entityDestroy' && ev.kind === RAFT) seen.add(`destroy:${ev.reason}`);
        if (ev.type === 'land' && live.fighters[ev.port]!.ground?.kind === 'entity') seen.add('land');
      }
    }
    expect([...seen].sort()).toEqual(['destroy:expired', 'destroy:script', 'land', 'spawn']);
    const again = createMatch(config);
    frames.forEach((step, i) => {
      stepMatch(again, step);
      expect(hashState(again), `frame ${i}`).toBe(hashes[i]);
    });
    expect(hashState(playReplay({ version: 1, config, frames }))).toBe(hashState(live));
  });
});
