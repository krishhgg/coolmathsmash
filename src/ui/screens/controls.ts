import { audio } from '../../audio';
import { padSlots } from '../../input/gamepad';
import { BUTTON_NAMES, type ButtonName } from '../../input/types';
import {
  ACTION_LABELS,
  CONTROL_ACTIONS,
  DPAD_BUTTONS,
  bindButton,
  bindKey,
  boundKeys,
  isMoveAction,
  keyLabel,
  menuKeyConflict,
  padButtonLabel,
  padMenuConflict,
  padButtonLabels,
  resetKeyboard,
  type ControlAction,
  type Taken,
} from '../../session/controls';
import { padDevice } from '../../session/devices';
import { defaultSettings } from '../../session/settings';
import type { Flow, Screen, ScreenDef } from '../app';
import { controllerSvg, type PadTags } from '../art/controller';
import { planetSvg } from '../art/logo';
import { GAMEPAD_SVG, KEYBOARD_SVG, RESET_SVG } from '../art/icons';
import { KEYBOARD_KEYS, KEYBOARD_SIZE, capLabel } from '../art/keyboard';
import { h, svg } from '../dom';
import { isDirection } from '../input';
import { Focus } from '../nav';
import { backTab, footerHints, headerPlate } from '../widgets';
import './controls.css';

type Tab = 'kb1' | 'kb2' | 'pad';

const TABS: { id: Tab; label: string; icon: string; color: string }[] = [
  { id: 'kb1', label: 'Keyboard 1', icon: KEYBOARD_SVG, color: 'var(--p1)' },
  { id: 'kb2', label: 'Keyboard 2', icon: KEYBOARD_SVG, color: 'var(--p2)' },
  { id: 'pad', label: 'Gamepad', icon: GAMEPAD_SVG, color: 'var(--cm-green)' },
];

/** The tab the screen opens on: the last one used, or the one a lab preset picked. */
let openTab: Tab = 'kb1';

/** A capture with no key or button pressed gives up after this long. */
const CAPTURE_MS = 6000;

const ABOUT: Record<ControlAction, string> = {
  up: 'Aims up tilts, up smashes and up specials. With tap jump on, flicking up jumps.',
  down: 'Crouch, drop through platforms and fast-fall. Aims down attacks and down specials.',
  left: 'Walk, dash and turn around. Aims side attacks and side specials.',
  right: 'Walk, dash and turn around. Aims side attacks and side specials.',
  walk: 'Hold with a direction to move at half tilt: walk instead of dash, tilt instead of smash.',
  attack: 'Jabs, tilts, smash attacks and aerials. Hold a smash attack to charge it.',
  special: 'Special moves: neutral, side, down and up, your recovery.',
  jump: 'Jump, then jump again in the air. Tap it for a short hop.',
  shield: 'Hold to shield. It shrinks the longer you hold it.',
  grab: 'Grab a fighter up close, then throw them with a direction.',
  taunt: 'Show off.',
  start: 'Pause the match.',
};

/** The gamepad's fixed direction rows. */
const STICK: Partial<Record<ControlAction, string>> = {
  up: 'L-Stick ↑',
  down: 'L-Stick ↓',
  left: 'L-Stick ←',
  right: 'L-Stick →',
};

const PAD_MOVE_ABOUT =
  'The left stick always moves, so it cannot be rebound. The right stick does smash attacks.';

const ARROW = '<path d="M12 3 L21 13 H15.5 V21 H8.5 V13 H3 Z"/>';
const ICONS: Record<ControlAction, string> = {
  up: ARROW,
  down: ARROW,
  left: ARROW,
  right: ARROW,
  walk: '<ellipse cx="8" cy="8.5" rx="3.4" ry="5.2"/><ellipse cx="16" cy="15.5" rx="3.4" ry="5.2"/>',
  attack:
    '<path d="M12 1 L14.6 7.8 L22 6 L17.2 12 L22 18 L14.6 16.2 L12 23 L9.4 16.2 L2 18 L6.8 12 L2 6 L9.4 7.8 Z"/>',
  special: '<path d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z"/>',
  jump: '<path d="M4 12 L12 4 L20 12 M4 20 L12 12 L20 20" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>',
  shield:
    '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M8 10 Q9.5 6.8 13 6.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  grab: '<path d="M5 11 V6.5 a1.6 1.6 0 0 1 3.2 0 V10 V4.5 a1.6 1.6 0 0 1 3.2 0 V10 V5.5 a1.6 1.6 0 0 1 3.2 0 V11 V8 a1.6 1.6 0 0 1 3.2 0 V14 C17.8 19 15 22 11 22 C7.5 22 5.6 19.6 4.4 17 L2.3 12.6 a1.6 1.6 0 0 1 2.7 -1.6 Z"/>',
  taunt:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="8.8" cy="9.6" r="1.7"/><circle cx="15.2" cy="9.6" r="1.7"/><path d="M7.5 13.8 Q12 19 16.5 13.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  start:
    '<rect x="5.5" y="4" width="4.6" height="16" rx="1.2"/><rect x="13.9" y="4" width="4.6" height="16" rx="1.2"/>',
};
const LOCK =
  '<path d="M7 10 V7.5 a5 5 0 0 1 10 0 V10" fill="none" stroke="currentColor" stroke-width="2.6"/><rect x="4.5" y="10" width="15" height="11" rx="2.5"/>';

