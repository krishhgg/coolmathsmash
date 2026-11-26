import type { Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { STRAFE_DASH } from '../timing';
import { AIR, READY, TUCK } from './clips';
import { ANGRY, FACE, HAPPY, SHOUT, P, key, mix } from './poses';

const { dash, active, end, groundFaf, airFaf } = STRAFE_DASH;

/**
 * Strafe Dash (side special, Fox Illusion's frames): she coils low for 23 frames, bursts forward on frames 24-28
 * with a string of afterimages behind her (the trail that hits, frames 25-29), then brakes and slides out. The
 * afterimages sit on the fx bone at her feet, so the ghosts stay where the trail's boxes are.
 */

/** The coil, `t` of the way from set (0) to wound tight (1): low and leaning in like a sprinter in the blocks. */
const coil = (t: number): Pose =>
  P({
    x: -0.6 - 0.4 * t,
    y: 2.0 + 0.7 * t,
    rot: 20 + 4 * t,
    sx: 1.08 + 0.06 * t,
    sy: 0.88 - 0.06 * t,
    legs: [
      [2.6, 0],
      [-3.4, 0],
    ],
    arms: [
      [-2.4, -4.0 + 0.6 * t],
      [-5.6, -5.0 + 0.6 * t],
    ],
    ant: [-12 - 6 * t, -9 - 6 * t],
  });

/** The burst along the floor: stretched long and laid forward, the near leg skimming out behind her. */
const BURST = P({
  x: 2.2,
  y: 1.15,
  rot: 34,
  sx: 1.18,
  sy: 0.88,
  legs: [
    [1.0, -1.6],
    [-6.2, -0.3],
  ],
  arms: [
    [-3.2, -7.4],
    [-5.6, -6.0],
  ],
  ant: [62, 56],
});

/** Speed lines through the afterimages, over and under her body, on fx1 and fx2. */
const LINES: Pose = {
  fx1: { x: -3.4, y: -10.2, sx: 22, sy: 0.55 },
  fx2: { x: -4.6, y: -2.4, sx: 19, sy: 0.5 },
};

/** Frame 24: the ghosts strung half as far back, where she stood a frame ago. */
const FIRST_STRIDE: Pose = { ...LINES, fx3: { sx: 0.5 } };

/** The brake: weight thrown back over the near foot planted out in front, dust kicking up off it. */
const BRAKE = P({
  x: -0.4,
  y: 1.3,
  rot: -18,
  legs: [
    [1.2, 0],
    [4.8, 0],
  ],
  arms: [
    [6.4, -8.6],
    [-2.6, -9.0],
  ],
  ant: [-36, -30],
});

const DUST: Pose = { fx2: { x: 6.0, y: -0.1, sx: 1.7, sy: 1.3 } };

/** Sliding out of it on both feet, settling. */
const SLIDE = P({
  y: 1.0,
  rot: -7,
  legs: [
    [3.6, 0],
    [0.4, 0],
  ],
  arms: [
    [5.8, -6.4],
    [-4.0, -6.6],
  ],
  ant: [-16, -12],
});

/** In the air the coil is a forward-leaning tuck with the arms thrown back. */
const AIR_COIL = mix(TUCK, {
  body: { rot: 26, sx: 1.04, sy: 0.92 },
  armB: { rot: 40 },
  foreB: { rot: 10 },
  armF: { rot: 120 },
  foreF: { rot: 20 },
});
const AIR_COIL_TIGHT = mix(AIR_COIL, { body: { rot: 30, sx: 1.1, sy: 0.86 } });

/** The burst in the air: laid out level, both legs streaming back. */
const AIR_BURST = mix(BURST, {
  root: { y: 0 },
  thighB: { rot: 48, sy: 1.15 },
  shinB: { rot: 10 },
  thighF: { rot: 64, sy: 1.15 },
  shinF: { rot: 6 },
});

/** The stop in the air: she pulls up, arms flung wide and legs swinging under her. */
const AIR_STOP = P({
  rot: -14,
  raw: { thighB: { rot: -38 }, shinB: { rot: 40 }, thighF: { rot: -18 }, shinF: { rot: 34 } },
  arms: [
    [6.6, -9.4],
    [-5.2, -10.0],
  ],
  ant: [-34, -28],
});

const GHOSTS = { fxBack: 'afterimages' };
const FAINT = { fxBack: 'afterimagesFaint' };
const STREAKS = { fx1: 'streak', fx2: 'streak' };

/** The burst's keys, on `pose`: the first stride, the burst held through the trail, the trail still out on `end`. */
function burst(pose: Pose, stop: Pose, stopSwaps: Record<string, string | null>): Key[] {
  return [
    key(dash[0], mix(pose, FIRST_STRIDE), { ease: 'step', swaps: { ...SHOUT, ...GHOSTS, ...STREAKS } }),
    key(active[0], mix(pose, LINES), { ease: 'linear' }),
    key(dash[1], mix(pose, LINES), { ease: 'step' }),
    key(end, stop, { ease: 'out', swaps: { ...SHOUT, ...GHOSTS, ...stopSwaps } }),
    key(end + 1, stop, { swaps: { ...SHOUT, ...FAINT, ...stopSwaps } }),
  ];
}

export const strafeDashClips: Record<string, AnimClip> = {
  sideB: {
    length: groundFaf - 1,
    active: [active],
    swaps: ANGRY,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(6, coil(0)),
      key(18, coil(0.4), { ease: 'in' }),
      key(dash[0] - 1, coil(1), { ease: 'step' }),
      ...burst(BURST, mix(BRAKE, DUST), { fx2: 'dust' }),
      key(end + 4, mix(BRAKE, { fx2: { x: 7.4, y: -0.1, sx: 2.4, sy: 0.7 } }), {
        swaps: { ...SHOUT, fx2: 'dust' },
      }),
      key(end + 10, SLIDE, { swaps: FACE }),
      key(groundFaf - 1, READY, { swaps: FACE }),
    ],
  },
  sideBAir: {
    length: airFaf - 1,
    active: [active],
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(6, AIR_COIL),
      key(dash[0] - 1, AIR_COIL_TIGHT, { ease: 'step' }),
      ...burst(AIR_BURST, AIR_STOP, {}),
      key(end + 4, mix(AIR_STOP, { body: { rot: -6 } }), { swaps: HAPPY }),
      key(end + 14, AIR, { swaps: FACE }),
      key(airFaf - 1, AIR, { swaps: FACE }),
    ],
  },
};
