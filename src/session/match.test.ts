import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import type { SimEvent } from '../sim/events';
import { createMatch } from '../sim/match';
import {
  COUNTDOWN_FRAMES,
  GO_FRAMES,
  MatchSession,
  countdownCallout,
  countdownLabel,
  formatClock,
} from './match';
import { defaultSetup, pickFighter, resolveMatch } from './setup';

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

function start() {
  const setup = defaultSetup();
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
