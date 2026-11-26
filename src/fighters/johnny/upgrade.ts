import { Btn } from '../../input/types';
import { startMove } from '../../sim/actions/attack';
import { wantsJump } from '../../sim/actions/common';
import { buffered, isHeld } from '../../sim/control';
import { destroyEntity, spawnEntity } from '../../sim/entities/entities';
import type { EntityDef } from '../../sim/entities/types';
import type { Ctx } from '../../sim/fighter';
import { addMeter, meter, spendMeter, type MeterDef } from '../../sim/meters';
import type { StatusDef } from '../../sim/statuses';
import type { HitboxDef, MoveDef } from '../types';
import { LASER, MUZZLE } from './entities';

/**
 * The upgrade meter: Cloud's Limit Gauge in Ultimate (SmashWiki, "Limit (status)" and "Limit Charge";
 * ultimateframedata.com, Cloud). 100 units. Limit Charge adds 0.3 a frame (version 7.0.0 on), so it fills from empty
 * in 334 frames; damage adds 0.667 per % dealt (150% fills it) and 1 per % taken. Full, it is Limit Break for 900
 * frames (15 seconds), and then the gauge empties. The next Limit special empties it on use, hit or miss.
 */
export const LIMIT = { max: 100, charge: 0.3, dealt: 0.667, taken: 1, frames: 900 } as const;

export const UPGRADE_METER = 'upgrade';
export const UPGRADED = 'johnny/upgraded';

export const meters: Record<string, MeterDef> = {
  [UPGRADE_METER]: { max: LIMIT.max, dealt: LIMIT.dealt, taken: LIMIT.taken, full: UPGRADED },
};

/** Limit Break's 900 frames, shown as a coin-gold badge by his head while the meter is full. */
export const statuses: Record<string, StatusDef> = {
  upgraded: { frames: LIMIT.frames, color: '#ffd21a' },
};

export const upgraded = (x: Ctx): boolean => meter(x.f, UPGRADE_METER) >= LIMIT.max;

/**
 * Coin Magnet's timeline. Limit Charge charges from its first frame and is interruptible on frame 8 (SmashWiki's
 * timing table), 7 frames after the last frame held (ultimateframedata.com: "Takes 7 frames to cancel"). Here the
 * magnet comes up on frames 1-4, frames 5-16 are one 12-frame cycle of coins flying in that repeats while Special is
 * held, and frames 17-22 put it away, so he acts on frame 23: 7 frames after the last frame held, 8 for a tap.
 */
export const MAGNET = { loop: [5, 16], end: 17, faf: 23 } as const;

/**
 * Coin Magnet (down special): Cloud's Limit Charge. Each frame Special is held adds 0.3 to the upgrade meter. Letting
 * go, a shield or air dodge press, a jump or a full meter ends it in the 7 frames of lag Limit Charge has for every one
 * of its cancels (SmashWiki: shielding and dodging have "the same delay" as letting go); a held or buffered shield,
 * dodge or jump then comes out on frame 23. In the air he falls as usual and keeps charging through a landing.
 */
function coinMagnet(x: Ctx): void {
  const { f, c } = x;
  if (f.actionFrame > MAGNET.end) return;
  const stop = upgraded(x) || !isHeld(c, Btn.Special) || buffered(c, Btn.Shield) || wantsJump(x);
  if (stop) {
    f.actionFrame = MAGNET.end;
    return;
  }
  // Back to the top of the cycle; the action plays that frame now, and that pass charges.
  if (f.actionFrame === MAGNET.end) {
    f.actionFrame = MAGNET.loop[0];
    return;
  }
  addMeter(f, UPGRADE_METER, LIMIT.charge);
}

/**
 * On a special's first frame with a full meter, play its upgraded version instead and empty the meter. A special
 * without one (sideB, upB, downB) leaves the meter full.
 */
function upgradeInto(x: Ctx, move: string): boolean {
  if (x.f.actionFrame !== 1 || !upgraded(x)) return false;
  spendMeter(x.f, UPGRADE_METER, LIMIT.max);
  return startMove(x, move);
}

/** `script` that first upgrades into `move` when the meter is full. */
export function upgradable(move: string, script?: MoveDef['script']): MoveDef['script'] {
  return (x) => {
    if (!upgradeInto(x, move)) script?.(x);
  };
}

/**
 * Upgraded Laser's timing on the Limit pattern: Limit Blade Beam fires on frame 16 against Blade Beam's 18, and is
 * interruptible on 61 against 54 (SmashWiki, Cloud (SSBU)/Neutral special; ultimateframedata.com). The upgraded shot
 * takes the same 2 frames off Laser Gun's startup and adds the same 7 to its ending, standing and in the air, and it
 * is intangible from 6 frames before the shot to 1 after, as Limit Blade Beam is on 10-17.
 */
export const UPGRADED_LASER = {
  ground: { shot: 8 - 2, faf: 42 + 7 },
  air: { shot: 7 - 2, faf: 39 + 7, landingLag: 6 },
} as const;

const intangible = (shot: number): [number, number] => [Math.max(1, shot - 6), shot + 1];

