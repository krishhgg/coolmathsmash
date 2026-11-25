import { audio } from '../../audio';
import { stageIds } from '../../session/roster';
import { INFINITE_STOCKS } from '../../sim/constants';
import { RANDOM, STOCK_CHOICES, TIME_CHOICES, pickFighter, type Rules } from '../../session/setup';
import { getStage } from '../../stages/registry';
import type { Flow, Screen, ScreenDef } from '../app';
import { HAND_SVG } from '../art/icons';
import { planetSvg } from '../art/logo';
import { stageSvg } from '../art/stageArt';
import { h, svg } from '../dom';
import { isDirection } from '../input';
import { Focus } from '../nav';
import { backTab, footerHints } from '../widgets';
import { rulesSummary } from './characterSelect';
import './stageSelect.css';

type RuleKey = keyof Rules;

const PERSON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52"><circle cx="20" cy="12" r="10" fill="currentColor"/><path d="M4 52 C4 32 10 25 20 25 C30 25 36 32 36 52 Z" fill="currentColor"/></svg>`;
const CLOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="26" r="19" fill="currentColor"/><circle cx="24" cy="26" r="14" fill="#141a30"/><path d="M24 17 V27 L31 31" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="19" y="1" width="10" height="6" rx="2" fill="currentColor"/></svg>`;
const ITEM_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M24 3 L44 13 V35 L24 45 L4 35 V13 Z" fill="currentColor"/><path d="M4 13 L24 23 L44 13 M24 23 V45" fill="none" stroke="#141a30" stroke-width="3.5" stroke-linejoin="round"/><path d="M14 8 L34 18" stroke="#141a30" stroke-width="3.5"/></svg>`;

const RULE_ROWS: [key: RuleKey, label: string, icon: string][] = [
  ['stocks', 'Stock', PERSON_ICON],
  ['minutes', 'Time', CLOCK_ICON],
  ['items', 'Items', ITEM_ICON],
];

/** The entry `step` places from `value` in `choices`, wrapping round; an unknown value restarts at the first. */
export function stepChoice<T>(choices: readonly T[], value: T, step: number): T {
  const i = choices.indexOf(value);
  if (i < 0) return choices[0]!;
  return choices[(((i + step) % choices.length) + choices.length) % choices.length]!;
}

export function stepRule(rules: Rules, key: RuleKey, step: 1 | -1): void {
  if (key === 'items') rules.items = !rules.items;
  else rules[key] = stepChoice(key === 'stocks' ? STOCK_CHOICES : TIME_CHOICES, rules[key], step);
}

export function ruleText(rules: Rules, key: RuleKey): string {
  switch (key) {
    case 'stocks':
      return rules.stocks >= INFINITE_STOCKS ? 'Infinite' : String(rules.stocks);
    case 'minutes':
      return rules.minutes > 0 ? `${rules.minutes}:00` : 'No Limit';
    case 'items':
      return rules.items ? 'On' : 'Off';
  }
}

/**
 * The box the stage grid may fill in the right-hand column (see stageSelect.css): its width, the height left above
 * the rules, the frame padding and the gap between tiles. Tiles are at most a third of the preview's width, so the
 * preview always dominates.
 */
export const GRID_BOX = { width: 520, height: 340, pad: 8, gap: 6, maxTile: 240 };

/**
 * Columns, rows and tile width (16:9 tiles) for `n` choices: the largest tiles that fit GRID_BOX, preferring more
 * columns on a tie. Two choices sit side by side at full size; a hundred shrink into a dense wall.
 */
export function gridShape(n: number): { cols: number; rows: number; tile: number } {
  const { width, height, pad, gap, maxTile } = GRID_BOX;
  let best = { cols: 1, rows: n, tile: 0 };
  for (let cols = 1; cols <= Math.max(1, n); cols++) {
    const rows = Math.ceil(n / cols);
    const byWidth = (width - 2 * pad - (cols - 1) * gap) / cols;
    const byHeight = (((height - 2 * pad - (rows - 1) * gap) / rows) * 16) / 9;
    const tile = Math.floor(Math.min(maxTile, byWidth, byHeight));
    if (tile >= best.tile) best = { cols, rows, tile };
  }
  return best;
}

const stageName = (id: string) => (id === RANDOM ? 'Random' : getStage(id).name);

function stageArt(id: string): HTMLElement {
  if (id !== RANDOM) return h('span', { class: 'ss-art' }, svg(stageSvg(getStage(id))));
  return h(
    'span',
    { class: 'ss-art is-random' },
    h('span', { class: 'ss-random-rays' }),
    h('span', { class: 'ss-random-planet' }, svg(planetSvg({ glow: true }))),
  );
}

export const screen: ScreenDef = {
  route: 'stages',
  create: stageSelectScreen,
  presets: {
    /** Straight from a 1v1 character select: default rules (3 stock, 7:00, no items), Battlefield last picked. */
    default: ({ setup }) => {
      pickFighter(setup, 0, 'fireboy');
      setup.slots[1]!.level = 9;
    },
    /** Custom rules (2 stock, 5:00, items on) with Random as the last stage picked. */
    rules: ({ setup }) => {
      pickFighter(setup, 0, 'fireboy');
      Object.assign(setup.rules, { stocks: 2, minutes: 5, items: true });
      setup.stage = RANDOM;
    },
  },
};

