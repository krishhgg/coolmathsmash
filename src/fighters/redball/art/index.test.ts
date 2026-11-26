import { describe, expect, it } from 'vitest';
import { poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import {
  AIR_DODGE_NEUTRAL,
  DOWN_BOUNCE_FRAMES,
  GETUP_ROLL,
  GETUP_STAND,
  GRAB,
  LEDGE_ATTACK,
  LEDGE_CATCH_FRAMES,
  LEDGE_CLIMB,
  LEDGE_ROLL,
  ROLL_BACK,
  ROLL_FORWARD,
  RUN_BRAKE_FRAMES,
  RUN_TURN_FRAMES,
  SHIELD_DROP_FRAMES,
  SPOT_DODGE,
  TECH_IN_PLACE,
  TECH_ROLL,
} from '../../../sim/constants';
import { moves } from '../moves';
import { REV_FROM, REV_MAX, ROLLS } from '../specials';
import { stats } from '../stats';
import { art } from '.';
import type { MoveClip } from './attacks';

/**
 * Canonical clip lengths (loops: any length; hold: not looping). A clip for a timed engine action lasts until the
 * last frame before the action ends, so these follow the sim's constants and his stats.
 */
const LENGTHS: Record<string, number | 'loop' | 'hold'> = {
  idle: 'loop',
  walk: 'loop',
  dash: stats.dashFrames,
  run: 'loop',
  runBrake: RUN_BRAKE_FRAMES,
  turn: RUN_TURN_FRAMES,
  crouch: 'hold',
  jumpSquat: stats.jumpSquat,
  jump: 40,
  doubleJump: 30,
  fall: 'loop',
  land: 4,
  taunt: 60,
  shield: 'hold',
  shieldDrop: SHIELD_DROP_FRAMES,
  shieldBreak: 30,
  dizzy: 'loop',
  spotDodge: SPOT_DODGE.faf - 1,
  rollForward: ROLL_FORWARD.faf - 1,
  rollBack: ROLL_BACK.faf - 1,
  airDodge: AIR_DODGE_NEUTRAL.faf - 1,
  ledgeCatch: LEDGE_CATCH_FRAMES,
  ledgeHang: 'loop',
  ledgeClimb: LEDGE_CLIMB.faf - 1,
  ledgeRoll: LEDGE_ROLL.faf - 1,
  ledgeJump: 20,
  ledgeAttack: LEDGE_ATTACK.faf - 1,
  hitstun: 20,
  tumble: 'loop',
  helpless: 'loop',
  down: 'loop',
  knockdown: 'loop',
  downBound: DOWN_BOUNCE_FRAMES,
  getupStand: GETUP_STAND.faf - 1,
  getUp: GETUP_STAND.faf - 1,
  getupRoll: GETUP_ROLL.faf - 1,
  techInPlace: TECH_IN_PLACE.faf - 1,
  tech: TECH_IN_PLACE.faf - 1,
  techRoll: TECH_ROLL.faf - 1,
  respawn: 'loop',
  grabHold: 'loop',
  grabbed: 'loop',
  grabRelease: GRAB.releaseLag,
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

  it('stays in the Cube Squash shape through the down air hit windows', () => {
    const move = moves.dair!;
    const clip = art.clips.dair!;
    for (const {
      frames: [start, end],
    } of move.hits) {
      for (let frame = start; frame <= end; frame++) {
        const pose = samplePose(art, 'dair', moveClipFrame(clip, frame, move), frame);
        expect(pose.symbols.ballFill, `dair@${frame}`).toBe('cubeFill');
      }
    }
    expect(samplePose(art, 'dair', clip.length, 0).symbols.ballFill).toBe('ballFill');
  });

  it('keeps the ink of grounded rolling clips planted at the floor', () => {
    for (const name of ['walk', 'dash', 'run', ...ROLLS.map(({ move }) => move)]) {
      for (let frame = 0; frame < art.clips[name]!.length; frame++) {
        const pose = samplePose(art, name, frame, frame);
        const x = pose.world.core!.tx;
        expect(slotsCovering(art, pose, x, -0.1), `${name}@${frame}`).toContain('ballLine');
        expect(slotsCovering(art, pose, x, 0.1), `${name}@${frame}`).not.toContain('ballLine');
      }
    }
  });

  it('shows charge pulses and the full-charge flash before the rev is released', () => {
    for (const tier of ROLLS.slice(1)) {
      const frame = REV_FROM + tier.rev - 1;
      expect(samplePose(art, 'neutralB', frame, frame).symbols.fx4).toBe('pop');
    }
    const full = REV_FROM + REV_MAX - 1;
    expect(samplePose(art, 'neutralB', full, full).symbols.fx2).toBe('flash');
    const released = samplePose(art, 'chargeRoll3', 10, full + 10);
    expect(released.symbols.fx2).toBe('after');
    expect(released.z.fx2!).toBeLessThan(released.z.ballLine!);
  });

  it('keeps the evil costume’s box and fangs through expression swaps', () => {
    for (const name of ['idle', 'run', 'taunt', 'fsmash', 'shield']) {
      const evil = samplePose(art, name, 14, 14, 'evil');
      expect(evil.symbols.ballFill).toBe('cubeFill');
      expect(evil.symbols.costumeMouth).toBe('evilGrin');
      expect(samplePose(art, name, 14, 14).symbols.costumeMouth).toBeNull();
    }
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
