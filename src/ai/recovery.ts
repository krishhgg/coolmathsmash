import { nextRandom } from '../engine/rng';
import { Btn, neutralInput, type InputFrame } from '../input/types';
import type { ControlState } from '../sim/control';
import type { FighterState } from '../sim/fighter';
import type { MatchState } from '../sim/match';
import { actionable, type FighterKnowledge } from './knowledge';
import { STICK, press } from './inputs';
import type { CpuLevel } from './levels';
import { run, soloMatch, type Driver, type Sample } from './look';
import { floorBelow, type StageInfo } from './stage';

/**
 * Getting back to the stage. The CPU tries a set of recovery plans (drift, double jump at different times, up or
 * side special at different heights, an air dodge) in a private copy of the simulation and picks one that ends on
 * the ledge or the stage. From under the stage, plans can also hold the special until the fighter has drifted
 * out near the ledge, as Ultimate's CPUs do, instead of rising into the underside. Low levels sometimes pick a plan
 * at random, which is how they self-destruct.
 */

export interface RecoveryParams {
  /** Frame (from the plan's start) to double jump, or Infinity. */
  jumpAt: number;
  /** Special to use, and when: on frame `specialAt`, or once below the ledge by `below` units. */
  special: string | null;
  specialAt: number;
  below: number;
  /**
   * Hold the special until the fighter is at most this far inside the spot where it would hang from the ledge,
   * so a fighter under the stage drifts out before it rises. Negative: drift that far out past the spot first.
   * Infinity: no wait.
   */
  reach: number;
  /** Frame to air dodge toward the ledge, or Infinity. */
  dodgeAt: number;
}

export interface RecoveryPlan {
  params: RecoveryParams;
  start: number;
  path: Sample[];
  outcome: 'ledge' | 'land' | 'fail';
}

type Ledge = { x: number; y: number; side: -1 | 1 };

/** The ledge to recover to: the nearest one horizontally. */
export function targetLedge(info: StageInfo, x: number): Ledge | null {
  let best: Ledge | null = null;
  for (const l of info.c.geo.ledges) if (!best || Math.abs(l.x - x) < Math.abs(best.x - x)) best = l;
  return best;
}

/** Where a fighter `width` wide hangs from ledge L (the sim's hangPos). */
function hangX(L: Ledge, width: number): number {
  return L.x + L.side * (width / 2 + 0.5);
}

/**
 * Where to steer: onto the stage once level with the ledge, else to where the fighter would hang from it, or `out`
 * units past that.
 */
function steerX(info: StageInfo, L: Ledge | null, f: Readonly<FighterState>, width: number, out = 0): number {
  if (!L) return info.centerX;
  if (f.pos.y >= L.y - 1) return L.x - L.side * 12;
  return hangX(L, width) + L.side * out;
}

export function recoveryDriver(info: StageInfo, k: FighterKnowledge, p: RecoveryParams): Driver {
  let jumped = false;
  let special = false;
  let dodged = false;
  return (t, f) => {
    const L = targetLedge(info, f.pos.x);
    const out = p.special && !special && p.reach < 0 ? -p.reach : 0;
    const d = steerX(info, L, f, k.stats.width) - f.pos.x;
    const ds = out ? steerX(info, L, f, k.stats.width, out) - f.pos.x : d;
    const sx = Math.abs(ds) < 2 ? Math.round(ds * 30) : Math.sign(ds) * STICK.full;
    const i = neutralInput();
    i.x = Math.max(-100, Math.min(100, sx));
    if (f.ground !== null || !actionable(f) || f.action === 'helpless') return i;
    const dir = (Math.sign(d) || 1) as 1 | -1;
    if (!jumped && t >= p.jumpAt && f.jumpsUsed < k.stats.jumps) {
      jumped = true;
      i.buttons = Btn.Jump;
      return i;
    }
    const low = L ? f.pos.y < L.y - p.below : false;
    const near = !L || L.side * (hangX(L, k.stats.width) - f.pos.x) <= p.reach + 1;
    const due = t >= p.specialAt || (p.specialAt === Infinity && low && f.vel.y <= 0.5);
    if (!special && p.special && due && near) {
      special = true;
      if (p.special === 'upB') return press({ x: 40 * dir, y: STICK.special, buttons: Btn.Special });
      if (p.special === 'sideB') return press({ x: STICK.special * dir, buttons: Btn.Special });
      return press({ buttons: Btn.Special });
    }
    if (!dodged && t >= p.dodgeAt && !f.airDodgeUsed) {
      dodged = true;
      const ly = L ? L.y - f.pos.y : 0;
      const n = Math.hypot(d, ly) || 1;
      return press({ x: Math.round((d / n) * 100), y: Math.round((ly / n) * 100), buttons: Btn.Shield });
    }
    return i;
  };
}

