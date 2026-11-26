import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai/index';
import { planScenario, type GameScenario } from '../../harness/scenarios';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { registerFighter } from '../registry';
import { defineFighter } from '../types';
import { fighter } from '.';
import { RAM, RAM_BOUNCE, runningRam } from './ram';
import { scenarios } from './scenarios';
import { stats } from './stats';

type Hit = Extract<SimEvent, { type: 'hit' }>;

/** A side special with the stick tilted (no smash input), and one with it slammed (a smash input). */
const TILT: Hold = { x: 65, buttons: ['special'] };
const SMASH: Hold = { x: 100, buttons: ['special'] };
const SPECIAL: Hold = { buttons: ['special'] };
/** A fresh move (x1.05) in 1v1 (x1.2): what the meter adds per % of hitbox damage. */
const FRESH_1V1 = 1.05 * 1.2;

const duck = () => testMatch({ fighter: 'duck' });

/** Fighter 0 dropped onto the main floor at `x` facing `facing`, settled. */
function stand(m: MatchState, port: number, x: number, facing: 1 | -1): FighterState {
  const f = m.fighters[port]!;
  Object.assign(f, {
    pos: { x, y: 1 },
    prevPos: { x, y: 1 },
    vel: { x: 0, y: 0 },
    ground: null,
    action: 'fall',
    actionFrame: 1,
    facing,
  });
  return f;
}

/** The Duck at x -40 facing right and the Mario reference standing 8 units ahead, both settled. */
function duel(): [MatchState, FighterState, FighterState] {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'duck' }, { fighter: marioReference.id }],
  });
  const a = stand(m, 0, -40, 1);
  const v = stand(m, 1, -32, -1);
  runPorts(m, 20, [{}, {}]);
  v.intangible = 0;
  return [m, a, v];
}

/**
 * Starts the ram with `press`, then holds Special through the startup until it has charged `frames` frames (0 lets
 * go at once). Port 1 holds `other`.
 */
function charge(m: MatchState, press: Hold, frames: number, other: Hold = {}): void {
  runPorts(m, 1, [press, other]);
  const f = m.fighters[0]!;
  for (let i = 0; i < 300 && f.charge < frames; i++) runPorts(m, 1, [SPECIAL, other]);
}

/** The hitbox damage of the ram's hit on the Mario reference after `press` and `frames` of charge. */
function damage(press: Hold, frames: number): number {
  const [m] = duel();
  charge(m, press, frames);
  for (let i = 0; i < 200; i++) {
    const hit = m.events.find((e): e is Hit => e.type === 'hit' && e.attacker === 0);
    if (hit) return hit.damage / FRESH_1V1;
    runPorts(m, 1, [{}, {}]);
  }
  throw new Error('the ram never hit');
}

/** Frames until the move lets go of the Duck, stepping with `hold`. */
const playOut = (m: MatchState, hold: Hold = {}) => until(m, (g) => g.move !== 'sideB', hold, 400);

/** The Duck with Running Ram counting the runs of its script in `scriptRuns`. */
let scriptRuns = 0;
const counter = defineFighter({
  ...fighter,
  id: 'test-duck-ram-runs',
  name: 'Test: Running Ram runs',
  moves: {
    ...fighter.moves,
    sideB: {
      ...runningRam,
      script: (x) => {
        scriptRuns++;
        runningRam.script!(x);
      },
    },
  },
});
registerFighter(counter);

