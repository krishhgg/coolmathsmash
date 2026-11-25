import { h } from './dom';

const BACK_ICON = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M26 12 L6 30 L26 48 V36 C40 36 50 40 56 52 C56 32 46 22 26 22 Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/></svg>`;

/** The red back tab in the top-left corner of every Ultimate menu. */
export function backTab(onClick: () => void): HTMLElement {
  const el = h('button', { class: 'back-tab', title: 'Back', on: { click: onClick } });
  el.innerHTML = BACK_ICON;
  return el;
}

/** The yellow angled title plate across the top. */
export function headerPlate(text: string): HTMLElement {
  return h('div', { class: 'header-plate' }, h('span', null, text));
}

/** Button hints along the bottom edge: [action, keys] pairs. */
export function footerHints(hints: [string, string][]): HTMLElement {
  return h(
    'div',
    { class: 'footer-hints' },
    hints.map(([action, keys]) => h('span', { class: 'hint' }, h('b', null, keys), ' ', action)),
  );
}
