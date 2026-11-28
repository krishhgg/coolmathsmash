import { describe, expect, it } from 'vitest';
import { floorFindings, turnFindings, type SwingChecks } from './swingChecks';
import type { AnimClip, FighterArt } from './types';

const box = (half: number) => [
  { d: `M ${-half} ${-half} L ${half} ${-half} L ${half} ${half} L ${-half} ${half} Z`, fill: '#000000' },
];

/** Four frames: the wheel turns 180 degrees a frame and the arm 90, and the body drops by `drop`. */
const clip = (drop = 0): AnimClip => ({
  length: 4,
  keys: [
    { frame: 0, pose: {}, ease: 'linear' },
    { frame: 4, pose: { body: { y: drop }, wheel: { rot: 720 }, arm: { rot: 360 } } },
  ],
});

/** A body with an arm and a wheel under it, standing on the floor. */
const art: FighterArt = {
  height: 3,
  icon: '',
  palettes: { default: {} },
  rig: {
    bones: [
      { name: 'root', x: 0, y: 0 },
      { name: 'body', parent: 'root', x: 0, y: -2 },
      { name: 'arm', parent: 'body', x: 0.5, y: 0 },
      { name: 'wheel', parent: 'body', x: 0, y: 1.5 },
    ],
    slots: [
      { name: 'body', bone: 'body', symbol: 'body' },
      { name: 'arm', bone: 'arm', symbol: 'arm' },
      { name: 'wheel', bone: 'wheel', symbol: 'wheel' },
    ],
    symbols: { body: box(1), arm: box(0.2), wheel: box(0.5) },
  },
  clips: { roll: clip(), sink: clip(2), idle: { length: 0, keys: [{ frame: 0 }] } },
};

const turned = (checks: SwingChecks) => turnFindings(art, checks).map((f) => `${f.clip} ${f.part}`);
const parts = (checks: SwingChecks) => [...new Set(turned(checks))].sort();

describe('the swing checks', () => {
  it('report every part that turns too far in a frame', () => {
    expect(parts({ ground: ['roll'], air: [] })).toEqual(['roll arm', 'roll wheel']);
  });

  it('leave a bone listed as spinning out of the turn check, in every clip when it names none', () => {
    const spins = [{ bone: 'wheel', why: 'a wheel' }];
    expect(parts({ ground: ['roll', 'sink'], air: [], spins })).toEqual(['roll arm', 'sink arm']);
  });

  it('leave it out only in the clips it names', () => {
    const spins = [{ bone: 'wheel', why: 'spins while it sinks', clips: ['sink'] }];
    expect(parts({ ground: ['roll', 'sink'], air: [], spins })).toEqual([
      'roll arm',
      'roll wheel',
      'sink arm',
    ]);
  });

  it('still run the other checks on a spinning bone', () => {
    const spins = [{ bone: 'wheel', why: 'a wheel' }];
    const sunk = floorFindings(art, { ground: ['roll', 'sink'], air: [], spins });
    expect([...new Set(sunk.map((f) => `${f.clip} ${f.part}`))]).toEqual(['sink wheel']);
  });

  it('refuse a spin on a bone or clip the art does not have', () => {
    expect(() =>
      turnFindings(art, { ground: ['roll'], air: [], spins: [{ bone: 'tyre', why: 'typo' }] }),
    ).toThrow('no bone tyre');
    expect(() =>
      turnFindings(art, {
        ground: ['roll'],
        air: [],
        spins: [{ bone: 'wheel', why: 'typo', clips: ['rol'] }],
      }),
    ).toThrow('rol');
  });
});
