import { describe, expect, it } from 'vitest';
import { getFighter } from '../fighters/registry';
import { Btn, neutralInput } from '../input/types';
import { hurtbox } from '../sim/combat/hits';
import type { FighterState } from '../sim/fighter';
import { entityPlatform, spawnEntity } from '../sim/entities/entities';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { input, run as play, testMatch } from '../sim/testing/sim';
import { STICK, press } from './inputs';
import { run, runAmong, sample, setEntities, soloMatch, type OwnFrame } from './look';

/** Raft Wars at x, facing a Red Ball at x + d, and `others` more Red Balls standing far off, on Battlefield. */
function facingOff(x: number, d: number, others = 0): MatchState {
  const ports = [
    { fighter: 'raftwars' },
    { fighter: 'redball' },
    ...Array.from({ length: others }, () => ({ fighter: 'redball' })),
  ];
  const m = createMatch({ seed: 1, stage: 'battlefield', stocks: 3, ports });
  for (let i = 0; i < 30; i++)
    stepMatch(
      m,
      m.players.map(() => neutralInput()),
    );
  Object.assign(m.fighters[0]!, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, facing: 1 });
  Object.assign(m.fighters[1]!, { pos: { x: x + d, y: 0 }, prevPos: { x: x + d, y: 0 }, facing: -1 });
  m.fighters
    .slice(2)
    .forEach((f, i) =>
      Object.assign(f, { pos: { x: -70 + i * 6, y: 0 }, prevPos: { x: -70 + i * 6, y: 0 } }),
    );
  return m;
}

/** Step `m` `frames` frames with nobody pressing anything, sampling port 1 (the Red Ball) after each. */
function played(m: MatchState, frames: number): unknown[][] {
  const stats = getFighter('redball').stats;
  return Array.from({ length: frames }, () => {
    stepMatch(
      m,
      m.players.map(() => neutralInput()),
    );
    return sample(m.fighters[1]!, stats);
  }).map((s) => [s.action, s.x, s.y, s.vx, s.vy]);
}

