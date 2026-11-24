import { getFighter } from '../../fighters/registry';
import { DEVICES, deviceLabel, keyboardIndex, type DeviceId } from '../../session/devices';
import { costumeColors, fighterCostumes, fighterIcon, fighterIds } from '../../session/roster';
import {
  CPU_LEVELS,
  MAX_PLAYERS,
  RANDOM,
  cpuSlot,
  cycleCostume,
  humanSlot,
  isReady,
  pickFighter,
  type MatchSetup,
  type SlotSetup,
} from '../../session/setup';
import { audio } from '../../audio';
import type { Flow, Screen, ScreenDef } from '../app';
import { CPU_SVG, GAMEPAD_SVG, HAND_SVG, KEYBOARD_SVG, SILHOUETTE_SVG } from '../art/icons';
import { h, svg } from '../dom';
import { isDirection, type MenuDevice, type MenuEvent } from '../input';
import { navigable, neighbour } from '../nav';
import { backTab, footerHints, headerPlate } from '../widgets';
import './characterSelect.css';

/** A player's hand: where it points (a `data-key`) and the CPU token it carries, if any. */
interface Hand {
  key: string;
  carrying: number | null;
}

const slotLabel = (s: SlotSetup, i: number) => (s.kind === 'cpu' ? 'CPU' : `P${i + 1}`);

export function rulesSummary(setup: MatchSetup): string {
  const { stocks, minutes } = setup.rules;
  const stock = stocks >= 99 ? 'Infinite Stock' : `${stocks} Stock`;
  return minutes > 0 ? `${stock} · ${minutes}:00` : stock;
}

function portrait(fighter: string | null, className: string): HTMLElement {
  if (fighter === RANDOM) return h('span', { class: `${className} is-random` }, '?');
  const icon = fighter ? fighterIcon(fighter) : undefined;
  return h('span', { class: className }, svg(icon ?? SILHOUETTE_SVG));
}

export const screen: ScreenDef = {
  route: 'css',
  create: characterSelectScreen,
  presets: {
    /** 1v1: P1 picked Fireboy against a level 9 CPU on Random; Ready to fight shows. */
    '2p': ({ setup }) => {
      pickFighter(setup, 0, 'fireboy');
      setup.slots[1]!.level = 9;
    },
    /** P1 picked, P2 on a gamepad still choosing, two CPUs. */
    '4p': ({ setup }) => {
      setup.slots = [humanSlot('kb1'), humanSlot('pad1'), cpuSlot(5), cpuSlot(9)];
      pickFighter(setup, 0, 'fireboy');
      pickFighter(setup, 2, 'fireboy');
    },
  },
};

/**
 * The character select, after Ultimate's: a portrait grid read from the fighter registry (plus Random) over one panel
 * per player. Every human gets a hand cursor driven by their own controller; confirm on a portrait picks it, confirm
 * on a CPU panel picks up its token to choose for it, back puts a pick down again. A controller nobody owns joins by
 * pressing confirm. "Ready to fight" appears once every human has picked.
 */
