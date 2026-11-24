import { describe, expect, it } from 'vitest';
import type { MoveDef } from '../../types';
import { poseBounds, shapesBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import type { AnimClip, PathShape } from '../../../render/rig/types';
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
  down: 'loop',
  getupStand: 30,
  techInPlace: 26,
  techRoll: 40,
  dizzy: 'loop',
  grabHold: 'loop',
  grabbed: 'loop',
  grabRelease: 29,
  respawn: 'loop',
  taunt: 60,
};

/** Specials the art draws ahead of their frame data (Bob's specials land with COOL-10's gameplay). */
const SPECIALS = ['neutralB', 'sideB', 'upB', 'downB'];

type MoveClip = AnimClip & { active?: [number, number][] };
const clipOf = (name: string): MoveClip | undefined => art.clips[name];

/** The move's hit windows, or its throw or pummel frame. */
function windows(move: MoveDef): [number, number][] {
  if (move.hits.length) return move.hits.map((h) => h.frames);
  const f = move.throw?.frame ?? move.pummel?.frame;
  return f ? [[f, f]] : [];
}

/**
 * The clip frame drawn on `frame` of a move: the clip's active windows mapped onto the move's hit windows and
 * its length onto FAF, piecewise linearly (the rule PR #18's src/render/rig/timing.ts applies in matches).
 */
function clipFrame(clip: MoveClip, frame: number, move: MoveDef): number {
  const knots: [number, number][] = [[0, 0]];
  const ours = move.hits.map((h) => h.frames);
  const theirs = clip.active ?? [];
  const pairs: [[number, number], [number, number]][] =
    ours.length === theirs.length
      ? ours.map((w, i) => [w, theirs[i]!])
      : ours.length && theirs.length
        ? [
            [
              [ours[0]![0], ours[ours.length - 1]![1]],
              [theirs[0]![0], theirs[theirs.length - 1]![1]],
            ],
          ]
        : [];
  for (const [[s, e], [a, b]] of pairs) knots.push([s, a], [e, b]);
  knots.push([move.faf - 1, clip.length]);
  for (let i = 1; i < knots.length; i++) {
    const [x0, y0] = knots[i - 1]!;
    const [x1, y1] = knots[i]!;
    if (frame > x1 && i < knots.length - 1) continue;
    if (x1 <= x0) return y1;
    return Math.max(y0, Math.min(y1, y0 + ((frame - x0) * (y1 - y0)) / (x1 - x0)));
  }
  return frame;
}

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

  it("keys every move clip on the move's frame data: FAF - 1 long, struck on its hit windows", () => {
    for (const [name, move] of Object.entries(fighter.moves ?? {})) {
      const clip = clipOf(name);
      expect(clip, name).toBeDefined();
      if (SPECIALS.includes(name)) continue;
      expect(clip!.length, name).toBe(move.faf - 1);
      expect(clip!.active, name).toEqual(windows(move));
    }
    for (const name of SPECIALS) expect(clipOf(name)?.active?.length, name).toBeGreaterThan(0);
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

  it("reaches into every hitbox's inner half with the baton, sack, a hand or a smear on every active frame", () => {
    const misses: string[] = [];
    const probes = [
      [0, 0],
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [Math.cos(i * 0.785), Math.sin(i * 0.785)]),
    ];
    for (const [name, move] of Object.entries(fighter.moves ?? {})) {
      const clip = clipOf(name)!;
      for (const { frames, boxes } of move.hits)
        for (let f = frames[0]; f <= frames[1]; f++) {
          const pose = samplePose(art, name, clipFrame(clip, f, move), f);
          for (const { x, y, radius } of boxes) {
            const hit = probes.some(
              ([dx, dy]) => slotsCovering(art, pose, x + dx! * radius * 0.5, -y - dy! * radius * 0.5).length,
            );
            if (!hit) misses.push(`${name}@${f} (${x}, ${y})`);
          }
        }
    }
    expect(misses).toEqual([]);
  });

  it('stands 14.5 units tall to the top of the beanie and about 8.5 wide, feet on the ground', () => {
    const pose = samplePose(art, 'idle', 0, 0);
    const [x0, y0, x1, y1] = poseBounds(art, pose);
    expect(y1).toBeCloseTo(0, 1);
    expect(x1 - x0).toBeGreaterThan(7.5);
    expect(x1 - x0).toBeLessThan(9.5);
    const [, crown] = shapesBounds((art.rig.symbols.hatFront as PathShape[]).filter((s) => s.fill === 'hat'));
    const headY = pose.world.head!.ty;
    expect(headY + crown).toBeCloseTo(-fighter.stats.height, 0);
    expect(-y0).toBeLessThanOrEqual(art.height + 0.05);
    expect(-y0).toBeGreaterThan(art.height - 0.5);
  });

  it('has costumes with the same colour keys, an icon and the taser dart', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes).sort()).toEqual(['black', 'default', 'explorer', 'spy']);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
    expect(art.projectiles?.taserDart).toBeDefined();
  });
});
