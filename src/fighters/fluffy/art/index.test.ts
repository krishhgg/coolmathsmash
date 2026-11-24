import { describe, expect, it } from 'vitest';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { art } from '.';

/** Canonical clip lengths (loops: any length; holds: any length, not looping). Engine action names (docs/art.md). */
const LENGTHS: Record<string, number | 'loop' | 'hold'> = {
  idle: 'loop',
  walk: 'loop',
  dash: 11,
  run: 'loop',
  runBrake: 14,
  turn: 8,
  crouch: 'hold',
  jumpSquat: 3,
  jump: 'hold',
  doubleJump: 30,
  fall: 'loop',
  land: 4,
};

describe('fluffy art', () => {
  it('has every canonical clip with its length', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
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

  it('sits on the floor about 11 units tall and 10 wide, like his hurtbox', () => {
    expect(art.height).toBe(11);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(10.5);
    expect(-y0).toBeLessThan(11.5);
    expect(x1 - x0).toBeGreaterThan(9.5);
    expect(x1 - x0).toBeLessThan(11.5);
  });

  it('never sinks into the floor while grounded', () => {
    for (const name of ['idle', 'walk', 'run', 'crouch', 'jumpSquat', 'land', 'runBrake', 'turn'])
      for (let f = 0; f <= art.clips[name]!.length; f++)
        for (const g of [0, 7, 15])
          expect(poseBounds(art, samplePose(art, name, f, g))[3], `${name}@${f}`).toBeLessThan(0.25);
  });

  it('has five costumes with the same colour keys, an icon and the candy', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes).sort()).toEqual(['candy', 'default', 'halloween', 'lime', 'xmas']);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
    expect(art.projectiles?.candy).toBeDefined();
  });
});
