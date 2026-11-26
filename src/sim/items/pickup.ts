import { hurtbox } from '../combat/hits';
import { destroyEntity, entityDef } from '../entities/entities';
import type { EntityState } from '../entities/types';
import { emit } from '../events';
import type { Ctx } from '../fighter';

const PICKUP_ACTIONS = new Set(['idle', 'walk']);

/** The item's body circle overlaps the fighter's hurtbox. */
function inReach(x: Ctx, e: EntityState): boolean {
  const h = hurtbox(x.f, x.s);
  const hw = h.hw ?? 0;
  const px = Math.min(Math.max(e.pos.x, h.x - hw), h.x + hw);
  const py = Math.min(Math.max(e.pos.y, h.y1), h.y2);
  const r = h.r + entityDef(e.kind).radius;
  return (e.pos.x - px) ** 2 + (e.pos.y - py) ** 2 <= r * r;
}

/**
 * Ultimate's item pickup, the smallest form of it: Attack (without a smash input) from standing or walking picks up
 * the first item, in spawn order, that rests on the stage within reach, instead of jabbing or tilting. The item's
 * `pickup` runs and it leaves the match. Holding and throwing items come later. True when something was picked up.
 */
export function pickUpItem(x: Ctx): boolean {
  const { m, f } = x;
  if (!PICKUP_ACTIONS.has(f.action) || !f.ground) return false;
  const e = m.entities.find((i) => !i.dead && i.grounded && entityDef(i.kind).pickup && inReach(x, i));
  if (!e) return false;
  entityDef(e.kind).pickup!(m, f, e);
  emit(m, { type: 'itemPickup', port: f.port, id: e.id, kind: e.kind });
  destroyEntity(m, e, 'pickup');
  return true;
}
