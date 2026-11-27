import { pointOf, type Pose } from '../../../render/rig/author';
import type { AnimClip, BonePose } from '../../../render/rig/types';
import { MUZZLE, MUZZLE_LEAD } from '../entities';
import { AIR_GUARD } from './attacks';
import { GUN_MUZZLE, UPPER_ARM } from './parts';
import {
  FIST_B,
  GRIT,
  GUARD,
  SMIRK,
  STANCE,
  aloft,
  between,
  elbows,
  feet,
  fist,
  key,
  mix,
  onFloor,
  shortTurns,
  type Pt,
} from './poses';
import { HAND, rig } from './rig';

/**
 * Laser Gun's clips, keyed frame for frame on the move (src/fighters/johnny/moves.ts: Falco's Blaster). Grounded:
 * the gun comes up on frames 1-3, the laser leaves on frame 8 with a muzzle flash and a kick of recoil, and frames
 * 3-28 are one shot, so the repeat (frame 29 back to 3) loops the aim seamlessly; from 29 he lowers the gun and
 * holsters it by frame 37. In the air the same shot plays three frames sooner (laser on 7, loop 26 back to 3).
 */

const DEG = 180 / Math.PI;
const ARM_F_REST = rig.bones.find((b) => b.name === 'armF')!.rot ?? 0;

/** The muzzle tip in rig space when he fires, standing and in the air: `MUZZLE_LEAD` behind the laser's spawn. */
export const MUZZLE_TIP: Pt = [MUZZLE.x - MUZZLE_LEAD, -MUZZLE.y];
export const AIR_MUZZLE_TIP: Pt = [MUZZLE.x - MUZZLE_LEAD, -MUZZLE.airY];

/** World rotation of `bone` in `pose`, degrees. */
function rotOf(pose: Pose, bone: string): number {
  const [x0, y0] = pointOf(rig, pose, bone);
  const [x1, y1] = pointOf(rig, pose, bone, 1, 0);
  return Math.atan2(y1 - y0, x1 - x0) * DEG;
}

/**
 * The near arm holding the gun in a fist on `hand` (rig space), the barrel tilted `tilt` degrees (negative: up).
 * The forearm lines up with the barrel; the upper arm turns to the elbow and stretches to meet it, Flash
 * rubber-hose style.
 */
export function hold(pose: Pose, hand: Pt, tilt: number): Pose {
  const t = tilt / DEG;
  const [dx, dy] = [Math.cos(t), Math.sin(t)];
  const [sx, sy] = pointOf(rig, pose, 'armF');
  const [ux, uy] = [hand[0] - HAND * dx - sx, hand[1] - HAND * dy - sy];
  const upper = Math.atan2(-ux, uy) * DEG;
  return mix(pose, {
    armF: { rot: upper - rotOf(pose, 'torso') - ARM_F_REST, sy: Math.hypot(ux, uy) / UPPER_ARM },
    foreF: { rot: Math.atan2(-dx, dy) * DEG - upper },
  });
}

/** `hold` with the gun's muzzle tip on `muzzle`. */
export function aim(pose: Pose, muzzle: Pt, tilt = 0): Pose {
  const t = tilt / DEG;
  const [dx, dy] = [Math.cos(t), Math.sin(t)];
  const [gx, gy] = GUN_MUZZLE;
  return hold(pose, [muzzle[0] - (gx * dx - gy * dy), muzzle[1] - (gx * dy + gy * dx)], tilt);
}

/** The gun in the near fist. */
const GUN = { foreF: 'gun', foreFLine: 'gunLine' };
const SWAPS = { ...SMIRK, ...GUN, ...FIST_B };
const FLASH = { ...SWAPS, ...GRIT, fx1: 'muzzleFlash' };

/** Muzzle flash on the muzzle tip, `r` long. */
const flash = (r: number, [x, y]: Pt = MUZZLE_TIP): BonePose => ({ x, y, sx: r, sy: r * 0.9 });

