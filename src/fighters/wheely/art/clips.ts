import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip, Key } from '../../../render/rig/types';
import { stats, TURN_FLIP, TURN_FRAMES } from '../stats';
import { attacks } from './attacks';
import { revUp } from './revUp';
import { BODY, EXHAUST, WHEEL_R, WHEEL_X, type Pt } from './parts';
import {
  AIR,
  ANGRY,
  BACK,
  BLUR,
  CLOSED,
  DEG,
  DIZZY,
  DOWN,
  FOCUS,
  FRONT,
  HOLD,
  HURT,
  IDLE_FACE,
  LOW,
  PARK,
  REAR,
  SCARED,
  SCOOP,
  SHOUT,
  SQUAT,
  SURPRISED,
  UP,
  UPSIDE_DOWN,
  WHEEL,
  at,
  bob,
  flip,
  fxOn,
  holdEffects,
  honk,
  key,
  mix,
  roll,
  rolling,
  smoke,
  spin,
  squash,
  tilt,
  type Pose,
} from './poses';

const SHIELD = mix(squash(0.9), bob(0.45), tilt(-2, REAR));
const HIT = mix(tilt(-22, REAR), bob(-0.1, 0.3), squash(1.04, 0.97));
const HONK = { ...SHOUT, fx1: 'fxHonk' };

// ---------------------------------------------------------------- ledges

/**
 * Where the front tyre hooks the ledge (rig space): the ledge's top corner while hanging. It matches the engine's
 * hang position: width / 2 + 0.5 out from the corner and 0.85 x height below it (src/sim/movement.ts hangPos).
 */
export const LEDGE_GRIP: [number, number] = [stats.width / 2 + 0.5, -stats.height * 0.85];
const [GX, GY] = LEDGE_GRIP;
/** How far onto the stage the climb and attack getups set his origin (src/sim/actions/ledge.ts). */
const GETUP = stats.width / 2 + 2;

const TURN_LENGTH = TURN_FRAMES - 1;

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The ledge corner in rig space `f` frames into a getup: the engine slides the origin from the hang position to
 * `dist` past the corner by `moveEnd`, rising 1.6 times as fast (src/sim/actions/ledge.ts). Keying the car against
 * the corner keeps it fixed in the world while the origin moves under it.
 */
function corner(f: number, moveEnd: number, dist: number): Pt {
  const t = smooth(Math.min(1, f / moveEnd));
  return [GX - (GX + dist) * t, GY * (1 - Math.min(1, 1.6 * t))];
}

/** The front tyre's centre relative to the corner while hanging: just inside the wall, its tread over the lip. */
const HOOK: Pt = [-0.3, -1.75];
/** How far past the corner the front tyre is when the car comes level (the rear tyre at the top of the wall). */
const LEVEL = 2 * WHEEL_X - WHEEL_R - 0.05;

/** The car tilted `rot` with its front tyre's centre at rig point `w`; the eyes turn part way back upright. */
function hooked(w: Pt, rot: number, extra: Pose = {}): Pose {
  return mix(tilt(rot, WHEEL, w[0] - WHEEL[0], w[1] - WHEEL[1]), { eyes: { rot: -rot * 0.3 } }, extra);
}

/**
 * Climbing the corner at rig point `c`: the front tyre is `u` past it on the stage top and the rear tyre rolls up
 * the wall, so the car comes level at `LEVEL` and drives on from there.
 */
function crawl(c: Pt, u: number, extra: Pose = {}): Pose {
  const cos = Math.min(1, (u + WHEEL_R + 0.05) / (2 * WHEEL_X));
  const lift = lerp(HOOK[1], -WHEEL_R, Math.min(1, Math.max(0, (u - HOOK[0]) / 2)));
  return hooked([c[0] + u, c[1] + lift], -Math.acos(cos) / DEG, mix(spin(roll(u - HOOK[0])), extra));
}

const HANG = crawl([GX, GY], HOOK[0]);

