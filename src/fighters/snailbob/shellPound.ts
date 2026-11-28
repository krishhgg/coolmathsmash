import type { HitboxDef, MoveDef } from '../types';
import { startMove } from '../../sim/actions/attack';
import { enterAction } from '../../sim/actions/registry';
import type { Ctx } from '../../sim/fighter';
import { leaveGround } from '../../sim/movement';
import { approach } from '../../sim/vec';

/**
 * Shell Pound (down special), on Bowser's Bowser Bomb in Ultimate. Frames and speeds are SmashWiki's ("Bowser
 * (SSBU)/Down special": Timing and Parameters); damage, angles, BKB, KBG, set knockback, shield damage and which foes
 * each box can hit are the 13.0.1 hitbox data on ultimate-hitboxes.com (RSN-Bran/ultimate-hitboxes,
 * server/data/14_bowser.json: BowserBowserBombG, BowserBowserBomb, BowserBowserBombLanding), which SmashWiki's tables
 * repeat.
 */
export const POUND = {
  /** On the ground he hops on this frame, with the rising hit ("Jump: 11"). */
  hop: 11,
  /** The drop starts on this frame from the ground ("Fall, clean hit: 37-39") and from the air ("Clean hit: 31-32"). */
  drop: 37,
  dropAir: 31,
  /**
   * The late hit's first frame ("Fall, late hit: 40-", aerial "Late hit: 33-"). The drop holds it until he lands:
   * "The falling portion lasts indefinitely until Bowser lands".
   */
  late: 40,
  lateAir: 33,
  /** Before the drop: air friction 0.02, gravity 0.03 and fall speed 0.4 ("... before fall portion"). */
  friction: 0.02,
  gravity: 0.03,
  maxFall: 0.4,
  /** Started in the air, his speed is multiplied by 0.8 across and 0.5 up or down ("... on aerial startup"). */
  startX: 0.8,
  startY: 0.5,
  /** The drop: straight down at 9 units a frame ("Fall portion vertical speed: -9"). */
  fall: 9,
  /**
   * The grounded hop's take-off speed. Ultimate doesn't publish the leap's, so this one rises 12.35 units (his
   * 12.24 short hop) by the drop under the 0.03 gravity above and carries him about 6.5 units forward.
   */
  hopX: 0.5,
  hopY: 0.85,
  /** The landing's first actionable frame ("Interruptible: 55"); its hit is out on frames 1-2. */
  landFaf: 55,
} as const;

/** Shorthand for a hitbox: id, x forward, y up, radius, then the hit's numbers. */
const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({
  id,
  x,
  y,
  radius,
  ...hit,
});

/**
 * Bowser's boxes are sized for Bowser: their radii and heights are scaled by 0.72, which turns his 8.3-unit fall box
 * into the 6 that covers Snail Bob's shell. The rising boxes sit along the front of the shell instead of out at
 * Bowser's horns (13 to 22.5 units ahead), keeping his order: the 90° box nearest, then 80°, then the small 100° tip.
 * Set weight on the rising hit and the grounded clean fall isn't modelled (the engine has no set-weight flag); for
 * Mario's 98 it changes their knockback by about 1%. SDI multipliers aren't modelled either.
 */
const RISE = { damage: 4, kbg: 100, bkb: 0, wbkb: 60, direction: 'away' } as const;
const CLEAN = { damage: 20, angle: 290, kbg: 65, bkb: 13, shieldDamage: 5 } as const;
const LATE = { damage: 20, angle: 76, kbg: 75, bkb: 45, shieldDamage: 5 } as const;
/** The landing hit hits only grounded foes (ground_or_air: collision_situation_mask_g). */
const LAND = {
  damage: 11,
  angle: 76,
  kbg: 72,
  bkb: 60,
  shieldDamage: 5,
  direction: 'away',
  targets: 'ground',
} as const;
/** Height of the fall boxes: Bowser's 5.2, scaled. */
const FALL_Y = 3.7;

/** Take off from the ground mid-move: the rest of it plays in the air. */
function hop(x: Ctx): void {
  const { f } = x;
  const { move, actionFrame } = f;
  leaveGround(x);
  enterAction(x, 'aerial', actionFrame);
  f.move = move;
  f.vel.x = f.facing * POUND.hopX;
  f.vel.y = POUND.hopY;
}

/**
 * The airborne part. Before the drop his momentum fades by Bowser Bomb's friction and gravity (`stall`, skipped on
 * the frame that set it); from the drop on he falls straight down, holding the late hit's frame until he lands. The
 * move turns gravity off and the script sets the speed, so it marks him fast-falling to keep a down flick from
 * overriding it, as the down air does.
 */
