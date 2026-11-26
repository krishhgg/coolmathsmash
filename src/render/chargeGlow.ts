import type { Graphics } from 'pixi.js';
import { getFighter } from '../fighters/registry';
import { SMASH_CHARGE_FRAMES } from '../sim/actions/charge';
import type { MatchState } from '../sim/match';
import { chargeClipName, fighterArt } from './fighterView';

/**
 * Placeholder charge glow behind each fighter, in world units (y down): it grows while a move charges and pulses
 * around a fighter holding a stored charge for its current form, brighter the fuller the charge. A move whose art
 * draws its own charge (a `<move>Charge` clip) gets no placeholder while it charges. `alpha` interpolates positions
 * like the fighter views.
 */
export function drawChargeGlows(g: Graphics, state: MatchState, alpha: number): void {
  g.clear();
  for (const f of state.fighters) {
    if (f.action === 'ko' || f.action === 'out') continue;
    const def = getFighter(f.fighter);
    const full = (move: string) => def.moves?.[move]?.chargeFrames ?? SMASH_CHARGE_FRAMES;
    const hold = f.move === null ? undefined : def.moves?.[f.move]?.charge;
    const drawn = hold !== undefined && chargeClipName(fighterArt(def), f.move!) !== undefined;
    const charging = hold !== undefined && !drawn && f.actionFrame <= hold ? f.charge / full(f.move!) : 0;
    const kept = f.storedCharge?.fighter === f.fighter ? f.storedCharge : null;
    const stored = kept ? kept.frames / full(kept.move) : 0;
    const level = Math.max(charging, stored);
    if (level === 0) continue;
    const { height } = def.stats;
    const x = f.prevPos.x + (f.pos.x - f.prevPos.x) * alpha;
    const y = -(f.prevPos.y + (f.pos.y - f.prevPos.y) * alpha + height / 2);
    const pulse = stored > 0 ? 0.5 + 0.5 * Math.sin(state.frame / 4) : 1;
    const r = height * (0.45 + 0.25 * level);
    g.circle(x, y, r * 1.3).fill({ color: '#ffb12a', alpha: (0.2 + 0.3 * level) * pulse });
    g.circle(x, y, r).fill({ color: '#fff1a0', alpha: 0.25 + 0.35 * level });
  }
}