export const upgradeMoves: Record<string, MoveDef> = {
  downB: {
    kind: 'other',
    faf: MAGNET.faf,
    hits: [],
    continuesOnLanding: true,
    script: coinMagnet,
  },
  /**
   * Upgraded Laser (neutral special with a full meter): Limit Blade Beam's hits on a bigger bolt that bursts where it
   * lands (entities.ts), on the Limit timing above. One shot; no repeat.
   */
  neutralBUpgraded: {
    kind: 'other',
    faf: UPGRADED_LASER.ground.faf,
    air: 'neutralBUpgradedAir',
    intangible: intangible(UPGRADED_LASER.ground.shot),
    hits: [],
    spawn: [
      { frame: UPGRADED_LASER.ground.shot, entity: 'megaLaser', x: MUZZLE.x, y: MUZZLE.y, vx: LASER.speed },
    ],
  },
  neutralBUpgradedAir: {
    kind: 'other',
    faf: UPGRADED_LASER.air.faf,
    landingLag: UPGRADED_LASER.air.landingLag,
    intangible: intangible(UPGRADED_LASER.air.shot),
    hits: [],
    spawn: [
      { frame: UPGRADED_LASER.air.shot, entity: 'megaLaser', x: MUZZLE.x, y: MUZZLE.airY, vx: LASER.speed },
    ],
  },
};

/**
 * Upgraded Laser's hits and sizes: Limit Blade Beam in Ultimate (SmashWiki, Cloud (SSBU)/Neutral special, grounded
 * Limit hitbox table). A 6% beam (BKB 38, KBG 60, radius 5.5) bursts where it hits into five looping 2% hits
 * (autolink 366, 40 set knockback, x0.5 hitlag, one every 6 frames on frames 1-28) and a 3% finisher on 29-30 (48
 * degrees, BKB 50, KBG 226), radius 14: 19% on the target it hits and 13% on anyone else in the burst, the totals
 * SmashWiki's Limit page gives. The table lists the beam's angle as "Speed-based"; it is read here as 365, the
 * autolink angle that launches from the attacker's motion (SmashWiki, "Autolink angle").
 */
export const MEGA_LASER = {
  bolt: { radius: 5.5, damage: 6, angle: 365, kbg: 60, bkb: 38 },
  loop: { every: 6, hits: 5, damage: 2, angle: 366, kbg: 100, bkb: 0, wbkb: 40, hitlag: 0.5 },
  final: { frames: [29, 30] as [number, number], damage: 3, angle: 48, kbg: 226, bkb: 50 },
  burstRadius: 14,
} as const;

const { bolt, loop, final } = MEGA_LASER;
const box = (radius: number, hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>): HitboxDef => ({
  id: 0,
  x: 0,
  y: 0,
  radius,
  ...hit,
});

/**
 * Upgraded Laser's projectiles, kept here rather than in entities.ts because the bolt's script spawns the burst (sim
 * code entities.ts can't load: the art reads entities.ts before the fighter registry is ready).
 */
export const upgradeEntities: Record<string, EntityDef> = {
  /**
   * The bolt: Limit Blade Beam's beam at the laser's speed and range, transcendent like the laser. It goes through
   * what it hits so its script sees the contact; on the next frame it bursts there and is used up. It lives one frame
   * past its last active frame, so a contact on that frame still bursts; with none, it expires then, before moving.
   */
  megaLaser: {
    radius: bolt.radius,
    lifetime: LASER.lifetime + 1,
    transcendent: true,
    pierce: true,
    hits: [
      {
        frames: [1, LASER.lifetime],
        boxes: [box(bolt.radius, { damage: bolt.damage, angle: bolt.angle, kbg: bolt.kbg, bkb: bolt.bkb })],
      },
    ],
    script({ m, e }) {
      if (e.hitVictims.length === 0) {
        if (e.age > LASER.lifetime) destroyEntity(m, e, 'expired');
        return;
      }
      const burst = spawnEntity(m, {
        kind: 'johnny/laserBurst',
        owner: e.owner,
        pos: e.pos,
        facing: e.facing,
        move: e.move,
      });
      // The same move's hit: it keeps the bolt's staleness and a reflection's damage multiplier.
      burst.stale = e.stale;
      burst.damageMul = e.damageMul;
      destroyEntity(m, e, 'hit');
    },
  },
  /** The burst: still, through the stage, hitting everyone in it; it can't be reflected or absorbed. */
  laserBurst: {
    radius: MEGA_LASER.burstRadius,
    lifetime: final.frames[1],
    floor: 'pass',
    wall: 'pass',
    transcendent: true,
    pierce: true,
    reflectable: false,
    absorbable: false,
    hits: [
      ...Array.from({ length: loop.hits }, (_, i) => ({
        frames: [1 + i * loop.every, 1 + i * loop.every] as [number, number],
        rehit: true,
        boxes: [
          box(MEGA_LASER.burstRadius, {
            damage: loop.damage,
            angle: loop.angle,
            kbg: loop.kbg,
            bkb: loop.bkb,
            wbkb: loop.wbkb,
            hitlag: loop.hitlag,
          }),
        ],
      })),
      {
        frames: final.frames,
        rehit: true,
        boxes: [
          box(MEGA_LASER.burstRadius, {
            damage: final.damage,
            angle: final.angle,
            kbg: final.kbg,
            bkb: final.bkb,
          }),
        ],
      },
    ],
  },
};
