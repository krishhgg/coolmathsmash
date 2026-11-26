import type { EntityDef } from '../../sim/entities/types';
import type { HitboxDef, MoveDef } from '../types';

/**
 * Papa Louie's Final Smash, Conveyor Oven (the roster plan's "conveyor-belt final", from Papa's Pizzeria): he slams his
 * peel down and a pizza conveyor belt rolls out along the floor in front of him. It jolts the foes standing on it,
 * catches the first one, carries it back along the belt into a brick oven that bursts up at his end, and the oven
 * bakes it and blasts it out.
 *
 * The analogue is Steve's House of Boom in Ultimate (SmashWiki, "House of Boom" and "Steve (SSBU)/Final Smash"), a
 * trap that carries its catch into a machine: an "oversized piston block in front of himself" whose placement "stuns
 * nearby opponents ... with the target to be trapped pulled to the front of the piston", then "the first opponent
 * caught is taken into a cutscene where they are thrown into the House of Boom", which explodes. Only one opponent is
 * trapped, as the framework's traps do. Its tables, unchanged here:
 *
 * - Timing: piston pushbox 25-44, launcher 45-48, throw 45, animation length 119 (so FAF 120).
 * - Pushbox: 0%, angle 40, BK 0, KS 100, FKV 75 (grounded only) or FKV 70 (aerial only), radius 13, offset 11 up and
 *   16 forward, hitlag x0.0; and 0%, angle 361, BK 0, KS 100, FKV 10, radius 8, stretched from 16 to 44 forward at 11
 *   up, hitlag x2.0, hitting both.
 * - Launcher: radius 13, stretched from 16 to 47 forward at 11 up: the catch here.
 * - Throws: "Throw into the house" 15% (hitlag x0.0) and "Final hit" 45%, angle 35, BK 60, KS 34, hitlag x0.0, flame.
 *   The trapped foe takes 15% + 45% = 60%.
 *
 * Not taken: the launcher's own 15% hit (35, BK 50, KS 120) on bystanders, since the framework holds them still and
 * untouched through the cinematic. SmashWiki gives no frames for the cutscene, so the cinematic's are estimates.
 */
export const CONVEYOR = {
  /** Frames the others hold still from activation: short enough that the jolt comes out on House of Boom's 25. */
  freeze: 23,
  /** The belt's jolt: House of Boom's piston pushbox. */
  jolt: [25, 44] as [number, number],
  /** The belt's catch: House of Boom's launcher. */
  catch: [45, 48] as [number, number],
  /** House of Boom's box line: 11 up, starting 16 forward. */
  y: 11,
  from: 16,
  /** The jolt's stretched box runs to 44 forward, the catch's to 47. */
  joltTo: 44,
  catchTo: 47,
  /** House of Boom's 119-frame animation. */
  faf: 120,
  /** Units a frame the belt carries the catch back to Papa's hands: the farthest catch, 60 out, takes 20 frames. */
  pull: 2.5,
  /** Cinematic frames, estimates: the catch drops into the oven, then the oven blasts it out. */
  inOven: 30,
  blast: 110,
  cinematicFaf: 140,
  /** Where the oven bursts up, from Papa's feet: round the held foe, just in front of him. */
  ovenX: 14,
};

/** House of Boom's stretched box from `from` to `to` (forward) as circles no further apart than their radius. */
function stretched(
  id: number,
  from: number,
  to: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
): HitboxDef[] {
  const n = Math.ceil((to - from) / radius) + 1;
  return Array.from({ length: n }, (_, i) => ({
    id: id + i,
    x: Math.round((from + ((to - from) * i) / (n - 1)) * 100) / 100,
    y: CONVEYOR.y,
    radius,
    ...hit,
  }));
}

/** The pushbox's two near boxes (grounded and aerial rows), then its stretched stun box. */
const joltBoxes: HitboxDef[] = [
  { id: 0, x: CONVEYOR.from, y: CONVEYOR.y, radius: 13, damage: 0, angle: 40, kbg: 100, bkb: 0, wbkb: 75 },
  { id: 1, x: CONVEYOR.from, y: CONVEYOR.y, radius: 13, damage: 0, angle: 40, kbg: 100, bkb: 0, wbkb: 70 },
].map((b, i) => ({ ...b, hitlag: 0, targets: i ? ('air' as const) : ('ground' as const) }));
joltBoxes.push(
  ...stretched(2, CONVEYOR.from, CONVEYOR.joltTo, 8, {
    damage: 0,
    angle: 361,
    kbg: 100,
    bkb: 0,
    wbkb: 10,
    hitlag: 2,
  }),
);

/** The launcher's reach as grab boxes: the first foe it touches is trapped. */
const catchBoxes = stretched(0, CONVEYOR.from, CONVEYOR.catchTo, 13, {
  damage: 0,
  angle: 0,
  kbg: 0,
  bkb: 0,
  grab: true,
});

/** Conveyor Oven: the belt rolls out, jolts on 25-44 and catches on 45-48; a miss plays out to House of Boom's 119. */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: CONVEYOR.faf,
  final: { freeze: CONVEYOR.freeze, still: true },
  commandGrab: 'finalSmashCinematic',
  hits: [
    { frames: CONVEYOR.jolt, boxes: joltBoxes },
    { frames: CONVEYOR.catch, boxes: catchBoxes },
  ],
};

/**
 * The cinematic: the belt carries the catch back into the oven, which takes it in for House of Boom's 15% "Throw into
 * the house", bakes it, and blasts it out with the 45% "Final hit". Everyone else holds still until the blast.
 */
export const finalSmashCinematic: MoveDef = {
  kind: 'other',
  faf: CONVEYOR.cinematicFaf,
  final: { still: true },
  hits: [],
  pull: CONVEYOR.pull,
  holdHits: [{ frame: CONVEYOR.inOven, damage: 15, hitlag: 0 }],
  throw: { frame: CONVEYOR.blast, hit: { damage: 45, angle: 35, kbg: 34, bkb: 60, effect: 'fire' } },
  spawn: [{ frame: 1, entity: 'oven', x: CONVEYOR.ovenX, y: 0 }],
};

/**
 * The brick oven, a drawing only: it bursts up on the cinematic's first frame, shuts on the catch, bakes, blasts and
 * sinks away before Papa can act. It hits nothing, and nothing reflects, absorbs or clanks with it. Drawn over the
 * fighters, it hides the foe it bakes.
 */
export const oven: EntityDef = {
  radius: 9,
  lifetime: CONVEYOR.cinematicFaf - 6,
  floor: 'pass',
  wall: 'pass',
  reflectable: false,
  absorbable: false,
  transcendent: true,
  hits: [],
};
