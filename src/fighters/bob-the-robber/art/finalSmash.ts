import type { Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { ALL_OUT_ATTACK, DASH, SCENE, finalSmash, finalSmashAir, finalSmashCinematic } from '../finalSmash';
import { LUNGE, STANCE, reachB, reachF, swing, trail } from './attacks';
import {
  AIR,
  ANGRY,
  BACK_ARM_IN_FRONT,
  BATON,
  FRONT_ARM_OVER_HEAD,
  GRIN,
  READY,
  SACK_ON_BACK,
  SHOUT,
  SIDE,
  WIDE,
  continuous,
  feet,
  floor,
  fx,
  hands,
  key,
  mix,
  type Pt,
} from './poses';
import { rig } from './rig';

/**
 * Lights Out's clips (src/fighters/bob-the-robber/finalSmash.ts, Joker's All-Out Attack), frame for frame on the
 * moves.
 *
 * `finalSmash` and `finalSmashAir`: through the 65 frames the others are held he draws the baton and slaps it into
 * his palm twice with a grin, then sinks into a crouch as the shadow pools under him and coils; on 67 he bursts out
 * of it in a long low lunge, baton out level through the catch's three boxes until 77. A whiff skids to a stop
 * (grounded) or drifts (in the air), looks round and settles.
 *
 * `finalSmashCinematic`: he bonks the foe on the catch (frame 1), puts a finger to his lips, and the lights go out
 * on 5 in a Flash iris closing on his "shh" until 22. In the dark only his eyes show; they blink and creep round
 * the foe, a glint catches the raised baton on 76 (scene 1's cut-in), and a fight cloud boils up by 100. Each of
 * scene 1's hits is a baton flash and a spark out of the cloud, and scene 2 carries the flurry on until the cloud
 * bursts on 293, leaving the foe dizzy for the 7% home-run bonk on 313. Then a spotlight finds him (320), loot
 * sack on his back and baton on his shoulder, winking; he winds up in it, and the lights come back on with the
 * launch on 425.
 */

const slot = (name: string) => rig.slots.findIndex((s) => s.name === name);
/** Over the dark, the cloud and the sparks: his eyes; then the baton and its smear when they flash. */
const TOP = slot('fx3');
const EYES_UP = { face: TOP + 0.5 };
const FLASH_UP = { ...EYES_UP, baton: TOP + 0.3, smear: TOP + 0.2 };

/** Where a foe held in front of him stands, for the effects that land on it: its middle and over its head. */
const FOE: Pt = [9.3, -7.5];
const FOE_HEAD: Pt = [9.3, -16.4];

// The activation and the dash ----------------------------------------------------------------------------------

/** Planted (or in the air, knees drawn up), `lean` tipping the body forward, `x` shifting it. */
function base(air: boolean, lean = 0, x = 0, drop = 0.3, back = -1.7, front = 1.6): Pose {
  if (air)
    return mix(AIR, {
      body: { rot: 2 + lean, x },
      neck: { rot: -3 - lean },
      thighF: { rot: -50 },
      shinF: { rot: 70 },
    });
  return feet(
    { body: { rot: 2 + lean, x }, hip: { y: drop }, neck: { rot: -3 - lean } },
    floor(back),
    floor(front),
  );
}

/** Where he holds his open back palm out in front of him for the baton to slap into. */
const PALM: Pt = [4.2, -4.6];
/** The baton in the front fist up at the shoulder, `deg` down into (or up off) the back palm held out in front. */
const tap = (air: boolean, deg: number) =>
  hands(reachB(swing(base(air, 2), [1.6, -7.6], deg), PALM), PALM, null);

/** Crouched low over the pooling shadow, the baton cocked back over his shoulder; `coil` sinks and leans back. */
function crouch(air: boolean, coil: number): Pose {
  const body = air
    ? mix(AIR, {
        body: { rot: 14 - coil * 18, x: -coil * 0.8 },
        neck: { rot: -12 + coil * 6 },
        thighF: { rot: -85 },
        shinF: { rot: 110 },
        thighB: { rot: -55 },
        shinB: { rot: 100 },
      })
    : feet(
        {
          body: { rot: 14 - coil * 18, x: -0.2 - coil * 0.8 },
          hip: { y: 1.8 + coil * 0.4 },
          neck: { rot: -12 + coil * 6 },
        },
        floor(-2.3 - coil * 0.4),
        floor(2.1),
        true,
        [25, 0],
      );
  return hands(swing(body, [-0.4 - coil * 0.6, -7.0 + coil * 0.4], -150 - coil * 15), [1.6, -4.4], null);
}

/** The shadow pool under him (fx4, behind him), grown to `k`; none in the air, with no floor for it. */
const pool = (air: boolean, k: number): Pose => (air ? {} : { fx4: fx(0, 0, 0, k, k) });

/**
 * The dash: a long low lunge, the back leg stretched out behind, the baton level at chest height through the
 * catch's boxes (6.5 up, 5 to 10 ahead); `push` stretches it a touch further.
 */
function dash(air: boolean, push = 0): Pose {
  // The grip sits 0.55 down the fist from the wrist, which the forearm's angle turns: these wrists put the baton
  // along 6.5 up, through the boxes' middles.
  const wrist: Pt = [4.6 + push * 0.3, air ? -6.68 : -6.05];
  const legs = air
    ? mix(AIR, {
        body: { rot: 22, x: 1.4 },
        thighB: { rot: 40 },
        shinB: { rot: 20 },
        thighF: { rot: -70 },
        shinF: { rot: 80 },
      })
    : feet(
        { body: { rot: 24, x: 1.6 + push * 0.2 }, hip: { y: 1.2 }, neck: { rot: -16 } },
        floor(-3.6 - push * 0.2, -0.75),
        floor(3.0),
        false,
        [30, 0],
      );
  return hands(reachF(swing(legs, wrist, 0), wrist), [-3.2, -5.2], null);
}

/** Braking out of a whiffed dash, leaning back with the front heel dug in; in the air, leaning back as he drifts. */
function skid(air: boolean, lean: number): Pose {
  const legs = air
    ? mix(AIR, { body: { rot: -8 + lean, x: -0.4 }, neck: { rot: 6 } })
    : feet(
        { body: { rot: -10 + lean, x: -0.6 }, hip: { y: 0.9 }, neck: { rot: 8 } },
        floor(-1.8),
        floor(3.2),
        false,
        [0, -20],
      );
  return hands(swing(legs, [3.4, -5.6], 25), [-2.0, -6.6], null);
}

const SETTLE_AIR = mix(AIR, { body: { rot: 0 } });

function lightsOut(air: boolean, length: number): AnimClip {
  const settle = air ? SETTLE_AIR : READY;
  const [from, to] = [DASH.from, DASH.to];
  const keys: Key[] = [
    key(0, settle, { ease: 'out' }),
    key(6, swing(base(air, 1), [2.6, -5.8], -60), { ease: 'inOut', swaps: { ...GRIN, ...BATON } }),
    key(12, tap(air, -14), { ease: 'in', z: BACK_ARM_IN_FRONT }),
    key(16, tap(air, 38), { ease: 'out' }),
    key(22, tap(air, -14), { ease: 'in' }),
    key(26, tap(air, 38), { ease: 'out' }),
    key(32, tap(air, -6), { ease: 'inOut' }),
    key(40, mix(crouch(air, 0), pool(air, 0.25)), {
      ease: 'out',
      swaps: { ...ANGRY, ...BATON, fxBack: air ? null : 'shadowPool' },
      z: {},
    }),
    key(52, mix(crouch(air, 0.2), pool(air, 1)), { ease: 'inOut' }),
    key(60, mix(crouch(air, 0.1), pool(air, 1.05)), { ease: 'in' }),
    key(from - 1, mix(crouch(air, 1), pool(air, 1.1)), { ease: 'linear' }),
    // Out of the shadow it goes "poof" behind him as he goes.
    key(from, mix(dash(air), { fx4: fx(-3.4, 0.4, 0, 0.9) }), {
      ease: 'out',
      swaps: { ...SHOUT, ...BATON, fxBack: 'shadowBurst' },
    }),
    key(from + 3, mix(dash(air, 1), { fx4: fx(-5.6, 0.6, 0, 1.25) }), { ease: 'linear' }),
    key(from + 5, mix(dash(air, 1), { fx4: fx(-6.4, 0.6, 0, 0.3) }), {
      ease: 'inOut',
      swaps: { ...SHOUT, ...BATON },
    }),
    key(to, dash(air, 0.6), { ease: 'out' }),
    key(to + 4, skid(air, 0), { ease: 'out', swaps: { ...WIDE, ...BATON } }),
    key(to + 12, skid(air, 3), { ease: 'inOut' }),
  ];
  if (air)
    keys.push(
      key(to + 22, swing(mix(SETTLE_AIR, { neck: { rot: -6 } }), [2.6, -5.6], 40), {
        ease: 'inOut',
        swaps: { ...SIDE, ...BATON },
      }),
      key(length, settle, { swaps: SIDE }),
    );
  else
    keys.push(
      key(to + 22, swing(base(false, -2), [2.4, -5.0], 34), { ease: 'inOut', swaps: { ...SIDE, ...BATON } }),
      key(to + 30, swing(base(false, 3), [2.4, -5.0], 38), {
        ease: 'inOut',
        swaps: { ...SIDE, ...BATON, face: 'face3qBlink' },
      }),
      key(to + 33, undefined, { swaps: { ...SIDE, ...BATON } }),
      key(length - 6, swing(READY, [2.6, -5.0], 40), { ease: 'inOut', swaps: SIDE }),
      key(length, settle),
    );
  return { length, active: [[from, to]], swaps: SIDE, keys: continuous(keys) };
}

// The cinematic --------------------------------------------------------------------------------------------------

/** A spark on `at` (fx3), scaled `s`, turned `rot`. */
const spark = (at: Pt, s: number, rot = 0): Pose => ({ fx3: fx(at[0], at[1], rot, s) });
/** The fight cloud over him and the foe (fx2), its boil squashing it a little either way on beat `k`. */
const cloud = (k: number, s = 1): Pose => ({
  fx2: fx(4.8, -7.6 + (k % 2 ? 0.25 : -0.15), 0, s * (k % 2 ? 1.04 : 0.98), s * (k % 2 ? 0.96 : 1.03)),
});

/** Bonking the foe on the catch: lunging, the baton angled down onto its middle. */
const CATCH_HIT = reachF(swing(mix(LUNGE, { body: { rot: 12, x: 1.2 } }), [5.0, -7.6], 12), [5.0, -7.6]);
/** Upright, the baton put away, a finger to his lips: "shh". */
const SHUSH = hands(
  feet({ body: { rot: -2 }, hip: { y: 0.2 }, neck: { rot: 4 } }, floor(-1.4), floor(1.4)),
  [-1.0, -4.0],
  [1.7, -7.9],
  -1,
);
/** His face in SHUSH, where the iris closes. */
const FACE: Pt = [0.7, -9.6];
/** The iris over the dark: `s` scales the hole's radius of 10 (0.32 leaves a pinhole of 3.2 on his face). */
const IRIS_STEPS = [26, 10, 4, 1.7, 0.75, 0.32];
const iris = (s: number): Pose => ({ fxDark: fx(FACE[0], FACE[1], 0, s) });

/** Creeping in a low crouch, shifted `x` and lifted `y`, so his glowing eyes move round in the dark. */
const creep = (x: number, y = 0, lean = 14): Pose =>
  feet(
    { body: { rot: lean, x, y: -y }, hip: { y: 1.6 }, neck: { rot: -10 } },
    floor(-2.2 + x),
    floor(2.0 + x),
    true,
    [20, 0],
  );

/**
 * The flurry's blows, each a wind-up and a strike that reaches the foe from somewhere else round it, with where on
 * the foe its spark lands: high from above, low along the floor, across, and down from a jump.
 */
const BLOWS: { wind: Pose; hit: Pose; at: Pt; back: boolean; squash?: number }[] = [
  {
    wind: swing(creep(0.6, 0, 4), [0.4, -9.6], -150),
    hit: swing(creep(1.6, 0, 16), [4.8, -8.6], 18),
    at: [9.0, -9.8],
    back: false,
  },
  {
    wind: swing(creep(1.0, -0.6, 22), [1.6, -3.2], 150, -1),
    hit: swing(creep(1.8, -0.6, 26), [4.6, -3.4], -4, -1),
    at: [8.6, -4.6],
    back: true,
    squash: 0.4,
  },
  {
    wind: swing(creep(-0.4, 1.4, -6), [-1.2, -7.2], -175),
    hit: swing(creep(1.2, 1.4, 10), [5.0, -7.2], -6),
    at: [9.6, -7.8],
    back: false,
  },
  {
    wind: swing(creep(1.4, 4.2, 0), [1.8, -13.4], -110),
    hit: swing(creep(2.4, 3.0, 20), [5.2, -9.6], 40),
    at: [9.2, -12.2],
    back: false,
  },
];

/**
 * One baton flash out of the cloud on `frame`: wind up 4 frames before in the dark, then the baton and its smear
 * show over the cloud with a spark on the foe, shrinking for two frames, gone by frame + 5. Spark scale `s`.
 */
function flash(frame: number, i: number, s: number): Key[] {
  const b = BLOWS[i % BLOWS.length]!;
  const lit = { ...CLOUD, ...BATON, smear: 'smear150', fx3: 'spark' };
  return [
    key(frame - 4, mix(b.wind, cloud(i)), { ease: 'in', swaps: CLOUD, z: EYES_UP }),
    key(frame, mix(trail(b.hit, b.back, 0.3, b.squash), cloud(i + 1), spark(b.at, s, i * 25)), {
      ease: 'out',
      swaps: lit,
      z: FLASH_UP,
    }),
    key(frame + 2, mix(b.hit, cloud(i + 1), spark(b.at, s * 0.6, i * 25 + 15)), {
      ease: 'out',
      swaps: { ...lit, smear: null },
    }),
    key(frame + 5, mix(creep(1.0 + (i % 3) - 1, (i % 2) * 1.2), cloud(i)), {
      ease: 'inOut',
      swaps: CLOUD,
      z: EYES_UP,
    }),
  ];
}

/** Swap sets: a key's swaps replace the last key's, so each names everything shown from then on. */
const CATCH = { ...SHOUT, ...BATON, smear: 'smear150', fx3: 'spark' };
const HUSH = { ...SIDE, face: 'face3qShush', handF: 'point' };
const IRIS = { ...HUSH, dark: 'darkIris' };
const EYES = { ...SIDE, face: 'face3qShadow', dark: 'dark' };
const CLOUD = { ...EYES, fx2: 'fightCloud' };
const DIZZY = { ...EYES, fx2: 'stars' };
const LIT_BATON = { ...DIZZY, ...BATON };
const SPOT = { ...GRIN, ...BATON, ...SACK_ON_BACK, dark: 'darkSpot', fx1: 'spotBeam', fx2: 'stars' };
const FINISH = { ...SHOUT, ...BATON, smear: 'smear90', fx3: 'spark' };

/** The ring of stars over the dizzy foe, swaying side to side on beat `k` as Bob's own dizzy clip does. */
const stars = (k: number): Pose => {
  const side = k % 2 ? 1 : -1;
  return { fx2: fx(FOE_HEAD[0] + 0.6 * side, FOE_HEAD[1], 6 * side, -1.3 * side, 1.3) };
};

/** Stood tall in the spotlight, the baton held upright at his chest, `tap` tipping it forward. */
const BOW = (tapUp = 0): Pose =>
  swing(
    feet({ body: { rot: -5 }, hip: { y: 0.1 }, neck: { rot: 5 } }, floor(-1.5), floor(1.5)),
    [2.6, -5.4],
    -78 + tapUp,
  );
/** Winding up for the launch: low, turned to the foe, the baton swung back down behind him. */
const BACKSWING = swing(
  feet(
    { body: { rot: 18, x: -0.4 }, hip: { y: 1.4 }, neck: { rot: -10 } },
    floor(-2.4),
    floor(2.2),
    false,
    [20, 0],
  ),
  [-1.2, -3.4],
  172,
  -1,
);
/** On the way into the backswing: the baton up over his head. */
const RAISE = swing(
  feet({ body: { rot: 4 }, hip: { y: 0.8 }, neck: { rot: -6 } }, floor(-2.0), floor(2.0)),
  [0.6, -10.6],
  -100,
);
/** The launch: up and through at 60 degrees, the baton's tip high in front. */
const UPPERCUT = reachF(
  swing(
    feet(
      { body: { rot: 2, x: 1.4 }, hip: { y: 0.6 }, neck: { rot: -6 } },
      floor(-2.4, -0.4),
      floor(2.8),
      false,
      [20, 0],
    ),
    [5.0, -9.4],
    -60,
  ),
  [5.0, -9.4],
);
/** The home-run bonk down onto the dizzy foe: lunging, the baton angled down onto its head. */
const UPPERCUT_DOWN = reachF(swing(mix(LUNGE, { body: { rot: 18, x: 1.4 } }), [5.2, -9.8], 24), [5.2, -9.8]);

const FOLLOW = swing(
  feet({ body: { rot: -8, x: 0.6 }, hip: { y: 0.3 } }, floor(-2.0), floor(2.4)),
  [2.6, -12.2],
  -95,
);
const BATON_READY = swing(STANCE, [2.6, -5.8], -60);

/** Scene 2's flurry carries on with blows that only show, between scene 1's last hit and the cloud bursting. */
const SHOW_ONLY = [232, 246, 258, 270, 282];

function cinematic(): AnimClip {
  const { one, two, launch } = SCENE;
  const length = finalSmashCinematic.faf - 1;
  const scene1 = ALL_OUT_ATTACK.sceneHits.map((f) => one + f);
  const finish = two + ALL_OUT_ATTACK.finishHit;
  const keys: Key[] = [
    key(0, dash(false, 0.6), { ease: 'out', swaps: { ...SHOUT, ...BATON } }),
    key(1, mix(trail(CATCH_HIT, false, 0.3), spark(FOE, 1.6)), { ease: 'out', swaps: CATCH }),
    key(3, mix(CATCH_HIT, spark(FOE, 0.8, 20)), { ease: 'inOut', swaps: { ...CATCH, smear: null } }),
    // "Shh": the lights go out in an iris closing on his face.
    key(SCENE.dark - 1, SHUSH, { ease: 'out', swaps: HUSH, z: FRONT_ARM_OVER_HEAD }),
    // The hole's radius shrinks by about the same factor each key, so the close reads at an even pace.
    ...IRIS_STEPS.map((s, i) =>
      key(SCENE.dark + 2 * i, mix(SHUSH, iris(s)), { ease: 'linear', swaps: IRIS }),
    ),
    key(22, mix(SHUSH, { neck: { rot: 6 } }, iris(0.3)), { ease: 'step' }),
    // In the dark: only his eyes, blinking, then creeping round the foe.
    key(23, creep(0), { ease: 'inOut', swaps: EYES, z: EYES_UP }),
    key(30, creep(0, 0.2), { ease: 'step', swaps: { ...EYES, face: null } }),
    key(33, creep(0, 0.2), { ease: 'inOut', swaps: EYES }),
    key(44, creep(-2.4, 0, 8), { ease: 'inOut' }),
    key(56, creep(-1.6, 0.4, 8), { ease: 'inOut' }),
    key(68, creep(2.6, 0.6, 18), { ease: 'in' }),
    // Scene 1's cut-in: the baton raised, a glint running up it.
    key(74, swing(creep(1.4, 1.2, 0), [1.0, -11.4], -100), {
      ease: 'out',
      swaps: { ...EYES, ...BATON },
      z: FLASH_UP,
    }),
    key(76, mix(swing(creep(1.4, 1.4, 0), [1.0, -11.6], -100), spark([1.5, -18.2], 1.4)), {
      ease: 'out',
      swaps: { ...EYES, ...BATON, fx3: 'spark' },
    }),
    key(82, mix(swing(creep(1.4, 1.4, 0), [1.0, -11.6], -100), spark([1.4, -18.6], 0.2, 40)), { ease: 'in' }),
    key(86, creep(2.2, 0.4, 16), { ease: 'in', swaps: EYES, z: EYES_UP }),
    // The fight cloud boils up over the two of them.
    key(90, mix(creep(2.4, 0.4, 16), cloud(0, 0.15)), { ease: 'outBack', swaps: CLOUD }),
    key(one + 80, mix(creep(1.0, 0.8), cloud(1)), { ease: 'inOut' }),
    ...scene1.flatMap((f, i) => flash(f, i, 1.8)),
    ...SHOW_ONLY.flatMap((f, i) => flash(f, i + 3, 1.1)),
    // The cloud bursts and the foe is left dizzy for the finish.
    key(289, mix(creep(1.6, 0.6), cloud(0, 1.12)), { ease: 'in', swaps: CLOUD, z: EYES_UP }),
    key(293, mix(creep(0.2, 2.4, 0), { fx2: fx(4.8, -7.6 + 6 * 1.9, 0, 1.9) }), {
      ease: 'out',
      swaps: { ...EYES, fx2: 'shadowBurst' },
    }),
    key(298, mix(creep(-0.4, 2.0, -4), stars(1)), { ease: 'inOut', swaps: DIZZY }),
    key(302, mix(swing(creep(-0.8, 1.8, -10), [-1.0, -6.4], -170), stars(2)), {
      ease: 'inOut',
      swaps: LIT_BATON,
      z: FLASH_UP,
    }),
    key(finish - 4, mix(swing(creep(0, 2.6, 0), [1.4, -12.6], -90), stars(3)), { ease: 'in' }),
    key(finish, mix(trail(UPPERCUT_DOWN, false, 0.4), stars(4), spark([8.8, -12.6], 2.6, 10)), {
      ease: 'out',
      swaps: { ...LIT_BATON, smear: 'smear150', fx3: 'spark' },
    }),
    key(finish + 3, mix(UPPERCUT_DOWN, stars(5), spark([8.8, -12.6], 1.2, 30)), {
      ease: 'out',
      swaps: { ...LIT_BATON, fx3: 'spark' },
    }),
    key(finish + 6, mix(creep(0.6, 0.2, 10), stars(6)), { ease: 'inOut', swaps: DIZZY, z: EYES_UP }),
    // The spotlight finds him, loot sack on his back, as scene 2 cuts to its splash.
    key(two + 100, mix(BOW(), stars(0)), { ease: 'inOut', swaps: SPOT, z: FRONT_ARM_OVER_HEAD }),
    key(336, mix(BOW(), stars(2)), { ease: 'step', swaps: { ...SPOT, face: 'face3qBlink' } }),
    key(342, mix(BOW(), stars(3)), { ease: 'inOut', swaps: SPOT }),
    key(362, mix(BOW(16), stars(5)), { ease: 'inOut' }),
    key(368, mix(BOW(), stars(6)), { ease: 'inOut' }),
    key(374, mix(BOW(16), stars(7)), { ease: 'inOut' }),
    key(380, mix(BOW(), stars(8)), { ease: 'inOut' }),
    key(400, mix(swing(STANCE, [2.4, -6.2], -40), stars(10)), { ease: 'in', swaps: { ...SPOT, ...ANGRY } }),
    key(410, mix(RAISE, stars(11)), { ease: 'inOut' }),
    key(launch - 4, mix(BACKSWING, stars(12)), { ease: 'in', z: {} }),
    // Lights on: the launch.
    key(launch, mix(trail(UPPERCUT, true, 0.4), spark([9.0, -10.4], 2.2, -30)), {
      ease: 'out',
      swaps: FINISH,
    }),
    key(launch + 3, mix(UPPERCUT, spark([9.2, -11.4], 1.0)), {
      ease: 'out',
      swaps: { ...FINISH, smear: null },
    }),
    key(launch + 6, FOLLOW, { ease: 'inOut', swaps: { ...GRIN, ...BATON } }),
    key(launch + 14, BATON_READY, { ease: 'inOut' }),
    key(length, BATON_READY),
  ];
  return { length, active: [[launch, launch]], swaps: SIDE, keys: continuous(keys) };
}

export const finalSmashClips: Record<string, AnimClip> = {
  finalSmash: lightsOut(false, finalSmash.faf - 1),
  finalSmashAir: lightsOut(true, finalSmashAir.faf - 1),
  finalSmashCinematic: cinematic(),
};
