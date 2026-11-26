import { Container, Graphics, type GraphicsContext } from 'pixi.js';
import { getFighter } from '../fighters/registry';
import { tetherOrigin } from '../sim/actions/tether';
import type { FighterState } from '../sim/fighter';
import type { MatchState } from '../sim/match';
import type { Vec } from '../sim/vec';
import { fighterArt } from './fighterView';
import { resolveSymbol } from './rig/sample';
import type { FighterArt, TetherLineArt } from './rig/types';
import { symbolContext } from './rig/view';

/** Lines shorter than this draw no line, only the tip. */
const MIN_LENGTH = 0.01;

/**
 * Where `f`'s tether line runs on one rendered frame, or null when it draws none: while `f` has a tether on one of
 * its art's `tetherLine.moves`, from the hand (tetherOrigin, interpolated like the fighter's drawing) to the line's
 * end (FighterState.tether.anchor). World units, y down.
 */
export function tetherLinePlacement(f: FighterState, alpha: number): { from: Vec; to: Vec } | null {
  const art = fighterArt(getFighter(f.fighter))?.tetherLine;
  if (!art || !f.tether || !f.move || !art.moves.includes(f.move)) return null;
  const hand = tetherOrigin(f).y - f.pos.y;
  const x = f.prevPos.x + (f.pos.x - f.prevPos.x) * alpha;
  const y = f.prevPos.y + (f.pos.y - f.prevPos.y) * alpha;
  return { from: { x, y: -(y + hand) }, to: { x: f.tether.anchor.x, y: -f.tether.anchor.y } };
}

/** One tether line drawing: the stretched line and the tip, in separate containers so they can sit in two layers. */
export interface TetherLineDrawing {
  line: Container;
  tip: Container;
  /**
   * Run the line from `from` to `to` (y down), mirrored by `facing` as the fighter's drawing is, with the tip's
   * symbol loops on `frame`.
   */
  place(from: Vec, to: Vec, facing: 1 | -1, frame: number): void;
}

/** `art.tetherLine` drawn in `palette`. */
export function createTetherLine(art: FighterArt, palette = 'default'): TetherLineDrawing {
  const def: TetherLineArt = art.tetherLine!;
  const colors = art.palettes[palette] ?? art.palettes.default;
  const leaf = (name: string, frame: number): GraphicsContext | null => {
    const found = resolveSymbol(def.symbols, name, frame);
    return found === null ? null : symbolContext(def.symbols, found, colors);
  };
  const stretch = new Graphics(leaf(def.line, 0) ?? undefined);
  const head = new Graphics();
  const line = new Container();
  const tip = new Container();
  line.addChild(stretch);
  tip.addChild(head);
  return {
    line,
    tip,
    place(from, to, facing, frame) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      // The fighter's drawing faces right and mirrors with its facing, so the line turns in that mirrored space.
      const turn = Math.atan2(dy, dx * facing);
      line.position.set(from.x, from.y);
      line.scale.x = facing;
      stretch.rotation = turn;
      stretch.scale.x = length;
      stretch.visible = length >= MIN_LENGTH;
      tip.position.set(to.x, to.y);
      tip.scale.x = facing;
      head.rotation = turn;
      const context = def.tip ? leaf(def.tip, frame) : null;
      head.visible = context !== null;
      if (context) head.context = context;
    },
  };
}

/**
 * Each fighter's tether line (tetherLinePlacement) in its port's costume. The lines sit behind the fighters, so a
 * line leaves from behind its fighter's body, and the tips over them, so a tip on another fighter stays in sight.
 * One drawing per port, rebuilt only when the fighter or costume changes. World units, y down.
 */
export class TetherLineView {
  readonly behind = new Container();
  readonly front = new Container();
  private readonly views = new Map<number, { key: string; drawing: TetherLineDrawing }>();

  /** `costumes` is each port's palette name (Renderer); a port without one wears `default`. */
  draw(state: MatchState, alpha: number, costumes: readonly string[] = []): void {
    const shown = new Set<number>();
    for (const f of state.fighters) {
      const at = tetherLinePlacement(f, alpha);
      const art = fighterArt(getFighter(f.fighter));
      if (!at || !art) continue;
      shown.add(f.port);
      const palette = costumes[f.port] ?? 'default';
      const key = `${f.fighter}|${palette}`;
      let held = this.views.get(f.port);
      if (held?.key !== key) {
        held?.drawing.line.destroy({ children: true });
        held?.drawing.tip.destroy({ children: true });
        held = { key, drawing: createTetherLine(art, palette) };
        this.views.set(f.port, held);
        this.behind.addChild(held.drawing.line);
        this.front.addChild(held.drawing.tip);
      }
      held.drawing.line.visible = true;
      held.drawing.tip.visible = true;
      held.drawing.place(at.from, at.to, f.facing, state.frame);
    }
    for (const [port, held] of this.views) {
      if (shown.has(port)) continue;
      held.drawing.line.visible = false;
      held.drawing.tip.visible = false;
    }
  }
}