// --- Grounded: square to the target, near shoulder turned in, far fist at the belt. -----------------------
const BASE = fist(
  feet({ hip: { y: 0.35 }, body: { rot: 4, x: 0.3 }, armF: { x: 0.85 } }, [3.4, 0], [-2.4, 0]),
  'B',
  [3.6, -6.6],
);
const AIM = aim(BASE, MUZZLE_TIP);
/** A third of the way from his guard to the aim on the first frame: the gun comes up and levels out by frame 3. */
const DRAW = between(STANCE, AIM, 0.35);
const FIRE = mix(AIM, { fx1: flash(1.3) });
const KICK = mix(aim(mix(BASE, { body: { rot: 1 } }), [MUZZLE_TIP[0] - 0.6, MUZZLE_TIP[1] - 0.7], -14), {
  fx1: flash(1.6, [MUZZLE_TIP[0] - 0.4, MUZZLE_TIP[1] - 1.2]),
});
const RECOIL = aim(mix(BASE, { body: { rot: 2 } }), [MUZZLE_TIP[0] - 0.5, MUZZLE_TIP[1] - 0.5], -10);
const LOWER = hold(mix(BASE, { body: { rot: 1 } }), [0.95, -5.4], 45);

// --- In the air: legs loose and lifted clear of the floor he may land on, so the aim rides higher. -------------
const AIR_READY = aloft(AIR_GUARD);
const AIR_BASE = aloft(fist(mix(AIR_GUARD, { body: { rot: 4 }, armF: { x: 1.3 } }), 'B', [3.6, -7.4]));
const AIR_AIM = aim(AIR_BASE, AIR_MUZZLE_TIP);
const AIR_DRAW = between(AIR_READY, AIR_AIM, 0.35);
const AIR_FIRE = mix(AIR_AIM, { fx1: flash(1.3, AIR_MUZZLE_TIP) });
const AIR_KICK = mix(
  aim(
    mix(AIR_BASE, { body: { rot: 3 }, armF: { y: 0.6 } }),
    [AIR_MUZZLE_TIP[0] - 0.6, AIR_MUZZLE_TIP[1] - 0.7],
    -14,
  ),
  { fx1: flash(1.6, [AIR_MUZZLE_TIP[0] - 0.4, AIR_MUZZLE_TIP[1] - 1.2]) },
);
const AIR_RECOIL = aim(
  mix(AIR_BASE, { body: { rot: 1 }, armF: { y: 0.3 } }),
  [AIR_MUZZLE_TIP[0] - 0.5, AIR_MUZZLE_TIP[1] - 0.5],
  -10,
);
const AIR_LOWER = hold(AIR_BASE, [1.2, -7.2], 45);

/** One shot: aim on 3, fire on `shot`, kick, settle back on the aim by `shot + 8` and hold it to `loop - 1`. */
function shotKeys(shot: number, loop: number, poses: Record<'aim' | 'fire' | 'kick' | 'recoil', Pose>) {
  return [
    key(3, poses.aim, { ease: 'linear' }),
    key(shot - 1, poses.aim, { ease: 'linear' }),
    key(shot, poses.fire, { ease: 'linear', swaps: FLASH }),
    key(shot + 1, poses.kick, { ease: 'out' }),
    key(shot + 2, poses.recoil, { ease: 'inOut', swaps: {} }),
    key(shot + 8, poses.aim, { ease: 'linear' }),
    key(loop - 1, poses.aim, { ease: 'inOut' }),
  ];
}

const clips: Record<string, AnimClip> = {
  neutralB: {
    length: 41,
    active: [[8, 8]],
    swaps: SWAPS,
    keys: [
      key(0, STANCE, { ease: 'out' }),
      key(1, DRAW, { ease: 'out' }),
      ...shotKeys(8, 29, { aim: AIM, fire: FIRE, kick: KICK, recoil: RECOIL }),
      key(34, LOWER, { ease: 'in' }),
      key(37, mix(LOWER, { body: { rot: 0 } }), { ease: 'inOut', swaps: { ...GRIT, ...GUARD } }),
      key(41, STANCE),
    ],
  },
  neutralBAir: {
    length: 38,
    active: [[7, 7]],
    swaps: SWAPS,
    keys: [
      key(0, AIR_READY, { ease: 'out' }),
      key(1, AIR_DRAW, { ease: 'linear' }),
      ...shotKeys(7, 26, { aim: AIR_AIM, fire: AIR_FIRE, kick: AIR_KICK, recoil: AIR_RECOIL }),
      key(31, AIR_LOWER, { ease: 'in' }),
      key(34, AIR_LOWER, {
        ease: 'linear',
        swaps: { ...GRIT, ...FIST_B, foreF: 'fist', foreFLine: 'fistLine' },
      }),
      key(38, AIR_READY),
    ],
  },
};

