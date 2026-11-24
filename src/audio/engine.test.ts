import { describe, expect, it } from 'vitest';
import { soundDef } from './bank';
import { AudioEngine } from './engine';
import { dbGain } from './mix';
import { SETTINGS_KEY, busGain } from './settings';
import { FakeContext, FakeGain, FakePanner, MemoryStore, type FakeSource } from './testing';

async function setup(opts: { suspended?: boolean } = {}) {
  const ctx = new FakeContext();
  if (opts.suspended) ctx.state = 'suspended';
  const store = new MemoryStore();
  const engine = new AudioEngine({
    context: ctx as unknown as BaseAudioContext,
    load: FakeContext.load,
    store,
    dropWhileSuspended: true,
  });
  await engine.preload(['hit-light', 'hit-ko', 'menu-select', 'dizzy']);
  return { ctx, engine, store };
}

/** The chain a source feeds: [gain, panner?, bus]. */
const chain = (src: FakeSource) => {
  const nodes = [];
  let n = src.out[0];
  while (n) {
    nodes.push(n);
    n = n.out[0];
  }
  return nodes;
};

describe('AudioEngine', () => {
  it('plays a loaded sound through its mix gain into its bus, panned only when asked', async () => {
    const { ctx, engine } = await setup();
    expect(engine.play('menu-select')).not.toBeNull();
    const plain = ctx.sources[0]!;
    const [gain, bus] = chain(plain);
    expect(gain).toBeInstanceOf(FakeGain);
    expect((gain as FakeGain).gain.value).toBeCloseTo(dbGain(soundDef('menu-select').gain));
    expect(bus).toBe(engine.bus('sfx'));
    expect(plain.started).toBe(0);

    engine.play('hit-ko', { pan: -0.5, gain: 0.5 });
    const [g2, panner, bus2] = chain(ctx.sources[1]!);
    expect((g2 as FakeGain).gain.value).toBeCloseTo(dbGain(soundDef('hit-ko').gain) * 0.5);
    expect(panner).toBeInstanceOf(FakePanner);
    expect((panner as FakePanner).pan.value).toBe(-0.5);
    expect(bus2).toBe(engine.bus('sfx'));
  });

  it('returns null for a sound still loading and plays it once the file has decoded', async () => {
    const { ctx, engine } = await setup();
    expect(engine.play('jump')).toBeNull();
    await engine.preload(['jump']);
    expect(engine.play('jump')).not.toBeNull();
    expect(ctx.sources).toHaveLength(1);
  });

  it('varies pitch within the spread and never repeats a variant back to back', async () => {
    const { ctx, engine } = await setup();
    for (let i = 0; i < 40; i++) {
      engine.play('hit-light');
      ctx.sources[i]!.end();
    }
    const files = ctx.sources.map((s) => s.buffer!.path);
    files.slice(1).forEach((f, i) => expect(f).not.toBe(files[i]));
    expect(new Set(files)).toEqual(new Set(soundDef('hit-light').files));
    const spread = soundDef('hit-light').vary!;
    for (const s of ctx.sources) {
      expect(s.playbackRate.value).toBeGreaterThanOrEqual(2 ** (-spread / 12) - 1e-9);
      expect(s.playbackRate.value).toBeLessThanOrEqual(2 ** (spread / 12) + 1e-9);
    }
    expect(new Set(ctx.sources.map((s) => s.playbackRate.value)).size).toBeGreaterThan(30);
  });

  it('caps simultaneous voices of one sound by cutting the oldest', async () => {
    const { ctx, engine } = await setup();
    for (let i = 0; i < 3; i++) engine.play('hit-ko');
    expect(ctx.sources.map((s) => s.stopped !== null)).toEqual([true, false, false]);
  });

  it('loops looping sounds until stopped, fading out', async () => {
    const { ctx, engine } = await setup();
    const v = engine.play('dizzy')!;
    expect(ctx.sources[0]!.loop).toBe(true);
    ctx.currentTime = 2;
    v.stop(0.1);
    expect(ctx.sources[0]!.stopped).toBeCloseTo(2.11);
  });

  it('applies and saves volume changes, and mute silences every bus', async () => {
    const { engine, store } = await setup();
    engine.setVolume('music', 0.5);
    const bus = engine.bus('music') as unknown as FakeGain;
    expect(bus.gain.target).toBeCloseTo(busGain(engine.settings, 'music'));
    expect(JSON.parse(store.getItem(SETTINGS_KEY)!)).toMatchObject({ music: 0.5 });
    engine.setMuted(true);
    for (const b of ['music', 'sfx', 'voice'] as const)
      expect((engine.bus(b) as unknown as FakeGain).gain.target).toBe(0);
  });

  it('ducks the music to a depth and recovers after the hold, overlapping ducks extending it', async () => {
    const { ctx, engine } = await setup();
    const g = (engine.duckNode as unknown as FakeGain).gain;
    engine.duck(0.3, 1);
    expect(g.events.filter((e) => e[0] === 'target')).toEqual([
      ['target', 0.3, 0, expect.any(Number)],
      ['target', 1, 1, expect.any(Number)],
    ]);
    ctx.currentTime = 0.5;
    engine.duck(0.5, 1);
    expect(g.events.slice(-2)).toEqual([
      ['target', 0.5, 0.5, expect.any(Number)],
      ['target', 1, 1.5, expect.any(Number)],
    ]);
  });

  it('drops effects while the browser keeps audio locked, and plays from the first key press on', async () => {
    const { ctx, engine } = await setup({ suspended: true });
    const page = new EventTarget();
    engine.unlock(page);
    expect(engine.play('menu-select')).toBeNull();
    page.dispatchEvent(new Event('keydown'));
    expect(engine.play('menu-select')).not.toBeNull();
    await Promise.resolve();
    expect(ctx.state).toBe('running');
  });
});