/** A getup's crawl: hold the hang until `start`, come level by `levelAt`, drive to rest `dist` on by `moveEnd`. */
function climb(moveEnd: number, dist: number, start: number, levelAt: number, step = 2): Key[] {
  const end = WHEEL_X + dist;
  const u = (f: number) =>
    f <= start
      ? HOOK[0]
      : f <= levelAt
        ? lerp(HOOK[0], LEVEL, smooth((f - start) / (levelAt - start)))
        : lerp(LEVEL, end, 1 - (1 - (f - levelAt) / (moveEnd - levelAt)) ** 2);
  const keys: Key[] = [];
  for (let f = 0; f <= moveEnd; f += step)
    keys.push(key(f, crawl(corner(f, moveEnd, dist), u(f)), { ease: 'linear' }));
  return keys;
}

/** A body pose relative to the ledge corner `c`, so it stays put in the world while the origin moves. */
function nearCorner(c: Pt, x: number, y: number, rot: number, extra: Pose = {}): Pose {
  return mix({ body: { x: c[0] + x, y: c[1] + y, rot } }, extra);
}

/** Ledge roll: crawl half way up, spring off the lip in a forward somersault and land 25 units in. */
function ledgeRollKeys(): Key[] {
  const [moveEnd, dist, up, land] = [40, 25, 12, 34];
  const keys: Key[] = [];
  const u = (f: number) => lerp(HOOK[0], 2.5, smooth(Math.min(1, Math.max(0, (f - 2) / (up - 2)))));
  for (let f = 0; f <= up; f += 2)
    keys.push(key(f, crawl(corner(f, moveEnd, dist), u(f)), { ease: 'linear' }));
  const from = crawl([0, 0], 2.5).body!;
  const turn = roll(2.5 - HOOK[0]);
  for (let f = up + 2; f <= land; f += 2) {
    const s = (f - up) / (land - up);
    const x = lerp(from.x!, dist, s);
    const y = lerp(from.y!, 0, s) - 8.5 * Math.sin(Math.PI * s);
    keys.push(
      key(f, nearCorner(corner(f, moveEnd, dist), x, y, lerp(from.rot!, 360, s), spin(turn + 420 * s)), {
        ease: 'linear',
      }),
    );
  }
  for (const [f, sink] of [
    [36, 0.5],
    [38, 0.3],
    [40, 0.1],
  ] as const)
    keys.push(
      key(f, nearCorner(corner(f, moveEnd, dist), dist, 0, 360, mix(bob(sink), spin(turn + 420))), {
        ease: 'out',
      }),
    );
  keys.push(key(50, mix({ body: { rot: 360 } }, spin(turn + 420))));
  return keys;
}

/**
 * Ledge jump: the origin rises to 1 over the stage, width / 2 in from the corner, in 6 frames (src/sim/actions/ledge.ts).
 * The car rises up the wall before it swings in, so it clears the corner the engine moves him straight across.
 */
function ledgeJumpKeys(): Key[] {
  const top = mix(AIR, tilt(-12, BODY), spin(roll(5)));
  const c = (f: number): Pt => {
    const t = smooth(Math.min(1, f / 6));
    return [GX - (GX + stats.width / 2) * t, GY + (1 - GY) * t];
  };
  const [x0, y0, r0] = [HANG.body!.x! - GX, HANG.body!.y! - GY, HANG.body!.rot!];
  const [c6x, c6y] = c(6);
  const [x1, y1, r1] = [top.body!.x! - c6x, top.body!.y! - c6y, top.body!.rot!];
  const keys: Key[] = [];
  for (let f = 0; f <= 6; f++) {
    const s = smooth(f / 6);
    const [over, up] = [s ** 3, 1 - (1 - s) ** 2];
    const extra = mix(bob(0, 0.45 * s), spin(roll(5) * s), { eyes: { rot: -r0 * 0.3 * (1 - s) } });
    keys.push(
      key(f, nearCorner(c(f), lerp(x0, x1, over), lerp(y0, y1, up), lerp(r0, r1, up), extra), {
        ease: 'linear',
      }),
    );
  }
  keys.push(key(20, mix(AIR, tilt(-3, BODY), spin(roll(5)))));
  return keys;
}

// ---------------------------------------------------------------- clips

