import { describe, expect, it } from 'vitest';
import { poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import { moves } from '../moves';
import { stats } from '../stats';
import { art } from '.';
import type { MoveClip } from './attacks';

/** Canonical clip lengths (loops: any length; hold: not looping). */
const LENGTHS: Record<string, number | 'loop' | 'hold'> = {
  idle: 'loop',
  walk: 'loop',
  dash: 11,
  run: 'loop',
  runBrake: 14,
  turn: 12,
  crouch: 'hold',
  jumpSquat: 3,
  jump: 40,
  doubleJump: 30,
  fall: 'loop',
  land: 4,
  taunt: 60,
  shield: 'hold',
  shieldDrop: 11,
  shieldBreak: 30,
  dizzy: 'loop',
  spotDodge: 26,
  rollForward: 30,
  rollBack: 30,
  airDodge: 46,
  ledgeCatch: 8,
  ledgeHang: 'loop',
  ledgeClimb: 33,
  ledgeRoll: 49,
  ledgeJump: 20,
  ledgeAttack: 55,
  hitstun: 20,
  tumble: 'loop',
  helpless: 'loop',
  down: 'loop',
  knockdown: 'loop',
  downBound: 26,
  getupStand: 29,
  getUp: 29,
  techInPlace: 26,
  tech: 26,
  techRoll: 40,
  respawn: 'loop',
  grabHold: 'loop',
  grabbed: 'loop',
  jab1: 'hold',
  neutralSpecial: 'hold',
  upSpecial: 'hold',
};

describe('red ball art', () => {
  it('has every canonical clip with its length', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
  });

  it('has a clip per move, FAF - 1 long and keyed on the move hit windows', () => {
    for (const [name, move] of Object.entries(moves)) {
      const clip = art.clips[name] as MoveClip | undefined;
      expect(clip, name).toBeDefined();
      expect(clip!.length, name).toBe(move.faf - 1);
      expect(clip!.active, name).toEqual(move.hits.map((h) => h.frames));
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

  it('only shows effects where a key placed them', () => {
    const fxSlots = art.rig.slots.filter((s) => s.bone.startsWith('fx'));
    const strays = new Set<string>();
    for (const [name, clip] of Object.entries(art.clips))
      for (let f = 0; f <= clip.length; f++) {
        const pose = samplePose(art, name, f, 0);
        for (const slot of fxSlots) {
          const m = pose.world[slot.bone]!;
          const atRest = m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.tx === 0 && m.ty === 0;
          if (pose.symbols[slot.name] && atRest) strays.add(`${name} ${slot.name}`);
        }
      }
    expect([...strays]).toEqual([]);
  });

  it('covers every hitbox centre with the ball or the tongue from the frame before each hit window', () => {
    const misses: string[] = [];
    for (const [name, move] of Object.entries(moves))
      for (const { frames, boxes } of move.hits)
        for (let f = frames[0] - 1; f <= frames[1]; f++) {
          const pose = samplePose(art, name, moveClipFrame(art.clips[name]!, f, move), f);
          for (const { x, y } of boxes)
            if (!slotsCovering(art, pose, x, -y).length) misses.push(`${name}@${f} (${x}, ${y})`);
        }
    expect(misses).toEqual([]);
  });

  it('is a ball about 10.5 units across sitting on the origin, as tall as his stats', () => {
    expect(art.height).toBe(stats.height);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(10.2);
    expect(-y0).toBeLessThanOrEqual(stats.height);
    expect(x1 - x0).toBeGreaterThan(10.2);
    expect(x1 - x0).toBeLessThan(10.8);
  });

  it('bites the ledge corner where the engine hangs him', () => {
    expect(art.ledgeGrip).toEqual([stats.width / 2 + 0.5, -stats.height * 0.85]);
    const pose = samplePose(art, 'ledgeHang', 0, 0);
    expect(pose.symbols.fx2).toBe('bite');
    expect(pose.world.fx2!.tx).toBeCloseTo(art.ledgeGrip![0], 5);
    expect(pose.world.fx2!.ty).toBeCloseTo(art.ledgeGrip![1], 5);
  });

  it('has his red and at least four alternate costumes with the same colour keys, and an icon', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes).length).toBeGreaterThanOrEqual(5);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    const used = new Set<string>();
    for (const sym of Object.values(art.rig.symbols))
      if (Array.isArray(sym))
        for (const shape of sym) {
          for (const paint of [shape.fill, shape.stroke?.color])
            if (typeof paint === 'string') used.add(paint);
            else if (paint) for (const stop of paint.stops) used.add(stop.color);
        }
    for (const color of used) expect(keys, `palette key ${color}`).toContain(color);
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
  });
});
