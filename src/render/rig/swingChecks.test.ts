import { describe, expect, it } from 'vitest';
import { floorFindings, orderFindings, turnFindings, type SwingChecks } from './swingChecks';
import type { AnimClip, FighterArt, PathShape } from './types';

const square = (half: number, x = 0, y = 0) =>
  `M ${x - half} ${y - half} L ${x + half} ${y - half} L ${x + half} ${y + half} L ${x - half} ${y + half} Z`;
const box = (half: number) => [{ d: square(half), fill: '#000000' }];

/** Four frames: the wheel turns 180 degrees a frame and the arm 90, and the body drops by `drop`. */
const clip = (drop = 0): AnimClip => ({
  length: 4,
  keys: [
    { frame: 0, pose: {}, ease: 'linear' },
    { frame: 4, pose: { body: { y: drop }, wheel: { rot: 720 }, arm: { rot: 360 } } },
  ],
});

/** The same turns, with the cloud slot showing `cloud` from frame 2 on, drawn at `z` (over everything by default). */
const brawl = (cloud: string, z = 10): AnimClip => ({
  ...clip(),
  keys: [clip().keys[0]!, { frame: 2, swaps: { cloud }, z: { cloud: z } }, clip().keys[1]!],
});

/** A cloud that covers the fighter like `box(3)`, with `hole` cut out of it. */
const holed = (hole: string): PathShape[] => [{ d: `${square(3)} ${hole}`, fill: '#000000' }];

/** A body with an arm holding a stick and a wheel under it, standing on the floor, and an effect cloud. */
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
      { name: 'fx', parent: 'root', x: 0, y: -2 },
    ],
    slots: [
      { name: 'body', bone: 'body', symbol: 'body' },
      { name: 'arm', bone: 'arm', symbol: 'arm' },
      { name: 'stick', bone: 'arm', symbol: 'stick' },
      { name: 'wheel', bone: 'wheel', symbol: 'wheel' },
      { name: 'cloud', bone: 'fx', symbol: null },
    ],
    symbols: {
      body: box(1),
      arm: box(0.2),
      stick: box(0.5),
      wheel: box(0.5),
      cloud: box(3),
      smallCloud: box(0.4),
      // A hole round the arm, which sits 0.5 right of the cloud's middle.
      holedCloud: holed(square(0.35, 0.5)),
      // A cloud that boils between a whole drawing and one with the hole.
      boilingCloud: { loop: ['cloud', 'holedCloud'], fps: 10 },
      thinCloud: [
        {
          d: square(3),
          fill: {
            type: 'linear',
            x0: 0,
            y0: 0,
            x1: 1,
            y1: 0,
            stops: [{ offset: 0, color: '#000000', alpha: 0.88 }],
          },
        },
      ],
    },
  },
  clips: {
    roll: clip(),
    sink: clip(2),
    idle: { length: 0, keys: [{ frame: 0 }] },
    // The stick goes from over the body to under it on frame 1.
    swap: {
      length: 2,
      keys: [
        { frame: 0, pose: {} },
        { frame: 1, z: { stick: -1 } },
      ],
    },
    brawl: brawl('cloud'),
    smallBrawl: brawl('smallCloud'),
    holedBrawl: brawl('holedCloud'),
    boilingBrawl: brawl('boilingCloud'),
    thinBrawl: brawl('thinCloud'),
    lowBrawl: brawl('cloud', 2.5),
    // The body turns round to face the other way in one frame (sx -1 to 1), as a whirl round is drawn. The arm keeps
    // its angle on screen: under the mirrored body its -40 points where 40 does after the flip.
    whirl: {
      length: 1,
      keys: [
        { frame: 0, pose: { body: { sx: -1 }, arm: { rot: -40 } }, ease: 'step' },
        { frame: 1, pose: { arm: { rot: 40 } } },
      ],
    },
    // The same flip with the arm's own turn left at 40: it flips with the body, a cel turning him round.
    whirlFlip: {
      length: 1,
      keys: [
        { frame: 0, pose: { body: { sx: -1 }, arm: { rot: 40 } }, ease: 'step' },
        { frame: 1, pose: { arm: { rot: 40 } } },
      ],
    },
    // The same flip with the arm swinging from 0 to 80: 80 degrees on screen, and 80 against the body.
    whirlSwing: {
      length: 1,
      keys: [
        { frame: 0, pose: { body: { sx: -1 }, arm: { rot: 0 } }, ease: 'step' },
        { frame: 1, pose: { arm: { rot: 80 } } },
      ],
    },
    // Mirrored throughout, the arm turning 70 degrees in a frame: as far on screen as unmirrored.
    mirroredSwing: {
      length: 1,
      keys: [
        { frame: 0, pose: { body: { sx: -1 }, arm: { rot: 0 } }, ease: 'linear' },
        { frame: 1, pose: { body: { sx: -1 }, arm: { rot: 70 } } },
      ],
    },
  },
};

const turned = (checks: SwingChecks) => turnFindings(art, checks).map((f) => `${f.clip} ${f.part}`);
const parts = (checks: SwingChecks) => [...new Set(turned(checks))].sort();
/** Each part that fails the turn check in `clip`, with the frames it fails on. */
const failing = (clip: string, checks: Partial<SwingChecks> = {}) => {
  const out: Record<string, number[]> = {};
  for (const f of turnFindings(art, { ground: [], air: [clip], ...checks }))
    (out[f.part] ??= []).push(f.frame);
  return out;
};

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