/** Parked: the engine idles, the shell trembles a little and the exhaust puffs. */
const idle: AnimClip = {
  length: 60,
  loop: true,
  swaps: IDLE_FACE,
  keys: [
    key(0, mix(bob(0), { fx4: at(EXHAUST[0] - 0.4, EXHAUST[1], 0.35) }), {
      ease: 'inOut',
      swaps: { fxBack: 'fxPuff0' },
    }),
    key(8, undefined, { swaps: { fxBack: 'fxPuff1' } }),
    key(
      15,
      mix(bob(0.07), { car: { sy: 0.99, sx: 1.005 }, fx4: at(EXHAUST[0] - 1.4, EXHAUST[1] - 0.8, 0.5) }),
      {
        ease: 'inOut',
        swaps: { fxBack: 'fxPuff2' },
      },
    ),
    key(24, undefined, { swaps: { fxBack: 'fxPuff3' } }),
    key(30, mix(bob(0), { fx4: at(EXHAUST[0] - 2.2, EXHAUST[1] - 1.6, 0.55) }), {
      swaps: { fxBack: 'fxPuff4' },
    }),
    key(36, undefined, { swaps: { fxBack: null } }),
    key(45, mix(bob(0.07), { car: { sy: 0.99, sx: 1.005 } })),
  ],
};

/** Rolling at walking pace: one tyre turn per 14 frames is 0.9 units a frame, his walk speed. */
const walk: AnimClip = {
  length: 14,
  loop: true,
  swaps: IDLE_FACE,
  keys: rolling(14, 1, [bob(0.05), bob(-0.03)]),
};

const RUN_A = smoke(mix(tilt(-1.5, REAR), bob(0.06), { fx3: at(-8.9, 0) }), 0.45);
const RUN_B = smoke(mix(tilt(-1, REAR), bob(-0.04), { fx3: at(-9.1, 0.1) }), 0.6);

