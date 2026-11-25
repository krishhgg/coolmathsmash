import { describe, expect, it } from 'vitest';
import { poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { placeInAir, run, testMatch, until } from '../../../sim/testing/sim';
import { moves } from '../moves';
import { stats } from '../stats';
import { art } from '.';

/** Engine actions and their canonical clip lengths (loops: any length; holds: not looping). */
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
  helpless: 'loop',
  land: 4,
  shield: 'hold',
  shieldDrop: 11,
  shieldBreak: 40,
  dizzy: 'loop',
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
  down: 'loop',
  techInPlace: 26,
  techRoll: 40,
  getupStand: 29,
  grabHold: 'loop',
  grabbed: 'loop',
  taunt: 60,
  respawn: 60,
};

describe('raft wars art', () => {
  it('has every movement, defence, ledge and hurt clip at its engine length', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
  });

  it('ends each move clip it has at the move FAF', () => {
    for (const [name, move] of Object.entries(moves))
      if (art.clips[name]) expect(art.clips[name].length, name).toBe(move.faf - 1);
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
        for (const slot of Object.keys(key.z ?? {})) expect(slots.has(slot), `${name}: z ${slot}`).toBe(true);
      }
      for (let f = 0; f <= clip.length; f++)
        expect(() => samplePose(art, name, f, f), `${name}@${f}`).not.toThrow();
    }
  });

  it("covers every hitbox centre of each drawn move with a part through the hit's active frames", () => {
    const misses: string[] = [];
    for (const [name, move] of Object.entries(moves)) {
      if (!art.clips[name]) continue;
      for (const { frames, boxes } of move.hits)
        for (let f = frames[0] - 1; f <= frames[1]; f++) {
          const pose = samplePose(art, name, f, f);
          for (const { x, y } of boxes)
            if (!slotsCovering(art, pose, x, -y).length) misses.push(`${name}@${f} (${x}, ${y})`);
        }
    }
    expect(misses).toEqual([]);
  });

  it('stands as tall and wide as the stats, feet on the ground', () => {
    expect(art.height).toBe(stats.height);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(stats.height - 0.3);
    expect(-y0).toBeLessThan(stats.height + 0.3);
    expect(x1 - x0).toBeGreaterThan(stats.width - 0.6);
    expect(x1 - x0).toBeLessThan(stats.width + 0.6);
  });

  it('keeps grounded clips on the floor and airborne clips above it', () => {
    const planted = [
      'idle',
      'walk',
      'runBrake',
      'turn',
      'crouch',
      'shield',
      'spotDodge',
      'down',
      'getupStand',
    ];
    for (const name of [
      ...planted,
      'run',
      'dash',
      'rollForward',
      'rollBack',
      'techRoll',
      'ledgeClimb',
      'ledgeAttack',
    ])
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const [, , , bottom] = poseBounds(art, samplePose(art, name, f, f));
        expect(bottom, `${name}@${f} sinks`).toBeLessThan(0.35);
        if (planted.includes(name)) expect(bottom, `${name}@${f} floats`).toBeGreaterThan(-0.6);
      }
    for (const name of ['jump', 'fall', 'helpless', 'airDodge', 'tumble'])
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const [, , , bottom] = poseBounds(art, samplePose(art, name, f, f));
        expect(bottom, `${name}@${f}`).toBeLessThan(0.1);
      }
  });

  it('holds the ledge on its grip while hanging', () => {
    const [gx, gy] = art.ledgeGrip!;
    for (let f = 0; f <= 60; f += 5) {
      const pose = samplePose(art, 'ledgeHang', f, f);
      expect(slotsCovering(art, pose, gx - 0.2, gy + 0.2).length, `ledgeHang@${f}`).toBeGreaterThan(0);
    }
  });

  it('rolls across the stage lip without the rig sinking under the floor', () => {
    const match = testMatch({ fighter: 'raftwars' });
    const kids = placeInAir(match, -86, 6);
    until(match, (f) => f.action === 'ledgeHang');
    run(match, 1, { buttons: ['shield'] });
    for (const frame of [10, 18, 26]) {
      until(match, (f) => f.action === 'ledgeRoll' && f.actionFrame === frame);
      const [, , , bottom] = poseBounds(art, samplePose(art, 'ledgeRoll', frame, match.frame));
      expect(bottom - kids.pos.y, `ledgeRoll@${frame}`).toBeLessThan(3);
    }
  });

  it('has five costumes with the same colour keys and distinct shirts, and a head icon', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes).length).toBeGreaterThanOrEqual(5);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    const looks = Object.values(art.palettes).map((p) => `${p.hat} ${p.shirt} ${p.ring}`);
    expect(new Set(looks).size).toBe(looks.length);
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
  });
});
