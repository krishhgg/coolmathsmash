import type { Pose } from '../../../render/rig/author';
import type { AnimClip, PropArt } from '../../../render/rig/types';
import { AIMED_SHOT } from '../aimedShot';
import { BRO_CHEER, STAND, air, bro, stand } from './clips';
import { GRIN, GRIT, HAPPY, SHOUT, aim, aloft, fx, key, mix, muzzle, shortTurns, type Pt } from './poses';
import { rig } from './rig';

/**
 * Aimed Shot (neutral special), on the move's frames: the big kid hoists the launcher to his shoulder and pumps it
 * while his brother looks up at it (frames 1-9), then squats behind it aimed 10 degrees up, the charge twinkling at
 * the muzzle and his brother covering his ears (frame 12, held while Special is held). Three frames after the release
 * the ball leaves in a puff (frame 16), the launcher kicks up and the brother is thrown back, then cheers as they
 * settle. Rig space: y down, feet at the origin, facing right.
 */

/** The launcher's angle on the shot: the ball's elevation (negative is up in rig space). */
const AIM = -AIMED_SHOT.elevation;

/** A pose on the ground (feet planted at `back` and `front`) or in the air, the launcher at `gun` degrees. */
type Legs = (extra: Pose, gun: number, dx?: number, dy?: number, back?: Pt, front?: Pt) => Pose;

const onGround: Legs = (extra, gun, dx = 0, dy = 0, back = [1.3, 0], front = [-0.6, 0]) =>
  aim(stand(extra, gun, back, front), gun, dx, dy);
/** In the air the drawing is lifted clear of the floor, legs tucked a little more as they brace. */
const inAir: Legs = (extra, gun, dx = 0, dy = 0) => aloft(aim(air(extra, gun, 0.2), gun, dx, dy));

/** The brother peering up at the launcher as it goes up. */
const BRO_PEEK = bro(-6, -14, -40, -10, -20, 0.3);
/** The brother hunched behind his brother's head with his hands over his ears for the bang. */
const BRO_EARS = bro(16, 12, -150, -150, 14);
/** The brother thrown back by the kick. */
const BRO_KICKED = bro(-20, -16, -160, -120, -40, 0.15);

/** The big kid's body through the move; `legs` puts it on the ground or in the air. */
function poses(legs: Legs) {
  const HOIST = legs(
    { body: { y: 0.35, rot: -5 }, neck: { rot: -4 }, ...BRO_PEEK },
    -32,
    -0.7,
    -0.4,
    [1.5, 0],
    [-1.0, 0],
  );
  const PUMP = legs(
    { body: { y: 0.6, rot: -3 }, neck: { rot: 2 }, ...BRO_EARS },
    -20,
    -1.2,
    -0.1,
    [1.8, 0],
    [-1.2, 0],
  );
  const HOLD = legs(
    { body: { y: 0.9, rot: -2 }, neck: { rot: 5 }, ...BRO_EARS },
    AIM,
    0.25,
    0,
    [2.0, 0],
    [-1.4, 0],
  );
  const SQUEEZE = legs(
    { body: { y: 1.05, rot: -1 }, neck: { rot: 6 }, ...BRO_EARS },
    AIM,
    0.35,
    0,
    [2.0, 0],
    [-1.4, 0],
  );
  const KICK = legs(
    { body: { y: 0.7, rot: -10, x: -0.3 }, neck: { rot: -8 }, hat: { rot: -8, y: -0.25 }, ...BRO_KICKED },
    -40,
    -0.6,
    -0.2,
    [2.0, 0],
    [-1.4, 0],
  );
  const SETTLE = legs(
    { body: { y: 0.3, rot: 2 }, neck: { rot: -2 }, ...BRO_CHEER },
    -16,
    0,
    0,
    [1.6, 0],
    [-0.9, 0],
  );
  return { HOIST, PUMP, HOLD, SQUEEZE, KICK, SETTLE };
}

/** An effect centred `ahead` units past the muzzle of `pose`, along the barrel. */
function atMuzzle(pose: Pose, ahead: number, s: number, gun: number): Pose {
  const [mx, my] = muzzle(pose);
  const t = (gun * Math.PI) / 180;
  return mix(pose, { fx1: fx(mx + Math.cos(t) * ahead, my + Math.sin(t) * ahead, s, gun) });
}

/** Big kid gritting his teeth, his brother scared of the bang. */
const BRACE = { face: 'faceGrit', broFace: 'broScared' };

function shotClip(legs: Legs, faf: number): AnimClip {
  const P = poses(legs);
  const rest = legs === onGround ? STAND : aloft(air());
  return {
    length: faf - 1,
    // The impact window is the frame the ball leaves, as on the kids' other shots (attacks.ts).
    active: [[AIMED_SHOT.fire, AIMED_SHOT.fire]],
    keys: shortTurns([
      key(0, rest, { ease: 'out', swaps: GRIN }),
      key(5, P.HOIST, { ease: 'inOut', swaps: { ...GRIN, broFace: 'broUp' } }),
      key(9, P.PUMP, { ease: 'out', swaps: GRIT }),
      key(12, atMuzzle(P.HOLD, 1.3, 1, AIM), { ease: 'in', swaps: { ...BRACE, fx1: 'fxPower' } }),
      key(15, atMuzzle(P.SQUEEZE, 1.3, 1.2, AIM), { ease: 'linear' }),
      key(16, atMuzzle(P.SQUEEZE, 0.2, 1.5, AIM), { ease: 'out', swaps: { ...SHOUT, fx1: 'fxPuff' } }),
      key(19, atMuzzle(P.KICK, 2.6, 1.5, -40), { ease: 'inOut' }),
      key(24, atMuzzle(P.KICK, 3.6, 0.4, -40), { ease: 'inOut', swaps: { ...HAPPY, fx1: null } }),
      key(30, P.SETTLE, { ease: 'inOut' }),
      key(faf - 1, rest, { swaps: GRIN }),
    ]),
  };
}

export const aimedShotClips: Record<string, AnimClip> = {
  neutralB: shotClip(onGround, AIMED_SHOT.faf),
  neutralBAir: shotClip(inAir, AIMED_SHOT.airFaf),
};

/** The muzzle on the firing frame, from the feet (x forward, y up): where the ball appears. */
export function firingMuzzle(legs: 'ground' | 'air'): [number, number] {
  const [x, y] = muzzle(poses(legs === 'ground' ? onGround : inAir).SQUEEZE);
  return [x, -y];
}

const DEG = Math.PI / 180;
const preview = (at: { x: number; y: number }) => ({
  frame: AIMED_SHOT.fire,
  x: at.x,
  y: at.y,
  vx: AIMED_SHOT.speed * Math.cos(AIMED_SHOT.elevation * DEG),
  vy: AIMED_SHOT.speed * Math.sin(AIMED_SHOT.elevation * DEG),
});

/** The ball in flight, spinning, with its speed lines (the lab previews an uncharged shot). */
export const aimedShotProp: PropArt = {
  symbols: rig.symbols,
  symbol: 'shotBall',
  scale: 1,
  preview: { neutralB: preview(AIMED_SHOT.muzzle), neutralBAir: preview(AIMED_SHOT.airMuzzle) },
};
