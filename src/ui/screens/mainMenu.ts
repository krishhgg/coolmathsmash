import type { Flow, Route, Screen, ScreenDef } from '../app';
import { planetSvg } from '../art/logo';
import { h, svg } from '../dom';
import { isDirection } from '../input';
import { Focus } from '../nav';
import { backTab, footerHints, headerPlate } from '../widgets';
import './mainMenu.css';

interface Tile {
  route: Route;
  label: string;
  blurb: string;
  className: string;
  icon: string;
}

const CONTROLLER_ICON = `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg"><path d="M30 10 H90 C108 10 118 30 118 52 C118 70 108 78 98 74 L82 58 H38 L22 74 C12 78 2 70 2 52 C2 30 12 10 30 10 Z" fill="currentColor"/><g fill="#0d1a3a"><rect x="24" y="30" width="22" height="7" rx="2"/><rect x="31.5" y="22.5" width="7" height="22" rx="2"/><circle cx="84" cy="26" r="5"/><circle cx="96" cy="36" r="5"/><circle cx="72" cy="36" r="5"/><circle cx="84" cy="46" r="5"/></g></svg>`;
const GEAR_ICON = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M43 4h14l3 13 9 4 11-7 10 10-7 11 4 9 13 3v14l-13 3-4 9 7 11-10 10-11-7-9 4-3 13H43l-3-13-9-4-11 7-10-10 7-11-4-9-13-3V43l13-3 4-9-7-11 10-10 11 7 9-4z"/><circle cx="50" cy="50" r="17" fill="#0e3b1a"/></svg>`;

const TILES: Tile[] = [
  {
    route: 'css',
    label: 'Smash',
    blurb: 'Fight with up to four players: friends on keyboards and gamepads, or CPUs.',
    className: 'tile-smash',
    icon: planetSvg({ outline: '#3a0508' }),
  },
  {
    route: 'controls',
    label: 'Controls',
    blurb: 'See and rebind the keyboard and gamepad buttons. Saved on this computer.',
    className: 'tile-controls',
    icon: CONTROLLER_ICON,
  },
  {
    route: 'options',
    label: 'Options',
    blurb: 'Tap jump, volume and other settings.',
    className: 'tile-options',
    icon: GEAR_ICON,
  },
];

export const screen: ScreenDef = { route: 'main', create: mainMenuScreen };

/** Ultimate-style main menu: one big red Smash tile and two smaller ones, with a description bar. */
export function mainMenuScreen(flow: Flow): Screen {
  const blurb = h('div', { class: 'menu-blurb' });
  const tiles = TILES.map((t) =>
    h(
      'button',
      {
        class: `menu-tile ${t.className}`,
        data: { nav: '', route: t.route, blurb: t.blurb },
        disabled: !flow.has(t.route),
        on: { click: () => flow.go(t.route) },
      },
      h('span', { class: 'menu-tile-icon' }, svg(t.icon)),
      h('span', { class: 'menu-tile-label' }, t.label),
      flow.has(t.route) ? null : h('span', { class: 'menu-tile-soon' }, 'Coming soon'),
    ),
  );
  const el = h(
    'div',
    { class: 'main-menu bg-menu' },
    h('div', { class: 'bg-rays' }),
    backTab(() => flow.go('title')),
    headerPlate('Main Menu'),
    h('div', { class: 'menu-tiles' }, tiles),
    blurb,
    footerHints([
      ['Move', 'WASD / Arrows'],
      ['Select', 'F · J · Enter'],
      ['Back', 'G · K · Esc'],
    ]),
  );
  const focus = new Focus(el, (t) => (blurb.textContent = t.dataset.blurb ?? ''));
  focus.hover();
  focus.set(tiles[0]!);
  return {
    el,
    input(e) {
      if (isDirection(e.action)) focus.move(e.action);
      else if (e.action === 'confirm' || e.action === 'start') focus.current?.click();
      else if (e.action === 'back') flow.go('title');
    },
  };
}
