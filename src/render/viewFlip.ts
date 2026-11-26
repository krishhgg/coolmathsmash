import { getFighter } from '../fighters/registry';
import type { MatchState } from '../sim/match';
import type { FighterArt, ViewFlip } from './rig/types';

/**
 * A view flip (FighterArt.viewFlips): while a fighter plays a move whose art lists one, the renderer mirrors the world
 * and its backdrop top to bottom about the middle of the screen. Runner's Tunnel Flip turns the tunnel over this way.
 * It is a turn about the screen's horizontal axis rather than a roll, so left and right on screen stay where every
 * player's stick points; only up and down trade places. It reads the state and changes nothing in it: nobody's gravity
 * or controls change.
 */

/** The thinnest the world gets halfway through a turn (as a fraction of its height), so it never vanishes outright. */
export const FLIP_EDGE = 0.04;

/**
 * The view's vertical scale `frame` frames into a move with `flip` (fractional between simulated frames): 1 upright,
 * -1 upside down. Upright through frame turn[0] - 1, a half turn (cosine eased) that is upside down on turn[1], held
 * upside down until back[0] - 1, then the half turn back, upright on back[1].
 */
export function flipScale(flip: ViewFlip, frame: number): number {
  const half = ([from, to]: [number, number]) => Math.cos((Math.PI * (frame - from + 1)) / (to - from + 1));
  let s: number;
  if (frame <= flip.turn[0] - 1 || frame >= flip.back[1]) s = 1;
  else if (frame < flip.turn[1]) s = half(flip.turn);
  else if (frame <= flip.back[0] - 1) s = -1;
  else s = -half(flip.back);
  return (s < 0 ? -1 : 1) * Math.max(FLIP_EDGE, Math.abs(s));
}

/**
 * The view's vertical scale for `state`, `alpha` of the way from its previous frame: the first fighter (by port) whose
 * move turns the view decides it, and 1 when none does. A fighter frozen in hitlag holds its frame.
 */
export function viewFlip(state: MatchState, alpha = 1): number {
  for (const f of state.fighters) {
    if (!f.move) continue;
    const flip = (getFighter(f.fighter).art as FighterArt | undefined)?.viewFlips?.[f.move];
    if (!flip) continue;
    return flipScale(flip, f.hitlag > 0 ? f.actionFrame : f.actionFrame - 1 + alpha);
  }
  return 1;
}

/** A screen y (pixels, y down) seen through the flip `s` about the middle of a screen `height` tall. */
export const flipScreenY = (y: number, s: number, height: number): number =>
  height / 2 + (y - height / 2) * s;

/**
 * Where a fighter's overhead tag points (screen y, pixels) through the flip `s`: just past whichever end of the fighter
 * is higher on screen, from the unflipped screen ys of the points just past its `head` and just past its `feet`.
 * Upright that is the head. Upside down it is the feet, so the tag still sits above the fighter pointing down at it,
 * rather than over its head pointing away.
 */
export const tagY = (head: number, feet: number, s: number, height: number): number =>
  Math.min(flipScreenY(head, s, height), flipScreenY(feet, s, height));
