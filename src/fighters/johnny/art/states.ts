import type { Pose } from '../../../render/rig/author';
import { flattenPath } from '../../../render/rig/geometry';
import { worldTransforms, type Affine, type BoneTransform } from '../../../render/rig/sample';
import type { AnimClip } from '../../../render/rig/types';
import { rig } from './rig';
import {
  AIR,
  CROUCH,
  FISTS,
  GRIT,
  GUARD,
  HURT,
  PALM_B,
  SHOUT,
  SMIRK,
  STAND,
  hands,
  key,
  mix,
  sole,
  soles,
  type Pt,
} from './poses';

/**
 * Johnny's knockdown, getup, respawn and taunt clips: the states the engine plays whenever he is knocked off his
 * feet or waiting on the respawn platform. Everything is drawn from the floor up, in rig space.
 */

/** Rig-space matrix of every bone in `pose`. */
function worldOf(pose: Pose): Record<string, Affine> {
  const local: Record<string, BoneTransform> = {};
  for (const bone of rig.bones) {
    const p = pose[bone.name] ?? {};
    local[bone.name] = {
      x: bone.x + (p.x ?? 0),
      y: bone.y + (p.y ?? 0),
      rot: (bone.rot ?? 0) + (p.rot ?? 0),
      sx: (bone.sx ?? 1) * (p.sx ?? 1),
      sy: (bone.sy ?? 1) * (p.sy ?? 1),
    };
  }
  return worldTransforms(rig, local);
}

/** How far below the rig origin the bottom of one slot of `pose` is. */
function slotLow(pose: Pose, slot: string): number {
  const world = worldOf(pose);
  const s = rig.slots.find((x) => x.name === slot)!;
  const sym = s.symbol ? rig.symbols[s.symbol] : undefined;
  if (!Array.isArray(sym)) return 0;
  const m = world[s.bone]!;
  let low = -Infinity;
  for (const shape of sym)
    for (const pts of flattenPath(shape.d, 4))
      for (let i = 0; i < pts.length; i += 2) low = Math.max(low, m.b * pts[i]! + m.d * pts[i + 1]! + m.ty);
  return low;
}

/**
 * Sets a drawn pose down on the floor: its lowest point ends up at y = 0, or `sink` below, and `slot` (the part
 * carrying his weight, like his back while lying) ends up on the floor when given.
 */
function planted(pose: Pose, sink = 0, slot?: string): Pose {
  const low = slot
    ? slotLow(pose, slot)
    : Math.max(...rig.slots.filter((s) => s.symbol && !s.decor).map((s) => slotLow(pose, s.name)), -Infinity);
  return mix(pose, { body: { y: (pose.body?.y ?? 0) - low + sink } });
}

/** Flat on his back: `lean` tips the body, `arms` and `legs` splay it, `y` lifts it off the floor. */
function lying(lean: number, y: number, extra: Pose = {}): Pose {
  return mix({ body: { rot: lean, y } }, extra);
}

/** On his back with his fists up, knees bent: the settle after a missed tech. */
const DOWN = planted(
  lying(92, 0, {
    torso: { rot: -8 },
    neck: { rot: -16 },
    armF: { rot: -128 },
    foreF: { rot: -104 },
    armB: { rot: 136 },
    foreB: { rot: 88 },
    thighF: { rot: -30 },
    shinF: { rot: 46 },
    thighB: { rot: -16 },
    shinB: { rot: 34 },
  }),
);

/** Rolling onto an elbow, one boot planted. */
const DOWN_ROLL = planted(
  hands(
    lying(64, 0.2, {
      neck: { rot: -10 },
      thighF: { rot: -62 },
      shinF: { rot: 74 },
      thighB: { rot: -20 },
      shinB: { rot: 50 },
      torso: { rot: -4 },
    }),
    [-4.0, -2.6],
    [-1.2, -5.0],
    1,
    -1,
  ),
  0.3,
  'torso',
);

/** Pushing up off the floor onto a knee, a fist on the ground. */
const PUSH_UP = planted(
  hands(
    mix(CROUCH, {
      body: { rot: 26 },
      hip: { y: 2.4 },
      neck: { rot: -18 },
      thighF: { rot: -30 },
      shinF: { rot: 40 },
    }),
    [4.6, -3.4],
    [-1.0, -2.0],
    1,
    -1,
  ),
);

/** The coiled ball he rolls in. */
const TUCK = planted(
  hands(
    mix(CROUCH, {
      body: { rot: 26 },
      torso: { rot: 18 },
      neck: { rot: -16 },
      hip: { y: 1.4 },
      thighF: { rot: -82, x: 1.0 },
      shinF: { rot: 146 },
      thighB: { rot: -66, x: -1.0 },
      shinB: { rot: 132 },
    }),
    [3.4, -6.4],
    [1.2, -5.6],
    1,
    -1,
  ),
);

