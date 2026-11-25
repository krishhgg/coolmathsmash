import { art as fireboy } from '../../fireboy/art';
import { JET_TIP } from '../../fireboy/art/parts';
import { AIR, ANGRY, BALL, CROUCH, NO_BODY, STAND, UP, ball, flame, key, mix } from '../../fireboy/art/poses';
import type { AnimClip, BonePose, Key } from '../../../render/rig/types';

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

const { clips: base } = fireboy;

/**
 * Watergirl's clips: Fireboy's, with the water thrown further where her hitboxes reach further (jabs, ftilt,
 * fair) and her own Geyser.
 */
export const clips: Record<string, AnimClip> = {
  ...base,
  jab: reaim(base.jab!, 'fx1', [10, -8.5]),
  jab2: reaim(base.jab2!, 'fx1', [10.5, -8]),
  jab3: reaim(base.jab3!, 'fx1', [10, -6.5]),
  ftilt: reaim(base.ftilt!, 'fx1', [15, -8], 2.8),
  fair: nudge(base.fair!, 'fx1', 4, -1.6),
  upB,
};