/** The clips as written, before effects are held between keys (index.test.ts checks their effect lifetimes). */
export const authored: Record<string, AnimClip> = {
  idle,
  walk,
  dash: {
    length: 10,
    swaps: { ...FOCUS, ...BLUR, fx1: 'fxGravel', fxBack: 'fxSmoke' },
    keys: [
      key(0, smoke(mix(SQUAT, tilt(-2, REAR), { fx1: at(-WHEEL_X - 0.3, 0, -0.5, 0, 0.5) }), 0.4), {
        ease: 'out',
      }),
      key(
        4,
        smoke(mix(tilt(-7, REAR), bob(0.12), spin(roll(9)), { fx1: at(-WHEEL_X - 0.8, 0, -1, 0, 1) }), 0.6),
        {
          ease: 'inOut',
        },
      ),
      key(
        10,
        smoke(
          mix(tilt(-2, REAR), bob(0.04), spin(roll(20)), { fx1: at(-WHEEL_X - 1.6, 0, -1.1, 0, 0.7) }),
          0.7,
        ),
      ),
    ],
  },
  /** Flat out (2.5 units a frame): blurred wheels, speed lines and smoke. */
  run: {
    length: 10,
    loop: true,
    swaps: { ...FOCUS, ...BLUR, fx3: 'fxSpeed', fxBack: 'fxSmoke' },
    keys: rolling(10, 2, [RUN_A, RUN_B]),
  },
  runBrake: {
    length: 14,
    swaps: { ...SURPRISED, brake: 'brakeGlow', fx1: 'fxSkid', fx2: 'fxPuff2' },
    keys: [
      key(
        0,
        mix(tilt(6, FRONT), bob(0.2), { fx1: at(WHEEL_X, 0, 0.5), fx2: at(WHEEL_X + 2.2, -0.7, 0.45) }),
        { ease: 'out' },
      ),
      key(6, mix(tilt(4, FRONT), bob(0.15), { fx1: at(WHEEL_X, 0, 1), fx2: at(WHEEL_X + 2.8, -1.2, 0.8) }), {
        ease: 'inOut',
      }),
      key(9, undefined, { swaps: { ...FOCUS, brake: 'brakeGlow', fx1: 'fxSkid', fx2: 'fxPuff3' } }),
      key(
        10,
        mix(tilt(-1.5, REAR), bob(-0.04), { fx1: at(WHEEL_X, 0, 1.1), fx2: at(WHEEL_X + 3.2, -1.6, 0.9) }),
        {
          ease: 'inOut',
        },
      ),
      key(12, undefined, { swaps: { fx1: null, fx2: null, brake: null } }),
      key(14, PARK),
    ],
  },
  /**
   * The three-point turn (src/fighters/wheely/actions.ts): he stamps on the brakes still facing the old way and
   * skids to a stop on locked tyres, swings round as the engine faces him the new way on TURN_FLIP, then spins his
   * tyres and pulls away.
   */
  turn: {
    length: TURN_LENGTH,
    swaps: SURPRISED,
    keys: [
      key(
        0,
        mix(tilt(6, FRONT), bob(0.2), { fx1: at(WHEEL_X, 0, 0.5), fx2: at(WHEEL_X + 2.2, -0.7, 0.45) }),
        { ease: 'out', swaps: { ...SURPRISED, brake: 'brakeGlow', fx1: 'fxSkid', fx2: 'fxPuff2' } },
      ),
      key(5, mix(tilt(5, FRONT), bob(0.2), { fx1: at(WHEEL_X, 0, 1.1), fx2: at(WHEEL_X + 3, -1.3, 0.85) }), {
        ease: 'inOut',
        swaps: { ...FOCUS, brake: 'brakeGlow', fx1: 'fxSkid', fx2: 'fxPuff3' },
      }),
      key(
        8,
        mix(tilt(-2, REAR), bob(-0.05), {
          body: { sx: 0.8 },
          eyes: { x: -0.6 },
          fx2: at(WHEEL_X + 3.4, -1.8, 0.95),
        }),
        { ease: 'in', swaps: { ...BACK, fx2: 'fxPuff3' } },
      ),
      key(TURN_FLIP - 1, mix(bob(-0.3), spin(-60), { body: { sx: 0.4, sy: 1.04 }, eyes: { x: -1 } }), {
        ease: 'linear',
        swaps: { ...BACK, ...BLUR },
      }),
      key(TURN_FLIP, mix(bob(-0.3), spin(-60), { body: { sx: 0.4, sy: 1.04 }, eyes: { x: 1 } }), {
        ease: 'out',
        swaps: { ...ANGRY, ...BLUR },
      }),
      key(
        TURN_FLIP + 2,
        smoke(
          mix(SQUAT, tilt(-4, REAR), spin(240), {
            body: { sx: 1.04 },
            fx1: at(-WHEEL_X - 0.4, 0, -0.6, 0, 0.6),
          }),
          0.5,
        ),
        { ease: 'inOut', swaps: { ...ANGRY, ...BLUR, fx1: 'fxGravel', fxBack: 'fxSmoke' } },
      ),
      key(
        TURN_LENGTH,
        smoke(mix(tilt(-2, REAR), bob(0.04), spin(620), { fx1: at(-WHEEL_X - 1.4, 0, -1, 0, 0.8) }), 0.65),
      ),
    ],
  },
  /** Suspension right down. */
  crouch: {
    length: 6,
    swaps: FOCUS,
    keys: [key(0, PARK, { ease: 'out' }), key(6, LOW)],
  },
  jumpSquat: {
    length: 3,
    swaps: FOCUS,
    keys: [key(0, PARK, { ease: 'out' }), key(3, SQUAT)],
  },
  jump: {
    length: 40,
    swaps: IDLE_FACE,
    keys: [
      key(0, mix(AIR, squash(1.12, 0.92), tilt(-9, BODY)), { ease: 'out', swaps: UP }),
      key(12, mix(AIR, tilt(-6, BODY)), { ease: 'inOut' }),
      key(26, mix(AIR, tilt(-1, BODY)), { swaps: {} }),
      key(40, mix(AIR, tilt(3, BODY))),
    ],
  },
  /** A backflip off a puff of exhaust. */
  doubleJump: {
    length: 30,
    swaps: SHOUT,
    keys: [
      key(0, mix(AIR, squash(1.1, 0.93), { fx4: at(0, 0.6, 0.7) }), {
        ease: 'out',
        swaps: { fxBack: 'fxPuff1' },
      }),
      key(3, mix(AIR, tilt(-40, BODY), { fx4: at(0, 1.2, 1) }), {
        ease: 'linear',
        swaps: { fxBack: 'fxPuff2' },
      }),
      key(8, mix(AIR, tilt(-160, BODY), { fx4: at(0, 1.8, 1.15) }), {
        ease: 'linear',
        swaps: { fxBack: 'fxPuff3' },
      }),
      key(13, mix(AIR, tilt(-280, BODY), { fx4: at(0, 2.3, 1.2) }), {
        ease: 'out',
        swaps: { fxBack: 'fxPuff4' },
      }),
      key(16, undefined, { swaps: { ...IDLE_FACE, fxBack: null } }),
      key(20, mix(AIR, tilt(-360, BODY))),
      key(30, mix(AIR, tilt(-357, BODY))),
    ],
  },
  /** Nose dipping, wheels hanging and idly turning. */
  fall: {
    length: 40,
    loop: true,
    swaps: DOWN,
    keys: rolling(40, 1, [mix(AIR, tilt(4, BODY)), mix(bob(-0.18, 0.55), tilt(6, BODY))]),
  },
  land: {
    length: 4,
    swaps: IDLE_FACE,
    keys: [key(0, SQUAT, { ease: 'out' }), key(4, PARK)],
  },
  /** Braced on the suspension behind the bubble the engine draws. */
  shield: {
    length: 6,
    swaps: ANGRY,
    keys: [key(0, PARK, { ease: 'out' }), key(6, SHIELD)],
  },
  shieldDrop: {
    length: 11,
    swaps: IDLE_FACE,
    keys: [key(0, SHIELD, { ease: 'out' }), key(11, PARK)],
  },
  shieldBreak: {
    length: 40,
    swaps: HURT,
    keys: [
      key(0, mix(squash(1.1, 0.9), tilt(-25, REAR)), { ease: 'out' }),
      key(6, flip(-90, 1.5), { ease: 'linear' }),
      key(12, flip(-180, 2.5), { ease: 'linear' }),
      key(18, flip(-270, 1.5), { ease: 'out' }),
      key(24, mix(flip(-360), SQUAT), { ease: 'out', swaps: DIZZY }),
      key(32, flip(-360)),
      key(40, tilt(-363, REAR)),
    ],
  },
  /** Rocking on his springs with stars over the roof. */
  dizzy: {
    length: 60,
    loop: true,
    swaps: { ...DIZZY, fx1: 'fxStars' },
    keys: [
      key(0, mix(tilt(-3, REAR), bob(0.1), { fx1: at(-0.8, -11.6, 1, -12) })),
      key(30, mix(tilt(3, FRONT), bob(0.1), { fx1: at(0.8, -11.8, 1, 12) })),
    ],
  },
  /** Flattens on his springs, eyes shut, then pops back up. */
  spotDodge: {
    length: 25,
    swaps: IDLE_FACE,
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(3, mix(squash(0.7, 1.16), bob(0.6)), { ease: 'inOut', swaps: CLOSED }),
      key(16, mix(squash(0.74, 1.14), bob(0.55)), { ease: 'outBack' }),
      key(18, undefined, { swaps: {} }),
      key(25, PARK),
    ],
  },
  /** Wheelspin forward and a handbrake turn: the engine faces him back the other way when it ends. */
  rollForward: {
    length: 29,
    swaps: FOCUS,
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(3, mix(SQUAT, tilt(-3, REAR), { fx1: at(-WHEEL_X - 0.3, 0, -0.6, 0, 0.6) }), {
        ease: 'in',
        swaps: { ...BLUR, fx1: 'fxGravel' },
      }),
      key(8, mix(tilt(-6, REAR), bob(0.1), spin(roll(12)), { fx1: at(-WHEEL_X - 1, 0, -1.1, 0, 1) }), {
        ease: 'linear',
      }),
      key(13, mix(bob(0.15), spin(roll(22)), { body: { sx: 0.55 }, fx1: at(2.2, 0, 0.8) }), {
        ease: 'linear',
        swaps: { ...SURPRISED, fx1: 'fxSkid' },
      }),
      key(17, mix(bob(0.2), spin(roll(26)), { body: { sx: -0.35 }, fx1: at(2.2, 0, 1.1) }), { ease: 'out' }),
      key(21, mix(squash(0.94), bob(0.15), spin(roll(27)), { body: { sx: -1 }, fx1: at(2.2, 0, 1.2) }), {
        ease: 'inOut',
        swaps: { fx1: 'fxSkid' },
      }),
      key(24, undefined, { swaps: {} }),
      key(29, mix(spin(roll(27)), { body: { sx: -1 } })),
    ],
  },
  /** Reversing out fast, looking over his shoulder. */
  rollBack: {
    length: 34,
    swaps: BACK,
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(3, mix(SQUAT, tilt(3, FRONT)), { ease: 'in', swaps: BLUR }),
      key(9, mix(tilt(4, FRONT), bob(0.1), spin(-roll(14))), { ease: 'linear' }),
      key(18, mix(tilt(2, FRONT), spin(-roll(27)), { fx1: at(-WHEEL_X, 0, -0.8, 0, 1) }), {
        ease: 'out',
        swaps: { brake: 'brakeGlow', fx1: 'fxSkid' },
      }),
      key(22, mix(tilt(-2.5, REAR), bob(-0.05), spin(-roll(29)), { fx1: at(-WHEEL_X, 0, -1.1, 0, 1) }), {
        ease: 'inOut',
      }),
      key(26, undefined, { swaps: IDLE_FACE }),
      key(34, spin(-roll(29))),
    ],
  },
  /** Twirls round twice in mid-air, eyes shut: a Flash card-flip, never thinner than a fifth of the car. */
  airDodge: {
    length: 49,
    swaps: IDLE_FACE,
    keys: [
      key(0, AIR, { ease: 'out' }),
      ...[2, 8, 14, 20].flatMap((f, i) => {
        const side = i % 2 ? -1 : 1;
        const twirl = (sx: number) => mix(AIR, squash(1.04, 0.96), { body: { sx } });
        return [
          key(f, twirl(side), { ease: 'in', ...(i === 0 ? { swaps: CLOSED } : {}) }),
          key(f + 4, twirl(side * 0.2), { ease: 'step' }),
          key(f + 5, twirl(-side * 0.2), { ease: 'out' }),
        ];
      }),
      key(26, mix(AIR, squash(1.02, 0.98)), { ease: 'inOut' }),
      key(29, undefined, { swaps: {} }),
      key(49, AIR),
    ],
  },
  /** Swings in nose first and hooks the front tyre over the corner. */
  ledgeCatch: {
    length: 8,
    swaps: SURPRISED,
    keys: [
      key(0, hooked([GX + HOOK[0], GY + HOOK[1] - 0.4], -40, bob(0, 0.3)), { ease: 'outBack' }),
      key(4, undefined, { swaps: FOCUS }),
      key(8, HANG),
    ],
  },
  /** Nose up against the wall, the rear tyre scrabbling at it. */
  ledgeHang: {
    length: 60,
    loop: true,
    swaps: FOCUS,
    keys: [
      key(0, mix(HANG, { spinB: { rot: 0 } })),
      key(30, mix(crawl([GX, GY], HOOK[0] + 0.12), { spinB: { rot: 180 }, spinF: { rot: 12 } })),
      key(60, mix(HANG, { spinB: { rot: 360 } })),
    ],
  },
  ledgeClimb: {
    length: 34,
    swaps: ANGRY,
    keys: [
      ...climb(30, GETUP, 3, 17),
      key(22, undefined, { swaps: FOCUS }),
      key(34, mix(bob(0.06), spin(roll(WHEEL_X + GETUP - HOOK[0])))),
    ].sort((a, b) => a.frame - b.frame),
  },
  ledgeRoll: {
    length: 50,
    swaps: ANGRY,
    keys: [
      ...ledgeRollKeys(),
      key(12, undefined, { swaps: CLOSED }),
      key(34, undefined, { swaps: FOCUS }),
      key(42, undefined, { swaps: {} }),
    ].sort((a, b) => a.frame - b.frame),
  },
  ledgeJump: {
    length: 20,
    swaps: UP,
    keys: ledgeJumpKeys(),
  },
  /** Climbs up quickly and rams forward with the bumper. */
  ledgeAttack: {
    length: 55,
    swaps: ANGRY,
    keys: [
      ...climb(20, GETUP, 1, 10),
      key(24, mix(SQUAT, tilt(-4, REAR), spin(roll(WHEEL_X + GETUP + 0.3))), { ease: 'in' }),
      key(
        27,
        mix(tilt(4, FRONT, 1.6), bob(0.1), spin(roll(WHEEL_X + GETUP + 3)), {
          fx1: at(-WHEEL_X - 0.5, 0, -0.9, 0, 0.9),
        }),
        {
          ease: 'out',
          swaps: { ...SHOUT, ...BLUR, fx1: 'fxGravel' },
        },
      ),
      key(33, mix(tilt(1, FRONT, 1.2), spin(roll(WHEEL_X + GETUP + 4))), { ease: 'inOut', swaps: ANGRY }),
      key(55, spin(roll(WHEEL_X + GETUP + 4))),
    ].sort((a, b) => a.frame - b.frame),
  },
  hitstun: {
    length: 20,
    swaps: HURT,
    keys: [
      key(0, HIT, { ease: 'out' }),
      key(6, mix(tilt(-30, REAR), bob(-0.1, 0.4))),
      key(20, mix(tilt(-12, REAR), bob(-0.05, 0.35))),
    ],
  },
  /** Spinning end over end. */
  tumble: {
    length: 30,
    loop: true,
    swaps: DIZZY,
    keys: [0, 1, 2, 3].map((i) =>
      key(i * 10, mix(bob(-0.1, 0.4), tilt(-120 * i, BODY), spin(-120 * i)), { ease: 'linear' }),
    ),
  },
  /** Out of jumps: nose down, eyes wide, smoke from under the hood. */
  helpless: {
    length: 32,
    loop: true,
    swaps: { ...SCARED, fx1: 'fxSmoke' },
    keys: [
      key(0, fxOn(mix(AIR, tilt(14, BODY)), 'fx1', [6.2, -7.4], 0.7)),
      key(16, fxOn(mix(bob(-0.2, 0.55), tilt(10, BODY)), 'fx1', [6.0, -7.9], 0.8)),
    ],
  },
  /** On his roof, wheels turning in the air. */
  knockdown: {
    length: 40,
    loop: true,
    swaps: DIZZY,
    keys: [
      key(0, mix(UPSIDE_DOWN, spin(0)), { ease: 'linear' }),
      key(20, mix(UPSIDE_DOWN, tilt(183, BODY, 0, -0.2), spin(-180)), { ease: 'linear' }),
      key(40, mix(UPSIDE_DOWN, spin(-360))),
    ],
  },
  /** Rocks back, then flips over onto his wheels. */
  getUp: {
    length: 29,
    swaps: HURT,
    keys: [
      key(0, UPSIDE_DOWN, { ease: 'in' }),
      key(5, mix(UPSIDE_DOWN, tilt(172, BODY, -0.4, -0.3), spin(90)), { ease: 'in' }),
      key(10, mix(flip(240), spin(400), { eyes: { rot: 60 } }), { ease: 'linear', swaps: SHOUT }),
      key(14, mix(flip(300), spin(600)), { ease: 'linear' }),
      key(18, mix(flip(360), SQUAT, spin(720)), { ease: 'out', swaps: FOCUS }),
      key(24, mix(tilt(360, BODY), bob(-0.05), spin(720)), { ease: 'inOut' }),
      key(29, mix(tilt(360, BODY), spin(720))),
    ],
  },
  /**
   * A getup roll away from his facing: getupRoll mirrored, on the same frames, rocking forward and flipping
   * backwards onto his wheels. Rotations count down from -180, the roof pose measured the other way round, so the
   * eyes stay upright through the flip.
   */
  getupRollBack: {
    length: 35,
    swaps: HURT,
    keys: [
      key(0, mix(UPSIDE_DOWN, tilt(-180, BODY, 0, -0.25), { eyes: { rot: -180 } }), { ease: 'in' }),
      key(6, mix(UPSIDE_DOWN, tilt(-172, BODY, 0.4, -0.3), { eyes: { rot: -180 } }, spin(-90)), {
        ease: 'in',
      }),
      key(12, mix(flip(-240), spin(-400), { eyes: { rot: -60 } }), { ease: 'linear', swaps: SHOUT }),
      key(17, mix(flip(-300), spin(-600)), { ease: 'linear' }),
      key(22, mix(flip(-360), SQUAT, spin(-720)), { ease: 'out', swaps: FOCUS }),
      key(29, mix(tilt(-360, BODY), bob(-0.05), spin(-720)), { ease: 'inOut' }),
      key(35, mix(tilt(-360, BODY), spin(-720))),
    ],
  },
  /** Hits the floor and bounces straight back onto his wheels. */
  tech: {
    length: 26,
    swaps: CLOSED,
    keys: [
      key(0, mix(SQUAT, tilt(-12, REAR)), { ease: 'out' }),
      key(6, mix(squash(0.9), bob(0.3)), { ease: 'inOut' }),
      key(12, undefined, { swaps: ANGRY }),
      key(26, PARK),
    ],
  },
  /** A barrel roll along the floor. */
  techRoll: {
    length: 40,
    swaps: CLOSED,
    keys: [
      key(0, mix(SQUAT, tilt(-12, REAR)), { ease: 'out' }),
      key(5, flip(70), { ease: 'linear' }),
      key(10, flip(160), { ease: 'linear' }),
      key(15, flip(250), { ease: 'linear' }),
      key(20, flip(340), { ease: 'out' }),
      key(24, mix(flip(360), SQUAT), { ease: 'out', swaps: ANGRY }),
      key(32, flip(360), { ease: 'inOut' }),
      key(40, tilt(360, BODY)),
    ],
  },
  /** Door swung open past square, holding the opponent against the front wing. */
  grabHold: {
    length: 30,
    loop: true,
    swaps: { ...ANGRY, ...SCOOP },
    keys: [key(0, HOLD), key(15, mix(HOLD, bob(0.24), tilt(1, FRONT)))],
  },
  /** Lifted off his wheels, which spin uselessly. */
  grabbed: {
    length: 20,
    loop: true,
    swaps: HURT,
    keys: [
      key(0, mix(tilt(-10, REAR, 0, -0.6), bob(-0.1, 0.4), spin(0))),
      key(10, mix(tilt(-4, REAR, 0, -0.8), bob(-0.1, 0.5), spin(-60))),
    ],
  },
  /** A wheelie and two honks of the horn. */
  taunt: {
    length: 60,
    swaps: IDLE_FACE,
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(6, SQUAT, { ease: 'out', swaps: CLOSED }),
      key(12, honk(mix(tilt(-19, REAR), spin(0, 120)), 0.6), { ease: 'outBack', swaps: HONK }),
      key(19, honk(mix(tilt(-21, REAR), spin(0, 260)), 1.15), { ease: 'in' }),
      key(22, undefined, { swaps: SHOUT }),
      key(24, honk(mix(tilt(-20, REAR), spin(0, 360)), 0.55), { ease: 'out', swaps: HONK }),
      key(32, honk(mix(tilt(-21, REAR), spin(0, 520)), 1.2), { ease: 'in' }),
      key(36, undefined, { swaps: { eyes: 'eyesClosed' } }),
      key(38, mix(tilt(-18, REAR), spin(0, 620)), { ease: 'in' }),
      key(44, mix(SQUAT, spin(0, 720)), { ease: 'out' }),
      key(50, mix(bob(-0.08), spin(0, 720)), { ease: 'inOut', swaps: {} }),
      key(60, spin(0, 720)),
    ],
  },
  ...attacks,
  ...revUp,
  respawn: {
    length: 60,
    loop: true,
    swaps: IDLE_FACE,
    keys: [key(0, bob(0)), key(30, bob(0.07))],
  },
};

const baked = Object.fromEntries(Object.entries(authored).map(([name, clip]) => [name, holdEffects(clip)]));
export const clips: Record<string, AnimClip> = {
  ...baked,
  down: baked.knockdown!,
  getupStand: baked.getUp!,
  /** The same flip, spread over the getup roll's 35 frames while the sim slides him sideways. */
  getupRoll: retimeClip(baked.getUp!, 35),
  techInPlace: baked.tech!,
  /** A tech roll away from the facing: the back roll with its frames moved onto the tech roll's travel. */
  techRollBack: retimeClip(baked.rollBack!, 40, [
    [4, 4],
    [20, 30],
  ]),
};
