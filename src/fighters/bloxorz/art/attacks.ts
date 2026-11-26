import type { AnimClip } from '../../../render/rig/types';
import {
  LIE,
  STAND,
  bake,
  centre,
  edge,
  ground,
  landing,
  puff,
  rest,
  rock,
  settle,
  spin,
  squash,
  tipFrame,
  tipOffset,
  tl,
  type Form,
  type Frame,
  type Fx,
  type Place,
} from './bake';
import { turnIn } from './clips';

/**
 * Bloxorz block's move clips (src/fighters/bloxorz/moves.ts, specials.ts): every attack is a tip, a rock, a slam or
 * a stand-up. Frame 1 is the move's frame 1 and each clip lasts FAF - 1 frames; on every active frame the block
 * (or the dust and rubble it throws up) covers each hitbox centre, which index.test.ts checks against the
 * simulation. Moves that flip the form mid-move (utilt and downB from Lying, the tipping dash attack and Roll) are
 * drawn by whichever form is current, so each form's clip shows its own half of every tip.
 */

/** A move clip with `active`: the hit windows (or the throw or pummel frame) its strikes are keyed on. */
export type MoveClip = AnimClip & { active: [number, number][] };

/**
 * Each move's hit windows from moves.ts and specials.ts, or its throw or pummel frame, which the clips below are
 * drawn on. With them the renderer plays every clip frame for frame (src/render/rig/timing.ts); index.test.ts
 * checks them against the move table.
 */
const ACTIVE: Record<string, [number, number][]> = {
  jab: [[5, 6]],
  jab2: [[6, 7]],
  ftilt: [[12, 14]],
  utilt: [[9, 12]],
  dtilt: [[8, 10]],
  dashAttack: [
    [10, 12],
    [20, 22],
    [30, 32],
  ],
  fsmash: [[20, 22]],
  usmash: [[14, 17]],
  dsmash: [
    [13, 15],
    [16, 19],
  ],
  getupAttack: [
    [17, 18],
    [25, 26],
  ],
  nair: [
    [8, 12],
    [13, 22],
  ],
  fair: [[11, 13]],
  bair: [[10, 12]],
  uair: [[9, 12]],
  dair: [
    [16, 18],
    [19, 26],
  ],
  grab: [[9, 10]],
  dashGrab: [[11, 12]],
  pivotGrab: [[12, 13]],
  pummel: [[1, 1]],
  fthrow: [[16, 16]],
  bthrow: [[30, 30]],
  uthrow: [[20, 20]],
  dthrow: [[22, 22]],
  sideB: [
    [12, 13],
    [22, 23],
    [32, 33],
    [42, 43],
  ],
  upB: [[34, 57]],
  downB: [[14, 16]],
};

/** Lying's own Tip Over (lyingMoves in moves.ts) hits earlier. */
const LYING_ACTIVE: Record<string, [number, number][]> = { ...ACTIVE, ftilt: [[8, 10]] };

/** The dash attack's three tips and Roll's four: `count` tips of `frames` frames from frame `start`. */
const TUMBLE = { start: 1, frames: 10, count: 3 };
const ROLL = { start: 3, frames: 10, count: 4 };

/** The groundward squash of a block just landed, kept in screen terms. */
const sq = (form: Form, v: number) => squash(form, 1 + (1 - v) * 0.45, v);

/** An impact's squash track: `at` the frame it lands. */
const impact = (f: number, at: number, depth = 0.16) =>
  1 -
  depth *
    tl(f, [
      [at - 1, 0],
      [at, 1, 'out'],
      [at + 3, -0.18],
      [at + 6, 0],
    ]);

/** In between two places with the block's lowest corner kept `lift` above the floor (a stand-up or flop in place). */
function groundBlend(a: Place, b: Place, u: number, lift = 0): Place {
  const [ax] = centre(a);
  const [bx] = centre(b);
  const turn = a.rot + a.base + (b.rot + b.base - a.rot - a.base) * u;
  const form = a.base === 0 ? STAND : LIE;
  return ground(form, turn - form.base, {
    sx: a.sx + (b.sx - a.sx) * u,
    sy: a.sy + (b.sy - a.sy) * u,
    x: ax + (bx - ax) * u,
    lift,
  });
}

/** A rubble wave rolling out along the floor, centred at `x`, popped up by `s`. */
const wave = (x: number, s: number, dir: 1 | -1): Fx | undefined =>
  s > 0.02 ? { sym: 'wave', x, y: 0, sx: dir * (0.7 + 0.3 * s), sy: s } : undefined;

/**
 * A tipping attack: `count` tips of `frames` frames from frame `start`, each landing with a slam of dust in front
 * of the block (it carries the hit when the block lands standing and too narrow to reach the hitbox).
 */
