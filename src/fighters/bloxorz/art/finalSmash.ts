import type { BonePose } from '../../../render/rig/types';
import { BARRAGE, SPLIT } from '../finalSmashData';
import type { MoveClip } from './attacks';
import {
  bake,
  landing,
  puff,
  rest,
  rock,
  settle,
  squash,
  tl,
  STAND,
  type Cube,
  type Form,
  type Frame,
  type Fx,
} from './bake';
import { turnIn } from './clips';
import { LEVEL_TILES } from './rig';
import { HALF_W } from './symbols';

/**
 * Split Switch, the Final Smash (src/fighters/bloxorz/finalSmash.ts), on Jungle Rush's frames, each clip lasting its
 * move's FAF - 1 so it plays frame for frame.
 *
 * The activation: the block stands on a split switch, its "( )" sign flashing over it and rings pulsing out from its
 * base through the freeze, rears back and topples flat on frame 28, its far end landing on the punch's reach from
 * 29 to 34. On a miss it lies there and rocks back up by frame 99. Lying, it first stands up (frames 0-4).
 *
 * The cinematic, with the catch held about 11 units in front (the engine's hold: half of both widths plus 1): the
 * punch lands on frame 1 and the catch slides in over the toppled block, which draws under every fighter until it
 * splits (TOPPLED), so the catch stays in view. The level's tiles flip up out of the floor in a wave from the block, and the block splits
 * into its two cubes, one either side of the catch. They take turns rocking their top corners into it on the 31
 * barrage frames, then the far cube hops back over it onto the near one, the block re-forms, jumps and slams the
 * heavy switch on frame 139: the bridge tile under the catch flips up on its hinge and flings it. The tiles then fall
 * away, as a Bloxorz level does when it is finished.
 */

const F = STAND;

/**
 * Activation frames on which the block lies toppled (falling over from 25, back up by 85): it draws in its `under`
 * slots, under every fighter, as it does through the punch, so the foe it lands on stays in view over it. The cubes,
 * tiles and effects stay in the block's own layer, over everyone (a Final Smash user draws on top).
 */
export const TOPPLED: [number, number] = [25, 85];

/** Where the cubes stand through the barrage: either side of a catch held 11 units in front. */
const CUBE_A = -1;
const CUBE_B = 23;

/** Every barrage hit's frame, in order: even ones are the near cube's (A), odd ones the far cube's (B). */
const HITS = [...BARRAGE.fast, ...BARRAGE.late];

/** The level tiles' centres, one cube apart: lt0 five tiles behind the block, lt6 under it, lt7 under the catch. */
const TILE_X = LEVEL_TILES.map((_, i) => 12 * (i - 5));
const BRIDGE = 6;

/** A cube standing on the floor at `x`, rocked `deg` about its bottom corner on the side it rocks to (y down). */
function rockedCube(x: number, deg: number, v = 1): Cube {
  const side = deg >= 0 ? 1 : -1;
  const px = x + side * HALF_W;
  const r = (deg * Math.PI) / 180;
  const [ox, oy] = [-side * HALF_W, -HALF_W * v];
  return {
    x: px + ox * Math.cos(r) - oy * Math.sin(r),
    y: ox * Math.sin(r) + oy * Math.cos(r),
    rot: deg,
    sx: 1 + (1 - v) * 0.5,
    sy: v,
  };
}

/** A cube in flight: centre (x, y), turned `rot`. */
const flying = (x: number, y: number, rot: number): Cube => ({ x, y, rot });

/**
 * One cube's rock into the catch around its hit on frame `h`, `t` frames from it: a pull back, the strike on the hit
 * frame and a recoil. The late hits strike harder. Zero outside it.
 */
function strike(t: number, late: boolean): number {
  const hard = late ? 1.18 : 1;
  return tl(t, [
    [-2, 0],
    [-1, -12 * hard, 'in'],
    [0, 36 * hard, 'out'],
    [1, 30 * hard],
    [4, 0],
  ]);
}

/** The rock of the cube whose hits are those at `parity` (0 near, 1 far) on frame `f`, and how long since it struck. */
function cubeRock(f: number, parity: 0 | 1): { deg: number; since: number } {
  let deg = 0;
  let since = Infinity;
  HITS.forEach((h, i) => {
    if (i % 2 !== parity) return;
    const t = f - h;
    if (t >= -2 && t <= 4) deg = strike(t, h >= BARRAGE.late[0]!);
    if (t >= 0) since = t;
  });
  return { deg, since };
}

/** A spark where a cube's corner meets the catch, flaring on its hit and gone in 4 frames. */
function spark(x: number, y: number, since: number, late: boolean): Fx | undefined {
  if (since > 3) return undefined;
  const s = (late ? 1.5 : 1.2) * (1 - since / 4) + 0.2;
  return {
    sym: since === 0 ? 'burst' : 'spark',
    x,
    y,
    sx: since === 0 ? s * 0.5 : s,
    sy: since === 0 ? s * 0.5 : s,
  };
}