function candidates(info: StageInfo, k: FighterKnowledge, f: Readonly<FighterState>): RecoveryParams[] {
  const specials = (k.hints.recovery ?? ['upB', 'sideB']).filter((s) => k.air[s]);
  const out: RecoveryParams[] = [];
  const none = {
    jumpAt: Infinity,
    special: null,
    specialAt: Infinity,
    below: 0,
    reach: Infinity,
    dodgeAt: Infinity,
  };
  out.push(none);
  const canJump = f.jumpsUsed < k.stats.jumps;
  const jumps = canJump ? [1, 8, 16, 26, 38, 52] : [Infinity];
  const L = targetLedge(info, f.pos.x);
  const under = L !== null && L.side * (L.x - f.pos.x) > 0 && f.pos.y < L.y;
  for (const jumpAt of jumps) {
    if (jumpAt !== Infinity) out.push({ ...none, jumpAt });
    for (const special of specials) {
      for (const below of [-24, -12, -4, 4, 12, 20, 30]) out.push({ ...none, jumpAt, special, below });
      if (under)
        for (const reach of [-8, 0, 12, 24, 36]) out.push({ ...none, jumpAt, special, below: -24, reach });
      if (jumpAt === Infinity) for (const at of [1, 10]) out.push({ ...none, special, specialAt: at });
    }
  }
  if (!f.airDodgeUsed)
    for (const dodgeAt of [1, 12]) out.push({ ...none, jumpAt: canJump ? 1 : Infinity, dodgeAt });
  return out;
}

const LIMIT = 260;

function simulate(
  state: Readonly<MatchState>,
  f: Readonly<FighterState>,
  control: Readonly<ControlState>,
  info: StageInfo,
  k: FighterKnowledge,
  params: RecoveryParams,
): { path: Sample[]; outcome: RecoveryPlan['outcome']; miss: number } {
  const m = soloMatch(state, f, control);
  const path = run(m, LIMIT, recoveryDriver(info, k, params), (g) => {
    if (g.action === 'ledgeCatch') return true;
    if (g.ground !== null) return true;
    return g.pos.y < info.blast.bottom + 10;
  });
  const end = path.at(-1);
  let outcome: RecoveryPlan['outcome'] = 'fail';
  if (end?.action === 'ledgeCatch') outcome = 'ledge';
  else if (end?.grounded && floorBelow(info, end.x, end.y + 0.1) !== null) outcome = 'land';
  const L = targetLedge(info, f.pos.x);
  const miss = L ? Math.min(...path.map((s) => Math.hypot(s.x - L.x, s.y - L.y))) : 0;
  return { path, outcome, miss };
}

/** Plan a recovery from the CPU's current state. */
export function planRecovery(
  state: Readonly<MatchState>,
  f: Readonly<FighterState>,
  control: Readonly<ControlState>,
  info: StageInfo,
  k: FighterKnowledge,
  lv: CpuLevel,
  rng: { rng: number },
): RecoveryPlan {
  const tried = candidates(info, k, f).map((params) => ({
    params,
    ...simulate(state, f, control, info, k, params),
  }));
  const pick = (list: typeof tried) => list[Math.floor(nextRandom(rng) * list.length)]!;
  let chosen: (typeof tried)[number];
  const ok = tried.filter((c) => c.outcome !== 'fail');
  if (ok.length && nextRandom(rng) >= lv.recoveryError) {
    const cost = (c: (typeof tried)[number]) =>
      c.path.length + (c.params.special ? 12 : 0) + (c.params.dodgeAt !== Infinity ? 20 : 0);
    const best = Math.min(...ok.map(cost));
    const slack = 10 + 40 * lv.ledgeMix;
    chosen = pick(ok.filter((c) => cost(c) <= best + slack));
  } else if (ok.length) {
    chosen = pick(tried);
  } else {
    chosen = tried.reduce((a, b) => (b.miss < a.miss ? b : a));
  }
  return { params: chosen.params, start: state.frame, path: chosen.path, outcome: chosen.outcome };
}

/**
 * DI: try every stick direction (and none) on a private copy of the launch and keep the one that survives with
 * the most room to spare, or, when nothing is in danger, the one that ends farthest from the attacker.
 */
export function chooseDI(
  state: Readonly<MatchState>,
  f: Readonly<FighterState>,
  control: Readonly<ControlState>,
  info: StageInfo,
  attacker: { x: number; y: number } | null,
): InputFrame {
  const sticks: [number, number][] = [[0, 0]];
  for (let a = 0; a < 8; a++)
    sticks.push([
      Math.round(Math.cos((a * Math.PI) / 4) * 100),
      Math.round(Math.sin((a * Math.PI) / 4) * 100),
    ]);
  const b = info.blast;
  let best: InputFrame = neutralInput();
  let bestScore = -Infinity;
  const scores = sticks.map(([x, y]) => {
    const m = soloMatch(state, f, control);
    const hold = press({ x, y });
    const path = run(
      m,
      200,
      (_t, g) => (g.launch || g.hitlag > 0 ? hold : neutralInput()),
      (g, t) => t > 2 && !g.launch && g.hitlag === 0 && g.hitstun <= 0,
    );
    const end = path.at(-1)!;
    const ko = end.action === 'ko' || end.action === 'out';
    const room = Math.min(
      ...path.map((s) => Math.min(s.x - b.left, b.right - s.x, (b.top - s.y) * 1.2, s.y - b.bottom)),
    );
    const away = attacker ? Math.hypot(end.x - attacker.x, end.y - attacker.y) : 0;
    return { x, y, ko, room, away };
  });
  const danger = scores.some((s) => s.ko || s.room < 45);
  for (const s of scores) {
    const score = s.ko ? -1e6 + s.room : danger ? s.room : s.away + s.room * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = press({ x: s.x, y: s.y });
    }
  }
  return best;
}