describe('look-ahead', () => {
  it('samples each frame with the stats of the form the fighter is in by then', () => {
    const m = testMatch({ fighter: 'bloxorz' });
    const solo = soloMatch(m, m.fighters[0]!);
    const samples = run(solo, 5, () => input({ y: -100 }));
    const g = solo.fighters[0]!;
    expect(g.fighter).toBe('bloxorz-lying');
    const hurt = samples.at(-1)!.hurt;
    expect(hurt).toEqual(hurtbox(g, getFighter('bloxorz-lying').stats));
    expect(hurt.hw).toBeGreaterThan(0);
  });

  it("plays the owner's entities in a look-ahead of its opponent: a grenade in the air bursts on it as in the match", () => {
    // Raft Wars throws a grenade at a Red Ball standing 90 units away. 40 frames later it is in the air, and its
    // burst hits the Red Ball 65 frames after that.
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'raftwars' }, { fighter: 'redball' }],
    });
    for (let i = 0; i < 30; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    Object.assign(m.fighters[0]!, { pos: { x: -45, y: 0 }, prevPos: { x: -45, y: 0 }, facing: 1 });
    Object.assign(m.fighters[1]!, { pos: { x: 45, y: 0 }, prevPos: { x: 45, y: 0 }, facing: -1 });
    stepMatch(m, [press({ x: STICK.special, buttons: Btn.Special }), neutralInput()]);
    for (let i = 1; i < 40; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    expect(m.entities.map((e) => e.kind)).toEqual(['raftwars/grenade']);

    const ahead = (entities: boolean) => {
      const solo = soloMatch(m, m.fighters[1]!);
      if (entities) setEntities(solo, m.fighters[0]!, m.entities, 1);
      return run(solo, 90).map((s) => [s.action, s.x, s.y, s.vx, s.vy]);
    };
    const real = structuredClone(m);
    const stats = getFighter('redball').stats;
    const played = Array.from({ length: 90 }, () => {
      stepMatch(real, [neutralInput(), neutralInput()]);
      return sample(real.fighters[1]!, stats);
    }).map((s) => [s.action, s.x, s.y, s.vx, s.vy]);
    const launched = played.findIndex(([action]) => action !== 'idle');
    expect(launched).toBe(65);
    expect(ahead(true)).toEqual(played);
    // Without the grenade, the look-ahead has the Red Ball standing there the whole time.
    expect(ahead(false).every(([action]) => action === 'idle')).toBe(true);
    // With nothing out, the look-ahead stays as it was; set again, the entities replace the ones it had.
    const solo = soloMatch(m, m.fighters[1]!);
    setEntities(solo, m.fighters[0]!, [], 1);
    expect([solo.fighters.length, solo.entities.length]).toEqual([1, 0]);
    setEntities(solo, m.fighters[0]!, m.entities, 1);
    setEntities(solo, m.fighters[0]!, m.entities, 1);
    expect(solo.entities.map((e) => [e.kind, e.owner])).toEqual([['raftwars/grenade', 1]]);
    setEntities(solo, m.fighters[0]!, [], 1);
    expect([solo.fighters[1]!.action, solo.entities.length]).toEqual(['out', 0]);
  });

  it("replays the owner's shot from when the opponent was last seen with the owner as it was then", () => {
    // A forward tilt shot hits the Red Ball 80 units away, and 4 frames later the look-ahead starts from the Red Ball
    // 8 frames back, as a level 9 CPU sees it. The replayed shot is staled by Raft Wars' queue from then (fresh,
    // x1.05), as in the match, not by today's, which holds this very hit (x0.91).
    const m = facingOff(-40, 80);
    const mine: OwnFrame[] = [];
    const seen: FighterState[] = [];
    let hit = -1;
    for (let i = 0; hit < 0 || i <= hit + 4; i++) {
      stepMatch(m, [
        i === 0 ? press({ x: STICK.tilt, buttons: Btn.Attack }) : neutralInput(),
        neutralInput(),
      ]);
      if (m.events.some((e) => e.type === 'hit' && e.entity !== undefined)) hit = i;
      mine.push({
        f: structuredClone(m.fighters[0]!),
        entities: structuredClone(m.entities.filter((e) => e.owner === 0)),
      });
      seen.push(structuredClone(m.fighters[1]!));
    }
    expect(m.fighters[1]!.damage).toBeCloseTo(6 * 1.05 * 1.2, 5);
    const lag = 8;
    const solo = soloMatch(m, seen.at(-1 - lag)!);
    const ahead = runAmong(solo, lag + 40, () => neutralInput(), lag, mine, 1).slice(lag);
    expect(ahead.map((s) => [s.action, s.x, s.y, s.vx, s.vy])).toEqual(played(m, 40));
    expect(solo.fighters[0]!.damage).toBe(m.fighters[1]!.damage);
  });

  it("keeps the match's 1v1 damage rule in a look-ahead, with or without a stand-in for the owner", () => {
    // x1.2 damage taken applies to a 1v1 with items off. With a third fighter in the match it doesn't, whatever the
    // look-ahead's own count of players (the Red Ball, plus a stand-in for Raft Wars when his grenade is out).
    for (const others of [0, 1]) {
      const m = facingOff(-45, 90, others);
      stepMatch(m, [
        press({ x: STICK.special, buttons: Btn.Special }),
        ...m.players.slice(1).map(() => neutralInput()),
      ]);
      for (let i = 1; i < 40; i++)
        stepMatch(
          m,
          m.players.map(() => neutralInput()),
        );
      const solo = soloMatch(m, m.fighters[1]!);
      setEntities(solo, m.fighters[0]!, m.entities, 1);
      const ahead = run(solo, 90).map((s) => [s.action, s.x, s.y, s.vx, s.vy]);
      expect(ahead, `${others + 2} players`).toEqual(played(m, 90));
      expect(solo.fighters[0]!.damage, `${others + 2} players`).toBe(m.fighters[1]!.damage);
    }
  });

  it("holds the match's entity platforms, anyone's, and nothing else out: a Red Ball stays on Raft Wars' raft", () => {
    // Raft Wars has a grenade in the air and a raft out at (-70, 30), a Red Ball standing on the raft. The Red Ball's
    // look-ahead holds the raft but not the grenade, so the Red Ball stays on it as in the match while its weight
    // wears it out, and falls when it pops, 75 frames in.
    const m = facingOff(-45, 90);
    stepMatch(m, [press({ x: STICK.special, buttons: Btn.Special }), neutralInput()]);
    for (let i = 1; i < 40; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    const raft = spawnEntity(m, { kind: 'raftwars/duckRaft', owner: 0, pos: { x: -70, y: 30 } });
    const deck = entityPlatform(raft)!;
    Object.assign(m.fighters[1]!, {
      pos: { x: -70, y: deck.y },
      prevPos: { x: -70, y: deck.y },
      ground: { kind: 'entity', index: raft.id, ...deck },
    });
    expect(m.entities.map((e) => e.kind)).toEqual(['raftwars/grenade', 'raftwars/duckRaft']);
    const solo = soloMatch(m, m.fighters[1]!);
    // Raft Wars' raft, with its id, under a port the look-ahead doesn't hold (2 for port 0).
    expect(solo.entities.map((e) => [e.kind, e.id, e.owner])).toEqual([['raftwars/duckRaft', raft.id, 2]]);
    const ahead = run(solo, 100).map((s) => [s.action, s.x, s.y, s.vx, s.vy]);
    const real = played(structuredClone(m), 100);
    expect(real.findIndex(([action]) => action !== 'idle')).toBe(75);
    expect(ahead).toEqual(real);
    // In Raft Wars' own look-ahead the raft is port 0's, as Raft Wars is.
    expect(soloMatch(m, m.fighters[0]!).entities.map((e) => [e.kind, e.owner])).toEqual([
      ['raftwars/duckRaft', 0],
    ]);
    // setEntities makes the owner's entities the ones it is given, so its raft is there once, or not at all.
    const among = soloMatch(m, m.fighters[1]!);
    setEntities(among, m.fighters[0]!, m.entities, 1);
    expect(among.entities.map((e) => [e.kind, e.owner])).toEqual([
      ['raftwars/grenade', 1],
      ['raftwars/duckRaft', 1],
    ]);
    const none = soloMatch(m, m.fighters[1]!);
    setEntities(none, m.fighters[0]!, [], 1);
    expect([none.fighters.length, none.entities.length]).toEqual([1, 0]);
  });

  it("poses moving stage pieces on the match's own stage clock", () => {
    // The testbed's elevator runs on a 420-frame cycle. 300 frames in, a look-ahead's next 30 frames of it are the
    // match's next 30.
    const m = testMatch({ fighter: 'redball', stage: 'testbed' });
    play(m, 300);
    const solo = soloMatch(m, m.fighters[0]!);
    for (let i = 0; i < 30; i++) {
      stepMatch(solo, [neutralInput()]);
      stepMatch(m, [neutralInput()]);
      expect(solo.stage, `frame ${i}`).toEqual(m.stage);
    }
    expect(solo.stageFrame).toBe(m.stageFrame);
  });

  it("keeps an entity's hits on fighters the look-ahead doesn't hold, so Johnny's upgraded laser still bursts", () => {
    // Three players: Johnny's upgraded laser hits a Red Ball standing in front of another, and bursts there on the
    // next frame, the burst's 14 units reaching the one behind. The look-ahead of the one behind, taken between the
    // two frames, holds neither Johnny nor the first Red Ball, but the laser in it has still hit someone.
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'johnny' }, { fighter: 'redball' }, { fighter: 'redball' }],
    });
    for (let i = 0; i < 30; i++)
      stepMatch(
        m,
        m.players.map(() => neutralInput()),
      );
    const at = (f: FighterState, x: number, facing: 1 | -1) =>
      Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, facing });
    at(m.fighters[0]!, -40, 1);
    at(m.fighters[1]!, 31, -1);
    at(m.fighters[2]!, 20, -1);
    spawnEntity(m, {
      kind: 'johnny/megaLaser',
      owner: 0,
      pos: { x: -27.2, y: 8 },
      vel: { x: 4.6, y: 0 },
      move: 'neutralB',
    });
    let first = -1;
    for (let i = 0; first < 0 && i < 40; i++) {
      stepMatch(
        m,
        m.players.map(() => neutralInput()),
      );
      if (m.events.some((e) => e.type === 'hit' && e.victim === 2)) first = i;
    }
    expect(first).toBeGreaterThanOrEqual(0);
    expect(m.entities.map((e) => [e.kind, e.hitVictims])).toEqual([['johnny/megaLaser', [2]]]);
    const solo = soloMatch(m, m.fighters[1]!);
    setEntities(solo, m.fighters[0]!, m.entities, 1);
    const ahead = run(solo, 40).map((s) => [s.action, s.x, s.y, s.vx, s.vy]);
    expect(ahead).toEqual(played(m, 40));
    expect(m.fighters[1]!.damage).toBeGreaterThan(0);
    expect(solo.fighters[0]!.damage).toBe(m.fighters[1]!.damage);
  });
});
