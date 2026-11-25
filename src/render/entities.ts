import type { Graphics } from 'pixi.js';
import { activeAbsorbers, activeReflectors } from '../sim/entities/contacts';
import { entityDef, entityHitboxes, isHittable } from '../sim/entities/entities';
import type { MatchState } from '../sim/match';
import { PORT_COLORS } from './debug/inputDisplay';

/**
 * Placeholder entity drawing until entity art lands: projectiles as discs, hittable entities as rounded squares, ringed
 * in the owner's port colour (white when nobody owns it). World units, y down.
 */
export function drawEntities(g: Graphics, state: MatchState, alpha: number): void {
  g.clear();
  for (const e of state.entities) {
    const def = entityDef(e.kind);
    const x = e.prevPos.x + (e.pos.x - e.prevPos.x) * alpha;
    const y = -(e.prevPos.y + (e.pos.y - e.prevPos.y) * alpha);
    const color = e.owner >= 0 ? PORT_COLORS[e.owner % PORT_COLORS.length]! : '#ffffff';
    const r = def.radius;
    if (isHittable(def)) g.roundRect(x - r, y - r, r * 2, r * 2, r * 0.3);
    else g.circle(x, y, r);
    g.fill('#fff3c4').stroke({ color, width: 0.9 });
  }
}

/**
 * The `?hitboxes` overlay for entities: their hitboxes in red, the hurt circles of hittable entities in yellow, and
 * fighters' reflector bubbles in cyan and absorber bubbles in green.
 */
export function drawEntityBoxes(g: Graphics, state: MatchState): void {
  for (const e of state.entities) {
    const def = entityDef(e.kind);
    if (isHittable(def)) g.circle(e.pos.x, -e.pos.y, def.radius).fill({ color: '#ffe14a', alpha: 0.35 });
    for (const b of entityHitboxes(e))
      g.circle(b.x, -b.y, b.box.radius).fill({ color: '#ff2a2a', alpha: 0.55 });
  }
  for (const f of state.fighters) {
    for (const b of activeReflectors(f))
      g.circle(b.x, -b.y, b.def.radius).fill({ color: '#3ce8ff', alpha: 0.4 });
    for (const b of activeAbsorbers(f))
      g.circle(b.x, -b.y, b.def.radius).fill({ color: '#4dff7a', alpha: 0.4 });
  }
}
