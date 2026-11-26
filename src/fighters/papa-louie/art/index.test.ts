import { describe, expect, it } from 'vitest';
import { poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import {
  AIR_DODGE_NEUTRAL,
  GETUP_ROLL,
  GETUP_STAND,
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
import type { MoveDef } from '../../types';
import { moves } from '../moves';
import { stats } from '../stats';
import { art } from '.';

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
  glide: 'loop',
  taunt: 60,
  shield: 'hold',
  shieldDrop: SHIELD_DROP_FRAMES,
  shieldBreak: 'hold',
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
  getupStand: GETUP_STAND.faf - 1,
  getupRoll: GETUP_ROLL.faf - 1,
  techInPlace: TECH_IN_PLACE.faf - 1,
  techRoll: TECH_ROLL.faf - 1,
  respawn: 'loop',
  grabHold: 'loop',
  grabbed: 'loop',
};

/**
 * The frames a move's clip is keyed on: its hit windows, else its throw or pummel impact, else the frame its
 * projectile leaves the hand.
 */
function windows(move: MoveDef): [number, number][] {
  if (move.hits.length) return move.hits.map((h) => h.frames);
  const impact = move.throw?.frame ?? move.pummel?.frame ?? move.spawn?.[0]?.frame;
  return impact === undefined ? [] : [[impact, impact]];
}

describe('papa louie art', () => {
  it('has every canonical clip with its length', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
  });

  it('has a clip per move, FAF - 1 long and keyed on the move hit windows, so it plays frame for frame', () => {
    for (const [name, move] of Object.entries(moves)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      expect(clip!.length, name).toBe(move.faf - 1);
      expect(clip!.active, name).toEqual(windows(move));
      for (let f = 0; f < move.faf; f++) expect(moveClipFrame(clip!, f, move), `${name}@${f}`).toBe(f);
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

  it('covers every hitbox centre with a drawn part from the frame before each hit window', () => {
    const misses: string[] = [];
    for (const [name, move] of Object.entries(moves))
      for (const { frames, boxes } of move.hits)
        for (let f = frames[0] - 1; f <= frames[1]; f++) {
          const pose = samplePose(art, name, moveClipFrame(art.clips[name]!, f, move), f);
          for (const { id, x, y } of boxes)
            if (!slotsCovering(art, pose, x, -y).length) misses.push(`${name}@${f} box ${id} (${x}, ${y})`);
        }
    expect(misses).toEqual([]);
  });

  it('holds the Pepper Bomb at the spawn point until it leaves his hand, then lets go', () => {
    const move = moves.neutralB!;
    const { frame, x, y } = move.spawn![0]!;
    const held = samplePose(art, 'neutralB', frame - 1, frame - 1);
    expect(held.symbols.prop).toBe('pepperBomb');
    const m = held.world.prop!;
    expect(Math.hypot(m.tx - x, m.ty + y)).toBeLessThan(1);
    for (let f = frame; f <= art.clips.neutralB!.length; f++)
      expect(samplePose(art, 'neutralB', f, f).symbols.prop, `neutralB@${f}`).toBeNull();
    expect(art.projectiles?.pepperBomb?.preview?.neutralB?.frame).toBe(frame);
  });

  it('stands 15 units tall to the top of his toque, feet on the ground', () => {
    expect(art.height).toBe(stats.height);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(14.5);
    expect(-y0).toBeLessThan(15.5);
    expect(x1 - x0).toBeGreaterThan(7);
    expect(x1 - x0).toBeLessThan(stats.width * 1.5);
  });

  it('keeps his shoes on the floor through the grounded loops', () => {
    for (const name of ['idle', 'walk'])
      for (let f = 0; f < art.clips[name]!.length; f += 2)
        expect(poseBounds(art, samplePose(art, name, f, f))[3], `${name}@${f}`).toBeCloseTo(0, 0);
  });

  it('grips the ledge corner where the engine hangs him', () => {
    expect(art.ledgeGrip).toEqual([stats.width / 2 + 0.5, -stats.height * 0.85]);
  });

  it('has his chef whites and four alternate costumes with the same colour keys, and an icon', () => {
    const names = Object.keys(art.palettes);
    expect(names).toEqual(['default', 'roy', 'marty', 'rita', 'cori']);
    const keys = Object.keys(art.palettes.default).sort();
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    const used = new Set<string>();
    for (const sym of Object.values(art.rig.symbols))
      if (Array.isArray(sym))
        for (const shape of sym)
          for (const paint of [shape.fill, shape.stroke?.color])
            if (typeof paint === 'string') used.add(paint);
            else if (paint) for (const stop of paint.stops) used.add(stop.color);
    for (const color of used) expect(keys, `palette key ${color}`).toContain(color);
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
  });
});
