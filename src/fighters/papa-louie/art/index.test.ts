import { describe, expect, it } from 'vitest';
import { poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moves } from '../moves';
import { art } from '.';

/** Action clips the engine plays by name, with the lengths its actions run (loops: any length). */
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

describe('papa louie art', () => {
  it('has every canonical clip with its length, and a clip per move that ends on its first actionable frame', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
    for (const [name, move] of Object.entries(moves))
      expect(art.clips[name]?.length, name).toBe(move.faf - 1);
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

  it('covers every hitbox centre with a drawn part during its hit window', () => {
    const misses: string[] = [];
    for (const [name, move] of Object.entries(moves)) {
      if (!art.clips[name]) continue;
      for (const hit of move.hits)
        for (let f = hit.frames[0] - 1; f <= hit.frames[1]; f++) {
          const pose = samplePose(art, name, f, f);
          for (const box of hit.boxes)
            if (!slotsCovering(art, pose, box.x, -box.y).length)
              misses.push(`${name}@${f} box ${box.id} (${box.x}, ${box.y})`);
        }
    }
    expect(misses).toEqual([]);
  });

  it('stands about 15 units tall, feet on the ground', () => {
    expect(art.height).toBe(15);
    const [, y0, , y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(14.5);
    expect(-y0).toBeLessThan(15.5);
  });

  it('has costumes with the same colour keys, an icon, and his three throwables', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes).length).toBeGreaterThanOrEqual(2);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
    for (const p of ['pepperBomb', 'shaker', 'cheeseCloud']) expect(art.projectiles?.[p], p).toBeDefined();
  });
});
