import './actions';
import { tickMobility } from './actions/mobility';
import { actionDef, runAction } from './actions/registry';
import { dropLostTether, rideAnchor } from './actions/tether';
import { stepTetherMove } from './actions/tetherCast';
import { applyLaunch, stepLaunchMotion } from './combat/hits';
import { blastZoneCrossed } from './blastZones';
import { INFINITE_STOCKS, RESPAWN_DELAY, SHIELD_MAX, SHIELD_REGEN } from './constants';
import { makeCtx } from './context';
import { emit } from './events';
import type { Ctx, FighterState } from './fighter';
import type { MatchState, PlayerState } from './match';
import { resetMetersOnKo, tickMeters } from './meters';
import { airMove, groundMove } from './movement';
import { keepEntityFooting } from './movingStage';
import { clearStatusesOnKo, tickFreezes, tickStatuses } from './statuses';

export { compiledStage, makeCtx } from './context';

/** One frame of one fighter: advance the action, run its physics, tick timers, check the blast zones. */
export function stepFighter(m: MatchState, f: FighterState, p: PlayerState): void {
  const x = makeCtx(m, f, p);
  f.prevPos = { x: f.pos.x, y: f.pos.y };
  dropLostTether(m, f);
  rideAnchor(m, f);
  const frozen = tickFreezes(x);
  if (f.hitlag > 0) {
    f.hitlag--;
    f.hitlagAt = m.frame;
    return;
  }
  if (frozen) return;
  keepEntityFooting(x);
  if (f.launch) applyLaunch(x);
  else if (f.launchMotion) stepLaunchMotion(x);
  f.actionFrame++;
  runAction(x);
  tickMobility(x);
  tickStatuses(x);
  tickMeters(x);
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
  const side = blastZoneCrossed(stage.geo.blastZones, stage.geo.camera, f.pos, f.kb, f.vel);
  if (!side) return;
  if (x.m.config.stocks < INFINITE_STOCKS) f.stocks--;
  clearStatusesOnKo(x.m, f);
  resetMetersOnKo(f);
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
