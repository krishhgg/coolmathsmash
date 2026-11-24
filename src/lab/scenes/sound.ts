import { Graphics, Text, type Application } from 'pixi.js';
import { audio, type Channel, type SoundId } from '../../audio';
import { TRACKS } from '../../audio/music';
import type { LabScene } from '../types';

/** The sound test: every sound in the bank on a button, the volume sliders, and a stereo level meter. */
const GROUPS: [string, SoundId[]][] = [
  ['Hits', ['hit-light', 'hit-medium', 'hit-heavy', 'hit-ko', 'hit-fire', 'hit-electric']],
  ['Shield', ['shield-on', 'shield-hit', 'shield-break', 'dizzy']],
  ['Launch and KO', ['launch', 'launch-strong', 'ko-blast', 'respawn']],
  [
    'Movement',
    ['jump', 'double-jump', 'land', 'land-heavy', 'dash', 'skid', 'step', 'ledge-grab', 'dodge', 'roll'],
  ],
  ['Attacks', ['swing-light', 'swing-medium', 'swing-heavy', 'smash-charge']],
  ['Menus', ['menu-move', 'menu-select', 'menu-back', 'menu-error', 'menu-toggle', 'menu-start']],
];
const CHANNELS: Channel[] = ['master', 'music', 'sfx', 'voice'];

const CSS = `
.sound-test { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.sound-test .stage { position: relative; width: min(100vw, calc(100vh * 16 / 9)); aspect-ratio: 16 / 9; container-type: inline-size; pointer-events: auto;
  font: 600 1.25cqw/1.2 system-ui, sans-serif; color: #e8ecf4; }
.sound-test .groups { position: absolute; left: 3cqw; top: 10cqw; width: 64cqw; display: grid; gap: 1.2cqw; }
.sound-test h3 { margin: 0 0 .5cqw; font-size: 1.3cqw; letter-spacing: .1em; text-transform: uppercase; color: #ffcc33; }
.sound-test .row { display: flex; flex-wrap: wrap; gap: .5cqw; }
.sound-test button { font: inherit; color: #fff; background: #26304a; border: .15cqw solid #4a5a85; border-radius: .6cqw; padding: .45cqw .9cqw; cursor: pointer; }
.sound-test button:hover, .sound-test button.on { background: #3b4f86; border-color: #8fb0ff; }
.sound-test .mixer { position: absolute; right: 3cqw; top: 10cqw; width: 26cqw; display: grid; gap: 1cqw; background: #141a2bcc; border: .15cqw solid #33405f; border-radius: 1cqw; padding: 1.4cqw; }
.sound-test label { display: grid; grid-template-columns: 6cqw 1fr 3.5cqw; align-items: center; gap: .8cqw; }
.sound-test input[type=range] { width: 100%; accent-color: #ffcc33; }
.sound-test .note { color: #9aa3b5; font-weight: 400; font-size: 1.05cqw; }
`;

