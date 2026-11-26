import type { Pose } from '../../../render/rig/author';
import type { AnimClip, PropArt } from '../../../render/rig/types';
import { ARSENAL } from '../fullArsenalData';
import { STAND, air, bro, broArms, stand } from './clips';
import { BRO_ARM } from './parts';
import { GRIN, GRIT, HAPPY, SHOUT, aim, aloft, at, fx, key, mix, muzzle, shortTurns } from './poses';
import { rig } from './rig';

/**
 * Full Arsenal (Final Smash), on the move's frames. Through the activation freeze (frames 1-41) the big kid plants his
 * feet and swings the launcher up to lob while his brother climbs onto his shoulders and pulls out his spyglass. On
 * frame 42 the brother has it to his eye, a glint on its lens, and the crosshair appears: the move holds that drawing
 * while it hunts. Then the big kid fires five times, three frames apart (frames 44 to 56), the launcher kicking with
 * each pop, and the brother cheers as they settle. Rig space: y down, feet at the origin, facing right.
 */

const DEG = Math.PI / 180;
const round = (v: number) => Math.round(v * 1000) / 1000;

/** The launcher's lob: 38 degrees up, how far each shot kicks it further up, and where it sits for the lob. */
const LOB = -38;
const KICK = -10;
const GUN: [number, number] = [1.2, 0.9];

/** Where the brother's eye is, in his head's space: the near eye. */
const EYE: [number, number] = [0.72, -1.4];
/** Where his near mitten holds the spyglass, along it from the eyepiece. */
const GRIP = 1.15;

/**
 * The brother up on his brother's shoulders with the spyglass to his eye, looking `look` degrees (negative is up),
 * his far arm pointing out the way he looks; `glint` scales the twinkle on the lens (0: none).
 */
function spotting(pose: Pose, look: number, glint = 0): Pose {
  const [ex, ey] = at(pose, 'broHead', ...EYE);
  const t = look * DEG;
  const hand = [ex + Math.cos(t) * GRIP, ey + Math.sin(t) * GRIP] as const;
  const [sx, sy] = at(pose, 'broArmF');
  const near = Math.atan2(-(hand[0] - sx), hand[1] - sy) / DEG;
  const held = broArms(pose, 250 + look, near);
  // The arm is a little short of the grip at some angles: stretch it to reach, as the kids' arms do.
  const reach = Math.hypot(hand[0] - sx, hand[1] - sy) / BRO_ARM;
  const out = mix(held, {
    broArmF: { ...held.broArmF, sy: round(Math.max(0.8, Math.min(1.35, reach))) },
    fx2: fx(round(ex - Math.cos(t) * 0.15), round(ey - Math.sin(t) * 0.15), 1, look),
  });
  if (!glint) return out;
  const lens = 2.95;
  return mix(out, { fx1: fx(round(ex + Math.cos(t) * lens), round(ey + Math.sin(t) * lens), glint) });
}

type Legs = (extra: Pose, gun: number) => Pose;
const onGround: Legs = (extra, gun) => aim(stand(extra, gun, [2.0, 0], [-1.3, 0]), gun, ...GUN);
const inAir: Legs = (extra, gun) => aloft(aim(air(extra, gun, 0.25), gun, ...GUN));

/** The brother climbing: up `lift` units, leaning `lean`, his head tilted `head`, his arms at `far` and `near`. */
const up = (lift: number, lean: number, head: number, far: number, near: number) =>
  bro(lean, head, far, near, -35, lift);

/** The poses of one version; `legs` stands them on the ground or holds them in the air. */
function poses(legs: Legs) {
  const SWING = legs({ body: { y: 0.6, rot: -6 }, neck: { rot: -6 }, ...up(2.2, -6, -10, -150, -90) }, -20);
  const CLIMB = spotting(
    legs({ body: { y: 0.9, rot: -4 }, neck: { rot: -4 }, ...up(4.6, 10, -6, 0, 0) }, LOB + 8),
    -4,
  );
  const SPOT = (look: number, glint = 0) =>
    spotting(
      legs({ body: { y: 1.0, rot: -3 }, neck: { rot: -8 }, ...up(5.2, 6, -4, 0, 0) }, LOB),
      look,
      glint,
    );
  const LOAD = spotting(
    legs({ body: { y: 1.2, rot: -1 }, neck: { rot: -6 }, ...up(5.2, 6, -4, 0, 0) }, LOB + 6),
    -10,
  );
  const FIRE = spotting(
    legs({ body: { y: 0.9, rot: -7, x: -0.2 }, neck: { rot: -10 }, ...up(5.4, -2, -10, 0, 0) }, LOB + KICK),
    -14,
  );
  const BACK = spotting(
    legs({ body: { y: 1.1, rot: -4 }, neck: { rot: -8 }, ...up(5.2, 4, -6, 0, 0) }, LOB - 2),
    -10,
  );
  const CHEER = legs({ body: { y: 0.4, rot: 2 }, neck: { rot: -4 }, ...up(2.4, -8, -10, -150, -90) }, -24);
  return { SWING, CLIMB, SPOT, LOAD, FIRE, BACK, CHEER };
}