describe("The Duck: Running Ram (side special, Pikachu's Skull Bash)", () => {
  it('charges on frame 13 while Special is held and launches by itself after 80 frames', () => {
    const m = duck();
    const f = m.fighters[0]!;
    run(m, 1, TILT);
    expect(f.move).toBe('sideB');
    const frames = until(m, (g) => g.actionFrame >= RAM.launch, SPECIAL, 300);
    expect(f.charge).toBe(80);
    expect(1 + frames).toBe(RAM.launch - 1 + RAM.chargeFrames + 1);
  });

  it.each([
    ['no charge', TILT, 0, 6.2],
    ["a smash input (20 frames of charge, UFD's 10.0%)", SMASH, 0, 10],
    ['half charge', TILT, 40, 13.8],
    ['full charge', TILT, 80, 21.4],
  ] as const)('deals 6.2 + 15.2 x charge / 80: %s', (_, press, frames, expected) => {
    expect(damage(press, frames)).toBeCloseTo(expected, 9);
  });

  it('hits on frames 18-25 with a radius-4 box and 26-52 with a radius-3 one, at 361 degrees, KBG 78, BKB 40', () => {
    const [clean, late] = runningRam.hits as [(typeof runningRam.hits)[0], (typeof runningRam.hits)[0]];
    expect([clean.frames, late.frames]).toEqual([RAM.clean, RAM.late]);
    expect(clean.boxes[0]).toMatchObject({ radius: 4, damage: 6.2, angle: 361, kbg: 78, bkb: 40 });
    expect(late.boxes[0]).toMatchObject({ radius: 3, damage: 6.2, angle: 361, kbg: 78, bkb: 40 });
  });

  it.each([
    ['uncharged', 0, 1.6],
    ['fully charged', 80, 3.2],
  ] as const)(
    '%s (%i charge frames): %s units a frame through its hit frames, then a slide to a stop',
    (_, frames, speed) => {
      const m = duck();
      const f = stand(m, 0, -78, 1);
      run(m, 20);
      const x0 = f.pos.x;
      charge(m, TILT, frames);
      until(m, (g) => g.actionFrame === RAM.launch - 1);
      const from = f.pos.x;
      until(m, (g) => g.actionFrame === RAM.late[1]);
      expect(f.pos.x - from).toBeCloseTo(speed * (RAM.late[1] - RAM.launch + 1), 6);
      expect(playOut(m)).toBe(RAM.faf - RAM.late[1]);
      expect(f.action).toBe('idle');
      // Skull Bash: 35 frames at full speed, then 0.7 of it under 0.032 to 0.063 of friction.
      const friction = frames ? 0.063 : 0.032;
      const skullBash = 35 * speed + (0.7 * speed) ** 2 / (2 * friction);
      expect(Math.abs(f.pos.x - x0 - skullBash)).toBeLessThan(2);
    },
  );

  it("a full charge KOs the Mario reference from Battlefield's centre at 85%, as Skull Bash's full charge does", () => {
    const ram = koPercent({
      hit: { fighter: 'duck', move: 'sideB' },
      from: 'centre',
      charge: RAM.chargeFrames,
    });
    const skullBash = koPercent({ hit: { damage: 21.4, angle: 361, kbg: 78, bkb: 40 }, from: 'centre' });
    expect(ram).not.toBeNull();
    expect(Math.abs(ram! - skullBash!)).toBeLessThanOrEqual(5);
    // 85.3 today. No source gives Skull Bash's own kill %, so this is the engine's figure for its numbers.
    expect(ram!).toBeGreaterThan(83);
    expect(ram!).toBeLessThan(88);
  });

  it('started just above the floor, it touches down during the charge and carries on with no landing lag', () => {
    const m = duck();
    const f = placeInAir(m, -40, 4, 1);
    run(m, 1, TILT);
    expect(f.action).toBe('aerial');
    const lag: number[] = [];
    const actions = new Set<string>();
    for (let i = 0; i < 200 && f.move === 'sideB'; i++) {
      run(m, 1);
      for (const e of m.events) if (e.type === 'land' && e.port === 0) lag.push(e.lag);
      if (f.move === 'sideB') actions.add(f.action);
    }
    expect(lag.length).toBeGreaterThan(0);
    expect(lag.every((l) => l === 0)).toBe(true);
    expect([...actions].sort()).toEqual(['aerial', 'attack']);
    expect(f.action).toBe('idle');
  });

  it("charges in the air under Skull Bash's 0.04 gravity, once a frame while Special is held", () => {
    const m = duck();
    const f = placeInAir(m, -40, 100, 1);
    run(m, 1, TILT);
    until(m, (g) => g.charge === 10, SPECIAL);
    const falls: number[] = [];
    for (let i = 0; i < 6; i++) {
      const y = f.pos.y;
      run(m, 1, SPECIAL);
      falls.push(y - f.pos.y);
    }
    for (let i = 1; i < falls.length; i++) expect(falls[i]! - falls[i - 1]!).toBeCloseTo(RAM.startGravity, 9);
  });

  it('runs its script once a frame through a full air charge and the dash', () => {
    const m = testMatch({ fighter: counter.id });
    // High enough that it never lands. On the floor, frame 18's take-off switches to the air and plays that frame again.
    const f = placeInAir(m, -40, 170, 1);
    run(m, 1, TILT);
    expect(f.move).toBe('sideB');
    const runs: number[] = [];
    while (f.actionFrame < RAM.late[1]) {
      const before = scriptRuns;
      run(m, 1, SPECIAL);
      runs.push(scriptRuns - before);
    }
    expect([f.charge, f.ground]).toEqual([RAM.chargeFrames, null]);
    expect(runs).toHaveLength(RAM.late[1] - 1 + RAM.chargeFrames);
    expect(runs).toEqual(runs.map(() => 1));
  });

  it('holding the charge in the air slows it once a frame: 0.02 across, and 0.04 a frame of fall', () => {
    const m = duck();
    const f = placeInAir(m, -40, 100, 1);
    run(m, 1, TILT);
    run(m, RAM.charge - 2, SPECIAL);
    expect(f.actionFrame).toBe(RAM.charge - 1);
    f.vel = { x: stats.airSpeed, y: 1 };
    // One startup step a frame, then the air physics with drift off: the Duck's own gravity, capped at his fall speed.
    let { x: vx, y: vy } = f.vel;
    for (let i = 0; i < RAM.chargeFrames; i++) {
      run(m, 1, SPECIAL);
      vx = Math.max(0, vx - RAM.startFriction);
      vy = Math.max(vy + stats.gravity - RAM.startGravity - stats.gravity, -stats.fallSpeed);
      expect([f.actionFrame, f.charge]).toEqual([RAM.charge - 1, i + 1]);
      expect(f.vel.x).toBeCloseTo(vx, 12);
      expect(f.vel.y).toBeCloseTo(vy, 12);
    }
    expect([vx, vy, f.ground]).toEqual([0, -stats.fallSpeed, null]);
  });

  it('a down flick never fast-falls it, mid-dash or in the ending', () => {
    const path = (flick: boolean) => {
      const m = duck();
      const f = placeInAir(m, -100, 80, 1);
      run(m, 1, TILT);
      const ys: number[] = [];
      for (let i = 0; i < 70; i++) {
        run(m, 1, flick && f.actionFrame >= 40 && i % 3 === 0 ? { y: -100 } : {});
        ys.push(f.pos.y);
      }
      return ys;
    };
    expect(path(true)).toEqual(path(false));
  });

  it('ends in the air on frame 75, free to act (not helpless)', () => {
    const m = duck();
    const f = placeInAir(m, -100, 80, 1);
    run(m, 1, TILT);
    expect(1 + playOut(m)).toBe(RAM.airFaf);
    expect(f.action).toBe('fall');
    run(m, 1, { buttons: ['jump'] });
    expect(f.action).toBe('doubleJump');
  });

  it('flies off the stage from the floor instead of stopping at the edge', () => {
    const m = duck();
    const f = stand(m, 0, 50, 1);
    run(m, 20);
    run(m, 1, TILT);
    playOut(m);
    expect(f.pos.x).toBeGreaterThan(80);
    expect(f.action).toBe('fall');
    expect(f.jumpsUsed).toBeLessThan(stats.jumps);
  });

  it('grabs a ledge it reaches from frame 27, as a recovery', () => {
    const m = duck();
    const f = placeInAir(m, -110, -6, 1);
    run(m, 1, TILT);
    let frame = 0;
    for (let i = 0; i < 120 && f.move === 'sideB'; i++) {
      run(m, 1);
      if (f.move === 'sideB') frame = f.actionFrame;
    }
    expect(f.action.startsWith('ledge')).toBe(true);
    expect(frame + 1).toBeGreaterThanOrEqual(RAM.ledgeFrom);
  });

  it.each<[string, Hold]>([
    ['a hit', {}],
    ['a shield', { buttons: ['shield'] }],
  ])('bounces back off %s and can act 22 frames later', (_, other) => {
    const [m, a, v] = duel();
    charge(m, TILT, 0, other);
    for (let i = 0; i < 60 && a.hitVictims.length === 0; i++) runPorts(m, 1, [{}, other]);
    expect(a.hitVictims).toEqual([1]);
    while (a.hitlag > 0) runPorts(m, 1, [{}, other]);
    runPorts(m, 1, [{}, other]);
    expect(a.actionFrame).toBe(RAM_BOUNCE);
    expect(a.vel.x * a.facing).toBeLessThan(0);
    expect(a.vel.y).toBeGreaterThan(0);
    let frames = 1;
    while (a.move === 'sideB') {
      runPorts(m, 1, [{}, other]);
      frames++;
    }
    expect(frames).toBe(RAM.bounce.frames + 1);
    expect(a.action).toBe('fall');
    expect(v.damage > 0).toBe(v.action !== 'shield');
  });

  it('captures the full-charge ram hitting Fireboy for the hill-climb scenarios', () => {
    const ram = scenarios.extra!.find((s) => s.name === 'duck-running-ram') as GameScenario;
    expect(planScenario(ram).status).toBe('captured');
  });

  it('a level 9 CPU rams Fireboy without errors', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'duck' }, { fighter: 'fireboy' }],
    });
    const cpus = [createCpu({ port: 0, level: 9, seed: 1 }), createCpu({ port: 1, level: 9, seed: 11 })];
    let rams = 0;
    for (let i = 0; i < 3600; i++) {
      stepMatch(
        m,
        cpus.map((c) => c.input(m)),
      );
      rams += m.events.filter((e) => e.type === 'move' && e.port === 0 && e.move === 'sideB').length;
    }
    expect(rams).toBeGreaterThan(0);
  }, 60_000);
});
