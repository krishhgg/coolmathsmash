import { groundActionable } from '../../sim/actions/common';
import { setAction, type ActionDef } from '../../sim/actions/registry';
import { stickX } from '../../sim/control';
import { approach } from '../../sim/vec';
import { stats, TURN_FLIP, TURN_FRAMES } from './stats';

/**
 * Wheely's own versions of shared actions: he handles like a car (roster sheet, "Car physics").
 *
 * turn: turning round out of a run is a three-point turn. He brakes to a stop still facing the old way, swings round
 * on frame 12, and pulls away the other way, running at his initial dash speed on frame 20. He can still jump, attack and
 * shield out of it, as out of any run turnaround.
 */
export const actions: Record<string, ActionDef> = {
  turn: {
    physics: 'ground',
    edge: 'fall',
    friction: false,
    update(x) {
      const { f, c } = x;
      if (f.actionFrame === TURN_FLIP) f.facing = -f.facing as 1 | -1;
      if (groundActionable(x)) return;
      if (f.actionFrame < TURN_FLIP) {
        f.vel.x = approach(f.vel.x, 0, stats.runSpeed / (TURN_FLIP - 1));
      } else {
        const pull = (f.actionFrame - TURN_FLIP + 1) / (TURN_FRAMES - TURN_FLIP + 1);
        f.vel.x = f.facing * stats.dashInitialSpeed * pull;
      }
      if (f.actionFrame >= TURN_FRAMES) setAction(x, stickX(c) * f.facing > 0 ? 'run' : 'idle');
    },
  },
};
