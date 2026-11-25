import { getFighter } from '../fighters/registry';
import { getStage } from '../stages/registry';
import { SHIELD_BREAK_HEIGHT } from './constants';
import { derived, type Ctx, type FighterState } from './fighter';
import type { MatchState, PlayerState } from './match';
import type { PieceState, StageState } from './movingStage';
import { compileStage, type CompiledStage } from './stage';
import type { Vec } from './vec';

/**
 * The compiled stage, the stage posed on the current frame, and a fighter's Ctx. They live apart from step.ts so
 * that movingStage.ts (and through it cast.ts and the tether actions) can use them without importing step.ts,
 * which loads the action registry (actions/index.ts): an action module imported first would otherwise reach the
 * registry through that cycle before its own actions exist, and they would never be registered.
 */

const compiled = new Map<string, CompiledStage>();

export function compiledStage(id: string): CompiledStage {
  let c = compiled.get(id);
  if (!c) {
    c = compileStage(getStage(id));
    compiled.set(id, c);
  }
  return c;
}

const posed = new WeakMap<StageState, CompiledStage>();

/**
 * The stage as it stands on the match's current frame: every piece at its offset, absent pieces flagged. Every
 * Ctx carries it, so collision, ledges and getups all see the moved geometry. Cached per StageState object,
 * which advanceStage replaces (never mutates) each frame.
 */
export function posedStage(m: MatchState): CompiledStage {
  let c = posed.get(m.stage);
  if (!c) {
    c = pose(compiledStage(m.config.stage), m.stage);
    posed.set(m.stage, c);
  }
  return c;
}

function pose(base: CompiledStage, st: StageState): CompiledStage {
  const still = (p: PieceState) => p.x === 0 && p.y === 0 && p.on;
  if (st.solids.every(still) && st.platforms.every(still)) return base;
  const g = base.geo;
  const at = (s: number) => st.solids[s]!;
  const move = (v: Vec, o: PieceState): Vec => ({ x: v.x + o.x, y: v.y + o.y });
  return {
    geo: {
      ...g,
      solids: g.solids.map((s, i) => ({
        ...s,
        points: s.points.map(([x, y]): [number, number] => [x + at(i).x, y + at(i).y]),
      })),
      platforms: g.platforms.map((p, i) => {
        const o = st.platforms[i]!;
        return { ...p, x1: p.x1 + o.x, x2: p.x2 + o.x, y: p.y + o.y };
      }),
      ledges: g.ledges.map((l, i) => {
        const s = base.ledgeSolid[i]!;
        return s < 0 ? l : { ...l, ...move(l, at(s)) };
      }),
    },
    edges: base.edges.map((e) => ({ ...e, a: move(e.a, at(e.solid)), b: move(e.b, at(e.solid)) })),
    ledgeSolid: base.ledgeSolid,
    present: { solids: st.solids.map((p) => p.on), platforms: st.platforms.map((p) => p.on) },
  };
}

export function makeCtx(m: MatchState, f: FighterState, p: PlayerState): Ctx {
  const def = getFighter(f.fighter);
  return {
    m,
    f,
    p,
    c: p.control,
    def,
    s: def.stats,
    d: derived(def.stats, SHIELD_BREAK_HEIGHT),
    stage: posedStage(m),
  };
}
