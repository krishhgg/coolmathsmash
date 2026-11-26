import { defineFighter } from '../../fighters/types';
import { spawnEntity } from '../entities/entities';
import { addMeter, spendMeter } from '../meters';
import { applyStatus } from '../statuses';
import { marioReference } from './reference';

const strike = (damage: number, status: string, hitlag?: number) => ({
  id: 0,
  x: 8,
  y: 6,
  radius: 6,
  damage,
  angle: 45,
  kbg: 30,
  bkb: 30,
  status,
  ...(hitlag !== undefined && { hitlag }),
});

/**
 * A test-only fighter (the Mario reference body) for statuses (src/sim/statuses.ts) and meters
 * (src/sim/meters.ts). `flower` is Ultimate's flower to the frame (SmashWiki, "Flower (effect)"); the rest are
 * small made-up numbers that make each rule easy to see. Not playable; tests register it.
 */
export const testStatus = defineFighter({
  id: 'test-status',
  name: 'Test: statuses and meters',
  series: 'test',
  selectable: false,
  stats: marioReference.stats,
  statuses: {
    /** Ultimate's flower: 20 + 40 x damage frames up to 3000, stacking, 1% every 21 frames, mashable. */
    flower: {
      frames: 20,
      perDamage: 40,
      max: 3000,
      stack: 'add',
      tick: { every: 21, damage: 1 },
      mash: { stick: 16, button: 28.8 },
    },
    /** A fixed 90 frames that applying again only refreshes; its script counts its frames into `heat` on fighters with that meter. */
    warm: {
      frames: 90,
      script: (x) => {
        if (x.def.meters?.heat) addMeter(x.f, 'heat', 1);
      },
    },
    /**
     * Ultimate's paralysis (SmashWiki, "Paralyze"): floor(1 + knockback x hitlag multiplier x crouch) frames up to 90,
     * frozen, ended by a later hit. The mash numbers are made up; Ultimate's paralysis has none.
     */
    stun: {
      frames: 1,
      perKnockback: 1,
      max: 90,
      freeze: true,
      endOnHit: true,
      mash: { stick: 4, button: 6 },
    },
    /**
     * Inkling's ink (SmashWiki, "Ink (status)"): 12 units a hit (Splattershot's) up to 300, held 120 frames after the
     * last hit and then wearing off 0.25 units a frame; the fighter takes 1 + ink x 0.5 / 180 times the %, at most 1.5.
     */
    ink: {
      frames: 120,
      coat: { add: 12, max: 300, decay: 0.25 },
      damageTaken: (s) => 1 + (Math.min(s.level ?? 0, 180) * 0.5) / 180,
    },
  },
  meters: {
    /** Three shots, spent by neutralB. */
    ammo: { max: 3, start: 3 },
    /** Fills by script (the warm status), drains 0.5 a frame. */
    heat: { max: 100, regen: -0.5 },
    /** One per airtime: refills on the ground. */
    hop: { max: 1, start: 1, regen: 1, grounded: true },
    /** Kept across stocks. */
    coins: { max: 99, onKo: 'keep' },
  },
  moves: {
    /** A 5% strike that flowers. */
    jab: { kind: 'other', faf: 20, hits: [{ frames: [3, 4], boxes: [strike(5, 'test-status/flower')] }] },
    /** A 4% strike that warms. */
    ftilt: { kind: 'other', faf: 20, hits: [{ frames: [3, 4], boxes: [strike(4, 'test-status/warm')] }] },
    /** A 2% strike that inks. */
    utilt: { kind: 'other', faf: 20, hits: [{ frames: [3, 4], boxes: [strike(2, 'test-status/ink')] }] },
    /** A 4% strike with x0.5 hitlag that stuns. */
    dtilt: {
      kind: 'other',
      faf: 20,
      hits: [{ frames: [3, 4], boxes: [strike(4, 'test-status/stun', 0.5)] }],
    },
    /** Spends a shot on frame 1 to fire a flowering petal; empty, it fires nothing. */
    neutralB: {
      kind: 'other',
      faf: 20,
      hits: [],
      script: (x) => {
        const { m, f } = x;
        if (f.actionFrame !== 1 || !spendMeter(f, 'ammo', 1)) return;
        const pos = { x: f.pos.x + f.facing * 6, y: f.pos.y + 8 };
        spawnEntity(m, {
          kind: 'test-status/petal',
          owner: f.port,
          pos,
          vel: { x: f.facing * 2, y: 0 },
          facing: f.facing,
          move: 'neutralB',
        });
      },
    },
    /** Warms itself: a status from a script, not a hit. */
    downB: {
      kind: 'other',
      faf: 10,
      hits: [],
      script: (x) => {
        if (x.f.actionFrame === 1) applyStatus(x.m, x.f, 'test-status/warm', { source: x.f.port });
      },
    },
  },
  entities: {
    /** A 3% shot that flowers. */
    petal: {
      radius: 1.5,
      lifetime: 120,
      hits: [{ frames: [1, 120], boxes: [{ ...strike(3, 'test-status/flower'), x: 0, y: 0, radius: 2 }] }],
    },
  },
});
