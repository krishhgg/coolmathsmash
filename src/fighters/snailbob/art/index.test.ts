import { describe, expect, it } from 'vitest';
import { flattenPath, poseBounds, shapesBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import type { PathShape } from '../../../render/rig/types';
import { CRATE_RADIUS, entities } from '../entities';
import { SPIN_REV_FRAME, SPIN_ROLL, moves } from '../moves';
import { stats } from '../stats';
import { art } from '.';

/** Canonical clips (docs/art.md) and the engine's own action names, with their lengths (loops: any length). */
const LENGTHS: Record<string, number | 'loop' | 'hold'> = {
  idle: 'loop',
  walk: 'loop',
  dash: stats.dashFrames,
  run: 'loop',
  runBrake: 14,
  turn: 12,
  crouch: 'hold',
  jumpSquat: stats.jumpSquat,
  jump: 40,
  doubleJump: 30,
  fall: 'loop',
  land: 4,
  taunt: 60,
  helpless: 'loop',
  shield: 'hold',
  shieldDrop: 11,
  shieldBreak: 40,
  dizzy: 'loop',
  spotDodge: 26,
  rollForward: 30,
  rollBack: 30,
  airDodge: 49,
  ledgeCatch: 19,
  ledgeHang: 'loop',
  ledgeClimb: 33,
  ledgeRoll: 45,
  ledgeJump: 20,
  ledgeAttack: 55,
  hitstun: 20,
  tumble: 'loop',
  down: 'loop',
  downBound: 26,
  getupStand: 29,
  techInPlace: 26,
  techRoll: 40,
  getupRoll: 35,
  respawn: 'loop',
  grabbed: 'loop',
  grabHold: 'loop',
};

/**
 * Every move but Rocket Hover, which has no hit or spawn to key its clip to and is checked in its own test below.
 * Crate Drop keys its spawn frame as its active window, as Fireboy's fireball does.
 */
const drawnMoves = Object.entries(moves).filter(([name]) => name !== 'upB');

describe('snail bob art', () => {
  it('has every canonical clip, and a clip with active windows for every standard move', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
    for (const [name] of drawnMoves) expect(art.clips[name]?.active, name).toBeDefined();
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

  it('never draws the face or the arms without the head, nor an eye without its stalk', () => {
    const loose: string[] = [];
    for (const [name, clip] of Object.entries(art.clips))
      for (let f = 0; f <= clip.length; f++) {
        const { symbols } = samplePose(art, name, f, f);
        const needs: [string, string][] = [
          ['eyeF', 'stalkF2'],
          ['eyeB', 'stalkB2'],
          ['mouth', 'head'],
          ['stalkF1', 'head'],
          ['stalkB1', 'head'],
          ['foreF', 'neck'],
          ['foreB', 'neck'],
        ];
        for (const [part, host] of needs)
          if (symbols[part] && !symbols[host]) loose.push(`${name}@${f}: ${part} without ${host}`);
      }
    expect(loose).toEqual([]);
  });

  it("reaches into every hitbox's inner half with a drawn part during the move's active frames", () => {
    const misses: string[] = [];
    for (const [name, move] of drawnMoves) {
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

  it("shows Rocket Hover's booster and flame for the whole hover, past the clip's end, and in no other clip", () => {
    expect(art.clips.upB!.length).toBe(moves.upB!.faf - 1);
    for (const f of [2, 5, 12, 24, 60, 143]) {
      const { symbols } = samplePose(art, 'upB', moveClipFrame(art.clips.upB!, f, moves.upB), f);
      expect(symbols.rocket, `upB@${f}`).toBe('rocket');
      expect(symbols.flame, `upB@${f}`).toMatch(/^flame\d$/);
    }
    const flames = new Set([24, 25, 26, 27].map((g) => samplePose(art, 'upB', 24, g).symbols.flame));
    expect(flames.size).toBeGreaterThan(1);
    for (const [name, clip] of Object.entries(art.clips)) {
      if (name === 'upB') continue;
      for (let f = 0; f <= clip.length; f++) {
        const { symbols } = samplePose(art, name, f, f);
        expect([symbols.rocket, symbols.flame], `${name}@${f}`).toEqual([null, null]);
      }
    }
  });

  it('keeps Shell Spin and Crate Drop on the floor: the shell rolls on its rim and the foot stays planted', () => {
    const off: string[] = [];
    for (const name of ['sideB', 'neutralB']) {
      const clip = art.clips[name]!;
      for (let f = 0; f <= clip.length; f++)
        for (const g of [0, 1, 2, 3]) {
          const bottom = poseBounds(art, samplePose(art, name, f, f + g))[3];
          if (Math.abs(bottom) > 0.3) off.push(`${name}@${f}: ${bottom.toFixed(2)}`);
        }
    }
    expect(off).toEqual([]);
  });

  it("revs Shell Spin on the move's rev frame and keeps it spinning while Special holds that frame", () => {
    const clip = art.clips.sideB!;
    expect(clip.length).toBe(moves.sideB!.faf - 1);
    expect(clip.active).toEqual([SPIN_ROLL]);
    const rev = moveClipFrame(clip, SPIN_REV_FRAME, moves.sideB);
    expect(clip.keys.some((k) => k.frame === rev && k.pose)).toBe(true);
    const held = Array.from({ length: 8 }, (_, g) => samplePose(art, 'sideB', rev, 600 + g).symbols);
    expect(new Set(held.map((s) => s.spiral)).size).toBe(4);
    expect(new Set(held.map((s) => s.fx1)).size).toBe(3);
    expect(samplePose(art, 'sideB', SPIN_ROLL[0], SPIN_ROLL[0]).symbols.spiral).toBe('spiral');
    expect(samplePose(art, 'sideB', clip.length, clip.length).symbols.head).toBe('head');
  });

  it('presses the remote as the crate spawns, and shows the remote in no other clip', () => {
    const clip = art.clips.neutralB!;
    const spawn = moves.neutralB!.spawn![0]!.frame;
    expect(clip.length).toBe(moves.neutralB!.faf - 1);
    expect(clip.active).toEqual([[spawn, spawn]]);
    const pressed = samplePose(art, 'neutralB', spawn, spawn).symbols;
    expect([pressed.fx1, pressed.fx2]).toEqual(['remotePressed', expect.stringMatching(/^signal\d$/)]);
    expect(samplePose(art, 'neutralB', clip.length, clip.length).symbols.fx1).toBeNull();
    const remotes = new Set(['remote', 'remotePressed']);
    for (const [name, c] of Object.entries(art.clips)) {
      if (name === 'neutralB') continue;
      for (let f = 0; f <= c.length; f++)
        expect(remotes.has(samplePose(art, name, f, f).symbols.fx1 ?? ''), `${name}@${f}`).toBe(false);
    }
  });

  it("draws the crate for both of Crate Drop's entities, filling the entity's body", () => {
    const props = art.projectiles!;
    expect(Object.keys(props).sort()).toEqual(['crate', 'crateFall']);
    for (const name of Object.keys(props)) expect(entities[name], name).toBeDefined();
    for (const prop of Object.values(props)) {
      expect(prop.scale).toBe(1);
      const [x0, y0, x1, y1] = shapesBounds(prop.symbols[prop.symbol] as PathShape[]);
      for (const [edge, want] of [
        [x0, -CRATE_RADIUS],
        [y0, -CRATE_RADIUS],
        [x1, CRATE_RADIUS],
        [y1, CRATE_RADIUS],
      ])
        expect(edge).toBeCloseTo(want!, 2);
    }
    expect(props.crate!.preview!.neutralB!.y).toBe(CRATE_RADIUS);
  });

  it('stands 13 units tall and about 12 wide, feet on the ground', () => {
    expect(art.height).toBe(stats.height);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(12.5);
    expect(-y0).toBeLessThan(13.5);
    expect(x1 - x0).toBeGreaterThan(stats.width - 0.5);
    expect(x1 - x0).toBeLessThan(stats.width + 1.5);
  });

  it('has costumes with the same colour keys, an icon and a ledge grip', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes).length).toBeGreaterThanOrEqual(5);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
    expect(art.ledgeGrip![0]).toBeCloseTo(stats.width / 2 + 0.5);
    expect(art.ledgeGrip![1]).toBeCloseTo(-stats.height * 0.85);
  });

  it('draws the icon in viewBox coordinates, centred, with no transform for the HUD to drop', () => {
    expect(art.icon).not.toContain('transform');
    const [vx, vy, size] = /viewBox="([^"]+)"/.exec(art.icon)![1]!.split(' ').map(Number) as [
      number,
      number,
      number,
    ];
    const points = [...art.icon.matchAll(/ d="([^"]+)"/g)].flatMap((m) => flattenPath(m[1]!).flat());
    const xs = points.filter((_, i) => i % 2 === 0);
    const ys = points.filter((_, i) => i % 2 === 1);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    expect(x0).toBeGreaterThan(vx);
    expect(y0).toBeGreaterThan(vy);
    expect(x1).toBeLessThan(vx + size);
    expect(y1).toBeLessThan(vy + size);
    expect(Math.abs((x0 + x1) / 2 - (vx + size / 2))).toBeLessThan(size * 0.02);
    expect(Math.abs((y0 + y1) / 2 - (vy + size / 2))).toBeLessThan(size * 0.02);
  });
});
