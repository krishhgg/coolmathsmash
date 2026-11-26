import { pointOf, type Pose } from '../../../render/rig/author';
import { toLocal, type Affine } from '../../../render/rig/sample';
import type { AnimClip, BonePose, Key } from '../../../render/rig/types';
import {
  APEX,
  BRO_CHEER,
  BRO_DUCK,
  BRO_FLUNG,
  CROUCH,
  DOWN,
  FALL,
  HOLD,
  SQUAT,
  STAND,
  air,
  bro,
  broArms,
  clips,
  stand,
} from './clips';
import { FORE_ARM, GRIP_FRONT, GRIP_REAR, UPPER_ARM } from './parts';
import {
  GRIN,
  GRIT,
  HAPPY,
  HURT,
  LOOK_UP,
  OPEN,
  OPEN_F,
  SCARED,
  SHOUT,
  aim,
  aloft,
  at,
  feet,
  fx,
  grip,
  grounded,
  hands,
  above,
  key,
  mix,
  muzzle,
  rotOf,
  shortTurns,
  type Pt,
} from './poses';
import { rig } from './rig';

/**
 * The kids' moves, on their frame data (`../moves.ts`). Each clip lasts FAF - 1 frames and plays frame for frame:
 * its `active` windows are the move's hit windows, or for a shot the frame the ball spawns, or for a throw or
 * pummel the frame it lands. The launcher pops on exactly the frame a tennis ball spawns, with its muzzle where
 * the ball appears. Rig space: y down, feet at the origin, facing right.
 */

type Swaps = Record<string, string | null>;
const DEG = 180 / Math.PI;
const round = (v: number) => Math.round(v * 1000) / 1000;
const ARM = UPPER_ARM + FORE_ARM;

// ---------------------------------------------------------------------------------------------------------
// The frame data the clips are keyed to, from ../moves.ts and ../grenade.ts. The art can't import the moves (they
// load the fighter registry, which loads this art), so index.test.ts checks these numbers against them.

/** First actionable frame of each move. */
const FAF: Record<string, number> = {
  jab: 18,
  ftilt: 30,
  utilt: 30,
  dtilt: 28,
  dashAttack: 42,
  fsmash: 52,
  usmash: 47,
  dsmash: 44,
  getupAttack: 46,
  nair: 40,
  fair: 36,
  bair: 38,
  uair: 34,
  dair: 40,
  grab: 36,
  dashGrab: 44,
  pivotGrab: 38,
  pummel: 7,
  fthrow: 34,
  bthrow: 45,
  uthrow: 40,
  dthrow: 38,
  sideB: 40,
  upB: 62,
};

/** A ball (or the grenade) a move spawns: its frame, where it appears (x forward, y up) and its launch velocity. */
interface Spawn {
  frame: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}
const S = (frame: number, x: number, y: number, vx: number, vy: number): Spawn => ({ frame, x, y, vx, vy });
const SPAWNS: Record<string, Spawn[]> = {
  jab: [S(5, 7, 7, 3, 0)],
  ftilt: [S(9, 8, 7, 3.2, 0)],
  utilt: [S(8, 2, 14, 0, 3.4)],
  dtilt: [S(9, 7, 2, 2.6, 1)],
  nair: [S(8, 4, 10, 1.7, 1.7), S(8, -4, 10, -1.7, 1.7), S(8, 4, 3, 1.7, -1.7), S(8, -4, 3, -1.7, -1.7)],
  fair: [S(9, 8, 7, 3, 0)],
  bair: [S(10, -8, 7, -3, 0)],
  uair: [S(8, 1, 15, 0, 3)],
  dair: [S(10, 1, -1, 0, -3)],
  sideB: [S(16, 7, 8, 2.1, 2.8)],
};

/** The centre of each grab's box, as a rig point. */
const GRAB_BOXES: Record<string, Pt> = { grab: [6.5, -7], dashGrab: [7.5, -7], pivotGrab: [8, -7] };

// ---------------------------------------------------------------------------------------------------------
// Helpers.

/** The world frame of `bone`'s parent in `pose`. */
function parentFrame(pose: Pose, bone: string): Affine {
  const parent = rig.bones.find((b) => b.name === bone)?.parent;
  if (!parent) return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  const [ox, oy] = pointOf(rig, pose, parent);
  const [ax, ay] = pointOf(rig, pose, parent, 1, 0);
  const [cx, cy] = pointOf(rig, pose, parent, 0, 1);
  return { a: ax - ox, b: ay - oy, c: cx - ox, d: cy - oy, tx: ox, ty: oy };
}

/**
 * `pose` with `bone`'s origin moved onto rig point `to` and, given `deg`, its world rotation set to `deg`. Other
 * fields of the bone (its scale) are kept.
 */
function placeAt(pose: Pose, bone: string, to: Pt, deg?: number, extra: BonePose = {}): Pose {
  const def = rig.bones.find((b) => b.name === bone)!;
  const m = parentFrame(pose, bone);
  const [lx, ly] = toLocal(m, to[0], to[1]);
  const turn = deg === undefined ? {} : { rot: round(deg - Math.atan2(m.b, m.a) * DEG - (def.rot ?? 0)) };
  return mix(pose, { [bone]: { x: round(lx - def.x), y: round(ly - def.y), ...turn, ...extra } });
}

/**
 * Stretches each arm (both segments, rubber-hose style) just enough to reach its grip on the launcher, then grips
 * it. The kids' arms are short, so a launcher pushed out to a shot's spawn point needs the reach.
 */
function reachGrips(pose: Pose): Pose {
  let p = pose;
  const arms: [string, string, Pt][] = [
    ['armB', 'foreB', GRIP_FRONT],
    ['armF', 'foreF', GRIP_REAR],
  ];
  for (const [arm, fore, g] of arms) {
    const [sx, sy] = at(p, arm);
    const [tx, ty] = at(p, 'gun', ...g);
    const k = Math.hypot(tx - sx, ty - sy) / (ARM * 0.96);
    if (k > 1) p = mix(p, { [arm]: { sy: round(k) }, [fore]: { sy: round(k) } });
  }
  return grip(p);
}

/**
 * Points the launcher at world angle `deg` (0 forwards, -90 up) with its muzzle on rig point `to`, and grips it.
 */
function shoot(pose: Pose, deg: number, to: Pt): Pose {
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < 3; i++) {
    const [mx, my] = muzzle(aim(pose, deg, dx, dy));
    const m = parentFrame(aim(pose, deg, dx, dy), 'gun');
    const [lx, ly] = toLocal({ ...m, tx: 0, ty: 0 }, to[0] - mx, to[1] - my);
    dx += lx;
    dy += ly;
  }
  return reachGrips(aim(pose, deg, round(dx), round(dy)));
}

/** A rig point `back` units behind `to` along the world angle `deg`: where the muzzle sits as a ball leaves it. */
function behind(to: Pt, deg: number, back = 1): Pt {
  return [round(to[0] - Math.cos(deg / DEG) * back), round(to[1] - Math.sin(deg / DEG) * back)];
}

/** The rig point of a move's spawn (feet-relative, y up), and its launch angle in rig degrees. */
function spawnOf(move: string, i = 0): { at: Pt; deg: number; frame: number } {
  const s = SPAWNS[move]![i]!;
  return { at: [s.x, -s.y], deg: Math.atan2(-s.vy, s.vx) * DEG, frame: s.frame };
}

/** The pose `u` of the way from `a` to `b`, every bone field tweened linearly, as the sampler does. */
function between(a: Pose, b: Pose, u: number): Pose {
  const out: Pose = {};
  for (const bone of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const [p, q] = [a[bone] ?? {}, b[bone] ?? {}];
    const lerp = (from = 0, to = 0) => round(from + (to - from) * u);
    out[bone] = {
      x: lerp(p.x, q.x),
      y: lerp(p.y, q.y),
      rot: lerp(p.rot, q.rot),
      sx: lerp(p.sx ?? 1, q.sx ?? 1),
      sy: lerp(p.sy ?? 1, q.sy ?? 1),
    };
  }
  return out;
}