/**
 * A ball that turns with the roll: `rot` degrees around his own centre. Every angle sits on the widest radius of
 * the ball, so no part of him dips through the floor as the keys tween between angles.
 */
function rolled(rot: number): Pose {
  return planted(mix(TUCK, { body: { rot: (TUCK.body!.rot ?? 0) + rot } }));
}

/** A taunt pose: standing with the body tipped `rot` degrees, the hips dropped `hip`, the boots turned `soles`, and
 * the fists on `back` and `front`, set down on the floor.
 */
const flex = (rot: number, hip: number, boots: number, back: Pt, front: Pt): Pose =>
  planted(hands(soles(mix(STAND, { body: { rot }, hip: { y: hip } }), 0, boots), back, front, -1, 1));

/** Standing again, weight forward, fists up. */
const RISE = planted(
  hands(
    mix(STAND, { body: { rot: 8 }, hip: { y: 0.8 }, neck: { rot: -4 } }),
    [4.4, -8.0],
    [-3.4, -8.6],
    -1,
    1,
  ),
);

export const states: Record<string, AnimClip> = {
  down: {
    length: 40,
    loop: true,
    swaps: { ...HURT, ...GUARD },
    keys: [
      key(0, DOWN),
      key(
        14,
        mix(DOWN, {
          body: { rot: 84, y: 0.9 },
          neck: { rot: -10 },
          thighF: { rot: -18 },
          thighB: { rot: -8 },
        }),
      ),
      key(28, DOWN),
    ],
  },

  getupStand: {
    length: 30,
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, DOWN, { ease: 'out' }),
      key(6, DOWN_ROLL, { ease: 'out' }),
      key(13, PUSH_UP, { ease: 'inOut' }),
      key(20, mix(CROUCH, { body: { rot: 12 } }), { ease: 'out', swaps: { ...GRIT, ...GUARD } }),
      key(30, RISE),
    ],
  },

  techInPlace: {
    length: 26,
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, planted(mix(TUCK, { body: { rot: 20 } })), { ease: 'out' }),
      ...[4, 6, 8, 10, 12, 14].map((f) => key(f, rolled((f - 4) * 30), { ease: 'linear' })),
      key(19, mix(CROUCH, { body: { rot: 16 } }), { ease: 'out', swaps: { ...GRIT, ...GUARD } }),
      key(26, RISE),
    ],
  },

  techRoll: {
    length: 40,
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, planted(mix(TUCK, { body: { rot: 10 } })), { ease: 'out' }),
      ...[6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map((f) =>
        key(f, rolled((f - 6) * 26), { ease: 'linear' }),
      ),
      key(30, mix(CROUCH, { body: { rot: 18 } }), { ease: 'out', swaps: { ...GRIT, ...GUARD } }),
      key(40, RISE),
    ],
  },

  respawn: {
    length: 60,
    loop: true,
    swaps: { ...SMIRK, ...GUARD },
    keys: [
      key(
        0,
        sole(
          sole(
            mix(AIR, {
              body: { y: -1.3 },
              armF: { rot: -150 },
              armB: { rot: 150 },
              foreF: { rot: -20 },
              foreB: { rot: 20 },
            }),
            'B',
            30,
          ),
          'F',
          20,
        ),
      ),
      key(
        30,
        sole(
          sole(
            mix(AIR, {
              body: { y: -1.7 },
              neck: { rot: -6 },
              armF: { rot: -160 },
              armB: { rot: 140 },
              foreF: { rot: -30 },
              foreB: { rot: 30 },
              thighF: { rot: -34 },
              thighB: { rot: 14 },
            }),
            'B',
            24,
          ),
          'F',
          14,
        ),
      ),
      key(
        60,
        mix(AIR, {
          body: { y: -10 },
          armF: { rot: -150 },
          armB: { rot: 150 },
          foreF: { rot: -20 },
          foreB: { rot: 20 },
        }),
      ),
    ],
  },

  taunt: {
    length: 60,
    swaps: { ...SHOUT, ...FISTS },
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(8, flex(-4, 0.6, -6, [6.4, -9.2], [-4.2, -9.0]), { ease: 'out' }),
      key(16, flex(-8, 1.2, -10, [7.6, -12.6], [-6.0, -13.4]), {
        ease: 'inOut',
        swaps: { ...SHOUT, ...PALM_B, ...FISTS },
      }),
      key(26, flex(2, 0.2, 0, [4.2, -6.4], [-3.4, -6.2]), { ease: 'out', swaps: { ...SMIRK, ...GUARD } }),
      key(36, flex(-6, 1.0, -8, [7.2, -12.0], [-5.6, -12.8]), {
        ease: 'inOut',
        swaps: { ...SHOUT, ...FISTS },
      }),
      key(48, flex(1, 0.3, 0, [4.4, -7.0], [-3.6, -6.8]), { ease: 'out', swaps: { ...SMIRK, ...GUARD } }),
      key(60, STAND),
    ],
  },
};
