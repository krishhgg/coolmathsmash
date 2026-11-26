import { pointOf, type Pose } from '../../../render/rig/author';
import type { AnimClip } from '../../../render/rig/types';
import { MUZZLE, STUN_GUN } from '../entities';
import { FORE_ARM, TASER_TIP, UPPER_ARM } from './parts';
import {
  AIR,
  ANGRY,
  FRONT_ARM_OVER_HEAD,
  GRIN,
  READY,
  SHOUT,
  SIDE,
  aim,
  feet,
  floor,
  fx,
  hands,
  key,
  mix,
  worldRot,
  type Pt,
} from './poses';
import { rig } from './rig';

/**
 * Stun Gun's clips, frame for frame on the move (src/fighters/bob-the-robber/stunGun.ts, Zero Suit Samus's
 * Paralyzer). He pulls the taser from his belt on frames 1-4, raises it and aims by 14, crackling at the prongs
 * while it charges (the move holds frame 19 to 20 then, and the crackle is a loop on the match clock), and fires on
 * frame 21 with a flash and a kick of recoil. From 30 he lowers it and puts it away by 43.
 */

const DEG = 180 / Math.PI;
const ARM_F_REST = rig.bones.find((b) => b.name === 'armF')!.rot ?? 0;
/** The gun bone sits this far along the hand from the wrist (rig.ts). */
const GRIP = 0.5;

/** The shot's centre is this far ahead of the prong tips on the frame it appears. */
export const MUZZLE_LEAD = 1.0;
/** The prong tips in rig space when he fires: `MUZZLE_LEAD` behind the shot. */
export const PRONGS: Pt = [MUZZLE.x - MUZZLE_LEAD, -MUZZLE.y];

/**
 * The front arm holding the taser with its prong tips on `tip` (rig space), the barrel at `deg` (0 forward,
 * negative up). The forearm lines up with the barrel; the upper arm turns to the elbow and stretches to meet it,
 * rubber-hose style.
 */
export function holdTaser(pose: Pose, tip: Pt, deg: number): Pose {
  const [dx, dy] = [Math.cos(deg / DEG), Math.sin(deg / DEG)];
  const [px, py] = TASER_TIP;
  const grip: Pt = [tip[0] - (px * dx - py * dy), tip[1] - (px * dy + py * dx)];
  const elbow: Pt = [grip[0] - (GRIP + FORE_ARM) * dx, grip[1] - (GRIP + FORE_ARM) * dy];
  const [sx, sy] = pointOf(rig, pose, 'armF');
  const [ux, uy] = [elbow[0] - sx, elbow[1] - sy];
  const upper = Math.atan2(-ux, uy) * DEG;
  const held = mix(pose, {
    armF: { rot: upper - worldRot(pose, 'torso') - ARM_F_REST, sy: Math.hypot(ux, uy) / UPPER_ARM },
    foreF: { rot: Math.atan2(-dx, dy) * DEG - upper },
  });
  return aim(held, 'gun', deg);
}

/** Rig point of the prong tips in `pose`. */
export const prongsOf = (pose: Pose): Pt => pointOf(rig, pose, 'gun', TASER_TIP[0], TASER_TIP[1]);

/** An effect on the `fx1` bone at the prongs, turned with the barrel. */
const atProngs = (pose: Pose, deg: number, scale = 1): Pose => {
  const [x, y] = prongsOf(pose);
  return mix(pose, { fx1: fx(x, y, deg, scale) });
};

const TASER = { gun: 'taser', handF: 'fist' };

/** Side-on, weight on the back foot, the back fist tucked at his ribs. */
const GROUND = (lean = 0, x = 0): Pose =>
  hands(
    feet({ body: { rot: 2 + lean, x }, hip: { y: 0.35 }, neck: { rot: -3 - lean } }, floor(-2.2), floor(1.7)),
    [-0.7, -4.6],
    null,
  );

/** Airborne: knees drawn up, the back fist tucked in. */
const AIRBORNE = (lean = 0, x = 0): Pose =>
  hands(
    mix(AIR, {
      body: { rot: 2 + lean, x },
      neck: { rot: -3 - lean },
      thighF: { rot: -55 },
      shinF: { rot: 80 },
      thighB: { rot: -15 },
      shinB: { rot: 60 },
    }),
    [-0.7, -4.6],
    null,
  );

function clip(base: (lean?: number, x?: number) => Pose, settle: Pose): AnimClip {
  const draw = holdTaser(base(), [3.1, -2.6], 75);
  const raise = holdTaser(base(1), [PRONGS[0] - 1.2, PRONGS[1] + 0.6], 15);
  const aimed = holdTaser(base(3), PRONGS, 0);
  const recoil = holdTaser(base(-3, -0.3), [PRONGS[0] - 0.6, PRONGS[1] - 0.9], -16);
  const lower = holdTaser(base(1), [4.4, -3.4], 55);
  return {
    length: STUN_GUN.faf - 1,
    active: [[STUN_GUN.shot, STUN_GUN.shot]],
    swaps: { ...ANGRY },
    keys: [
      key(0, settle, { ease: 'out' }),
      key(4, draw, { ease: 'inOut', swaps: { ...ANGRY, ...TASER } }),
      key(10, raise, { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
      key(14, atProngs(aimed, 0, 1.1), { ease: 'inOut', swaps: { ...ANGRY, ...TASER, fx1: 'zapCrackle' } }),
      key(STUN_GUN.charge, atProngs(aimed, 0, 1.4), { ease: 'linear' }),
      key(STUN_GUN.shot, atProngs(recoil, -16, 1.1), {
        ease: 'out',
        swaps: { ...SHOUT, ...TASER, fx1: 'zapFlash' },
      }),
      key(23, atProngs(recoil, -16, 0.7), { ease: 'inOut', swaps: { ...SHOUT, ...TASER, fx1: null } }),
      key(30, holdTaser(base(2), [PRONGS[0] - 0.3, PRONGS[1]], -2), {
        ease: 'inOut',
        swaps: { ...GRIN, ...TASER },
      }),
      key(38, lower, { ease: 'in', z: {} }),
      key(43, holdTaser(base(), [3.0, -2.7], 80), {
        ease: 'out',
        swaps: { ...GRIN, gun: null, handF: 'fist' },
      }),
      key(STUN_GUN.faf - 1, settle, { swaps: SIDE }),
    ],
  };
}

const AIR_SETTLE = mix(AIR, { body: { rot: 0 } });

export const stunGunClips: Record<string, AnimClip> = {
  neutralB: clip(GROUND, READY),
  neutralBAir: clip(AIRBORNE, AIR_SETTLE),
};
