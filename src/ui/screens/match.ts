import type { Game } from '../../game';
import { DEFAULT_MATCH } from '../../sim/match';
import type { Flow, Screen, ScreenDef } from '../app';
import { h } from '../dom';

export const screen: ScreenDef = {
  route: 'stages',
  needsGame: true,
  create: (flow) => matchScreen(flow, flow.game!),
};

/** Stand-in until the stage select and match session land: the default match; Esc returns to the menu. */
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
