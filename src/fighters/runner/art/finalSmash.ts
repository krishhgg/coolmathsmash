import type { Pose } from '../../../render/rig/author';
import type { AnimClip, BonePose, Key, ViewFlip } from '../../../render/rig/types';
import { TUNNEL_FLIP } from '../timing';
import { READY, TUCK } from './clips';
import { ANGRY, BLINK, HAPPY, P, SHOUT, key, mix } from './poses';
import { BODY_Y } from './rig';

/**
 * Tunnel Flip, the Final Smash (src/fighters/runner/finalSmash.ts), on Peach Blossom's timeline. Through the
 * activation she winds up, springs into a backflip and lands slapping the floor with both hands, so the tiles either
 * side of her flip up on their edges, as Tile Flip's one does. On frame 40 the tunnel itself appears around her, seen
 * end on, and over the hit's frames it grows to TUNNEL_SIZE and rolls a half turn while the renderer turns the whole
 * view upside down (`viewFlips`). While everyone near her is stuck she hops from foot to foot, untroubled, and
 * over the last frames the tunnel shrinks back in, rolling the other half turn as the view turns upright, and she
 * settles into her stance on the frame before she can act.
 */

const { hit, clean, late, faf, turn, back } = TUNNEL_FLIP;

/** The view flip the renderer plays over the move (src/render/viewFlip.ts). */
export const tunnelFlipView: ViewFlip = { turn, back };

/**
 * The tunnel on fx3 (slot fxUnder, drawn under every fighter), centred on her middle: `size` units to each side, turned
 * `rot`.
 */
const ring = (size: number, rot: number): Pose => ({ fx3: { x: 0, y: BODY_Y, rot, sx: size, sy: size } });

/**
 * One of the floor tiles beside her, flipped `deg` up onto its inner edge (0 flat, 90 on end) on fx1 (in front) or
 * fx2 (behind). Its inner edge stays put 8.1 units out, as Tile Flip's tile does.
 */
function tiles(deg: number): Pose {
  const a = (deg * Math.PI) / 180;
  const front: BonePose = { x: 8.1 + 3.2 * Math.cos(a), y: -0.74 - 3.2 * Math.sin(a), rot: -deg };
  const behind: BonePose = { x: -8.1 - 3.2 * Math.cos(a), y: -0.74 - 3.2 * Math.sin(a), rot: deg };
  return { fx1: front, fx2: behind };
}

/** Crouched deep, arms swept back behind her: the wind-up. */
const WIND = P({
  x: -0.3,
  y: 2.3,
  rot: 12,
  sx: 1.12,
  sy: 0.84,
  legs: [
    [2.5, 0],
    [-2.3, 0],
  ],
  arms: [
    [-3.2, -3.2],
    [-5.6, -3.6],
  ],
  ant: [-22, -16],
});

/**
 * Arms raised by raw rotation from rest, since her stub arms can't reach IK targets overhead: the far arm turned `far`
 * degrees up from hanging and the near arm `near` the other way (0 leaves that arm alone). Her round body would hide
 * a raised stub, so the shoulders ride up the body's sides by `rise` and the upper arms stretch.
 */
const armsUp = (far: number, near: number, stretch = 1.7, rise = 2.6): Pose => ({
  ...(far && { armB: { x: 0.2, y: -rise, rot: -far, sy: stretch }, foreB: { rot: -12 } }),
  ...(near && { armF: { x: -0.1, y: -rise - 0.15, rot: near, sy: stretch }, foreF: { rot: 12 } }),
});

/** Off the floor, stretched tall with both arms thrown straight up, legs hanging. */
const SPRING = mix(
  P({
    y: -0.6,
    rot: -4,
    sx: 0.92,
    sy: 1.12,
    raw: { thighB: { rot: 12 }, shinB: { rot: 8 }, thighF: { rot: -8 }, shinF: { rot: 12 } },
    ant: [34, 30],
  }),
  armsUp(150, 150, 1.8, 3.2),
  { root: { y: -2.5 } },
);

/** The backflip: tucked, turned `rot` (negative: head going back), lifted `lift` units off the floor. */
const flip = (rot: number, lift: number): Pose => mix(TUCK, { body: { rot }, root: { y: -lift } });

/** Landed in a squat, both hands slapping the floor out to her sides. */
const SLAP = P({
  y: 2.4,
  sx: 1.1,
  sy: 0.86,
  legs: [
    [2.7, 0],
    [-2.6, 0],
  ],
  raw: { armB: { sy: 1.6 }, foreB: { sy: 1.2 }, armF: { sy: 1.6 }, foreF: { sy: 1.2 } },
  arms: [
    [6.6, -0.7],
    [-6.4, -0.7],
  ],
  ant: [-30, -26],
});

