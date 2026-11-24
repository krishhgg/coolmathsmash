import { soundDef, type SoundId } from './bank';
import { Variation, dbGain, semitoneRate } from './mix';
import {
  BUSES,
  busGain,
  loadSettings,
  saveSettings,
  type AudioSettings,
  type Bus,
  type Channel,
  type SettingsStore,
} from './settings';

export interface PlayOptions {
  /** Stereo position, -1 (left) .. 1 (right). */
  pan?: number;
  /** Extra pitch in semitones on top of the sound's random variation. */
  pitch?: number;
  /** Linear gain on top of the sound's mix level. */
  gain?: number;
  /** Context time to start at; default now. */
  at?: number;
}

/** A playing sound. */
export interface Voice {
  readonly id: SoundId;
  /** Context time the sound finishes playing (Infinity while it loops). */
  readonly end: number;
  /** Stop, fading out over `fade` seconds. */
  stop(fade?: number): void;
}

export interface EngineOptions {
  context: BaseAudioContext;
  /** Fetches a file under public/audio/; default fetch() relative to the page. */
  load?: (path: string) => Promise<ArrayBuffer>;
  /** Where settings persist; null keeps them in memory only. */
  store?: SettingsStore | null;
  /** Seed for pitch variation and variant picks. */
  seed?: number;
  /**
   * Skip sound effects while the context is not running (a browser that has not been unlocked by input yet),
   * so they do not pile up and burst out on the first key press. Off for offline rendering.
   */
  dropWhileSuspended?: boolean;
}

interface Active {
  voice: Voice;
  ended: boolean;
}

/** Volume changes and duck releases glide instead of stepping, so they never click. */
const GLIDE = 0.03;

/**
 * The mixer. Sounds go source -> gain -> (pan) -> their bus; music goes through a duck stage first so the
 * announcer and big moments can push it down; every bus meets in master -> limiter -> speakers.
 */
export class AudioEngine {
  readonly ctx: BaseAudioContext;
  /** The final mix (after the limiter), for meters and recordings. */
  readonly output: AudioNode;
  settings: AudioSettings;
  private readonly store: SettingsStore | null;
  private readonly load: (path: string) => Promise<ArrayBuffer>;
  private readonly dropWhileSuspended: boolean;
  private readonly master: GainNode;
  private readonly buses: Record<Bus, GainNode>;
  /** Music only: the ducking stage between the music bus and master. */
  readonly duckNode: GainNode;
  private readonly files = new Map<string, Promise<AudioBuffer | null>>();
  private readonly decoded = new Map<string, AudioBuffer>();
  private readonly active = new Map<SoundId, Active[]>();
  private readonly lastVariant = new Map<SoundId, number>();
  private readonly vary: Variation;
  private duckUntil = 0;
  /** A key, click or touch asked the browser to resume audio; it starts within a few milliseconds. */
  private resuming = false;

  constructor(opts: EngineOptions) {
    const ctx = (this.ctx = opts.context);
    this.store = opts.store ?? null;
    this.settings = loadSettings(this.store);
    this.load =
      opts.load ?? ((path) => fetch(`${import.meta.env.BASE_URL}audio/${path}`).then((r) => r.arrayBuffer()));
    this.dropWhileSuspended = opts.dropWhileSuspended ?? false;
    this.vary = new Variation(opts.seed);

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 4;
    limiter.ratio.value = 16;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    this.output = limiter;
    this.master = ctx.createGain();
    this.master.connect(limiter);
    this.duckNode = ctx.createGain();
    this.duckNode.connect(this.master);
    this.buses = Object.fromEntries(
      BUSES.map((bus) => {
        const g = ctx.createGain();
        g.connect(bus === 'music' ? this.duckNode : this.master);
        return [bus, g];
      }),
    ) as Record<Bus, GainNode>;
    this.applyVolumes(true);
  }

  /** The bus node a source should connect to (the music player uses 'music'). */
  bus(bus: Bus): AudioNode {
    return this.buses[bus];
  }

  setVolume(channel: Channel, value: number): void {
    this.settings = { ...this.settings, [channel]: Math.min(1, Math.max(0, value)) };
    this.applyVolumes();
    saveSettings(this.store, this.settings);
  }

  setMuted(muted: boolean): void {
    this.settings = { ...this.settings, muted };
    this.applyVolumes();
    saveSettings(this.store, this.settings);
  }

  private applyVolumes(instant = false): void {
    const now = this.ctx.currentTime;
    for (const bus of BUSES) {
      const p = this.buses[bus].gain;
      const g = busGain(this.settings, bus);
      if (instant) p.value = g;
      else {
        p.cancelScheduledValues(now);
        p.setTargetAtTime(g, now, GLIDE / 3);
      }
    }
  }

