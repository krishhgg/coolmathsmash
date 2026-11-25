import type { HitboxDef } from '../types';
import type { EntityCtx, EntityDef } from '../../sim/entities/types';

/** A tennis ball's hitbox, centred on the ball. */
const hit = (damage: number, angle: number, kbg: number, bkb: number, radius = 1.6): HitboxDef => ({
  id: 0,
  x: 0,
  y: 0,
  radius,
  damage,
  angle,
  kbg,
  bkb,
});

/**
 * Balls face the way they fly, so a ball fired backward (back air, the rear half of the ring volley) launches its
 * victim backward too.
 */
function faceTravel(x: EntityCtx): void {
  if (x.e.vel.x !== 0) x.e.facing = x.e.vel.x < 0 ? -1 : 1;
}

/** A straight-flying tennis ball: no gravity, gone at the stage, \`lifetime\` frames of travel. */
const straight = (lifetime: number, box: HitboxDef): EntityDef => ({
  radius: 1.4,
  lifetime,
  hits: [{ frames: [1, lifetime], boxes: [box] }],
  script: faceTravel,
});

/**
 * Raft Wars kids' tennis balls (the launcher has unlimited balls, as in Raft Wars). Each kind of shot is its own
 * entity because an entity carries its own damage. Speeds and lifetimes give the roster's ranges. Launch angles
 * and knockback come from the named Ultimate analogues (13.0.1).
 */
export const entities: Record<string, EntityDef> = {
  /** Rapid Fire (jab): 1.5%, about 40 units. Duck Hunt's jab 1. */
  jabBall: straight(13, hit(1.5, 361, 30, 20)),
  /** Straight Shot (forward tilt): 6%, about 100 units. Duck Hunt's unangled forward tilt. */
  shot: straight(31, hit(6, 361, 100, 35)),
  /** Air Shot (forward air): 6%, about 75 units. Villager's late forward slingshot. */
  airShot: straight(25, hit(6, 361, 100, 10)),
  /** Recoil Blast (back air): 7%, about 75 units behind them. Villager's late backward slingshot. */
  recoilShot: straight(25, hit(7, 361, 100, 10)),
  /** Up Shot (up air): 6%, about 75 units straight up. Duck Hunt's up-air finisher. */
  upShot: straight(25, hit(6, 91, 120, 50)),
  /** Down Shot (down air): 6%, about 60 units straight down. Duck Hunt's non-spike down-air finisher. */
  downShot: straight(20, hit(6, 70, 90, 10)),
  /** Ring Volley (neutral air): one of four 3% balls on the diagonals. Duck Hunt's late neutral air. */
  ringBall: straight(15, hit(3, 361, 90, 22)),
  /**
   * Lob (up tilt): fired straight up, it rises about 44 units in 26 frames and falls back down: 5% on the way up,
   * 3% on the way down. Duck Hunt's up tilt on the way up, the Trick Shot can's travelling hit on the way down.
   */
  lob: {
    radius: 1.4,
    lifetime: 90,
    gravity: 0.13,
    maxFall: 2.6,
    hits: [
      { frames: [1, 26], boxes: [hit(5, 93, 40, 95)] },
      { frames: [27, 90], boxes: [hit(3, 80, 40, 50)] },
    ],
  },
  /** Skip Shot (down tilt): 5%, skims along the ground in low hops for about 100 units. Duck Hunt's down tilt. */
  skip: {
    radius: 1.4,
    lifetime: 40,
    gravity: 0.12,
    maxFall: 2,
    floor: 'bounce',
    bounce: 1,
    hits: [{ frames: [1, 40], boxes: [hit(5, 25, 60, 50)] }],
    script: faceTravel,
  },
};
