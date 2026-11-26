import { chargeLerp, chargeLevel } from '../../sim/actions/charge';
import { spawnEntity } from '../../sim/entities/entities';
import type { EntityDef } from '../../sim/entities/types';
import type { Ctx } from '../../sim/fighter';
import type { MoveDef } from '../types';

/**
 * Aimed Shot (neutral special): Raft Wars' power shot. Hold Special to charge the launcher, release to fire a tennis
 * ball on an arc that flies faster and hits harder the longer it charged.
 *
 * Analogue: Samus's Charge Shot in Ultimate without its storage (SmashWiki, "Samus (SSBU)/Neutral special"; Ultimate
 * Frame Data). Charging starts on frame 13 and lasts up to 112 frames (Ultimate Frame Data's 125 frames to full
 * charge, counted from the input). The shot comes out 3 frames after the release, on frame 16, and the kids can act
 * again 32 frames after the release (grounded, FAF 45; 46 in the air). Damage runs from 5% to 28%, speed from 1.6 to
 * 3.3 units a frame, and the shot lives 60 frames. Releasing Special or reaching full charge fires; nothing is stored,
 * as in Raft Wars, where every shot is aimed and fired in one go.
 */
export const AIMED_SHOT = {
  charge: 13,
  chargeFrames: 112,
  fire: 16,
  faf: 45,
  airFaf: 46,
  damage: 5,
  fullDamage: 28,
  speed: 1.6,
  fullSpeed: 3.3,
  lifetime: 60,
  /**
   * The arc. Charge Shot flies straight; the kids' ball leaves the launcher 10 degrees up and falls back down, with
   * gravity picked so that a full-charge shot from the launcher comes down at the end of Charge Shot's 60 frames, about
   * 190 units out. A half-charge shot lands about 113 units ahead and an uncharged one about 57.
   */
  elevation: 10,
  gravity: 0.022,
  /**
   * Where the ball appears on the firing frame, from the feet (x forward, y up), standing and in the air: 1.5 units
   * out of the drawn launcher's muzzle along the barrel (art/aimedShot.ts).
   */
  muzzle: { x: 6.2, y: 5.75 },
  airMuzzle: { x: 6.2, y: 7.35 },
} as const;

const DEG = Math.PI / 180;
const COS = Math.cos(AIMED_SHOT.elevation * DEG);
const SIN = Math.sin(AIMED_SHOT.elevation * DEG);

/** Fires the ball on frame 16 at the speed the charge gives, carrying the charge level for its damage. */
function fire(x: Ctx): void {
  const { m, f } = x;
  if (f.actionFrame !== AIMED_SHOT.fire) return;
  const speed = chargeLerp(f, AIMED_SHOT.speed, AIMED_SHOT.fullSpeed);
  const at = f.move === 'neutralBAir' ? AIMED_SHOT.airMuzzle : AIMED_SHOT.muzzle;
  spawnEntity(m, {
    kind: `${x.def.id}/aimedShot`,
    owner: f.port,
    pos: { x: f.pos.x + at.x * f.facing, y: f.pos.y + at.y },
    vel: { x: speed * COS * f.facing, y: speed * SIN },
    facing: f.facing,
    move: f.move,
    charge: chargeLevel(f),
  });
}

const shot: Omit<MoveDef, 'faf'> = {
  kind: 'other',
  charge: AIMED_SHOT.charge,
  chargeFrames: AIMED_SHOT.chargeFrames,
  continuesOnLanding: true,
  hits: [],
  script: fire,
};

export const aimedShot: MoveDef = { ...shot, faf: AIMED_SHOT.faf, air: 'neutralBAir' };
export const aimedShotAir: MoveDef = { ...shot, faf: AIMED_SHOT.airFaf };

export const aimedShotEntities: Record<string, EntityDef> = {
  /**
   * The ball. Its hit is Charge Shot's: 5% uncharged on the Sakurai angle, up to 28% at full charge. The engine scales
   * damage only, so the box keeps Charge Shot's full-charge knockback (KBG 50, BKB 46) at every charge; Samus's
   * uncharged shot has KBG 42 and BKB 14. Its 1.9 radius is the uncharged shot's, as a tennis ball does not swell
   * (Samus's grows to 8).
   */
  aimedShot: {
    radius: 1.4,
    lifetime: AIMED_SHOT.lifetime,
    gravity: AIMED_SHOT.gravity,
    chargeDamage: AIMED_SHOT.fullDamage / AIMED_SHOT.damage,
    hits: [
      {
        frames: [1, AIMED_SHOT.lifetime],
        boxes: [{ id: 0, x: 0, y: 0, radius: 1.9, damage: AIMED_SHOT.damage, angle: 361, kbg: 50, bkb: 46 }],
      },
    ],
  },
};
