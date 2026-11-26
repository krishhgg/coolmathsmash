import { getFighter } from '../fighters/registry';
import { Btn, neutralInput, type InputFrame } from '../input/types';
import type { FighterState } from '../sim/fighter';
import { AIR_INPUTS, DASH_INPUTS, GROUND_INPUTS, STICK, press } from './inputs';
import { actionable, chargeInput } from './knowledge';
import type { Attack } from './options';
import {
  clampToStage,
  floorBelow,
  inZone,
  landingX,
  landsSafe,
  standSafe,
  walkTarget,
  type StageInfo,
} from './stage';

/**
 * Programs: inputs that take more than one frame (a short-hop aerial, a shield held through an attack, a run that
 * brakes in time). Each step sees the CPU's fighter as it is and returns that frame's input, or null when done.
 */
export interface Program {
  name: string;
  /** Neutral thinking may replace it (movement); otherwise it runs to the end. */
  interruptible: boolean;
  /** Keeps running off stage (ledge getups); every other program yields to the recovery there. */
  offstage?: boolean;
  /** Keeps holding a button across programs (shield), so a press edge is not needed. */
  holds?: boolean;
  /**
   * `stage` is the stage on this frame (stageInfo); programs that read the stage fall back to the one they started
   * with.
   */
  step(t: number, f: Readonly<FighterState>, stage?: StageInfo): InputFrame | null;
}

export function wait(frames: number): Program {
  return { name: 'wait', interruptible: true, step: (t) => (t < frames ? neutralInput() : null) };
}

export function crouch(frames: number): Program {
  return {
    name: 'crouch',
    interruptible: true,
    step: (t) => (t < frames ? press({ y: -STICK.tilt }) : null),
  };
}

/**
 * Walk or run to x on the ground (kept on the stage), letting go in time for a run to brake; optionally turn to face
 * `face` on arrival. Every frame it stops short of where walking is unsafe on that frame's stage (walkTarget): a
 * gap, an open or opening trapdoor, a damage zone.
 */
export function goTo(x: number, runFar: boolean, frames: number, info: StageInfo, face?: number): Program {
  let lastX = 0;
  const target = clampToStage(info, x, 3);
  return {
    name: 'goTo',
    interruptible: true,
    step(t, f, stage = info) {
      if (t >= frames || f.ground === null) return null;
      const d = walkTarget(stage, f.fighter, f.pos.x, f.pos.y, target) - f.pos.x;
      const s = Math.sign(d);
      const ad = Math.abs(d);
      let sx = 0;
      const moving = f.action === 'dash' || f.action === 'run';
      if (ad < 1.5) {
        if (face && face !== f.facing && !moving && Math.abs(f.vel.x) < 0.3 && lastX === 0) sx = 30 * face;
        else if (t > 0 || !face || face === f.facing) {
          lastX = 0;
          return t === 0 ? neutralInput() : null;
        }
      } else if (moving && f.facing === s) {
        const v = Math.abs(f.vel.x);
        sx = ad > (v * v) / 0.2 + 2 ? 100 * s : 0;
      } else if (runFar && ad > 18) {
        const held = Math.abs(lastX) >= 30;
        sx = held && (Math.sign(lastX) !== s || !moving) ? 0 : 100 * s;
      } else {
        sx = s * Math.min(STICK.walkMax, Math.max(25, 20 + ad * 4));
      }
      lastX = sx;
      return press({ x: sx });
    },
  };
}

/**
 * Drift toward x in the air, fast falling once if asked and it lands on solid ground. On a stage with hazards it
 * drifts toward the nearest safe landing to x on that frame's stage instead (landingX).
 */
export function drift(x: number, fastFall: boolean, frames: number, info: StageInfo): Program {
  let ff = false;
  return {
    name: 'drift',
    interruptible: true,
    step(t, f, stage = info) {
      if (t >= frames || f.ground !== null) return null;
      const d = (stage.calm ? x : landingX(stage, f, x)) - f.pos.x;
      const sx = Math.abs(d) < 3 ? d * 20 : Math.sign(d) * 100;
      let y = 0;
      if (fastFall && !ff && actionable(f) && canFastFall(f, stage)) {
        ff = true;
        y = -100;
      }
      return press({ x: sx, y });
    },
  };
}

/**
 * Hold Shield for `frames` frames, and on through any shield stun left then. Hitlag stretches a stun past the frames
 * the CPU counted, and letting go during it means pressing Shield again to keep the shield: a new press the shield
 * never takes, so a jump out of the shield air dodges with it on its first frame in the air.
 */
export function shield(frames: number): Program {
  return {
    name: 'shield',
    interruptible: true,
    holds: true,
    step: (t, f) => (t < frames || f.action === 'shieldStun' ? press({ buttons: Btn.Shield }) : null),
  };
}

