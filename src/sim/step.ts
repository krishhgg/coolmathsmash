import { getFighter } from '../fighters/registry';
import { getStage } from '../stages/registry';
import { ACTIONS } from './actions';
import { runAction } from './actions/registry';
import { RESPAWN_DELAY, SHIELD_MAX, SHIELD_REGEN, SHIELD_BREAK_HEIGHT } from './constants';
import { derived, type Ctx, type FighterState } from './fighter';
import type { MatchState, PlayerState } from './match';
import { airMove, groundMove } from './movement';
import { compileStage, type CompiledStage } from './stage';

const compiled = new Map<string, CompiledStage>();

export function compiledStage(id: string): CompiledStage {
  let c = compiled.get(id);
  if (!c) {
    c = compileStage(getStage(id));
    compiled.set(id, c);
  }
  return c;
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
    stage: compiledStage(m.config.stage),
  };
}

/** One frame of one fighter: advance the action, run its physics, tick timers, check the blast zones. */
export function stepFighter(m: MatchState, f: FighterState, p: PlayerState): void {
  const x = makeCtx(m, f, p);
  f.prevPos = { x: f.pos.x, y: f.pos.y };
  f.actionFrame++;
  runAction(x);
  const physics = ACTIONS[f.action]!.physics;
  if (physics === 'ground' && f.ground) groundMove(x);
  else if (physics === 'air' || (physics === 'ground' && !f.ground)) airMove(x);

  if (f.intangible > 0) f.intangible--;
  if (f.ledgeLock > 0) f.ledgeLock--;
  if (f.action !== 'shield' && f.action !== 'shieldBreak' && f.action !== 'dizzy') {
    f.shieldHp = Math.min(SHIELD_MAX, f.shieldHp + SHIELD_REGEN);
  }
  checkBlastZones(x);
}

function checkBlastZones(x: Ctx): void {
  const { f, stage } = x;
  if (f.action === 'ko' || f.action === 'out' || f.action === 'respawn') return;
  const b = stage.geo.blastZones;
  if (f.pos.x > b.left && f.pos.x < b.right && f.pos.y > b.bottom && f.pos.y < b.top) return;
  f.stocks--;
  f.respawnTimer = RESPAWN_DELAY;
  f.action = 'ko';
  f.actionFrame = 0;
  f.move = null;
  f.ground = null;
  f.ledge = -1;
  f.vel = { x: 0, y: 0 };
  f.kb = { x: 0, y: 0 };
}
