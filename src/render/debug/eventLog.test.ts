import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../../game';
import { installHarness } from '../../harness/api';
import { Btn } from '../../input/types';
import type { SimEvent } from '../../sim/events';
import { DEFAULT_MATCH, createMatch, type MatchConfig } from '../../sim/match';
import type { Renderer } from '../renderer';
import { EventLog } from './eventLog';

const jump = (port: number): SimEvent => ({ type: 'jump', port, kind: 'full' });

describe('EventLog', () => {
  it('shows the latest events, newest at the bottom', () => {
    const m = createMatch(DEFAULT_MATCH);
    const log = new EventLog();
    log.record([jump(0)], { config: m.config, frame: 10 });
    log.record([jump(1)], { config: m.config, frame: 12 });
    log.update(m);
    expect(log.shown).toBe('   10 P1 jump full\n   12 P2 jump full');
  });

  it('starts empty when a new match starts, even with the same settings', () => {
    const log = new EventLog();
    const first = createMatch(DEFAULT_MATCH);
    log.record([jump(0)], { config: first.config, frame: 30 });
    log.update(first);
    expect(log.shown).toContain('P1 jump');

    const second = createMatch(DEFAULT_MATCH);
    log.update(second);
    expect(log.shown).toBe('');

    log.record([jump(1)], { config: second.config, frame: 5 });
    log.update(second);
    expect(log.shown).toBe('    5 P2 jump full');
  });

  it('keeps the new match events recorded before it was first drawn', () => {
    const log = new EventLog();
    const first = createMatch(DEFAULT_MATCH);
    log.record([jump(0)], { config: first.config, frame: 30 });
    log.update(first);

    const second = createMatch(DEFAULT_MATCH);
    log.record([], { config: second.config, frame: 1 });
    log.record([jump(1)], { config: second.config, frame: 60 });
    log.update(second);
    expect(log.shown).toBe('   60 P2 jump full');
  });
});

/**
 * Every way a match restarts goes through `Game.newMatch`: Restart from pause and Rematch (the match screen's
 * `enter`), quitting to character select and starting again, playtest's Backspace and `window.__smash.newMatch`
 * and `loadReplay`. These drive the log the way `src/main.ts` wires it, through `game.onEvents`.
 */
describe('EventLog across match restarts', () => {
  const renderer = { render() {}, stepCamera() {} } as unknown as Renderer;
  const neutral = () => ({ x: 0, y: 0, cx: 0, cy: 0, buttons: 0 });
  const jumping = () => ({ ...neutral(), buttons: Btn.Jump });

  function wired(): { game: Game; log: EventLog } {
    const game = new Game(renderer, true);
    const log = new EventLog();
    game.onEvents((events, state) => log.record(events, state));
    return { game, log };
  }

  /** Step past the spawn landings, then jump: the log has this match's lines. */
  function play(game: Game, log: EventLog): void {
    for (let i = 0; i < 40; i++) game.step([neutral(), neutral()]);
    game.step([jumping(), neutral()]);
    for (let i = 0; i < 10; i++) game.step([neutral(), neutral()]);
    log.update(game.state);
    expect(log.shown).toContain('P1 jump');
  }

  afterEach(() => vi.unstubAllGlobals());

  it('starts empty on Restart from pause, which passes the same config object again', () => {
    const { game, log } = wired();
    const config: MatchConfig = { ...DEFAULT_MATCH, seed: 7 };
    game.newMatch(config);
    play(game, log);

    game.newMatch(config);
    log.update(game.state);
    expect(log.shown).toBe('');
  });

  it('starts empty on Rematch and on a new start from character select', () => {
    const { game, log } = wired();
    game.newMatch({ ...DEFAULT_MATCH, seed: 7 });
    play(game, log);

    game.newMatch({ ...DEFAULT_MATCH, seed: 8 });
    log.update(game.state);
    expect(log.shown).toBe('');

    play(game, log);
    // Character select leaves the last match's state in place until the next match starts.
    log.update(game.state);
    expect(log.shown).toContain('P1 jump');
    game.newMatch({ ...DEFAULT_MATCH, seed: 9, stage: 'forest-temple' });
    log.update(game.state);
    expect(log.shown).toBe('');
  });

  it('starts empty on __smash.newMatch with the default settings', () => {
    vi.stubGlobal('window', {});
    const { game, log } = wired();
    const smash = installHarness(game);
    smash.newMatch();
    play(game, log);

    smash.newMatch();
    log.update(game.state);
    expect(log.shown).toBe('');
    smash.step(1);
    log.update(game.state);
    expect(log.shown).not.toContain('jump');
  });

  it('shows only the replayed match after __smash.loadReplay', () => {
    vi.stubGlobal('window', {});
    const { game, log } = wired();
    const smash = installHarness(game);
    smash.newMatch();
    play(game, log);
    const shown = log.shown;

    smash.loadReplay(smash.replay());
    log.update(game.state);
    expect(log.shown).toBe(shown);
  });
});
