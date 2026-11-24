import { getFighter } from '../../fighters/registry';
import type { MoveDef } from '../../fighters/types';
import type { Ctx, FighterState } from '../fighter';
import { fastFallCheck } from './air';
import { enterAction, inWindow, setAction, type ActionDef } from './registry';

export function moveOf(f: FighterState): MoveDef | undefined {
  return f.move ? getFighter(f.fighter).moves?.[f.move] : undefined;
}

/** Begin one of the fighter's moves now: grounded moves play as 'attack', airborne ones as 'aerial'. */
export function startMove(x: Ctx, name: string): void {
  if (!x.def.moves?.[name]) throw new Error(`${x.def.id} has no move ${name}`);
  setAction(x, x.f.ground ? 'attack' : 'aerial');
  x.f.move = name;
  x.f.hitVictims = [];
}

/** A window marked `rehit` forgets earlier victims as it opens, so multi-hit moves connect again. */
function openWindows(f: FighterState, move: MoveDef): void {
  if (move.hits.some((w) => w.rehit && w.frames[0] === f.actionFrame)) f.hitVictims = [];
}

export const ATTACK: Record<string, ActionDef> = {
  /** A grounded move, played from its frame data until its first actionable frame. */
  attack: {
    physics: 'ground',
    update(x) {
      const { f } = x;
      const move = moveOf(f)!;
      openWindows(f, move);
      if (f.actionFrame >= move.faf) setAction(x, 'idle');
    },
  },

  /** An airborne move. Landing during it costs the move's landing lag, unless it lands in an auto-cancel window. */
  aerial: {
    physics: 'air',
    update(x) {
      const { f } = x;
      const move = moveOf(f)!;
      openWindows(f, move);
      fastFallCheck(x);
      if (f.actionFrame >= move.faf) setAction(x, 'fall');
    },
    land(x) {
      const { f, s } = x;
      const move = moveOf(f)!;
      const cancelled = move.autoCancel?.some((w) => inWindow(f.actionFrame, w)) ?? false;
      f.landingLag = !cancelled && move.landingLag !== undefined ? move.landingLag : s.softLandingLag;
      enterAction(x, 'land', 0);
    },
  },
};
