import { audio } from '../../audio';
import { getFighter } from '../../fighters/registry';
import { COUNTDOWN_FRAMES, formatClock, type FinishedMatch, type PlayerResult } from '../../session/match';
import { fighterIcon, selectableFighterIds } from '../../session/roster';
import { defaultSetup, cpuSlot, humanSlot } from '../../session/setup';
import type { Flow, Screen, ScreenDef } from '../app';
import { SILHOUETTE_SVG } from '../art/icons';
import { placeSvg } from '../art/place';
import { h, svg } from '../dom';
import { isDirection } from '../input';
import { Focus } from '../nav';
import { footerHints } from '../widgets';
import './results.css';

type Phase = 'winner' | 'cards';

/** Lab presets open straight onto a phase. */
let openOn: Phase = 'winner';

/** A made-up finished match for the lab and captures. */
export function sampleMatch(players: number): FinishedMatch {
  const ids = selectableFighterIds();
  const setup = defaultSetup();
  setup.slots = Array.from({ length: players }, (_, i) =>
    i % 2 === 0 ? humanSlot(i === 0 ? 'kb1' : 'pad1') : cpuSlot(i === 1 ? 7 : 3),
  );
  const out = players > 2 ? [-1, 3410, 1220, 2900] : [-1, 1220];
  const place = [1, 2, 4, 3];
  const kos = players > 2 ? [4, 3, 0, 2] : [3, 1];
  return {
    setup,
    result: {
      reason: 'stock',
      frames: 4200,
      players: setup.slots.map((s, port) => ({
        port,
        fighter: ids[port % ids.length]!,
        costume: 'default',
        cpu: s.kind === 'cpu',
        place: place[port]!,
        stocks: port === 0 ? 2 : 0,
        damage: port === 0 ? 63.4 : 0,
        stats: {
          kos: kos[port]!,
          falls: port === 0 ? 1 : 3,
          sds: port === 3 ? 1 : 0,
          damageDealt: [212.6, 140.2, 75, 98.1][port]!,
          damageTaken: [88.4, 201.3, 160.7, 175][port]!,
          outFrame: out[port]! + (out[port]! >= 0 ? COUNTDOWN_FRAMES : 0),
        },
      })),
    },
  };
}

export const screen: ScreenDef = {
  route: 'results',
  create: resultsScreen,
  presets: {
    'winner-2p': (flow) => void ((flow.lastMatch = sampleMatch(2)), (openOn = 'winner')),
    'winner-4p': (flow) => void ((flow.lastMatch = sampleMatch(4)), (openOn = 'winner')),
    'cards-2p': (flow) => void ((flow.lastMatch = sampleMatch(2)), (openOn = 'cards')),
    'cards-4p': (flow) => void ((flow.lastMatch = sampleMatch(4)), (openOn = 'cards')),
  },
};

const name = (p: PlayerResult) => getFighter(p.fighter).name;
const portrait = (p: PlayerResult, className: string) =>
  h('div', { class: className }, svg(fighterIcon(p.fighter) ?? SILHOUETTE_SVG));
const portVar = (p: PlayerResult) => (p.cpu ? '--port:var(--cpu)' : `--port:var(--p${(p.port % 4) + 1})`);

/**
 * Ultimate's results: first the winner, big, with the others' placings below; then a card per player with when
 * they went out and their KOs, falls and self-destructs, and the way back to a rematch or the character select.
 */