function tumbling(form: Form, a: number, { start, frames, count }: typeof TUMBLE): Frame {
  const t = a - start;
  const rolling = start === ROLL.start;
  if (t < 0) {
    const brace = a / start;
    return {
      block: ground(form, -15 * brace, sq(form, 1 - 0.13 * brace)),
      fx: rolling ? { hitB: { sym: 'skid', x: -form.hw, y: 0, sx: 0.7 + brace * 0.8 } } : undefined,
    };
  }
  const total = count * frames;
  const u = t % frames;
  const done = t >= total;
  const block = done ? settle(form, t - total, {}, rolling ? 2.3 : 1.6) : tipFrame(form, u, frames);
  const age = done ? t - total + 1 : u >= frames - 2 ? u - frames + 1 : t >= frames && u < 2 ? u + 1 : -9;
  const moved = done ? 0 : u >= frames - 2 ? tipOffset(u, frames) - 18 : tipOffset(u, frames);
  const finishing = done || t >= total - frames;
  const [cx, cy] = centre(block);
  const skid = !rolling && age >= -1 && age <= 2 ? { sym: 'skid', x: form.hw + 1 - moved, y: 0 } : undefined;
  const speed =
    done || u < 2 || u > 8
      ? undefined
      : rolling
        ? { sym: 'sweep', x: cx + 1, y: cy, rot: -26 + u * 6, sx: finishing ? 1.35 : 1.15, sy: 1.05 }
        : { sym: 'streak', x: -form.hw + 2, y: -1.5, sx: 1, sy: 0.62 };
  if (age < -1 || age > 2) return { block, fx: { back: speed } };
  const strikeX = form.hw + 2.2 - moved;
  return {
    block,
    fx: {
      ...landing(-moved, form.hw, age, rolling && finishing ? 1.45 : 0.8, 4),
      back: speed,
      hitB: rolling && age >= 0 ? wave(strikeX + age * 2.1, finishing ? 1.4 : 0.8, 1) : skid,
      hitA: { sym: 'slam', x: strikeX, y: 0, sx: 0.95, sy: age < 0 ? 0.8 : 1 },
      starA:
        rolling && age >= 0
          ? { sym: 'ring', x: strikeX, y: 0, sx: (finishing ? 0.95 : 0.6) + 0.35 * age, sy: 0.32 }
          : undefined,
    },
  };
}

/** A topple onto the far end (Standing tilt, smash, dash grab...): rock about the front edge by `deg`. */
const topple = (form: Form, deg: number, sx = 1, sy = 1, x = 0) => rock(form, deg, { sx, sy, x });

