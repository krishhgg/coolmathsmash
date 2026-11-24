import { describe, expect, it } from 'vitest';
import { poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { art } from '.';

/** Canonical clip lengths (loops: any length). */
const LENGTHS: Record<string, number | 'loop' | 'hold'> = {
  idle: 'loop',
  walk: 'loop',
  dash: 10,
  run: 'loop',
  runBrake: 14,
  turn: 8,
  crouch: 'hold',
  jumpSquat: 3,
  jump: 40,
  doubleJump: 30,
  fall: 'loop',
  land: 4,
  shield: 'hold',
  spotDodge: 27,
  rollForward: 31,
  rollBack: 31,
  airDodge: 49,
  ledgeCatch: 8,
  ledgeHang: 'loop',
  ledgeClimb: 34,
  ledgeRoll: 50,
  ledgeJump: 20,
  ledgeAttack: 55,
  hitstun: 20,
  tumble: 'loop',
  helpless: 'loop',
  knockdown: 'loop',
  getUp: 30,
  tech: 26,
  techRoll: 40,
  dizzy: 'loop',
  grabHold: 'loop',
  grabbed: 'loop',
  taunt: 60,
};

/** Fireboy's frame data: [first active, last active, FAF, hitboxes (x, y up, r)]. */
const MOVES: Record<string, [number, number, number, [number, number, number][]]> = {
  jab1: [3, 4, 17, [[6, 6, 3.5]]],
  jab2: [3, 4, 19, [[6.5, 6, 3.5]]],
  jab3: [5, 7, 32, [[7, 6, 5]]],
  ftilt: [6, 8, 28, [[8.5, 3.5, 3.8]]],
  utilt: [5, 10, 30, [[2, 15, 5]]],
  dtilt: [5, 7, 22, [[8, 1, 3.5]]],
  dashAttack: [6, 18, 38, [[6, 4, 4.5]]],
  fsmash: [15, 17, 50, [[10, 6, 6]]],
  usmash: [10, 14, 44, [[0, 17, 7]]],
  dsmash: [6, 7, 46, [[9, 1, 4.5]]],
  nair: [3, 24, 42, [[0, 6, 7.5]]],
  fair: [14, 17, 52, [[7, 4, 5.5]]],
  bair: [6, 9, 33, [[-8, 6, 4.5]]],
  uair: [4, 8, 32, [[2, 15, 5.5]]],
  dair: [14, 17, 44, [[0, -2, 5]]],
  grab: [6, 7, 30, [[6, 6, 4]]],
  dashGrab: [9, 10, 38, [[8, 6, 4]]],
  pummel: [3, 3, 18, []],
  fthrow: [12, 12, 30, []],
  bthrow: [16, 16, 38, []],
  uthrow: [12, 12, 34, []],
  dthrow: [18, 18, 38, []],
  neutralSpecial: [14, 14, 44, []],
  sideSpecial: [10, 24, 50, [[5, 5, 5]]],
  upSpecial: [7, 34, 40, [[0, 6, 6]]],
  downSpecial: [9, 12, 40, [[0, 4, 9]]],
  getupAttack: [
    18,
    20,
    50,
    [
      [7, 3, 5],
      [-7, 3, 5],
    ],
  ],
};

describe('fireboy art', () => {
  it('has every canonical clip with its length', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
    for (const [name, [, , faf]] of Object.entries(MOVES))
      expect(art.clips[name]?.length, name).toBe(faf - 1);
  });

  it('only references bones, slots and symbols that exist, with keys in order inside the clip', () => {
    const bones = new Set(art.rig.bones.map((b) => b.name));
    const slots = new Set(art.rig.slots.map((s) => s.name));
    for (const [name, clip] of Object.entries(art.clips)) {
      let last = -Infinity;
      for (const key of clip.keys) {
        expect(key.frame, name).toBeGreaterThanOrEqual(last);
        expect(key.frame, name).toBeLessThanOrEqual(clip.length);
        last = key.frame;
        for (const bone of Object.keys(key.pose ?? {}))
          expect(bones.has(bone), `${name}: bone ${bone}`).toBe(true);
        for (const [slot, sym] of Object.entries({ ...clip.swaps, ...key.swaps })) {
          expect(slots.has(slot), `${name}: slot ${slot}`).toBe(true);
          if (sym !== null) expect(art.rig.symbols[sym], `${name}: symbol ${sym}`).toBeDefined();
        }
      }
      for (let f = 0; f <= clip.length; f++)
        expect(() => samplePose(art, name, f, f), `${name}@${f}`).not.toThrow();
    }
  });

  it('covers every hitbox centre with a drawn part during the active frames', () => {
    const misses: string[] = [];
    for (const [name, [first, lastActive, , boxes]] of Object.entries(MOVES)) {
      for (let f = first - 1; f <= lastActive; f++) {
        const pose = samplePose(art, name, f, f);
        for (const [x, y] of boxes)
          if (!slotsCovering(art, pose, x, -y).length) misses.push(`${name}@${f} (${x}, ${y})`);
      }
    }
    expect(misses).toEqual([]);
  });

  it('stands about 15 units tall and 8 wide, feet on the ground', () => {
    expect(art.height).toBe(15);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(14.5);
    expect(-y0).toBeLessThan(15.5);
    expect(x1 - x0).toBeGreaterThan(7.5);
    expect(x1 - x0).toBeLessThan(9);
  });

  it('has costumes with the same colour keys, an icon and a fireball', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes).length).toBeGreaterThanOrEqual(2);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
    expect(art.projectiles?.fireball).toBeDefined();
  });
});
