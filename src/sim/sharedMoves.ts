import type { FighterDef, MoveDef } from '../fighters/types';
import { LEDGE_ATTACK } from './constants';

/**
 * The ledge attack's hit, Ultimate's (Mario's, SmashWiki "Mario (SSBU)/Edge attack"): 9%, angle 45, BKB 90, KBG 20
 * on frames 24-26, the last three of its intangibility, since "edge attacks are universally intangible until their
 * hitboxes are no longer active" (SmashWiki "Edge attack"). Ultimate stretches one radius-5 hitbox from 2 to 12
 * units in front of the fighter at height 5; three circles along that line stand in for it. The angle, BKB, KBG,
 * the 3-frame window and the FAF of 56 are the same across the cast; damage (8-10%), radius and the window's place
 * vary by character (Fox 19-21, Bowser 10% on 22-24), which a fighter's own `moves.ledgeAttack` can set.
 */
const LEDGE_ATTACK_MOVE: MoveDef = {
  kind: 'other',
  faf: LEDGE_ATTACK.faf,
  hits: [
    {
      frames: [LEDGE_ATTACK.intangible[1] - 2, LEDGE_ATTACK.intangible[1]],
      boxes: [2, 7, 12].map((x, id) => ({
        id,
        x,
        y: 5,
        radius: 5,
        damage: 9,
        angle: 45,
        kbg: 20,
        bkb: 90,
        transcendent: true,
      })),
    },
  ],
};

/**
 * Moves every fighter has without defining them: the ledge attack, which the ledgeAttack getup plays
 * (src/sim/actions/ledge.ts). A fighter's own move of the same name in FighterDef.moves replaces it.
 */
export const SHARED_MOVES: Readonly<Record<string, MoveDef>> = { ledgeAttack: LEDGE_ATTACK_MOVE };

/** The fighter's move called `name`: its own, else the shared one. */
export function moveDef(def: FighterDef, name: string): MoveDef | undefined {
  return def.moves?.[name] ?? SHARED_MOVES[name];
}
