import type { Pose } from '../../../render/rig/author';
import type { AnimClip, PropArt } from '../../../render/rig/types';
import { DUCK_RAFT } from '../duckRaftData';
import { BRO_CHEER, STAND, bro } from './clips';
import { FORE_ARM, GRIP_FRONT, UPPER_ARM } from './parts';
import {
  GRIN,
  GRIT,
  HAPPY,
  OPEN_F,
  SHOUT,
  aim,
  at,
  feet,
  fx,
  hands,
  key,
  mix,
  shortTurns,
  type Pt,
} from './poses';
import { rig } from './rig';

/**
 * Duck Raft (down special), on the move's frames: the big kid pulls the folded raft out with his near hand and lifts
 * it beside his head while his brother looks up at it (frame 2), slings it down in front of him (frame 3) and lets
 * go on frame 4, the frame the raft appears, in two puffs of air as it pops open. His brother cheers as he picks the
 * launcher back up. One clip serves the ground and the air: in the air the raft appears under their feet and they
 * land on it that frame, so they finish the move standing either way. Rig space: y down, feet at the origin, facing
 * right.
 */

const round = (v: number) => Math.round(v * 1000) / 1000;
const ARM = UPPER_ARM + FORE_ARM;

/** Puts the hands on rig points, stretching an arm rubber-hose style when the point is out of its reach. */
function reachTo(pose: Pose, back: Pt | null, front: Pt | null): Pose {
  let p = pose;
  for (const [arm, fore, to] of [
    ['armB', 'foreB', back],
    ['armF', 'foreF', front],
  ] as const) {
    if (!to) continue;
    const [sx, sy] = at(p, arm);
    const k = Math.hypot(to[0] - sx, to[1] - sy) / (ARM * 0.97);
    if (k > 1) p = mix(p, { [arm]: { sy: round(k) }, [fore]: { sy: round(k) } });
  }
  return hands(p, back, front);
}

/** Feet planted at `back` and `front`, the launcher swung aside at `gun` degrees in the far hand, the near hand at `hand`. */
function toss(extra: Pose, hand: Pt, gun: number, back: Pt, front: Pt): Pose {
  const pose = aim(feet(extra, back, front), gun, -0.3, 0.6);
  return reachTo(pose, at(pose, 'gun', ...GRIP_FRONT), hand);
}

/** The folded raft lifted beside his head, his brother peering up at it. */
const PULL = toss(
  { body: { rot: -8, x: -0.4, y: 0.3 }, neck: { rot: -8 }, ...bro(-6, -14, -50, -10, -20, 0.2) },
  [-1.6, -10.2],
  40,
  [1.2, 0],
  [-1.8, 0],
);
/** Slung down and forward, about to let go. */
const SLING = toss(
  { body: { rot: 14, x: 0.8, y: 0.6 }, neck: { rot: -6 }, ...bro(10, 6, -90, 0, 10) },
  [3.4, -4.4],
  40,
  [3.0, 0],
  [-1.0, 0],
);
/** Let go: the hand open past the release point. */
const LET_GO = toss(
  { body: { rot: 16, x: 1.0, y: 0.7 }, neck: { rot: -4 }, ...BRO_CHEER },
  [3.9, -3.2],
  40,
  [3.0, 0],
  [-1.0, 0],
);
/** Straightening up, the launcher coming back across the ring. */
const SETTLE = toss(
  { body: { rot: 6, x: 0.4, y: 0.4 }, neck: { rot: 2 }, ...BRO_CHEER },
  [1.6, -5.2],
  10,
  [2.2, 0],
  [-1.0, 0],
);

/** An effect bone's placement. */
const place = (bone: string, x: number, y: number, s: number): Pose => ({ [bone]: fx(x, y, s) });
/** The puffs: one where the ground raft pops open ahead of them, one at their feet. */
const puffs = (ahead: [number, number, number], feet: [number, number, number]): Pose =>
  mix(place('fx1', ...ahead), place('fx2', ...feet));

export const duckRaftClips: Record<string, AnimClip> = {
  downB: {
    length: DUCK_RAFT.faf - 1,
    // The impact window is the frame the raft appears, as on the kids' shots and the grenade.
    active: [[DUCK_RAFT.place, DUCK_RAFT.place]],
    swaps: GRIN,
    keys: shortTurns([
      key(0, STAND, { ease: 'out' }),
      key(2, PULL, { ease: 'in', swaps: { ...GRIT, broFace: 'broUp', held: 'raftBundle' } }),
      key(DUCK_RAFT.place - 1, SLING, { ease: 'linear', swaps: { ...SHOUT, held: 'raftBundle' } }),
      key(DUCK_RAFT.place, mix(LET_GO, puffs([12.5, -3.2, 1.6], [1.0, -1.0, 0.9])), {
        ease: 'out',
        swaps: { ...SHOUT, broFace: 'broCheer', ...OPEN_F, held: null, fx1: 'fxPuff', fx2: 'fxPuff' },
      }),
      key(7, mix(LET_GO, puffs([13.5, -4.4, 2.3], [0.6, -1.4, 1.3])), { ease: 'in', swaps: { ...HAPPY } }),
      key(10, mix(SETTLE, puffs([14.0, -5.4, 0.6], [0.4, -1.9, 0.4])), { ease: 'inOut' }),
      key(11, undefined, { swaps: { ...HAPPY, fx1: null, fx2: null } }),
      key(DUCK_RAFT.faf - 1, STAND, { swaps: {} }),
    ]),
  },
};

/** The raft in a match; the lab previews it where the ground throw puts it, from the frame it appears. */
export const duckRaftProp: PropArt = {
  symbols: rig.symbols,
  symbol: 'duckRaft',
  scale: 1,
  preview: { downB: { frame: DUCK_RAFT.place, x: DUCK_RAFT.ground.x, y: DUCK_RAFT.ground.y } },
};
