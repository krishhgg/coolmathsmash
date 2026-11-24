import { describe, expect, it } from 'vitest';
import { poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
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
  shieldBreak: 40,
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
  respawn: 'loop',
};

/** Clips played standing on the floor: nothing may sink below it. */
const GROUNDED = [
  'idle',
  'walk',
  'dash',
  'run',
  'runBrake',
  'turn',
  'crouch',
  'jumpSquat',
  'land',
  'shield',
  'shieldDrop',
  'spotDodge',
  'rollForward',
  'rollBack',
  'knockdown',
  'getUp',
  'tech',
  'techRoll',
  'dizzy',
  'grabHold',
  'taunt',
];

describe('wheely art', () => {
  it('has every canonical clip with its length', () => {
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

  it('times every move clip to moves.ts and covers each hitbox centre while it is active', () => {
    const misses: string[] = [];
    for (const [name, move] of Object.entries(moves)) {
      expect(art.clips[name]?.length, name).toBe(move.faf - 1);
      for (const hit of move.hits)
        for (let f = hit.frames[0] - 1; f <= hit.frames[1]; f++) {
          const pose = samplePose(art, name, f, f);
          for (const box of hit.boxes)
            if (!slotsCovering(art, pose, box.x, -box.y).length)
              misses.push(`${name}@${f} (${box.x}, ${box.y})`);
        }
    }
    expect(misses).toEqual([]);
  });

  it('shows an effect only while its keys place it, so none snaps to the origin', () => {
    const fx = art.rig.slots.filter((s) => s.bone.startsWith('fx') || s.bone === 'prop');
    const stray: string[] = [];
    for (const [name, clip] of Object.entries(art.clips)) {
      const posed = clip.keys.filter((k) => k.pose);
      for (let f = 0; f < clip.length; f++) {
        const symbols = samplePose(art, name, f, f).symbols;
        const from = [...posed].reverse().find((k) => k.frame <= f);
        const to = posed.find((k) => k.frame > f) ?? (clip.loop ? posed[0] : undefined);
        for (const slot of fx) {
          if (!symbols[slot.name]) continue;
          const placed = from?.pose?.[slot.bone] && (!to || f === from.frame || to.pose?.[slot.bone]);
          if (!placed) stray.push(`${name}@${f} ${slot.name}`);
        }
      }
    }
    expect(stray).toEqual([]);
  });

  it('is about 18 long and 11 tall, tyres on the ground', () => {
    expect(art.height).toBe(11);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(10);
    expect(-y0).toBeLessThan(11.5);
    expect(x1 - x0).toBeGreaterThan(17);
    expect(x1 - x0).toBeLessThan(20);
  });

  it('never sinks into the floor in grounded clips', () => {
    const sunk: string[] = [];
    for (const name of GROUNDED)
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const y1 = poseBounds(art, samplePose(art, name, f, f))[3];
        if (y1 > 0.3) sunk.push(`${name}@${f} ${y1.toFixed(2)}`);
      }
    expect(sunk).toEqual([]);
  });

  it('hangs by the front tyre with the car clear of the ledge block', () => {
    const [gx, gy] = art.ledgeGrip!;
    for (const [name, f] of [
      ['ledgeHang', 0],
      ['ledgeHang', 30],
      ['ledgeCatch', 8],
    ] as const) {
      const pose = samplePose(art, name, f, f);
      expect(slotsCovering(art, pose, gx - 0.3, gy - 0.3), `${name}@${f}`).toContain('wheelF');
      const inside: string[] = [];
      for (let y = gy + 0.8; y < gy + 14; y += 0.4)
        for (let x = gx + 0.6; x < gx + 8; x += 0.4)
          if (slotsCovering(art, pose, x, y).length) inside.push(`(${x.toFixed(1)}, ${y.toFixed(1)})`);
      expect(inside, `${name}@${f}`).toEqual([]);
    }
  });

  it('has a red default, a blue and two alternates with the same colour keys, and an icon', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes)).toEqual(
      expect.arrayContaining(['default', 'blue', 'jolie', 'timeTravel']),
    );
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
  });
});
