import { describe, expect, it } from 'vitest';
import { poseBounds, shapesBounds, shapesContain, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import type { PathShape } from '../../../render/rig/types';
import { fighter } from '..';
import { art } from '.';

/** Canonical clip lengths for the engine's actions (loops: any length; hold: plays once and holds). */
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
  shieldDrop: 11,
  spotDodge: 27,
  rollForward: 31,
  rollBack: 31,
  airDodge: 49,
  ledgeCatch: 19,
  ledgeHang: 'loop',
  ledgeClimb: 34,
  ledgeRoll: 45,
  ledgeJump: 20,
  helpless: 'loop',
};

describe('bob the robber art', () => {
  it('has every action clip with its length', () => {
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
        for (const slot of Object.keys(key.z ?? {})) expect(slots.has(slot), `${name}: z ${slot}`).toBe(true);
        for (const [slot, sym] of Object.entries({ ...clip.swaps, ...key.swaps })) {
          expect(slots.has(slot), `${name}: slot ${slot}`).toBe(true);
          if (sym !== null) expect(art.rig.symbols[sym], `${name}: symbol ${sym}`).toBeDefined();
        }
      }
      for (let f = 0; f <= clip.length; f++)
        expect(() => samplePose(art, name, f, f), `${name}@${f}`).not.toThrow();
    }
  });

  it('stands 14.5 units tall to the top of the beanie and about 8.5 wide, feet on the ground', () => {
    const pose = samplePose(art, 'idle', 0, 0);
    const [x0, y0, x1, y1] = poseBounds(art, pose);
    expect(y1).toBeCloseTo(0, 1);
    expect(x1 - x0).toBeGreaterThan(7.5);
    expect(x1 - x0).toBeLessThan(9.5);
    const [, crown] = shapesBounds((art.rig.symbols.hatFront as PathShape[]).filter((s) => s.fill === 'hat'));
    const head = pose.world.head!;
    expect(head.ty + crown * head.d).toBeCloseTo(-fighter.stats.height, 0);
    expect(-y0).toBeLessThanOrEqual(art.height + 0.05);
    expect(-y0).toBeGreaterThan(art.height - 0.5);
  });

  it('keeps locomotion soles clear of the floor and the hanging grip on the ledge', () => {
    for (const name of ['walk', 'dash', 'run', 'runBrake', 'turn', 'crouch']) {
      const clip = art.clips[name]!;
      for (let frame = 0; frame <= clip.length; frame++) {
        const pose = samplePose(art, name, frame, frame);
        expect(poseBounds(art, pose)[3], `${name}@${frame}`).toBeLessThanOrEqual(0.14);
      }
    }

    const [gx, gy] = art.ledgeGrip!;
    const hang = art.clips.ledgeHang!;
    for (let frame = 0; frame < hang.length; frame++) {
      const pose = samplePose(art, 'ledgeHang', frame, frame);
      expect(slotsCovering(art, pose, gx, gy - 0.35), `ledgeHang@${frame}`).toContain('handF');
    }
  });

  it('has costumes with the same colour keys and an icon', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes).sort()).toEqual(['black', 'default', 'explorer', 'spy']);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
  });

  it('keeps the spy headset and explorer kit on when clips change the head view', () => {
    for (const [clip, frame] of [
      ['idle', 0],
      ['run', 5],
      ['ledgeHang', 0],
    ] as const) {
      expect(samplePose(art, clip, frame, frame).symbols.gear).toBeNull();
      expect(samplePose(art, clip, frame, frame, 'black').symbols.gear).toBeNull();
      expect(samplePose(art, clip, frame, frame, 'spy').symbols.gear).toBe('goggles');
      const explorer = samplePose(art, clip, frame, frame, 'explorer').symbols;
      expect(explorer.gear).toBe('explorerHat');
      expect(explorer.torso).toBe('explorerJacket');
    }
  });

  it('draws a sole across the bottom of both shoe views', () => {
    for (const name of ['shoe', 'shoeFront']) {
      const sole = (art.rig.symbols[name] as PathShape[]).filter((shape) => shape.fill === 'sole');
      expect(shapesContain(sole, 0, 0.81), name).toBe(true);
      expect(shapesContain(sole, 0, 0.5), name).toBe(false);
    }
  });
});
