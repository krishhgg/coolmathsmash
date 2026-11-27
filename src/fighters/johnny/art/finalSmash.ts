import type { Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { MAX_UPGRADE } from '../finalSmash';
import { star, trail } from './attacks';
import { aim, hold } from './laser';
import {
  BACK_ARM_IN_FRONT,
  FISTS,
  FIST_B,
  FRONT_LEG_IN_FRONT,
  GRIT,
  SHOUT,
  SMIRK,
  STANCE,
  between,
  elbows,
  feet,
  fist,
  key,
  leg,
  mix,
  onFloor,
  shortTurns,
  type Pt,
} from './poses';

/**
 * Max Upgrade's clips (src/fighters/johnny/finalSmash.ts), frame for frame on the moves. `finalSmash`: through the
 * activation freeze he buys every upgrade at once, flexing in a coin-gold aura with upgrade chevrons rising through
 * it; on frame 41 his boots light, and from 42 to 65 he flies level on their jets in a fist-first tackle; then he
 * brakes. `finalSmashCinematic`: the trap. A shoulder (hit 1, frame 2), an uppercut (hit 2, 12), the gun drawn, then
 * hovering on his boot jets he trades point-blank laser shots and far-hand punches (hits 3-16, 24 to 102), a Power
 * Punch (hit 17, 116), a leap and a falling axe kick (hit 18, 128), and the Upgraded Laser fired into them at point
 * blank (the release, 142), bursting where it hits.
 */

const { dash, holds, release } = MAX_UPGRADE;

/** Where the trapped fighter's middle and head are, rig space: held 9.5 in front of his feet. */
const VICTIM: Pt = [9.5, -7.5];
const CHIN: Pt = [9.0, -12.0];

/** Swap sets: each names everything shown from its key on (a key's swaps replace the last key's). */
const JETS = { jetB: 'bootJet', jetF: 'bootJet' };
const SMALL_JETS = { jetB: 'bootJetSmall', jetF: 'bootJetSmall' };
const AURA = { fxAura: 'upgradeAura' };
const GUN = { foreF: 'gun', foreFLine: 'gunLine' };

/** The aura on his middle, scaled `s` (1: AURA_RADIUS). */
const aura = (s: number, at: Pt = [0, -9]): Pose => ({ fx4: { x: at[0], y: at[1], sx: s, sy: s } });

/** A key whose swaps and pose take over on `frame`, tweening on with `ease`. */
const at = (
  frame: number,
  pose: Pose,
  swaps: Record<string, string | null>,
  ease: Key['ease'] = 'inOut',
): Key => key(frame, pose, { ease, swaps });

// --- finalSmash: power up, light the boots, fly in fist first, brake. --------------------------------------

/** Feet wide and planted, chest out. `sink` drops the hips. */
const planted = (sink: number, lean = 0): Pose =>
  feet({ hip: { y: 0.5 + sink }, body: { rot: lean }, neck: { rot: -6 } }, [3.6, 0], [-3.0, 0]);

/** Fists clenched low at his hips, shoulders back: the moment he buys it all. */
const CLENCH = fist(fist(planted(0.3, -3), 'B', [4.4, -5.2]), 'F', [-2.8, -5.4], 1, 1);
/** A double-biceps flex: elbows out at shoulder height, fists by his ears. */
const flex = (sink: number): Pose =>
  fist(fist(planted(sink, -2), 'B', [4.6, -14.4], 1, -1), 'F', [-3.6, -14.2], 1, 1);
/** Crouched to launch, fists cocked back, the boots lighting. */
const LAUNCH = fist(
  fist(
    feet({ body: { rot: 14, x: -0.6 }, hip: { y: 1.8 }, neck: { rot: -10 } }, [3.0, 0], [-3.6, 0]),
    'B',
    [0.8, -7.6],
  ),
  'F',
  [-1.8, -8.2],
  1,
  1,
);

/**
 * Flying level fist first: body laid out along the flight, the near fist driven out ahead over the trap box, the far
 * fist at his chest, legs trailing with the soles turned back so the jets push him.
 */
function flight(wobble: number): Pose {
  const base: Pose = { body: { rot: 64 + wobble, x: 0.6, y: -1.2 }, neck: { rot: -40 }, hip: { y: 0 } };
  const armed = fist(fist(base, 'F', [11.0, -9.8 - wobble * 0.08], 1.45, 1), 'B', [4.4, -7.4]);
  return leg(leg(armed, 'B', [-9.6, -7.6 + wobble * 0.1], 100, 1.35), 'F', [-9.0, -5.6], 94, 1.35);
}
const FLIGHT_FX = (wobble: number): Pose =>
  mix(flight(wobble), { fx3: trail([-19, -7.6], [-4.5, -7.6], 3.4) });

/** Touching down out of the flight: legs swung down under him, still leaning in, the near fist coming back. */
const TOUCHDOWN = fist(
  fist(
    feet({ body: { rot: 30, x: 1.6, y: -0.6 }, hip: { y: 0.2 } }, [1.6, -0.4], [-2.6, -0.8]),
    'F',
    [8.0, -9.8],
    1.2,
    1,
  ),
  'B',
  [5.6, -8.2],
);

/** Braking: heels dug in, leaning back, the near fist pulled in. */
const BRAKE = fist(
  fist(feet({ body: { rot: -12, x: -0.8 }, hip: { y: 1.1 } }, [5.0, 0], [-1.6, 0]), 'B', [6.2, -9.0]),
  'F',
  [1.0, -10.0],
  1,
  1,
);

function dashClip(): AnimClip {
  const length = MAX_UPGRADE.faf - 1;
  const keys: Key[] = [
    key(0, STANCE, { ease: 'linear' }),
    at(3, mix(CLENCH, aura(0.35)), { ...SHOUT, ...FISTS, ...AURA }, 'linear'),
  ];
  // Buying it all: the aura swells while he flexes, rocking with each upgrade as it clicks on.
  for (let f = 8, i = 0; f <= 32; f += 6, i++)
    keys.push(
      key(f, mix(flex(i % 2 ? 0.55 : 0.2), aura(0.6 + i * 0.1 + (i % 2) * 0.06)), {
        ease: f === 32 ? 'linear' : 'inOut',
      }),
    );
  keys.push(
    at(36, mix(LAUNCH, aura(0.7)), { ...GRIT, ...FISTS, ...AURA, ...SMALL_JETS }, 'in'),
    // Lifting off as the boots light: already a third of the way into the flight.
    at(
      40,
      mix(between(mix(LAUNCH, { body: { rot: 18, x: -0.8 } }), flight(0), 0.3), aura(0.25)),
      { ...GRIT, ...FISTS, ...JETS },
      'in',
    ),
    at(dash.from - 1, FLIGHT_FX(0), { ...SHOUT, ...FISTS, ...JETS, fxBack: 'smear' }, 'linear'),
  );
  for (let f = dash.from + 3, i = 0; f < dash.to; f += 4, i++)
    keys.push(key(f, FLIGHT_FX(i % 2 ? 2 : -2), { ease: 'inOut' }));
  keys.push(
    key(dash.to, FLIGHT_FX(0), { ease: 'linear' }),
    key(dash.to + 1, undefined, { swaps: { ...SHOUT, ...FISTS, ...JETS } }),
    // Swinging his legs down under him over three frames to touch down.
    at(dash.to + 2, between(flight(0), TOUCHDOWN, 0.7), { ...GRIT, ...FISTS, ...SMALL_JETS }, 'linear'),
    key(dash.to + 3, TOUCHDOWN, { ease: 'out' }),
    key(dash.to + 5, BRAKE, { ease: 'out' }),
    at(dash.to + 9, BRAKE, { ...GRIT, ...FISTS }, 'inOut'),
    key(length, STANCE, { swaps: {} }),
  );
  return onFloor(
    { length, active: [[dash.from, dash.to]], swaps: { ...GRIT, ...FISTS }, keys: shortTurns(elbows(keys)) },
    false,
  );
}

// --- finalSmashCinematic: the barrage on the trapped opponent. -----------------------------------------------

/** The shoulder that traps them: the tail of the flight, landing. */
const SHOULDER = fist(
  fist(feet({ body: { rot: 26, x: 2.4 }, hip: { y: 0.7 } }, [5.0, 0], [-1.6, 0]), 'B', [6.0, -7.2]),
  'F',
  [2.6, -7.8],
  1,
  1,
);
/** Dipped for the uppercut, far fist low. */
const DIP = fist(
  fist(feet({ body: { rot: 10, x: 0.6 }, hip: { y: 1.9 } }, [4.0, 0], [-2.6, 0]), 'B', [3.4, -4.6]),
  'F',
  [1.0, -8.6],
  1,
  1,
);
/** The far fist driven up under the chin. */
const UPPER = fist(
  fist(feet({ body: { rot: -6, x: 0.8 }, hip: { y: 0.4 } }, [3.6, 0], [-2.2, 0]), 'B', [8.4, -13.0], 1.25),
  'F',
  [0.6, -9.6],
  1,
  1,
);

/** How high the boot jets hold him through the barrage: the small jets end a unit above the floor. */
const HOVER = 2.6;

/**
 * Hovering on the boot jets: knees bent, boots HOVER off the floor with the soles down. `bob` lifts him a little.
 */
function hover(bob: number, lean = 4): Pose {
  const up = HOVER + bob;
  return feet({ body: { rot: lean, x: 0.4, y: -up }, hip: { y: 0.8 } }, [3.0, -up], [-2.4, -up]);
}
/** The gun drawn, its muzzle on `tip` and tilted `tilt`, the far fist cocked at his chest. */
const gunAt = (base: Pose, tip: Pt, tilt = 0): Pose => fist(aim(base, tip, tilt), 'B', [3.8, -9.0]);

/** A point-blank laser shot: muzzle flash at the muzzle, an impact star where it lands. */
function shot(bob: number, y: number): Pose {
  const tip: Pt = [6.6, y];
  return mix(gunAt(hover(bob, 6), tip, 0), {
    fx1: { x: tip[0], y: tip[1], sx: 1.8, sy: 1.6 },
    fx2: { ...star([VICTIM[0], y], 1.4), rot: 12 },
  });
}
/** The far fist thrown past the gun into them. */
function punch(bob: number, y: number): Pose {
  const base = hover(bob, 10);
  return mix(fist(hold(base, [2.4, -8.2], 30), 'B', [VICTIM[0] - 0.6, y], 1.3), {
    fx2: star([VICTIM[0], y], 1.5),
  });
}
/** The gun drawn as the jets lift him, held low and tilted down. */
const DRAW = hold(hover(0, 2), [2.2, -7.6], 35);
/** Between hits: the gun back level, the far fist back. */
const reset = (bob: number): Pose => gunAt(hover(bob, 3), [5.6, -9.6], -6);

const SHOT_SWAPS = { ...SHOUT, ...GUN, ...FIST_B, ...SMALL_JETS, fx1: 'muzzleFlash', fx2: 'impact' };
const PUNCH_SWAPS = { ...SHOUT, ...GUN, ...FIST_B, ...SMALL_JETS, fx2: 'impact' };
const HOVER_SWAPS = { ...GRIT, ...GUN, ...FIST_B, ...SMALL_JETS };

/** Power Punch's wind-up and strike, the gun held back out of the way. */
const PUNCH_WIND = fist(
  hold(feet({ body: { rot: -14, x: -0.8 }, hip: { y: 0.7 } }, [3.2, 0], [-2.8, 0]), [-1.6, -7.8], 60),
  'B',
  [0.8, -10.6],
);
const POWER_PUNCH = mix(
  fist(
    hold(feet({ body: { rot: 16, x: 2.2 }, hip: { y: 0.7 } }, [5.6, 0], [-2.0, 0]), [0.4, -7.8], 50),
    'B',
    [10.2, -10.2],
    1.3,
  ),
  { fx2: star([10.6, -10.2], 2.0), fx3: trail([3.0, -10.2], [9.8, -10.2], 1.8) },
);
/** The leap: up on the jets, the near knee chambered high for the axe kick. */
const LEAP = leg(
  fist(
    gunAt(
      feet({ body: { rot: -8, y: -6.0 }, hip: { y: 0.2 } }, [2.0, -6.4], [-1.0, -6.2]),
      [5.0, -14.0],
      -40,
    ),
    'B',
    [3.0, -14.6],
  ),
  'F',
  [5.4, -18.6],
  -100,
  1.5,
);
/** Coming down: the near heel chopped onto them. */
const AXE = mix(
  leg(
    fist(
      gunAt(
        feet({ body: { rot: 6, y: -2.0 }, hip: { y: 0.4 } }, [3.2, -1.4], [-1.2, -1.2]),
        [4.0, -12.0],
        -30,
      ),
      'B',
      [3.6, -11.6],
    ),
    'F',
    [8.4, -10.4],
    -40,
    1.55,
  ),
  { fx2: star(CHIN, 1.6), fx3: trail([7.2, -20.0], [8.8, -11.0], 1.6) },
);
/** Landed, gun up and steadied in both hands, charging the Upgraded Laser. */
const BRACE = feet({ body: { rot: 4, x: 0.3 }, hip: { y: 0.6 }, armF: { x: 0.85 } }, [3.6, 0], [-2.6, 0]);
const charge = (s: number): Pose =>
  mix(fist(aim(BRACE, [6.2, -9.6]), 'B', [2.8, -8.4]), aura(s, [6.4, -9.6]));
/** The Upgraded Laser into them: a huge flash, the burst where it hits, the kick rocking him back. */
const BLAST = mix(fist(aim(BRACE, [6.2, -9.6]), 'B', [2.8, -8.4]), {
  fx1: { x: 6.2, y: -9.6, sx: 3.0, sy: 2.6 },
  fx2: { x: VICTIM[0] + 1, y: VICTIM[1], sx: 0.62, sy: 0.62 },
});
const KICK = mix(fist(aim(mix(BRACE, { body: { rot: -4, x: -0.6 } }), [4.8, -11.2], -26), 'B', [2.2, -8.6]), {
  fx2: { x: VICTIM[0] + 1.6, y: VICTIM[1], sx: 0.68, sy: 0.68 },
});
const LOWER = hold(mix(BRACE, { body: { rot: 1 } }), [1.0, -5.4], 45);
/** Back on the floor after the axe kick, knees bent, the gun coming round. */
const LANDED = fist(
  gunAt(feet({ body: { rot: 8, x: 0.6 }, hip: { y: 1.6 } }, [3.6, 0], [-2.4, 0]), [5.4, -8.4], 10),
  'B',
  [3.4, -8.0],
);

function cinematicClip(): AnimClip {
  const length = MAX_UPGRADE.cinematicFaf - 1;
  type Swaps = Record<string, string | null>;
  /** A strike held from the frame before hit frame `f` to the frame after; its effects go on `f + 2`. */
  const hit = (f: number, pose: Pose, swaps: Swaps, after: Swaps, z?: Record<string, number>) => [
    key(f - 1, pose, { ease: 'linear', swaps, ...(z ? { z } : {}) }),
    key(f + 1, pose, { ease: 'linear' }),
    key(f + 2, undefined, { swaps: after }),
  ];
  const fists = { ...GRIT, ...FISTS };
  const armed = { ...GRIT, ...GUN, ...FIST_B };
  const keys: Key[] = [
    ...hit(
      holds.catch,
      mix(SHOULDER, { fx2: star([7.4, -9.2], 1.6) }),
      { ...SHOUT, ...FISTS, fx2: 'impact' },
      fists,
    ),
    key(holds.catch + 3, SHOULDER, { ease: 'inOut' }),
    key(holds.tackle - 4, DIP, { ease: 'linear' }),
    ...hit(
      holds.tackle,
      mix(UPPER, { fx2: star(CHIN, 1.6), fx3: trail([7.4, -5.0], [8.4, -12.4], 1.4) }),
      { ...SHOUT, ...FISTS, fx2: 'impact', fxBack: 'smear' },
      fists,
    ),
    // Drawing the gun as the boots light and lift him.
    key(holds.tackle + 4, between(UPPER, DRAW, 0.3), { ease: 'linear' }),
    at(holds.barrage.from - 6, DRAW, HOVER_SWAPS, 'out'),
    key(holds.barrage.from - 3, reset(0.4), { ease: 'inOut' }),
  ];
  for (let i = 0; i < 14; i++) {
    const f = holds.barrage.from + i * holds.barrage.every;
    const bob = (i % 3) * 0.3;
    const y = [-9.6, -11.0, -8.4][i % 3]!;
    keys.push(
      ...(i % 2
        ? hit(f, punch(bob, y), PUNCH_SWAPS, HOVER_SWAPS, BACK_ARM_IN_FRONT)
        : hit(f, shot(bob, y), SHOT_SWAPS, HOVER_SWAPS)),
      key(f + 3, reset(bob), { ease: 'linear', z: {} }),
    );
  }
  keys.push(
    at(holds.charge - 8, PUNCH_WIND, armed, 'in'),
    ...hit(
      holds.charge,
      POWER_PUNCH,
      { ...SHOUT, ...GUN, ...FIST_B, fx2: 'impact', fxBack: 'smear' },
      armed,
      BACK_ARM_IN_FRONT,
    ),
    key(holds.charge + 3, between(mix(POWER_PUNCH, { fx2: {}, fx3: {} }), LEAP, 0.36), {
      ease: 'linear',
      z: {},
    }),
    at(holds.fall - 7, LEAP, { ...SHOUT, ...GUN, ...FIST_B, jetB: 'bootJet' }, 'out'),
    ...hit(
      holds.fall,
      AXE,
      { ...SHOUT, ...GUN, ...FIST_B, jetB: 'bootJetSmall', fx2: 'impact', fxBack: 'smear' },
      armed,
      FRONT_LEG_IN_FRONT,
    ),
    key(holds.fall + 3, between(AXE, LANDED, 0.65), { ease: 'linear', z: {} }),
    key(holds.fall + 4, LANDED, { ease: 'out' }),
    at(holds.fall + 7, charge(0.12), { ...armed, ...AURA }, 'out'),
    key(release - 6, charge(0.3), { ease: 'inOut' }),
    key(release - 2, charge(0.42), { ease: 'in' }),
    at(release, BLAST, { ...SHOUT, ...GUN, ...FIST_B, fx1: 'muzzleFlash', fx2: 'laserBurst' }, 'linear'),
    key(release + 1, undefined, { swaps: { ...SHOUT, ...GUN, ...FIST_B, fx2: 'laserBurst' } }),
    key(release + 2, KICK, { ease: 'out' }),
    key(release + 10, KICK, { ease: 'inOut' }),
    key(release + 11, undefined, { swaps: { ...SMIRK, ...GUN, ...FIST_B } }),
    key(release + 18, aim(BRACE, [5.8, -10.2], -8), { ease: 'inOut' }),
    key(length - 8, LOWER, { ease: 'in' }),
    key(length - 4, LOWER, { ease: 'inOut', swaps: { ...SMIRK, ...FISTS } }),
    key(length, STANCE, { swaps: {} }),
  );
  return {
    length,
    active: [[release, release]],
    swaps: { ...GRIT, ...FISTS },
    keys: shortTurns(elbows(keys, ['B'])),
  };
}

export const finalSmashClips: Record<string, AnimClip> = {
  finalSmash: dashClip(),
  finalSmashCinematic: cinematicClip(),
};