export function characterSelectScreen(flow: Flow): Screen {
  const setup = flow.setup;
  const hands = new Map<number, Hand>();
  const mouse: Hand = { key: '', carrying: null };

  const grid = h('div', { class: 'css-grid' });
  const panels = h('div', { class: 'css-panels' });
  const cursors = h('div', { class: 'css-cursors' });
  const header = headerPlate('');
  const ready = h(
    'button',
    { class: 'css-ready', data: { nav: '', key: 'ready' } },
    h('span', { class: 'css-ready-text' }, 'Ready to fight'),
    h('span', { class: 'css-ready-hint' }, 'Enter · Start'),
  );
  const el = h(
    'div',
    { class: 'css-screen bg-menu' },
    backTab(() => flow.go('main')),
    header,
    grid,
    panels,
    ready,
    cursors,
    footerHints([
      ['Pick', 'F · J · A'],
      ['Undo', 'G · K · B'],
      ['Costume', 'R/T · U/I · L/R'],
      ['Join', 'press a button'],
    ]),
  );

  const ids = fighterIds();
  const tiles = [...ids, RANDOM].map((id) =>
    h(
      'button',
      { class: 'css-tile', data: { nav: '', key: `tile:${id}` } },
      portrait(id, 'css-tile-art'),
      h('span', { class: 'css-tile-name' }, id === RANDOM ? 'Random' : getFighter(id).name),
    ),
  );
  const cols = Math.min(8, Math.max(4, Math.ceil(tiles.length / 2)));
  grid.style.setProperty('--cols', String(Math.min(cols, tiles.length)));
  grid.append(...tiles);

  const humanOf = (device: MenuDevice) =>
    setup.slots.findIndex((s) => s.kind === 'human' && s.device === device);
  /** The slot the mouse and the keyboard-wide keys act for: the first human on a keyboard, else the first human. */
  const mouseSlot = () => {
    const kb = setup.slots.findIndex(
      (s) => s.kind === 'human' && s.device !== null && keyboardIndex(s.device) >= 0,
    );
    return kb >= 0 ? kb : setup.slots.findIndex((s) => s.kind === 'human');
  };
  const freeDevices = (except = -1) =>
    DEVICES.filter((d) => !setup.slots.some((s, i) => i !== except && s.kind === 'human' && s.device === d));
  const canEdit = (actor: number, slot: number) => actor === slot || setup.slots[slot]?.kind === 'cpu';
  const find = (key: string) => el.querySelector<HTMLElement>(`[data-key="${key}"]`);
  const tileKey = (s: SlotSetup) => `tile:${s.fighter ?? ids[0] ?? RANDOM}`;

  function syncHands(): void {
    const humans = new Set<number>();
    setup.slots.forEach((s, i) => {
      if (s.kind !== 'human') return;
      humans.add(i);
      if (!hands.has(i)) hands.set(i, { key: tileKey(s), carrying: null });
    });
    for (const i of [...hands.keys()]) if (!humans.has(i)) hands.delete(i);
    for (const hand of [...hands.values(), mouse])
      if (hand.carrying !== null && setup.slots[hand.carrying]?.kind !== 'cpu') hand.carrying = null;
  }

  /** Remove a slot and shift every hand and carried token pointing past it. */
  function removeSlot(i: number): void {
    setup.slots.splice(i, 1);
    const moved = [...hands.entries()];
    hands.clear();
    for (const [slot, hand] of moved) {
      if (slot === i) continue;
      if (hand.carrying !== null)
        hand.carrying = hand.carrying === i ? null : hand.carrying - +(hand.carrying > i);
      hand.key = hand.key.replace(/^panel:(\d+)/, (_, n: string) => `panel:${Number(n) - +(Number(n) > i)}`);
      hands.set(slot - +(slot > i), hand);
    }
    if (mouse.carrying !== null)
      mouse.carrying = mouse.carrying === i ? null : mouse.carrying - +(mouse.carrying > i);
  }

  function start(): void {
    if (isReady(setup)) flow.go('stages');
    else audio.ui('error');
  }

  function join(device: DeviceId): void {
    if (setup.slots.length < MAX_PLAYERS) setup.slots.push(humanSlot(device));
    else {
      const cpu = setup.slots.findIndex((s) => s.kind === 'cpu');
      if (cpu < 0) return audio.ui('error');
      setup.slots[cpu] = humanSlot(device);
    }
    audio.ui('select');
    render();
  }

  /** Do what the element under `key` does, for `actor` (a slot index, or -1 for nobody) holding `hand`. */
  function activate(key: string, actor: number, hand: Hand): void {
    const [kind, a, b] = key.split(':');
    if (kind === 'ready') return start();
    if (kind === 'add') {
      if (setup.slots.length >= MAX_PLAYERS) return audio.ui('error');
      setup.slots.push(cpuSlot());
      audio.ui('toggle');
      return render();
    }
    if (kind === 'tile') {
      const target = hand.carrying ?? actor;
      if (target < 0 || !setup.slots[target]) return;
      pickFighter(setup, target, a!);
      hand.carrying = null;
      audio.ui('select');
      if (a !== RANDOM) audio.announce(`fighter:${a}`);
      return render();
    }
    if (kind !== 'panel') return;
    const slot = Number(a);
    const s = setup.slots[slot];
    if (!s || (!canEdit(actor, slot) && !(actor < 0 && s.kind === 'cpu'))) return;
    switch (b) {
      case 'type':
        if (s.kind === 'human')
          setup.slots[slot] = { ...cpuSlot(s.level), fighter: s.fighter ?? RANDOM, costume: s.costume };
        else {
          const device = freeDevices(slot)[0];
          if (!device) return;
          setup.slots[slot] = {
            ...humanSlot(device),
            fighter: s.fighter === RANDOM ? null : s.fighter,
            costume: s.costume,
          };
        }
        break;
      case 'remove':
        removeSlot(slot);
        break;
      case 'down':
        s.level = Math.max(1, s.level - 1);
        break;
      case 'up':
        s.level = Math.min(CPU_LEVELS, s.level + 1);
        break;
      case 'device': {
        const free = freeDevices(slot);
        s.device = free[(free.indexOf(s.device!) + 1) % free.length] ?? s.device;
        break;
      }
      case 'prev':
      case 'next':
        cycleCostume(setup, slot, b === 'next' ? 1 : -1);
        break;
      case 'token':
        if (s.kind === 'cpu') hand.carrying = hand.carrying === slot ? null : slot;
        break;
    }
    audio.ui(b === 'remove' ? 'back' : b === 'token' ? 'select' : 'toggle');
    render();
  }

  function input(e: MenuEvent): void {
    if (e.device === 'keys') {
      if (e.action === 'start') start();
      else if (e.action === 'back') flow.go('main');
      else if (e.action === 'confirm') {
        const slot = mouseSlot();
        const hand = hands.get(slot);
        if (hand) activate(hand.key, slot, hand);
      }
      return;
    }
    const slot = humanOf(e.device);
    if (slot < 0) {
      if (e.action === 'confirm' || e.action === 'start') join(e.device);
      return;
    }
    const hand = hands.get(slot)!;
    const s = setup.slots[slot]!;
    if (isDirection(e.action)) {
      const from = find(hand.key) ?? tiles[0]!;
      const next = neighbour(from, e.action, navigable(el), el);
      if (next?.dataset.key) {
        hand.key = next.dataset.key;
        audio.ui('move');
      }
      return placeCursors();
    }
    switch (e.action) {
      case 'confirm':
        return activate(hand.key, slot, hand);
      case 'start':
        return start();
      case 'back':
        if (hand.carrying !== null) hand.carrying = null;
        else if (s.fighter !== null) {
          hand.key = tileKey(s);
          s.fighter = null;
        } else return;
        audio.ui('back');
        return render();
      case 'prev':
      case 'next':
        cycleCostume(setup, slot, e.action === 'next' ? 1 : -1);
        audio.ui('toggle');
        return render();
    }
  }

  function panel(s: SlotSetup, i: number): HTMLElement {
    const label = slotLabel(s, i);
    const name =
      s.fighter === null
        ? s.kind === 'cpu'
          ? 'Random'
          : 'Choose'
        : s.fighter === RANDOM
          ? 'Random'
          : getFighter(s.fighter).name;
    const costumes = s.fighter && s.fighter !== RANDOM ? fighterCostumes(s.fighter) : [];
    const btn = (key: string, cls: string, ...children: (Node | string)[]) =>
      h('button', { class: cls, data: { nav: '', key: `panel:${i}:${key}` } }, ...children);
    return h(
      'div',
      { class: `css-panel is-${s.kind} port-${i + 1}`, style: `--port: var(--p${i + 1})` },
      h('div', { class: 'css-panel-bg' }),
      s.kind === 'cpu'
        ? btn(
            'token',
            'css-panel-art',
            portrait(s.fighter, 'css-panel-portrait'),
            h('span', { class: 'css-token-hint' }, 'Choose for CPU'),
          )
        : h('div', { class: 'css-panel-art' }, portrait(s.fighter, 'css-panel-portrait')),
      h(
        'div',
        { class: 'css-panel-top' },
        btn('type', 'css-type', s.kind === 'cpu' ? 'CPU' : 'Player'),
        btn('remove', 'css-remove', '✕'),
      ),
      s.kind === 'cpu'
        ? h(
            'div',
            { class: 'css-level' },
            h('span', { class: 'css-level-label' }, 'CPU Lv.'),
            btn('down', 'css-step', '−'),
            h('span', { class: 'css-level-value' }, String(s.level)),
            btn('up', 'css-step', '+'),
          )
        : btn(
            'device',
            'css-device',
            svg(s.device && keyboardIndex(s.device) >= 0 ? KEYBOARD_SVG : GAMEPAD_SVG),
            s.device ? deviceLabel(s.device) : 'No controller',
          ),
      costumes.length > 1
        ? h(
            'div',
            { class: 'css-costumes' },
            btn('prev', 'css-step', '‹'),
            costumes.map((c) =>
              h('span', {
                class: `css-swatch${c === s.costume ? ' is-on' : ''}`,
                style: `--a: ${costumeColors(s.fighter!, c)[0] ?? '#888'}; --b: ${costumeColors(s.fighter!, c)[1] ?? '#444'}`,
              }),
            ),
            btn('next', 'css-step', '›'),
          )
        : null,
      h('div', { class: 'css-name' }, name),
      h(
        'div',
        { class: 'css-plate' },
        h(
          'span',
          { class: 'css-plate-icon' },
          svg(
            s.kind === 'cpu'
              ? CPU_SVG
              : s.device && keyboardIndex(s.device) >= 0
                ? KEYBOARD_SVG
                : GAMEPAD_SVG,
          ),
        ),
        h('span', { class: 'css-plate-label' }, label),
      ),
    );
  }

  function coin(s: SlotSetup, i: number): HTMLElement {
    return h('div', { class: `css-coin is-${s.kind}`, style: `--port: var(--p${i + 1})` }, slotLabel(s, i));
  }

  /** Where an element sits in the screen's 1280x720 space. */
  function box(target: HTMLElement): { x: number; y: number; w: number; h: number } {
    const r = target.getBoundingClientRect();
    const root = el.getBoundingClientRect();
    const k = root.width / el.offsetWidth || 1;
    return { x: (r.left - root.left) / k, y: (r.top - root.top) / k, w: r.width / k, h: r.height / k };
  }

  function placeCursors(): void {
    cursors.replaceChildren();
    for (const t of el.querySelectorAll('.is-pointed')) t.classList.remove('is-pointed');
    const stacks = new Map<string, number>();
    setup.slots.forEach((s, i) => {
      if (s.fighter === null || [...hands.values(), mouse].some((hd) => hd.carrying === i)) return;
      const tile = find(tileKey(s));
      if (!tile) return;
      const n = stacks.get(tileKey(s)) ?? 0;
      stacks.set(tileKey(s), n + 1);
      const b = box(tile);
      const c = coin(s, i);
      c.style.transform = `translate(${b.x + 8 + n * 30}px, ${b.y + b.h * 0.42}px)`;
      cursors.append(c);
    });
    const pointing = new Map<string, number>();
    for (const [slot, hand] of hands) {
      const target = find(hand.key) ?? tiles[0]!;
      hand.key = target.dataset.key!;
      target.classList.add('is-pointed');
      const n = pointing.get(hand.key) ?? 0;
      pointing.set(hand.key, n + 1);
      const b = box(target);
      b.x += n * 26;
      b.y += n * 14;
      const glove = h(
        'div',
        { class: 'css-hand', style: `--port: var(--p${slot + 1})` },
        svg(HAND_SVG),
        h('span', null, `P${slot + 1}`),
      );
      glove.style.transform = `translate(${b.x + b.w * 0.55}px, ${b.y + b.h * 0.5}px)`;
      if (hand.carrying !== null) glove.append(coin(setup.slots[hand.carrying]!, hand.carrying));
      cursors.append(glove);
    }
  }

  function render(): void {
    syncHands();
    header.querySelector('span')!.textContent = rulesSummary(setup);
    panels.replaceChildren(
      ...setup.slots.map(panel),
      setup.slots.length < MAX_PLAYERS
        ? h(
            'button',
            { class: 'css-add', data: { nav: '', key: 'add' }, title: 'Add a CPU' },
            h('b', null, '+'),
            'CPU',
          )
        : '',
    );
    panels.style.setProperty('--panels', String(Math.max(2, setup.slots.length)));
    ready.hidden = !isReady(setup);
    placeCursors();
  }

  el.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
    if (!target || !el.contains(target)) return;
    const slot = mouseSlot();
    activate(target.dataset.key!, slot, hands.get(slot) ?? mouse);
  });

  return {
    el,
    input,
    enter: () => {
      render();
      requestAnimationFrame(placeCursors);
    },
  };
}
