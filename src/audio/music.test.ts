import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AudioEngine } from './engine';
import { MusicPlayer, STAGE_MUSIC, TRACKS, trackFor } from './music';
import { FakeContext, type FakeGain } from './testing';

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const ctx = new FakeContext();
  const engine = new AudioEngine({ context: ctx as unknown as BaseAudioContext, load: FakeContext.load });
  return { ctx, engine, player: new MusicPlayer(engine) };
}

describe('music', () => {
  it('ships a file for every track, with a sane loop region', () => {
    const root = resolve(import.meta.dirname, '..', '..');
    expect(Object.keys(TRACKS)).toContain('menu');
    for (const t of Object.values(TRACKS)) {
      expect(existsSync(join(root, 'public', 'audio', t.file))).toBe(true);
      expect(t.loopStart).toBeGreaterThanOrEqual(0);
      expect(t.loopEnd - t.loopStart).toBeGreaterThan(10);
    }
    for (const track of Object.values(STAGE_MUSIC)) expect(TRACKS[track]).toBeDefined();
  });

  it('resolves track ids, stage ids, and nothing else', () => {
    expect(trackFor('menu')).toBe('menu');
    expect(trackFor('no-such-stage')).toBeNull();
  });

  it('loops a track over its loop region on the music bus, fading in', async () => {
    const { ctx, engine, player } = setup();
    player.play('menu');
    await tick();
    const src = ctx.sources[0]!;
    expect(src.loop).toBe(true);
    expect(src).toMatchObject({ loopStart: TRACKS.menu!.loopStart, loopEnd: TRACKS.menu!.loopEnd });
    expect(src.buffer).toEqual({ path: TRACKS.menu!.file });
    const gain = src.out[0] as FakeGain;
    expect(gain.gain.events.at(-1)).toEqual(['ramp', 1, expect.any(Number)]);
    expect(gain.out[0]).toBe(engine.bus('music'));
    expect(player.current).toBe('menu');
  });

  it('keeps playing on a repeat or an unknown id, and fades out on null', async () => {
    const { ctx, player } = setup();
    player.play('menu');
    await tick();
    player.play('menu');
    player.play('no-such-stage');
    await tick();
    expect(ctx.sources).toHaveLength(1);
    ctx.currentTime = 5;
    player.play(null, 2);
    expect(ctx.sources[0]!.stopped).toBeCloseTo(7.05);
    expect(player.current).toBeNull();
  });

  it('crossfades to the next track, and a change while loading wins over the older request', async () => {
    const { ctx, player } = setup();
    TRACKS['test-b'] = { ...TRACKS.menu!, file: 'music/test-b.mp3' };
    try {
      player.play('menu');
      player.play('test-b');
      await tick();
      expect(ctx.sources.map((s) => s.buffer)).toEqual([{ path: 'music/test-b.mp3' }]);
      player.play('menu');
      await tick();
      expect(ctx.sources[0]!.stopped).not.toBeNull();
      expect(ctx.sources[1]!.buffer).toEqual({ path: TRACKS.menu!.file });
    } finally {
      delete TRACKS['test-b'];
    }
  });
});
