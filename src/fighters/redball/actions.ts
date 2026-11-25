import { groundActionable } from '../../sim/actions/common';
import { setAction, type ActionDef } from '../../sim/actions/registry';
import { DASH_THRESHOLD, RUN_TURN_FRAMES } from '../../sim/constants';
import { stickX } from '../../sim/control';
import { approach } from '../../sim/vec';

export const actions = {
  turn: {
    physics: 'ground',
    edge: 'fall',
    friction: false,
    update(x) {
      const { f, c, s } = x;
      if (f.actionFrame === 1) f.facing = f.facing === 1 ? -1 : 1;
      if (groundActionable(x)) return;
      if (f.actionFrame < RUN_TURN_FRAMES) {
        f.vel.x = approach(f.vel.x, 0, s.runSpeed / (RUN_TURN_FRAMES - 1));
        return;
      }
      setAction(x, stickX(c) * f.facing >= DASH_THRESHOLD ? 'dash' : 'idle');
    },
  },
} satisfies Record<string, ActionDef>;
