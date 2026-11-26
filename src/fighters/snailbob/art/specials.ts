import type { Pose } from '../../../render/rig/author';
import type { AnimClip } from '../../../render/rig/types';
import { AIR, DETERMINED, WIDE, add, at, key, look, mix, stalks } from './poses';

/**
 * Snail Bob's specials, keyed to src/fighters/snailbob/moves.ts like attacks.ts (frame 1 is the move's first frame,
 * length = FAF - 1).
 */

/** The booster and its exhaust, which every Rocket Hover key shows. */
const ROCKET_ON = { rocket: 'rocket', flame: 'flame' };
const LIT = { ...WIDE, mouth: 'grin', ...ROCKET_ON };

/** Bracing for the blast in midair: squashed, stalks bunched forward, the booster popping out behind the shell. */
const BRACE: Pose = mix(
  AIR,
  { body: { sx: 1.08, sy: 0.9 }, shell: { rot: 4, y: 0.4 }, neck: { rot: 10, sy: 0.9 }, head: { y: 0.3 } },
  stalks(10, 8, 14, 8, 0.85),
);
/** The blast: stretched tall, the stalks dragged down a little by the climb, the flame at its longest. */
const BLAST: Pose = mix(
  AIR,
  { body: { sx: 0.9, sy: 1.12 }, foot: { rot: -4 }, shell: { rot: -3 }, neck: { rot: 4 } },
  stalks(-8, -8, -4, -6, 0.9),
  look(0.1, -0.35),
  { flame: { sy: 1.3, sx: 1.1 } },
);
/** Riding the thrust: upright, the stalks trailing a little behind, looking up and ahead. */
const THRUST: Pose = mix(
  AIR,
  {
    body: { sx: 0.96, sy: 1.04 },
    foot: { rot: -4 },
    shell: { rot: -3 },
    neck: { rot: 2 },
    head: { rot: 0 },
  },
  stalks(-10, -6, -6, -4, 0.95),
  look(0.15, -0.3),
);

/**
 * Rocket Hover: he braces, a booster pops out behind his shell and fires, and he rides the flame up. The hover
 * outlasts the clip (it burns until the fuel or Special runs out), so the clip ends on the steady thrust pose,
 * and the flame symbol flickers on the match clock while that pose holds. A smoke puff marks the ignition.
 */
const upB: AnimClip = {
  length: 24,
  swaps: ROCKET_ON,
  keys: [
    key(0, mix(BRACE, { rocket: { sx: 0.4, sy: 0.4 }, flame: { sy: 0.2 } }), {
      ease: 'out',
      swaps: { ...DETERMINED, rocket: 'rocket', flame: null },
    }),
    key(2, mix(BRACE, { rocket: { sx: 1.08, sy: 1.08 }, flame: { sy: 0.3 }, fx4: at(-6.4, -0.8, 0, 0.5) }), {
      ease: 'out',
      swaps: { ...DETERMINED, ...ROCKET_ON, fxBack: 'dust' },
    }),
    key(5, mix(BLAST, { fx4: at(-6.6, 0.6, 0, 1.0) }), {
      ease: 'inOut',
      swaps: { ...LIT, fxBack: 'dust' },
    }),
    key(10, mix(add(THRUST, { body: { sy: 1.04 } }), { fx4: at(-6.8, 2.2, 0, [1.3, 0.8]) }), {
      ease: 'inOut',
    }),
    key(11, undefined, { swaps: LIT }),
    key(17, add(THRUST, { shell: { rot: 1.5 }, foot: { rot: 1.5 } }, stalks(-3, -3, -3, -3)), {
      ease: 'inOut',
    }),
    key(24, THRUST),
  ],
};

export const specials: Record<string, AnimClip> = { upB };
