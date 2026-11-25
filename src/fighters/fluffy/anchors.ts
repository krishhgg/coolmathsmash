import type { TetherHit } from '../types';
import type { Ctx, FighterState } from '../../sim/fighter';

/**
 * Fluffy's sky anchors (roster 8, Point Grapple rule 5): he may anchor the grabber to empty air three times an
 * airtime. A real latch or a landing gives them back, and with none left a sky shot whiffs, so he can still be KO'd.
 */
const SKY_ANCHORS = 3;

/** Sky anchors each fighter has left this airtime. Keyed by fighter state, so a new match starts fresh. */
const left = new WeakMap<FighterState, number>();

/** TetherDef.onAnchor: take any real latch (and refill), spend a sky anchor, or refuse the shot when out. */
export function skyAnchor(x: Ctx, hit: TetherHit): boolean {
  if (hit.kind !== 'sky') {
    left.set(x.f, SKY_ANCHORS);
    return true;
  }
  const fresh = x.f.ground || x.f.jumpsUsed === 0;
  const anchors = fresh ? SKY_ANCHORS : (left.get(x.f) ?? SKY_ANCHORS);
  if (anchors <= 0) return false;
  left.set(x.f, anchors - 1);
  return true;
}
