import { describe, expect, it } from 'vitest';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { stats } from '../stats';
import { art } from '.';

/** Canonical clips (docs/art.md) and the engine's own action names, with their lengths (loops: any length). */
const LENGTHS: Record<string, number | 'loop' | 'hold'> = {
  idle: 'loop',
  walk: 'loop',
  dash: stats.dashFrames,
  run: 'loop',
  runBrake: 14,
  turn: 12,
  crouch: 'hold',
  jumpSquat: stats.jumpSquat,
  jump: 40,
  doubleJump: 30,
  fall: 'loop',
  land: 4,
  taunt: 60,
  helpless: 'loop',
  shield: 'hold',
  shieldDrop: 11,
  shieldBreak: 40,
  dizzy: 'loop',
  spotDodge: 26,
  rollForward: 30,
  rollBack: 30,
  airDodge: 49,
  ledgeCatch: 8,
  ledgeHang: 'loop',
  ledgeClimb: 33,
  ledgeRoll: 49,
  ledgeJump: 20,
  ledgeAttack: 55,
  hitstun: 20,
  tumble: 'loop',
  down: 'loop',
  knockdown: 'loop',
  downBound: 26,
  getupStand: 29,
  getUp: 29,
  techInPlace: 26,
  tech: 26,
  techRoll: 40,
  getupRoll: 35,
  respawn: 'loop',
  grabbed: 'loop',
};

describe('snail bob art', () => {
  it('has every canonical movement, defence, ledge and hurt clip', () => {
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

  it('stands 13 units tall and about 12 wide, feet on the ground', () => {
    expect(art.height).toBe(stats.height);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(12.5);
    expect(-y0).toBeLessThan(13.5);
    expect(x1 - x0).toBeGreaterThan(stats.width - 0.5);
    expect(x1 - x0).toBeLessThan(stats.width + 1.5);
  });

  it('has costumes with the same colour keys, an icon and a ledge grip', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes).length).toBeGreaterThanOrEqual(5);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
    expect(art.ledgeGrip![0]).toBeCloseTo(stats.width / 2 + 0.5);
    expect(art.ledgeGrip![1]).toBeCloseTo(-stats.height * 0.85);
  });
});
