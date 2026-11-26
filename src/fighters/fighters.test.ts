import { describe, expect, it } from 'vitest';
import ref from '../sim/reference/physics-constants.json';
import { entityDef } from '../sim/entities/entities';
import { allFighters } from './registry';
import type { FighterStats } from './types';

const range = ref.cast_ranges;

/** Each stat checked against the span of Ultimate's 89-fighter cast (research: physics-constants.json cast_ranges). */
const CAST: [keyof FighterStats, { min: number; max: number }][] = [
  ['weight', range.weight],
  ['walkSpeed', range.walk_speed],
  ['dashInitialSpeed', range.dash_initial_speed],
  ['runSpeed', range.run_speed],
  ['groundFriction', range.ground_friction],
  ['jumpSquat', range.jumpsquat],
  ['fullHopHeight', range.full_hop_height],
  ['shortHopHeight', range.short_hop_height],
  ['doubleJumpHeight', range.air_jump_height],
  ['airSpeed', range.air_speed],
  ['airAccelBase', range.air_accel_base],
  ['airAccelAdd', range.air_accel_add],
  ['airFriction', range.air_friction],
  ['gravity', range.gravity],
  ['fallSpeed', range.fall_speed],
  ['fastFallSpeed', range.fast_fall_speed],
  ['shieldSize', range.shield_size],
];