/** Puts hands (mitten centres) on rig points, stretching an arm that can't reach. */
function grab(pose: Pose, back: Pt | null, front: Pt | null): Pose {
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

/** A move clip: FAF - 1 frames long, its strike keyed on `active`. */
function move(name: string, active: [number, number][], keys: Key[], swaps: Swaps = GRIT): AnimClip {
  return { length: FAF[name]! - 1, active, swaps, keys };
}

/** The pop on the frame a ball leaves the launcher. */
const POP = { flash: 'fxPop' };
/** The muzzle pop's size (its bone's scale). */
const popSize = (s: number): Pose => ({ muzzle: { sx: s, sy: s } });

/** An effect's placement as an fx-bone pose. */
const place = (bone: string, x: number, y: number, s: number, rot = 0, sy = s): Pose => ({
  [bone]: fx(x, y, s, rot, sy),
});

// ---------------------------------------------------------------------------------------------------------
// Ground shots.

/** Feet set for shooting: the far sneaker forward, braced on the near one. */
const BRACE: [Pt, Pt] = [
  [2.0, 0],
  [-1.2, 0],
];
const braced = (extra: Pose, b: [Pt, Pt] = BRACE): Pose => feet(extra, ...b);

const JAB = spawnOf('jab');
const JAB_AT = behind(JAB.at, 0, 1.1);
/** Rapid Fire: launcher levelled at hip height, then kicking up a touch with every ball. */
const JAB_READY = shoot(
  braced({ body: { rot: 6, y: 0.2 }, neck: { rot: -4 }, ...bro(6, -4, -40, 0, 10) }),
  0,
  [JAB_AT[0] + 0.4, JAB_AT[1]],
);
const JAB_FIRE = mix(
  shoot(braced({ body: { rot: 2, y: 0.1 }, neck: { rot: -6 }, ...bro(-4, -12, -120, 0, -20) }), -8, JAB_AT),
  popSize(0.75),
);

const FTILT = spawnOf('ftilt');
const FTILT_AT = behind(FTILT.at, 0, 1.2);
/** Straight Shot: a wide stance, the launcher shouldered and sighted, a hard kick on the shot. */
const FTILT_AIM = shoot(
  braced({ body: { rot: 10, y: 0.5 }, neck: { rot: -8 }, ...BRO_DUCK }, [
    [2.4, 0],
    [-1.4, 0],
  ]),
  -2,
  [FTILT_AT[0] + 0.5, FTILT_AT[1] + 0.1],
);
const FTILT_FIRE = mix(
  shoot(
    braced({ body: { rot: 2, y: 0.4 }, neck: { rot: -12 }, hat: { y: -0.3, rot: -8 }, ...BRO_DUCK }, [
      [2.4, 0],
      [-1.4, 0],
    ]),
    -10,
    FTILT_AT,
  ),
  popSize(1.15),
);
const FTILT_KICK = shoot(
  braced({ body: { rot: -6, y: 0.3, x: -0.4 }, neck: { rot: -10 }, ...bro(-16, -16, -150, -20, -30) }, [
    [2.4, 0],
    [-1.4, 0],
  ]),
  -18,
  [FTILT_AT[0] - 1.4, FTILT_AT[1] - 0.6],
);

const UTILT = spawnOf('utilt');
const UTILT_AT = behind(UTILT.at, -90, 1.2);
/** Lob: the launcher pointed straight up from the chest, the kids looking up after the ball. */
const UTILT_AIM = shoot(
  braced({ body: { rot: -4, y: 0.3 }, neck: { rot: -12 }, ...bro(-6, -20, -40, 0, -10) }),
  -90,
  [UTILT_AT[0] + 0.1, UTILT_AT[1] + 0.8],
);
const UTILT_FIRE = mix(
  shoot(
    braced({ body: { rot: -6, y: 0.6 }, neck: { rot: -16 }, ...bro(-10, -24, -150, 0, -20) }),
    -92,
    UTILT_AT,
  ),
  popSize(0.9),
);
const UTILT_KICK = shoot(
  braced({ body: { rot: -2, y: 1.1 }, neck: { rot: -14 }, ...bro(-4, -20, -130, 0, -10) }),
  -86,
  [UTILT_AT[0] + 0.2, UTILT_AT[1] + 1.8],
);

const DTILT = spawnOf('dtilt');
const DTILT_AT: Pt = [DTILT.at[0] - 1.0, DTILT.at[1] - 0.4];
/** Skip Shot: down on one knee, the launcher held level just off the floor so the ball skims along it. */
const kneel = (extra: Pose): Pose =>
  grounded(
    feet(
      mix({ body: { y: 3.0, rot: 14 }, neck: { y: 0.3, rot: -10 }, ...BRO_DUCK }, extra),
      [2.4, 0],
      [-2.0, 0],
      0,
      60,
    ),
  );
const DTILT_AIM = shoot(kneel({}), 2, [DTILT_AT[0] - 0.4, DTILT_AT[1]]);
const DTILT_FIRE = mix(shoot(kneel({ body: { rot: 10 } }), -6, DTILT_AT), popSize(0.85));
const DTILT_KICK = shoot(kneel({ body: { rot: 6, x: -0.3 }, ...bro(-8, -10, -120, 0, -10) }), -14, [
  DTILT_AT[0] - 1.2,
  DTILT_AT[1] - 0.3,
]);

// ---------------------------------------------------------------------------------------------------------
// Melee: the floaty.

/** The ring lying flat under the belly, its centre on rig point `to`, squashed by `squash`. */
const ringAt = (pose: Pose, to: Pt, deg = 0, sx = 1, sy = 1): Pose =>
  placeAt(pose, 'ring', to, deg, { sx, sy });

/** Raft Slide: belly-flopped on the ring, launcher out front, legs kicking up behind. */
function flop(lift: number, extra: Pose = {}): Pose {
  const body = aim(
    mix(
      {
        body: { rot: 72, y: 2.6 - lift, x: 0.4 },
        neck: { rot: -52 },
        thighF: { rot: 30 },
        shinF: { rot: 70 },
        thighB: { rot: 10 },
        shinB: { rot: 50 },
        bro: { rot: -70, x: 0.6, y: -0.4 },
        broHead: { rot: -10 },
        broArmB: { rot: -170 },
        broArmF: { rot: -40 },
        broLeg: { rot: 60 },
      },
      extra,
    ),
    4,
    0.6,
    0.2,
  );
  return ringAt(body, [1.6, -1.45 - lift], 0, 1.12, 0.92);
}
const FLOP = flop(0);
/** Into the dash attack, then up off the floor at the end of the slide. */
const DASH_IN = stand({ body: { rot: 16, y: 0.6 }, ...bro(14, 8, -60, 0, 30) }, 6, [2.0, 0], [-1.6, 0]);
const FLOP_HOP = aloft(
  air({ body: { rot: 40, y: -1.0, x: 0.6 }, neck: { rot: -24 }, ...BRO_CHEER }, 10, 0.4),
);
const PUSH_UP = grounded(mix(flop(0.8), { body: { rot: 50 }, thighF: { rot: 0 }, shinF: { rot: 40 } }));
const FLOP_SQUAT = grounded(mix(SQUAT, { body: { rot: 30 } }));
const SLIDE = flop(0.15, { neck: { rot: -46 }, thighF: { rot: 20 }, shinF: { rot: 60 } });

/** Floaty Shove: twisted back with the ring cocked, then the hips thrown into a ring-first check. */
const SHOVE_COCK = aim(
  feet(
    {
      body: { rot: -14, x: -1.0, y: 0.4 },
      neck: { rot: 8 },
      ring: { x: -1.2, rot: -10 },
      ...BRO_DUCK,
    },
    [0.6, 0],
    [-2.6, 0],
  ),
  -55,
);
const SHOVE_HIT = (() => {
  const body = aim(
    feet(
      {
        body: { rot: 20, x: 2.6, y: 0.9 },
        neck: { rot: -14 },
        hat: { y: -0.2, rot: -6 },
        ...bro(-24, -18, -160, -20, -50),
      },
      [5.0, 0],
      [-1.0, 0],
    ),
    40,
    -0.6,
    0.5,
  );
  return ringAt(body, [6.4, -5.8], 6, 1.18, 1.12);
})();
const SHOVE_WOBBLE = (() => {
  const body = aim(
    feet(
      { body: { rot: 10, x: 1.4, y: 0.5 }, neck: { rot: -6 }, ...bro(-6, -6, -100, 0, -20) },
      [3.6, 0],
      [-1.0, 0],
    ),
    20,
  );
  return ringAt(body, [3.2, -5.3], 0, 0.92, 1.06);
})();

/** Splash Down: hopped up with the ring hugged high, then the ring slammed flat on the floor. */
const SPLASH_UP = aloft(
  aim(
    mix(air({ body: { y: -1.2, rot: -4 }, neck: { rot: -6 }, ...bro(-10, -14, -150, -10, -40) }, -30, 0.6), {
      ring: { y: -1.6, sx: 0.95, sy: 1.08 },
    }),
    -40,
  ),
);
const SPLASH_DOWN = grounded(
  ringAt(
    stand(
      { body: { y: 2.3, rot: 6 }, neck: { y: 0.3, rot: 10 }, hat: { y: -0.4, rot: -10 }, ...BRO_FLUNG },
      30,
      [2.4, 0],
      [-2.0, 0],
    ),
    [0.4, -0.95],
    0,
    1.45,
    0.62,
  ),
);

/** Getup attack: the ring pulled off the hips and swung like a club, out front and then behind. */
function swing(to: Pt, deg: number, body: Pose, side: 1 | -1): Pose {
  const pose = mix(feet(mix(body, { bro: { rot: 30 * side } }), [1.6, 0], [-1.6, 0]), BRO_DUCK, {
    gun: { rot: 70 },
  });
  const ringed = ringAt(pose, to, deg, 1, 1);
  const edge: Pt = [to[0] - 3.0 * side, to[1] - 0.2];
  return grab(ringed, [edge[0] + 0.2 * side, edge[1] + 0.5], [edge[0], edge[1] - 0.4]);
}
const GETUP_FRONT = swing([5.2, -3.0], 14, { body: { rot: 24, y: 1.6, x: 0.6 }, neck: { rot: -10 } }, 1);
const GETUP_BACK = swing([-5.2, -3.0], -14, { body: { rot: -24, y: 1.6, x: -0.6 }, neck: { rot: 10 } }, -1);
const GETUP_OVER = (() => {
  const pose = mix(feet({ body: { y: 0.4 }, neck: { rot: -10 } }, [1.2, 0], [-1.2, 0]), BRO_DUCK, {
    gun: { rot: 70 },
  });
  const ringed = ringAt(pose, [0.2, -12.0], 0, 1, 0.5);
  return grab(ringed, [1.2, -10.6], [-0.9, -10.6]);
})();

// ---------------------------------------------------------------------------------------------------------
// The air.

const FAIR = spawnOf('fair');
const FAIR_AT = behind(FAIR.at, 0, 1.1);
const FAIR_AIM = aloft(
  shoot(air({ body: { rot: 8 }, neck: { rot: -6 }, ...bro(-4, -8, -60, 0, -20) }, 0, 0.4), 0, [
    FAIR_AT[0] + 0.3,
    FAIR_AT[1],
  ]),
);
const FAIR_FIRE = mix(
  aloft(
    shoot(
      air({ body: { rot: -2 }, neck: { rot: -8 }, ...bro(-14, -14, -150, -20, -40) }, 0, 0.4),
      -8,
      FAIR_AT,
    ),
  ),
  popSize(1),
);
const FAIR_KICK = aloft(
  shoot(air({ body: { rot: -14, x: -0.5 }, neck: { rot: -10 }, ...BRO_FLUNG }, 0, 0.3), -22, [
    FAIR_AT[0] - 1.6,
    FAIR_AT[1] - 0.8,
  ]),
);

/**
 * Recoil Blast: they spin round to face backwards (the body flips through a thin frame, as in `turn`), fire behind
 * them, and turn back as the kick carries them forwards. `mirror` draws a pose authored facing right facing left.
 */
function mirror(pose: Pose): Pose {
  const flip = (bone: string, sx = 1): BonePose => {
    const p = pose[bone] ?? {};
    return { x: -(p.x ?? 0), rot: -(p.rot ?? 0), sx: -(p.sx ?? 1) * sx };
  };
  const free = ['rocket', 'fx1', 'fx2', 'fx3', 'hit1', 'hit2'].filter((bone) => pose[bone]);
  return mix(pose, { body: flip('body') }, Object.fromEntries(free.map((bone) => [bone, flip(bone)])));
}
const BAIR = spawnOf('bair');
const BAIR_AT = behind(BAIR.at, 180, 1.1);
const backAim = (deg: number, to: Pt, extra: Pose): Pose =>
  mirror(aloft(shoot(air(extra, 0, 0.5), 180 - deg, [-to[0], to[1]])));
const BAIR_AIM = backAim(180, [BAIR_AT[0] - 0.3, BAIR_AT[1]], {
  body: { rot: 6 },
  ...bro(4, -6, -60, 0, -10),
});
const BAIR_FIRE = mix(
  backAim(188, BAIR_AT, { body: { rot: -2 }, neck: { rot: -6 }, ...bro(-8, -12, -150, -20, -40) }),
  popSize(1.05),
);
const BAIR_KICK = backAim(200, [BAIR_AT[0] + 1.5, BAIR_AT[1] - 0.6], {
  body: { rot: -12 },
  neck: { rot: -10 },
  ...BRO_FLUNG,
});

const UAIR = spawnOf('uair');
const UAIR_AT = behind(UAIR.at, -90, 1.1);
/** Up Shot: stretched tall with the launcher straight up overhead. */
const reachUp = (extra: Pose): Pose =>
  air(
    mix({ body: { y: -0.8, sy: 1.03 }, neck: { rot: -14 }, ...bro(-6, -24, -150, -10, -30) }, extra),
    -90,
    0.2,
  );
const UAIR_AIM = aloft(shoot(reachUp({}), -90, [UAIR_AT[0], UAIR_AT[1] + 0.6]));
const UAIR_FIRE = mix(aloft(shoot(reachUp({ body: { y: -0.6 } }), -92, UAIR_AT)), popSize(0.95));
const UAIR_KICK = aloft(
  shoot(reachUp({ body: { y: 0.2 }, neck: { rot: -10 } }), -84, [UAIR_AT[0] + 0.2, UAIR_AT[1] + 1.8]),
);

const DAIR = spawnOf('dair');
const DAIR_AT = behind(DAIR.at, 90, 0.9);
/** Down Shot: knees tucked up and the launcher pointed straight down past them. */
const straddle = (extra: Pose): Pose =>
  mix(
    {
      body: { y: -2.6 },
      neck: { rot: 16 },
      thighF: { rot: -105 },
      shinF: { rot: 115 },
      thighB: { rot: -80 },
      shinB: { rot: 105 },
      footF: { rot: 20 },
      footB: { rot: 10 },
      ...bro(10, 10, -60, 0, -20),
    },
    extra,
  );
const DAIR_AIM = shoot(straddle({}), 90, [DAIR_AT[0], DAIR_AT[1] - 0.8]);
const DAIR_FIRE = mix(
  shoot(straddle({ body: { y: -2.6 }, ...bro(-6, -10, -160, -20, -40) }), 92, DAIR_AT),
  popSize(0.95),
);
const DAIR_KICK = shoot(straddle({ body: { y: -3.2 }, neck: { rot: 8 }, ...BRO_FLUNG }), 84, [
  DAIR_AT[0] - 0.2,
  DAIR_AT[1] - 2.0,
]);

const NAIR = SPAWNS.nair!.map((_, i) => spawnOf('nair', i));
const NAIR_AT = behind(NAIR[0]!.at, NAIR[0]!.deg, 1.0);
/** Ring Volley: a full spin, ending with the launcher up and forward as four balls burst out on the diagonals. */
const NAIR_TUCK = aloft(air({ body: { rot: -10 }, ...bro(10, 10, 30, 6, 10) }, 20, 1));
const nairSpin = (deg: number): Pose => aloft(mix(NAIR_TUCK, { body: { rot: deg - 10 } }));
const NAIR_FIRE = mix(
  aloft(shoot(air({ body: { rot: 360 }, neck: { rot: -8 }, ...BRO_CHEER }, 0, 0.3), NAIR[0]!.deg, NAIR_AT)),
  popSize(0.8),
  ...NAIR.slice(1).map(({ at: [x, y], deg }, i) =>
    place(
      ['fx1', 'fx2', 'fx3'][i]!,
      round(x - Math.cos(deg / DEG) * 1.6),
      round(y - Math.sin(deg / DEG) * 1.6),
      0.8,
      round(deg),
    ),
  ),
);

// ---------------------------------------------------------------------------------------------------------
// Grabs, pummel and throws.

/** Reaching for a grab: the launcher slung aside on its strap, both hands open on the grab box. */
function reachFor(box: Pt, body: Pose, b: [Pt, Pt]): Pose {
  return grab(
    feet(mix({ gun: { rot: 70, x: -0.4 } }, body), ...b),
    [box[0] + 0.3, box[1] - 0.3],
    [box[0], box[1] + 0.4],
  );
}
const GRAB_BOX = GRAB_BOXES.grab!;
const GRAB_REACH = reachFor(
  GRAB_BOX,
  { body: { rot: 14, x: 0.9, y: 0.4 }, neck: { rot: -8 }, ...bro(8, -6, -60, 0, 10) },
  [
    [3.2, 0],
    [-0.8, 0],
  ],
);
const GRAB_MISS = hands(
  feet(
    { body: { rot: 6, y: 0.5 }, neck: { rot: 4 }, gun: { rot: 70 }, ...bro(4, 4, -30, 0, 0) },
    [1.9, 0],
    [-0.9, 0],
  ),
  [3.6, -6.4],
  [3.2, -5.8],
);
const DASH_BOX = GRAB_BOXES.dashGrab!;
const DASH_REACH = reachFor(
  DASH_BOX,
  { body: { rot: 22, x: 1.8, y: 0.9 }, neck: { rot: -14 }, ...bro(14, -6, -110, 0, 30) },
  [
    [4.4, 0],
    [-0.6, -0.6],
  ],
);
const PIVOT_BOX = GRAB_BOXES.pivotGrab!;
const PIVOT_REACH = reachFor(
  PIVOT_BOX,
  { body: { rot: 20, x: 1.9, y: 0.8 }, neck: { rot: -12 }, ...bro(12, -8, -120, 0, 20) },
  [
    [4.6, 0],
    [-0.8, 0],
  ],
);

/** Launcher Bonk: the near hand swings the launcher down on the held fighter's head. */
function bonk(lean: number, deg: number, dx: number, dy: number): Pose {
  const body = mix(HOLD, { body: { rot: lean } });
  const swung = mix(body, { gun: { rot: round(deg - rotOf(body, 'torso')), x: dx, y: dy } });
  return grab(swung, [4.3, -6.2], at(swung, 'gun', ...GRIP_REAR));
}
const BONK_UP = bonk(-2, -100, -0.6, -2.6);
const BONK = bonk(10, 40, 1.8, -3.8);

/** Throws hold the victim at arm's length in front; these poses act on that spot. */
const THROW_SHOVE = grab(
  feet(
    { body: { rot: 16, x: 1.0, y: 0.5 }, neck: { rot: -8 }, gun: { rot: 70 }, ...bro(10, -4, -80, 0, 10) },
    [3.4, 0],
    [-0.8, 0],
  ),
  [6.0, -7.0],
  [5.8, -6.2],
);
const THROW_WIND = hands(
  feet(
    { body: { rot: -10, x: -0.4, y: 0.3 }, neck: { rot: 6 }, gun: { rot: 70 }, ...BRO_DUCK },
    [1.2, 0],
    [-1.6, 0],
  ),
  [3.8, -6.6],
  [3.4, -6.0],
);
const POINT_BLANK = mix(
  shoot(
    braced({ body: { rot: 4, y: 0.5 }, neck: { rot: -6 }, ...bro(-10, -10, -150, 0, -20) }),
    -4,
    [5.6, -6.9],
  ),
  popSize(1.1),
);
const POINT_KICK = shoot(
  braced({ body: { rot: -6, x: -0.4, y: 0.3 }, neck: { rot: -10 }, ...BRO_FLUNG }),
  -18,
  [4.4, -7.4],
);

const UP_LOAD = shoot(
  braced({ body: { rot: 8, y: 1.2 }, neck: { rot: -6 }, ...BRO_DUCK }, [
    [2.4, 0],
    [-1.4, 0],
  ]),
  -50,
  [5.4, -8.6],
);
const UP_FIRE = mix(
  shoot(
    braced({ body: { rot: 0, y: 0.6 }, neck: { rot: -16 }, ...bro(-10, -24, -160, 0, -30) }, [
      [2.4, 0],
      [-1.4, 0],
    ]),
    -64,
    [5.4, -9.6],
  ),
  popSize(1.2),
);
const UP_KICK = shoot(
  braced({ body: { rot: -8, y: 0.8 }, neck: { rot: -18 }, ...bro(-8, -24, -140, 0, -20) }, [
    [2.4, 0],
    [-1.4, 0],
  ]),
  -80,
  [4.0, -10.4],
);

/** Rocket Toss: the brother lights a rocket that whirls the pair round, flinging the held fighter behind. */
function brotherRocket(pose: Pose, tilt: number): Pose {
  const held = broArms(pose, 120, 200);
  const [hx, hy] = at(held, 'broArmB', 0, 1.45);
  return placeAt(held, 'rocket', [round(hx), round(hy + 0.4)], tilt, { sx: 0.7, sy: 0.7 });
}
/** The rocket drawn over the brother's arms, so it shows in front of him. */
const ROCKET_FRONT = above('broArmF', ['rocket']);
const TOSS_HOLD = brotherRocket(mix(HOLD, { ...bro(-6, -10, 0, 0, -20, 0.4) }), 70);
const TOSS_SPIN = brotherRocket(
  hands(
    feet(
      { body: { rot: -6, y: 0.4 }, neck: { rot: -6 }, gun: { rot: 70 }, ...bro(-10, -16, 0, 0, -30, 0.4) },
      [1.2, 0],
      [-1.2, 0],
    ),
    [4.0, -7.4],
    [3.6, -6.8],
  ),
  80,
);
const TOSS_FLING_RIGHT = brotherRocket(
  grab(
    feet(
      {
        body: { rot: 14, x: 0.8, y: 0.5 },
        neck: { rot: -8 },
        gun: { rot: 70 },
        ...bro(-14, -16, 0, 0, -40, 0.4),
      },
      [3.0, 0],
      [-1.0, 0],
    ),
    [6.2, -8.0],
    [5.8, -7.4],
  ),
  100,
);
/** The fling, turned to face behind, with the rocket's flame `flame` long. */
const tossFling = (flame: number): Pose =>
  mirror(mix(TOSS_FLING_RIGHT, flameAt(TOSS_FLING_RIGHT, flame, 'fx3')));

/** Floaty Sit: a hop up and forward, then plopped down ring-first on the held fighter. */
const SIT_HOP = aloft(
  aim(
    mix(air({ body: { rot: -10, x: 1.6, y: -3.4 }, neck: { rot: -4 }, ...BRO_CHEER }, -40, 0.8), {
      ring: { y: 0.4 },
    }),
    -40,
  ),
);
const SIT_DROP = grounded(
  ringAt(
    aim(
      mix(
        air(
          { body: { rot: -26, x: 5.0, y: 1.2 }, neck: { rot: 10 }, hat: { y: -0.5, rot: -12 }, ...BRO_FLUNG },
          30,
          1,
        ),
        {},
      ),
      40,
    ),
    [5.4, -1.6],
    0,
    1.3,
    0.7,
  ),
);

// ---------------------------------------------------------------------------------------------------------
// Specials.

const GRENADE = spawnOf('sideB');
/** Grenade: one hand off the launcher, the grenade wound back behind the hat, then lobbed overhand. */
function lob(extra: Pose, hand: Pt, gunDeg: number, b: [Pt, Pt] = BRACE): Pose {
  const pose = aim(feet(extra, ...b), gunDeg, -0.3, 0.6);
  const held = hands(pose, at(pose, 'gun', ...GRIP_FRONT), null);
  return grab(held, null, hand);
}
const GRENADE_TAKE = lob(
  { body: { rot: 2, y: 0.3 }, neck: { rot: 6 }, ...bro(6, 10, -40, 0, 10) },
  [0.6, -5.0],
  30,
);
const GRENADE_WIND = lob(
  { body: { rot: -14, x: -0.6, y: 0.4 }, neck: { rot: -10 }, ...bro(-8, -10, -110, 0, -20) },
  [-3.0, -11.2],
  40,
  [
    [1.0, 0],
    [-2.2, 0],
  ],
);
const GRENADE_THROW = lob(
  { body: { rot: 16, x: 1.0, y: 0.6 }, neck: { rot: -10 }, ...BRO_CHEER },
  [round(GRENADE.at[0] - 1.3), round(GRENADE.at[1] + 0.4)],
  40,
  [
    [3.2, 0],
    [-1.0, 0],
  ],
);
/** The frame after the release: the hand past the grenade's spawn point, open. */
const GRENADE_GONE = lob(
  { body: { rot: 18, x: 1.1, y: 0.7 }, neck: { rot: -8 }, ...BRO_CHEER },
  [round(GRENADE.at[0] - 0.6), round(GRENADE.at[1] + 1.2)],
  40,
  [
    [3.2, 0],
    [-1.0, 0],
  ],
);
const GRENADE_FOLLOW = lob(
  { body: { rot: 22, x: 1.2, y: 0.9 }, neck: { rot: -4 }, ...bro(4, 0, -80, 0, 10) },
  [4.4, -4.2],
  40,
  [
    [3.2, 0],
    [-1.0, 0],
  ],
);

/** Rocket Ride: the pair astride the big rocket, leaning `lean` degrees off vertical, legs either side of it. */
const RIDE_S = 1.15;
function ride(lean: number, extra: Pose = {}): Pose {
  const pose = aim(
    mix(
      air(
        {
          body: { rot: lean, y: -2.2 },
          neck: { rot: -10 },
          thighF: { rot: -60 },
          shinF: { rot: 80 },
          thighB: { rot: -50 },
          shinB: { rot: 70 },
          ...BRO_CHEER,
        },
        -40,
        0,
      ),
      extra,
    ),
    lean - 30,
  );
  const [hx, hy] = at(pose, 'hip');
  const t = lean / DEG;
  const [ox, oy] = [0.3, 3.9];
  const tail: Pt = [
    round(hx + ox * Math.cos(t) - oy * Math.sin(t)),
    round(hy + ox * Math.sin(t) + oy * Math.cos(t)),
  ];
  return placeAt(pose, 'rocket', tail, lean, { sx: RIDE_S, sy: RIDE_S });
}
/** The rocket drawn between the legs, so the pair straddles it. */
const ROCKET_RIDDEN = above('footB', ['rocket']);
/** The rocket's nozzle in `pose` (where the flame comes out). */
const nozzle = (pose: Pose): Pt => at(pose, 'rocket', 0, 0.3);
function flameAt(pose: Pose, s: number, bone = 'fx3'): Pose {
  const [x, y] = nozzle(pose);
  return place(bone, round(x), round(y), s, round(rotOf(pose, 'rocket')));
}
/** Speed lines streaming down past the rocket. */
const trail = (x: number, y: number, s: number, bone = 'fx1'): Pose => place(bone, x, y, s, 100);
const RIDE_LIGHT = ride(0, { body: { rot: 0, y: -2.6 }, neck: { rot: 8 }, ...bro(14, 20, 10, 20, 10) });
const RIDE_A = ride(15);
const RIDE_B = ride(15, { body: { y: -2.0 }, neck: { rot: -14 }, ...bro(-2, -12, -170, -20, -40) });
const BLAST = aloft(
  air(
    {
      body: { rot: -24, y: -1.0 },
      neck: { rot: -16 },
      hat: { y: -1.6, rot: -30 },
      ...BRO_FLUNG,
    },
    100,
    -0.4,
  ),
);

// ---------------------------------------------------------------------------------------------------------

const ROCKET_SHOT_S = 0.8;
/** The bottle rocket for the up smash, its tail on (x, y), with its flame trailing `flame` units behind. */
const bottle = (x: number, y: number, flame = 1.6): Pose => ({
  rocket: { x, y, sx: ROCKET_SHOT_S, sy: ROCKET_SHOT_S },
  hit2: fx(x, round(y + 0.3 * ROCKET_SHOT_S), 0.7, 0, flame),
});
const USMASH_AIM = shoot(
  braced({ body: { rot: -4, y: 0.6 }, neck: { rot: -14 }, ...bro(-8, -20, -40, 0, -10) }),
  -90,
  [2.0, -11.8],
);
const USMASH_FIRE = mix(
  shoot(
    braced({ body: { rot: -6, y: 1.2 }, neck: { rot: -18 }, ...bro(-12, -26, -160, 0, -30) }),
    -90,
    [2.0, -11.3],
  ),
  popSize(1.0),
);
const USMASH_WATCH = shoot(
  braced({ body: { rot: -8, y: 0.8 }, neck: { rot: -20 }, ...bro(-12, -26, -160, 0, -30) }),
  -84,
  [2.4, -11.0],
);

/** The rocket's tail sitting on the muzzle before it fires. */
const LOADED = round(muzzle(USMASH_AIM)[1] - 0.1);

export const attacks: Record<string, AnimClip> = {
  jab: move(
    'jab',
    [[JAB.frame, JAB.frame]],
    shortTurns([
      key(0, STAND, { ease: 'out' }),
      key(4, JAB_READY, { ease: 'linear' }),
      key(JAB.frame, JAB_FIRE, { ease: 'out', swaps: { ...SHOUT, broFace: 'broCheer', ...POP } }),
      key(JAB.frame + 2, undefined, { swaps: { ...SHOUT, broFace: 'broCheer' } }),
      key(8, mix(JAB_READY, { body: { rot: 5 } }), { ease: 'inOut', swaps: {} }),
      key(12, JAB_READY, { ease: 'inOut' }),
      key(17, STAND),
    ]),
  ),
  ftilt: move(
    'ftilt',
    [[FTILT.frame, FTILT.frame]],
    shortTurns([
      key(0, STAND, { ease: 'out' }),
      key(5, FTILT_AIM, { ease: 'in', swaps: { face: 'faceGrit', broFace: 'broBlink' } }),
      key(FTILT.frame, FTILT_FIRE, { ease: 'out', swaps: { ...SHOUT, broFace: 'broScared', ...POP } }),
      key(FTILT.frame + 3, FTILT_KICK, { ease: 'inOut', swaps: { ...SHOUT, broFace: 'broScared' } }),
      key(18, mix(FTILT_AIM, { body: { rot: 4 } }), { ease: 'inOut', swaps: HAPPY }),
      key(24, undefined, { swaps: {} }),
      key(29, STAND),
    ]),
  ),
  utilt: move(
    'utilt',
    [[UTILT.frame, UTILT.frame]],
    shortTurns([
      key(0, STAND, { ease: 'out' }),
      key(5, UTILT_AIM, { ease: 'in', swaps: { ...LOOK_UP } }),
      key(UTILT.frame, UTILT_FIRE, { ease: 'out', swaps: { ...LOOK_UP, broFace: 'broCheer', ...POP } }),
      key(UTILT.frame + 3, UTILT_KICK, { ease: 'inOut', swaps: { ...LOOK_UP, broFace: 'broCheer' } }),
      key(20, mix(UTILT_AIM, { body: { y: 0.2 } }), { ease: 'inOut', swaps: LOOK_UP }),
      key(24, undefined, { swaps: {} }),
      key(29, STAND),
    ]),
  ),
  dtilt: move(
    'dtilt',
    [[DTILT.frame, DTILT.frame]],
    shortTurns([
      key(0, CROUCH, { ease: 'out' }),
      key(5, DTILT_AIM, { ease: 'in' }),
      key(DTILT.frame, DTILT_FIRE, { ease: 'out', swaps: { ...SHOUT, ...POP } }),
      key(DTILT.frame + 3, DTILT_KICK, { ease: 'inOut', swaps: SHOUT }),
      key(19, DTILT_AIM, { ease: 'inOut', swaps: {} }),
      key(27, CROUCH),
    ]),
  ),
  dashAttack: move(
    'dashAttack',
    [
      [8, 11],
      [12, 22],
    ],
    shortTurns([
      key(0, DASH_IN, { ease: 'linear' }),
      key(2, grounded(between(DASH_IN, FLOP_HOP, 0.5)), { ease: 'linear' }),
      key(4, FLOP_HOP, { ease: 'in', swaps: SHOUT }),
      key(7, mix(FLOP, place('fx1', 5.4, -0.8, 0.5), place('fx2', -5.4, -3.0, 0.6)), {
        ease: 'linear',
        swaps: { ...SHOUT, fx1: 'fxPuff', fx2: 'fxSpeed' },
      }),
      key(8, mix(FLOP, place('fx1', 6.0, -0.9, 0.9), place('fx2', -6.0, -3.0, 0.9)), { ease: 'linear' }),
      key(12, mix(SLIDE, place('fx1', 6.6, -1.0, 0.5), place('fx2', -6.4, -3.2, 0.8)), {
        ease: 'linear',
        swaps: { ...HAPPY, fx2: 'fxSpeed' },
      }),
      key(22, mix(FLOP, place('fx2', -6.8, -3.0, 0.5)), { ease: 'out' }),
      key(23, undefined, { swaps: HAPPY }),
      key(26, PUSH_UP, { ease: 'linear' }),
      key(28, grounded(between(PUSH_UP, FLOP_SQUAT, 0.5)), { ease: 'linear' }),
      key(30, FLOP_SQUAT, { ease: 'inOut', swaps: {} }),
      key(41, STAND),
    ]),
  ),
  fsmash: move(
    'fsmash',
    [[14, 16]],
    shortTurns([
      key(0, STAND, { ease: 'out' }),
      key(9, SHOVE_COCK, { ease: 'in' }),
      key(13, mix(SHOVE_HIT, place('fx1', 10.2, -7.0, 0.6), place('fx2', -0.4, -6.4, 0.6)), {
        ease: 'linear',
        swaps: { ...SHOUT, broFace: 'broScared', fx1: 'fxSpark', fx2: 'fxSpeed' },
      }),
      key(14, mix(SHOVE_HIT, place('fx1', 10.6, -7.2, 1.1, 10), place('fx2', -1.0, -6.4, 0.9)), {
        ease: 'linear',
      }),
      key(16, mix(SHOVE_HIT, place('fx1', 10.8, -7.4, 1.25, 20), place('fx2', -1.6, -6.4, 0.6)), {
        ease: 'out',
      }),
      key(18, undefined, { swaps: { ...SHOUT, broFace: 'broScared' } }),
      key(24, SHOVE_WOBBLE, { ease: 'inOut', swaps: {} }),
      key(34, mix(SHOVE_WOBBLE, { ring: { sx: 1.04, sy: 0.97 } }), { ease: 'inOut' }),
      key(51, STAND),
    ]),
  ),
  usmash: move(
    'usmash',
    [
      [12, 14],
      [15, 18],
      [19, 22],
    ],
    shortTurns([
      key(0, STAND, { ease: 'out' }),
      key(4, mix(USMASH_AIM, bottle(2.0, LOADED, 0.2), place('fx2', 2.0, LOADED + 0.3, 0.3)), {
        ease: 'out',
        swaps: { ...LOOK_UP, broFace: 'broBlink', rocket: 'rocket', fx2: 'fxSpark' },
      }),
      key(7, mix(USMASH_AIM, bottle(2.0, LOADED, 0.2), place('fx2', 2.0, LOADED + 0.3, 0.4, 20)), {
        ease: 'linear',
      }),
      key(10, mix(USMASH_AIM, bottle(2.0, LOADED, 0.4), place('fx2', 2.0, LOADED + 0.3, 0.55, 40)), {
        ease: 'linear',
      }),
      key(11, mix(USMASH_FIRE, bottle(2.0, -14.6, 3.0)), {
        ease: 'linear',
        swaps: { ...LOOK_UP, broFace: 'broCheer', ...POP, rocket: 'rocket', hit2: 'fxFlame' },
      }),
      key(13, undefined, { swaps: { ...LOOK_UP, broFace: 'broCheer', rocket: 'rocket', hit2: 'fxFlame' } }),
      key(14, mix(USMASH_WATCH, bottle(2.0, -18.5, 4.0)), { ease: 'linear' }),
      key(18, mix(USMASH_WATCH, bottle(2.0, -25.5, 4.4)), { ease: 'linear' }),
      key(19, mix(USMASH_WATCH, bottle(2.0, -26.4, 0.1), place('hit1', 2.0, -31.0, 1.5)), {
        ease: 'out',
        swaps: { ...HAPPY, rocket: null, hit1: 'fxBoom' },
      }),
      key(22, mix(USMASH_WATCH, place('hit1', 2.0, -31.0, 1.95, 20)), { ease: 'in' }),
      key(26, mix(USMASH_WATCH, place('hit1', 2.0, -31.4, 1.2, 40)), { ease: 'linear' }),
      key(27, undefined, { swaps: HAPPY }),
      key(34, mix(USMASH_WATCH, { body: { y: 0.3 } }), { ease: 'inOut', swaps: {} }),
      key(46, STAND),
    ]),
  ),
  dsmash: move(
    'dsmash',
    [[10, 12]],
    shortTurns([
      key(0, STAND, { ease: 'out' }),
      key(4, SPLASH_UP, { ease: 'in', swaps: { ...GRIT } }),
      key(
        8,
        mix(
          SPLASH_DOWN,
          place('hit1', 9.0, -0.4, 0.5),
          place('hit2', -9.0, -0.4, -0.5, 0, 0.5),
          place('fx1', 4.2, 0, 0.4),
          place('fx2', -4.2, 0, -0.4, 0, 0.4),
        ),
        {
          ease: 'linear',
          swaps: {
            ...SHOUT,
            broFace: 'broScared',
            hit1: 'fxSplash',
            hit2: 'fxSplash',
            fx1: 'fxSplash',
            fx2: 'fxSplash',
          },
        },
      ),
      key(
        9,
        mix(
          SPLASH_DOWN,
          place('hit1', 9.0, -0.4, 1.22),
          place('hit2', -9.0, -0.4, -1.22, 0, 1.22),
          place('fx1', 4.6, 0, 0.7),
          place('fx2', -4.6, 0, -0.7, 0, 0.7),
        ),
        { ease: 'linear' },
      ),
      key(
        12,
        mix(
          SPLASH_DOWN,
          place('hit1', 9.0, -0.4, 1.45),
          place('hit2', -9.0, -0.4, -1.45, 0, 1.45),
          place('fx1', 4.8, 0, 0.5),
          place('fx2', -4.8, 0, -0.5, 0, 0.5),
        ),
        { ease: 'in' },
      ),
      key(
        15,
        mix(
          SPLASH_DOWN,
          place('hit1', 9.4, -0.4, 1.2, 0, 0.4),
          place('hit2', -9.4, -0.4, -1.2, 0, 0.4),
          place('fx1', 4.8, 0, 0.3, 0, 0.1),
          place('fx2', -4.8, 0, -0.3, 0, 0.1),
        ),
        { ease: 'inOut' },
      ),
      key(16, undefined, { swaps: { ...SHOUT, broFace: 'broScared' } }),
      key(26, grounded(mix(SQUAT, { ring: { sx: 1.1, sy: 0.9 } })), { ease: 'inOut', swaps: {} }),
      key(43, STAND),
    ]),
  ),
  getupAttack: move(
    'getupAttack',
    [
      [17, 18],
      [25, 26],
    ],
    shortTurns([
      key(0, DOWN, { ease: 'out', swaps: { ...GRIT } }),
      key(8, grounded(mix(SQUAT, { body: { rot: -30, x: 0.6 } })), { ease: 'inOut' }),
      key(12, GETUP_OVER, { ease: 'in', swaps: { ...SHOUT, broFace: 'broScared' } }),
      key(16, mix(GETUP_FRONT, place('fx1', 4.6, -6.0, 0.6, 30)), {
        ease: 'linear',
        swaps: { ...SHOUT, broFace: 'broScared', fx1: 'fxSpeed' },
      }),
      key(17, mix(GETUP_FRONT, place('fx1', 4.4, -6.4, 0.9, 30)), { ease: 'linear' }),
      key(18, mix(GETUP_FRONT, place('fx1', 4.0, -6.8, 0.6, 30)), { ease: 'inOut' }),
      key(19, undefined, { swaps: { ...SHOUT, broFace: 'broScared' } }),
      key(21, GETUP_OVER, { ease: 'in' }),
      key(24, mix(GETUP_BACK, place('fx1', -4.6, -6.0, -0.6, -30, 0.6)), {
        ease: 'linear',
        swaps: { ...SHOUT, broFace: 'broScared', fx1: 'fxSpeed' },
      }),
      key(25, mix(GETUP_BACK, place('fx1', -4.4, -6.4, -0.9, -30, 0.9)), { ease: 'linear' }),
      key(26, mix(GETUP_BACK, place('fx1', -4.0, -6.8, -0.6, -30, 0.6)), { ease: 'inOut' }),
      key(27, undefined, { swaps: GRIT }),
      key(34, CROUCH, { ease: 'inOut', swaps: {} }),
      key(45, STAND),
    ]),
  ),
  nair: move(
    'nair',
    [[8, 8]],
    [
      key(0, aloft(APEX), { ease: 'out' }),
      key(2, nairSpin(0), { ease: 'linear', swaps: { ...SHOUT, broFace: 'broScared' } }),
      ...[60, 120, 180, 240, 300].map((deg, i) => key(3 + i, nairSpin(deg), { ease: 'linear' })),
      key(8, NAIR_FIRE, {
        ease: 'out',
        swaps: { ...SHOUT, broFace: 'broCheer', ...POP, fx1: 'fxPop', fx2: 'fxPop', fxBack: 'fxPop' },
      }),
      key(10, undefined, { swaps: { ...HAPPY } }),
      key(20, aloft(mix(APEX, { body: { rot: 360 } })), { ease: 'inOut', swaps: {} }),
      key(39, aloft(mix(FALL, { body: { rot: 360 } }))),
    ],
  ),
  fair: move(
    'fair',
    [[FAIR.frame, FAIR.frame]],
    shortTurns([
      key(0, aloft(APEX), { ease: 'out' }),
      key(5, FAIR_AIM, { ease: 'in' }),
      key(FAIR.frame, FAIR_FIRE, { ease: 'out', swaps: { ...SHOUT, broFace: 'broScared', ...POP } }),
      key(FAIR.frame + 3, FAIR_KICK, { ease: 'inOut', swaps: { ...SHOUT, broFace: 'broScared' } }),
      key(20, FAIR_AIM, { ease: 'inOut', swaps: {} }),
      key(35, aloft(FALL)),
    ]),
  ),
  bair: move(
    'bair',
    [[BAIR.frame, BAIR.frame]],
    [
      key(0, aloft(APEX), { ease: 'in' }),
      key(3, aloft(mix(APEX, { body: { sx: 0.25 } })), {
        ease: 'step',
        swaps: { face: 'faceBlink', broFace: 'broScared' },
      }),
      key(4, mix(BAIR_AIM, { body: { sx: -0.25 } }), { ease: 'out', swaps: { ...GRIT } }),
      key(7, BAIR_AIM, { ease: 'in' }),
      key(BAIR.frame, BAIR_FIRE, { ease: 'out', swaps: { ...SHOUT, broFace: 'broCheer', ...POP } }),
      key(BAIR.frame + 3, BAIR_KICK, { ease: 'inOut', swaps: { ...SHOUT, broFace: 'broCheer' } }),
      key(20, BAIR_AIM, { ease: 'in', swaps: GRIT }),
      key(24, mix(BAIR_AIM, { body: { sx: -0.25 } }), {
        ease: 'step',
        swaps: { face: 'faceBlink', broFace: 'broBlink' },
      }),
      key(25, aloft(mix(APEX, { body: { sx: 0.25 } })), { ease: 'out', swaps: {} }),
      key(29, aloft(APEX), { ease: 'inOut' }),
      key(37, aloft(FALL)),
    ],
  ),
  uair: move(
    'uair',
    [[UAIR.frame, UAIR.frame]],
    shortTurns([
      key(0, aloft(APEX), { ease: 'out' }),
      key(5, UAIR_AIM, { ease: 'in', swaps: LOOK_UP }),
      key(UAIR.frame, UAIR_FIRE, { ease: 'out', swaps: { ...LOOK_UP, broFace: 'broCheer', ...POP } }),
      key(UAIR.frame + 3, UAIR_KICK, { ease: 'inOut', swaps: { ...LOOK_UP, broFace: 'broCheer' } }),
      key(18, UAIR_AIM, { ease: 'inOut', swaps: {} }),
      key(33, aloft(FALL)),
    ]),
  ),
  dair: move(
    'dair',
    [[DAIR.frame, DAIR.frame]],
    shortTurns([
      key(0, aloft(APEX), { ease: 'out' }),
      key(6, DAIR_AIM, { ease: 'in', swaps: { face: 'faceGrit', broFace: 'broShout' } }),
      key(DAIR.frame, DAIR_FIRE, { ease: 'out', swaps: { ...SHOUT, broFace: 'broScared', ...POP } }),
      key(DAIR.frame + 3, DAIR_KICK, { ease: 'inOut', swaps: { ...SHOUT, broFace: 'broScared' } }),
      key(22, mix(DAIR_AIM, { body: { y: -2.0 } }), { ease: 'inOut', swaps: {} }),
      key(39, aloft(FALL)),
    ]),
  ),
  grab: move(
    'grab',
    [[7, 8]],
    shortTurns([
      key(0, STAND, { ease: 'out' }),
      key(4, mix(GRAB_MISS, { body: { rot: 2, x: -0.3 } }), { ease: 'in', swaps: { ...GRIT, ...OPEN } }),
      key(6, GRAB_REACH, { ease: 'linear', swaps: { ...SHOUT, ...OPEN } }),
      key(8, GRAB_REACH, { ease: 'inOut' }),
      key(14, GRAB_MISS, { ease: 'inOut', swaps: { face: 'faceGrit', broFace: 'broBlink', ...OPEN } }),
      key(24, mix(GRAB_MISS, { body: { rot: 3 } }), { ease: 'inOut', swaps: {} }),
      key(35, STAND),
    ]),
  ),
  dashGrab: move(
    'dashGrab',
    [[10, 11]],
    shortTurns([
      key(0, stand({ body: { rot: 16, y: 0.6 }, ...bro(14, 8, -60, 0, 30) }, 6, [2.0, 0], [-1.6, 0]), {
        ease: 'out',
      }),
      key(6, grounded(mix(GRAB_MISS, { body: { rot: 12, x: 0.4 } })), {
        ease: 'in',
        swaps: { ...GRIT, ...OPEN },
      }),
      key(9, mix(DASH_REACH, place('fx1', -3.6, -6.0, 0.7)), {
        ease: 'linear',
        swaps: { ...SHOUT, ...OPEN, fx1: 'fxSpeed' },
      }),
      key(10, mix(DASH_REACH, place('fx1', -4.0, -6.0, 0.9)), { ease: 'linear' }),
      key(11, mix(DASH_REACH, place('fx1', -4.6, -6.0, 0.6)), { ease: 'inOut' }),
      key(12, undefined, { swaps: { ...SHOUT, ...OPEN } }),
      key(20, GRAB_MISS, { ease: 'inOut', swaps: { face: 'faceGrit', broFace: 'broBlink', ...OPEN } }),
      key(30, mix(GRAB_MISS, { body: { rot: 3 } }), { ease: 'inOut', swaps: {} }),
      key(43, STAND),
    ]),
  ),
  pivotGrab: move(
    'pivotGrab',
    [[11, 12]],
    [
      key(0, mix(STAND, { body: { sx: -1 } }), { ease: 'in', swaps: { ...GRIT } }),
      key(4, mix(STAND, { body: { sx: -0.25 } }), {
        ease: 'step',
        swaps: { face: 'faceBlink', broFace: 'broBlink' },
      }),
      key(5, mix(GRAB_MISS, { body: { sx: 0.25 } }), { ease: 'out', swaps: { ...GRIT, ...OPEN } }),
      key(8, mix(GRAB_MISS, { body: { rot: 10 } }), { ease: 'in' }),
      key(10, PIVOT_REACH, { ease: 'linear', swaps: { ...SHOUT, ...OPEN } }),
      key(12, PIVOT_REACH, { ease: 'inOut' }),
      key(20, GRAB_MISS, { ease: 'inOut', swaps: { face: 'faceGrit', broFace: 'broBlink', ...OPEN } }),
      key(28, mix(GRAB_MISS, { body: { rot: 3 } }), { ease: 'inOut', swaps: {} }),
      key(37, STAND),
    ],
  ),
  pummel: move(
    'pummel',
    [[1, 1]],
    shortTurns([
      key(0, BONK_UP, { ease: 'in', swaps: { ...GRIT } }),
      key(1, mix(BONK, place('fx1', ...muzzle(BONK), 0.7, 20)), {
        ease: 'out',
        swaps: { ...SHOUT, broFace: 'broCheer', fx1: 'fxStar' },
      }),
      key(3, undefined, { swaps: { ...GRIT } }),
      key(6, HOLD),
    ]),
  ),
  fthrow: move(
    'fthrow',
    [[15, 15]],
    shortTurns([
      key(0, HOLD, { ease: 'out' }),
      key(6, THROW_WIND, { ease: 'in', swaps: { ...GRIT, ...OPEN } }),
      key(10, THROW_SHOVE, { ease: 'out', swaps: { ...SHOUT, broFace: 'broShout', ...OPEN } }),
      key(13, mix(POINT_BLANK, popSize(0.01)), { ease: 'linear', swaps: { ...GRIT } }),
      key(15, POINT_BLANK, { ease: 'out', swaps: { ...SHOUT, broFace: 'broCheer', ...POP } }),
      key(18, POINT_KICK, { ease: 'inOut', swaps: { ...SHOUT, broFace: 'broCheer' } }),
      key(24, undefined, { swaps: HAPPY }),
      key(33, STAND),
    ]),
  ),
  uthrow: move(
    'uthrow',
    [[16, 16]],
    shortTurns([
      key(0, HOLD, { ease: 'out' }),
      key(8, UP_LOAD, { ease: 'in', swaps: { ...GRIT } }),
      key(14, mix(UP_LOAD, { body: { y: 1.4 } }), { ease: 'linear' }),
      key(16, UP_FIRE, { ease: 'out', swaps: { ...LOOK_UP, broFace: 'broCheer', ...POP } }),
      key(19, UP_KICK, { ease: 'inOut', swaps: { ...LOOK_UP, broFace: 'broCheer' } }),
      key(28, undefined, { swaps: HAPPY }),
      key(39, STAND),
    ]),
  ),
  bthrow: move(
    'bthrow',
    [[22, 22]],
    [
      key(0, HOLD, { ease: 'out', swaps: { ...GRIT } }),
      key(6, mix(TOSS_HOLD, place('fx2', ...nozzle(TOSS_HOLD), 0.4)), {
        ease: 'inOut',
        swaps: { ...GRIT, rocket: 'rocket', fx2: 'fxSpark' },
        z: ROCKET_FRONT,
      }),
      key(10, mix(TOSS_HOLD, flameAt(TOSS_HOLD, 0.5, 'fx3')), {
        ease: 'in',
        swaps: { ...SHOUT, broFace: 'broCheer', rocket: 'rocket', fxBack: 'fxFlame' },
      }),
      key(16, mix(TOSS_SPIN, { body: { sx: 0.3 } }, flameAt(TOSS_SPIN, 0.8, 'fx3')), { ease: 'step' }),
      key(17, mix(tossFling(0.9), { body: { sx: -0.3 } }), { ease: 'out' }),
      key(20, tossFling(1.0), { ease: 'linear' }),
      key(22, mix(tossFling(1.0), place('fx1', -7.4, -8.0, 1.0), place('fx2', -3.0, -10.0, 0.4)), {
        ease: 'out',
        swaps: { ...SHOUT, broFace: 'broCheer', fx1: 'fxSpark', fxBack: 'fxFlame', rocket: 'rocket' },
      }),
      key(25, undefined, { swaps: { ...HAPPY, fx2: 'fxPuff' } }),
      key(28, mix(tossFling(0.6), place('fx2', -3.4, -11.0, 0.8)), { ease: 'in', z: {} }),
      key(31, mix(STAND, { body: { sx: -0.25 } }, place('fx2', -3.8, -12.0, 0.4)), {
        ease: 'step',
        swaps: { face: 'faceBlink', broFace: 'broBlink' },
      }),
      key(32, mix(STAND, { body: { sx: 0.25 } }), { ease: 'out', swaps: { ...HAPPY } }),
      key(36, undefined, { swaps: {} }),
      key(44, STAND),
    ],
  ),
  dthrow: move(
    'dthrow',
    [[20, 20]],
    shortTurns([
      key(0, HOLD, { ease: 'out' }),
      key(5, grounded(mix(SQUAT, { body: { rot: 4 } })), { ease: 'out', swaps: { ...GRIT } }),
      key(12, SIT_HOP, { ease: 'in', swaps: { ...HAPPY } }),
      key(19, mix(SIT_DROP, { ring: { sy: 0.9 } }), {
        ease: 'linear',
        swaps: { ...SHOUT, broFace: 'broCheer' },
      }),
      key(20, mix(SIT_DROP, place('fx1', 1.0, -0.6, 0.9), place('fx2', 9.6, -0.6, 0.9)), {
        ease: 'out',
        swaps: { ...SHOUT, broFace: 'broCheer', fx1: 'fxPuff', fx2: 'fxPuff' },
      }),
      key(24, mix(SIT_DROP, place('fx1', 0.2, -1.0, 0.4), place('fx2', 10.4, -1.0, 0.4)), { ease: 'in' }),
      key(25, undefined, { swaps: HAPPY }),
      key(30, aloft(air({ body: { rot: -6, x: 1.4, y: -1.6 }, ...BRO_CHEER }, -20, 0.6)), { ease: 'in' }),
      key(33, SQUAT, { ease: 'out', swaps: {} }),
      key(37, STAND),
    ]),
  ),
  sideB: move(
    'sideB',
    [[GRENADE.frame, GRENADE.frame]],
    shortTurns([
      key(0, STAND, { ease: 'out' }),
      key(4, GRENADE_TAKE, { ease: 'inOut', swaps: { ...GRIN, held: 'grenade' } }),
      key(11, GRENADE_WIND, { ease: 'in', swaps: { ...GRIT, held: 'grenade' } }),
      key(GRENADE.frame - 1, GRENADE_THROW, { ease: 'linear', swaps: { ...SHOUT, held: 'grenade' } }),
      key(GRENADE.frame, GRENADE_GONE, { ease: 'out', swaps: { ...SHOUT, broFace: 'broCheer', ...OPEN_F } }),
      key(21, GRENADE_FOLLOW, { ease: 'inOut' }),
      key(28, undefined, { swaps: HAPPY }),
      key(39, STAND),
    ]),
  ),
  upB: move(
    'upB',
    [
      [12, 48],
      [49, 52],
    ],
    [
      key(0, STAND, { ease: 'out', swaps: { ...GRIT } }),
      key(4, mix(RIDE_LIGHT, place('fx2', ...nozzle(RIDE_LIGHT), 0.4)), {
        ease: 'inOut',
        swaps: { face: 'faceGrit', broFace: 'broBlink', rocket: 'rocket', fx2: 'fxSpark' },
        z: ROCKET_RIDDEN,
      }),
      key(10, mix(RIDE_LIGHT, place('fx2', ...nozzle(RIDE_LIGHT), 0.7, 30)), { ease: 'in' }),
      key(12, mix(RIDE_A, flameAt(RIDE_A, 1.7), trail(-3.6, -4.2, 1.0), trail(3.8, -2.2, 0.8, 'fx2')), {
        ease: 'inOut',
        swaps: {
          ...SHOUT,
          broFace: 'broCheer',
          rocket: 'rocket',
          fxBack: 'fxFlame',
          fx1: 'fxSpeed',
          fx2: 'fxSpeed',
        },
      }),
      key(24, mix(RIDE_B, flameAt(RIDE_B, 1.9), trail(-3.8, -4.6, 1.1), trail(3.6, -2.6, 0.9, 'fx2')), {
        ease: 'inOut',
      }),
      key(36, mix(RIDE_A, flameAt(RIDE_A, 1.7), trail(-3.6, -4.2, 1.0), trail(3.8, -2.2, 0.8, 'fx2')), {
        ease: 'inOut',
      }),
      key(48, mix(RIDE_B, flameAt(RIDE_B, 2.0), trail(-3.8, -4.6, 1.1), trail(3.6, -2.6, 0.9, 'fx2')), {
        ease: 'out',
      }),
      key(49, mix(BLAST, place('hit1', 0.4, -6.0, 1.6)), {
        ease: 'out',
        swaps: { ...HURT, ...OPEN, hit1: 'fxBoom' },
        z: {},
      }),
      key(52, mix(BLAST, { body: { rot: -30 } }, place('hit1', 0.4, -6.4, 2.2, 15)), { ease: 'in' }),
      key(55, mix(BLAST, place('hit1', 0.4, -7.0, 1.4, 30)), { ease: 'linear' }),
      key(56, undefined, { swaps: { ...SCARED, ...OPEN, fx1: 'fxPuff', fx2: 'fxPuff' } }),
      key(56, mix(BLAST, place('fx1', -2.0, -9.0, 0.9), place('fx2', 2.6, -12.0, 0.8))),
      key(
        61,
        mix(clips.helpless!.keys[0]!.pose!, place('fx1', -2.6, -10.0, 0.4), place('fx2', 3.0, -13.0, 0.3)),
      ),
    ],
  ),
};

/** The numbers the clips are keyed to, for the tests. */
export const frameData = { FAF, SPAWNS, GRAB_BOXES };
