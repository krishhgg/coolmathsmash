import { getFighter } from '../fighters/registry';
import { getStage } from '../stages/registry';
import './actions';
import { tickMobility } from './actions/mobility';
import { actionDef, runAction } from './actions/registry';
import { dropLostTether, rideAnchor } from './actions/tether';
import { stepTetherMove } from './actions/tetherCast';
import { applyLaunch, stepLaunchMotion } from './combat/hits';
import {
  RESPAWN_DELAY,
  SHIELD_MAX,
  SHIELD_REGEN,
  SHIELD_BREAK_HEIGHT,
  TOP_KO_MARGIN,
  TOP_KO_MIN_SPEED,
} from './constants';
import { emit } from './events';
import { derived, type Ctx, type FighterState } from './fighter';
import type { MatchState, PlayerState } from './match';
import { airMove, groundMove } from './movement';
import { posedStage } from './movingStage';
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
    stage: posedStage(m),
  };
}

/** One frame of one fighter: advance the action, run its physics, tick timers, check the blast zones. */
export function stepFighter(m: MatchState, f: FighterState, p: PlayerState): void {
  const x = makeCtx(m, f, p);
  f.prevPos = { x: f.pos.x, y: f.pos.y };
  dropLostTether(m, f);
  rideAnchor(m, f);
  if (f.hitlag > 0) {
    f.hitlag--;
    return;
  }
  if (f.launch) applyLaunch(x);
  else if (f.launchMotion) stepLaunchMotion(x);
  f.actionFrame++;
  runAction(x);
  tickMobility(x);
  stepTetherMove(x);
  const physics = actionDef(f).physics;
  if (physics === 'ground' && f.ground) groundMove(x);
  else if (physics === 'air' || (physics === 'ground' && !f.ground)) airMove(x);

  if (f.intangible > 0) f.intangible--;
  if (f.ledgeLock > 0) f.ledgeLock--;
  if (
    f.action !== 'shield' &&
    f.action !== 'shieldStun' &&
    f.action !== 'shieldBreak' &&
    f.action !== 'dizzy'
  ) {
    f.shieldHp = Math.min(SHIELD_MAX, f.shieldHp + SHIELD_REGEN);
  }
  checkBlastZones(x);
}

function checkBlastZones(x: Ctx): void {
  const { f, stage } = x;
  if (f.action === 'ko' || f.action === 'out' || f.action === 'respawn') return;
  const b = stage.geo.blastZones;
  const pastTop = f.pos.y >= b.top + TOP_KO_MARGIN || (f.pos.y >= b.top && f.kb.y >= TOP_KO_MIN_SPEED);
  if (f.pos.x > b.left && f.pos.x < b.right && f.pos.y > b.bottom && !pastTop) return;
  f.stocks--;
  const side =
    f.pos.x <= b.left ? 'left' : f.pos.x >= b.right ? 'right' : f.pos.y >= b.top ? 'top' : 'bottom';
  emit(x.m, { type: 'ko', port: f.port, stocks: f.stocks, side, x: f.pos.x, y: f.pos.y });
  f.respawnTimer = RESPAWN_DELAY;
  f.action = 'ko';
  f.actionFrame = 0;
  f.move = null;
  f.ground = null;
  f.ledge = -1;
  f.vel = { x: 0, y: 0 };
  f.kb = { x: 0, y: 0 };
  f.launch = null;
  f.launchMotion = null;
  f.hitstun = 0;
  f.speedUpFaf = 0;
  f.flyTop = false;
  // Ultimate: a stored charge is lost only on a KO as the form that stored it (Squirtle's Water Gun).
  if (f.storedCharge?.fighter === f.fighter) f.storedCharge = null;
}