export const scene: LabScene = {
  title: 'Sound test',
  mount(app: Application) {
    audio.init(window);
    const engine = audio.engine;
    const title = new Text({
      text: 'SOUND TEST',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontWeight: '900',
        fontSize: 56,
        fill: '#ffffff',
        letterSpacing: 4,
      },
    });
    title.position.set(38, 22);
    const sub = new Text({
      text: 'Click a sound. Pan sets where it plays; repeats vary in pitch and variant.',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 18, fill: '#9aa3b5' },
    });
    sub.position.set(42, 92);
    const meter = new Graphics();
    const now = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 18, fill: '#ffcc33' } });
    now.position.set(42, 668);
    app.stage.addChild(title, sub, meter, now);

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.className = 'sound-test';
    root.innerHTML = `<div class="stage"><div class="groups"></div><div class="mixer"></div></div>`;
    document.body.appendChild(root);
    const groups = root.querySelector<HTMLDivElement>('.groups')!;
    const mixer = root.querySelector<HTMLDivElement>('.mixer')!;

    let pan = 0;
    let dizzy: { stop(fade?: number): void } | null = null;
    const play = (id: SoundId, button?: HTMLButtonElement) => {
      if (id === 'dizzy' && dizzy) {
        dizzy.stop(0.08);
        dizzy = null;
        button?.classList.remove('on');
        return;
      }
      const v = audio.play(id, { pan });
      if (v && id === 'dizzy') {
        dizzy = v;
        button?.classList.add('on');
      }
      now.text = `▶ ${id}  pan ${pan.toFixed(2)}${v ? '' : '  (loading or locked: click again)'}`;
    };
    for (const [name, ids] of GROUPS) {
      const box = document.createElement('section');
      box.innerHTML = `<h3>${name}</h3><div class="row"></div>`;
      const row = box.querySelector('.row')!;
      for (const id of ids) {
        const b = document.createElement('button');
        b.textContent = id;
        b.dataset.sound = id;
        b.addEventListener('click', () => play(id, b));
        row.appendChild(b);
      }
      groups.appendChild(box);
    }

    const tunes = document.createElement('section');
    tunes.innerHTML = `<h3>Music</h3><div class="row"></div>`;
    const tuneRow = tunes.querySelector('.row')!;
    for (const id of [...Object.keys(TRACKS), 'stop']) {
      const b = document.createElement('button');
      b.textContent = id === 'stop' ? '■ stop' : TRACKS[id]!.title;
      b.dataset.music = id;
      b.addEventListener('click', () => {
        audio.music(id === 'stop' ? null : id);
        now.text = id === 'stop' ? '■ music stopped' : `♪ ${TRACKS[id]!.title}  (${TRACKS[id]!.evokes})`;
      });
      tuneRow.appendChild(b);
    }

    const slider = (
      label: string,
      value: number,
      min: number,
      onInput: (v: number) => void,
      fmt: (v: number) => string,
    ) => {
      const l = document.createElement('label');
      l.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="1" step="0.01" value="${value}"><output>${fmt(value)}</output>`;
      const input = l.querySelector('input')!;
      const out = l.querySelector('output')!;
      input.dataset.channel = label.toLowerCase();
      input.addEventListener('input', () => {
        onInput(Number(input.value));
        out.textContent = fmt(Number(input.value));
      });
      mixer.appendChild(l);
    };
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const h = document.createElement('h3');
    h.textContent = 'Volume';
    mixer.appendChild(h);
    for (const c of CHANNELS)
      slider(
        c === 'sfx' ? 'SFX' : c[0]!.toUpperCase() + c.slice(1),
        audio.settings[c],
        0,
        (v) => audio.setVolume(c, v),
        pct,
      );
    const mute = document.createElement('label');
    mute.innerHTML = `<span>Mute</span><input type="checkbox" ${audio.settings.muted ? 'checked' : ''}><span></span>`;
    mute
      .querySelector('input')!
      .addEventListener('change', (e) => audio.setMuted((e.target as HTMLInputElement).checked));
    mixer.appendChild(mute);
    const h2 = document.createElement('h3');
    h2.textContent = 'Position';
    mixer.appendChild(h2);
    slider(
      'Pan',
      0,
      -1,
      (v) => (pan = v),
      (v) => v.toFixed(2),
    );
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = 'Settings are saved in this browser. Audio starts after the first click or key press.';
    mixer.appendChild(tunes);
    mixer.appendChild(note);

    if (!engine) return;
    const split = engine.ctx.createChannelSplitter(2);
    engine.output.connect(split);
    const analysers = [0, 1].map((ch) => {
      const a = engine.ctx.createAnalyser();
      a.fftSize = 1024;
      split.connect(a, ch);
      return a;
    });
    const data = new Float32Array(1024);
    const levels = [0, 0];
    app.ticker.add(() => {
      meter.clear();
      analysers.forEach((a, ch) => {
        a.getFloatTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v));
        levels[ch] = Math.max(peak, levels[ch]! * 0.92);
        const db = 20 * Math.log10(Math.max(levels[ch], 1e-4));
        const w = Math.max(0, (db + 48) / 48) * 1196;
        const y = 610 + ch * 26;
        meter.rect(42, y, 1196, 18).fill({ color: '#1b2236' });
        meter.rect(42, y, w, 18).fill({ color: db > -3 ? '#ff5a4d' : db > -12 ? '#ffcc33' : '#58d68d' });
      });
    });
  },
  api: {
    play: (id: SoundId, pan = 0) => audio.play(id, { pan }) !== null,
    settings: () => audio.settings,
    music: (id: string | null) => audio.music(id),
  },
};