function inAir(x: Ctx, drop: number, late: number, stall: boolean): void {
  const { f } = x;
  f.fastFalling = true;
  if (f.actionFrame < drop) {
    if (!stall) return;
    f.vel.x = approach(f.vel.x, 0, POUND.friction);
    f.vel.y = Math.max(f.vel.y - POUND.gravity, -POUND.maxFall);
    return;
  }
  f.vel.x = 0;
  f.vel.y = -POUND.fall;
  if (f.actionFrame > late) f.actionFrame = late;
}

/**
 * The airborne parts' shared flags: their own physics, a ledge grab from the drop that catches a ledge behind him as
 * well as in front (Bowser Bomb "can be used to snap to ledge, regardless if Bowser is facing the ledge"), and landing
 * into `downBLand`.
 */
const airborne = {
  continuesOnLanding: true,
  drift: false,
  gravity: false,
  fallThrough: false,
  ledgeBehind: true,
} as const;

export const shellPound: Record<string, MoveDef> = {
  /**
   * Shell Pound on the ground: he tucks into his shell, hops up and forward with a scooping hit that lifts foes in
   * front of him (set knockback, so it never KOs), hangs, and drops on frame 37 with a meteor that turns into the
   * late hit from frame 40 until he lands. The drop forgets who the scoop hit, so the two can combo, as Bowser's do.
   * It lands on soft platforms even with the stick held down (SmashWiki, "Platform": grounded Bowser Bomb rises up
   * through a soft platform and falls back onto it) and can grab a ledge from the drop on.
   */
  downB: {
    kind: 'other',
    faf: POUND.late + 1,
    air: 'downBAir',
    ...airborne,
    ledgeFrom: POUND.drop,
    hits: [
      {
        frames: [POUND.hop, POUND.hop],
        boxes: [
          box(0, 6, 3.6, 2.9, { ...RISE, angle: 80 }),
          box(1, 8.5, 3.6, 1.5, { ...RISE, angle: 100 }),
          box(2, 3.5, 3.6, 2.9, { ...RISE, angle: 90 }),
        ],
      },
      { frames: [POUND.drop, POUND.late - 1], rehit: true, boxes: [box(0, 0, FALL_Y, 6, CLEAN)] },
      { frames: [POUND.late, POUND.late], boxes: [box(0, 0, FALL_Y, 6, LATE)] },
    ],
    script(x) {
      const { f } = x;
      const frame = f.actionFrame;
      if (f.ground) {
        if (frame > POUND.hop) startMove(x, 'downBLand');
        else if (frame === POUND.hop) hop(x);
        return;
      }
      inAir(x, POUND.drop, POUND.late, frame > POUND.hop);
    },
  },
  /**
   * Shell Pound in the air: the drop alone. His speed drops to 0.8 across and half up or down, he hangs until frame
   * 31, then drops with the meteor (31-32) and the late hit from frame 33 until he lands. Over a pit he falls to the
   * blast zone, as Bowser does.
   */
  downBAir: {
    kind: 'other',
    faf: POUND.lateAir + 1,
    ...airborne,
    ledgeFrom: POUND.dropAir,
    hits: [
      { frames: [POUND.dropAir, POUND.lateAir - 1], boxes: [box(0, 0, FALL_Y, 6.2, CLEAN)] },
      { frames: [POUND.lateAir, POUND.lateAir], boxes: [box(0, 0, FALL_Y, 6, LATE)] },
    ],
    script(x) {
      const { f } = x;
      if (f.ground) {
        startMove(x, 'downBLand');
        return;
      }
      if (f.actionFrame === 1) {
        f.vel.x *= POUND.startX;
        f.vel.y = Math.max(f.vel.y * POUND.startY, -POUND.maxFall);
      }
      inAir(x, POUND.dropAir, POUND.lateAir, f.actionFrame > 1);
    },
  },
  /**
   * Shell Pound's landing: a shockwave on both sides that hits only grounded foes (Bowser's capsule from 5.5 behind
   * to 5.5 ahead, as three circles), then the landing lag to frame 55.
   */
  downBLand: {
    kind: 'other',
    faf: POUND.landFaf,
    hits: [
      {
        frames: [1, 2],
        boxes: [box(0, 4, 1.1, 5.8, LAND), box(1, -4, 1.1, 5.8, LAND), box(2, 0, 1.1, 5.8, LAND)],
      },
    ],
  },
};
