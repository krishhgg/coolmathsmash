import { describe, expect, it } from 'vitest';
import { flattenPath, poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { resolveSymbol, samplePose } from '../../../render/rig/sample';
import type { PathShape } from '../../../render/rig/types';
import { moveClipFrame } from '../../../render/rig/timing';
import {
  AIR_DODGE_NEUTRAL,
  GETUP_ROLL,
  GETUP_STAND,
  ROLL_BACK,
  ROLL_FORWARD,
  SPOT_DODGE,
  TECH_IN_PLACE,
  TECH_ROLL,
} from '../../../sim/constants';
import { getFighter } from '../../registry';
import { WAVE, WAVE_BOXES } from '../finalSmashData';
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
  taunt: 60,
};

describe('watergirl art', () => {
  it('has every canonical clip with its length', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
    for (const name of Object.keys(moves)) expect(art.clips[name]?.active, name).toBeDefined();
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

  it('stands about 15 units tall and 8 wide, feet on the ground', () => {
    expect(art.height).toBe(15);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(14.5);
    expect(-y0).toBeLessThan(15.5);
    expect(x1 - x0).toBeGreaterThan(7.5);
    expect(x1 - x0).toBeLessThan(9);
  });

  it('has costumes with the same colour keys and an icon', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes).length).toBeGreaterThanOrEqual(2);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
  });
  it("draws Tidal Wave's wave on its boxes: on every frame it is out, facing both ways, its front and top within 1.5 units of theirs", () => {
    const prop = art.projectiles!.wave!;
    /** A unit and a half: the foam stands half a unit out, and the lip rocks by 0.3 between drawings. */
    const NEAR = 1.5;
    const misses: string[] = [];
    for (let age = 1; age <= WAVE.lifetime; age++) {
      // As the renderer draws it (src/render/entities.ts): the loop on the entity's age, x mirrored by its facing.
      const name = resolveSymbol(prop.symbols, prop.symbol, age)!;
      const shapes = prop.symbols[name] as PathShape[];
      for (const facing of [1, -1] as const) {
        const boxes = WAVE_BOXES.map((b) => ({ x: b.x * facing, y: b.y, r: b.radius }));
        let [front, top] = [-Infinity, -Infinity];
        for (const shape of shapes) {
          // The drawing is y down round the entity's centre, the boxes y up. A stroke reaches half its width out.
          const ink = (shape.stroke?.width ?? 0) / 2;
          for (const p of flattenPath(shape.d))
            for (let i = 0; i < p.length; i += 2) {
              const [x, y] = [p[i]! * prop.scale * facing, -p[i + 1]! * prop.scale];
              const out = Math.min(...boxes.map((b) => Math.hypot(x - b.x, y - b.y) - b.r)) + ink;
              if (out > NEAR)
                misses.push(
                  `${name} facing ${facing} (${x.toFixed(1)}, ${y.toFixed(1)}) by ${out.toFixed(2)}`,
                );
              front = Math.max(front, x * facing + ink);
              top = Math.max(top, y + ink);
            }
        }
        const boxFront = Math.max(...boxes.map((b) => b.x * facing + b.r));
        const boxTop = Math.max(...boxes.map((b) => b.y + b.r));
        expect(Math.abs(front - boxFront), `${name} front, facing ${facing}`).toBeLessThanOrEqual(NEAR);
        expect(Math.abs(top - boxTop), `${name} top, facing ${facing}`).toBeLessThanOrEqual(NEAR);
      }
    }
    expect(misses).toEqual([]);
  });

  it('is the art the game draws for her, so swapping in shows it', () => {
    expect(getFighter('watergirl').art).toBe(art);
  });
});