describe('a clip in the air that lands', () => {
  it('gets the floor check from the frame it is listed as standing on the floor', () => {
    const sunk = (checks: Partial<SwingChecks>) =>
      floorFindings(art, { ground: [], air: ['sink'], ...checks }).map((f) => f.frame);
    expect(sunk({})).toEqual([]);
    expect(sunk({ groundFrom: { sink: 3 } })).toEqual([3, 4]);
  });
});

describe('the turn check under a mirrored parent', () => {
  it('passes a part that keeps its angle on screen as its parent flips to face the other way', () => {
    expect(failing('whirl')).toEqual({});
  });

  it('passes a part that flips with its parent', () => {
    expect(failing('whirlFlip')).toEqual({});
  });

  it('fails a part that swings too far across the flip either way it is read', () => {
    expect(failing('whirlSwing')).toEqual({ arm: [1] });
  });

  it('measures a turn under a parent mirrored on both frames as it is drawn, the other way round', () => {
    const [found] = turnFindings(art, { ground: [], air: ['mirroredSwing'] });
    expect(found?.text).toBe('mirroredSwing@1 arm -70');
  });
});

describe('a cut', () => {
  const cuts = [{ clip: 'roll', frame: 2, why: 'a new shot' }];

  it('skips only the step into its frame in the turn check', () => {
    expect(failing('roll')).toEqual({ arm: [1, 2, 3, 4], wheel: [1, 2, 3, 4] });
    expect(failing('roll', { cuts })).toEqual({ arm: [1, 3, 4], wheel: [1, 3, 4] });
  });

  it('applies only to its own clip', () => {
    expect(failing('sink', { cuts })).toEqual({ arm: [1, 2, 3, 4], wheel: [1, 2, 3, 4] });
  });

  it('skips the step into its frame in the draw-order check', () => {
    const order = (checks: Partial<SwingChecks>) =>
      orderFindings(art, { ground: [], air: ['swap'], props: ['stick'], ...checks }).map((f) => f.text);
    expect(order({})).toEqual(['swap@1 stick under body']);
    expect(order({ cuts: [{ clip: 'swap', frame: 1, why: 'a new shot' }] })).toEqual([]);
  });

  it('refuses a clip the art does not have or a frame outside its clip', () => {
    const check = (clip: string, frame: number) => () =>
      turnFindings(art, { ground: [], air: ['roll'], cuts: [{ clip, frame, why: 'typo' }] });
    expect(check('rol', 2)).toThrow('no clip rol');
    expect(check('roll', 0)).toThrow('no frame 0');
    expect(check('roll', 5)).toThrow('no frame 5');
  });
});

describe('a cover', () => {
  const covered = (clip: string) => [{ clip, slot: 'cloud', from: 1, to: 4, why: 'a fight cloud' }];

  it('leaves out the parts it hides, on the frames it is drawn', () => {
    expect(failing('brawl')).toEqual({ arm: [1, 2, 3, 4], wheel: [1, 2, 3, 4] });
    expect(failing('brawl', { covered: covered('brawl') })).toEqual({ arm: [1], wheel: [1] });
  });

  it('leaves them out only on its own frames', () => {
    const covers = [{ clip: 'brawl', slot: 'cloud', from: 1, to: 3, why: 'a fight cloud' }];
    expect(failing('brawl', { covered: covers })).toEqual({ arm: [1, 4], wheel: [1, 4] });
  });

  it('still checks a part outside its bounds', () => {
    expect(failing('smallBrawl', { covered: covered('smallBrawl') })).toEqual({
      arm: [1, 2, 3, 4],
      wheel: [1, 2, 3, 4],
    });
  });

  it('still checks a part showing through a hole in it', () => {
    expect(failing('holedBrawl', { covered: covered('holedBrawl') })).toEqual({
      arm: [1, 2, 3, 4],
      wheel: [1],
    });
  });

  it('still checks a part showing through a hole in any frame of its loop', () => {
    expect(failing('boilingBrawl', { covered: covered('boilingBrawl') })).toEqual({
      arm: [1, 2, 3, 4],
      wheel: [1],
    });
  });

  it('still checks a part it is see-through over', () => {
    expect(failing('thinBrawl', { covered: covered('thinBrawl') })).toEqual({
      arm: [1, 2, 3, 4],
      wheel: [1, 2, 3, 4],
    });
  });

  it('still checks a part drawn over it', () => {
    // The cloud draws between the arm's stick and the wheel, so the wheel shows over it.
    expect(failing('lowBrawl', { covered: covered('lowBrawl') })).toEqual({ arm: [1], wheel: [1, 2, 3, 4] });
  });

  it('refuses a clip, slot or frames the art does not have', () => {
    const check = (clip: string, slot: string, from: number, to: number) => () =>
      turnFindings(art, { ground: [], air: ['brawl'], covered: [{ clip, slot, from, to, why: 'typo' }] });
    expect(check('brawl', 'clod', 1, 4)).toThrow('no slot clod');
    expect(check('brwl', 'cloud', 1, 4)).toThrow('no clip brwl');
    expect(check('brawl', 'cloud', 0, 4)).toThrow('no frames 0 to 4');
    expect(check('brawl', 'cloud', 3, 2)).toThrow('no frames 3 to 2');
    expect(check('brawl', 'cloud', 1, 5)).toThrow('no frames 1 to 5');
  });
});
