import { Container } from 'pixi.js';
import { getFighter } from '../fighters/registry';
import { moveOf } from '../sim/actions/attack';
import { tetherOrigin } from '../sim/actions/tether';
import type { FighterState } from '../sim/fighter';
import type { MatchState } from '../sim/match';
import { fighterArt } from './fighterView';
import { propView, type PropView } from './rig/view';

/** Move frames the reticle takes to grow in and turn a quarter turn as the aim starts. */
export const RETICLE_GROW = 8;

/** How a reticle sits on one rendered frame. World units, y down; rotation in radians. */
export interface ReticlePlacement {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/**
 * Where `f`'s reticle sits, or null when it shows none: only during an aimed tether move (TetherDef.aimed) with an
 * aim set (FighterState.aim), which is from the press, while the stick walks it, until the line anchors or misses.
 * It sits at the fighter's hand plus the aim, the hand interpolated like the fighter's drawing, and grows in over
 * the first RETICLE_GROW move frames.
 */
export function reticlePlacement(f: FighterState, alpha: number): ReticlePlacement | null {
  if (!f.aim || (f.action !== 'attack' && f.action !== 'aerial') || !moveOf(f)?.tether?.aimed) return null;
  const hand = tetherOrigin(f).y - f.pos.y;
  const x = f.prevPos.x + (f.pos.x - f.prevPos.x) * alpha;
  const y = f.prevPos.y + (f.pos.y - f.prevPos.y) * alpha;
  const t = Math.min(1, f.actionFrame / RETICLE_GROW);
  return {
    x: x + f.aim.x,
    y: -(y + hand + f.aim.y),
    scale: 0.2 + 0.8 * (1 - (1 - t) ** 2),
    rotation: (Math.PI / 2) * t,
  };
}

/**
 * Each fighter's aiming reticle: its `art.reticle` at `reticlePlacement`, in its port's costume. Fighters without
 * reticle art draw none. One view per port, rebuilt only when the fighter or costume changes, so posing only moves
 * it. World units, y down.
 */
export class ReticleView {
  readonly container = new Container();
  private readonly views = new Map<number, { key: string; view: PropView }>();

  /** `costumes` is each port's palette name (Renderer); a port without one wears `default`. */
  draw(state: MatchState, alpha: number, costumes: readonly string[] = []): void {
    const shown = new Set<number>();
    for (const f of state.fighters) {
      const art = fighterArt(getFighter(f.fighter));
      const at = art?.reticle && reticlePlacement(f, alpha);
      if (!art?.reticle || !at) continue;
      shown.add(f.port);
      const palette = costumes[f.port] ?? 'default';
      const key = `${f.fighter}|${palette}`;
      let held = this.views.get(f.port);
      if (held?.key !== key) {
        held?.view.container.destroy({ children: true });
        held = { key, view: propView(art, art.reticle, palette) };
        this.views.set(f.port, held);
        this.container.addChild(held.view.container);
      }
      const c = held.view.container;
      c.visible = true;
      c.position.set(at.x, at.y);
      c.scale.set(at.scale);
      c.rotation = at.rotation;
      held.view.update(state.frame);
    }
    for (const [port, held] of this.views) if (!shown.has(port)) held.view.container.visible = false;
  }
}
