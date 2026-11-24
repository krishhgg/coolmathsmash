import type { Game } from '../../game';
import { DEFAULT_MATCH } from '../../sim/match';
import type { Flow, Screen } from '../app';
import { h } from '../dom';

/** The running match under a transparent overlay; Esc returns to the menu. */
export function matchScreen(flow: Flow, game: Game): Screen {
  return {
    el: h('div', { class: 'match-overlay' }),
    enter() {
      game.newMatch(DEFAULT_MATCH);
      game.manual = false;
      game.loop.start();
    },
    leave() {
      game.loop.stop();
    },
    input(e) {
      if (e.device === 'keys' && e.action === 'back') flow.go('main');
    },
  };
}
