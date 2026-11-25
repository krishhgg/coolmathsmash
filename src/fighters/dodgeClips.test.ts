import { describe, expect, it } from 'vitest';
import { clipFor, fighterArt } from '../render/fighterView';
import {
  GETUP_ROLL,
  GETUP_STAND,
  ROLL_BACK,
  ROLL_FORWARD,
  SPOT_DODGE,
  TECH_IN_PLACE,
  TECH_ROLL,
} from '../sim/constants';
import type { FighterState } from '../sim/fighter';
import { FIGHTERS } from './registry';

/**
 * Timed ground actions shared by every fighter. Each ends on its FAF, so the clip the renderer draws for it
 * (its own or a stand-in) lasts FAF - 1 frames, with its last key on the last frame (docs/art.md).
 */
const ACTIONS: Record<string, number> = {
  spotDodge: SPOT_DODGE.faf - 1,
  rollForward: ROLL_FORWARD.faf - 1,
  rollBack: ROLL_BACK.faf - 1,
  techInPlace: TECH_IN_PLACE.faf - 1,
  techRoll: TECH_ROLL.faf - 1,
  getupStand: GETUP_STAND.faf - 1,
  getupRoll: GETUP_ROLL.faf - 1,
};

/**
 * Fighters whose clips still follow the old timings because another PR was changing their art when the rest were
 * retimed. Their check is expected to fail; take a fighter off this list once its clips match. Watergirl draws
 * Fireboy's clips, so she matches through his.
 */
const WAITING = ['snailbob'];

/**
 * Each action whose clip is not as long as the action, as `action: clip length/last key (want n)`. An action with
 * no clip of its own or a stand-in is drawn with idle and has nothing to match.
 */
function drift(id: string): string[] {
  const def = FIGHTERS[id]!;
  const art = fighterArt(def)!;
  return Object.entries(ACTIONS).flatMap(([action, want]) => {
    const [name] = clipFor(def, art, { action, actionFrame: 0 } as FighterState);
    const clip = name === 'idle' ? undefined : art.clips[name];
    if (!clip) return [];
    const last = clip.keys[clip.keys.length - 1]?.frame;
    return clip.length === want && last === want
      ? []
      : [`${action}: ${name} ${clip.length}/${last} (want ${want})`];
  });
}

const drawn = Object.keys(FIGHTERS).filter((id) => fighterArt(FIGHTERS[id]!));

describe.each(drawn)('%s', (id) => {
  const check = WAITING.includes(id) ? it.fails : it;
  check('draws every dodge, roll, tech and getup over the whole action', () => {
    expect(drift(id)).toEqual([]);
  });
});

it('only waits on fighters that have art', () => {
  for (const id of WAITING) expect(drawn, id).toContain(id);
});