export function moveClips(form: Form): Record<string, MoveClip> {
  const F = form;
  const S = F === STAND;

  /** Standing Tip Over / Monolith Slam style slam frames: dust out of both ends of the toppled block. */
  const slamDust = (f: number, at: number, far: number, near: number, size = 1.2): Frame['fx'] => ({
    dustA: puff(far, 0, f - at, 1, size, 14),
    dustB: puff(near, 0, f - at, -1, size * 0.7, 12),
  });

  const sFsmash = (f: number): Place => {
    const deg = tl(f, [
      [0, 0],
      [5, -14, 'inOut'],
      [12, -16, 'inOut'],
      [14, -10, 'in'],
      [17, 29, 'in'],
      [19, 90],
      [20, 90],
      [34, 90, 'inOut'],
      [48, -4, 'inOut'],
      [53, 2],
      [60, 0],
    ]);
    const sy = tl(f, [
      [0, 1],
      [5, 1.08],
      [12, 1.1],
      [15, 1.05],
      [19, 1],
      [20, 1.1, 'out'],
      [23, 0.98],
      [27, 1],
    ]);
    const sx = tl(f, [
      [19, 1],
      [20, 0.8, 'out'],
      [23, 1.05],
      [27, 1],
    ]);
    return topple(STAND, deg, sx, sy);
  };

  const lFsmash = (f: number): Place => {
    const deg = tl(f, [
      [0, 0, 'inOut'],
      [8, 39, 'out'],
      [13, 54, 'in'],
      [19, 90, 'out'],
      [25, 90],
      [29, 87, 'inOut'],
      [35, 90, 'in'],
      [51, 0],
    ]);
    const sy = impact(f, 19, 0.17);
    const sx =
      1 +
      0.65 * (1 - sy) +
      tl(f, [
        [18, 0],
        [19, 0.05],
        [23, 0.05],
        [29, 0],
      ]);
    return edge(LIE, 1, deg, { sx, sy, x: (1 - sy) * LIE.hw - 0.04 });
  };

  const sUtilt = (f: number): Place => {
    const deg = tl(f, [
      [0, 0],
      [5, -12, 'inOut'],
      [8, 14, 'out'],
      [12, 15, 'inOut'],
      [18, -3],
      [24, 1],
      [30, 0],
    ]);
    const sy = tl(f, [
      [0, 1],
      [5, 0.93],
      [8, 1.16, 'out'],
      [13, 1.15],
      [18, 0.96],
      [24, 1.02],
      [30, 1],
    ]);
    return rock(STAND, deg, { sx: 1 - (sy - 1) * 0.4, sy });
  };

  const springPose = (lift: number) => ground(STAND, 8, { sx: 0.9, sy: 1.2, x: 2, lift });

  const sDownB = (f: number): Frame => {
    const v = tl(f, [
      [0, 1],
      [3, 0.9, 'out'],
      [9, 1.12, 'out'],
      [12, 1.14, 'in'],
      [13, 0.78, 'out'],
      [17, 1.04],
      [21, 0.99],
      [26, 1],
    ]);
    const lift = tl(f, [
      [3, 0],
      [9, 3, 'out'],
      [11, 4, 'in'],
      [13, 0],
    ]);
    const quake = tl(f, [
      [12, 0],
      [13, 1, 'out'],
      [18, 1, 'in'],
      [24, 0],
    ]);
    return {
      block: rest(STAND, { ...squash(STAND, 1 + (1 - v) * 0.8, v), lift }),
      fx: {
        hitA: f >= 13 && quake > 0.02 ? { sym: 'quake', x: 0, y: 0, sx: 1, sy: quake } : undefined,
        ...landing(0, STAND.hw, f - 13, 1.2, 14),
      },
    };
  };

  /**
   * Switch Bridge (up special): the block sinks onto the switch for 33 frames, springs up as the stone bridge tile
   * behind it flips up on its hinge (frame 34), and flies up stretched along its length over speed lines. The
   * simulation lifts the fighter 3 units a frame, so the tile, kept on the floor, is drawn that far below.
   */
  const sUpB = (f: number): Frame => {
    const v = tl(f, [
      [0, 1],
      [8, 0.9, 'out'],
      [29, 0.85],
      [33, 1.16, 'out'],
      [36, 1.2],
      [57, 1.14],
      [62, 1],
    ]);
    const below = Math.max(0, f - 33) * 3;
    const flip = tl(f, [
      [30, 0],
      [34, 1, 'out'],
      [40, 1, 'in'],
      [50, 0],
    ]);
    const hinge = -9;
    const deg = -100 * flip;
    const r = (deg * Math.PI) / 180;
    const tileShown = f >= 4 && f <= 50;
    const shudder = f >= 22 && f <= 32 ? (f % 2 ? 0.25 : -0.25) : 0;
    return {
      block: rest(STAND, { ...squash(STAND, 1 + (1 - v) * 0.7, v), x: shudder }),
      fx: {
        back: tileShown
          ? { sym: 'tile', x: hinge + 9 * Math.cos(r), y: below + 9 * Math.sin(r), rot: deg }
          : undefined,
        hitB:
          f >= 33 && f <= 57
            ? { sym: 'lines', x: 0, y: 0, sx: 1.4, sy: 1 + Math.min(f - 33, 6) * 0.15 }
            : undefined,
        dustA: puff(STAND.hw + 2, below, f - 34, 1, 1.25, 14),
        dustB: puff(-STAND.hw - 2, below, f - 34, -1, 1.25, 14),
        starA:
          f >= 34 && f <= 38
            ? { sym: 'ring', x: 0, y: below, sx: 0.8 + (f - 34) * 0.3, sy: 0.32 }
            : undefined,
      },
    };
  };

  const clips: Record<string, AnimClip> = {
    jab: bake(23, false, (f) => {
      if (S) {
        const deg = tl(f, [
          [0, 0],
          [2, -6, 'out'],
          [4, 20, 'out'],
          [5, 23],
          [7, 22, 'inOut'],
          [12, -3],
          [16, 1],
          [20, 0],
        ]);
        return {
          block: rock(F, deg),
          fx: {
            dustB: puff(-F.hw, 0, f - 12, -1, 0.6),
            starA: f >= 4 && f <= 6 ? { sym: 'spark', x: 13, y: -17, sx: 1.2, sy: 1.2 } : undefined,
          },
        };
      }
      const x = tl(f, [
        [0, 0],
        [2, -1, 'out'],
        [4, 4, 'out'],
        [8, 4, 'inOut'],
        [14, 0],
      ]);
      const deg = tl(f, [
        [0, 0],
        [2, 3, 'out'],
        [4, -17, 'out'],
        [6, -18],
        [9, -15, 'inOut'],
        [14, 2],
        [18, -0.5],
        [22, 0],
      ]);
      return {
        block: rock(F, deg, {
          x,
          sy: tl(f, [
            [2, 1],
            [4, 1.08],
            [9, 1.06],
            [14, 1],
          ]),
        }),
        fx: {
          dustA: puff(F.hw + x, 0, f - 13, 1, 0.6),
          starA: f >= 4 && f <= 6 ? { sym: 'spark', x: 15, y: -8, sx: 1.2, sy: 1.2 } : undefined,
        },
      };
    }),
    jab2: bake(31, false, (f) => {
      if (S) {
        const deg = tl(f, [
          [0, 0],
          [3, -9, 'out'],
          [5, 30, 'out'],
          [6, 33],
          [8, 32, 'inOut'],
          [15, -5],
          [20, 2],
          [25, 0],
        ]);
        return { block: rock(F, deg), fx: { dustB: puff(-F.hw, 0, f - 15, -1, 0.7) } };
      }
      const x = tl(f, [
        [0, 0],
        [3, -1.5, 'out'],
        [5, 5.5, 'out'],
        [9, 5.5, 'inOut'],
        [16, 0],
      ]);
      const deg = tl(f, [
        [0, 0],
        [3, 4, 'out'],
        [5, -19, 'out'],
        [7, -19.5],
        [10, -17, 'inOut'],
        [16, 2],
        [21, -0.5],
        [25, 0],
      ]);
      return {
        block: rock(F, deg, {
          x,
          sy: tl(f, [
            [3, 1],
            [5, 1.1],
            [10, 1.08],
            [16, 1],
          ]),
        }),
        fx: { dustA: puff(F.hw + x, 0, f - 15, 1, 0.7) },
      };
    }),
    ftilt: S
      ? bake(43, false, (f) => {
          const deg = tl(f, [
            [0, 0],
            [6, -10, 'inOut'],
            [7, -9, 'in'],
            [11, 73, 'in'],
            [12, 74],
            [16, 73, 'inOut'],
            [21, 53, 'inOut'],
            [34, -5, 'inOut'],
            [38, 2],
            [43, 0],
          ]);
          const sy = tl(f, [
            [0, 1],
            [6, 1.07],
            [7, 1.06],
            [11, 1],
            [12, 1.08, 'out'],
            [15, 0.99],
            [18, 1],
          ]);
          const sx = tl(f, [
            [11, 1],
            [12, 0.84, 'out'],
            [15, 1.04],
            [18, 1],
          ]);
          return {
            block: topple(F, deg, sx, sy),
            fx: {
              ...slamDust(f, 12, 30, 6),
              back: f >= 9 && f <= 13 ? { sym: 'sweep', x: 12, y: -6, sx: 0.95, sy: 0.5 } : undefined,
            },
          };
        })
      : bake(29, false, (f) => {
          const x = tl(f, [
            [0, 0],
            [4, -1.5, 'inOut'],
            [7, 6, 'in'],
            [12, 6, 'inOut'],
            [24, 0],
          ]);
          const deg = tl(f, [
            [0, 0],
            [5, -32, 'out'],
            [7, 0, 'in'],
            [29, 0],
          ]);
          const sx = tl(f, [
            [6, 1],
            [7, 0.84, 'out'],
            [10, 1.04],
            [13, 1],
          ]);
          const sy = tl(f, [
            [6, 1],
            [7, 1.08, 'out'],
            [10, 0.99],
            [13, 1],
          ]);
          return {
            block: rock(F, deg, { x, sx, sy }),
            fx: {
              ...slamDust(f, 7, x + F.hw * sy + 0.5, x - F.hw, 1),
              starA: f >= 7 && f <= 10 ? { sym: 'streak', x: 14, y: -5, sx: 0.7, sy: 0.65 } : undefined,
            },
          };
        }),
    utilt: bake(35, false, (f) => {
      if (S || f >= 8) {
        return {
          block: sUtilt(f),
          fx: {
            starA:
              f >= 8 && f <= 12 ? { sym: 'sweep', x: 1, y: -19, rot: -78, sx: 0.7, sy: 0.55 } : undefined,
          },
        };
      }
      const v =
        1 -
        0.12 *
          tl(f, [
            [0, 0],
            [4, 1, 'out'],
          ]);
      const start = rest(F, sq(F, v));
      return {
        block:
          f < 4
            ? start
            : groundBlend(
                start,
                sUtilt(8),
                tl(f, [
                  [4, 0, 'in'],
                  [8, 1],
                ]),
              ),
      };
    }),
    dtilt: bake(27, false, (f) => {
      if (S) {
        const deg = tl(f, [
          [0, 0],
          [4, -5, 'inOut'],
          [7, 78, 'in'],
          [10, 80],
          [12, 80, 'inOut'],
          [17, 30, 'inOut'],
          [22, -3],
          [27, 0],
        ]);
        const x = tl(f, [
          [10, 0],
          [13, 2.5, 'out'],
          [15, 2.5, 'inOut'],
          [21, 0],
        ]);
        const tipX = x + 6 + 24 * Math.sin((deg * Math.PI) / 180);
        return {
          block: rock(F, deg, { x }),
          fx: {
            dustA:
              f >= 7 && f <= 13
                ? { sym: 'spark', x: tipX + 0.5, y: -0.8, rot: f * 25, sx: 1.2, sy: 1.2 }
                : undefined,
            dustB: puff(tipX, 0, f - 8, 1, 0.8),
          },
        };
      }
      const x = tl(f, [
        [0, 0],
        [4, -2, 'inOut'],
        [7, 6, 'out'],
        [10, 6.5],
        [14, 6.5, 'inOut'],
        [24, 0],
      ]);
      const deg = tl(f, [
        [0, 0],
        [4, -3, 'inOut'],
        [7, 5, 'out'],
        [10, 5, 'inOut'],
        [14, 0],
      ]);
      return {
        block: rock(F, deg, { x }),
        fx: {
          dustA:
            f >= 7 && f <= 13
              ? { sym: 'spark', x: x + F.hw + 1, y: -0.8, rot: f * 25, sx: 1.2, sy: 1.2 }
              : undefined,
          dustB: puff(x - F.hw, 0, f - 7, -1, 0.7),
        },
      };
    }),
    dashAttack: bake(53, false, (a) => tumbling(F, a, TUMBLE)),
    fsmash: bake(65, false, (f) => {
      const fx: Frame['fx'] = {
        back:
          f >= 16 && f <= 19
            ? { sym: 'sweep', x: S ? 10 : 12, y: -12, rot: S ? 0 : -45, sx: 1.1, sy: 0.95 }
            : undefined,
        ...slamDust(f, 19, S ? 31 : 24, S ? 5 : 12, 1.6),
        hitB:
          f >= 19 && f < 28
            ? wave(
                (S ? 31 : 24) + (f - 19) * 0.55,
                tl(f, [
                  [19, 1, 'out'],
                  [28, 0],
                ]),
                1,
              )
            : undefined,
        starB:
          f >= 19 && f < 26
            ? {
                sym: 'ring',
                x: S ? 27 : 21,
                y: 0,
                sx: tl(f, [
                  [19, 0.6, 'out'],
                  [23, 1.4],
                  [26, 2],
                ]),
                sy: 0.24,
              }
            : undefined,
      };
      return { block: S ? sFsmash(f) : lFsmash(f), fx };
    }),
    usmash: bake(53, false, (f) => {
      const v =
        1 -
        0.18 *
          tl(f, [
            [0, 0],
            [8, 1, 'out'],
            [9, 1, 'in'],
            [11, 0],
          ]);
      const squat = rest(F, sq(F, v));
      const lift = tl(f, [
        [9, 0],
        [13, 4, 'out'],
        [17, 4.5, 'inOut'],
        [22, 0, 'in'],
      ]);
      const spring = springPose(lift);
      const fx: Frame['fx'] = {
        hitA:
          f >= 12 && f <= 18
            ? {
                sym: 'slam',
                x: 9.5,
                y: 0,
                sx: 1,
                sy: tl(f, [
                  [12, 0.7, 'out'],
                  [14, 1],
                  [18, 0.6],
                ]),
              }
            : undefined,
        starA:
          f >= 12 && f <= 19
            ? {
                sym: 'burst',
                x: -1 + 0.3 * (f - 12),
                y: -(lift + 31),
                sx: tl(f, [
                  [12, 0.5, 'out'],
                  [14, 0.9],
                  [19, 0.3],
                ]),
                sy: tl(f, [
                  [12, 0.5, 'out'],
                  [14, 0.9],
                  [19, 0.3],
                ]),
              }
            : undefined,
      };
      if (f < 9) return { block: squat };
      if (f < 13)
        return {
          block: groundBlend(
            squat,
            springPose(4),
            tl(f, [
              [9, 0, 'out'],
              [13, 1],
            ]),
            lift,
          ),
          fx,
        };
      if (f < 22) return { block: spring, fx };
      if (S) {
        const k = f - 22;
        return {
          block:
            k < 7
              ? groundBlend(
                  springPose(0),
                  settle(F, 0, {}, 1.3),
                  tl(k, [
                    [0, 0, 'out'],
                    [3, 1],
                  ]),
                )
              : settle(F, k - 3, {}, 1.3),
          fx: landing(0, F.hw, k - 1, 0.9),
        };
      }
      if (f < 32)
        return {
          block: groundBlend(
            springPose(0),
            rest(F),
            tl(f, [
              [22, 0, 'in'],
              [32, 1],
            ]),
          ),
        };
      return { block: settle(F, f - 32), fx: landing(0, F.hw, f - 32, 1) };
    }),
    dsmash: bake(55, false, (f) => {
      const waveX = 21 + (f - 13) * 1.2;
      const ws = tl(f, [
        [11, 0],
        [12, 0.4, 'out'],
        [15, 1],
        [19, 1, 'in'],
        [24, 0],
      ]);
      const fx: Frame['fx'] = {
        hitA: f >= 12 ? wave(waveX, ws, 1) : undefined,
        hitB: f >= 12 ? wave(-waveX, ws, -1) : undefined,
        ...landing(0, LIE.hw, f - 12, 1.3, 14),
      };
      const v = tl(f, [
        [0, 1],
        [7, 0.85, 'out'],
        [9, 1.08, 'out'],
        [11, 1.05, 'in'],
        [12, 0.78, 'out'],
        [16, 0.86, 'inOut'],
        [20, 1.03],
        [24, 0.99],
        [28, 1],
      ]);
      const lift = tl(f, [
        [7, 0],
        [9, 6, 'out'],
        [12, 0, 'in'],
      ]);
      if (!S) return { block: rest(F, { ...squash(F, 1 + (1 - v) * 0.8, v), lift }), fx };
      if (f < 7) return { block: rest(F, sq(F, v)) };
      if (f < 12)
        return {
          block: turnIn(
            F,
            tl(f, [
              [7, 0, 'inOut'],
              [11, 90],
            ]),
            1,
            1,
            0,
            lift,
          ),
          fx,
        };
      if (f < 34) return { block: turnIn(F, 90, 1 + (1 - v) * 0.8, v), fx };
      const k = f - 34;
      return {
        block: turnIn(
          F,
          tl(k, [
            [0, 90, 'inOut'],
            [10, 180],
          ]),
          1 + (1 - impact(k, 11, 0.1)) * 0.45,
          impact(k, 11, 0.1),
        ),
        fx: landing(0, F.hw, k - 11, 0.7),
      };
    }),
    getupAttack: bake(49, false, (f) => {
      const deg = tl(f, [
        [0, 0],
        [12, 0, 'in'],
        [16, 14, 'out'],
        [19, 12, 'inOut'],
        [21, 0, 'in'],
        [24, -14, 'out'],
        [27, -12, 'inOut'],
        [30, 0],
      ]);
      const sy = tl(f, [
        [12, 1],
        [16, 1.1],
        [27, 1.1],
        [30, 1],
      ]);
      const fx = { dustA: puff(13, 0, f - 16, 1, 0.7), dustB: puff(-13, 0, f - 24, -1, 0.7) };
      if (f < 30 || !S) return { block: f < 30 ? rock(LIE, deg, { sy }) : settle(LIE, f - 30, {}, 0.6), fx };
      const k = f - 30;
      return {
        block: turnIn(
          F,
          tl(k, [
            [0, 90, 'inOut'],
            [10, 180],
          ]),
          1 + (1 - impact(k, 11, 0.1)) * 0.45,
          impact(k, 11, 0.1),
        ),
        fx: landing(0, F.hw, k - 11, 0.7),
      };
    }),
    nair: bake(43, false, (f) => {
      const deg = tl(f, [
        [0, 0],
        [4, -8, 'inOut'],
        [7, 14, 'linear'],
        [24, 360, 'out'],
        [43, 360],
      ]);
      const y = S
        ? -12
        : tl(f, [
            [0, -6, 'out'],
            [5, -12],
            [26, -12, 'inOut'],
            [36, -6],
          ]);
      const p = spin(F, 0, y, deg);
      return {
        block: p,
        fx: {
          back:
            f >= 7 && f <= 22 ? { sym: 'sweep', x: 0, y, rot: deg + F.base, sx: 1.08, sy: 1.08 } : undefined,
        },
      };
    }),
    fair: bake(45, false, (f) => {
      if (S) {
        const deg = tl(f, [
          [0, 0],
          [6, -14, 'inOut'],
          [10, 48, 'in'],
          [13, 52],
          [16, 50, 'inOut'],
          [30, 0],
        ]);
        return {
          block: rock(F, deg, {
            sx: tl(f, [
              [6, 1],
              [10, 1.1],
              [16, 1.1],
              [30, 1],
            ]),
          }),
          fx: {
            starA:
              f >= 9 && f <= 14 ? { sym: 'sweep', x: 16, y: -10, rot: -38, sx: 0.8, sy: 0.8 } : undefined,
          },
        };
      }
      const deg = tl(f, [
        [0, 0],
        [6, 14, 'inOut'],
        [10, -42, 'in'],
        [13, -46],
        [16, -44, 'inOut'],
        [30, 0],
      ]);
      const x = tl(f, [
        [0, 0],
        [6, -1],
        [10, 5, 'in'],
        [16, 5, 'inOut'],
        [30, 0],
      ]);
      return {
        block: spin(F, x, -6, deg, {
          sy: tl(f, [
            [6, 1],
            [10, 1.08],
            [16, 1.08],
            [30, 1],
          ]),
        }),
      };
    }),
    bair: bake(39, false, (f) => {
      if (S) {
        const deg = tl(f, [
          [0, 0],
          [6, 10, 'inOut'],
          [9, -48, 'in'],
          [12, -52],
          [15, -50, 'inOut'],
          [28, 0],
        ]);
        return {
          block: rock(F, deg, {
            sx: tl(f, [
              [6, 1],
              [9, 1.1],
              [15, 1.1],
              [28, 1],
            ]),
          }),
          fx: {
            starA:
              f >= 8 && f <= 13 ? { sym: 'sweep', x: -16, y: -10, rot: 38, sx: -0.8, sy: 0.8 } : undefined,
          },
        };
      }
      const deg = tl(f, [
        [0, 0],
        [6, -14, 'inOut'],
        [9, 42, 'in'],
        [12, 46],
        [15, 44, 'inOut'],
        [28, 0],
      ]);
      const x = tl(f, [
        [0, 0],
        [6, 1],
        [9, -5, 'in'],
        [15, -5, 'inOut'],
        [28, 0],
      ]);
      return {
        block: spin(F, x, -6, deg, {
          sy: tl(f, [
            [6, 1],
            [9, 1.08],
            [15, 1.08],
            [28, 1],
          ]),
        }),
      };
    }),
    uair: bake(41, false, (f) => {
      const lift = tl(f, [
        [0, 0],
        [5, -2, 'inOut'],
        [8, 6, 'out'],
        [12, 6.5, 'inOut'],
        [18, 0],
      ]);
      const sy = tl(f, [
        [0, 1],
        [5, 0.9],
        [8, 1.12, 'out'],
        [12, 1.1],
        [18, 1],
      ]);
      const pitch = tl(f, [
        [0, 0],
        [5, 8, 'out'],
        [9, -16],
        [13, -15],
        [22, 0],
      ]);
      const up = spin(STAND, 2 * (pitch / 16), -(lift + 12 * sy), pitch, { sx: 1 - (sy - 1) * 0.4, sy });
      const lines =
        f >= 7 && f <= 13 ? { sym: 'sweep', x: 0, y: -lift - 20, rot: -84, sx: 0.72, sy: 0.55 } : undefined;
      if (S) return { block: up, fx: { back: lines } };
      const u = tl(f, [
        [0, 0, 'inOut'],
        [6, 1],
        [22, 1, 'inOut'],
        [32, 0],
      ]);
      const flat = spin(F, 0, -6, 0);
      const turn = (pitch - 90) * u;
      const [cx, cy] = centre(up);
      return {
        block: {
          ...flat,
          px: cx * u,
          py: -6 + (cy + 6) * u,
          rot: turn,
          sx: up.sx * u + (1 - u),
          sy: up.sy * u + (1 - u),
        },
        fx: { back: lines },
      };
    }),
    dair: bake(57, false, (f) => {
      const drop = tl(f, [
        [0, 0],
        [8, -3, 'inOut'],
        [15, 4.5, 'in'],
        [18, 5, 'out'],
        [26, 4, 'inOut'],
        [34, 0],
      ]);
      const sy = tl(f, [
        [0, 1],
        [8, 0.92],
        [15, 1.12, 'in'],
        [18, 1.1],
        [26, 1.05],
        [34, 1],
      ]);
      const pitch = tl(f, [
        [0, 0],
        [8, 13, 'in'],
        [16, 19],
        [22, 13],
        [34, 0],
      ]);
      const down = spin(STAND, 3 * (pitch / 19), drop - 12 * sy, pitch, { sx: 1 - (sy - 1) * 0.4, sy });
      const lines =
        f >= 12 && f <= 22 ? { sym: 'sweep', x: 0, y: drop - 7, rot: 80, sx: 0.85, sy: 0.6 } : undefined;
      if (S) return { block: down, fx: { back: lines } };
      const u = tl(f, [
        [0, 0, 'inOut'],
        [8, 1],
        [34, 1, 'inOut'],
        [46, 0],
      ]);
      const [cx, cy] = centre(down);
      return {
        block: {
          ...spin(F, 0, -6, 0),
          px: cx * u,
          py: -6 + (cy + 6) * u,
          rot: (pitch - 90) * u,
          sx: down.sx * u + (1 - u),
          sy: down.sy * u + (1 - u),
        },
        fx: { back: lines },
      };
    }),
    grab: bake(39, false, (f) =>
      S
        ? {
            block: rock(
              F,
              tl(f, [
                [0, 0],
                [5, -6, 'inOut'],
                [8, 24, 'out'],
                [10, 26],
                [16, 24, 'inOut'],
                [24, 8],
                [34, 0],
              ]),
            ),
          }
        : {
            block: rock(
              F,
              tl(f, [
                [0, 0],
                [5, -12, 'out'],
                [8, 4, 'in'],
                [10, 4],
                [16, 2, 'inOut'],
                [28, 0],
              ]),
            ),
          },
    ),
    dashGrab: bake(47, false, (f) =>
      S
        ? {
            block: rock(
              F,
              tl(f, [
                [0, 0],
                [6, -6, 'inOut'],
                [10, 34, 'out'],
                [12, 36],
                [18, 34, 'inOut'],
                [28, 8],
                [40, 0],
              ]),
            ),
          }
        : {
            block: rock(
              F,
              tl(f, [
                [0, 0],
                [6, -14, 'out'],
                [10, 4, 'in'],
                [12, 4],
                [18, 2, 'inOut'],
                [32, 0],
              ]),
              {
                x: tl(f, [
                  [6, 0],
                  [10, 2, 'out'],
                  [18, 2, 'inOut'],
                  [32, 0],
                ]),
              },
            ),
          },
    ),
    pivotGrab: bake(43, false, (f) =>
      S
        ? {
            block: rock(
              F,
              tl(f, [
                [0, 0],
                [7, -6, 'inOut'],
                [11, 38, 'out'],
                [13, 40],
                [20, 36, 'inOut'],
                [30, 8],
                [42, 0],
              ]),
            ),
          }
        : {
            block: rock(
              F,
              tl(f, [
                [0, 0],
                [7, -14, 'out'],
                [11, 4, 'in'],
                [13, 4],
                [20, 2, 'inOut'],
                [34, 0],
              ]),
              {
                x: tl(f, [
                  [7, 0],
                  [11, 2, 'out'],
                  [20, 2, 'inOut'],
                  [34, 0],
                ]),
              },
            ),
          },
    ),
    pummel: bake(8, false, (f) => ({
      block: rock(
        F,
        (S ? 22 : -10) +
          (S ? 6 : 5) *
            tl(f, [
              [0, 0, 'out'],
              [2, 1, 'inOut'],
              [8, 0],
            ]),
      ),
    })),
    fthrow: bake(35, false, (f) => {
      const deg = S
        ? tl(f, [
            [0, 22, 'inOut'],
            [10, -8, 'inOut'],
            [16, 60, 'in'],
            [18, 64],
            [30, 0, 'inOut'],
          ])
        : tl(f, [
            [0, -10, 'inOut'],
            [10, -18, 'inOut'],
            [16, 18, 'in'],
            [18, 20],
            [30, 0, 'inOut'],
          ]);
      return { block: rock(F, deg), fx: { dustA: puff(S ? 22 : 12, 0, f - 16, 1, 0.9) } };
    }),
    bthrow: bake(51, false, (f) => {
      const deg = S
        ? tl(f, [
            [0, 22, 'inOut'],
            [8, 0, 'in'],
            [24, -88, 'in'],
            [26, -90],
            [32, -90, 'inOut'],
            [44, 3, 'inOut'],
            [51, 0],
          ])
        : tl(f, [
            [0, -10, 'inOut'],
            [8, 0, 'in'],
            [22, -88, 'in'],
            [26, -90],
            [32, -90, 'inOut'],
            [44, 3, 'inOut'],
            [51, 0],
          ]);
      const thick =
        1 -
        0.14 *
          tl(f, [
            [25, 0],
            [26, 1, 'out'],
            [30, 0],
          ]);
      const reach = S ? -6 - 24 : -12 - 12;
      return {
        block: rock(F, deg, { sx: S ? thick : 1, sy: S ? 1 : thick }),
        fx: slamDust(f, 26, reach - 1, -F.hw, 1.1),
      };
    }),
    uthrow: bake(43, false, (f) => {
      if (S) {
        const v = tl(f, [
          [0, 1],
          [12, 0.86, 'out'],
          [18, 1.18, 'out'],
          [20, 1.16],
          [26, 0.9, 'in'],
          [30, 1.03],
          [36, 1],
        ]);
        const lift = tl(f, [
          [12, 0],
          [18, 2, 'out'],
          [22, 2, 'in'],
          [26, 0],
        ]);
        return {
          block: rest(F, { ...squash(F, 1 - (v - 1) * 0.5, v), lift }),
          fx: landing(0, F.hw, f - 26, 0.8),
        };
      }
      const turn = tl(f, [
        [0, 0],
        [10, 6, 'inOut'],
        [18, -90, 'out'],
        [26, -90, 'inOut'],
        [36, -180, 'in'],
      ]);
      const v =
        1 -
        0.1 *
          tl(f, [
            [35, 0],
            [36, 1, 'out'],
            [42, 0],
          ]);
      return { block: turnIn(F, turn, 1 + (1 - v) * 0.4, v), fx: landing(0, F.hw, f - 36, 0.8) };
    }),
    dthrow: bake(43, false, (f) => {
      if (S) {
        const deg = tl(f, [
          [0, 22, 'inOut'],
          [10, -6, 'inOut'],
          [21, 86, 'in'],
          [22, 88],
          [28, 88, 'inOut'],
          [38, 0, 'inOut'],
        ]);
        const thick =
          1 -
          0.14 *
            tl(f, [
              [21, 0],
              [22, 1, 'out'],
              [26, 0],
            ]);
        return { block: rock(F, deg, { sx: thick }), fx: slamDust(f, 22, 30, 6) };
      }
      const v = tl(f, [
        [0, 1],
        [10, 0.9, 'out'],
        [14, 1.08],
        [21, 1.05, 'in'],
        [22, 0.8, 'out'],
        [27, 1.03],
        [32, 1],
      ]);
      const lift = tl(f, [
        [10, 0],
        [15, 5, 'out'],
        [22, 0, 'in'],
      ]);
      return {
        block: rest(F, { ...squash(F, 1 + (1 - v) * 0.6, v), lift }),
        fx: landing(0, F.hw, f - 22, 1),
      };
    }),
    sideB: bake(58, false, (a) => tumbling(F, a, ROLL)),
    upB: bake(62, false, (f) => {
      if (S || f >= 4) return sUpB(f);
      return {
        block: turnIn(
          F,
          tl(f, [
            [0, 0, 'in'],
            [3, -90],
          ]),
          1,
          tl(f, [
            [0, 1],
            [3, 1.05],
          ]),
        ),
      };
    }),
    downB: bake(47, false, (f) => {
      if (S || f >= 4) return sDownB(f);
      return {
        block: turnIn(
          F,
          tl(f, [
            [0, 0, 'in'],
            [3, -90],
          ]),
          1,
          tl(f, [
            [0, 1],
            [3, 1.05],
          ]),
        ),
      };
    }),
  };
  const windows = S ? ACTIVE : LYING_ACTIVE;
  return Object.fromEntries(
    Object.entries(clips).map(([name, clip]) => [name, { ...clip, active: windows[name]! }]),
  );
}
