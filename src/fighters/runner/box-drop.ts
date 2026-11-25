import { Btn } from '../../input/types';
import { ATTACK, startMove } from '../../sim/actions/attack';
import type { ActionDef } from '../../sim/actions/registry';
import { buffered, consume } from '../../sim/control';
import type { MoveDef } from '../types';
import { BOX_DROP } from './timing';

const { impact: IMPACT, release: RELEASE, cancelFrom: CANCEL_FROM } = BOX_DROP;
const PLUNGE_SPEED = 6;

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
          { id: 0, x: 6, y: 4, radius: 6, damage: 12, angle: 25, bkb: 86, kbg: 30, direction: 'away' },
          { id: 1, x: -6, y: 4, radius: 6, damage: 12, angle: 25, bkb: 86, kbg: 30, direction: 'away' },
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
