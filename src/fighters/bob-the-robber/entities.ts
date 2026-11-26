import type { HitboxDef } from '../types';
import type { EntityDef } from '../../sim/entities/types';

/**
 * Stun Gun (neutral special) is Zero Suit Samus's Paralyzer in Ultimate. Sources: SmashWiki's Zero Suit Samus
 * (SSBU)/Neutral special (hitboxes, timing), its Paralyze article (the paralysis formula) and ultimateframedata.com
 * (startup, total frames, shieldstun).
 *
 * - Charging: Special held pauses the move on frame 20 (SmashWiki: "charges between 20-21") for up to 22 frames, the
 *   gap between ultimateframedata's uncharged and full-charge startups (21 and 43). Letting go fires on the next
 *   frame and the move ends 28 frames after the release (FAF 49 uncharged, 71 after a full charge). The charge is
 *   not stored.
 * - The shot: SmashWiki lists one hitbox set for every charge short of full and another for a full charge, so a
 *   partial charge fires the uncharged shot. Uncharged: 4%, Sakurai angle, set knockback 21, 100 growth, radius 1.3,
 *   x1.0 hitlag on its first frame and x0.7 after; it lasts 24 frames (SmashWiki: shot frames 21-44). Full charge:
 *   6%, set knockback 70, 100 growth, radius 2.0, x0.7 hitlag, 48 frames (43-90), as two boxes in the same place:
 *   an air-only one at 60 degrees (SmashWiki's ID 2) and a grounded-only one at 315 (ID 3), which keeps a standing
 *   target on the floor, sliding away.
 * - Speed: no source gives the Paralyzer's speed. SmashWiki says a charged shot is slower but reaches further, so
 *   these are estimates: 2.2 units a frame uncharged (about 51 units of travel) and 1.8 at full charge (about 85).
 * - Paralysis: the victim freezes for floor(knockback x hitlag multiplier x crouch) + 1 frames, at most 90
 *   (SmashWiki, "Paralyze"; the SSBU calculator's ParalysisTime), in place of the hit's hitlag, then takes the
 *   knockback. A later hit ends it, and a hit that ends it does not paralyze again. SmashWiki documents no mashing
 *   out of paralysis, so it has none. It does not go through a shield: a shielded shot only deals shieldstun.
 */
export const STUN_GUN = { charge: 20, chargeFrames: 22, shot: 21, faf: 49 } as const;

/** The two shots: speed in units a frame, lifetime in frames, body and hitbox radius. */
export const SHOTS = {
  stunShot: { speed: 2.2, lifetime: 24, radius: 1.3 },
  stunShotFull: { speed: 1.8, lifetime: 48, radius: 2.0 },
} as const;

/** Where a shot appears, from his feet (x forward, y up): just past the taser's prongs, at chest height. */
export const MUZZLE = { x: 9.6, y: 6.0 } as const;

export const PARALYZED = 'bob-the-robber/paralyzed';

const shotBox = (hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'status'>): HitboxDef => ({
  id: 0,
  x: 0,
  y: 0,
  status: PARALYZED,
  ...hit,
});

const UNCHARGED = { radius: 1.3, damage: 4, angle: 361, kbg: 100, bkb: 0, wbkb: 21 } as const;
const FULL = { radius: 2.0, damage: 6, kbg: 100, bkb: 0, wbkb: 70, hitlag: 0.7 } as const;

/** The taser's shots. Each is used up by its first hit (or shield) and vanishes against the stage. */
export const entities: Record<string, EntityDef> = {
  stunShot: {
    radius: SHOTS.stunShot.radius,
    lifetime: SHOTS.stunShot.lifetime,
    hits: [
      { frames: [1, 1], boxes: [shotBox({ ...UNCHARGED, hitlag: 1 })] },
      { frames: [2, SHOTS.stunShot.lifetime], boxes: [shotBox({ ...UNCHARGED, hitlag: 0.7 })] },
    ],
  },
  stunShotFull: {
    radius: SHOTS.stunShotFull.radius,
    lifetime: SHOTS.stunShotFull.lifetime,
    hits: [
      {
        frames: [1, SHOTS.stunShotFull.lifetime],
        boxes: [
          shotBox({ ...FULL, angle: 60, targets: 'air' }),
          { ...shotBox({ ...FULL, angle: 315, targets: 'ground' }), id: 1 },
        ],
      },
    ],
  },
};
