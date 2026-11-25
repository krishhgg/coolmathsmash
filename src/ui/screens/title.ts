import type { Flow, Screen, ScreenDef } from '../app';
import { logoSvg, planetSvg } from '../art/logo';
import { SHORT_DISCLAIMER } from '../credits';
import { h, svg } from '../dom';
import './title.css';

export const screen: ScreenDef = { route: 'title', create: titleScreen };

/** Logo over a starry Coolmath sky; any button continues. */
export function titleScreen(flow: Flow): Screen {
  const el = h(
    'div',
    { class: 'title-screen bg-stage', on: { click: () => flow.go('main') } },
    h('div', { class: 'bg-rays' }),
    h('div', { class: 'title-planet' }, svg(planetSvg({ glow: true }))),
    h('div', { class: 'title-logo' }, svg(logoSvg())),
    h('div', { class: 'title-tagline' }, 'The Coolmath Games classics, in a Smash-style brawl'),
    h('div', { class: 'title-press' }, 'Press Start'),
    h('div', { class: 'title-keys' }, 'Enter · Space · any button'),
    h('div', { class: 'title-foot' }, SHORT_DISCLAIMER),
  );
  return {
    el,
    input: () => flow.go('main'),
  };
}
