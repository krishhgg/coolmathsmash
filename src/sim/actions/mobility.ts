import { Btn } from '../../input/types';
import type { MoveDef } from '../../fighters/types';
import { HELPLESS_LANDING_LAG } from '../constants';
import { buffered, cStickDir, consume, consumeCStick, isHeld, stickX, stickY } from '../control';
import type { Ctx } from '../fighter';
import { GLIDE_DEFAULTS, HOVER_REFILL_FRAMES, type GlideDef } from '../mobility';
import { leaveGround, normalLandingLag } from '../movement';
import { emit } from '../events';
import { approach, clamp } from '../vec';
import { airActionable } from './air';
import { airAttack, playMove, startMove } from './attack';
import { enterAction, setAction, type ActionDef } from './registry';

const DEG = Math.PI / 180;
/** A climbing glide slower than this along its path stalls into a fall. */
const GLIDE_STALL = 0.1;
/** Holding back multiplies glide speed by this each frame, and turns the glide around below GLIDE_TURN. */
const GLIDE_BRAKE = 0.92;
const GLIDE_TURN = 0.3;

function glideOf(x: Ctx): Required<GlideDef> {
  return { ...GLIDE_DEFAULTS, ...x.def.glide! };
}

/** Drag on glide speed, chosen so a glide at the neutral pitch settles at exactly `speed` across. */
function glideDrag(g: Required<GlideDef>): number {
  const a = g.angles[0] * DEG;
  return (g.accel * -Math.sin(a) * Math.cos(a)) / g.speed;
}

function startGlide(x: Ctx, helpless: boolean): void {
  const { f, c } = x;
  const g = glideOf(x);
  const m = f.mobility;
  const sx = stickX(c);
  if (sx !== 0) f.facing = Math.sign(sx) as 1 | -1;
  m.glideUsed = true;
  m.glideHelpless = helpless;
  m.glideAngle = g.angles[0];
  m.glideSpeed = Math.max(Math.abs(f.vel.x), g.speed / 2);
  f.fastFalling = false;
  setAction(x, 'glide');
}

function endGlide(x: Ctx): void {
  setAction(x, x.f.mobility.glideHelpless ? 'helpless' : 'fall');
}

/**
 * Part of airActionable: holding Jump once a jump has peaked glides (when every midair jump is used) or floats.
 * True when it switched action.
 */
export function airMobility(x: Ctx): boolean {
  const { f, def, s, c } = x;
  if (!isHeld(c, Btn.Jump) || f.vel.y > 0 || f.action === 'float') return false;
  const m = f.mobility;
  if (def.glide && !m.glideUsed && f.jumpsUsed >= s.jumps) {
    startGlide(x, false);
    return true;
  }
  if (def.float && (m.floating || m.floatFrames === 0)) {
    if (!m.floating) emit(x.m, { type: 'float', port: f.port, phase: 'start' });
    m.floating = true;
    setAction(x, 'float');
    return true;
  }
  return false;
}

/**
 * A move with `glide: true` reaching its end with Jump held glides (if the airtime's glide is unused). After a
 * helpless move the glide ends in helpless fall, landing with the move's landing lag.
 */
export function glideAfterMove(x: Ctx, move: MoveDef): boolean {
  const { f, c } = x;
  if (!move.glide || !x.def.glide || f.mobility.glideUsed || !isHeld(c, Btn.Jump)) return false;
  startGlide(x, move.helpless ?? false);
  if (move.helpless) f.landingLag = move.landingLag ?? HELPLESS_LANDING_LAG;
  return true;
}

/** End the float, once; it is spent for the airtime unless the fighter is standing (landing ended it). */
function endFloat(x: Ctx): void {
  const { f, def } = x;
  if (!f.mobility.floating) return;
  f.mobility.floating = false;
  f.mobility.floatFrames = f.ground ? 0 : (def.float?.frames ?? 0);
  emit(x.m, { type: 'float', port: f.port, phase: 'end' });
}

function floatHolds(x: Ctx): boolean {
  const { f, c, def } = x;
  const m = f.mobility;
  if (!m.floating || !def.float) return false;
  return isHeld(c, Btn.Jump) && m.floatFrames < def.float.frames && !f.fastFalling;
}