/**
 * The level tiles on cinematic frame `f`: hidden until they flip up out of the floor on the hinge nearest the block
 * (the one under it rises straight up), the bridge tile flinging the catch on its far hinge, then the fall away.
 */
function level(f: number): Frame['extra'] {
  const pose: Record<string, BonePose> = {};
  const swaps: Record<string, string | null> = {};
  const half = HALF_W - 0.2;
  TILE_X.forEach((cx, i) => {
    const name = LEVEL_TILES[i]!;
    const k = i - 5;
    const from = 2 + 2 * Math.abs(k);
    const drop = 158 + 3 * (6 - Math.abs(k));
    if (f < from || f >= drop + 10) {
      swaps[name] = null;
      return;
    }
    const side = k >= 0 ? 1 : -1;
    const up = tl(f, [
      [from, 0, k === 0 ? 'out' : 'outBack'],
      [from + 7, 1],
    ]);
    const fling = i === BRIDGE && f >= BARRAGE.finish - 1;
    // A turn of `deg` about a hinge `arm` units from the tile's centre (negative: its near edge).
    const [deg, arm] = fling
      ? [
          tl(f, [
            [BARRAGE.finish - 1, 0],
            [BARRAGE.finish, 60, 'out'],
            [BARRAGE.finish + 4, 100],
            [BARRAGE.finish + 9, 100, 'in'],
            [BARRAGE.finish + 17, 0],
          ]),
          half,
        ]
      : [k === 0 ? 0 : side * 90 * (1 - up), k === 0 ? 0 : -side * half];
    const r = (deg * Math.PI) / 180;
    let y = -arm * Math.sin(r) + (k === 0 ? 2.4 * (1 - up) : 0);
    let rot = deg;
    let s = 1;
    // Falling away into the void, turning and shrinking.
    const t = f - drop;
    if (t >= 0) {
      y += 0.08 * t * t;
      rot += side * 2 * t;
      s = 1 - t / 10;
    }
    pose[name] = { x: cx + arm - arm * Math.cos(r), y, rot, sx: s, sy: s };
    swaps[name] = 'levelTile';
  });
  return { pose, swaps };
}

/** The activation from the standing block (or a lying one stood up), frame `f`. */
function activation(f: number): Frame {
  const deg = tl(f, [
    [0, 0],
    [8, 0, 'inOut'],
    [16, -3, 'inOut'],
    [23, -14, 'inOut'],
    [25, -12, 'in'],
    [28, 90],
    [60, 90, 'inOut'],
    [82, -4, 'inOut'],
    [90, 2, 'inOut'],
    [96, 0],
  ]);
  // Squashing onto the switch through the freeze, then the slam: thinner across, stretched along it.
  const press = tl(f, [
    [3, 1],
    [7, 0.92, 'out'],
    [12, 0.97, 'inOut'],
    [22, 1.04],
    [25, 1.06],
  ]);
  const slam = tl(f, [
    [27, 1],
    [28, 0.88, 'out'],
    [31, 1.03, 'inOut'],
    [35, 1],
  ]);
  const shudder = f >= 9 && f <= 21 ? (f % 2 ? 0.22 : -0.22) : 0;
  const sx = f < 27 ? 1 + (1 - press) * 0.6 : slam;
  const sy = f < 27 ? press : 1 + (1 - slam) * 0.3;
  const glyph = f >= 3 && f <= 24;
  const pulse = (at: number) => (f >= at && f < at + 7 ? (f - at) / 7 : -1);
  const ring = [4, 11, 18].map(pulse).find((u) => u >= 0);
  const block = rock(F, deg, { sx, sy, x: shudder });
  return {
    block,
    under: f >= TOPPLED[0] && f <= TOPPLED[1],
    fx: {
      starB: glyph
        ? {
            sym: 'splitGlyph',
            x: 0,
            y: -31 - Math.sin(f * 0.6) * 0.6,
            sx: 1 + 0.12 * Math.sin(f * 0.9),
            sy: 1,
          }
        : undefined,
      starA:
        ring !== undefined
          ? { sym: 'ring', x: 0, y: 1, sx: 0.7 + ring * 0.9, sy: (0.7 + ring * 0.9) * 0.3 }
          : f >= 28 && f <= 33
            ? { sym: 'burst', x: 27, y: -7, sx: 0.5 + (f - 28) * 0.18, sy: 0.5 + (f - 28) * 0.18 }
            : undefined,
      dustA: puff(31, 0, f - 28, 1, 1.3, 14),
      dustB: puff(7, 0, f - 28, -1, 0.9, 12),
      back: f >= 25 && f <= 28 ? { sym: 'swing', x: HALF_W, y: 0 } : undefined,
    },
  };
}

