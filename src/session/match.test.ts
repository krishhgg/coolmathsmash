import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { createMatch } from '../sim/match';
import { COUNTDOWN_FRAMES, MatchSession, countdownLabel, formatClock } from './match';
import { defaultSetup, pickFighter, resolveMatch } from './setup';

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
      {
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
      },
      { type: 'ko', port: 1, stocks: 0, side: 'right', x: 0, y: 0 },
    ];
    session.observe(state);

    expect(session.result).toMatchObject({
      reason: 'stock',
      frames: 10,
      players: [
        { place: 1, stats: { kos: 1, damageDealt: 18 } },
        { place: 2, stats: { falls: 1, sds: 0, outFrame: state.frame } },
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
