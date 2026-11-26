import { art as fireboy } from '../../fireboy/art';
import { JET_TIP } from '../../fireboy/art/parts';
import {
  AIR,
  ANGRY,
  BALL,
  CROUCH,
  FRONT_ARM_IN_FRONT,
  NO_BODY,
  STAND,
  UP,
  ball,
  feet,
  flame,
  hands,
  key,
  mix,
} from '../../fireboy/art/poses';
import { HAND, rig } from '../../fireboy/art/rig';
import { pointOf, type Pose } from '../../../render/rig/author';
import type { AnimClip, BonePose, Key } from '../../../render/rig/types';
import { STREAM } from '../waterStream';

type Pt = readonly [number, number];

/** True for a clip's strike keys: from the frame before its first active window to that window's end. */
function striking(clip: AnimClip, k: Key): boolean {
  const [from, until] = clip.active![0]!;
  return k.frame >= from - 1 && k.frame <= until;
}

/** Applies `f` to effect bone `bone` on the strike keys of `clip` that pose it. */
function onStrike(clip: AnimClip, bone: string, f: (b: BonePose) => BonePose): AnimClip {
  return {
    ...clip,
    keys: clip.keys.map((k) => {
      const b = k.pose?.[bone];
      return b && striking(clip, k) ? { ...k, pose: { ...k.pose, [bone]: f(b) } } : k;
    }),
  };
}

/**
 * Re-aims a jet so its head sits on rig point `to` while its tail stays on the limb that threw it: her longer
 * reach comes out of the same swing as Fireboy's. `r` resizes the jet's head (radius in rig units).
 */
const reaim = (clip: AnimClip, bone: string, [tx, ty]: Pt, r?: number) =>
  onStrike(clip, bone, (jet) => {
    const back = (((jet.rot ?? 0) - 90) * Math.PI) / 180;
    const len = (jet.sy ?? 1) * JET_TIP;
    const x = (jet.x ?? 0) + Math.cos(back) * len;
    const y = (jet.y ?? 0) + Math.sin(back) * len;
    const rot = (Math.atan2(y - ty, x - tx) * 180) / Math.PI + 90;
    const sx = r === undefined ? jet.sx : r / BALL;
    return { ...jet, x: tx, y: ty, rot, sx, sy: Math.hypot(x - tx, y - ty) / JET_TIP };
  });

/** Carries an effect `(dx, dy)` further out on the strike keys. */
const nudge = (clip: AnimClip, bone: string, dx: number, dy: number) =>
  onStrike(clip, bone, (b) => ({ ...b, x: (b.x ?? 0) + dx, y: (b.y ?? 0) + dy }));

/** Curled into a ball on top of the water column (Fireboy's Flame Jump body, riding water instead). */
const RIDE = { body: { y: 1.46 }, head: { sx: 0.92, sy: 1.1 }, fx4: flame(0, -1.6, 2.6, 90, 1.5) };

/**
 * Geyser (up special): she crouches, and a water column bursts up under her on frame 3 with a splash thrown out
 * in front; she rides it curled up through the multihits and the final burst, then opens out into the fall.
 */
const upB: AnimClip = {
  active: [
    [3, 6],
    [7, 9],
    [10, 12],
    [13, 16],
    [17, 18],
  ],
  length: 37,
  swaps: ANGRY,
  keys: [
    key(0, STAND, { ease: 'out' }),
    key(2, mix(CROUCH, { fx4: flame(0, -1, 1.2, 90) }), { ease: 'in', swaps: { fxBack: 'fxJet' } }),
    key(3, mix(RIDE, { fx1: ball(6.5, -7, 2.6, -20) }), {
      ease: 'linear',
      swaps: { ...NO_BODY, ...UP, fxBack: 'fxJet', fx1: 'fxBall' },
    }),
    key(6, mix(RIDE, { fx1: ball(7.2, -8, 2.2, -30) }), { ease: 'linear' }),
    key(7, RIDE, { ease: 'linear', swaps: { ...NO_BODY, ...UP, fxBack: 'fxJet', fx1: null } }),
    key(16, mix(RIDE, { fx4: flame(0, -1.6, 2.4, 90, 1.6) }), { ease: 'out' }),
    key(17, mix(RIDE, { head: { sx: 0.88, sy: 1.14 }, fx4: flame(0, -1.6, 3, 90, 1.7) }), { ease: 'out' }),
    key(24, mix(RIDE, { fx4: flame(0, -1.2, 0.8, 90) }), { ease: 'inOut' }),
    key(28, mix(AIR, { armF: { rot: -70 }, armB: { rot: 70 } }), {
      swaps: { head: 'headFront', face: 'faceFrontBlink' },
    }),
    key(37, AIR),
  ],
};

