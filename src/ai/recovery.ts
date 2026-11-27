import { nextRandom } from '../engine/rng';
import { Btn, neutralInput, type InputFrame } from '../input/types';
import type { ControlState } from '../sim/control';
import type { FighterState } from '../sim/fighter';
import type { MatchState } from '../sim/match';
import { ledgePresent } from '../sim/stage';
import { actionable, type FighterKnowledge } from './knowledge';
import { STICK, press } from './inputs';
import type { CpuLevel } from './levels';
import { run, soloMatch, type Driver, type Sample } from './look';
import { floorBelow, type StageInfo } from './stage';
import * as SimMath from '../sim/math';

/**
 * Getting back to the stage. The CPU tries a set of recovery plans (drift, double jump at different times, up or
 * side special at different heights, an air dodge) in a private copy of the simulation and picks one that ends on
 * the ledge or the stage. From under the stage, plans can also hold the special until the fighter has drifted
 * out near the ledge, as Ultimate's CPUs do, instead of rising into the underside. Low levels sometimes pick a plan
 * at random, which is how they self-destruct. A CPU standing on an entity's platform with no stage under it (a Duck
 * Raft off the side) plans from there too: every plan starts with a full hop off it, its double jump still to come.
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
  /**
   * The special may come before the double jump, as soon as it is due. The CPU's own plans keep their order; this is
   * how it pictures an opponent recovering (assumedInput in cpu.ts): one already low under the ledge uses its special
   * at once, and one higher double jumps first.
   */
  specialFirst?: true;
  /**
   * Hold the stick straight up while the special plays, until the fighter can act or falls helpless, instead of
   * steering toward the ledge. Fluffy's Quick Grapple, which the stick bends up to 30 degrees, then flies straight up
   * past the ledge from under the stage. Steering, it passes the ledge only when fired in windows of about 3 frames,
   * which the planner's timings missed.
   */
  holdUp?: true;
  /** Recover to this floor corner beside a gap (gapTarget) instead of the nearest ledge, landing on the floor. */
  gap?: Gap;
}

/**
 * A floor's end beside a gap in the ground with nothing under it, where there is no ledge (Run Tunnel's floor has two
 * such gaps, 16 units wide). Nothing catches it, but a fighter that rises beside it can land on the floor. `column`
 * is where to rise: the middle of the gap when the floor across it is near, else where the fighter would hang if it
 * were a ledge.
 */
export interface Gap {
  x: number;
  y: number;
  side: -1 | 1;
  column: number;
}

export interface RecoveryPlan {
  params: RecoveryParams;
  start: number;
  path: Sample[];
  outcome: 'ledge' | 'land' | 'fail';
}

type Ledge = { x: number; y: number; side: -1 | 1 };

/** The ledge to recover to: the nearest one horizontally that is there this frame. */
export function targetLedge(info: StageInfo, x: number): Ledge | null {
  let best: Ledge | null = null;
  info.c.geo.ledges.forEach((l, i) => {
    if (!ledgePresent(info.c, i)) return;
    if (!best || Math.abs(l.x - x) < Math.abs(best.x - x)) best = l;
  });
  return best;
}

/**
 * The floor corner beside a gap (Gap) nearest x horizontally, for a fighter `width` wide, or null when the stage has
 * none. Only ground that stays there counts (StageInfo.steady), and a corner with a ledge is the ledge's.
 */
export function gapTarget(info: StageInfo, x: number, width: number): Gap | null {
  const ends: Omit<Gap, 'column'>[] = [];
  for (const e of info.c.edges) {
    if (e.kind !== 'floor' || !info.steady.solids[e.solid]) continue;
    const [lo, hi] = e.a.x < e.b.x ? [e.a, e.b] : [e.b, e.a];
    for (const [p, side] of [
      [lo, -1],
      [hi, 1],
    ] as const) {
      if (info.c.geo.ledges.some((l) => Math.abs(l.x - p.x) < 0.5 && Math.abs(l.y - p.y) < 0.5)) continue;
      // The floor goes on (another edge of the top), or there is ground under the drop: not a gap.
      if (floorBelow(info, p.x + side * 2, p.y + 0.1, true, true) !== null) continue;
      ends.push({ x: p.x, y: p.y, side });
    }
  }
  let best: Omit<Gap, 'column'> | null = null;
  for (const g of ends) if (!best || Math.abs(g.x - x) < Math.abs(best.x - x)) best = g;
  if (!best) return null;
  const g = best;
  let across: number | null = null;
  for (const o of ends)
    if (o.side === -g.side && g.side * (o.x - g.x) > 0 && Math.abs(o.y - g.y) < 2)
      if (across === null || Math.abs(o.x - g.x) < Math.abs(across - g.x)) across = o.x;
  const narrow = across !== null && Math.abs(across - g.x) < width + 8;
  return { ...g, column: narrow ? (g.x + across!) / 2 : g.x + g.side * (width / 2 + 0.5) };
}