/** The cinematic, frame `f`. */
function cinematic(f: number): Frame {
  const extra = level(f);
  // The punch: the toppled block on the catch, held through the punch's hitlag while the catch slides in over it.
  if (f <= 1) {
    return {
      block: rock(F, 90, { sx: 0.9, sy: 1.03 }),
      under: true,
      fx: {
        starA: f === 1 ? { sym: 'burst', x: 11, y: -9, sx: 1.25, sy: 1.25 } : undefined,
        ...landing(18, 12, f, 1.2, 14),
      },
      extra,
    };
  }
  // The split: the halves pop apart, the near cube hopping back past the catch.
  if (f <= 5) {
    const u = tl(f, [
      [2, 0, 'out'],
      [5, 1],
    ]);
    const a = flying(12 + (CUBE_A - 12) * u, -6 - 10 * Math.sin(Math.PI * u), -90 * u);
    const b = flying(24 + (CUBE_B - 24) * u, -6 - 3 * Math.sin(Math.PI * u), 0);
    return {
      block: rest(F),
      cubes: [a, b],
      fx: {
        starB: { sym: 'burst', x: 18, y: -7, sx: 0.5 + (f - 2) * 0.25, sy: 0.5 + (f - 2) * 0.25 },
        ...landing(CUBE_A, HALF_W, f - 5, 0.7),
      },
      extra,
    };
  }
  // The barrage: each cube rocks its top corner into the catch on its turn.
  if (f < 128) {
    const a = cubeRock(f, 0);
    const b = cubeRock(f, 1);
    const late = f >= BARRAGE.late[0]!;
    const bounce = (since: number) =>
      1 -
      0.1 *
        tl(since, [
          [0, 1, 'out'],
          [2, 0],
        ]);
    return {
      block: rest(F),
      cubes: [rockedCube(CUBE_A, a.deg, bounce(a.since)), rockedCube(CUBE_B, -b.deg, bounce(b.since))],
      fx: {
        starA: spark(7.5, -10, a.since, late),
        starB: spark(14.5, -10, b.since, late),
        dustA: puff(CUBE_A + HALF_W, 0, a.since, -1, 0.55, 8),
        dustB: puff(CUBE_B - HALF_W, 0, b.since, 1, 0.55, 8),
      },
      extra,
    };
  }
  // The rejoin: the far cube hops back over the catch onto the near one.
  if (f < 135) {
    const u = tl(f, [
      [128, 0, 'inOut'],
      [134, 1],
    ]);
    return {
      block: rest(F),
      cubes: [
        flying(CUBE_A + (0 - CUBE_A) * u, -6, 0),
        flying(CUBE_B * (1 - u), -6 - 12 * u - 16 * Math.sin(Math.PI * u), -180 * u),
      ],
      fx: {},
      extra,
    };
  }
  // The heavy switch: the re-formed block jumps and slams down, and the bridge tile flips the catch away.
  const lift = tl(f, [
    [135, 0, 'out'],
    [137, 6, 'in'],
    [BARRAGE.finish, 0],
  ]);
  const block =
    f < BARRAGE.finish
      ? rest(F, { ...squash(F, 1 - (f === 135 ? 0.12 : 0), 1 + (f === 135 ? 0.12 : 0.06)), lift })
      : settle(F, f - BARRAGE.finish, {}, 1.6);
  const flare = f - BARRAGE.finish;
  return {
    block,
    fx: {
      starB:
        f <= 137
          ? { sym: 'burst', x: 0, y: -12, sx: 0.9 - (f - 135) * 0.25, sy: 0.9 - (f - 135) * 0.25 }
          : undefined,
      starA:
        flare >= 0 && flare < 8
          ? { sym: 'ring', x: 12, y: 0, sx: 0.8 + flare * 0.3, sy: 0.3 + flare * 0.1 }
          : undefined,
      hitB:
        flare >= 0 && flare < 7 ? { sym: 'lines', x: 13, y: -14 - 4 * flare, sx: 1.4, sy: 1.2 } : undefined,
      ...landing(0, F.hw, flare, 1.3, 14),
    },
    extra,
  };
}

/** Lying, the block turns up onto its end over frames 0-4 (as Heavy Switch does), then plays the standing clip. */
function standUp(form: Form, f: number, then: (f: number) => Frame): Frame {
  if (form === STAND || f >= SPLIT.standUp) return then(f);
  return {
    block: turnIn(
      form,
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
}

export function finalSmashClips(form: Form): Record<string, MoveClip> {
  return {
    finalSmash: {
      ...bake(SPLIT.faf - 1, false, (f) => standUp(form, f, activation)),
      active: [[...SPLIT.catch]],
    },
    finalSmashCinematic: {
      ...bake(BARRAGE.faf - 1, false, cinematic),
      active: [[BARRAGE.finish, BARRAGE.finish]],
    },
  };
}