/** Swap sets: a key's swaps replace the last key's, so each lists everything it shows. */
const GLASS = { fx2: 'spyglass', fx1: null, flash: null };
const SPOTTING = { ...GRIT, broFace: 'broFace', ...GLASS };
const GLINTING = { ...SPOTTING, fx1: 'fxPower' };
const FIRING = { ...SHOUT, broFace: 'broShout', ...GLASS, flash: 'fxPop' };
const LOADING = { ...GRIT, broFace: 'broShout', ...GLASS };

function arsenalClip(legs: Legs): AnimClip {
  const P = poses(legs);
  const rest = legs === onGround ? STAND : aloft(air());
  const [first] = ARSENAL.fire;
  const last = ARSENAL.fire.length - 1;
  const shots = ARSENAL.fire.flatMap((f, i) => [
    key(f, P.FIRE, { ease: 'out', swaps: FIRING }),
    key(f + 2, i === last ? P.BACK : P.LOAD, { ease: 'inOut', swaps: LOADING }),
  ]);
  return {
    length: ARSENAL.faf - 1,
    // The impact window is the first shot, as on the kids' other shots.
    active: [[first, first]],
    keys: shortTurns([
      key(0, rest, { ease: 'out', swaps: GRIN }),
      key(6, P.SWING, { ease: 'inOut', swaps: { ...SHOUT, broFace: 'broUp' } }),
      key(16, P.CLIMB, { ease: 'inOut', swaps: { ...SHOUT, broFace: 'broUp', ...GLASS } }),
      key(26, P.SPOT(-2), { ease: 'inOut', swaps: SPOTTING }),
      key(34, P.SPOT(-12), { ease: 'inOut', swaps: SPOTTING }),
      key(ARSENAL.reticle, P.SPOT(-8, 0.8), { ease: 'in', swaps: GLINTING }),
      key(ARSENAL.hold, P.LOAD, { ease: 'in', swaps: LOADING }),
      ...shots,
      key(62, P.CHEER, { ease: 'inOut', swaps: HAPPY }),
      key(ARSENAL.faf - 1, rest, { swaps: GRIN }),
    ]),
  };
}

export const fullArsenalClips: Record<string, AnimClip> = {
  finalSmash: arsenalClip(onGround),
  finalSmashAir: arsenalClip(inAir),
};

/** The muzzle on the first shot's frame, from the feet (x forward, y up), standing or in the air. */
export function shotMuzzle(legs: 'ground' | 'air'): [number, number] {
  const [x, y] = muzzle(poses(legs === 'ground' ? onGround : inAir).FIRE);
  return [x, -y];
}

/** The kids' Final Smash props: drawn over the fighters, at world scale. */
const prop = (symbol: string, scale: number, align = false): PropArt => ({
  symbols: rig.symbols,
  symbol,
  scale,
  ...(align && { align }),
});

/** Where the lab shows a shot: leaving the muzzle on its frame, lobbed up at the launcher's angle. */
const lob = (frame: number, speed: number) => ({
  frame,
  x: ARSENAL.muzzle.x,
  y: ARSENAL.muzzle.y,
  vx: round(Math.cos(LOB * DEG) * speed),
  vy: round(-Math.sin(LOB * DEG) * speed),
  to: frame + 8,
});

/** The marks' drawings by their rank on one foe (arsenalParts.ts): rings for the first three, a diamond for each. */
export const LOCK_STACK = ['fxLock1', 'fxLock2', 'fxLock3', 'fxLock4', 'fxLock5'];

export const fullArsenalProps: Record<string, PropArt> = {
  /** The crosshair, spinning; the lab shows it where it appears, ahead of the kids. */
  reticle: {
    ...prop('fxReticle', 1),
    preview: { finalSmash: { frame: ARSENAL.reticle, x: ARSENAL.start.x, y: ARSENAL.start.y } },
  },
  /**
   * A mark on a locked foe, squeezing in and out. Every mark on one foe sits on the same spot, so each draws by its
   * rank there (PropArt.stack): the first three a ring, each larger than the last, and every one a diamond above the
   * foe's head. Two shots coming show two rings and two diamonds, five show three rings and five diamonds, and one goes
   * as each shot lands. Drawn above the bursts (PropArt.above), so the count shows while they burn.
   */
  lockMark: { ...prop(LOCK_STACK[0]!, 1), stack: LOCK_STACK, above: true },
  /** The shots, turned along their flight. */
  volleyBall: { ...prop('shotBall', 1.5, true), preview: { finalSmash: lob(ARSENAL.fire[0], 2.4) } },
  volleyGrenade: { ...prop('volleyGrenade', 1.8), preview: { finalSmash: lob(ARSENAL.fire[1], 2.4) } },
  volleyRocket: { ...prop('volleyRocket', 1, true), preview: { finalSmash: lob(ARSENAL.fire[2], 2.4) } },
  /** The burst where a shot comes down, drawn at its hit's radius (arsenalParts.ts). */
  volleyBlast: prop('fxBlast', 1),
};
