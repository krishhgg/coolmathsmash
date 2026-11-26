import { describe, expect, it } from 'vitest';
import { poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import {
  AIR_DODGE_NEUTRAL,
  GETUP_ROLL,
  GETUP_STAND,
  GRAB,
  ROLL_BACK,
  ROLL_FORWARD,
  SPOT_DODGE,
  TECH_IN_PLACE,
  TECH_ROLL,
} from '../../../sim/constants';
import { moves } from '../moves';
import { BOX_DROP } from '../timing';
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
  spotDodge: SPOT_DODGE.faf - 1,
  rollForward: ROLL_FORWARD.faf - 1,
  rollBack: ROLL_BACK.faf - 1,
  airDodge: AIR_DODGE_NEUTRAL.faf - 1,
  ledgeCatch: 19,
  ledgeHang: 'loop',
  ledgeClimb: 34,
  ledgeRoll: 45,
  ledgeJump: 20,
  ledgeAttack: 55,
  hitstun: 20,
  tumble: 'loop',
  helpless: 'loop',
  down: 'loop',
  getupStand: GETUP_STAND.faf - 1,
  getupRoll: GETUP_ROLL.faf - 1,
  techInPlace: TECH_IN_PLACE.faf - 1,
  techRoll: TECH_ROLL.faf - 1,
  dizzy: 'loop',
  grabHold: 'loop',
  grabbed: 'loop',
  grabRelease: GRAB.releaseLag,
  taunt: 60,
};

describe('runner art', () => {
  it('reveals the Box Drop exit cue on the first cancellable frame and restores Runner on release', () => {
    const poseAt = (frame: number) =>
      samplePose(art, 'downB', moveClipFrame(art.clips.downB!, frame, moves.downB), frame).symbols;
    expect(poseAt(BOX_DROP.cancelFrom - 1)).toMatchObject({ fx1: 'crate', body: null });
    expect(poseAt(BOX_DROP.cancelFrom)).toMatchObject({ fx1: 'crateReady', body: null });
    expect(poseAt(BOX_DROP.release)).toMatchObject({ fx1: 'crateReady', fxBack: 'contact' });
    expect(poseAt(BOX_DROP.release + 3).fx1).toBeNull();
    expect(poseAt(BOX_DROP.release + 3).body).toBe('body');
  });

  it('has every canonical clip with its length, and a timed clip for every move', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
    for (const [name, move] of Object.entries(moves)) {
      expect(art.clips[name]?.active, name).toBeDefined();
      expect(art.clips[name]!.length, name).toBe(move.faf - 1);
    }
  });

  it("keys every move's strike on its own hit windows, so the clip plays frame for frame", () => {
    for (const [name, move] of Object.entries(moves)) {
      const impact = move.throw?.frame ?? move.pummel?.frame;
      const windows = move.hits.length ? move.hits.map((h) => h.frames) : [[impact, impact]];
      expect(art.clips[name]!.active, name).toEqual(windows);
      for (let f = 0; f < move.faf; f++)
        expect(moveClipFrame(art.clips[name]!, f, move), `${name}@${f}`).toBe(f);
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
    for (const [costume, swaps] of Object.entries(art.costumeSwaps ?? {})) {
      expect(art.palettes[costume], costume).toBeDefined();
      for (const [slot, sym] of Object.entries(swaps)) {
        expect(slots.has(slot), `${costume}: slot ${slot}`).toBe(true);
        if (sym !== null) expect(art.rig.symbols[sym], `${costume}: symbol ${sym}`).toBeDefined();
      }
    }
  });

  it("reaches into every hitbox's inner half with a drawn part during the move's active frames", () => {
    const misses: string[] = [];
    for (const [name, move] of Object.entries(moves)) {
      const clip = art.clips[name]!;
      for (const { frames, boxes } of move.hits)
        for (let f = frames[0]; f <= frames[1]; f++) {
          const pose = samplePose(art, name, moveClipFrame(clip, f, move), f);
          for (const { x, y, radius } of boxes) {
            const probes = [
              [0, 0],
              ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [Math.cos(i * 0.785), Math.sin(i * 0.785)]),
            ];
            const hit = probes.some(
              ([dx, dy]) => slotsCovering(art, pose, x + dx! * radius * 0.5, -y - dy! * radius * 0.5).length,
            );
            if (!hit) misses.push(`${name}@${f} (${x}, ${y})`);
          }
        }
    }
    expect(misses).toEqual([]);
  });

  it('stands 13 units tall to the tips of her antennae and about 10 wide, feet on the ground', () => {
    expect(art.height).toBe(13);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(12.5);
    expect(-y0).toBeLessThan(13.8);
    expect(x1 - x0).toBeGreaterThan(9);
    expect(x1 - x0).toBeLessThan(12.5);
  });

  it('keeps every frame of the getup attack above the floor, within 0.2 units', () => {
    const sunk: string[] = [];
    for (let f = 0; f <= art.clips.getupAttack!.length; f++) {
      const bottom = poseBounds(art, samplePose(art, 'getupAttack', f, f))[3];
      if (bottom > 0.2) sunk.push(`getupAttack@${f} ${bottom.toFixed(2)}`);
    }
    expect(sunk).toEqual([]);
  });

  it('keeps her feet on the floor through the grounded loops', () => {
    for (const name of ['idle', 'walk'])
      for (let f = 0; f < art.clips[name]!.length; f += 2)
        expect(poseBounds(art, samplePose(art, name, f, f))[3], `${name}@${f}`).toBeCloseTo(0, 0);
  });

  it('has five costumes with the same colour keys, default first, and an icon', () => {
    const names = Object.keys(art.palettes);
    expect(names).toEqual(['default', 'skater', 'lizard', 'bunny', 'pastafarian']);
    const keys = Object.keys(art.palettes.default).sort();
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
  });
});
