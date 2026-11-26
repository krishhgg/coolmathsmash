import type { HitboxDef, HoldHitDef, MoveDef } from '../types';
import type { Ctx } from '../../sim/fighter';

/**
 * Bob's Final Smash, Lights Out: he dashes in and catches a foe, the lights go out, and he beats them up in the dark
 * before a bonk launches them (the roster plan's "shadow beatdown", a trapping Final Smash). It is Joker's All-Out
 * Attack in Ultimate 13.0.1, the trapping Final Smash with a dash-in catch whose scene blacks out the screen
 * (FILL_SCREEN in game_finalhit) for a beatdown in silhouette, and the analogue of Bob's back throw already.
 *
 * Sources: the move's game scripts (rubendal/ssbu data viewer, 13.0.1 data.json, and WuBoytH/SSBU-Dumped-Scripts
 * 5596690, smashline/jack/jack), Joker's `param_final` (PropaSmike/clone_pack_workbench 643baa3,
 * clone_pack_gui/data/owner_params.tsv, fighter kind 82), and SmashWiki's Joker (SSBU) moveset table ("3% (trapping
 * hit), 33.6% (cinematic), 13% (ending screen)"; "Causes an instant KO if the opponent was at 100% damage or higher
 * at the end of the cinematic"; 13.0.0's "FAF 31 -> 21" for the ending). Frame by frame:
 *
 * - Activation: game_finalstart's SLOW_OPPONENT(20, 65) runs everyone else at a twentieth of their speed for 65
 *   frames, so the others are held for 65 (`final.freeze`) instead of FINAL_SMASH.freeze's estimate.
 * - The dash: `dash_speed` 8.5 for `dash_length` 80. game_finaldash puts out its catch from the dash's first frame
 *   to its last: 3% at 80 degrees, radius 7.0 on bone top from Y 6.5, Z 5 to 10 (forward), hitlag 0. Here the box
 *   comes out on the first frame the engine lets it (`freeze` + 2), where he stands, and he covers the 80 units
 *   over the next 10 frames.
 * - A whiff ends in game_finaldashend: FT_MOTION_RATE 0.6 from frame 1, 1.1 from 21 and 0.8 from 42 to its cancel
 *   frame 54 is 1 + 20 x 0.6 + 21 x 1.1 + 12 x 0.8 = 45.7 frames, so 46 here; the aerial one, game_finalairdashend,
 *   cancels on 37 at full speed. `dash_end_brake` 0.15 slows the slide; where it starts from is an ESTIMATE, his run
 *   speed, which ends it inside the 12 frames of the script's three slide-smoke puffs.
 * - The catch plays the cinematic: game_finalhit (cancel frame 20, the screen filled black on its frame 5), then
 *   game_visualscene, whose scene damage requests on 100, 117, 134, 151, 168, 185 and 195 each deal
 *   `visual_scene_damage` 3.8%, then game_visualscene02 (from scene 1's sync on 200), whose request on 93 deals
 *   `visual_scene_damage_finish` 7%, with the result check on 130 and the screen capture on 204. 7 x 3.8 + 7 is
 *   SmashWiki's 33.6%. Then game_finalend: the 13% launch on its first frame (ATTACK_ABS: 60 degrees, KBG 100,
 *   BKB 73, hitlag 0), and Joker can act on its frame 21.
 *
 * Not built: the instant KO at 100% after the cinematic. The finisher alone KOs Mario from 98.8% at the middle of
 * Battlefield (koPercent), so the move KOs where Ultimate's does (finalSmash.test.ts). Nor the turn back (stick
 * back mid-dash runs `turn_dash_length` 60 the other way), catching up to four foes (the engine traps the first,
 * docs/fighters.md "Final Smash"), the cut-ins or the scene's own camera.
 */
export const ALL_OUT_ATTACK = {
  /** Frames everyone else is held from activation: SLOW_OPPONENT(20, 65). */
  freeze: 65,
  /** `dash_speed`, units a frame. */
  speed: 8.5,
  /** `dash_length`, units. */
  length: 80,
  /** `dash_end_brake`, units a frame per frame. */
  brake: 0.15,
  /** game_finaldash's catch: radius 7 at Y 6.5 from Z 5 to 10, dealing 3%. */
  catch: { y: 6.5, from: 5, to: 10, radius: 7, damage: 3 },
  /** game_finaldashend and game_finalairdashend, in frames: until each can act. */
  dashEnd: { ground: 46, air: 37 },
  /** game_finalhit: its cancel frame. */
  hit: 20,
  /** Frames of game_visualscene (to its sync with scene 2) and of game_visualscene02 (to its screen capture). */
  scenes: [200, 204] as const,
  /** Scene 1's damage requests, `visual_scene_damage` each. */
  sceneHits: [100, 117, 134, 151, 168, 185, 195],
  sceneDamage: 3.8,
  /** Scene 2's finishing request, `visual_scene_damage_finish`. */
  finishHit: 93,
  finishDamage: 7,
  /** game_finalend: the launch on its first frame, and its first actionable frame. */
  end: { hit: { damage: 13, angle: 60, kbg: 100, bkb: 73 }, faf: 21 },
};

