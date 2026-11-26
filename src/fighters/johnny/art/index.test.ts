import { describe, expect, it } from 'vitest';
import { poseBounds, shapesBounds, shapesContain, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import type { Paint, PathShape } from '../../../render/rig/types';
import { MUZZLE_LEAD } from '../entities';
import { moves } from '../moves';
import { MEGA_LASER } from '../upgrade';
import { BURST_RADIUS } from './burst';
import { GUN_MUZZLE, MAGNET_POLES } from './parts';
import { HAND } from './rig';
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

/** Moves named as another move's `air` variant: startMove only plays them when the move starts in the air. */
const AIR_VARIANTS = new Set(Object.values(moves).flatMap((move) => (move.air ? [move.air] : [])));

/**
 * The moves he plays standing on the floor, picked the way the sim starts them (startMove in
 * src/sim/actions/attack.ts): aerials and air variants start in the air, and a move that leaves the ground takes
 * off on its first frame.
 */
const GROUNDED_MOVES = Object.entries(moves)
  .filter(([name, move]) => move.kind !== 'aerial' && !move.leavesGround && !AIR_VARIANTS.has(name))
  .map(([name]) => name);

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
    for (const name of GROUNDED_MOVES) {
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
        expect(poseBounds(art, samplePose(art, name, f, f))[3], `${name}@${f}`).toBeLessThanOrEqual(0.4);
  });

  it('holds the Laser Gun muzzle just behind the laser on the frame it spawns', () => {
    // Gun space (x along the barrel, y down) to forearm space: the barrel runs down the forearm past the hand.
    const [lx, ly] = [-GUN_MUZZLE[1], HAND + GUN_MUZZLE[0]];
    for (const name of ['neutralB', 'neutralBAir']) {
      const move = moves[name]!;
      const { frame, x, y } = move.spawn![0]!;
      const m = samplePose(art, name, moveClipFrame(art.clips[name]!, frame, move), frame).world.foreF!;
      expect(m.a * lx + m.c * ly + m.tx, `${name} x`).toBeCloseTo(x - MUZZLE_LEAD, 1);
      expect(m.b * lx + m.d * ly + m.ty, `${name} y`).toBeCloseTo(-y, 1);
    }
  });

  it('keys Coin Magnet and Upgraded Laser on their moves: FAF - 1 long, with the shot on its spawn frame', () => {
    for (const name of ['downB', 'neutralBUpgraded', 'neutralBUpgradedAir']) {
      const move = moves[name]!;
      expect(art.clips[name]!.length, name).toBe(move.faf - 1);
      const shot = move.spawn?.[0]?.frame;
      expect(art.clips[name]!.active, name).toEqual(shot === undefined ? [] : [[shot, shot]]);
    }
  });

  it("holds the coins on the magnet's poles through Coin Magnet's charge cycle", () => {
    // Gun space (x out along the magnet, y down) to forearm space, as for the Laser Gun.
    const [lx, ly] = [-MAGNET_POLES[1], HAND + MAGNET_POLES[0]];
    for (let f = 5; f <= 16; f++) {
      const { world, symbols } = samplePose(art, 'downB', f, f);
      const hand = world.foreF!;
      expect(symbols.foreF, `downB@${f}`).toBe('magnet');
      expect(symbols.fx1, `downB@${f}`).toMatch(/^coins\d$/);
      expect(world.fx1!.tx, `downB@${f} x`).toBeCloseTo(hand.a * lx + hand.c * ly + hand.tx, 1);
      expect(world.fx1!.ty, `downB@${f} y`).toBeCloseTo(hand.b * lx + hand.d * ly + hand.ty, 1);
    }
  });

  it("draws Upgraded Laser's burst out to its hit's edge on every drawing, and not much past it", () => {
    const R = MEGA_LASER.burstRadius;
    const prop = art.projectiles!.laserBurst!;
    expect(BURST_RADIUS).toBe(R);
    const loop = art.rig.symbols[prop.symbol];
    if (!loop || Array.isArray(loop)) throw new Error('the burst is a symbol loop');
    expect(loop.loop).toHaveLength(7);
    for (const name of loop.loop) {
      const shapes = art.rig.symbols[name] as PathShape[];
      // Solid paint only: the glow is a gradient.
      const solid = shapes.filter((shape) => typeof shape.fill === 'string');
      for (let deg = 0; deg < 360; deg += 15) {
        const [x, y] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
        expect(
          shapesContain(solid, (0.95 * R * x) / prop.scale, (0.95 * R * y) / prop.scale),
          `${name} ${deg}`,
        ).toBe(true);
      }
      const [x0, y0, x1, y1] = shapesBounds(shapes).map((v) => v * prop.scale);
      expect(Math.max(-x0!, -y0!, x1!, y1!), name).toBeLessThanOrEqual(1.1 * R);
    }
  });

  it('lets the fighters the burst holds at its centre show through its glow and star', () => {
    /** The opacity `paint` gives at (x, y): 1 for a flat colour, the radial stops' alpha at that distance. */
    const alphaAt = (paint: Paint, x: number, y: number): number => {
      if (typeof paint === 'string') return 1;
      if (paint.type !== 'radial') throw new Error('the burst only uses radial gradients');
      const t = Math.min(1, Math.hypot(x - paint.cx, y - paint.cy) / paint.r);
      const stops = paint.stops;
      const i = Math.max(
        1,
        stops.findIndex((stop) => stop.offset >= t),
      );
      const [a, b] = [stops[i - 1]!, stops[i]!];
      const u = b.offset > a.offset ? (t - a.offset) / (b.offset - a.offset) : 1;
      return (a.alpha ?? 1) + ((b.alpha ?? 1) - (a.alpha ?? 1)) * Math.min(1, Math.max(0, u));
    };
    const prop = art.projectiles!.laserBurst!;
    const loop = art.rig.symbols[prop.symbol];
    if (!loop || Array.isArray(loop)) throw new Error('the burst is a symbol loop');
    // The loops pull a held fighter's middle to the centre: a fighter-sized box there (Mario: 8 wide, 15 tall).
    for (const name of loop.loop) {
      const shapes = (art.rig.symbols[name] as PathShape[]).filter((shape) => shape.fill !== undefined);
      let most = 0;
      for (let x = -4; x <= 4; x += 0.5)
        for (let y = -7.5; y <= 7.5; y += 0.5) {
          const clear = shapes
            .filter((shape) => shapesContain([shape], x / prop.scale, y / prop.scale))
            .reduce((left, shape) => left * (1 - alphaAt(shape.fill!, x / prop.scale, y / prop.scale)), 1);
          most = Math.max(most, 1 - clear);
        }
      expect(most, name).toBeLessThanOrEqual(0.7);
    }
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
