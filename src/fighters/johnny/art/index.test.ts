import { describe, expect, it } from 'vitest';
import { poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import { moves } from '../moves';
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
  shieldDrop: 11,
  hitstun: 20,
  tumble: 'loop',
  helpless: 'loop',
};

describe('johnny art', () => {
  it('has every canonical clip with its length', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
  });

  it('keys every move with its active windows', () => {
    for (const name of Object.keys(moves)) expect(art.clips[name]?.active, name).toBeDefined();
  });

  it("reaches into every hitbox's inner half with a drawn part during the move's active frames", () => {
    const probes = [
      [0, 0],
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [Math.cos(i * 0.785), Math.sin(i * 0.785)]),
    ];
    const misses: string[] = [];
    for (const [name, move] of Object.entries(moves)) {
      const clip = art.clips[name]!;
      for (const { frames, boxes } of move.hits)
        for (let f = frames[0]; f <= frames[1]; f++) {
          const pose = samplePose(art, name, moveClipFrame(clip, f, move), f);
          for (const { x, y, radius } of boxes)
            if (
              !probes.some(
                ([dx, dy]) =>
                  slotsCovering(art, pose, x + dx! * radius * 0.5, -y - dy! * radius * 0.5).length,
              )
            )
              misses.push(`${name}@${f} (${x}, ${y})`);
        }
    }
    expect(misses).toEqual([]);
  });

  it('keeps knees and boots out of the floor through the grounded moves', () => {
    const joints: [string, number, number][] = [
      ['shinB', 0, 0.5],
      ['footB', 2, 0.35],
      ['shinF', 0, 0.5],
      ['footF', 2, 0.35],
    ];
    for (const [name, move] of Object.entries(moves)) {
      if (move.kind === 'aerial' || move.leavesGround) continue;
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const { world } = samplePose(art, name, f, f);
        for (const [bone, x, y] of joints) {
          const m = world[bone]!;
          expect(m.b * x + m.d * y + m.ty, `${name}@${f} ${bone}`).toBeLessThan(1);
        }
      }
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

  it('stands about 17.5 units tall to the top of his quiff in his wide stance, boots on the ground', () => {
    expect(art.height).toBe(17.5);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(17);
    expect(-y0).toBeLessThan(18);
    expect(x1 - x0).toBeGreaterThan(9);
    expect(x1 - x0).toBeLessThan(13.5);
  });

  it('keeps his boots on the floor through the grounded loops', () => {
    for (const name of ['idle', 'walk'])
      for (let f = 0; f < art.clips[name]!.length; f += 2)
        expect(poseBounds(art, samplePose(art, name, f, f))[3], `${name}@${f}`).toBeCloseTo(0, 0);
  });

  it('keeps his boots above the rig root in every airborne clip', () => {
    for (const name of ['jump', 'doubleJump', 'fall', 'helpless', 'hitstun', 'tumble'])
      for (let f = 0; f <= art.clips[name]!.length; f++)
        expect(-poseBounds(art, samplePose(art, name, f, f))[1], `${name}@${f}`).toBeGreaterThanOrEqual(-0.4);
  });

  it('has costumes with the same colour keys, default first, and an icon', () => {
    const names = Object.keys(art.palettes);
    expect(names[0]).toBe('default');
    expect(names.length).toBeGreaterThanOrEqual(5);
    const keys = Object.keys(art.palettes.default).sort();
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
  });
});