const A = ALL_OUT_ATTACK;

/** Move frames of the dash: the catch is out on DASH.from to DASH.to; he covers the 80 units on the frames after the first. */
export const DASH = {
  from: A.freeze + 2,
  to: A.freeze + 2 + Math.ceil(A.length / A.speed),
};

/** How far ahead of his feet the dash catches: its length and the box's far edge. */
export const LIGHTS_OUT_RANGE = A.length + A.catch.to + A.catch.radius;

/** The catch: the capsule from Z 5 to 10 as three circles along it. */
const catchBoxes: HitboxDef[] = [A.catch.from, (A.catch.from + A.catch.to) / 2, A.catch.to].map((x, id) => ({
  id,
  x,
  y: A.catch.y,
  radius: A.catch.radius,
  damage: 0,
  angle: 0,
  kbg: 0,
  bkb: 0,
  grab: true,
}));

/** Cinematic frames (frame 1 is the frame after the catch) where each scene begins and the launch lands. */
export const SCENE = {
  dark: 5,
  one: A.hit,
  two: A.hit + A.scenes[0],
  launch: A.hit + A.scenes[0] + A.scenes[1] + 1,
};

/** The units he moves on the dash's frame `i` (1 to 10): 8.5 a frame until the 80 are covered. */
const dashStep = (i: number) => Math.min(A.length, i * A.speed) - Math.min(A.length, (i - 1) * A.speed);

/**
 * The dash and the slide after a whiff. Grounded, traction runs after the script (groundMove), so it is added back
 * to keep the distances; in the air `still` leaves no gravity, drift or air friction.
 */
function dash({ f, s }: Ctx): void {
  const i = f.actionFrame - DASH.from;
  if (i < 0) return;
  const extra = f.ground ? s.groundFriction : 0;
  const speed =
    i === 0
      ? 0
      : i <= DASH.to - DASH.from
        ? dashStep(i)
        : Math.max(0, s.runSpeed - A.brake * (i - (DASH.to - DASH.from) - 1));
  f.vel.x = f.facing * (speed > 0 ? speed + extra : 0);
}

const lightsOut = (faf: number, still: boolean): MoveDef => ({
  kind: 'other',
  faf,
  final: { freeze: A.freeze, range: LIGHTS_OUT_RANGE, ...(still && { still }) },
  commandGrab: 'finalSmashCinematic',
  hits: [{ frames: [DASH.from, DASH.to], boxes: catchBoxes }],
  script: dash,
});

/** Lights Out, grounded: actionable 46 frames after a dash that caught nobody. */
export const finalSmash: MoveDef = {
  ...lightsOut(DASH.to + A.dashEnd.ground + 1, false),
  air: 'finalSmashAir',
};

/** Lights Out in the air: he holds his height through it (`param_final` air_accel_y 0), 37 frames after a whiff. */
export const finalSmashAir: MoveDef = lightsOut(DASH.to + A.dashEnd.air + 1, true);

const hold = (frame: number, damage: number): HoldHitDef => ({ frame, damage, hitlag: 0 });

/**
 * The beatdown in the dark: the catch's 3%, seven 3.8% hits in scene 1 and the 7% finish in scene 2, then the 13%
 * launch, Joker's game_finalend hit. He stands where he caught them (the dash's speed stops) and can act 20 frames
 * after the launch.
 */
export const finalSmashCinematic: MoveDef = {
  kind: 'other',
  faf: SCENE.launch + A.end.faf - 1,
  final: { still: true },
  hits: [],
  holdHits: [
    hold(1, A.catch.damage),
    ...A.sceneHits.map((f) => hold(SCENE.one + f, A.sceneDamage)),
    hold(SCENE.two + A.finishHit, A.finishDamage),
  ],
  throw: { frame: SCENE.launch, hit: A.end.hit },
  script({ f }) {
    f.vel.x = 0;
  },
};
