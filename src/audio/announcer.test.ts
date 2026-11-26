import { describe, expect, it } from 'vitest';
import { allFighters } from '../fighters/registry';
import { ANNOUNCER_DUCK, announce, announceWinner, announcerSound } from './announcer';
import { ANNOUNCED_FIGHTERS, ANNOUNCER_LINES, soundDef } from './bank';
import { AudioEngine } from './engine';
import { FakeContext, type FakeGain, type FakeSource } from './testing';

async function setup() {
  const ctx = new FakeContext();
  ctx.durations.set('voice/winner-is.mp3', 1.8);
  ctx.durations.set('voice/fighter-fireboy.mp3', 1.5);
  ctx.durations.set('voice/go.mp3', 1.2);
  const engine = new AudioEngine({ context: ctx as unknown as BaseAudioContext, load: FakeContext.load });
  await engine.preload(['voice-go', 'voice-winner-is', 'voice-fighter-fireboy']);
  const duck = (engine.duckNode as unknown as FakeGain).gain;
  return { ctx, engine, duck };
}

const targets = (events: (string | number)[][]) => events.filter((e) => e[0] === 'target');
/** The bus node a source ends up in. */
const busOf = (src: FakeSource) => src.out[0]!.out[0];

describe('announcer', () => {
  it('has a voice-bus sound for every line and every fighter name, and nothing else', () => {
    for (const line of [...ANNOUNCER_LINES, ...ANNOUNCED_FIGHTERS.map((id) => `fighter:${id}`)]) {
      const id = announcerSound(line);
      expect(id, line).not.toBeNull();
      expect(soundDef(id!).bus).toBe('voice');
      expect(soundDef(id!).files).toEqual([`voice/${line.replace(':', '-')}.mp3`]);
    }
    for (const unknown of ['', 'hit-light', 'voice-go', 'fighter:mario', 'fighter:moby', 'fighter:']) {
      expect(announcerSound(unknown), unknown).toBeNull();
    }
  });

  it('names every fighter in the game', () => {
    expect(Object.keys(allFighters()).filter((id) => !announcerSound(`fighter:${id}`))).toEqual([]);
  });

  it('uses the same name for both Bloxorz forms', () => {
    expect(announcerSound('fighter:bloxorz-lying')).toBe('voice-fighter-bloxorz');
  });

  it('says a line on the voice bus and ducks the music until it has finished', async () => {
    const { ctx, engine, duck } = await setup();
    ctx.currentTime = 3;
    const voice = announce(engine, 'go')!;
    expect(voice.end).toBeCloseTo(4.2);
    const src = ctx.sources[0]!;
    expect(src.buffer!.path).toBe('voice/go.mp3');
    expect(src.started).toBe(3);
    expect(busOf(src)).toBe(engine.bus('voice'));
    expect(targets(duck.events)).toEqual([
      ['target', ANNOUNCER_DUCK, 3, expect.any(Number)],
      ['target', 1, 4.2, expect.any(Number)],
    ]);
  });

  it('stays silent for lines it does not have', async () => {
    const { ctx, engine, duck } = await setup();
    expect(announce(engine, 'fighter:mario')).toBeNull();
    expect(announce(engine, 'hello')).toBeNull();
    expect(ctx.sources).toEqual([]);
    expect(duck.events).toEqual([]);
  });

  it('announces the winner: the name starts as "The winner is..." ends, the music ducked throughout', async () => {
    const { ctx, engine, duck } = await setup();
    ctx.currentTime = 10;
    announceWinner(engine, 'fireboy');
    expect(ctx.sources.map((s) => [s.buffer!.path, s.started])).toEqual([
      ['voice/winner-is.mp3', 10],
      ['voice/fighter-fireboy.mp3', 11.8],
    ]);
    const t = targets(duck.events);
    expect(t.at(-2)).toEqual(['target', ANNOUNCER_DUCK, 11.8, expect.any(Number)]);
    expect(t.at(-1)![1]).toBe(1);
    expect(t.at(-1)![2]).toBeCloseTo(13.3);
  });

  it('says nothing for a winner it cannot name', async () => {
    const { ctx, engine } = await setup();
    announceWinner(engine, 'mario');
    expect(ctx.sources).toEqual([]);
  });
});