export function spotDodge(): Program {
  return {
    name: 'spotDodge',
    interruptible: false,
    step: (t) =>
      t === 0 ? press({ buttons: Btn.Shield }) : t === 1 ? press({ y: -100, buttons: Btn.Shield }) : null,
  };
}

export function roll(dir: number): Program {
  return {
    name: 'roll',
    interruptible: false,
    step: (t) =>
      t === 0
        ? press({ buttons: Btn.Shield })
        : t === 1
          ? press({ x: 100 * dir, buttons: Btn.Shield })
          : null,
  };
}

/** A neutral air dodge: it keeps momentum, so it never carries the CPU off the stage. */
export function airDodge(): Program {
  return {
    name: 'airDodge',
    interruptible: false,
    step: (t) => (t === 0 ? press({ buttons: Btn.Shield }) : null),
  };
}

/** Full hop, drifting `stick` (-100..100) and holding jump for `hold` frames; over on landing or after `frames`. */
export function fullHop(name: string, stick: number, hold: number, frames: number): Program {
  return {
    name,
    interruptible: false,
    step: (t, f) => {
      if (t > frames || (t > 4 && f.ground !== null)) return null;
      return press({ x: stick, buttons: t < hold ? Btn.Jump : 0 });
    },
  };
}

export function shortHop(dir: number): Program {
  return {
    name: 'shortHop',
    interruptible: false,
    step: (t, f) => {
      if (t > 3 && (f.ground !== null || f.vel.y <= 0)) return null;
      return press({ x: dir * 100, buttons: t === 0 ? Btn.Jump : 0 });
    },
  };
}

export function dropThrough(): Program {
  return {
    name: 'drop',
    interruptible: false,
    step: (t) => (t === 0 ? neutralInput() : t === 1 ? press({ y: -100 }) : t < 6 ? neutralInput() : null),
  };
}

/** After a ledge jump: drift onto the stage. */
export function ledgeJump(toward: number): Program {
  return {
    name: 'ledgeJump',
    interruptible: false,
    offstage: true,
    step: (t, f) => (t > 40 || (t > 8 && f.ground !== null) ? null : press({ x: 60 * toward })),
  };
}

/** Let go of the ledge, then double jump back up over it. */
export function dropJump(toward: number): Program {
  return {
    name: 'dropJump',
    interruptible: false,
    offstage: true,
    step: (t, f) => {
      if (t > 60 || (t > 6 && f.ground !== null)) return null;
      if (t < 3) return neutralInput();
      return press({ x: 100 * toward, buttons: t === 3 ? Btn.Jump : 0 });
    },
  };
}

/**
 * A grounded move: wait until actionable on the ground (out of a shield drop), then input it facing `facing`. A grab
 * comes straight out of the shield instead (Grab with Shield still held), so it keeps holding Shield until then.
 * Once the move plays, chargeInput fires it with `hold` frames of charge as the knowledge probe did (0 for the tapped
 * move, MoveProbe.held for a charged one): a held charge keeps its buttons held until then, and a tap-charged special
 * gets its second press then.
 */
export function groundMove(move: string, facing: 1 | -1, hold = 0): Program {
  const input = GROUND_INPUTS[move] ?? DASH_INPUTS[move];
  return {
    name: `ground:${move}${hold ? `:held${hold}` : ''}`,
    interruptible: false,
    holds: move === 'grab',
    step(t, f) {
      if (f.move === move && f.action === 'attack') return chargeInput(f, input?.buttons ?? 0, hold);
      if (t > 40) return null;
      if (move === 'grab' && f.action === 'shieldStun') return press({ buttons: Btn.Shield });
      if (move === 'grab' && f.action === 'shield') return press({ buttons: Btn.Grab | Btn.Shield });
      if (!actionable(f) || f.ground === null) return neutralInput();
      return input ? press(input, facing) : null;
    },
  };
}

/** Room a fast fall leaves beside a damage zone on the way down, as standSafe leaves around one to stand. */
const FALL_PAD = 2;

/**
 * Fast fall only when falling onto solid ground that stays: over it now, and over ground it can stand on where the
 * current drift would carry the fall down to the stage's height, so a fast fall never takes the CPU past the ledge,
 * into a gap or into a damage zone. The way down keeps FALL_PAD units from every damage zone too: a fall that lands
 * clear of a zone can still clip its top corner, as a Red Ball fast falling past the hazard testbed's water did.
 */
