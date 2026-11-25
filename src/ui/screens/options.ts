import { audio, type Channel } from '../../audio';
import { DEFAULT_SETTINGS as AUDIO_DEFAULTS } from '../../audio/settings';
import { defaultSettings } from '../../session/settings';
import type { Flow, Screen, ScreenDef } from '../app';
import { planetSvg } from '../art/logo';
import { RESET_SVG } from '../art/icons';
import { h, svg } from '../dom';
import { isDirection } from '../input';
import { Focus } from '../nav';
import { backTab, footerHints, headerPlate } from '../widgets';
import './options.css';

type OptionId = Channel | 'muted' | 'tapJump' | 'fullscreen' | 'reset';

interface Option {
  id: OptionId;
  label: string;
  section: string;
  about: string;
  icon: string;
  color: string;
}

const VOLUMES: readonly Channel[] = ['master', 'music', 'sfx', 'voice'];
const STEP = 0.1;

const icon = (markup: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${markup}</svg>`;
const SPEAKER = '<path d="M2.5 9 H7 L12.5 4 V20 L7 15 H2.5 Z"/>';

const OPTIONS: Option[] = [
  {
    id: 'master',
    label: 'Master volume',
    section: 'Sound',
    about: 'Everything at once: music, sound effects and voices.',
    icon: icon(
      `${SPEAKER}<path d="M15.5 8.5 Q18 12 15.5 15.5 M18.5 5.5 Q23 12 18.5 18.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
    ),
    color: 'var(--cm-blue)',
  },
  {
    id: 'music',
    label: 'Music',
    section: 'Sound',
    about: 'Menu and stage music.',
    icon: icon('<path d="M9 18 a3.2 3.2 0 1 1 -2 -3 V5.2 L20 3 V16 a3.2 3.2 0 1 1 -2 -3 V7.4 L9 9.2 Z"/>'),
    color: 'var(--cm-blue)',
  },
  {
    id: 'sfx',
    label: 'Sound effects',
    section: 'Sound',
    about: 'Hits, jumps, shields, KOs and menu sounds.',
    icon: icon(
      '<path d="M12 1 L14.6 7.8 L22 6 L17.2 12 L22 18 L14.6 16.2 L12 23 L9.4 16.2 L2 18 L6.8 12 L2 6 L9.4 7.8 Z"/>',
    ),
    color: 'var(--cm-blue)',
  },
  {
    id: 'voice',
    label: 'Voices',
    section: 'Sound',
    about: 'The announcer and the fighters.',
    icon: icon(
      '<rect x="8.5" y="2" width="7" height="12" rx="3.5"/><path d="M5 11 a7 7 0 0 0 14 0 M12 18 V22 M8 22 H16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>',
    ),
    color: 'var(--cm-blue)',
  },
  {
    id: 'muted',
    label: 'Mute',
    section: 'Sound',
    about: 'Silence everything without moving the sliders.',
    icon: icon(
      `${SPEAKER}<path d="M15.5 9 L21.5 15 M21.5 9 L15.5 15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`,
    ),
    color: 'var(--cm-blue)',
  },
  {
    id: 'tapJump',
    label: 'Tap jump',
    section: 'Gameplay',
    about:
      'Flick up to jump, as in Smash. Turn it off to jump with the jump button only, so up attacks never jump.',
    icon: icon(
      '<circle cx="12" cy="17" r="5"/><path d="M12 12 V2.5 M7.8 6.5 L12 2.5 L16.2 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    ),
    color: 'var(--cm-green)',
  },
  {
    id: 'fullscreen',
    label: 'Fullscreen',
    section: 'Display',
    about: 'Fill the whole screen with the game. Esc also leaves fullscreen.',
    icon: icon(
      '<path d="M3 9 V3 H9 M15 3 H21 V9 M21 15 V21 H15 M9 21 H3 V15" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
    ),
    color: 'var(--p3)',
  },
  {
    id: 'reset',
    label: 'Reset all settings',
    section: 'Data',
    about: 'Every control, option and volume goes back to how it started.',
    icon: RESET_SVG,
    color: 'var(--cm-red)',
  },
];

export const screen: ScreenDef = { route: 'options', create: optionsScreen };

