import { Btn } from '../../input/types';
import { ATTACK, startMove } from '../../sim/actions/attack';
import type { ActionDef } from '../../sim/actions/registry';
import { buffered, consume } from '../../sim/control';
import type { MoveDef } from '../types';
import { BOX_DROP } from './timing';

const { impact: IMPACT, release: RELEASE, cancelFrom: CANCEL_FROM } = BOX_DROP;
/** Units per frame. Kirby's stone falls at 4.5; the crate drops faster, as she runs faster. */
const PLUNGE_SPEED = 6;

/**
 * Box Drop, Runner's down special: Kirby's Stone in Ultimate (SmashWiki's Kirby (SSBU)/Down special hitbox table,
 * after patch 8.0.0 raised the shockwave's KBG from 24 to 30). On the ground she turns into a crate that armors
 * through hits under 25% (Stone HP 25), can open with Special after 18 frames, opens by itself after 150, and takes
 * 31 frames to climb out. In the air she stalls, then drops straight down into the same grounded crate.
 *
 * Kirby's: the grounded shockwave (14%, 25°, BKB 86, KBG 30, radius 6 at ±6 forward and 4 up), the falling box's
 * BKB 69, KBG 76, radius 6.5 at 2 up and 0.7x hitlag, the 25% damage threshold and the 18/150/31 frame timings.
 * Her own: the startup (impact on frame 12, Kirby's 11), the aerial's 11-frame stall and faster drop (Kirby's falls
 * from frame 29), and the falling box, which spikes (270°) for 15% on frames 12 to 16 where Kirby's launches at 70°
 * for 18% all the way down.
 */
export const boxDropMoves: Record<string, MoveDef> = {
  downB: {
    kind: 'other',
    faf: BOX_DROP.groundedFaf,
    air: 'downBAir',
    armor: { frames: [IMPACT, RELEASE - 1], damageThreshold: 25 },
    hits: [
      {
        frames: [IMPACT, IMPACT],
        boxes: [
          { id: 0, x: 6, y: 4, radius: 6, damage: 14, angle: 25, bkb: 86, kbg: 30, direction: 'away' },
          { id: 1, x: -6, y: 4, radius: 6, damage: 14, angle: 25, bkb: 86, kbg: 30, direction: 'away' },
        ],
      },
    ],
    script({ f, c }) {
      f.vel.x = 0;
      if (f.actionFrame >= CANCEL_FROM && f.actionFrame < RELEASE && buffered(c, Btn.Special)) {
        consume(c, Btn.Special);
        f.actionFrame = RELEASE;
      }
    },
  },
  downBAir: {
    kind: 'other',
    faf: BOX_DROP.aerialFaf,
    drift: false,
    hits: [
      {
        frames: [IMPACT, BOX_DROP.airEnd],
        boxes: [{ id: 0, x: 0, y: 2, radius: 6.5, damage: 15, angle: 270, bkb: 69, kbg: 76, hitlag: 0.7 }],
      },
    ],
    script({ f }) {
      f.vel.x = 0;
      f.vel.y = f.actionFrame < IMPACT ? 0 : -PLUNGE_SPEED;
      f.fastFalling = true;
    },
  },
};

export const boxDropActions: Record<string, ActionDef> = {
  aerial: {
    physics: 'air',
    get drift() {
      return ATTACK.aerial!.drift;
    },
    get ledge() {
      return ATTACK.aerial!.ledge;
    },
    get intangible() {
      return ATTACK.aerial!.intangible;
    },
    gravity: ({ f }) => f.move !== 'downBAir',
    update(x) {
      ATTACK.aerial!.update(x);
    },
    land(x) {
      const { f } = x;
      if (f.move !== 'downBAir') return ATTACK.aerial!.land!(x);
      const { actionFrame, hitVictims } = f;
      startMove(x, 'downB');
      f.actionFrame = Math.min(actionFrame, IMPACT);
      f.hitVictims = hitVictims;
    },
  },
};
