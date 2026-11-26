import { describe, expect, it } from 'vitest';
import { poseBounds, shapesBounds, shapesContain, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import type { PathShape } from '../../../render/rig/types';
import {
  AIR_DODGE_NEUTRAL,
  GETUP_ROLL,
  GETUP_STAND,
  GRAB,
  LEDGE_ATTACK,
  ROLL_BACK,
  ROLL_FORWARD,
  SPOT_DODGE,
  TECH_IN_PLACE,
  TECH_ROLL,
} from '../../../sim/constants';
import { fighter } from '..';
import { MUZZLE, STUN_GUN } from '../entities';
import { TASER_TIP } from './parts';
import { MUZZLE_LEAD } from './stunGun';
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
  spotDodge: SPOT_DODGE.faf - 1,
  rollForward: ROLL_FORWARD.faf - 1,
  rollBack: ROLL_BACK.faf - 1,
  airDodge: AIR_DODGE_NEUTRAL.faf - 1,
  ledgeCatch: 19,
  ledgeHang: 'loop',
  ledgeClimb: 34,
  ledgeRoll: 45,
  ledgeJump: 20,
  ledgeAttack: LEDGE_ATTACK.faf - 1,
  helpless: 'loop',
  hitstun: 20,
  tumble: 'loop',
  down: 'loop',
  getupStand: GETUP_STAND.faf - 1,
  getupRoll: GETUP_ROLL.faf - 1,
  techInPlace: TECH_IN_PLACE.faf - 1,
  techRoll: TECH_ROLL.faf - 1,
  grabbed: 'loop',
  grabHold: 'loop',
  grabRelease: GRAB.releaseLag,
  shieldBreak: 40,
  dizzy: 'loop',
  respawn: 'loop',
};

const moves = Object.entries(fighter.moves ?? {});

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

  it('has a clip for every move, ending at FAF - 1 with its hit windows (throw, pummel or shot frame) active', () => {
    expect(moves.length).toBe(28);
    for (const [name, move] of moves) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      expect(clip!.length, name).toBe(move.faf - 1);
      const impact = move.throw?.frame ?? move.pummel?.frame ?? STUN_GUN.shot;
      const windows = move.hits.length ? move.hits.map((h) => h.frames) : [[impact, impact]];
      expect(clip!.active, name).toEqual(windows);
    }
  });

  it("reaches into every hitbox's inner half with a drawn part on the move's active frames", () => {
    const probes = [
      [0, 0],
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [Math.cos(i * 0.785), Math.sin(i * 0.785)]),
    ];
    const misses: string[] = [];
    for (const [name, move] of moves)
      for (const { frames, boxes } of move.hits)
        for (let f = frames[0]; f <= frames[1]; f++) {
          const pose = samplePose(art, name, moveClipFrame(art.clips[name]!, f, move), f);
          for (const { x, y, radius } of boxes) {
            const hit = probes.some(
              ([dx, dy]) => slotsCovering(art, pose, x + dx! * radius * 0.5, -y - dy! * radius * 0.5).length,
            );
            if (!hit) misses.push(`${name}@${f} (${x}, ${y})`);
          }
        }
    expect(misses).toEqual([]);
  });

  it("holds the taser's prongs just behind the shot as he fires, standing and in the air", () => {
    for (const name of ['neutralB', 'neutralBAir']) {
      const m = samplePose(art, name, STUN_GUN.charge, STUN_GUN.charge).world.gun!;
      const [px, py] = TASER_TIP;
      expect(m.a * px + m.c * py + m.tx, `${name} x`).toBeCloseTo(MUZZLE.x - MUZZLE_LEAD, 1);
      expect(m.b * px + m.d * py + m.ty, `${name} y`).toBeCloseTo(-MUZZLE.y, 1);
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
