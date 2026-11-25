import type { Flow, Screen, ScreenDef } from '../app';
import { CHARACTER_CREDITS, CREW_CREDITS, DISCLAIMER, OTHER_CREDITS } from '../credits';
import { h } from '../dom';
import { backTab, footerHints, headerPlate } from '../widgets';
import './credits.css';

export const screen: ScreenDef = { route: 'credits', create: creditsScreen };

const SCROLL_STEP = 90;

/** The disclaimer, who owns each character, and who made the game. Up/down scroll; back returns to the menu. */
export function creditsScreen(flow: Flow): Screen {
  const body = h(
    'div',
    { class: 'credits-body' },
    h(
      'section',
      { class: 'credits-card credits-disclaimer' },
      h('h2', null, 'Fan game'),
      DISCLAIMER.map((p) => h('p', null, p)),
    ),
    h(
      'section',
      { class: 'credits-card' },
      h('h2', null, 'Characters'),
      h(
        'table',
        { class: 'credits-table' },
        h(
          'thead',
          null,
          h('tr', null, h('th', null, 'Character'), h('th', null, 'From'), h('th', null, 'Rights holder')),
        ),
        h(
          'tbody',
          null,
          CHARACTER_CREDITS.map((c) =>
            h('tr', null, h('td', null, c.character), h('td', null, c.game), h('td', null, c.owner)),
          ),
          OTHER_CREDITS.map((c) => h('tr', null, h('td', { colspan: 2 }, c.what), h('td', null, c.owner))),
        ),
      ),
    ),
    h(
      'section',
      { class: 'credits-card' },
      h('h2', null, 'Made by'),
      CREW_CREDITS.map((c) =>
        h('div', { class: 'credits-crew' }, h('span', null, c.role), h('b', null, c.who)),
      ),
    ),
  );
  const el = h(
    'div',
    { class: 'credits-screen bg-menu' },
    h('div', { class: 'bg-rays' }),
    backTab(() => flow.go('main')),
    headerPlate('Credits'),
    body,
    footerHints([
      ['Scroll', 'W/S · ↑/↓'],
      ['Back', 'G · K · Esc'],
    ]),
  );
  return {
    el,
    input(e) {
      if (e.action === 'up' || e.action === 'down')
        body.scrollBy({ top: e.action === 'up' ? -SCROLL_STEP : SCROLL_STEP, behavior: 'smooth' });
      else if (e.action === 'back' || e.action === 'confirm' || e.action === 'start') flow.go('main');
    },
  };
}