/** Where a fighter `width` wide hangs from ledge L (the sim's hangPos), or rises past gap corner L. */
function hangX(L: Ledge | Gap, width: number): number {
  return 'column' in L ? L.column : L.x + L.side * (width / 2 + 0.5);
}

/**
 * Where to steer: onto the stage once level with the ledge, else to where the fighter would hang from it, or `out`
 * units past that.
 */
function steerX(
  info: StageInfo,
  L: Ledge | Gap | null,
  f: Readonly<FighterState>,
  width: number,
  out = 0,
): number {
  if (!L) return info.centerX;
  if (f.pos.y >= L.y - 1) return L.x - L.side * 12;
  return hangX(L, width) + L.side * out;
}

export function recoveryDriver(info: StageInfo, k: FighterKnowledge, p: RecoveryParams): Driver {
  let jumped = false;
  let special = false;
  let dodged = false;
  let holding = false;
  return (t, f) => {
    const L = p.gap ?? targetLedge(info, f.pos.x);
    const out = p.special && !special && p.reach < 0 ? -p.reach : 0;
    const d = steerX(info, L, f, k.stats.width) - f.pos.x;
    const ds = out ? steerX(info, L, f, k.stats.width, out) - f.pos.x : d;
    const sx = Math.abs(ds) < 2 ? Math.round(ds * 30) : Math.sign(ds) * STICK.full;
    const i = neutralInput();
    i.x = Math.max(-100, Math.min(100, sx));
    // A fuel hover (an up special with `action: 'hover'`) thrusts only while Special stays held, so keep holding
    // it until a fall from here would land on the stage; letting go then drops onto it.
    if (f.action === 'hover' && floorBelow(info, f.pos.x, f.pos.y) === null) {
      i.buttons = Btn.Special;
      return i;
    }
    // Standing on an entity's platform off the stage (a Duck Raft): jump from it toward the stage, holding Jump through
    // the jump squat for a full hop, and let go once in the air, so that a double jump is a new press.
    const held = holding;
    holding = f.ground?.kind === 'entity' && floorBelow(info, f.pos.x, f.pos.y) === null;
    if (holding) {
      i.buttons = Btn.Jump;
      return i;
    }
    if (p.holdUp && special && f.ground === null && !actionable(f) && f.action !== 'helpless') {
      i.x = 0;
      i.y = STICK.special;
      return i;
    }
    if (f.ground !== null || !actionable(f) || f.action === 'helpless') return i;
    const dir = (Math.sign(d) || 1) as 1 | -1;
    if (!jumped && !held && t >= p.jumpAt && f.jumpsUsed < k.stats.jumps) {
      jumped = true;
      i.buttons = Btn.Jump;
      return i;
    }
    const low = L ? f.pos.y < L.y - p.below : false;
    const near = !L || L.side * (hangX(L, k.stats.width) - f.pos.x) <= p.reach + 1;
    const due = t >= p.specialAt || (p.specialAt === Infinity && low && f.vel.y <= 0.5);
    // A plan with a double jump uses its special after it, never before: a fighter that starts low enough would
    // otherwise use it on the first frame and keep the jump for nothing (Wheely 35 units beside Battlefield's ledge and
    // 50 under it Ramp Jumps into the stage's side, where a double jump first gets him back).
    const jumpDone = p.specialFirst || jumped || p.jumpAt === Infinity || f.jumpsUsed >= k.stats.jumps;
    if (!special && p.special && due && near && jumpDone) {
      special = true;
      if (p.special === 'upB') return press({ x: 40 * dir, y: STICK.special, buttons: Btn.Special });
      if (p.special === 'sideB') return press({ x: STICK.special * dir, buttons: Btn.Special });
      return press({ buttons: Btn.Special });
    }
    if (!dodged && t >= p.dodgeAt && !f.airDodgeUsed) {
      dodged = true;
      const ly = L ? L.y - f.pos.y : 0;
      const n = SimMath.hypot(d, ly) || 1;
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
  // With a jump left, plans also try the special without it (Infinity): from under the stage Fluffy's Point Grapple
  // used at once reaches the ledge, where a double jump first takes him too high and too far out.
  const jumps = canJump ? [Infinity, 1, 8, 16, 26, 38, 52] : [Infinity];
  const L = targetLedge(info, f.pos.x);
  const lowSide = L !== null && f.pos.y < L.y;
  const under = lowSide && L.side * (L.x - f.pos.x) > 0;
  for (const jumpAt of jumps) {
    if (jumpAt !== Infinity) out.push({ ...none, jumpAt });
    for (const special of specials) {
      for (const below of [-24, -12, -4, 4, 12, 20, 30]) out.push({ ...none, jumpAt, special, below });
      // From under the stage an up special used at once rises into the underside, so also try drifting out first, with
      // the stick steering or held straight up while the special plays. Just beside the stage, below the ledge,
      // drifting further out first gives Ramp Jump room to come back up over it (Wheely 12 units out and 50 under).
      if (special === 'upB' && lowSide)
        for (const reach of under ? [-8, 0, 12, 24, 36] : [-16, -8]) {
          out.push({ ...none, jumpAt, special, below: -24, reach });
          out.push({ ...none, jumpAt, special, below: -24, reach, holdUp: true });
        }
      if (jumpAt === Infinity) for (const at of [1, 10]) out.push({ ...none, special, specialAt: at });
    }
  }
  // In a gap in the ground (Run Tunnel's floor), the nearest ledge can be past the floor on either side, with the
  // floor's underside in the way. When a corner beside the gap is nearer than any ledge, also try rising in the gap and
  // landing on the floor beside it.
  const gap = gapTarget(info, f.pos.x, k.stats.width);
  if (gap && (!L || Math.abs(gap.x - f.pos.x) < Math.abs(L.x - f.pos.x)))
    for (const jumpAt of jumps) {
      out.push({ ...none, jumpAt, gap });
      for (const special of specials) {
        // Held straight up, Fluffy's Quick Grapple out of a gap latches onto the platform over it and reels him up.
        for (const holdUp of special === 'upB' ? [false, true] : [false]) {
          const hold = holdUp ? { holdUp: true as const } : {};
          for (const below of [-24, -12, -4, 4, 12, 20, 30])
            out.push({ ...none, jumpAt, special, below, gap, ...hold });
          if (jumpAt === Infinity)
            for (const at of [1, 10]) out.push({ ...none, special, specialAt: at, gap, ...hold });
        }
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
  // Whoever holds a ledge comes too, standing still: a tether doesn't latch onto a held ledge (tether.ts), so Fluffy's
  // Quick Grapple under one fails there as in the match, and a plain grab trumps them as in the match.
  const holders = state.fighters.filter(
    (o) => o.port !== f.port && o.ledge >= 0 && (o.action === 'ledgeCatch' || o.action === 'ledgeHang'),
  );
  const m = soloMatch(state, f, control, holders);
  // A plan from an entity's platform starts on the ground, and ends when the fighter comes down after leaving it.
  let left = f.ground === null;
  const path = run(m, LIMIT, recoveryDriver(info, k, params), (g) => {
    left ||= g.ground === null;
    if (g.action === 'ledgeCatch') return true;
    if (g.ground !== null) return left;
    // The bottom blast line itself, where the sim KOs (blastZones.ts): Fluffy's Quick Grapple from 90 under the
    // stage's middle fires 9 units above it and still reels him to the ledge.
    return g.pos.y <= info.blast.bottom;
  });
  const end = path.at(-1);
  let outcome: RecoveryPlan['outcome'] = 'fail';
  if (end?.action === 'ledgeCatch') outcome = 'ledge';
  else if (end?.grounded && floorBelow(info, end.x, end.y + 0.1) !== null) outcome = 'land';
  const L = params.gap ?? targetLedge(info, f.pos.x);
  const miss = L ? Math.min(...path.map((s) => SimMath.hypot(s.x - L.x, s.y - L.y))) : 0;
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
      Math.round(SimMath.cos((a * Math.PI) / 4) * 100),
      Math.round(SimMath.sin((a * Math.PI) / 4) * 100),
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
    const away = attacker ? SimMath.hypot(end.x - attacker.x, end.y - attacker.y) : 0;
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
