import { describe, expect, it } from 'vitest';
import ref from '../sim/reference/physics-constants.json';
import { FIGHTERS } from './registry';
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

describe.each(Object.values(FIGHTERS).map((f) => [f.id, f] as const))('fighter %s', (_, def) => {
  it.each(CAST)('%s is within the Ultimate cast range', (stat, { min, max }) => {
    expect(def.stats[stat]).toBeGreaterThanOrEqual(min);
    expect(def.stats[stat]).toBeLessThanOrEqual(max);
  });

  it.each(Object.entries(def.moves ?? {}))('move %s has consistent frame data', (name, move) => {
    expect(move.faf, name).toBeGreaterThan(1);
    if (move.transform) {
      expect(move.transform.frame).toBeLessThan(move.faf);
      expect(
        FIGHTERS[move.transform.into]?.moves?.[name],
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
    for (const [a, b] of move.autoCancel ?? []) expect(b).toBeGreaterThanOrEqual(a);
  });
});