/**
 * Every frame after the action runs, before physics: count the float down (also through aerials started from
 * it), end it once it no longer holds (reporting it, landing included) and refill hover fuel on the ground.
 */
export function tickMobility(x: Ctx): void {
  const { f, def } = x;
  const m = f.mobility;
  if (def.hover && (f.ground || f.action === 'respawn')) {
    const per = def.hover.fuel / (def.hover.refillFrames ?? HOVER_REFILL_FRAMES);
    m.hoverFuel = Math.min(def.hover.fuel, m.hoverFuel + per);
  }
  if (!m.floating) return;
  if ((f.action === 'float' || f.action === 'aerial') && floatHolds(x)) {
    m.floatFrames++;
    f.vel.y = 0;
    return;
  }
  endFloat(x);
}

/** Restore one midair jump (moves that give a jump back, like a flap-restoring special). */
export function regainAirJump(x: Ctx): void {
  x.f.jumpsUsed = Math.max(1, x.f.jumpsUsed - 1);
}

export const MOBILITY: Record<string, ActionDef> = {
  /** See GlideDef. Velocity comes from the pitch and glide speed alone: no gravity, no stick drift. */
  glide: {
    physics: 'air',
    drift: false,
    gravity: false,
    ledge: true,
    update(x) {
      const { f, c } = x;
      const g = glideOf(x);
      const m = f.mobility;
      if (!isHeld(c, Btn.Jump)) return endGlide(x);
      if (buffered(c, Btn.Attack) || cStickDir(c, f.facing) !== 'neutral') {
        consume(c, Btn.Attack);
        consumeCStick(c);
        if (startMove(x, g.attack)) return;
      }
      if (buffered(c, Btn.Special) && airAttack(x)) return;
      const sy = stickY(c);
      const [neutral, down, up] = g.angles;
      const target = sy >= 0 ? neutral + (up - neutral) * sy : neutral + (neutral - down) * sy;
      m.glideAngle = approach(m.glideAngle, target, g.turnRate);
      const a = m.glideAngle * DEG;
      m.glideSpeed += -g.accel * Math.sin(a) - glideDrag(g) * m.glideSpeed;
      if (stickX(c) * f.facing <= -0.5) {
        m.glideSpeed *= GLIDE_BRAKE;
        if (m.glideSpeed < GLIDE_TURN) f.facing = -f.facing as 1 | -1;
      }
      if (m.glideSpeed < GLIDE_STALL) return endGlide(x);
      f.vel.x = clamp(f.facing * m.glideSpeed * Math.cos(a), -g.speed, g.speed);
      f.vel.y = Math.max(m.glideSpeed * Math.sin(a), -g.fallSpeed);
    },
    land(x) {
      const { f } = x;
      if (!f.mobility.glideHelpless) f.landingLag = normalLandingLag(x);
      enterAction(x, 'land', 0);
    },
  },

  /** See FloatDef. tickMobility holds the height and counts the frames; any air option can come out of it. */
  float: {
    physics: 'air',
    gravity: false,
    ledge: true,
    update(x) {
      if (!floatHolds(x)) {
        endFloat(x);
        return setAction(x, 'fall');
      }
      airActionable(x);
    },
  },

  /**
   * See HoverDef. Plays the move that started it (its hitboxes and script) while thrusting; once the move's faf
   * has passed, letting go of Special falls normally and any air option cancels the hover.
   */
  hover: {
    physics: 'air',
    gravity: false,
    ledge: true,
    update(x) {
      const { f, s, c, def } = x;
      if (f.ground) leaveGround(x);
      const move = playMove(x);
      if (!move) return;
      const h = def.hover!;
      const thrust = isHeld(c, Btn.Special) && f.mobility.hoverFuel > 0;
      if (thrust) {
        f.mobility.hoverFuel = Math.max(0, f.mobility.hoverFuel - 1);
        if (f.mobility.hoverFuel === 0) emit(x.m, { type: 'fuelEmpty', port: f.port });
        f.vel.y = approach(f.vel.y, h.rise, h.accel);
      } else {
        f.vel.y = Math.max(f.vel.y - s.gravity, -s.fallSpeed);
      }
      if (f.actionFrame < move.faf) return;
      if (!thrust) return setAction(x, 'fall');
      airActionable(x);
    },
  },
};
