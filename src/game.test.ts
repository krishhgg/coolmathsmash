import { describe, expect, it } from 'vitest';
import { Game } from './game';
import type { Renderer } from './render/renderer';
import type { SimEvent } from './sim/events';

const renderer = { render() {}, stepCamera() {} } as unknown as Renderer;
const neutral = () => ({ x: 0, y: 0, cx: 0, cy: 0, buttons: 0 });

describe('Game.onEvents', () => {
  it('hands listeners each simulated frame its events until they unsubscribe', () => {
    const game = new Game(renderer, true);
    const seen: { frame: number; events: SimEvent[] }[] = [];
    const off = game.onEvents((events, state) => seen.push({ frame: state.frame, events: [...events] }));
    for (let i = 0; i < 30; i++) game.step([neutral(), neutral()]);
    expect(seen.map((s) => s.frame)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(seen.some((s) => s.events.some((e) => e.type === 'land'))).toBe(true);
    off();
    game.step([neutral(), neutral()]);
    expect(seen).toHaveLength(30);
  });
});

describe('Game.inputSource', () => {
  it('feeds real-time frames, and the loop only renders in manual mode', () => {
    const game = new Game(renderer, false);
    const right = { ...neutral(), x: 100 };
    game.inputSource = () => [right, neutral()];
    game.loop.tick(0);
    game.loop.tick(1000 / 60 + 0.01);
    expect(game.inputLog).toEqual([[right, neutral()]]);
    game.manual = true;
    game.loop.tick(1000 / 30);
    expect(game.inputLog).toHaveLength(1);
  });
});