describe.each(Object.values(allFighters()).map((f) => [f.id, f] as const))('fighter %s', (_, def) => {
  it.each(CAST)('%s is within the Ultimate cast range', (stat, { min, max }) => {
    expect(def.stats[stat]).toBeGreaterThanOrEqual(min);
    expect(def.stats[stat]).toBeLessThanOrEqual(max);
  });

  it.each(Object.entries(def.moves ?? {}))('move %s has consistent frame data', (name, move) => {
    expect(move.faf, name).toBeGreaterThan(1);
    if (move.air) {
      const variant = def.moves?.[move.air];
      expect(variant, `${name}.air names a move`).toBeDefined();
      expect(variant?.air, `${move.air} is not itself redirected`).toBeUndefined();
    }
    if (move.transform) {
      expect(move.transform.frame).toBeLessThan(move.faf);
      expect(
        allFighters()[move.transform.into]?.moves?.[name],
        `${move.transform.into} has ${name}`,
      ).toBeDefined();
    }
    for (const w of move.hits) {
      expect(w.frames[0]).toBeGreaterThanOrEqual(1);
      expect(w.frames[1]).toBeGreaterThanOrEqual(w.frames[0]);
      expect(w.frames[1]).toBeLessThan(move.faf);
      expect(new Set(w.boxes.map((b) => b.id)).size).toBe(w.boxes.length);
      for (const b of w.boxes) {
        expect(b.radius).toBeGreaterThan(0);
        expect(b.damage).toBeGreaterThanOrEqual(0);
        expect(b.angle === 361 || (b.angle >= 0 && b.angle < 360)).toBe(true);
      }
    }
    if (move.charge !== undefined) {
      expect(move.kind).toBe('smash');
      expect(move.charge).toBeLessThan(Math.min(...move.hits.map((w) => w.frames[0])));
    }
    if (move.kind === 'aerial') expect(move.landingLag).toBeGreaterThan(0);
    if (move.next) {
      expect(def.moves?.[move.next.move], `${name} continues into ${move.next.move}`).toBeDefined();
      expect(move.next.window[1]).toBeGreaterThanOrEqual(move.next.window[0]);
      expect(move.next.window[1]).toBeLessThanOrEqual(move.faf);
    }
    if (move.armor) {
      expect(move.armor.frames[0]).toBeGreaterThanOrEqual(1);
      expect(move.armor.frames[1]).toBeGreaterThanOrEqual(move.armor.frames[0]);
      expect(move.armor.frames[1]).toBeLessThan(move.faf);
      if (move.armor.breakDamageMul !== undefined) {
        expect(move.armor.threshold ?? move.armor.damageThreshold, `${name} armor breaks`).toBeDefined();
        expect(move.armor.breakDamageMul).toBeGreaterThan(0);
        expect(move.armor.breakDamageMul).toBeLessThanOrEqual(1);
      }
    }
    for (const [a, b] of move.autoCancel ?? []) expect(b).toBeGreaterThanOrEqual(a);
    if (move.tether) {
      const t = move.tether;
      expect(t.frame).toBeGreaterThanOrEqual(1);
      expect(t.frame).toBeLessThan(move.faf);
      expect(t.range).toBeGreaterThan(0);
      expect(t.travel).toBeGreaterThanOrEqual(1);
      expect(t.pullSpeed).toBeGreaterThan(0);
      expect(t.latch.length).toBeGreaterThan(0);
      if (t.skyAnchors !== undefined) {
        expect(t.latch, 'skyAnchors needs a sky latch').toContain('sky');
        expect(Number.isInteger(t.skyAnchors) && t.skyAnchors >= 1).toBe(true);
      }
      if (t.aimed) {
        expect(t.aimed.speed).toBeGreaterThan(0);
        if (t.aimed.quick) expect(t.aimed.quick.frames).toBeGreaterThanOrEqual(1);
      }
      if (t.targetsFighters) expect(t.onFighter, 'targetsFighters needs onFighter').toBeDefined();
    }
    for (const s of move.spawn ?? []) {
      expect(s.frame).toBeGreaterThanOrEqual(1);
      expect(s.frame).toBeLessThan(move.faf);
      if (move.charge !== undefined) expect(s.frame).toBeGreaterThan(move.charge);
      expect(() => entityDef(s.entity.includes('/') ? s.entity : `${def.id}/${s.entity}`)).not.toThrow();
    }
    for (const b of [...(move.reflectors ?? []), ...(move.absorbers ?? [])]) {
      expect(b.frames[1]).toBeGreaterThanOrEqual(b.frames[0]);
      expect(b.frames[1]).toBeLessThan(move.faf);
      expect(b.radius).toBeGreaterThan(0);
    }
    if (move.action === 'hover') expect(def.hover, 'hover moves need FighterDef.hover').toBeDefined();
    if (move.glide) expect(def.glide, 'glide moves need FighterDef.glide').toBeDefined();
  });

  it.each(Object.entries(def.entities ?? {}))('entity %s has consistent data', (_, e) => {
    expect(e.radius).toBeGreaterThan(0);
    for (const w of e.hits ?? []) {
      expect(w.frames[1]).toBeGreaterThanOrEqual(w.frames[0]);
      if (e.lifetime !== undefined) expect(w.frames[1]).toBeLessThanOrEqual(e.lifetime);
      expect(new Set(w.boxes.map((b) => b.id)).size).toBe(w.boxes.length);
    }
  });

  it('gives all its tether moves the same sky-anchor limit, since they share one count', () => {
    const limits = Object.values(def.moves ?? {}).flatMap((m) =>
      m.tether?.skyAnchors === undefined ? [] : [m.tether.skyAnchors],
    );
    expect(new Set(limits).size).toBeLessThanOrEqual(1);
  });

  it('has 2 to 6 jumps, like the Ultimate cast, and per-jump heights that start at doubleJumpHeight', () => {
    const { jumps, doubleJumpHeight, airJumpHeights } = def.stats;
    expect(Number.isInteger(jumps)).toBe(true);
    expect(jumps).toBeGreaterThanOrEqual(2);
    expect(jumps).toBeLessThanOrEqual(6);
    if (!airJumpHeights) return;
    expect(airJumpHeights[0]).toBe(doubleJumpHeight);
    expect(airJumpHeights.length).toBeLessThanOrEqual(jumps - 1);
    for (const h of airJumpHeights) {
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(range.air_jump_height.max);
    }
  });

  it('glides slower than it falls', () => {
    if (!def.glide) return;
    expect(def.glide.fallSpeed).toBeGreaterThan(0);
    expect(def.glide.fallSpeed).toBeLessThan(def.stats.fallSpeed);
    expect(def.glide.speed).toBeGreaterThan(0);
  });
});