  /** Fetch and decode files (all of a sound's variants); safe to call again, each file loads once. */
  preload(ids: readonly SoundId[]): Promise<void> {
    return Promise.all(ids.flatMap((id) => soundDef(id).files.map((f) => this.file(f)))).then(
      () => undefined,
    );
  }

  /** A decoded file, or null when it failed to load (the game stays silent rather than throwing). */
  file(path: string): Promise<AudioBuffer | null> {
    let p = this.files.get(path);
    if (!p) {
      p = this.load(path)
        .then((data) => this.ctx.decodeAudioData(data))
        .then((buf) => {
          this.decoded.set(path, buf);
          return buf;
        })
        .catch((err: unknown) => {
          console.warn(`audio: could not load ${path}`, err);
          return null;
        });
      this.files.set(path, p);
    }
    return p;
  }

  get running(): boolean {
    return (this.ctx as AudioContext).state === 'running';
  }

  /**
   * Browsers start audio suspended until the page gets a key press, click or touch. Resume on the first one
   * on `target` (listening in the capture phase, so the gesture that opens a menu can already play its sound).
   */
  unlock(target: EventTarget): void {
    const ctx = this.ctx as AudioContext;
    if (typeof ctx.resume !== 'function') return;
    const events = ['keydown', 'pointerdown', 'touchend'];
    const resume = () => {
      this.resuming = true;
      void ctx.resume().then(() => {
        if (ctx.state === 'running') for (const e of events) target.removeEventListener(e, resume, true);
      });
    };
    for (const e of events) target.addEventListener(e, resume, true);
  }

  /**
   * Play a sound now (or at `opts.at`). Returns null when nothing plays: the file is still loading (the load
   * starts so the next call plays), or effects are being dropped until the browser unlocks audio.
   */
  play(id: SoundId, opts: PlayOptions = {}): Voice | null {
    const def = soundDef(id);
    if (this.dropWhileSuspended && !this.running && !this.resuming) return null;
    const variant = this.vary.pick(def.files.length, this.lastVariant.get(id) ?? -1);
    const path = def.files[variant]!;
    const buf = this.decoded.get(path);
    if (!buf) {
      void this.file(path);
      return null;
    }
    this.lastVariant.set(id, variant);
    const ctx = this.ctx;
    const when = Math.max(opts.at ?? 0, ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = def.loop ?? false;
    const rate = semitoneRate((opts.pitch ?? 0) + this.vary.spread(def.vary ?? 0));
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = dbGain(def.gain) * (opts.gain ?? 1);
    src.connect(gain);
    let out: AudioNode = gain;
    if (opts.pan) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.min(1, Math.max(-1, opts.pan));
      gain.connect(panner);
      out = panner;
    }
    out.connect(this.buses[def.bus]);

    const list = this.active.get(id) ?? [];
    this.active.set(id, list);
    const entry: Active = {
      ended: false,
      voice: {
        id,
        end: src.loop ? Infinity : when + buf.duration / rate,
        stop: (fade = 0.03) => {
          if (entry.ended) return;
          const t = Math.max(ctx.currentTime, when);
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(gain.gain.value, t);
          gain.gain.linearRampToValueAtTime(0, t + fade);
          src.stop(t + fade + 0.01);
        },
      },
    };
    src.onended = () => {
      entry.ended = true;
      const i = list.indexOf(entry);
      if (i >= 0) list.splice(i, 1);
      out.disconnect();
    };
    src.start(when);
    list.push(entry);
    while (list.length > (def.max ?? 4)) {
      const oldest = list.shift()!;
      oldest.voice.stop(0.02);
    }
    return entry.voice;
  }

  /** Stop every voice of a sound. */
  stopAll(id: SoundId, fade = 0.05): void {
    for (const a of this.active.get(id) ?? []) a.voice.stop(fade);
  }

  /**
   * Push the music down to `depth` (linear) for `hold` seconds, then let it recover over `release`. Overlapping
   * ducks extend each other.
   */
  duck(depth = 0.35, hold = 0.8, attack = 0.04, release = 0.6, at = this.ctx.currentTime): void {
    const g = this.duckNode.gain;
    const start = Math.max(at, this.ctx.currentTime);
    this.duckUntil = Math.max(this.duckUntil, start + hold);
    g.cancelScheduledValues(start);
    g.setTargetAtTime(depth, start, attack / 3);
    g.setTargetAtTime(1, this.duckUntil, release / 3);
  }
}