/**
 * The stage select, after Ultimate's: the rules pill on top, a big clip-corner preview of the focused stage filling
 * the left, and on the right a grid of every registered stage (Random first) above the match rules. Left/right (or the
 * shoulder buttons) on a rule row change it; choosing a stage starts the match.
 */
export function stageSelectScreen(flow: Flow): Screen {
  const { setup } = flow;
  const ids = [RANDOM, ...stageIds()];
  const shape = gridShape(ids.length);

  const pillText = h('span', { class: 'ss-pill-text' });
  const itemsBadge = h('span', { class: 'ss-pill-badge' }, svg(ITEM_ICON), 'Items On');
  const preview = h('div', { class: 'ss-preview-art' });
  const previewName = h('div', { class: 'ss-preview-name' });
  const hand = h('div', { class: 'ss-hand' }, svg(HAND_SVG));
  const values = new Map<RuleKey, HTMLElement>();

  const choose = (id: string) => {
    setup.stage = id;
    if (flow.has('match')) flow.go('match');
    else audio.ui('error');
  };
  const change = (key: RuleKey, step: 1 | -1) => {
    stepRule(setup.rules, key, step);
    audio.ui('toggle');
    renderRules();
  };

  const tiles = ids.map((id) =>
    h(
      'button',
      {
        class: `ss-tile${id === RANDOM ? ' is-random' : ''}`,
        data: { nav: '', stage: id },
        on: { click: () => choose(id) },
      },
      stageArt(id),
      h('span', { class: 'ss-tile-name' }, stageName(id)),
    ),
  );
  const ruleRows = RULE_ROWS.map(([key, label, icon]) => {
    const value = h('span', { class: 'ss-rule-value' });
    values.set(key, value);
    const arrow = (step: 1 | -1) =>
      h('button', {
        class: `ss-arrow ${step < 0 ? 'is-left' : 'is-right'}`,
        title: step < 0 ? 'Previous' : 'Next',
        on: { click: () => change(key, step) },
      });
    return h(
      'div',
      { class: 'ss-rule', data: { nav: '', rule: key } },
      h('span', { class: 'ss-rule-icon' }, svg(icon)),
      h('span', { class: 'ss-rule-label' }, label),
      arrow(-1),
      value,
      arrow(1),
    );
  });

  const hints = (onRule: boolean) =>
    footerHints([
      ['Move', 'WASD / Arrows'],
      onRule ? ['Change rule', '◀ ▶'] : ['Choose stage', 'F · J · Enter'],
      ['Back', 'G · K · Esc'],
    ]);
  let footer = hints(false);
  let onRule = false;

  const el = h(
    'div',
    { class: 'ss-screen' },
    h('div', { class: 'ss-shard is-back' }),
    h('div', { class: 'ss-shard is-front' }),
    backTab(() => flow.go('css')),
    h('div', { class: 'ss-pill' }, svg(PERSON_ICON), pillText, itemsBadge),
    h('div', { class: 'ss-preview' }, h('div', { class: 'ss-preview-frame' }), preview, previewName),
    h(
      'div',
      { class: 'ss-side' },
      h(
        'div',
        { class: 'ss-board' },
        h('div', { class: 'ss-tab' }, svg(planetSvg()), h('span', null, 'Stages')),
        h('div', { class: 'ss-grid', style: `--cols: ${shape.cols}; --tile: ${shape.tile}px` }, tiles),
      ),
      h('div', { class: 'ss-rules' }, h('div', { class: 'ss-rules-title' }, 'Rules'), ruleRows),
    ),
    hand,
    footer,
  );

  function renderRules(): void {
    pillText.textContent = rulesSummary(setup);
    itemsBadge.hidden = !setup.rules.items;
    for (const [key, value] of values) value.textContent = ruleText(setup.rules, key);
  }

  function placeHand(): void {
    const target = focus.current;
    if (!target) return;
    const r = target.getBoundingClientRect();
    const root = el.getBoundingClientRect();
    const k = root.width / el.offsetWidth || 1;
    const rule = target.dataset.rule !== undefined;
    const x = (r.left - root.left + r.width * (rule ? 0.3 : 0.66)) / k;
    const y = (r.top - root.top + r.height * (rule ? 0.55 : 0.3)) / k;
    hand.style.transform = `translate(${x}px, ${y}px)`;
  }

  const focus = new Focus(el, (target) => {
    const id = target.dataset.stage;
    if (!id !== onRule) {
      onRule = !id;
      const next = hints(onRule);
      footer.replaceWith(next);
      footer = next;
    }
    if (id) {
      preview.replaceChildren(stageArt(id));
      previewName.textContent = stageName(id);
    }
    placeHand();
  });
  focus.hover();
  focus.set(tiles[Math.max(0, ids.indexOf(setup.stage))]!);
  renderRules();

  return {
    el,
    enter() {
      placeHand();
      requestAnimationFrame(() => hand.classList.add('is-live'));
    },
    input(e) {
      const rule = focus.current?.dataset.rule as RuleKey | undefined;
      if (rule && ['left', 'right', 'prev', 'next'].includes(e.action))
        return change(rule, e.action === 'left' || e.action === 'prev' ? -1 : 1);
      if (isDirection(e.action)) focus.move(e.action);
      else if (e.action === 'confirm' || e.action === 'start') {
        if (rule) change(rule, 1);
        else focus.current?.click();
      } else if (e.action === 'back') flow.go('css');
    },
  };
}
