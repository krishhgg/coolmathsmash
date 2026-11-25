import { audio } from '../../audio';
import type { Game } from '../../game';
import { padSlots } from '../../input/gamepad';
import { readDevice } from '../../session/devices';
import { MatchSession, countdownLabel, formatClock } from '../../session/match';
import { resolveMatch } from '../../session/setup';
import type { Flow, Screen, ScreenDef } from '../app';
import { calloutSvg } from '../art/callouts';
import { h, svg } from '../dom';
import { isDirection, type MenuEvent } from '../input';
import { Focus } from '../nav';
import './match.css';

/**
 * The seed Restart hands to the next match screen. Restart replays the same battle, like retrying in Ultimate: the
 * seed resolves Random fighters, costumes and stage exactly as before. Rematch and a new start draw a fresh seed, as
 * Ultimate re-rolls Random for every new battle.
 */
let restartSeed: number | null = null;

export const screen: ScreenDef = {
  route: 'match',
  needsGame: true,
  create: (flow) => {
    const seed = restartSeed ?? newSeed();
    restartSeed = null;
    return matchScreen(flow, flow.game!, seed);
  },
};

/** Frames the match keeps running after the deciding KO, before it freezes under GAME!. */
const FREEZE_AFTER = 40;
/** How long GAME! stays up before the results. */
const RESULTS_AFTER_MS = 2600;

const ANNOUNCE = { '3': 'three', '2': 'two', '1': 'one', 'GO!': 'go' } as const;

const ICONS = {
  resume: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="5"/><path d="M16 12 L28 20 L16 28 Z" fill="currentColor"/></svg>`,
  restart: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M31 20 A11 11 0 1 1 26 10.8" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M22 4 L32 10 L22 16 Z" fill="currentColor"/></svg>`,
  quit: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M18 6 H8 V34 H18" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M15 20 H30 M24 13 L31 20 L24 27" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

type PauseAction = keyof typeof ICONS;

/** A fresh seed per match (random fighters, stage, CPUs); it is saved in the match config, so replays stay exact. */
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;

/**
 * A match from the current setup: controllers and CPUs, the 3-2-1-GO! countdown, the clock,
 * a pause menu, and GAME! (or TIME!) before the results.
 */
export function matchScreen(flow: Flow, game: Game, seed = newSeed()): Screen {
  const setup = structuredClone(flow.setup);
  const match = resolveMatch(setup, seed, flow.settings.tapJump);
  const session = new MatchSession(match, setup.rules);

  const countdown = h('div', { class: 'callout-slot' });
  const finale = h('div', { class: 'callout-slot is-finale' });
  const clockMain = h('span', { class: 'clock-main' });
  const clockCs = h('span', { class: 'clock-cs' });
  const clock = h('div', { class: 'match-clock', hidden: setup.rules.minutes <= 0 }, clockMain, clockCs);

  const items = (Object.keys(ICONS) as PauseAction[]).map((act) =>
    h(
      'button',
      { class: 'pause-item', data: { nav: '', act }, on: { click: () => pauseAction(act) } },
      h('span', { class: 'pause-icon' }, svg(ICONS[act])),
      h('span', null, { resume: 'Resume', restart: 'Restart', quit: 'Quit' }[act]),
    ),
  );
  const panel = h(
    'div',
    { class: 'pause-panel' },
    items,
    h(
      'div',
      { class: 'pause-tip' },
      h('span', null, h('b', null, '↑↓'), ' Move'),
      h('span', null, h('b', null, 'F · A'), ' Select'),
      h('span', null, h('b', null, 'Esc · Start'), ' Resume'),
    ),
  );
  const pauseLayer = h(
    'div',
    { class: 'pause-layer', hidden: true },
    h('div', { class: 'pause-plate' }, 'PAUSE'),
    panel,
  );
  const focus = new Focus(panel);
  focus.hover();

  const el = h('div', { class: 'match-screen' }, countdown, finale, clock, pauseLayer);

  let shown: string | null = null;
  let paused = false;
  let finaleAt = -1;
  let unsubscribe = () => {};

  function pause(): void {
    if (paused || session.phase === 'over') return;
    paused = true;
    game.loop.stop();
    pauseLayer.hidden = false;
    focus.set(items[0]!);
    audio.ui('select');
  }

  function resume(): void {
    if (!paused) return;
    paused = false;
    game.loop.start();
    pauseLayer.hidden = true;
    audio.ui('back');
  }

  function pauseAction(act: PauseAction): void {
    if (act === 'resume') resume();
    else if (act === 'restart') {
      restartSeed = seed;
      flow.go('match');
    } else flow.go('css');
  }

  function toResults(): void {
    if (!session.result) return;
    flow.lastMatch = { result: session.result, setup };
    flow.go('results');
  }

  return {
    el,
    enter() {
      game.newMatch(match.config);
      game.renderer.matchHud.cpus = new Set(
        match.controllers.flatMap((c, port) => (c.kind === 'cpu' ? [port] : [])),
      );
      game.inputSource = () => {
        const pads = padSlots();
        return session.inputs(game.state, (device) => readDevice(device, game.keyboard, pads, flow.settings));
      };
      unsubscribe = game.onEvents((_, state) => {
        session.observe(state);
        if (session.phase === 'over' && state.frame >= session.overFrame + FREEZE_AFTER) {
          game.manual = true;
        }
      });
      game.manual = false;
      game.loop.start();
      audio.music(match.config.stage);
    },
    leave() {
      unsubscribe();
      game.loop.stop();
      game.inputSource = null;
      game.manual = false;
      game.renderer.matchHud.cpus = new Set();
    },
    input(e: MenuEvent) {
      if (paused) {
        if (isDirection(e.action)) focus.move(e.action);
        else if (e.action === 'confirm') focus.current?.click();
        else if (e.action === 'start' || e.action === 'back') resume();
        return;
      }
      if (e.action === 'start' || (e.device === 'keys' && e.action === 'back')) pause();
    },
    update(now) {
      const state = game.state;
      const label = session.phase === 'over' ? null : countdownLabel(state.frame);
      if (label !== shown) {
        shown = label;
        countdown.replaceChildren(
          ...(label ? [svg(calloutSvg(label, label === 'GO!' ? 'count' : 'steel'), 'callout')] : []),
        );
        countdown.dataset.label = label ?? '';
        if (label) audio.announce(ANNOUNCE[label]);
      }
      const left = session.timeLeft(state);
      if (left !== null) {
        const t = formatClock(left);
        clockMain.textContent = t.main;
        clockCs.textContent = t.hundredths;
        clock.classList.toggle('is-low', left <= 10 * 60);
      }
      if (session.phase === 'over' && finaleAt < 0) {
        finaleAt = now;
        finale.replaceChildren(
          h('div', { class: 'finale-streaks' }),
          svg(
            calloutSvg(
              session.reason === 'time' ? 'TIME!' : 'GAME!',
              session.reason === 'time' ? 'time' : 'game',
            ),
            'callout',
          ),
        );
        audio.announce(session.reason === 'time' ? 'time' : 'game');
      }
      if (finaleAt >= 0 && now - finaleAt >= RESULTS_AFTER_MS) toResults();
    },
  };
}