export function resultsScreen(flow: Flow): Screen {
  const finished = flow.lastMatch ?? sampleMatch(2);
  let phase: Phase = openOn;
  openOn = 'winner';
  const players = finished.result.players;
  const byPlace = [...players].sort((a, b) => a.place - b.place || a.port - b.port);
  const winner = byPlace[0]!;
  const tie = byPlace.filter((p) => p.place === 1).length > 1;
  const tag = (p: PlayerResult) => {
    const slot = finished.setup.slots[p.port];
    return p.cpu ? `Level ${slot?.level ?? 1}` : `Player ${p.port + 1}`;
  };

  const winnerView = h(
    'div',
    { class: 'results-winner', style: portVar(winner) },
    h('div', { class: 'results-sky' }),
    h('div', { class: 'bg-rays' }),
    h('div', { class: 'winner-band' }),
    portrait(winner, 'winner-art'),
    h(
      'div',
      { class: 'winner-head' },
      h('div', { class: 'winner-flag' }, winner.cpu ? 'CPU' : `P${winner.port + 1}`),
      h('div', { class: 'winner-place' }, svg(placeSvg(1))),
    ),
    h(
      'div',
      {
        class: 'winner-name',
        style: `font-size:${Math.min(170, Math.floor(1150 / (tie ? 5 : name(winner).length)))}px`,
      },
      tie ? 'Draw!' : name(winner),
    ),
    h(
      'div',
      { class: 'winner-others' },
      byPlace
        .slice(1)
        .map((p) =>
          h(
            'div',
            { class: 'runner', style: portVar(p) },
            h('div', { class: 'runner-place' }, svg(placeSvg(p.place))),
            portrait(p, 'runner-art'),
            h('div', { class: 'runner-name' }, name(p)),
            h('div', { class: 'runner-tag' }, p.cpu ? 'CPU' : `P${p.port + 1}`),
          ),
        ),
    ),
    h('div', { class: 'results-continue' }, 'Press A · F · Enter'),
  );

  const stat = (label: string, value: string | number) =>
    h('div', { class: 'card-stat' }, h('span', null, label), h('b', null, value));
  const cards = players.map((p) =>
    h(
      'div',
      { class: 'result-card', style: portVar(p) },
      h(
        'div',
        { class: 'card-head' },
        h('div', { class: 'card-name', style: `--chars:${name(p).length}` }, name(p)),
        h('div', { class: 'card-place' }, svg(placeSvg(p.place))),
        h(
          'div',
          { class: 'card-who' },
          h('b', null, p.cpu ? 'CPU' : `P${p.port + 1}`),
          h('span', null, tag(p)),
        ),
      ),
      portrait(p, 'card-art'),
      h(
        'div',
        { class: 'card-out' },
        h('span', null, 'Out at'),
        h(
          'b',
          { class: p.stats.outFrame < 0 ? 'is-in' : '' },
          p.stats.outFrame < 0 ? '' : formatClock(p.stats.outFrame - COUNTDOWN_FRAMES).main,
        ),
      ),
      stat('KOs', p.stats.kos),
      stat('Falls', p.stats.falls ? -p.stats.falls : 0),
      stat('SDs', p.stats.sds ? -p.stats.sds : 0),
      stat('Damage dealt', `${Math.round(p.stats.damageDealt)}%`),
    ),
  );
  const buttons = (
    [
      ['Rematch', () => flow.go('match')],
      ['Change fighters', () => flow.go('css')],
      ['Main menu', () => flow.go('main')],
    ] as const
  ).map(([label, go]) =>
    h('button', { class: 'results-button', data: { nav: '' }, on: { click: go } }, label),
  );
  const cardsView = h(
    'div',
    { class: `results-cards is-${players.length}p` },
    h('div', { class: 'results-blur', 'aria-hidden': 'true' }, winnerView.cloneNode(true)),
    h('div', { class: 'cards-row' }, cards),
    h('div', { class: 'results-buttons' }, buttons),
    footerHints([
      ['Choose', 'F · J · Enter'],
      ['Character select', 'G · K · Esc'],
    ]),
  );

  const el = h('div', { class: 'results-screen', on: { click: () => phase === 'winner' && showCards() } });
  const focus = new Focus(cardsView);
  focus.hover();

  function show(): void {
    el.dataset.phase = phase;
    el.replaceChildren(phase === 'winner' ? winnerView : cardsView);
    if (phase === 'cards') focus.set(buttons[0]!);
  }

  function showCards(): void {
    phase = 'cards';
    audio.ui('select');
    show();
  }

  let enteredAt: number | null = null;
  let named = tie;
  show();
  return {
    el,
    enter() {
      audio.announce('winner-is');
    },
    update(now) {
      enteredAt ??= now;
      if (!named && now - enteredAt > 1100) {
        named = true;
        audio.announce(`fighter:${winner.fighter}`);
      }
    },
    input(e) {
      if (phase === 'winner') {
        if (e.action === 'confirm' || e.action === 'start') showCards();
        return;
      }
      if (isDirection(e.action)) focus.move(e.action);
      else if (e.action === 'confirm' || e.action === 'start') focus.current?.click();
      else if (e.action === 'back') flow.go('css');
    },
  };
}
