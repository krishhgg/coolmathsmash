import { Btn } from '../../input/types';
import { holdFrame } from '../../sim/actions/registry';
import { isHeld } from '../../sim/control';
import { spawnFromMove } from '../../sim/entities/entities';
import type { Ctx } from '../../sim/fighter';
import type { MoveDef } from '../types';
import { PUMP } from './entities';

/**
 * Water Stream (neutral special) is Mario's F.L.U.D.D. in Ultimate, from SmashWiki's Mario (SSBU)/Down special
 * tables and parameters. It charges on frame 19, for up to 80 frames. Pumps come out 2 frames after release, 7 of
 * them 5 frames apart, aimed 12 degrees up at 4.3 units a frame plus up to 4.3 more with charge. In the air the
 * release pushes her back 0.02 units a frame per charge frame. She can act 49 frames after release, or 68 past
 * 70 charge frames, where F.L.U.D.D. switches to its heavier shoot animation.
 *
 * In Ultimate the charge runs on its own and shield stores it. This game has no stored charge for specials
 * yet, so she charges while Special is held, as with a smash attack, and lets go at full charge.
 */
export const STREAM = {
  chargeFrame: 19,
  fullCharge: 80,
  heavyFrom: 70,
  firstPump: 2,
  pumps: 7,
  pumpEvery: 5,
  angle: 12,
  speed: 4.3,
  extraSpeed: 4.3,
  recoil: 0.02,
  /** Where pumps appear, at her hands: low enough to catch short and crouching fighters. */
  nozzle: { x: 6, y: 5 },
  /** First actionable frame after release: light and heavy shoot animations. */
  light: 49,
  heavy: 68,
};

/** The pump kind for `charge` frames of charge: one tier per eighth of a full charge (10 frames). */
export function pumpTier(charge: number): string {
  return `pump${Math.floor((Math.min(charge, STREAM.fullCharge) * PUMP.tiers) / STREAM.fullCharge)}`;
}

const HEAVY = 'neutralBHeavy';

function script(x: Ctx): void {
  const { f, c } = x;
  const at = f.actionFrame;
  if (at === STREAM.chargeFrame && f.charge < STREAM.fullCharge && isHeld(c, Btn.Special)) {
    f.charge++;
    holdFrame(x);
    // Same frames so far; only the recovery after release is longer.
    if (f.charge >= STREAM.heavyFrom) f.move = HEAVY;
    return;
  }
  if (at === STREAM.chargeFrame && !f.ground) f.vel.x -= f.facing * STREAM.recoil * f.charge;
  const n = (at - STREAM.chargeFrame - STREAM.firstPump) / STREAM.pumpEvery;
  if (!Number.isInteger(n) || n < 0 || n >= STREAM.pumps) return;
  const speed =
    STREAM.speed + (STREAM.extraSpeed * Math.min(f.charge, STREAM.fullCharge)) / STREAM.fullCharge;
  const theta = (STREAM.angle * Math.PI) / 180;
  spawnFromMove(x, {
    frame: at,
    entity: pumpTier(f.charge),
    ...STREAM.nozzle,
    vx: speed * Math.cos(theta),
    vy: speed * Math.sin(theta),
  });
}

const stream = (recovery: number): MoveDef => ({
  kind: 'other',
  faf: STREAM.chargeFrame + recovery,
  hits: [],
  continuesOnLanding: true,
  script,
});

/** Water Stream and its heavier shoot, which the charge switches to past 70 frames. */
export const waterStream: Record<string, MoveDef> = {
  neutralB: stream(STREAM.light),
  [HEAVY]: stream(STREAM.heavy),
};
