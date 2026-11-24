import { describe, expect, it } from 'vitest';
import { reach } from './author';
import { flattenPath, shapesContain } from './geometry';
import { clipTime, ease, resolveSymbol, samplePose, toLocal } from './sample';
import { symbolsToSvg } from './svg';
import type { FighterArt } from './types';

const square = 'M-1 -1L1 -1L1 1L-1 1Z';

const art: FighterArt = {
  height: 2,
  icon: '',
  palettes: { default: { ink: '#123456' } },
  rig: {
    bones: [
      { name: 'root', x: 0, y: 0 },
      { name: 'arm', parent: 'root', x: 0, y: -1 },
      { name: 'hand', parent: 'arm', x: 0, y: 1 },
    ],
    slots: [
      { name: 'arm', bone: 'arm', symbol: 'a' },
      { name: 'hand', bone: 'hand', symbol: 'flicker' },
      { name: 'fx', bone: 'root', symbol: null },
    ],
    symbols: {
      a: [{ d: square, fill: 'ink' }],
      b: [{ d: square, fill: '#ff0000' }],
      flicker: { loop: ['a', 'b'], fps: 30 },
    },
  },
  clips: {
    idle: {
      length: 10,
      loop: true,
      keys: [
        { frame: 0, pose: {} },
        { frame: 5, pose: { arm: { rot: 90 } } },
      ],
    },
    swing: {
      length: 10,
      keys: [
        { frame: 0, pose: { arm: { x: 0 } }, ease: 'linear' },
        { frame: 4, swaps: { fx: 'a' }, z: { arm: 5 } },
        { frame: 10, pose: { arm: { x: 10, sx: 3 } } },
      ],
      swaps: { arm: 'b' },
    },
  },
};

describe('ease', () => {
  it('hits the endpoints and shapes the middle', () => {
    for (const kind of ['linear', 'in', 'out', 'inOut', 'outBack'] as const) {
      expect(ease(kind, 0)).toBeCloseTo(0);
      expect(ease(kind, 1)).toBeCloseTo(1);
    }
    expect(ease('step', 0.99)).toBe(0);
    expect(ease('in', 0.5)).toBeLessThan(0.5);
    expect(ease('out', 0.5)).toBeGreaterThan(0.5);
    expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map((t) => ease('outBack', t)))).toBeGreaterThan(1);
  });
});

describe('samplePose', () => {
  it('tweens bones between posed keys with the key ease', () => {
    const at = (f: number) => samplePose(art, 'swing', f, 0).local.arm!;
    expect(at(0).x).toBe(0);
    expect(at(5).x).toBeCloseTo(5);
    expect(at(10).x).toBe(10);
    expect(at(10).sx).toBe(3);
  });

  it('holds the last key of a non-looping clip and clamps before the first', () => {
    expect(samplePose(art, 'swing', 99, 0).local.arm!.x).toBe(10);
    expect(samplePose(art, 'swing', -3, 0).local.arm!.x).toBe(0);
    expect(clipTime(art.clips.swing!, 99)).toBe(10);
  });

  it('loops back from the last key to the first', () => {
    expect(clipTime(art.clips.idle!, 13)).toBe(3);
    expect(samplePose(art, 'idle', 5, 0).local.arm!.rot).toBeCloseTo(90);
    expect(samplePose(art, 'idle', 10, 0).local.arm!.rot).toBeCloseTo(0);
    expect(samplePose(art, 'idle', 7.5, 0).local.arm!.rot).toBeCloseTo(45);
  });

  it('falls back to idle for unknown clips', () => {
    expect(samplePose(art, 'nope', 5, 0)).toEqual(samplePose(art, 'idle', 5, 0));
  });

  it('applies clip swaps, then key swaps and draw order from the key on (pose-less keys do not break tweens)', () => {
    const before = samplePose(art, 'swing', 3, 0);
    expect(before.symbols).toMatchObject({ arm: 'b', fx: null });
    expect(before.z.arm).toBe(0);
    const after = samplePose(art, 'swing', 4, 0);
    expect(after.symbols).toMatchObject({ arm: 'b', fx: 'a' });
    expect(after.z.arm).toBe(5);
    expect(after.local.arm!.x).toBeCloseTo(4);
  });

  it('plays movie-clip symbols on the match clock', () => {
    expect(samplePose(art, 'idle', 0, 0).symbols.hand).toBe('a');
    expect(samplePose(art, 'idle', 0, 2).symbols.hand).toBe('b');
    expect(samplePose(art, 'idle', 0, 4).symbols.hand).toBe('a');
    expect(resolveSymbol(art.rig.symbols, 'flicker', 3)).toBe('b');
  });

  it('composes world transforms parent first (rot > 0 is clockwise, y down)', () => {
    const p = samplePose(art, 'idle', 5, 0);
    const hand = p.world.hand!;
    expect(hand.tx).toBeCloseTo(-1);
    expect(hand.ty).toBeCloseTo(-1);
    const [lx, ly] = toLocal(hand, -1, -1);
    expect(lx).toBeCloseTo(0);
    expect(ly).toBeCloseTo(0);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(samplePose(art, 'swing', 7, 31))).toBe(
      JSON.stringify(samplePose(art, 'swing', 7, 31)),
    );
  });
});

describe('reach', () => {
  it('puts the end of a two-bone limb on the target', () => {
    const rig = {
      bones: [
        { name: 'root', x: 0, y: 0 },
        { name: 'upper', parent: 'root', x: 0, y: 0 },
        { name: 'lower', parent: 'upper', x: 0, y: 1 },
      ],
      slots: [],
      symbols: {},
    };
    const target = [1.2, 0.9] as const;
    const pose = reach(rig, {}, 'upper', 'lower', 1, target, 1);
    const limb: FighterArt = { ...art, rig, clips: { idle: { length: 1, keys: [{ frame: 0, pose }] } } };
    const m = samplePose(limb, 'idle', 0, 0).world.lower!;
    expect(m.c * 1 + m.tx).toBeCloseTo(target[0], 2);
    expect(m.d * 1 + m.ty).toBeCloseTo(target[1], 2);
  });
});

describe('geometry and svg', () => {
  it('flattens curves and tests points even-odd', () => {
    const ring = [{ d: 'M-2 -2L2 -2L2 2L-2 2Z M-1 -1L1 -1L1 1L-1 1Z', fill: 'ink' }];
    expect(shapesContain(ring, 1.5, 0)).toBe(true);
    expect(shapesContain(ring, 0, 0)).toBe(false);
    expect(flattenPath('M0 0Q1 1 2 0C3 0 3 1 2 2Z', 4)[0]!.length).toBe(2 + 8 + 8);
  });

  it('writes standalone svg with palette colours', () => {
    const svg = symbolsToSvg(art.rig.symbols, ['a', 'flicker'], art.palettes.default, [-1, -1, 2, 2]);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="-1 -1 2 2">/);
    expect(svg).toContain('fill="#123456"');
  });
});
