import { Btn, neutralInput, type InputFrame } from '../input/types';
import type { FighterState } from '../sim/fighter';
import { AIR_INPUTS, GROUND_INPUTS, STICK, press } from './inputs';
import { actionable } from './knowledge';
import type { Attack } from './options';
import { clampToStage, floorBelow, type StageInfo } from './stage';

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
  step(t: number, f: Readonly<FighterState>): InputFrame | null;
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
 * `face` on arrival.
 */
export function goTo(x: number, runFar: boolean, frames: number, info: StageInfo, face?: number): Program {
  let lastX = 0;
  const target = clampToStage(info, x, 3);
  return {
    name: 'goTo',
    interruptible: true,
    step(t, f) {
      if (t >= frames || f.ground === null) return null;
      const d = target - f.pos.x;
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

/** Drift toward x in the air, fast falling once if asked. */
export function drift(x: number, fastFall: boolean, frames: number): Program {
  let ff = false;
  return {
    name: 'drift',
    interruptible: true,
    step(t, f) {
      if (t >= frames || f.ground !== null) return null;
      const d = x - f.pos.x;
      const sx = Math.abs(d) < 3 ? d * 20 : Math.sign(d) * 100;
      let y = 0;
      if (fastFall && !ff && f.vel.y <= 0 && !f.fastFalling && actionable(f)) {
        ff = true;
        y = -100;
      }
      return press({ x: sx, y });
    },
  };
}

export function shield(frames: number): Program {
  return {
    name: 'shield',
    interruptible: true,
    holds: true,
    step: (t) => (t < frames ? press({ buttons: Btn.Shield }) : null),
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

/** A grounded move: wait until actionable on the ground (out of a shield drop), then input it facing `facing`. */
export function groundMove(move: string, facing: 1 | -1): Program {
  const input = GROUND_INPUTS[move] ?? (move === 'dashAttack' ? { x: 100, buttons: Btn.Attack } : null);
  return {
    name: `ground:${move}`,
    interruptible: false,
    step(t, f) {
      if (t > 40 || (f.move === move && f.action === 'attack')) return null;
      if (!actionable(f) || f.ground === null) return neutralInput();
      return input ? press(input, facing) : null;
    },
  };
}

/** Fast fall only over solid ground, never off stage. */
function canFastFall(f: Readonly<FighterState>, info: StageInfo): boolean {
  return f.vel.y <= 0 && !f.fastFalling && floorBelow(info, f.pos.x, f.pos.y, false) !== null;
}

function aerialInput(move: string, facing: 1 | -1, drift: number): InputFrame {
  const p = AIR_INPUTS[move]!;
  const i = press(p, facing);
  if (move !== 'nair' && p.x === undefined) i.x = Math.round(drift * 100);
  return i;
}

/** The rest of an aerial: hold the drift and fast fall once if asked; over when it lands or the move ends. */
function afterAerial(
  a: Attack,
  fastFall: boolean,
  info: StageInfo,
): (f: Readonly<FighterState>) => InputFrame | null {
  let ff = false;
  const x = Math.round(a.drift * 100);
  return (f) => {
    if (f.ground !== null || f.action !== 'aerial') return null;
    let y = 0;
    if (fastFall && !ff && canFastFall(f, info)) {
      ff = true;
      y = -100;
    }
    return press({ x, y });
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
  const after = afterAerial(a, fastFall, info);
  return {
    name: `jump:${a.move}`,
    interruptible: false,
    step(t, f) {
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
      return after(f);
    },
  };
}

/** An aerial from mid-air, after a double jump when the attack calls for one. */
export function airAerial(a: Attack, fastFall: boolean, info: StageInfo): Program {
  const jumpFirst = a.kind === 'doubleJump' ? 1 : 0;
  const after = afterAerial(a, fastFall, info);
  return {
    name: `air:${a.move}`,
    interruptible: false,
    step(t, f) {
      if (t > 70 || (t > 0 && f.ground !== null)) return null;
      if (jumpFirst && t === 0) return press({ x: Math.round(a.drift * 100), buttons: Btn.Jump });
      if (t === jumpFirst) return aerialInput(a.move, f.facing, a.drift);
      return after(f);
    },
  };
}
