import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeContext } from './testing';

describe('audio.init', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('still starts when the browser blocks localStorage, keeping settings in memory', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', (path: string) => Promise.resolve({ arrayBuffer: () => FakeContext.load(path) }));
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    const { audio } = await import('./index');
    expect(() => audio.init(new EventTarget())).not.toThrow();
    expect(audio.engine).not.toBeNull();
    audio.setVolume('music', 0.3);
    expect(audio.settings.music).toBe(0.3);
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('starts music asked for before init once init runs', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', (path: string) => Promise.resolve({ arrayBuffer: () => FakeContext.load(path) }));
    const { audio } = await import('./index');
    audio.music('menu');
    audio.init(new EventTarget());
    await new Promise((r) => setTimeout(r, 0));
    const ctx = audio.engine!.ctx as unknown as FakeContext;
    expect(ctx.sources.some((s) => s.loop && s.buffer?.path.endsWith('music/menu.mp3'))).toBe(true);
  });
});
