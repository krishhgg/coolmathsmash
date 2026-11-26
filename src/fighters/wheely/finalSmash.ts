import type { Ctx } from '../../sim/fighter';
import type { HitWindow, MoveDef } from '../types';
import { FULL_THROTTLE, FULL_THROTTLE_RANGE, THROTTLE_BOXES, dashStep } from './finalSmashData';
import { stats } from './stats';

/**
 * Wheely's Final Smash, Full Throttle, on Captain Falcon's Blue Falcon: the Ultimate numbers and their sources are in
 * finalSmashData.ts, which the art reads too.
 */

/** One window a frame, each with the box Wheely carries (THROTTLE_BOXES). */
const hits: HitWindow[] = THROTTLE_BOXES.map(({ frame, x, y, radius }) => ({
  frames: [frame, frame],
  boxes: [{ id: 0, x, y, radius, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true }],
}));

/**
 * Parked with the brake on through the freeze, then the dash through the boxes and the skid. Ground friction comes
 * off each frame's speed after the script, so it is added back to land the box exactly.
 */
function drive(x: Ctx): void {
  const { f } = x;
  const k = f.actionFrame - FULL_THROTTLE.hit[0];
  if (k < 0) f.vel.x = 0;
  else if (k <= 2) {
    const d = dashStep(k);
    f.vel.x = d === 0 ? 0 : f.facing * (d + (f.ground ? stats.groundFriction : 0));
  } else f.vel.x *= FULL_THROTTLE.brake;
}

const move = (final: MoveDef['final']): MoveDef => ({
  kind: 'other',
  faf: FULL_THROTTLE.faf,
  final,
  commandGrab: 'finalSmashCinematic',
  hits,
  script: drive,
});

/** Full Throttle: CPUs fire it at anyone the Blue Falcon's boxes would reach. */
export const finalSmash: MoveDef = {
  ...move({ freeze: FULL_THROTTLE.freeze, still: true, range: FULL_THROTTLE_RANGE }),
  air: 'finalSmashAir',
};

/** In the air he holds his height and dashes level. */
export const finalSmashAir: MoveDef = move({ freeze: FULL_THROTTLE.freeze, still: true });

/**
 * The cinematic, everyone else held still: the crash (10%), then he backs up, revs and runs them over (20%), and a
 * last blast on the horn is the final launch (10%). He stays parked in the sim; the art draws the run-up.
 */
export const finalSmashCinematic: MoveDef = {
  kind: 'other',
  faf: FULL_THROTTLE.cinematicFaf,
  final: { still: true },
  hits: [],
  holdHits: [
    { ...FULL_THROTTLE.crash, hitlag: 0 },
    { ...FULL_THROTTLE.ram, hitlag: 0 },
  ],
  throw: {
    frame: FULL_THROTTLE.launch.frame,
    hit: {
      damage: FULL_THROTTLE.launch.damage,
      angle: FULL_THROTTLE.launch.angle,
      bkb: FULL_THROTTLE.launch.bkb,
      kbg: FULL_THROTTLE.launch.kbg,
      hitlag: 0,
    },
  },
  script(x) {
    x.f.vel.x = 0;
  },
};
