import type { HitboxDef } from '../types';
import type { EntityCtx, EntityDef } from '../../sim/entities/types';

/** A tennis ball's hitbox: centred on the ball, Ultimate-style knockback numbers. */
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
 * entity because an entity carries its own damage. Speeds and lifetimes give the roster's ranges.
 */
export const entities: Record<string, EntityDef> = {
  /** Rapid Fire (jab): 1.5% point-blank balls that fly 40 units and only make the target flinch. */
  jabBall: straight(13, hit(1.5, 361, 20, 8)),
  /** Straight Shot (forward tilt): 6%, straight ahead for 100 units. */
  shot: straight(31, hit(6, 361, 45, 25)),
  /** Air Shot (forward air): 6% straight ahead, 75 units. */
  airShot: straight(25, hit(6, 361, 45, 25)),
  /** Recoil Blast (back air): 7% fired behind them, 75 units. */
  recoilShot: straight(25, hit(7, 361, 55, 25)),
  /** Up Shot (up air): 6% straight up, 75 units; pops the target upward. */
  upShot: straight(25, hit(6, 88, 60, 30)),
  /** Down Shot (down air): 6% straight down, 60 units; knocks the target up and away rather than spiking. */
  downShot: straight(20, hit(6, 75, 50, 35)),
  /** Ring Volley (neutral air): one of four 3% balls fired on the diagonals, 35 units. */
  ringBall: straight(15, hit(3, 361, 50, 20)),
  /**
   * Lob (up tilt): fired straight up, it rises about 44 units in 26 frames and falls back down: 5% on the way up,
   * 3% on the way down.
   */
  lob: {
    radius: 1.4,
    lifetime: 90,
    gravity: 0.13,
    maxFall: 2.6,
    hits: [
      { frames: [1, 26], boxes: [hit(5, 88, 60, 35)] },
      { frames: [27, 90], boxes: [hit(3, 80, 40, 30)] },
    ],
  },
  /** Skip Shot (down tilt): skims along the ground in low hops for about 100 units; 5%, pops the target up. */
  skip: {
    radius: 1.4,
    lifetime: 40,
    gravity: 0.12,
    maxFall: 2,
    floor: 'bounce',
    bounce: 1,
    hits: [{ frames: [1, 40], boxes: [hit(5, 80, 40, 45)] }],
    script: faceTravel,
  },
};