// --- Upgraded Laser (src/fighters/johnny/upgrade.ts): the shot 2 frames sooner, a bigger flash with a burst, a
// harder kick that rocks him back, and 7 more frames before he holsters.

/** The upgraded shot's flash: the muzzle flash twice as big, and an impact burst on fx2 round the muzzle. */
const bigFlash = (pt: Pt): Pose => ({
  fx1: flash(2.6, pt),
  fx2: { x: pt[0] + 0.6, y: pt[1], sx: 1.5, sy: 1.5 },
});
const BIG_FLASH = { ...SWAPS, ...GRIT, fx1: 'muzzleFlash', fx2: 'impact' };

function bigKick(base: Pose, tip: Pt): Pose {
  return mix(aim(mix(base, { body: { rot: -2 } }), [tip[0] - 1.3, tip[1] - 1.4], -24), {
    fx1: flash(3.0, [tip[0] - 0.9, tip[1] - 2.0]),
  });
}
const bigRecoil = (base: Pose, tip: Pt): Pose =>
  aim(mix(base, { body: { rot: -1 } }), [tip[0] - 1.0, tip[1] - 0.9], -16);

/** One upgraded shot: aim on 3, fire on `shot`, kick, settle back on the aim by `settle` and hold it to `hold`. */
function bigShotKeys(shot: number, settle: number, holdTo: number, base: Pose, tip: Pt, aimed: Pose) {
  return [
    key(3, aimed, { ease: 'linear' }),
    key(shot - 1, aimed, { ease: 'linear' }),
    key(shot, mix(aimed, bigFlash(tip)), { ease: 'linear', swaps: BIG_FLASH }),
    key(shot + 1, bigKick(base, tip), { ease: 'out', swaps: { ...SWAPS, ...GRIT, fx1: 'muzzleFlash' } }),
    key(shot + 2, undefined, { swaps: {} }),
    key(shot + 3, bigRecoil(base, tip), { ease: 'inOut' }),
    key(settle, aimed, { ease: 'linear' }),
    key(holdTo, aimed, { ease: 'inOut' }),
  ];
}

clips.neutralBUpgraded = {
  length: 48,
  active: [[6, 6]],
  swaps: SWAPS,
  keys: [
    key(0, STANCE, { ease: 'out' }),
    key(1, DRAW, { ease: 'out' }),
    ...bigShotKeys(6, 18, 33, BASE, MUZZLE_TIP, AIM),
    key(41, LOWER, { ease: 'in' }),
    key(44, mix(LOWER, { body: { rot: 0 } }), { ease: 'inOut', swaps: { ...GRIT, ...GUARD } }),
    key(48, STANCE),
  ],
};
clips.neutralBUpgradedAir = {
  length: 45,
  active: [[5, 5]],
  swaps: SWAPS,
  keys: [
    key(0, AIR_READY, { ease: 'out' }),
    key(1, AIR_DRAW, { ease: 'linear' }),
    ...bigShotKeys(5, 17, 30, AIR_BASE, AIR_MUZZLE_TIP, AIR_AIM),
    key(38, AIR_LOWER, { ease: 'in' }),
    key(41, AIR_LOWER, {
      ease: 'linear',
      swaps: { ...GRIT, ...FIST_B, foreF: 'fist', foreFLine: 'fistLine' },
    }),
    key(45, AIR_READY),
  ],
};

/**
 * The far arm keeps its elbow on its side and every part turns the short way; the grounded shots are keyed on every
 * frame, lifted where the kick would dip a boot into the floor.
 */
export const laser: Record<string, AnimClip> = Object.fromEntries(
  Object.entries(clips).map(([name, clip]) => {
    const short = { ...clip, keys: shortTurns(elbows(clip.keys, ['B'])) };
    return [name, /Air$/.test(name) ? short : onFloor(short, false)];
  }),
);
