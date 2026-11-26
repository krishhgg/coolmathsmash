import type { HitboxDef, HoldHitDef, MoveDef } from '../types';
import { BARRAGE, SPLIT } from './finalSmashData';
import { isLying, setShape, STANDING } from './tip';

export { BARRAGE, REACH, SPLIT } from './finalSmashData';

/**
 * Split Switch, the Final Smash, on Donkey Kong's Jungle Rush (finalSmashData.ts has the numbers and their sources).
 * It is a trap: the punch is a command grab into the cinematic, which holds everyone else still.
 *
 * - Both forms. Lying, the block stands up on frame 4, as Heavy Switch and Switch Bridge do, so the punch always
 *   comes from the standing block and the cinematic plays standing.
 * - In the air it holds still (`final.still`), as the cinematic does, so a block high up topples in mid-air and the
 *   level's tiles flip up under it there, the way Bloxorz's levels hang in space.
 * - Ultimate traps every opponent the punch reaches ("rapid punches at his victims"); the engine's trap holds the
 *   nearest one (docs/fighters.md, "Final Smash").
 */

/** The punch's stretch from 8 to 28 in front, as three circles of its radius 10 units apart. */
const catchBoxes: HitboxDef[] = [0, 1, 2].map((i) => ({
  id: i,
  x: SPLIT.reach.from + ((SPLIT.reach.to - SPLIT.reach.from) * i) / 2,
  y: SPLIT.reach.y,
  radius: SPLIT.reach.radius,
  damage: 0,
  angle: 0,
  kbg: 0,
  bkb: 0,
  grab: true,
}));

/** The punch's 12% at hitlag x5, then the barrage's 31 rapid hits at hitlag x0.4. */
const holdHits: HoldHitDef[] = [
  { frame: BARRAGE.punch, damage: 12, hitlag: 5 },
  ...BARRAGE.fast.map((frame) => ({ frame, damage: 1.2, hitlag: 0.4 })),
  ...BARRAGE.late.map((frame) => ({ frame, damage: 1.1, hitlag: 0.4 })),
];

/** The activation: stands on the split switch through the freeze, then topples onto whoever is in front. */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: SPLIT.faf,
  final: { freeze: SPLIT.freeze, still: true },
  commandGrab: 'finalSmashCinematic',
  hits: [{ frames: [...SPLIT.catch], boxes: catchBoxes }],
  script(x) {
    const { f } = x;
    if (f.actionFrame === SPLIT.standUp && isLying(f)) setShape(x, STANDING);
    if (f.ground) f.vel.x = 0;
  },
};

/**
 * The cinematic: the punch, the split cubes' barrage, and the bridge tile's fling (Jungle Rush's final hit). The catch
 * slides in under the toppled block to the hold point at BARRAGE.pull units a frame through the punch's hitlag.
 */
export const finalSmashCinematic: MoveDef = {
  kind: 'other',
  faf: BARRAGE.faf,
  final: { still: true },
  hits: [],
  holdHits,
  pull: BARRAGE.pull,
  throw: { frame: BARRAGE.finish, hit: { damage: 14, angle: 70, kbg: 96, bkb: 90, hitlag: 1 } },
};

export const finalSmashMoves: Record<string, MoveDef> = { finalSmash, finalSmashCinematic };
