import { getFighter } from '../registry';
import type { ActionDef } from '../../sim/actions/registry';
import { setAction } from '../../sim/actions/registry';
import { groundActionable, startMovement } from '../../sim/actions/common';
import { CROUCH_THRESHOLD, DASH_THRESHOLD, DIRECTION_THRESHOLD } from '../../sim/constants';
import { flickX, stickX, stickY } from '../../sim/control';
import { emit } from '../../sim/events';
import type { Ctx, FighterState } from '../../sim/fighter';

/**
 * Bloxorz block moves the way it does in Bloxorz: it tips end over end. Every tip turns the block 90 degrees about
 * its leading bottom edge, moves its centre 18 units and swaps Standing (12 wide, 24 tall) for Lying (24 wide,
 * 12 tall) or back. The two shapes are two forms of one fighter, `bloxorz` and `bloxorz-lying`, so each has its
 * own hurtbox, environment box and move variants; FighterState (%, stocks, momentum) carries straight over.
 */
export const STANDING = 'bloxorz';
export const LYING = 'bloxorz-lying';

/** One tip moves the block's centre half a cube plus a cube. */
export const TIP_DISTANCE = 18;

/**
 * Tip timing in frames: a tip every `period` frames, rotating for the first `tip` of them and resting for the rest.
 * Walk averages 18 / 20 = 0.9 units a frame, the dash's single tip and the run 18 / 12 = 1.5.
 */
export const WALK = { period: 20, tip: 14 } as const;
export const DASH = { period: 12, tip: 12 } as const;
export const RUN = { period: 12, tip: 10 } as const;

/** Every tip lands with a small screen shake (the video's "screen shake effect with every movement"). */
export const TIP_SHAKE = { amplitude: 2, frames: 4 } as const;

/** Horizontal speed on frame `t` (from 0) of a tip lasting `frames`: eased in and out, summing to exactly 18. */
export function tipSpeed(t: number, frames: number): number {
  let total = 0;
  for (let k = 0; k < frames; k++) total += Math.sin((Math.PI * (k + 0.5)) / frames);
  return (TIP_DISTANCE * Math.sin((Math.PI * (t + 0.5)) / frames)) / total;
}

export function isLying(f: FighterState): boolean {
  return f.fighter === LYING;
}

/** Put the block on `shape`, keeping the rest of this frame (moves, stats) on the new form. */
export function setShape(x: Ctx, shape: typeof STANDING | typeof LYING): void {
  x.f.fighter = shape;
  x.def = getFighter(shape);
  x.s = x.def.stats;
}

/** Turn the block over onto its other face. */
export function flip(x: Ctx): void {
  setShape(x, isLying(x.f) ? STANDING : LYING);
}

/**
 * Frame `t` of a tip lasting `frames`: move along the facing, flip shape as the block passes its balance point
 * halfway (so an interrupted tip always leaves a whole shape), and shake the screen as it lands. Still on rest frames.
 */
export function tipFrame(x: Ctx, t: number, frames: number): void {
  const { f } = x;
  if (t >= frames) {
    f.vel.x = 0;
    return;
  }
  f.vel.x = f.facing * tipSpeed(t, frames);
  if (t === Math.floor(frames / 2)) flip(x);
  if (t === frames - 1) emit(x.m, { type: 'shake', port: f.port, ...TIP_SHAKE });
}

/** Come to rest between tips: a block doesn't slide. */
function stop(x: Ctx): void {
  x.f.vel.x = 0;
  setAction(x, 'idle');
}

/**
 * The block's own walk, dash, run and crouch (FighterDef.actions). Jumping, attacking, shielding and crouching
 * interrupt a tip at any frame, as in Smash; letting go of the stick finishes the tip under way first. Turning
 * round needs no skid: the next tip just goes the other way.
 */
export const TIP_ACTIONS: Record<string, ActionDef> = {
  walk: {
    physics: 'ground',
    edge: 'fall',
    friction: false,
    update(x) {
      const { f, c } = x;
      if (groundActionable(x)) return;
      const fl = flickX(c, DASH_THRESHOLD);
      if (fl !== 0) {
        f.facing = fl as 1 | -1;
        return setAction(x, 'dash');
      }
      const t = (f.actionFrame - 1) % WALK.period;
      const sx = stickX(c);
      if ((t === 0 || t >= WALK.tip) && sx === 0) return stop(x);
      if (t === 0) f.facing = Math.sign(sx) as 1 | -1;
      tipFrame(x, t, WALK.tip);
    },
  },

  /** Initial dash: one quick tip. Flicking back restarts it the other way (a rocking dash dance). */
  dash: {
    physics: 'ground',
    edge: 'fall',
    friction: false,
    update(x) {
      const { f, c } = x;
      if (groundActionable(x)) return;
      const fl = flickX(c, DASH_THRESHOLD);
      if (fl === -f.facing) {
        f.facing = fl as 1 | -1;
        return setAction(x, 'dash');
      }
      if (f.actionFrame > DASH.period) return stickX(c) * f.facing > 0 ? setAction(x, 'run') : stop(x);
      tipFrame(x, f.actionFrame - 1, DASH.tip);
    },
  },

  run: {
    physics: 'ground',
    edge: 'fall',
    friction: false,
    update(x) {
      const { f, c } = x;
      if (groundActionable(x)) return;
      const t = (f.actionFrame - 1) % RUN.period;
      const sx = stickX(c) * f.facing;
      if (sx <= -DIRECTION_THRESHOLD) {
        if (t === 0) f.facing = -f.facing as 1 | -1;
      } else if ((t === 0 || t >= RUN.tip) && sx <= 0) return stop(x);
      tipFrame(x, t, RUN.tip);
    },
  },

  /** Holding down lays a standing block on its side where it is: Lying is its crouch. */
  crouch: {
    physics: 'ground',
    update(x) {
      const { f, c } = x;
      if (f.actionFrame === 1 && !isLying(f)) {
        setShape(x, LYING);
        emit(x.m, { type: 'shake', port: f.port, ...TIP_SHAKE });
      }
      if (groundActionable(x)) return;
      if (stickY(c) > -CROUCH_THRESHOLD && !startMovement(x)) setAction(x, 'idle');
    },
  },
};
