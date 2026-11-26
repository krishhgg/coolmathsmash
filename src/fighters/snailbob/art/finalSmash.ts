import type { Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { SHIP } from '../finalSmash';
import {
  DAZED,
  DETERMINED,
  HAPPY,
  STAND,
  STARTLED,
  WIDE,
  add,
  at,
  key,
  look,
  mix,
  stalks,
  type Pt,
} from './poses';
import { BEAM, MUZZLE } from './ship';
import {
  FLINCH,
  PRESS,
  PRESSED,
  PROUD,
  REMOTE_ON,
  REMOTE_Z,
  SKYWARD,
  TRACK,
  WIND,
  holding,
} from './specials';

/**
 * Shell Ship, the Final Smash (src/fighters/snailbob/finalSmash.ts), keyed to its moves like specials.ts: frame 1 is
 * the move's first frame, each clip lasts FAF - 1, and its `active` window is the catch (the swoop's boxes) or the
 * launch (the cinematic's throw). Bob calls his spaceship with Crate Drop's crane remote through the activation
 * freeze; it dives in from behind him and swoops through the stage in front of him on the catch frames, its streak
 * filling the Blue Falcon's three boxes. A whiff climbs away and Bob slumps. A catch plays the cinematic: the ship
 * banks round, hovers over the victim held in front of him, charges and lasers them (the second hold hit), then turns
 * back and rams them in a blast (the launch) while Bob cheers. The ship is drawn on fx4 behind him, the laser on fx2,
 * the hits on fx3.
 */

/** Where the held victim's middle is drawn: a hold's reach in front of Bob (Mario's width), half a Mario up. */
const VICTIM: Pt = [11, -7];

/** How big the ship flies: about the height of the Blue Falcon's boxes, 31 units nose to tail. */
const SHIP_SIZE = 1.3;

/**
 * The ship's place: its middle at (x, y), turned `rot` degrees clockwise, facing left when `flip`, scaled `s` times
 * SHIP_SIZE.
 */
interface ShipAt {
  x: number;
  y: number;
  rot: number;
  flip?: boolean;
  s?: number;
}

const shipPose = (p: ShipAt): Pose => {
  const s = (p.s ?? 1) * SHIP_SIZE;
  return { fx4: at(p.x, p.y, p.rot, [(p.flip ? -1 : 1) * s, s]) };
};

/** A point of the ship (ship space) in rig space, for where `p` puts it. */
function shipPoint(p: ShipAt, [lx, ly]: Pt): Pt {
  const s = (p.s ?? 1) * SHIP_SIZE;
  const r = (p.rot * Math.PI) / 180;
  const u = lx * s * (p.flip ? -1 : 1);
  const v = ly * s;
  return [p.x + u * Math.cos(r) - v * Math.sin(r), p.y + u * Math.sin(r) + v * Math.cos(r)];
}

/** The laser on fx2 from the ship's muzzle to `to`, `w` times its drawn width. */
function beam(p: ShipAt, to: Pt, w = 1): Pose {
  const [mx, my] = shipPoint(p, MUZZLE);
  const len = Math.hypot(to[0] - mx, to[1] - my);
  const deg = (Math.atan2(to[1] - my, to[0] - mx) * 180) / Math.PI;
  return { fx2: at(mx, my, deg, [len / BEAM, w]) };
}

/** Bob, remote in hand, looking up behind him for the ship. */
const CALL: Pose = mix(
  { shell: { rot: -5 }, neck: { rot: -10 }, head: { rot: -8 } },
  stalks(-16, -8, -12, -6, 1.04),
  look(-0.35, -0.5),
);
/** Watching it pass over his head. */
const OVERHEAD: Pose = mix(
  { neck: { rot: -6 }, head: { rot: -6 } },
  stalks(-6, -12, -2, -10, 1.06),
  look(0, -0.6),
);
/** Following it along the stage. */
const FOLLOW: Pose = mix(TRACK, look(0.5, -0.15));
/** A whiff: slumped, stalks drooping, looking down at the remote. */
const AW: Pose = mix(
  { shell: { y: 0.35, rot: 3 }, neck: { rot: 12, sy: 0.9 }, head: { rot: 8 } },
  stalks(10, 16, 12, 16, 0.88),
  look(0.25, 0.35),
);
/** Cheering the blast: stretched up, stalks thrown back. */
const CHEER: Pose = mix(
  { body: { sy: 1.05 }, shell: { rot: -6, y: -0.3 }, neck: { rot: -10, sy: 1.06 }, head: { rot: -6 } },
  stalks(-12, -16, -8, -14, 1.08),
  look(0.35, -0.3),
);
const GLEE = { ...WIDE, mouth: 'grin' };

/** Bob with the remote up, gripped at (x, y) tilted `deg`, over `base`. */
const remote = (base: Pose, x: number, y: number, deg: number, s?: number): Pose =>
  holding(base, x, y, deg, s);

/* ---------------------------------------------------------------- the activation */

/** The swoop: where the ship is on each frame from its dive in behind Bob to the catch and on (y up is negative). */
const SWOOP: [number, ShipAt][] = [
  [16, { x: -84, y: -74, rot: 30 }],
  [22, { x: -46, y: -46, rot: 27 }],
  [25, { x: -18, y: -25, rot: 16 }],
  [27, { x: 13, y: -13.5, rot: 4 }],
  [28, { x: 30, y: -12, rot: 0 }],
  [29, { x: 44, y: -12, rot: 0 }],
  [30, { x: 58, y: -12.5, rot: -2 }],
  [31, { x: 72, y: -14.5, rot: -6 }],
  [34, { x: 104, y: -30, rot: -22 }],
  [40, { x: 140, y: -66, rot: -32 }],
];
const shipAt = (frame: number): ShipAt => SWOOP.find(([f]) => f === frame)![1];

/** The ship's symbol through the swoop: streaking (shipSwoop) from just before the catch until it pulls up. */
const SHIP_ON = { fxBack: 'ship' };
const STREAK = { fxBack: 'shipSwoop' };

function activation(): AnimClip {
  const keys: Key[] = [
    key(0, STAND, { ease: 'out' }),
    key(3, remote(PROUD, 8.0, -3.9, -8, 0.4), {
      ease: 'out',
      swaps: { ...DETERMINED, ...REMOTE_ON },
      z: REMOTE_Z,
    }),
    key(6, remote(PROUD, 8.8, -4.3, -4, 1.62), { ease: 'inOut' }),
    key(9, remote(WIND, 8.3, -5.1, -12), { ease: 'in' }),
    key(12, remote(PRESS, 9.1, -3.9, 4), { ease: 'out', swaps: { ...DETERMINED, ...PRESSED, fx3: 'pow' } }),
    key(13, undefined, { swaps: { ...DETERMINED, ...PRESSED, fx3: 'pow', fx2: 'signal' } }),
    key(14, undefined, { swaps: { ...DETERMINED, ...PRESSED, fx2: 'signal' } }),
  ];
  /** Bob's pose under the ship's key on `frame`. */
  const bob: Record<number, Pose> = {
    16: remote(CALL, 8.6, -4.6, -10),
    22: remote(CALL, 8.4, -4.8, -12),
    25: remote(OVERHEAD, 8.6, -4.8, -8),
    27: remote(FOLLOW, 8.8, -4.4, -4),
    28: remote(FOLLOW, 8.8, -4.4, -4),
    29: remote(add(FOLLOW, look(0.05, 0)), 8.8, -4.4, -4),
    30: remote(add(FOLLOW, look(0.1, 0)), 8.8, -4.4, -4),
    31: remote(add(FOLLOW, look(0.1, -0.1)), 8.8, -4.5, -6),
    34: remote(SKYWARD, 8.6, -4.7, -8),
    40: remote(SKYWARD, 8.6, -4.7, -8),
  };
  for (const [f, p] of SWOOP) {
    const swaps =
      f === 16
        ? { ...WIDE, mouth: 'grin', ...REMOTE_ON, ...SHIP_ON }
        : f === 26 || f === 27
          ? { ...WIDE, mouth: 'grin', ...REMOTE_ON, ...STREAK }
          : f === 34
            ? { ...WIDE, mouth: 'grin', ...REMOTE_ON, ...SHIP_ON }
            : undefined;
    keys.push(key(f, mix(bob[f]!, shipPose(p)), { ease: 'linear', ...(swaps && { swaps }) }));
  }
  keys.splice(
    keys.findIndex((k) => k.frame === 27),
    0,
    key(26, undefined, { swaps: { ...WIDE, mouth: 'grin', ...REMOTE_ON, ...STREAK } }),
  );
  keys.push(
    key(41, undefined, { swaps: { ...WIDE, mouth: 'grin', ...REMOTE_ON, fxBack: null } }),
    key(46, remote(AW, 8.4, -3.8, 6), { ease: 'inOut', swaps: { ...DAZED, ...REMOTE_ON } }),
    key(60, remote(add(AW, { shell: { rot: 1 } }), 8.3, -3.7, 8), { ease: 'inOut' }),
    key(66, remote(PROUD, 9.0, -4.2, 0), {
      ease: 'in',
      swaps: { ...HAPPY, mouth: 'grinClosed', ...REMOTE_ON },
    }),
    key(68, remote(PROUD, 8.8, -3.6, 4, 0.3), { ease: 'in' }),
    key(69, undefined, { swaps: { ...HAPPY, mouth: 'grinClosed' }, z: {} }),
    key(SHIP.faf - 1, STAND),
  );
  return { length: SHIP.faf - 1, active: [SHIP.catch], swaps: HAPPY, keys };
}

/* ---------------------------------------------------------------- the cinematic */

/** The ship's flight through the cinematic: out, round, hovering over the victim, round again and into them. */
const LOOP: [number, ShipAt, Record<string, string | null>?][] = [
  [0, shipAt(28), STREAK],
  [1, shipAt(29)],
  [2, shipAt(30)],
  [3, shipAt(31)],
  [4, { x: 84, y: -19, rot: -12 }, SHIP_ON],
  [7, { x: 108, y: -38, rot: -30 }],
  [11, { x: 126, y: -72, rot: -48 }],
  [12, { x: 126, y: -72, rot: -48 }, { fxBack: null }],
  [17, { x: 112, y: -96, rot: -28, flip: true }, SHIP_ON],
  [25, { x: 66, y: -66, rot: -22, flip: true }],
  [33, { x: 34, y: -40, rot: -26, flip: true }],
  [40, { x: 27, y: -33, rot: -32, flip: true }],
  [45, { x: 27.5, y: -34.5, rot: -33, flip: true }],
  [SHIP.laser - 1, { x: 27, y: -33, rot: -32, flip: true }],
  [SHIP.laser, { x: 28.5, y: -34, rot: -29, flip: true }],
  [SHIP.laser + 10, { x: 28, y: -34.5, rot: -30, flip: true }],
  [66, { x: 38, y: -60, rot: 12, flip: true }],
  [70, { x: 12, y: -76, rot: 6, flip: true }],
  [74, { x: -24, y: -66, rot: 30 }],
  [78, { x: -18, y: -44, rot: 34 }],
  [82, { x: -2, y: -26, rot: 32 }],
  [SHIP.launch, { x: 8, y: -16, rot: 24 }],
  [86, { x: 32, y: -30, rot: -30 }],
  [90, { x: 66, y: -58, rot: -36 }],
  [96, { x: 112, y: -98, rot: -40 }],
  [97, { x: 112, y: -98, rot: -40 }, { fxBack: null }],
];

function cinematic(): AnimClip {
  const L = SHIP.laser;
  const B = SHIP.launch;
  const len = SHIP.cinematicFaf - 1;
  const hold = LOOP.find(([f]) => f === L)![1];
  /** Bob, the remote, his face and the effects for each of the cinematic's keys, before the ship is added. */
  const frames: [number, Pose, Record<string, string | null>?][] = [
    [0, mix(remote(FOLLOW, 8.8, -4.4, -4), { fx3: at(...VICTIM, 0, 1.6) }), { ...GLEE, fx3: 'pow' }],
    [3, remote(add(FOLLOW, look(0.1, -0.2)), 8.8, -4.5, -6), { ...GLEE, fx3: null }],
    [11, remote(SKYWARD, 8.6, -4.7, -8)],
    [25, remote(SKYWARD, 8.6, -4.8, -10)],
    [40, remote(mix(TRACK, look(0.3, -0.4)), 8.8, -4.6, -6), { ...DETERMINED, mouth: 'grin' }],
    [42, mix(remote(mix(TRACK, look(0.3, -0.4)), 8.8, -4.6, -6), charge(0.3)), { fx3: 'charge' }],
    [L - 1, mix(remote(mix(WIND, look(0.3, -0.3)), 8.3, -5.1, -12), charge(1.9))],
    [
      L,
      mix(remote(PRESS, 9.1, -3.9, 4), beam(hold, VICTIM, 1.15), { fx3: at(...VICTIM, 0, 1.25) }),
      { ...DETERMINED, mouth: 'grin', ...PRESSED, fx2: 'laser', fx3: 'zap' },
    ],
    [L + 3, mix(remote(FLINCH, 8.2, -4.3, -14), beam(hold, VICTIM, 0.85), { fx3: at(...VICTIM, 20, 1.05) })],
    [L + 6, mix(remote(FLINCH, 8.2, -4.3, -14), beam(hold, VICTIM, 1.1), { fx3: at(...VICTIM, 0, 1.25) })],
    [L + 10, mix(remote(TRACK, 8.8, -4.4, -4), beam(hold, VICTIM, 0.6), { fx3: at(...VICTIM, 15, 0.9) })],
    [L + 11, remote(TRACK, 8.8, -4.4, -4), { ...GLEE, ...REMOTE_ON, fx2: null, fx3: null }],
    [70, remote(SKYWARD, 8.6, -4.8, -10)],
    [78, remote(OVERHEAD, 8.6, -4.8, -8)],
    [82, remote(FOLLOW, 8.8, -4.4, -4), { ...STARTLED, ...REMOTE_ON }],
    [
      B,
      mix(remote(FLINCH, 8.2, -4.3, -14), { fx3: at(...VICTIM, 0, 0.9) }),
      { ...STARTLED, ...REMOTE_ON, fx3: 'shipBlast' },
    ],
    [B + 2, mix(remote(FLINCH, 8.2, -4.3, -14), { fx3: at(...VICTIM, 10, 1.25) })],
    [
      B + 4,
      mix(remote(CHEER, 8.6, -7.2, -18), { fx3: at(...VICTIM, 16, 1.3) }),
      { ...GLEE, ...REMOTE_ON, fx3: 'shipBlastFade' },
    ],
    [
      B + 10,
      mix(remote(add(CHEER, { body: { sy: 0.97 } }), 8.6, -6.6, -10), { fx3: at(...VICTIM, 30, 1.6) }),
    ],
    [B + 12, remote(CHEER, 8.6, -7.2, -18), { ...GLEE, ...REMOTE_ON, fx3: null }],
    [B + 16, remote(add(CHEER, { body: { sy: 0.97 } }), 8.6, -6.6, -10)],
    [B + 20, remote(PROUD, 9.0, -4.2, 0), { ...HAPPY, mouth: 'grin', ...REMOTE_ON }],
    [B + 22, remote(PROUD, 8.8, -3.6, 4, 0.3)],
    [len, STAND],
  ];
  const shipKeys = new Map(LOOP.map(([f, p, s]) => [f, { p, s }] as const));
  const all = [...new Set([...frames.map(([f]) => f), ...LOOP.map(([f]) => f)])].sort((a, b) => a - b);
  /** The ship's place on `f`, between its keys (linear, as the clip tweens it). */
  const shipOn = (f: number): ShipAt => {
    const before = LOOP.filter(([k]) => k <= f).at(-1)!;
    const after = LOOP.find(([k]) => k >= f) ?? before;
    if (after[0] === before[0]) return before[1];
    const t = (f - before[0]) / (after[0] - before[0]);
    const mixed = (a: number, b: number) => a + (b - a) * t;
    const [p, q] = [before[1], after[1]];
    return { x: mixed(p.x, q.x), y: mixed(p.y, q.y), rot: mixed(p.rot, q.rot), flip: p.flip };
  };
  /** Bob's pose on `f` between his own keys, tweened linearly as the clip would. */
  const bobOn = (f: number): Pose => {
    const before = frames.filter(([k]) => k <= f).at(-1)!;
    const after = frames.find(([k]) => k >= f) ?? before;
    return after[0] === before[0]
      ? before[1]
      : blend(before[1], after[1], (f - before[0]) / (after[0] - before[0]));
  };
  const keys: Key[] = [];
  let swapped: Record<string, string | null> = { ...GLEE, ...REMOTE_ON, ...STREAK };
  for (const f of all) {
    const own = frames.find(([k]) => k === f);
    const ship = shipKeys.get(f);
    const p = ship?.p ?? shipOn(f);
    const base = own?.[1] ?? bobOn(f);
    const changes = { ...(own?.[2] ?? {}), ...(ship?.s ?? {}) };
    const swaps = Object.keys(changes).length ? (swapped = { ...swapped, ...changes }) : undefined;
    const done = f === len;
    keys.push(
      key(f, done ? STAND : mix(base, shipPose(p)), {
        ease: 'linear',
        ...(swaps && { swaps: done ? { ...HAPPY, mouth: 'grin' } : swaps }),
        ...(f === 0 && { z: REMOTE_Z }),
      }),
    );
  }
  // The remote goes back once he has put it away (B + 22), and the draw order with it.
  keys.splice(
    keys.findIndex((k) => k.frame > B + 22),
    0,
    key(B + 23, undefined, { swaps: { ...HAPPY, mouth: 'grin', fxBack: null }, z: {} }),
  );
  return { length: len, active: [[B, B]], swaps: HAPPY, keys };
}

/** Poses `a` and `b` mixed `t` of the way, field by field from each bone's rest (a linear tween's frame). */
function blend(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const bone of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const [p, q] = [a[bone] ?? {}, b[bone] ?? {}];
    const o: Record<string, number> = {};
    for (const k of ['x', 'y', 'rot'] as const) o[k] = (p[k] ?? 0) + ((q[k] ?? 0) - (p[k] ?? 0)) * t;
    for (const k of ['sx', 'sy'] as const) o[k] = (p[k] ?? 1) + ((q[k] ?? 1) - (p[k] ?? 1)) * t;
    out[bone] = o;
  }
  return out;
}

/** The laser charging at the ship's muzzle while it hovers, `s` its size. */
function charge(s: number): Pose {
  const hold = LOOP.find(([f]) => f === SHIP.laser - 1)![1];
  const [x, y] = shipPoint(hold, MUZZLE);
  return { fx3: at(x, y, 0, s) };
}

export const finalSmashClip = activation();
export const finalSmashCinematicClip = cinematic();