const icon = (markup: string, className = 'ctl-icon') =>
  svg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${markup}</svg>`,
    className,
  );

const FACE_COLORS: Record<string, string> = {
  A: 'var(--cm-green)',
  B: 'var(--cm-red)',
  X: 'var(--cm-blue)',
  Y: 'var(--p3)',
};

function keyChip(code: string): HTMLElement {
  return h('span', { class: 'chip chip-key' }, keyLabel(code));
}

function padChip(label: string): HTMLElement {
  const face = FACE_COLORS[label];
  return face
    ? h('span', { class: 'chip chip-face', style: `--face: ${face}` }, label)
    : h('span', { class: 'chip chip-pad' }, label);
}

const unbound = () => h('span', { class: 'chip chip-none' }, 'Not set');

/** "W moved here from Up" after a rebind took a key off other actions; nothing when it took none. */
function takenNotice(what: string, from: string[]): string {
  return from.length ? `${what} moved here from ${from.join(', ')}` : '';
}

export const screen: ScreenDef = {
  route: 'controls',
  create: controlsScreen,
  presets: {
    /** Keyboard 1's bindings (the default tab). */
    keyboard1: () => void (openTab = 'kb1'),
    /** The shared gamepad mapping on the controller picture. */
    gamepad: () => void (openTab = 'pad'),
  },
};

/**
 * Controls: one tab per keyboard half and one for gamepads (every pad shares a mapping). Each row is an action and its
 * keys; confirm on a row listens for the next key (or pad button) and makes it that action's only binding, taking it
 * off any other action. The selected action lights up on a keyboard or controller picture beside the list.
 */
export function controlsScreen(flow: Flow): Screen {
  let tab: Tab = openTab;
  let selected: ControlAction | 'reset' = 'up';
  let notice = '';
  /** Listening for a key or button for `action`; `pads` is which pad buttons were already down when it began. */
  let capture: { action: ControlAction; until: number; pads: boolean[][] } | null = null;
  /** A pad button just bound or refused: menu input waits for its release, so the same press never also works the menu. */
  let held: { slot: number; button: number } | null = null;
  let padStatus = '';

  const kbIndex = () => (tab === 'kb2' ? 1 : 0);
  const settings = flow.settings;
  const actions = () => CONTROL_ACTIONS.filter((a) => tab !== 'pad' || a !== 'walk');
  const isLocked = (a: ControlAction) => tab === 'pad' && isMoveAction(a);
  const padButtons = (a: ControlAction): number[] => (isMoveAction(a) ? [] : settings.gamepad[a]);

  const tabs = TABS.map((t) =>
    h(
      'button',
      {
        class: 'ctl-tab',
        style: `--tab: ${t.color}`,
        data: { nav: '', key: `tab:${t.id}`, tab: t.id, navDown: '.ctl-row' },
        on: { click: () => setTab(t.id) },
      },
      svg(t.icon),
      h('span', null, t.label),
    ),
  );
  const list = h('div', { class: 'ctl-list' });
  const side = h('div', { class: 'ctl-side' });
  const footer = h('div', { class: 'ctl-footer' });
  const el = h(
    'div',
    { class: 'controls-screen bg-menu', on: { mousedown: (e) => e.preventDefault() } },
    h('div', { class: 'bg-rays' }),
    backTab(() => flow.go('main')),
    headerPlate('Controls'),
    h('div', { class: 'ctl-tabs' }, tabs),
    list,
    side,
    footer,
  );
  el.addEventListener(
    'click',
    (e) => {
      if (!capture) return;
      e.stopPropagation();
      endCapture();
    },
    true,
  );

  const focus = new Focus(el, (f) => {
    const key = f.dataset.key ?? '';
    // A pointer passing over a tab mid-capture must not switch the keyboard the capture is binding.
    if (f.dataset.tab) return capture ? undefined : setTab(f.dataset.tab as Tab);
    if (key === 'reset' || (CONTROL_ACTIONS as readonly string[]).includes(key)) {
      selected = key as ControlAction | 'reset';
      renderSide();
    }
  });
  focus.hover();

  function chips(a: ControlAction): HTMLElement[] {
    if (tab === 'pad') {
      const stick = STICK[a];
      if (stick) return [h('span', { class: 'chip chip-fixed' }, icon(LOCK, 'chip-lock'), stick)];
      const labels = padButtonLabels(padButtons(a));
      return labels.length ? labels.map(padChip) : [unbound()];
    }
    const keys = boundKeys(settings.keyboard[kbIndex()]!, a);
    return keys.length ? keys.map(keyChip) : [unbound()];
  }

  function row(a: ControlAction): HTMLElement {
    const capturing = capture?.action === a;
    return h(
      'button',
      {
        class: `ctl-row dir-${a}${capturing ? ' is-capturing' : ''}${isLocked(a) ? ' is-locked' : ''}`,
        data: { nav: '', key: a, navLeft: '', navRight: '' },
        on: { click: () => activate(a) },
      },
      icon(ICONS[a]),
      h('span', { class: 'ctl-row-label' }, ACTION_LABELS[a]),
      h(
        'span',
        { class: 'ctl-row-keys' },
        capturing
          ? h('span', { class: 'ctl-listen' }, tab === 'pad' ? 'Press a button…' : 'Press a key…')
          : chips(a),
      ),
    );
  }

  function renderList(): void {
    const all = actions();
    const moves = all.filter(isMoveAction).length;
    const rows = all.map(row);
    rows[0]!.dataset.navUp = '.ctl-tab.is-active';
    list.replaceChildren(
      h('div', { class: 'ctl-section' }, tab === 'pad' ? 'Move · left stick' : 'Move'),
      ...rows.slice(0, moves),
      h('div', { class: 'ctl-section' }, 'Buttons'),
      ...rows.slice(moves),
      h(
        'button',
        {
          class: 'ctl-reset',
          data: { nav: '', key: 'reset', navLeft: '', navRight: '' },
          on: { click: () => activate('reset') },
        },
        svg(RESET_SVG, 'ctl-icon'),
        `Reset ${TABS.find((t) => t.id === tab)!.label} to defaults`,
      ),
    );
  }

  function keyboardPicture(): HTMLElement {
    const mine = settings.keyboard[kbIndex()]!;
    const other = settings.keyboard[1 - kbIndex()]!;
    const all = (b: typeof mine) => CONTROL_ACTIONS.flatMap((a) => boundKeys(b, a));
    const lit = selected === 'reset' ? [] : boundKeys(mine, selected);
    const mineKeys = all(mine);
    const otherKeys = all(other);
    const keys = KEYBOARD_KEYS.map((k) => {
      const label = capLabel(k.code);
      const cls = [
        'kb-key',
        label.length > 2 ? 'is-small' : '',
        mineKeys.includes(k.code) ? 'is-mine' : otherKeys.includes(k.code) ? 'is-other' : '',
        lit.includes(k.code) ? 'is-lit' : '',
      ];
      return h(
        'span',
        {
          class: cls.filter(Boolean).join(' '),
          style: `--x: ${k.x}; --y: ${k.y}; --w: ${k.w}; --h: ${k.h}`,
          data: { code: k.code },
        },
        label,
      );
    });
    const otherTab = TABS[1 - kbIndex()]!;
    return h(
      'div',
      { class: 'ctl-picture' },
      h(
        'div',
        {
          class: 'kb',
          style: `--cols: ${KEYBOARD_SIZE.w}; --rows: ${KEYBOARD_SIZE.h}; --other: ${otherTab.color}`,
        },
        keys,
      ),
      h(
        'div',
        { class: 'ctl-legend' },
        h('span', { class: 'legend-mine' }, TABS[kbIndex()]!.label),
        h('span', { class: 'legend-other', style: `--other: ${otherTab.color}` }, otherTab.label),
        h('span', { class: 'legend-lit' }, 'Selected'),
      ),
    );
  }

  function padPicture(): HTMLElement {
    const tags: PadTags = {};
    const add = (button: number, text: string) => {
      tags[button] = tags[button] ? `${tags[button]} · ${text}` : text;
    };
    add(10, 'Move');
    add(11, 'Smash');
    for (const name of BUTTON_NAMES) {
      for (const b of settings.gamepad[name]) {
        if (DPAD_BUTTONS.includes(b)) {
          if (!tags[-1]?.split(' · ').includes(ACTION_LABELS[name])) add(-1, ACTION_LABELS[name]);
        } else add(b, ACTION_LABELS[name]);
      }
    }
    const lit = selected === 'reset' ? [] : isMoveAction(selected) ? [10] : padButtons(selected);
    return h('div', { class: 'ctl-picture is-pad' }, svg(controllerSvg(tags, lit), 'pad'));
  }

  function renderSide(): void {
    const t = TABS.find((x) => x.id === tab)!;
    const action = capture?.action ?? selected;
    const name = action === 'reset' ? 'Reset' : ACTION_LABELS[action];
    const about =
      action === 'reset'
        ? `Put every ${t.label} binding back the way it started.`
        : isLocked(action)
          ? PAD_MOVE_ABOUT
          : ABOUT[action];
    let bound: (HTMLElement | null)[];
    if (capture) {
      bound = [
        h('span', { class: 'ctl-listen is-big' }, tab === 'pad' ? 'Press a button…' : 'Press a key…'),
        h('span', { class: 'ctl-cancel' }, h('b', null, 'Esc'), ' Cancel'),
        h('span', { class: 'ctl-timer', style: `--ms: ${CAPTURE_MS}ms` }),
      ];
    } else if (action === 'reset') {
      bound = [];
    } else {
      bound = chips(action);
    }
    side.replaceChildren(
      h(
        'div',
        { class: `ctl-callout${capture ? ' is-capturing' : ''}` },
        h('div', { class: 'ctl-callout-art' }, svg(planetSvg())),
        h('div', { class: 'ctl-device' }, svg(t.icon), t.label),
        tab === 'pad' ? h('div', { class: 'ctl-pad-status' }, padStatus) : null,
        h('div', { class: 'ctl-name' }, name),
        h('div', { class: 'ctl-about' }, about),
        h('div', { class: 'ctl-bound' }, bound),
        notice ? h('div', { class: 'ctl-notice' }, notice) : null,
      ),
      tab === 'pad' ? padPicture() : keyboardPicture(),
    );
  }

  function renderFooter(): void {
    const kb = settings.keyboard;
    const first = (a: ControlAction) =>
      kb.map((b) => boundKeys(b, a)[0]).flatMap((c) => (c ? [keyLabel(c)] : []));
    const dirs = kb
      .map((b) =>
        (['up', 'left', 'down', 'right'] as const)
          .flatMap((a) => boundKeys(b, a).slice(0, 1).map(keyLabel))
          .join(''),
      )
      .filter(Boolean);
    const pair = (a: ControlAction, b: ControlAction) =>
      kb.map((x) => [boundKeys(x, a)[0], boundKeys(x, b)[0]].map((c) => (c ? keyLabel(c) : '–')).join('/'));
    footer.replaceChildren(
      footerHints([
        ['Move', dirs.join(' / ')],
        ['Rebind', [...first('attack'), 'Enter'].join(' · ')],
        ['Tab', [...pair('shield', 'grab'), 'L/R'].join(' · ')],
        ['Back', [...first('special'), 'Esc'].join(' · ')],
      ]),
    );
  }

  function render(): void {
    const key = focus.current?.dataset.key;
    el.classList.remove('tab-kb1', 'tab-kb2', 'tab-pad');
    el.classList.add(`tab-${tab}`);
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tab));
    renderList();
    renderSide();
    renderFooter();
    if (!key || key.startsWith('tab:')) return;
    focus.set(
      el.querySelector<HTMLElement>(`[data-key="${key}"]`) ?? list.querySelector<HTMLElement>('.ctl-row'),
    );
  }

  function setTab(id: Tab): void {
    if (id === tab) return;
    tab = openTab = id;
    notice = '';
    if (tab === 'pad' && selected === 'walk') selected = 'up';
    render();
  }

  function stepTab(by: number): void {
    const i = TABS.findIndex((t) => t.id === tab);
    setTab(TABS[(i + by + TABS.length) % TABS.length]!.id);
  }

  function pressedPads(): boolean[][] {
    return padSlots().map((pad) => (pad?.buttons ?? []).map((b) => b.pressed || b.value > 0.5));
  }

  function activate(key: ControlAction | 'reset'): void {
    notice = '';
    if (key === 'reset') {
      if (tab === 'pad') settings.gamepad = defaultSettings().gamepad;
      else resetKeyboard(settings.keyboard, kbIndex());
      flow.saveSettings();
      notice = `${TABS.find((t) => t.id === tab)!.label} is back to its defaults`;
      audio.ui('toggle');
      return render();
    }
    if (isLocked(key)) {
      notice = 'Gamepads always move with the left stick';
      audio.ui('error');
      return render();
    }
    capture = { action: key, until: performance.now() + CAPTURE_MS, pads: pressedPads() };
    audio.ui('select');
    render();
  }

  function endCapture(taken?: string): void {
    capture = null;
    audio.ui(taken === undefined ? 'back' : 'toggle');
    notice = taken ?? '';
    render();
  }

  function where(t: Taken): string {
    const label = ACTION_LABELS[t.action];
    return t.keyboard === kbIndex() ? label : `${TABS[t.keyboard]!.label} ${label}`;
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!capture) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (e.code === 'Escape') return endCapture();
    if (tab === 'pad') return;
    const only = menuKeyConflict(e.code, capture.action);
    if (only) {
      capture = null;
      notice = `${keyLabel(e.code)} is a menu key, so it can only be ${ACTION_LABELS[only]}`;
      audio.ui('error');
      return render();
    }
    const taken = bindKey(settings.keyboard, kbIndex(), capture.action, e.code);
    flow.saveSettings();
    endCapture(takenNotice(keyLabel(e.code), taken.map(where)));
  };

  function pollCapture(now: number): void {
    if (!capture) return;
    if (now > capture.until)
      return endCapture(`No ${tab === 'pad' ? 'button' : 'key'} pressed, nothing changed`);
    if (tab !== 'pad') return;
    const pads = pressedPads();
    for (const [slot, buttons] of pads.entries()) {
      for (const [button, down] of buttons.entries()) {
        if (!down || capture.pads[slot]?.[button]) continue;
        const action = capture.action as ButtonName;
        held = { slot, button };
        const conflict = padMenuConflict(settings.gamepad, action, button);
        if (conflict) {
          capture = null;
          notice =
            conflict === 'confirm'
              ? `${padButtonLabel(button)} selects in the pause menu, so it cannot be Pause`
              : `${padButtonLabel(button)} is the only Pause button, so give Pause another button first`;
          audio.ui('error');
          return render();
        }
        const taken = bindButton(settings.gamepad, action, button);
        flow.saveSettings();
        return endCapture(
          takenNotice(
            padButtonLabel(button),
            taken.map((a) => ACTION_LABELS[a]),
          ),
        );
      }
    }
    capture.pads = pads;
  }

  function pollPadStatus(): void {
    const count = padSlots().filter(Boolean).length;
    const status =
      count === 0
        ? 'No gamepad found: plug one in and press a button'
        : `${count} gamepad${count > 1 ? 's' : ''} connected`;
    if (status === padStatus) return;
    padStatus = status;
    const line = side.querySelector('.ctl-pad-status');
    if (line) line.textContent = status;
  }

  pollPadStatus();
  render();
  focus.set(list.querySelector<HTMLElement>('.ctl-row'));

  return {
    el,
    input(e) {
      if (capture || (held && e.device === padDevice(held.slot))) return;
      if (isDirection(e.action)) focus.move(e.action);
      else if (e.action === 'confirm' || e.action === 'start') {
        const f = focus.current;
        if (f?.dataset.tab) focus.set(list.querySelector<HTMLElement>('.ctl-row'));
        else if (f) f.click();
      } else if (e.action === 'back') flow.go('main');
      else if (e.action === 'prev' || e.action === 'next') stepTab(e.action === 'next' ? 1 : -1);
    },
    update(now) {
      if (held && !pressedPads()[held.slot]?.[held.button]) held = null;
      pollCapture(now);
      if (tab === 'pad') pollPadStatus();
    },
    enter() {
      window.addEventListener('keydown', onKeyDown, true);
    },
    leave() {
      window.removeEventListener('keydown', onKeyDown, true);
    },
  };
}
