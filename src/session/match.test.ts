import { describe, expect, it, vi } from 'vitest';
import type * as Ai from '../ai';
import { neutralInput } from '../input/types';
import { INFINITE_STOCKS } from '../sim/constants';
import type { SimEvent } from '../sim/events';
import { createMatch, stepMatch } from '../sim/match';
import {
  COUNTDOWN_FRAMES,
  GO_FRAMES,
  MatchSession,
  countdownCallout,
  countdownLabel,
  formatClock,
} from './match';
import { defaultSetup, humanSlot, pickFighter, resolveMatch } from './setup';

const warmed = vi.hoisted(() => [] as [string[], string][]);
vi.mock('../ai', async (orig) => {
  const m = await orig<typeof Ai>();
  return {
    ...m,
    warmKnowledge: (fighters: readonly string[], stage: string) => {
      warmed.push([[...fighters], stage]);
      return m.warmKnowledge(fighters, stage);
    },
  };
});

const hit: SimEvent = {
  type: 'hit',
  attacker: 0,
  victim: 1,
  move: null,
  damage: 18,
  kb: 10,
  tumble: false,
  hitlag: 0,
  effect: 'normal',
  x: 0,
  y: 0,
};

function start(stocks = 3) {
  const setup = defaultSetup();
  setup.rules.stocks = stocks;
  pickFighter(setup, 0, 'fireboy');
  const match = resolveMatch(setup, 42, false);
  return { match, state: createMatch(match.config), session: new MatchSession(match, setup.rules) };
}

describe('match session', () => {
  it('starts both controllers and the clock on GO', () => {
    const { match, state, session } = start();
    const read = () => ({ ...neutralInput(), x: 127 });
    expect(match.config.ports.every((p) => p.tapJump === false)).toBe(true);
    state.frame = COUNTDOWN_FRAMES - 1;
    session.observe(state);
    expect(countdownLabel(state.frame)).toBe('1');
    expect(session.inputs(state, read)).toEqual([neutralInput(), neutralInput()]);

    state.frame++;
    session.observe(state);
    expect(countdownLabel(state.frame)).toBe('GO!');
    expect(session.inputs(state, read)[0]).toEqual(read());
    expect(formatClock(session.timeLeft(state)!)).toEqual({ main: '7:00', hundredths: '.00' });
  });

  it('records a KO and keeps the result unchanged while the finale plays', () => {
    const { state, session } = start();
    state.frame = COUNTDOWN_FRAMES + 10;
    state.fighters[1]!.stocks = 0;
    state.events = [
      { type: 'pummel', attacker: 0, victim: 1, damage: 3 },
      hit,
      { type: 'ko', port: 1, stocks: 0, side: 'right', x: 0, y: 0 },
    ];
    session.observe(state);

    expect(session.result).toMatchObject({
      reason: 'stock',
      frames: 10,
      players: [
        { place: 1, stats: { kos: 1, damageDealt: 21 } },
        { place: 2, stats: { damageTaken: 21, falls: 1, sds: 0, outFrame: state.frame } },
      ],
    });
    const result = session.result;
    state.frame++;
    state.fighters[0]!.stocks = 0;
    state.events = [{ type: 'ko', port: 0, stocks: 0, side: 'bottom', x: 0, y: 0 }];
    session.observe(state);
    expect(session.result).toBe(result);
    expect(session.result?.players[0]!.stocks).toBe(3);
  });

  it('counts a later fall as a self-destruct if the fighter reached a ledge after the hit', () => {
    const { state, session } = start();
    state.frame = COUNTDOWN_FRAMES + 10;
    state.events = [hit];
    session.observe(state);
    state.frame++;
    state.events = [{ type: 'action', port: 1, from: 'fall', to: 'ledgeCatch' }];
    session.observe(state);
    state.frame++;
    state.fighters[1]!.stocks = 0;
    state.events = [{ type: 'ko', port: 1, stocks: 0, side: 'bottom', x: 0, y: 0 }];
    session.observe(state);
    expect(session.result?.players[0]!.stats.kos).toBe(0);
    expect(session.result?.players[1]!.stats.sds).toBe(1);
  });

  it('breaks time-limit ties with stocks first, then damage', () => {
    const { state, session } = start();
    state.frame = COUNTDOWN_FRAMES + 7 * 60 * 60;
    state.fighters[0]!.damage = 80;
    state.fighters[1]!.damage = 30;
    session.observe(state);
    expect(session.timeLeft(state)).toBe(0);
    expect(session.result?.reason).toBe('time');
    expect(session.result?.players.map((p) => p.place)).toEqual([2, 1]);
  });

  it('keeps an Infinite stock match going past 99 falls until the clock runs out', () => {
    const { state, session } = start(INFINITE_STOCKS);
    const idle = [neutralInput(), neutralInput()];
    const step = () => (stepMatch(state, idle), session.observe(state));
    while (state.frame < COUNTDOWN_FRAMES) step();
    for (let fall = 1; fall <= 120; fall++) {
      Object.assign(state.fighters[1]!, { ground: null, action: 'fall', pos: { x: 30, y: -300 } });
      for (let i = 0; i < 200 && state.fighters[1]!.action !== 'respawn'; i++) step();
      expect(state.fighters[1]!.action).toBe('respawn');
    }
    expect(session.phase).toBe('play');
    expect(state.fighters[1]!.stocks).toBe(INFINITE_STOCKS);

    state.frame = COUNTDOWN_FRAMES + 7 * 60 * 60 - 1;
    step();
    expect(session.result).toMatchObject({
      reason: 'time',
      players: [{ place: 1 }, { place: 2, stocks: INFINITE_STOCKS, stats: { falls: 120, sds: 120 } }],
    });
  });

  it('ranks a timed-out Infinite stock match by KOs minus falls, then damage (Ultimate Time battle)', () => {
    const { state, session } = start(INFINITE_STOCKS);
    const ko = (port: number): SimEvent => ({
      type: 'ko',
      port,
      stocks: INFINITE_STOCKS,
      side: 'bottom',
      x: 0,
      y: 0,
    });
    state.frame = COUNTDOWN_FRAMES + 10;
    // P1: 2 KOs and 3 self-destructs, score -1. P2: 2 falls, score -2, but fewer falls and less damage.
    for (const events of [[hit, ko(1)], [hit, ko(1)], [ko(0)], [ko(0)], [ko(0)]]) {
      state.events = events;
      session.observe(state);
      state.frame++;
    }
    state.fighters[0]!.damage = 80;
    state.fighters[1]!.damage = 30;
    state.frame = COUNTDOWN_FRAMES + 7 * 60 * 60;
    state.events = [];
    session.observe(state);
    expect(session.result?.reason).toBe('time');
    expect(session.result?.players.map((p) => [p.place, p.stats.kos, p.stats.falls])).toEqual([
      [1, 2, 3],
      [2, 0, 2],
    ]);
  });
});