export function canFastFall(f: Readonly<FighterState>, info: StageInfo): boolean {
  if (f.vel.y > 0 || f.fastFalling || floorBelow(info, f.pos.x, f.pos.y, false, true) === null) return false;
  const speed = getFighter(f.fighter).stats.fastFallSpeed;
  const t = Math.max(0, f.pos.y - info.top) / speed;
  const x = f.pos.x + f.vel.x * t;
  const fy = floorBelow(info, x, f.pos.y, false, true);
  if (fy === null || !standSafe(info, f.fighter, x, fy)) return false;
  for (let i = 1; f.pos.y - speed * i > fy; i++) {
    if (inZone(info, f.fighter, f.pos.x + f.vel.x * i, f.pos.y - speed * i, FALL_PAD)) return false;
  }
  return true;
}

/** Frames until `f` falls to height `y` at its current vertical speed. */
function fallFrames(f: Readonly<FighterState>, y: number): number {
  const s = getFighter(f.fighter).stats;
  let h = f.pos.y;
  let vy = f.vel.y;
  let t = 0;
  for (; h > y && t < 600; t++) {
    vy = Math.max(vy - s.gravity, -s.fallSpeed);
    h += vy;
  }
  return t;
}

/** Stick x for an airborne drift: `x` when it comes down somewhere safe, else toward the nearest safe landing. */
export function steer(f: Readonly<FighterState>, stage: StageInfo, x: number): number {
  const fy = floorBelow(stage, f.pos.x, f.pos.y, true, true) ?? stage.top;
  const lands = f.pos.x + f.vel.x * fallFrames(f, fy);
  if (landsSafe(stage, f.fighter, lands, f.pos.y)) return x;
  const d = landingX(stage, f, lands) - f.pos.x;
  return Math.abs(d) < 3 ? Math.round(d * 20) : Math.sign(d) * 100;
}

function aerialInput(move: string, facing: 1 | -1, drift: number): InputFrame {
  const p = AIR_INPUTS[move]!;
  const i = press(p, facing);
  if (move !== 'nair' && p.x === undefined) i.x = Math.round(drift * 100);
  return i;
}

/**
 * The rest of an aerial: hold the drift and fast fall once if asked; over when it lands or the move ends. On a stage
 * with hazards, when the drift would come down somewhere unsafe, steer for the nearest safe landing instead.
 */
function afterAerial(
  a: Attack,
  fastFall: boolean,
): (f: Readonly<FighterState>, stage: StageInfo) => InputFrame | null {
  let ff = false;
  const x = Math.round(a.drift * 100);
  return (f, stage) => {
    if (f.ground !== null || f.action !== 'aerial') return null;
    let y = 0;
    if (fastFall && !ff && canFastFall(f, stage)) {
      ff = true;
      y = -100;
    }
    return press({ x: stage.calm ? x : steer(f, stage, x), y });
  };
}

/**
 * A short or full hop aerial from the ground or out of shield: jump (holding it through the squat for a full hop),
 * drift, and input the aerial `late` frames after take-off.
 */
export function jumpAerial(a: Attack, fastFall: boolean, info: StageInfo): Program {
  let phase: 'squat' | 'rise' | 'after' = 'squat';
  let airAt = -1;
  const x = Math.round(a.drift * 100);
  const after = afterAerial(a, fastFall);
  return {
    name: `jump:${a.move}`,
    interruptible: false,
    step(t, f, stage = info) {
      if (t > 120) return null;
      if (phase === 'squat') {
        if (f.action === 'jump') {
          phase = 'rise';
          airAt = t;
        } else if (f.action === 'jumpSquat') {
          return press({ x, buttons: a.full ? Btn.Jump : 0 });
        } else if (actionable(f) || f.action === 'shield') {
          return press({ buttons: Btn.Jump });
        } else if (t > 20) {
          return null;
        } else {
          return press({ buttons: f.action === 'shieldStun' ? Btn.Shield : 0 });
        }
      }
      if (phase === 'rise') {
        if (f.ground !== null) return null;
        if (t - airAt < a.late) return press({ x });
        phase = 'after';
        return aerialInput(a.move, f.facing, a.drift);
      }
      return after(f, stage);
    },
  };
}

/** An aerial from mid-air, after a double jump when the attack calls for one. */
export function airAerial(a: Attack, fastFall: boolean, info: StageInfo): Program {
  const jumpFirst = a.kind === 'doubleJump' ? 1 : 0;
  const after = afterAerial(a, fastFall);
  return {
    name: `air:${a.move}`,
    interruptible: false,
    step(t, f, stage = info) {
      if (t > 70 || (t > 0 && f.ground !== null)) return null;
      if (jumpFirst && t === 0) return press({ x: Math.round(a.drift * 100), buttons: Btn.Jump });
      if (t === jumpFirst) return aerialInput(a.move, f.facing, a.drift);
      return after(f, stage);
    },
  };
}
