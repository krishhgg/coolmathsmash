/**
 * A recording stand-in for the Web Audio API, enough of it for AudioEngine: nodes remember their
 * connections, params remember their automation, sources remember start and stop. Unit tests only.
 */
export class FakeParam {
  events: (string | number)[][] = [];
  constructor(public value: number) {}
  setValueAtTime(v: number, t: number) {
    this.events.push(['set', v, t]);
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number, c: number) {
    this.events.push(['target', v, t, c]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(['ramp', v, t]);
    return this;
  }
  cancelScheduledValues(t: number) {
    this.events.push(['cancel', t]);
    return this;
  }
  /** The last value scheduled with setTargetAtTime (or the plain value). */
  get target(): number {
    const last = [...this.events].reverse().find((e) => e[0] === 'target');
    return last ? (last[1] as number) : this.value;
  }
}

export class FakeNode {
  out: FakeNode[] = [];
  connect<T extends FakeNode>(n: T): T {
    this.out.push(n);
    return n;
  }
  disconnect() {
    this.out = [];
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

export class FakePanner extends FakeNode {
  pan = new FakeParam(0);
}

export class FakeSource extends FakeNode {
  buffer: { path: string } | null = null;
  loop = false;
  playbackRate = new FakeParam(1);
  onended: (() => void) | null = null;
  started: number | null = null;
  stopped: number | null = null;
  start(t = 0) {
    this.started = t;
  }
  stop(t = 0) {
    this.stopped = t;
  }
  /** Finish playing (what the browser does at the end of the buffer or at stop time). */
  end() {
    this.onended?.();
  }
}

export class FakeContext {
  currentTime = 0;
  state: 'running' | 'suspended' = 'running';
  destination = new FakeNode();
  sources: FakeSource[] = [];
  createGain() {
    return new FakeGain();
  }
  createStereoPanner() {
    return new FakePanner();
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(), {
      threshold: new FakeParam(0),
      knee: new FakeParam(0),
      ratio: new FakeParam(1),
      attack: new FakeParam(0),
      release: new FakeParam(0),
    });
  }
  decodeAudioData(data: ArrayBuffer) {
    return Promise.resolve({ path: new TextDecoder().decode(data) });
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  /** Fake files decode to { path } so tests can see which variant played. */
  static load = (path: string) => Promise.resolve(new TextEncoder().encode(path).buffer as ArrayBuffer);
}

export class MemoryStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}
