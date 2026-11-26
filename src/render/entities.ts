import { Container, Graphics } from 'pixi.js';
import { allFighters } from '../fighters/registry';
import { activeAbsorbers, activeReflectors } from '../sim/entities/contacts';
import { entityDef, entityHitboxes, isHittable } from '../sim/entities/entities';
import type { EntityState } from '../sim/entities/types';
import { PLANET } from '../sim/items/planet';
import type { MatchState } from '../sim/match';
import { PORT_COLORS } from './debug/inputDisplay';
import { fighterArt } from './fighterView';
import { drawPlanetEntity } from './items';
import type { FighterArt, PropArt } from './rig/types';
import { createPropView, type PropView } from './rig/view';

/** A fighter entity's drawing: `art.projectiles[name]` of the fighter its kind `<fighter id>/<name>` names. */
export interface EntityArt {
  art: FighterArt;
  /** Key in `art.projectiles`. */
  name: string;
  prop: PropArt;
}

/** The art an entity kind is drawn with, or null for kinds drawn as the placeholder disc. */
export function entityArt(kind: string): EntityArt | null {
  const slash = kind.indexOf('/');
  if (slash < 0) return null;
  const fighter = allFighters()[kind.slice(0, slash)];
  const art = fighter && fighterArt(fighter);
  const name = kind.slice(slash + 1);
  const prop = art?.projectiles?.[name];
  return art && prop ? { art, name, prop } : null;
}

/** How a prop drawing sits on one rendered frame. World units, y down; rotation in radians. */
export interface PropPlacement {
  x: number;
  y: number;
  /** -1 mirrors the drawing, which faces right. */
  scaleX: 1 | -1;
  rotation: number;
  /** Clock for the drawing's symbol loops: the entity's age, so a loop starts on its first drawing at spawn. */
  frame: number;
}

/**
 * Place `e`'s drawing from its state alone: the interpolated centre, mirrored by its facing. An `align` prop turns
 * to its velocity instead, mirrored by the direction it travels so it stays upright.
 */
export function propPlacement(e: EntityState, prop: PropArt, alpha: number): PropPlacement {
  const x = e.prevPos.x + (e.pos.x - e.prevPos.x) * alpha;
  const y = -(e.prevPos.y + (e.pos.y - e.prevPos.y) * alpha);
  if (!prop.align) return { x, y, scaleX: e.facing, rotation: 0, frame: e.age };
  const scaleX = (Math.sign(e.vel.x) || e.facing) as 1 | -1;
  const rotation = e.vel.x === 0 && e.vel.y === 0 ? 0 : Math.atan2(-e.vel.y * scaleX, Math.abs(e.vel.x));
  return { x, y, scaleX, rotation, frame: e.age };
}

/**
 * Entities drawn straight into `g` in spawn order: items with art (the Coolmath Planet, src/render/items.ts) as drawn,
 * everything else as the placeholder: projectiles as discs, hittable entities as rounded squares, ringed in the
 * owner's port colour (white when nobody owns it).
 */
function drawPlain(g: Graphics, e: EntityState, alpha: number, frame: number): void {
  const def = entityDef(e.kind);
  const x = e.prevPos.x + (e.pos.x - e.prevPos.x) * alpha;
  const y = -(e.prevPos.y + (e.pos.y - e.prevPos.y) * alpha);
  if (e.kind === PLANET) return drawPlanetEntity(g, e, x, y, frame);
  const color = e.owner >= 0 ? PORT_COLORS[e.owner % PORT_COLORS.length]! : '#ffffff';
  const r = def.radius;
  if (isHittable(def)) g.roundRect(x - r, y - r, r * 2, r * 2, r * 0.3);
  else g.circle(x, y, r);
  g.fill('#fff3c4').stroke({ color, width: 0.9 });
}

/**
 * The match's entities. Kinds with fighter art (`entityArt`) draw their fighter's prop in the owner's costume; the
 * rest draw into `discs` as before (the Coolmath Planet's drawing, else the placeholder disc). Each prop's view lives
 * as long as its entity and only swaps shared symbol geometry (docs/art.md, "Rendering"), with no filters, so `lite`
 * quality draws it as cheaply as a fighter. A prop with a `front` symbol draws its body into `back`, which the
 * renderer puts under the fighters, and only its front over them. World units, y down.
 */
export class EntityView {
  readonly container = new Container();
  /** Bodies of props with a `front` (Duck Raft's raft), drawn behind the fighters. */
  readonly back = new Container();
  /** Entities without fighter art (the planet item and placeholder discs), redrawn every frame. */
  readonly discs = new Graphics();
  /** Prop views, drawn over the discs. */
  readonly props = new Container();
  /** One view per entity id, built for its kind and costume, with its front view if the prop has one. */
  private readonly views = new Map<number, { key: string; view: PropView; front: PropView | null }>();

  constructor() {
    this.container.addChild(this.discs, this.props);
  }

  /** `costumes` is each port's palette name (Renderer); a prop takes its owner's, or `default` without one. */
  draw(state: MatchState, alpha: number, costumes: readonly string[] = []): void {
    this.discs.clear();
    const seen = new Set<number>();
    for (const e of state.entities) {
      const found = entityArt(e.kind);
      if (!found) {
        drawPlain(this.discs, e, alpha, state.frame);
        continue;
      }
      seen.add(e.id);
      const palette = (e.owner >= 0 && costumes[e.owner]) || 'default';
      const key = `${e.kind}|${palette}`;
      let held = this.views.get(e.id);
      if (held?.key !== key) {
        if (held) dispose(held);
        const front = found.prop.front;
        held = {
          key,
          view: createPropView(found.art, found.name, palette),
          front: front ? createPropView(found.art, found.name, palette, front) : null,
        };
        this.views.set(e.id, held);
        (held.front ? this.back : this.props).addChild(held.view.container);
        if (held.front) this.props.addChild(held.front.container);
      }
      const at = propPlacement(e, found.prop, alpha);
      for (const view of held.front ? [held.view, held.front] : [held.view]) {
        const c = view.container;
        c.position.set(at.x, at.y);
        c.scale.x = at.scaleX;
        c.rotation = at.rotation;
        view.update(at.frame);
      }
    }
    for (const [id, held] of this.views) {
      if (seen.has(id)) continue;
      dispose(held);
      this.views.delete(id);
    }
  }
}

function dispose(held: { view: PropView; front: PropView | null }): void {
  held.view.container.destroy({ children: true });
  held.front?.container.destroy({ children: true });
}

/**
 * The `?hitboxes` overlay for entities: their hitboxes in red, the hurt circles of hittable entities in yellow, and
 * fighters' reflector bubbles in cyan and absorber bubbles in green.
 */
export function drawEntityBoxes(g: Graphics, state: MatchState): void {
  for (const e of state.entities) {
    const def = entityDef(e.kind);
    if (isHittable(def)) g.circle(e.pos.x, -e.pos.y, def.radius).fill({ color: '#ffe14a', alpha: 0.35 });
    for (const b of entityHitboxes(state, e))
      g.circle(b.x, -b.y, b.box.radius).fill({ color: '#ff2a2a', alpha: 0.55 });
  }
  for (const f of state.fighters) {
    for (const b of activeReflectors(f))
      g.circle(b.x, -b.y, b.def.radius).fill({ color: '#3ce8ff', alpha: 0.4 });
    for (const b of activeAbsorbers(f))
      g.circle(b.x, -b.y, b.def.radius).fill({ color: '#4dff7a', alpha: 0.4 });
  }
}