const isVolume = (id: OptionId): id is Channel => (VOLUMES as readonly string[]).includes(id);
const percent = (v: number) => `${Math.round(v * 100)}%`;
const fullscreenOn = () => typeof document !== 'undefined' && document.fullscreenElement !== null;

/**
 * Options: volume sliders (the audio module keeps those), tap jump, fullscreen and a reset with a confirm step. Up and
 * down pick a row; left and right change it; confirm flips a switch or opens the reset dialog.
 */
export function optionsScreen(flow: Flow): Screen {
  let selected: OptionId = 'master';
  let notice = '';
  let dialog: { el: HTMLElement; focus: Focus } | null = null;
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  const list = h('div', { class: 'opt-list' });
  const side = h('div', { class: 'opt-side' });
  const el = h(
    'div',
    { class: 'options-screen bg-menu', on: { mousedown: (e) => e.preventDefault() } },
    h('div', { class: 'bg-rays' }),
    backTab(() => flow.go('main')),
    headerPlate('Options'),
    list,
    side,
    footerHints([
      ['Choose', 'W/S · ↑/↓'],
      ['Change', 'A/D · ←/→'],
      ['Select', 'F · J · Enter'],
      ['Back', 'G · K · Esc'],
    ]),
  );
  const focus = new Focus(el, (f) => {
    if (dialog || !f.dataset.option) return;
    selected = f.dataset.option as OptionId;
    renderSide();
  });
  focus.hover();

  function value(id: OptionId): HTMLElement {
    if (isVolume(id)) {
      const v = audio.settings[id];
      const pips = Array.from({ length: 10 }, (_, i) =>
        h('span', { class: i < Math.round(v * 10) ? 'opt-pip is-on' : 'opt-pip' }),
      );
      return h(
        'span',
        { class: 'opt-slider' },
        h('span', { class: 'opt-pips' }, pips),
        h('b', null, percent(v)),
      );
    }
    if (id === 'reset') return h('span', { class: 'opt-go' }, 'Reset…');
    const on =
      id === 'muted' ? audio.settings.muted : id === 'tapJump' ? flow.settings.tapJump : fullscreenOn();
    if (id === 'fullscreen' && !canFullscreen)
      return h('span', { class: 'opt-switch is-off' }, 'Not available');
    return h(
      'span',
      { class: `opt-switch ${on ? 'is-on' : 'is-off'}` },
      h('i', { class: 'opt-arrow' }, '◀'),
      on ? 'On' : 'Off',
      h('i', { class: 'opt-arrow' }, '▶'),
    );
  }

  function renderList(): void {
    const key = focus.current?.dataset.option;
    const rows: HTMLElement[] = [];
    let section = '';
    for (const o of OPTIONS) {
      if (o.section !== section && o.id !== 'reset') {
        section = o.section;
        rows.push(h('div', { class: 'opt-section' }, section));
      }
      const muted = isVolume(o.id) && audio.settings.muted;
      rows.push(
        h(
          'button',
          {
            class: `opt-row opt-${o.id}${muted ? ' is-muted' : ''}`,
            style: `--tint: ${o.color}`,
            data: { nav: '', option: o.id, navLeft: '', navRight: '' },
            disabled: o.id === 'fullscreen' && !canFullscreen,
            on: { click: () => activate(o.id) },
          },
          h('span', { class: 'opt-icon' }, svg(o.icon)),
          h('span', { class: 'opt-label' }, o.label),
          value(o.id),
        ),
      );
    }
    list.replaceChildren(...rows);
    if (key) focus.set(list.querySelector<HTMLElement>(`[data-option="${key}"]`));
  }

  function renderSide(): void {
    const o = OPTIONS.find((x) => x.id === selected)!;
    let big: HTMLElement;
    if (isVolume(o.id)) {
      const v = audio.settings[o.id];
      big = h(
        'div',
        { class: 'opt-readout' },
        h('div', { class: 'opt-big' }, percent(v)),
        h('div', { class: 'opt-meter' }, h('span', { style: `width: ${v * 100}%` })),
        audio.settings.muted ? h('div', { class: 'opt-tag' }, 'Muted') : null,
      );
    } else if (o.id === 'reset') {
      big = h('div', { class: 'opt-readout' }, h('div', { class: 'opt-big is-small' }, 'Defaults'));
    } else {
      const on =
        o.id === 'muted' ? audio.settings.muted : o.id === 'tapJump' ? flow.settings.tapJump : fullscreenOn();
      big = h(
        'div',
        { class: 'opt-readout' },
        h('div', { class: `opt-big ${on ? 'is-on' : 'is-off'}` }, on ? 'On' : 'Off'),
      );
    }
    side.style.setProperty('--tint', o.color);
    side.replaceChildren(
      h(
        'div',
        { class: 'opt-callout' },
        h('div', { class: 'opt-callout-art' }, svg(planetSvg())),
        h('div', { class: 'opt-badge' }, o.section),
        h('div', { class: 'opt-name' }, o.label),
        h('div', { class: 'opt-about' }, o.about),
      ),
      h('div', { class: 'opt-stage' }, h('div', { class: 'opt-medal' }, svg(o.icon)), big),
    );
    if (notice) side.append(h('div', { class: 'opt-notice' }, notice));
  }

  function render(): void {
    renderList();
    renderSide();
  }

  /** Left/right (-1/+1) on a row; confirm flips switches the same way. */
  function change(id: OptionId, by: number): void {
    notice = '';
    if (isVolume(id)) {
      audio.setVolume(id, Math.min(1, Math.max(0, Math.round((audio.settings[id] + by * STEP) * 10) / 10)));
    } else if (id === 'muted') audio.setMuted(!audio.settings.muted);
    else if (id === 'tapJump') {
      flow.settings.tapJump = !flow.settings.tapJump;
      flow.saveSettings();
    } else if (id === 'fullscreen' && canFullscreen) {
      const done = fullscreenOn() ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      void done.catch(() => {}).finally(render);
    } else return;
    audio.ui('toggle');
    render();
  }

  function activate(id: OptionId): void {
    if (id === 'reset') openDialog();
    else if (!isVolume(id)) change(id, 1);
  }

  function resetAll(): void {
    Object.assign(flow.settings, defaultSettings());
    flow.saveSettings();
    for (const c of VOLUMES) audio.setVolume(c, AUDIO_DEFAULTS[c]);
    audio.setMuted(AUDIO_DEFAULTS.muted);
    closeDialog();
    notice = 'Every setting is back to its default';
    audio.ui('select');
    render();
  }

  function openDialog(): void {
    const cancel = h('button', { class: 'opt-btn', data: { nav: '' }, on: { click: closeDialog } }, 'Cancel');
    const box = h(
      'div',
      { class: 'opt-dialog' },
      h('div', { class: 'opt-dialog-title' }, 'Reset all settings?'),
      h(
        'div',
        { class: 'opt-dialog-body' },
        'Key and button bindings, tap jump and volumes all go back to their defaults.',
      ),
      h(
        'div',
        { class: 'opt-dialog-buttons' },
        h('button', { class: 'opt-btn is-danger', data: { nav: '' }, on: { click: resetAll } }, 'Reset'),
        cancel,
      ),
    );
    const backdrop = h('div', { class: 'opt-backdrop' }, box);
    el.append(backdrop);
    const f = new Focus(box);
    f.hover();
    f.set(cancel);
    dialog = { el: backdrop, focus: f };
  }

  function closeDialog(): void {
    dialog?.el.remove();
    dialog = null;
  }

  const onFullscreen = () => render();

  render();
  focus.set(list.querySelector<HTMLElement>('.opt-row'));

  return {
    el,
    input(e) {
      if (dialog) {
        if (isDirection(e.action)) dialog.focus.move(e.action);
        else if (e.action === 'confirm' || e.action === 'start') dialog.focus.current?.click();
        else if (e.action === 'back') closeDialog();
        return;
      }
      if (e.action === 'up' || e.action === 'down') focus.move(e.action);
      else if (e.action === 'left' || e.action === 'right') change(selected, e.action === 'right' ? 1 : -1);
      else if (e.action === 'confirm' || e.action === 'start') activate(selected);
      else if (e.action === 'back') flow.go('main');
    },
    enter() {
      document.addEventListener('fullscreenchange', onFullscreen);
    },
    leave() {
      document.removeEventListener('fullscreenchange', onFullscreen);
    },
  };
}
