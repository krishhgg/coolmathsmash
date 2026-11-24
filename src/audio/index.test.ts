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
});