describe('CPU move probes', () => {
  it('are made for every fighter in the match while it loads, when a CPU plays, and not when only people do', () => {
    warmed.length = 0;
    const { match } = start();
    expect(warmed).toEqual([[match.config.ports.map((p) => p.fighter), match.config.stage]]);

    warmed.length = 0;
    const setup = defaultSetup();
    setup.slots = [humanSlot('kb1'), humanSlot('kb2')];
    pickFighter(setup, 0, 'fireboy');
    pickFighter(setup, 1, 'wheely');
    new MatchSession(resolveMatch(setup, 42, false), setup.rules);
    expect(warmed).toEqual([]);
  });
});

describe('countdown callouts (Ultimate timing, see match.ts)', () => {
  it('brings up 3, 2, 1 and GO! 60 frames apart, on the frames the announcer calls them', () => {
    const calls: [number, string][] = [];
    let shown: string | null = null;
    for (let frame = 0; frame < COUNTDOWN_FRAMES + GO_FRAMES + 30; frame++) {
      const label = countdownLabel(frame);
      if (label && label !== shown) calls.push([frame, label]);
      shown = label;
    }
    expect(calls).toEqual([
      [0, '3'],
      [60, '2'],
      [120, '1'],
      [180, 'GO!'],
    ]);
  });

  it('unfolds each number over 6 frames, fades it over frames 51 to 56 and leaves 3 empty frames', () => {
    for (const start of [0, 60, 120]) {
      expect(countdownCallout(start)).toMatchObject({ age: 0, enter: 0, leave: 0 });
      expect(countdownCallout(start + 5)!.enter).toBeLessThan(1);
      for (let age = 6; age <= 51; age++)
        expect(countdownCallout(start + age)).toMatchObject({ enter: 1, leave: 0 });
      expect(countdownCallout(start + 56)!.leave).toBeGreaterThan(0.8);
      for (const age of [57, 58, 59]) expect(countdownCallout(start + age)!.leave).toBe(1);
    }
  });

  it('holds GO! fully up from frame 6 to 49 of play, then fades it out and clears it on frame 66', () => {
    expect(countdownCallout(COUNTDOWN_FRAMES)).toEqual({ label: 'GO!', age: 0, enter: 0, leave: 0 });
    for (let age = 6; age < 50; age++)
      expect(countdownCallout(COUNTDOWN_FRAMES + age)).toMatchObject({ enter: 1, leave: 0 });
    let leave = 0;
    for (let age = 51; age < 66; age++) {
      const next = countdownCallout(COUNTDOWN_FRAMES + age)!.leave;
      expect(next).toBeGreaterThan(leave);
      leave = next;
    }
    expect(leave).toBeGreaterThan(0.9);
    expect(countdownLabel(COUNTDOWN_FRAMES + 65)).toBe('GO!');
    expect(countdownCallout(COUNTDOWN_FRAMES + 66)).toBeNull();
  });
});
