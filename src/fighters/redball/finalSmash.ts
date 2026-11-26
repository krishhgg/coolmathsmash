import { spawnEntity } from '../../sim/entities/entities';
import type { EntityCtx, EntityDef } from '../../sim/entities/types';
import type { Ctx } from '../../sim/fighter';
import type { HitboxDef, MoveDef } from '../types';

/**
 * Red Ball's Final Smash, Ball Rain: red balls rain down across the stage (the roster plan's "ball-rain final"), on
 * Ness's PK Starstorm in Ultimate. SmashWiki, "PK Starstorm" (Ultimate section) and "Ness (SSBU)/Final Smash" (hitbox
 * table); ultimateframedata.com lists no Final Smashes.
 *
 * - Timing: meteors spawn "until the Final Smash ends (frames 51-357)", "one every 23 frames (0.383 seconds) and
 *   decreasing by 0.5 frames (rounded up) with each meteor", which "results in Ness ... spawning 16 meteors". Ness
 *   acts again after frame 357, so Red Ball is actionable on 358. "Each meteorite is active for 200 frames."
 * - Spread: "Ness's meteors will spawn at the top and centre of the stage, and will fly out at a range of angles,
 *   fanning outwards from an invisible 'line' going down the middle of the stage." The balls drop from the middle of
 *   the top blast zone, RAIN.drop below it, each aimed at one of 16 lanes 12 units apart that cross y = 0 from -90 to
 *   90 (Battlefield's floor is -80 to 80), in bit-reversed order (RAIN.lanes) so the rain alternates sides and fills
 *   the gaps. Ultimate picks the angles at random; a fixed order keeps the spread the same every time.
 * - Speed: "The meteors fall faster as time passes." SmashWiki gives no speeds: each ball flies RAIN.speedUp a frame
 *   faster than the last, from RAIN.speed.
 * - Hitbox (ID 0): 8.0%, angle 42, Speed-based (launches the way the meteor flies: the ball faces its horizontal
 *   speed and launches forward), BK 67, KS 110, radius 16.0, hitlag and SDI x1.0, grounded and aerial, unblockable,
 *   unreflectable, unabsorbable, no clang, rehit rate 0 (each ball hits each fighter once). The table stretches the
 *   box from 12 to 40 along the meteor's bone; that runs along its flight, so the 32-unit band it sweeps is the same
 *   as one radius-16 circle's, and the ball is one circle the size of its drawing. Ness's is a Flame hit; a rubber
 *   ball's is a normal one.
 * - Staleness: SmashWiki's stale-move article says "each projectile fired will have its staleness set to the move's
 *   staleness" and "only one projectile produced per animation can count in the queue". The first ball to connect
 *   stales the move once, and every ball of the same use takes its multiplier (shareStale), so each deals 8% x1.05
 *   fresh, and all 16 together 128% before it.
 */
export const RAIN = {
  /** Move frame of the first ball, and the last frame of the move. */
  first: 51,
  last: 357,
  /** Frames to the second ball, and how much shorter each gap after it gets (rounded up). */
  interval: 23,
  shrink: 0.5,
  /** Frames each ball lives. */
  lifetime: 200,
  /** Where the balls drop from: this far below the middle of the top blast zone. */
  drop: 16,
  /** Where the lanes cross y = 0: 16 of them, `spacing` apart, centred on the stage. */
  lanesFrom: -90,
  spacing: 12,
  /** The first ball's speed in units a frame, and how much faster each later ball flies: estimates. */
  speed: 3,
  speedUp: 0.1,
  radius: 16,
};

/** Move frames the balls drop on: 51, then gaps of ceil(23 - 0.5 n) frames while they fit in the move. */
export const RAIN_FRAMES: readonly number[] = (() => {
  const out: number[] = [];
  for (let f = RAIN.first, n = 0; f <= RAIN.last; f += Math.ceil(RAIN.interval - RAIN.shrink * n), n++)
    out.push(f);
  return out;
})();

/** Reverses the low four bits: 0, 8, 4, 12, 2, 10, ... spreads 16 lanes evenly in any prefix. */
const reverse4 = (i: number) => ((i & 1) << 3) | ((i & 2) << 1) | ((i & 4) >> 1) | ((i & 8) >> 3);

/** Where each ball's flight crosses y = 0, from the stage's middle, in drop order. */
export const RAIN_LANES: readonly number[] = RAIN_FRAMES.map(
  (_, i) => RAIN.lanesFrom + RAIN.spacing * reverse4(i),
);

/** PK Starstorm's meteor (SmashWiki, Ness (SSBU)/Final Smash). */
export const STARSTORM_HIT = { damage: 8, angle: 42, kbg: 110, bkb: 67 } as const;

const BALL_HIT: HitboxDef = { id: 0, x: 0, y: 0, radius: RAIN.radius, ...STARSTORM_HIT };

/** A ball not yet connected takes the stale multiplier of a ball from the same use that has (see RAIN). */
function shareStale({ m, e }: EntityCtx): void {
  if (e.stale !== 0) return;
  const fired = m.entities.find(
    (o) => o.kind === e.kind && o.owner === e.owner && o.data.use === e.data.use && o.stale !== 0,
  );
  if (fired) e.stale = fired.stale;
}

/** One of Ball Rain's balls: it falls through the stage and everyone under it, hitting each fighter once. */
export const ball: EntityDef = {
  radius: RAIN.radius,
  lifetime: RAIN.lifetime,
  floor: 'pass',
  wall: 'pass',
  pierce: true,
  transcendent: true,
  reflectable: false,
  absorbable: false,
  hits: [{ frames: [1, RAIN.lifetime], boxes: [BALL_HIT] }],
  script: shareStale,
};

/** The velocity of ball `i`: from the drop point towards its lane on y = 0, faster for later balls. */
export function ballVelocity(i: number, dropY: number): { x: number; y: number } {
  const lane = RAIN_LANES[i]!;
  const speed = RAIN.speed + RAIN.speedUp * i;
  const len = Math.hypot(lane, dropY);
  return { x: (lane / len) * speed, y: (-dropY / len) * speed };
}

/** Drops ball `i` from the top of the stage's middle. */
function drop(x: Ctx, i: number): void {
  const { m, f } = x;
  const b = x.stage.geo.blastZones;
  const at = { x: (b.left + b.right) / 2, y: b.top - RAIN.drop };
  const vel = ballVelocity(i, at.y);
  const e = spawnEntity(m, {
    kind: `${x.def.id}/ball`,
    owner: f.port,
    pos: at,
    vel,
    facing: vel.x < 0 ? -1 : 1,
    move: f.move,
    final: true,
  });
  e.data.use = m.frame - f.actionFrame;
}

/**
 * Ball Rain. Grounded or in the air, Red Ball holds still and calls the rain down (Ness stays put through PK
 * Starstorm), and acts again on frame 358. CPUs use it on anyone up to 160 units in front: the rain covers the
 * stage wherever he stands.
 */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: RAIN.last + 1,
  final: { still: true, range: 160 },
  hits: [],
  script(x) {
    const i = RAIN_FRAMES.indexOf(x.f.actionFrame);
    if (i >= 0) drop(x, i);
  },
};