/** Feet apart and leaning back by `rot` against the stream, both hands together at `front` like on a nozzle. */
const brace = (rot: number, drop: number, front: Pt): Pose =>
  hands(
    feet(
      mix({ body: { rot }, hip: { y: drop } }, { armF: { sy: 1.3 }, foreF: { sy: 1.3 } }),
      [-1.0, 0],
      [0.9, 0],
      true,
    ),
    [front[0] - 0.5, front[1] + 0.3],
    front,
    -1,
  );

const PUMP_UP = brace(-6, 0.45, [1.4, -3.3]);
const CHARGED = brace(-10, 0.6, [1.0, -3.1]);
const SPRAY = brace(-8, 0.5, [3.0, -3.7]);

/** Her front hand while she sprays, where the stream leaves her. */
const NOZZLE = pointOf(rig, SPRAY, 'foreF', 0, HAND);

/** The water's tail sits on her front hand and its round head at `head`, `r` wide: the stream she sprays. */
function spray(head: Pt, r: number): BonePose {
  const [x, y] = NOZZLE;
  const rot = (Math.atan2(y - head[1], x - head[0]) * 180) / Math.PI + 90;
  return { x: head[0], y: head[1], rot, sx: r / BALL, sy: Math.hypot(x - head[0], y - head[1]) / JET_TIP };
}

/** The stream's head on the 12-degree aim, `d` units out from the nozzle. */
const aimed = (d: number): Pt => {
  const theta = (STREAM.angle * Math.PI) / 180;
  return [STREAM.nozzle.x + d * Math.cos(theta), -STREAM.nozzle.y - d * Math.sin(theta)];
};

/**
 * Water Stream (neutral special), frame for frame on its move (src/fighters/watergirl/waterStream.ts): she plants
 * her feet and pumps a ball of water up at her hands, holds it there while Special charges it, then sprays. The
 * stream surges on each of the seven pumps and dies off after the last; `recovery` is the light or heavy shoot.
 */
function waterStream(recovery: number): AnimClip {
  const release = STREAM.chargeFrame;
  const pumps = Array.from(
    { length: STREAM.pumps },
    (_, i) => release + STREAM.firstPump + i * STREAM.pumpEvery,
  );
  const last = pumps[pumps.length - 1]!;
  const surge = (frame: number, d: number, r: number) =>
    key(
      frame,
      mix(SPRAY, {
        fx1: spray(aimed(d), r),
        fx2: ball(NOZZLE[0] + 0.6, NOZZLE[1], r * 0.6),
      }),
      {
        ease: 'inOut',
      },
    );
  return {
    active: [[pumps[0]!, last]],
    length: release + recovery - 1,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(8, mix(PUMP_UP, { fx2: ball(2.4, -3.6, 0.7) }), { ease: 'inOut', swaps: { fx2: 'fxBall' } }),
      key(release - 1, mix(CHARGED, { fx2: ball(2.0, -3.4, 1.5) }), { ease: 'linear' }),
      key(release, mix(CHARGED, { fx2: ball(2.0, -3.4, 1.6) }), { ease: 'in' }),
      key(
        release + 1,
        mix(SPRAY, { fx1: spray(aimed(1), 1.2), fx2: ball(NOZZLE[0] + 0.6, NOZZLE[1], 1.2) }),
        {
          ease: 'out',
          swaps: { fx1: 'fxJet', fx2: 'fxBall', face: 'faceFrontShout' },
          z: FRONT_ARM_IN_FRONT,
        },
      ),
      ...pumps.flatMap((p) => [surge(p, 6.5, 2.3), surge(p + 2.5, 4.5, 1.8)]),
      key(last + 4, mix(SPRAY, { fx1: spray(aimed(1), 0.5), fx2: ball(NOZZLE[0] + 0.6, NOZZLE[1], 0.4) }), {
        ease: 'inOut',
      }),
      key(last + 5, mix(SPRAY), { swaps: { fx1: null, fx2: null }, z: {} }),
      key(release + recovery - 1, STAND),
    ],
  };
}

const { clips: base } = fireboy;

/**
 * Watergirl's clips: Fireboy's, with the water thrown further where her hitboxes reach further (jabs, ftilt,
 * fair), and her own Geyser and Water Stream.
 */
export const clips: Record<string, AnimClip> = {
  ...base,
  jab: reaim(base.jab!, 'fx1', [10, -8.5]),
  jab2: reaim(base.jab2!, 'fx1', [10.5, -8]),
  jab3: reaim(base.jab3!, 'fx1', [10, -6.5]),
  ftilt: reaim(base.ftilt!, 'fx1', [15, -8], 2.8),
  fair: nudge(base.fair!, 'fx1', 4, -1.6),
  upB,
  neutralB: waterStream(STREAM.light),
  neutralBHeavy: waterStream(STREAM.heavy),
};
