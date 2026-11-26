import { describe, expect, it } from 'vitest';
import { clipFor, fighterArt } from '../render/fighterView';
import {
  AIR_DODGE_DIRECTIONAL,
  AIR_DODGE_NEUTRAL,
  GETUP_ROLL,
  GETUP_STAND,
  GRAB,
  ROLL_BACK,
  ROLL_FORWARD,
  SPOT_DODGE,
  TECH_IN_PLACE,
  TECH_ROLL,
} from '../sim/constants';
import type { FighterState } from '../sim/fighter';
import { allFighters } from './registry';

/**
 * Timed actions shared by every fighter. Each ends on its FAF, so the clip the renderer draws for it (its own or a
 * stand-in) lasts FAF - 1 frames, with its last key on the last frame (docs/art.md). Grab release ends after frame
 * GRAB.releaseLag (src/sim/actions/grab.ts), so its clip lasts GRAB.releaseLag frames. An air dodge clip lasts the
 * neutral dodge; a directional one plays the same clip over its own length (DIRECTIONS).
 */
const ACTIONS: Record<string, number> = {
  airDodge: AIR_DODGE_NEUTRAL.faf - 1,
  spotDodge: SPOT_DODGE.faf - 1,
  rollForward: ROLL_FORWARD.faf - 1,
  rollBack: ROLL_BACK.faf - 1,
  techInPlace: TECH_IN_PLACE.faf - 1,
  techRoll: TECH_ROLL.faf - 1,
  getupStand: GETUP_STAND.faf - 1,
  getupRoll: GETUP_ROLL.faf - 1,
  grabRelease: GRAB.releaseLag,
};

/**
 * Fighters whose clips still don't fit an action's length. Their check is expected to fail; take a fighter off this
 * list once its clips match. Watergirl draws Fireboy's clips, so she matches through his. Raft Wars' grabRelease is
 * 30 frames, one longer than the action.
 */
const WAITING = ['raftwars'];

/** Actions drawn with a back roll when they roll away from the facing (clipFor). */
const BACK_ROLLS = ['techRoll', 'getupRoll'];

/**
 * Each action whose clip is not as long as the action, as `action: clip length/last key (want n)`; the tech and
 * getup rolls are checked rolling both ways. An action with no clip of its own or a stand-in is drawn with idle
 * and has nothing to match.
 */
function drift(id: string): string[] {
  const def = allFighters()[id]!;
  const art = fighterArt(def)!;
  return Object.entries(ACTIONS).flatMap(([action, want]) =>
    (BACK_ROLLS.includes(action) ? [1, -1] : [1]).flatMap((dir) => {
      const f = { action, actionFrame: 0, facing: 1, dodgeDir: { x: dir, y: 0 } } as FighterState;
      const [name] = clipFor(def, art, f);
      const clip = name === 'idle' ? undefined : art.clips[name];
      if (!clip) return [];
      const last = clip.keys[clip.keys.length - 1]?.frame;
      return clip.length === want && last === want
        ? []
        : [`${action}${dir < 0 ? ' back' : ''}: ${name} ${clip.length}/${last} (want ${want})`];
    }),
  );
}

/** Directional air dodges by stick angle, straight down to straight up, with their FAF (AIR_DODGE_DIRECTIONAL). */
const DIRECTIONS: [string, number, number][] = [
  ['down', 0, -1],
  ['down-forward', Math.SQRT1_2, -Math.SQRT1_2],
  ['forward', 1, 0],
  ['up-forward', Math.SQRT1_2, Math.SQRT1_2],
  ['up', 0, 1],
];

/**
 * Each directional air dodge that does not reach the clip's end on its last frame (FAF - 1), or reaches it sooner,
 * as `direction: frame n draws clip frame m (want clip length)`.
 */
function directionalDrift(id: string): string[] {
  const def = allFighters()[id]!;
  const art = fighterArt(def)!;
  return DIRECTIONS.flatMap(([name, x, y], i) => {
    const last = AIR_DODGE_DIRECTIONAL.fafByAngle[i]! - 1;
    const at = (actionFrame: number) =>
      clipFor(def, art, { action: 'airDodge', actionFrame, facing: 1, dodgeDir: { x, y } } as FighterState);
    const [clip, end] = at(last);
    const [, before] = at(last - 1);
    const length = art.clips[clip]?.length;
    return end === length && before < end
      ? []
      : [`${name}: frame ${last} draws ${clip} ${end} (want ${length})`];
  });
}

const drawn = Object.keys(allFighters()).filter((id) => fighterArt(allFighters()[id]!));

describe.each(drawn)('%s', (id) => {
  const check = WAITING.includes(id) ? it.fails : it;
  check('draws every dodge, roll, tech, getup and grab release over the whole action', () => {
    expect(drift(id)).toEqual([]);
  });

  it('draws each directional air dodge over the whole dodge', () => {
    expect(directionalDrift(id)).toEqual([]);
  });
});