/** Standing tall, arms flung up and wide, heaving the tunnel round; `twist` leans her into the turn. */
const heave = (twist: number): Pose =>
  mix(
    P({
      y: -0.1,
      rot: twist,
      sx: 0.95,
      sy: 1.07,
      legs: [
        [2.6, 0],
        [-2.4, 0],
      ],
      ant: [-12, 12],
    }),
    armsUp(100, 100),
  );

/**
 * Her bounce while the others are stuck: up off the floor waving the far arm (`side` 1), or landed in a squash
 * waving the near one (`side` -1). She lifts no more than 1.2 units, so her body stays over the Final Smash's boxes.
 */
const hop = (side: 1 | -1): Pose =>
  side === 1
    ? mix(
        P({
          y: -0.3,
          rot: -7,
          sx: 0.96,
          sy: 1.05,
          raw: { thighB: { rot: -22 }, shinB: { rot: 30 }, thighF: { rot: 14 }, shinF: { rot: 22 } },
          arms: [null, [-4.9, -4.6]],
          ant: [-18, -10],
        }),
        armsUp(120, 0),
        { root: { y: -1.2 } },
      )
    : mix(
        P({
          y: 0.7,
          rot: 7,
          sx: 1.06,
          sy: 0.93,
          legs: [
            [2.2, 0],
            [-2.0, 0],
          ],
          arms: [[5.0, -4.6], null],
          ant: [16, 10],
        }),
        armsUp(0, 120),
      );

/** Swap sets: each key's swaps name everything shown from then on. */
const TILES = { ...SHOUT, fx1: 'tile', fx2: 'tile' };
const TUNNEL = { ...SHOUT, fxUnder: 'tunnel' };
const TUNNEL_FADE = { ...HAPPY, fxUnder: 'tunnelFaint' };
const BACK_FADE = { ...SHOUT, fxUnder: 'tunnelFaint' };

/**
 * How far the tunnel reaches from her middle: from just around her out to TUNNEL_SIZE. The camera always keeps 55
 * units either side of a fighter, 25 below her feet and 50 above them (src/render/camera.ts), so a tunnel of 29.5
 * (its edge 30.15 from her middle, 6.75 up) keeps all four walls on screen wherever it is drawn: it never shrinks to
 * one wall standing through the stage. The boxes reach much further (100 units); the turning view shows that.
 */
const NEAR = 5;
export const TUNNEL_SIZE = 29.5;

/** The hop, a step every 10 frames from frame `from` to `to`, blinking now and then. */
function hops(from: number, to: number): Key[] {
  const out: Key[] = [];
  for (let f = from, i = 0; f <= to; f += 10, i++)
    out.push(key(f, hop(i % 2 ? -1 : 1), { ease: 'inOut', swaps: i % 7 === 3 ? BLINK : HAPPY }));
  return out;
}

export const finalSmashClips: Record<string, AnimClip> = {
  finalSmash: {
    length: faf - 1,
    active: [hit, clean, late],
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(6, WIND, { ease: 'in' }),
      key(10, WIND, { ease: 'out' }),
      key(12, SPRING, { ease: 'linear', swaps: SHOUT }),
      key(14, flip(-20, 6.5), { ease: 'linear' }),
      key(18, flip(-110, 9.2), { ease: 'linear' }),
      key(22, flip(-200, 9.6), { ease: 'linear' }),
      key(26, flip(-290, 7.4), { ease: 'linear' }),
      key(30, flip(-355, 2.8), { ease: 'in' }),
      key(32, mix(SLAP, tiles(0)), { ease: 'out', swaps: TILES }),
      key(36, mix(heave(0), tiles(70)), { ease: 'out' }),
      key(39, mix(heave(-2), tiles(90)), { ease: 'step' }),
      key(hit[0], mix(heave(-3), ring(NEAR, 0)), { ease: 'out', swaps: TUNNEL }),
      key(50, mix(heave(-6), ring(24, 120)), { ease: 'out' }),
      key(hit[1], mix(heave(-2), ring(TUNNEL_SIZE, 180)), { ease: 'linear' }),
      key(clean[0], mix(heave(0), ring(TUNNEL_SIZE, 182)), { ease: 'linear', swaps: TUNNEL_FADE }),
      key(66, mix(hop(1), ring(TUNNEL_SIZE, 186)), { ease: 'inOut', swaps: HAPPY }),
      ...hops(76, late[1] - 4),
      key(back[0], mix(heave(0), ring(TUNNEL_SIZE, 180)), { ease: 'in', swaps: BACK_FADE }),
      key(234, mix(heave(2), ring(TUNNEL_SIZE, 196)), { ease: 'in', swaps: TUNNEL }),
      key(back[1] - 1, mix(heave(0), ring(NEAR, 360)), { ease: 'linear' }),
      key(back[1], READY, { swaps: {} }),
    ],
  },
};
