import { getFighter } from '../fighters/registry';
import { nextRandom } from '../engine/rng';
import type { HitboxDef, ThrowHitDef } from '../fighters/types';
import { Btn, neutralInput, type InputFrame } from '../input/types';
import { hurtbox } from '../sim/combat/hits';
import { knockback, shieldstunFrames } from '../sim/combat/formulas';
import { GRAB, SHIELD_DROP_FRAMES } from '../sim/constants';
import type { FighterState } from '../sim/fighter';
import { stepMatch, type MatchState } from '../sim/match';
import { STICK, TURNING_MOVES, press } from './inputs';
import { actionable, knowledge, type FighterKnowledge } from './knowledge';
import { cpuLevel, type CpuLevel } from './levels';
import { overlaps, run, soloMatch, type Driver, type Sample } from './look';
import { findAttacks, type Attack, type Self, type Target } from './options';
import {
  airAerial,
  airDodge,
  canFastFall,
  crouch,
  drift,
  dropJump,
  dropThrough,
  fullHop,
  goTo,
  groundMove,
  jumpAerial,
  ledgeJump,
  roll,
  shield,
  shortHop,
  spotDodge,
  steer,
  wait,
  type Program,
} from './programs';
import { chooseDI, planRecovery, recoveryDriver, targetLedge, type RecoveryPlan } from './recovery';
import {
  clampToStage,
  floorBelow,
  landingX,
  landsSafe,
  safeSpot,
  stageInfo,
  standSafe,
  type StageInfo,
} from './stage';

/**
 * One CPU player. Every frame it reads the match (its own fighter as it is, opponents as they were `reaction`
 * frames ago), decides, and returns the controller input a person would press. It never writes to the match.
 *
 * Decisions come in layers: being launched (DI), on the ledge (getup mix), off stage (planned recovery), then
 * neutral, which every `thinkEvery` frames looks for an attack that connects with the predicted opponent, a threat
 * to block or dodge, a punish out of shield, an edgeguard, or somewhere to move. Multi-frame inputs (a short-hop
 * aerial, a shield held through an attack) run as programs.
 */

const HISTORY = 64;
const HORIZON = 45;
const NEUTRAL = Object.freeze(neutralInput());

type Situation = 'combo' | 'punish' | 'neutral';

export class Cpu {
  readonly lv: CpuLevel;
  private readonly rng: { rng: number };
  private history: FighterState[][] = [];
  private prog: (Program & { t: number }) | null = null;
  private last: InputFrame = neutralInput();
  private nextThink = 0;
  private recovery: RecoveryPlan | null = null;
  private recoveryDrive: Driver | null = null;
  private ledgePlan: { option: LedgeOption; at: number } | null = null;
  private techPlan: { tech: boolean; dir: number; pressed: boolean } | null = null;
  private getupPlan: { option: GetupOption; at: number; dir: number } | null = null;
  private grabPlan: {
    at: number;
    pummels: number;
    stick: InputFrame;
    /** The held fighter's hold timer when last seen, and how fast it has been dropping lately (per frame). */
    seenAt: number;
    seenTimer: number;
    seenFrozen: boolean;
    drain: number;
  } | null = null;
  private mashDir = 1;
  private respawnAt = -1;
  private diStick: InputFrame | null = null;
  private rolls = new Map<string, boolean>();
  private fastFallAir = -1;
  private wantFastFall = false;

  constructor(
    readonly port: number,
    level: number,
    seed: number,
  ) {
    this.lv = cpuLevel(level);
    this.rng = { rng: (seed ^ Math.imul(port + 1, 0x9e3779b1)) | 0 };
  }

  input(state: Readonly<MatchState>): InputFrame {
    this.remember(state);
    const me = state.fighters[this.port];
    const out = me ? this.act(state, me) : neutralInput();
    const q = (v: number) => Math.max(-100, Math.min(100, Math.round(v))) || 0;
    this.last = { x: q(out.x), y: q(out.y), cx: q(out.cx), cy: q(out.cy), buttons: out.buttons };
    return { ...this.last };
  }

  private rand(): number {
    return nextRandom(this.rng);
  }

  /** Roll once per key: the same question gets the same answer until the key changes. */
  private roll(key: string, chance: number): boolean {
    let r = this.rolls.get(key);
    if (r === undefined) {
      r = this.rand() < chance;
      if (this.rolls.size > 64) this.rolls.clear();
      this.rolls.set(key, r);
    }
    return r;
  }

  private remember(state: Readonly<MatchState>): void {
    this.history.push(state.fighters.map(snapshot));
    if (this.history.length > HISTORY) this.history.shift();
  }

  /** An opponent as the CPU perceives it: `lag` frames old. */
  private seen(port: number, lag: number): FighterState {
    const h = this.history[Math.max(0, this.history.length - 1 - lag)]!;
    return h[port]!;
  }

  private act(state: Readonly<MatchState>, me: Readonly<FighterState>): InputFrame {
    const a = me.action;
    if (a !== 'respawn') this.respawnAt = -1;
    if (!me.launch) this.diStick = null;
    if (!a.startsWith('ledge')) this.ledgePlan = null;
    if (a !== 'tumble' || me.launch) this.techPlan = null;
    if (a !== 'down') this.getupPlan = null;
    if (a !== 'grabHold' && a !== 'grabPummel') this.grabPlan = null;
    if (a === 'ko' || a === 'out') {
      this.prog = null;
      this.recovery = null;
      return NEUTRAL;
    }
    if (a === 'respawn') return this.onRespawn(state, me);
    if (me.launch) return this.onLaunch(state, me);
    if (a === 'tumble') {
      const i = this.onTumble(state, me);
      if (i) return i;
    }
    if (a === 'down') return this.onDown(state, me);
    if (a === 'grabbed') return this.mash(state);
    if (a === 'grabHold') return this.onGrabHold(state, me);
    if (a === 'hitstun' || (a === 'tumble' && me.hitstun > 0) || BUSY.has(a)) {
      this.prog = null;
      this.recovery = null;
      return NEUTRAL;
    }
    if (a === 'ledgeCatch' || a === 'ledgeHang') {
      this.prog = null;
      this.recovery = null;
      return this.onLedge(state, me);
    }
    const info = stageInfo(state);
    const offstage =
      me.ground === null && floorBelow(info, me.pos.x, me.pos.y) === null && !a.startsWith('ledge');
    if (this.prog && !this.prog.interruptible && (!offstage || this.prog.offstage)) {
      const i = this.runProgram(me, info);
      if (i) return i;
    }
    if (offstage) {
      this.prog = null;
      return this.recover(state, me, info);
    }
    this.recovery = null;
    if (state.frame >= this.nextThink || !this.prog) {
      if (this.free(me)) {
        this.think(state, me, info);
        this.nextThink = state.frame + this.lv.thinkEvery;
      }
    }
    const i = this.runProgram(me, info);
    if (i) return i;
    return me.ground === null ? this.airIdle(me, info) : NEUTRAL;
  }

  /** Able to start something: actionable, or holding a shield. */
  private free(me: Readonly<FighterState>): boolean {
    return actionable(me) || me.action === 'shield' || me.action === 'shieldStun';
  }

  private runProgram(me: Readonly<FighterState>, info: StageInfo): InputFrame | null {
    const p = this.prog;
    if (!p) return null;
    const i = p.step(p.t, me, info);
    if (!i) {
      this.prog = null;
      return null;
    }
    if (p.t === 0 && !p.holds) {
      const reused = (i.buttons & this.last.buttons) !== 0;
      const cAgain = (i.cx !== 0 || i.cy !== 0) && (this.last.cx !== 0 || this.last.cy !== 0);
      if (reused || cAgain) return { ...i, buttons: i.buttons & ~this.last.buttons, cx: 0, cy: 0 };
    }
    p.t++;
    return i;
  }

  private start(p: Program): void {
    this.prog = { ...p, t: 0 };
  }

  // ---------------------------------------------------------------- getting hit, respawning, the ledge

  private onLaunch(state: Readonly<MatchState>, me: Readonly<FighterState>): InputFrame {
    this.prog = null;
    this.recovery = null;
    if (this.diStick) return this.diStick;
    const control = state.players[this.port]!.control;
    const attacker = nearestOpponent(state, me);
    const r = this.rand();
    if (r < this.lv.di) {
      this.diStick = chooseDI(state, me, control, stageInfo(state), attacker && attacker.pos);
    } else if (r < this.lv.di + (1 - this.lv.di) * 0.5) {
      const a = this.rand() * Math.PI * 2;
      this.diStick = press({ x: Math.round(Math.cos(a) * 100), y: Math.round(Math.sin(a) * 100) });
    } else {
      this.diStick = neutralInput();
    }
    return this.diStick;
  }

  /**
   * Tumbling into the floor: decide once whether to tech, then press Shield a few frames before touching down (a
   * look-ahead says when) and hold the stick for a tech roll or let go for a tech in place.
   */
  private onTumble(state: Readonly<MatchState>, me: Readonly<FighterState>): InputFrame | null {
    this.techPlan ??= { tech: this.rand() < this.lv.tech, dir: 0, pressed: false };
    const plan = this.techPlan;
    if (!plan.tech) return null;
    if (plan.pressed) return press({ x: plan.dir * 100 });
    const m = soloMatch(state, me, state.players[this.port]!.control);
    const path = run(m, TECH_LEAD + 1, undefined, (g) => g.action !== 'tumble');
    if (path.at(-1)?.action !== 'downBound') return null;
    plan.pressed = true;
    plan.dir = this.getupDirection(state, me, [0, 1, -1]);
    return press({ buttons: Btn.Shield });
  }

  /** Lying on the floor after a missed tech: wait a level-dependent moment, then stand, roll or attack. */
  private onDown(state: Readonly<MatchState>, me: Readonly<FighterState>): InputFrame {
    this.prog = null;
    if (!this.getupPlan) {
      const [lo, hi] = this.lv.ledgeWait;
      const at = lo + Math.floor(this.rand() * (hi - lo + 1));
      const opp = nearestOpponent(state, me);
      const near = opp !== null && Math.abs(opp.pos.x - me.pos.x) < 30;
      let option: GetupOption = 'stand';
      if (this.rand() < this.lv.ledgeMix) {
        const r = this.rand();
        option = r < (near ? 0.2 : 0.5) ? 'stand' : r < (near ? 0.7 : 0.8) ? 'roll' : 'attack';
      }
      const info = stageInfo(state);
      if (!info.calm && !standSafe(info, me.fighter, me.pos.x, me.pos.y)) option = 'roll';
      const dir = option === 'roll' ? this.getupDirection(state, me, [1, -1]) : 0;
      this.getupPlan = { option: dir === 0 && option === 'roll' ? 'stand' : option, at, dir };
    }
    const { option, at, dir } = this.getupPlan;
    if (me.actionFrame < at) return NEUTRAL;
    if (option === 'roll') return press({ x: 100 * dir });
    if (option === 'attack') return press({ buttons: Btn.Attack });
    return press({ y: STICK.full });
  }

  /** Held in a grab: mash at the level's rate, a new stick direction each time and a button every other time. */
  private mash(state: Readonly<MatchState>): InputFrame {
    this.prog = null;
    if (this.lv.mash <= 0) return NEUTRAL;
    const every = Math.max(1, Math.round(60 / this.lv.mash));
    if (state.frame % every !== 0) return press({ x: 100 * this.mashDir });
    this.mashDir = -this.mashDir;
    const button = (state.frame / every) % 2 < 1 ? Btn.Attack : 0;
    return press({ x: 100 * this.mashDir, buttons: button });
  }

  /**
   * Holding someone: after a reaction-length pause, pummel up to the level's count, but only while the hold would
   * outlast another pummel at the rate the opponent has been mashing lately (plus one more direction and button), then throw:
   * one that KOs if any does (checked by simulating each throw's launch), else toward the nearer blast zone. A started
   * throw can't be escaped.
   */
  private onGrabHold(state: Readonly<MatchState>, me: Readonly<FighterState>): InputFrame {
    this.prog = null;
    const held = state.fighters[me.grabPartner];
    if (!held) return NEUTRAL;
    if (!this.grabPlan) {
      const pummels = Math.floor(this.rand() * (this.lv.pummels + 1));
      const at = state.frame + Math.round(this.lv.reaction / 2);
      const stick = this.pickThrow(state, me, held);
      this.grabPlan = {
        at,
        pummels,
        stick,
        seenAt: state.frame,
        seenTimer: held.grabTimer,
        seenFrozen: true,
        drain: 1,
      };
    }
    const plan = this.grabPlan;
    if (state.frame > plan.seenAt) {
      if (state.frame === plan.seenAt + 1 && !plan.seenFrozen) {
        plan.drain = plan.drain * 0.7 + (plan.seenTimer - held.grabTimer) * 0.3;
      }
      Object.assign(plan, { seenAt: state.frame, seenTimer: held.grabTimer, seenFrozen: held.hitlag > 0 });
    }
    if (state.frame < plan.at) return NEUTRAL;
    const pummel = (getFighter(me.fighter).moves?.pummel?.faf ?? 6) + PUMMEL_HITLAG;
    const margin = pummel * Math.max(1, plan.drain) * 1.5 + GRAB.mashStick + GRAB.mashButton;
    if (plan.pummels > 0 && held.grabTimer > margin) {
      if (this.last.buttons & Btn.Attack) return NEUTRAL;
      plan.pummels--;
      return press({ buttons: Btn.Attack });
    }
    return { ...plan.stick, x: plan.stick.x * me.facing };
  }

  private pickThrow(
    state: Readonly<MatchState>,
    me: Readonly<FighterState>,
    held: Readonly<FighterState>,
  ): InputFrame {
    const moves = getFighter(me.fighter).moves ?? {};
    const options = THROWS.filter(([name]) => moves[name]?.throw);
    if (!options.length) return press({ x: 100 });
    if (this.rand() >= this.lv.precision) return options[Math.floor(this.rand() * options.length)]![1];
    const at = { x: held.pos.x, y: held.pos.y, grounded: true };
    const info = stageInfo(state);
    const outward = Math.sign(held.pos.x - info.centerX) || me.facing;
    let best = options[0]!;
    let bestScore = -Infinity;
    for (const option of options) {
      const hit = moves[option[0]]!.throw!.hit;
      const dir = (hit.direction === 'back' ? -me.facing : me.facing) as 1 | -1;
      let score = hit.damage + (option[1].x !== 0 && dir === outward ? 4 : 0);
      if (launchKills(state, held, at, hit, dir)) score += 100;
      if (score > bestScore) [best, bestScore] = [option, score];
    }
    return best[1];
  }

  /**
   * A random roll direction (0 for in place) among the options that keeps a roll's length on the stage and, on a
   * stage with hazards, ends somewhere the CPU can stand.
   */
  private getupDirection(state: Readonly<MatchState>, me: Readonly<FighterState>, options: number[]): number {
    const info = stageInfo(state);
    const reach = getFighter(me.fighter).stats.rollDistance;
    const safe = options.filter((d) => {
      const x = me.pos.x + d * reach;
      if (d !== 0 && clampToStage(info, x, 4) !== x) return false;
      return info.calm || standSafe(info, me.fighter, x, me.pos.y);
    });
    return safe.length ? safe[Math.floor(this.rand() * safe.length)]! : 0;
  }

  private onRespawn(state: Readonly<MatchState>, me: Readonly<FighterState>): InputFrame {
    if (this.respawnAt < 0) {
      const [lo, hi] = [22, 30 + Math.round((1 - this.lv.aggression) * 90)];
      this.respawnAt = lo + Math.floor(this.rand() * (hi - lo));
    }
    if (me.actionFrame < this.respawnAt) return NEUTRAL;
    const info = stageInfo(state);
    const x = landingX(info, me, info.centerX);
    return press({ x: Math.sign(x - me.pos.x) * 40 || 40 });
  }

  private onLedge(state: Readonly<MatchState>, me: Readonly<FighterState>): InputFrame {
    if (!this.ledgePlan) this.ledgePlan = this.pickLedgeOption(state, me);
    const { option, at } = this.ledgePlan;
    if (me.action !== 'ledgeHang' || me.actionFrame < at) return NEUTRAL;
    const toward = me.facing;
    switch (option) {
      case 'climb':
        return press({ x: STICK.tilt * toward });
      case 'jump':
        this.start(ledgeJump(toward));
        return press({ buttons: Btn.Jump });
      case 'roll':
        return press({ buttons: Btn.Shield });
      case 'attack':
        return press({ buttons: Btn.Attack });
      case 'drop':
        this.start(dropJump(toward));
        return press({ x: -STICK.tilt * toward });
    }
  }

  private pickLedgeOption(
    state: Readonly<MatchState>,
    me: Readonly<FighterState>,
  ): { option: LedgeOption; at: number } {
    const [lo, hi] = this.lv.ledgeWait;
    const at = lo + Math.floor(this.rand() * (hi - lo + 1));
    if (this.rand() >= this.lv.ledgeMix) return { option: 'climb', at };
    const opp = nearestOpponent(state, me);
    const near = opp !== null && Math.abs(opp.pos.x - me.pos.x) < 30 && opp.ground !== null;
    const weights: [LedgeOption, number][] = near
      ? [
          ['climb', 0.12],
          ['jump', 0.25],
          ['roll', 0.3],
          ['attack', 0.18],
          ['drop', 0.15],
        ]
      : [
          ['climb', 0.45],
          ['jump', 0.2],
          ['roll', 0.12],
          ['attack', 0.13],
          ['drop', 0.1],
        ];
    let r = this.rand();
    for (const [option, w] of weights) {
      if ((r -= w) < 0) return { option, at };
    }
    return { option: 'climb', at };
  }

  // ---------------------------------------------------------------- recovery

  private recover(state: Readonly<MatchState>, me: Readonly<FighterState>, info: StageInfo): InputFrame {
    const k = this.knowledge(state, me);
    const plan = this.recovery;
    const t = plan ? state.frame - plan.start : 0;
    const expected = plan?.path[t - 1];
    const drifted = expected !== undefined && Math.hypot(expected.x - me.pos.x, expected.y - me.pos.y) > 2;
    if (!plan || !this.recoveryDrive || drifted || t >= plan.path.length) {
      if (me.action !== 'helpless' && !actionable(me) && plan) return this.recoveryDrive!(t, me);
      const control = state.players[this.port]!.control;
      this.recovery = planRecovery(state, me, control, info, k, this.lv, this.rng);
      this.recoveryDrive = recoveryDriver(info, k, this.recovery.params);
      return this.recoveryDrive(0, me);
    }
    return this.recoveryDrive(t, me);
  }

  // ---------------------------------------------------------------- neutral

  private knowledge(state: Readonly<MatchState>, f: Readonly<FighterState>): FighterKnowledge {
    return knowledge(f.fighter, state.config.stage);
  }

  /** The opponent's next frames as the CPU expects them, t = 0 being the frame about to be simulated. */
  private foresee(
    state: Readonly<MatchState>,
    opp: Readonly<FighterState>,
  ): { path: Sample[]; snap: FighterState } {
    const lag = Math.min(this.lv.reaction, this.history.length - 1);
    const snap = this.seen(opp.port, lag);
    const m = soloMatch(state, snap);
    const info = stageInfo(state);
    const samples = run(m, lag + HORIZON + 1, assumedInput(snap, info, state));
    const path = samples.slice(lag);
    while (path.length < HORIZON) path.push(path.at(-1) ?? samplesFallback(snap));
    return { path, snap };
  }

  private think(state: Readonly<MatchState>, me: Readonly<FighterState>, info: StageInfo): void {
    const opp = nearestOpponent(state, me, this.lv.reaction, (p, lag) => this.seen(p, lag));
    if (!opp) {
      if (this.escape(me, info)) return;
      if (actionable(me) && me.ground) this.start(goTo(info.centerX, false, 30, info));
      return;
    }
    const k = this.knowledge(state, me);
    const { path, snap } = this.foresee(state, opp);
    const target: Target = {
      path,
      errX: (this.rand() * 2 - 1) * this.lv.spacingError,
      grabbableIn: snap.grabbableFrom - state.frame,
    };
    const now = path[0]!;
    const dir = (Math.sign(now.x - me.pos.x) || me.facing) as 1 | -1;
    const shielding = me.action === 'shield' || me.action === 'shieldStun';

    const threat = this.threat(me, path);
    if (threat) {
      const key = `threat:${opp.port}:${threat.move}:${state.frame + threat.t - threat.frame}`;
      if (this.roll(key, this.lv.defense) && this.defend(state, me, k, info, target, threat, dir)) return;
    }

    const situation = classify(path);
    if (shielding) {
      this.shieldPunish(state, me, k, info, target, snap, situation);
      return;
    }
    if (this.escape(me, info)) return;

    const self: Self = { f: me, k, info, groundDelay: me.ground ? 0 : Infinity, jumpDelay: 0 };
    const edgeguarding = this.isEdgeguarding(state, me, snap, info);
    const attacks = this.rank(state, findAttacks(self, target), target, snap, k, info, edgeguarding);
    const chance =
      situation === 'combo' ? this.lv.followUp : situation === 'punish' ? this.lv.punish : this.lv.aggression;
    if (attacks.length && this.rand() < chance && this.startAttack(state, attacks, me, info)) return;
    if (Math.abs(now.x - me.pos.x) < 45 && this.rand() < this.lv.whiff * 0.3) {
      const any = Object.keys(k.ground);
      if (any.length && me.ground && actionable(me)) {
        const move = any[Math.floor(this.rand() * any.length)]!;
        this.start(groundMove(move, TURNING_MOVES.has(move) ? dir : me.facing));
        return;
      }
    }
    if (this.rand() < this.lv.aimless) {
      this.start(this.aimless(me, info));
      return;
    }
    this.move(state, me, info, path, snap, dir, situation, edgeguarding);
  }

  /** The first frame an opponent's predicted hitbox would touch the CPU where it is. */
  private threat(
    me: Readonly<FighterState>,
    path: Sample[],
  ): { t: number; until: number; move: string | null; frame: number } | null {
    const h0 = hurtbox(me, getFighter(me.fighter).stats);
    const vx = me.ground ? 0 : me.vel.x + me.kb.x;
    const vy = me.ground ? 0 : me.vel.y + me.kb.y;
    for (let t = 0; t < Math.min(path.length, 36); t++) {
      const s = path[t]!;
      if (!s.boxes.length) continue;
      const k = Math.min(t, 6);
      const h = { x: h0.x + vx * k, y1: h0.y1 + vy * k, y2: h0.y2 + vy * k, r: h0.r };
      if (s.boxes.some((b) => overlaps(b.x, b.y, b.box.radius, h, 1.5))) {
        let until = t;
        while (until + 1 < path.length && path[until + 1]!.boxes.length) until++;
        return { t, until, move: s.move, frame: s.actionFrame };
      }
    }
    return null;
  }

  private defend(
    state: Readonly<MatchState>,
    me: Readonly<FighterState>,
    k: FighterKnowledge,
    info: StageInfo,
    target: Target,
    threat: { t: number; until: number },
    dir: 1 | -1,
  ): boolean {
    const skill = (this.lv.level - 1) / 8;
    const hold = Math.max(3, threat.until + 2);
    if (me.action === 'shield' || me.action === 'shieldStun') {
      this.start(shield(hold));
      return true;
    }
    if (me.ground === null) {
      if (!actionable(me)) return false;
      if (!me.airDodgeUsed && threat.t <= 6) {
        this.start(airDodge());
        return true;
      }
      return false;
    }
    if (!actionable(me)) return false;
    const self: Self = { f: me, k, info, groundDelay: 0, jumpDelay: 0 };
    const counters = findAttacks(self, target).filter((a) => a.kind === 'ground' && a.tHit < threat.t - 1);
    if (counters.length && this.rand() < 0.35 * skill) {
      counters.sort((a, b) => a.tHit - b.tHit);
      this.startAttack(state, [counters[0]!], me, info);
      return true;
    }
    const r = this.rand();
    const roomBehind =
      clampToStage(info, me.pos.x - dir * k.stats.rollDistance, 4) === me.pos.x - dir * k.stats.rollDistance;
    if (threat.t >= 3 && r < 0.2 * skill) {
      this.start(spotDodge());
      return true;
    }
    if (threat.t >= 1 && roomBehind && r < 0.38 * skill) {
      this.start(roll(-dir));
      return true;
    }
    if (threat.t >= 4 && r < 0.48 * skill && this.hopLands(state, me, -100 * dir, 6, (t) => t > 30)) {
      this.start(fullHop('jumpAway', -100 * dir, 6, 30));
      return true;
    }
    this.start(shield(hold));
    return true;
  }

  private shieldPunish(
    state: Readonly<MatchState>,
    me: Readonly<FighterState>,
    k: FighterKnowledge,
    info: StageInfo,
    target: Target,
    snap: FighterState,
    situation: Situation,
  ): void {
    const stun = me.action === 'shieldStun' ? Math.max(0, me.hitstun - me.actionFrame + 1) : 0;
    const self: Self = {
      f: me,
      k,
      info,
      groundDelay: stun + SHIELD_DROP_FRAMES + 1,
      jumpDelay: stun,
      grabDelay: stun + GRAB.shieldGrabLock + 1,
    };
    const freeAt = target.path.findIndex((s) => actionable(s) || (s.grounded && s.action === 'shield'));
    const window = freeAt < 0 ? target.path.length : freeAt;
    const attacks = this.rank(state, findAttacks(self, target), target, snap, k, info, false).filter(
      (a) => a.tHit < window,
    );
    if (attacks.length && situation !== 'neutral' && this.rand() < this.lv.punish) {
      this.startAttack(state, attacks, me, info);
      return;
    }
    if (this.prog?.name === 'shield') return;
    if (me.action === 'shieldStun') this.start(shield(stun + 1));
    else this.prog = null;
  }

  private rank(
    state: Readonly<MatchState>,
    attacks: Attack[],
    target: Target,
    snap: FighterState,
    k: FighterKnowledge,
    info: StageInfo,
    edgeguarding: boolean,
  ): Attack[] {
    const opp = getFighter(snap.fighter).stats;
    const offstageOk = edgeguarding && this.lv.level >= 6;
    const out: Attack[] = [];
    for (const a of attacks) {
      const s = target.path[a.tHit]!;
      const onStage =
        landsSafe(info, k.id, a.endX, a.endY + 1) &&
        (info.calm || a.landX === undefined || landsSafe(info, k.id, a.landX, a.endY + 1));
      if (!onStage && !(offstageOk && this.safeOffstage(a, info, k))) continue;
      if (a.box.grab) {
        const grabbing = (throwDamage(k) + 4) * (k.hints.prefer?.[a.move] ?? 1);
        const vsShield = s.action === 'shield' || s.action === 'shieldStun';
        out.push({ ...a, score: (grabbing * (vsShield ? 2.2 : 1)) / (1 + a.tHit / 30) });
        continue;
      }
      const box = a.box;
      const kb = knockback({
        percent: snap.damage,
        damage: box.damage,
        kbg: box.kbg,
        bkb: box.bkb,
        wbkb: box.wbkb,
        weight: opp.weight,
      });
      let v = box.damage * (k.hints.prefer?.[a.move] ?? 1) * (1 + Math.min(1.5, kb / 110));
      if (s.action === 'shield') {
        const kind = k.def.moves?.[a.move]?.kind ?? 'other';
        const unsafe = a.busy - a.tHit - shieldstunFrames(box.damage, kind) - 5;
        v = box.damage * 0.2 - Math.max(0, unsafe) * 0.6;
      } else if (s.action !== 'hitstun' && s.action !== 'tumble') {
        v -= Math.max(0, a.busy - a.tHit) * 0.06;
      }
      v /= 1 + a.tHit / 30;
      out.push({ ...a, score: v });
    }
    out.sort((a, b) => b.score - a.score);
    for (const a of out.slice(0, 3)) {
      if (this.wouldKill(state, a, target, snap)) a.score += 40;
    }
    out.sort((a, b) => b.score - a.score);
    return out.filter((a) => a.score > 0);
  }

  /** An offstage attack the CPU can come back from: ends near the ledge, not far below it, with a jump left. */
  private safeOffstage(a: Attack, info: StageInfo, k: FighterKnowledge): boolean {
    const L = targetLedge(info, a.endX);
    if (!L || a.kind === 'ground' || a.kind === 'doubleJump' || k.stats.jumps < 2) return false;
    return Math.abs(a.endX - L.x) < 25 && a.endY > L.y - 15;
  }

  private wouldKill(state: Readonly<MatchState>, a: Attack, target: Target, snap: FighterState): boolean {
    const s = target.path[a.tHit]!;
    const dir =
      a.box.direction === 'back'
        ? -a.facing
        : a.box.direction === 'away'
          ? Math.sign(s.x - a.endX) || a.facing
          : a.facing;
    return launchKills(state, snap, s, a.box, dir as 1 | -1);
  }

  /**
   * Start one of the ranked attacks. On a stage with hazards an aerial is first played out on a copy of the match
   * (landsClear), and dropped when it comes down somewhere unsafe; returns whether an attack started.
   */
  private startAttack(
    state: Readonly<MatchState>,
    ranked: Attack[],
    me: Readonly<FighterState>,
    info: StageInfo,
  ): boolean {
    const pick =
      this.rand() < this.lv.precision
        ? ranked[0]!
        : ranked[Math.floor(this.rand() * Math.min(ranked.length, 6))]!;
    const ff =
      this.rand() < this.lv.fastFall && floorBelow(info, pick.endX, pick.endY + 1, true, true) !== null;
    if (pick.kind === 'ground') {
      this.start(groundMove(pick.move, TURNING_MOVES.has(pick.move) ? pick.facing : me.facing));
      return true;
    }
    const make = () => (pick.kind === 'jump' ? jumpAerial(pick, ff, info) : airAerial(pick, ff, info));
    if (!info.calm && !this.landsClear(state, me, make())) return false;
    this.start(make());
    return true;
  }

  /**
   * Run `program` on a copy of the match, then let go until the CPU comes down: whether it lands somewhere it can
   * stand without touching a damage zone on the way.
   */
  private landsClear(state: Readonly<MatchState>, me: Readonly<FighterState>, program: Program): boolean {
    const m = soloMatch(state, me, state.players[this.port]!.control);
    const g = m.fighters[0]!;
    let running = true;
    for (let t = 0; t < 180; t++) {
      const i: InputFrame | null = running ? program.step(t, g, stageInfo(m)) : null;
      running &&= i !== null;
      stepMatch(m, [i ?? NEUTRAL]);
      if (m.events.some((e) => e.type === 'stageHit' && e.source === 'zone')) return false;
      if (g.action === 'ko' || g.action === 'out') return false;
      if (t > 4 && g.ground !== null) return standSafe(stageInfo(m), g.fighter, g.pos.x, g.pos.y);
    }
    return false;
  }

  /**
   * Standing somewhere unsafe (a damage zone that hurts, ground about to vanish, a belt carrying the CPU off into
   * either): walk to the nearest safe ground, or hop toward a safe landing when none is in reach on foot.
   */
  private escape(me: Readonly<FighterState>, info: StageInfo): boolean {
    if (me.ground === null || !actionable(me) || standSafe(info, me.fighter, me.pos.x, me.pos.y))
      return false;
    const spot = safeSpot(info, me.fighter, me.pos.x, me.pos.y);
    if (spot !== null) {
      this.start(goTo(spot, true, 40, info));
      return true;
    }
    const land = landingX(info, me, me.pos.x);
    if (land === me.pos.x) return false;
    this.start(fullHop('escape', Math.sign(land - me.pos.x) * 100, 8, 40));
    return true;
  }

  /**
   * Whether a hop holding `stick` (and Jump for `hold` frames) comes down somewhere the CPU can stand, whether it
   * keeps holding the stick to the ground or lets go when its program ends (`ends`), by running both on copies of
   * the match. Always true on a calm stage, where the stage's ends are the only danger and the callers already keep
   * hops over the stage.
   */
  private hopLands(
    state: Readonly<MatchState>,
    me: Readonly<FighterState>,
    stick: number,
    hold: number,
    ends: (t: number, f: Readonly<FighterState>) => boolean,
  ): boolean {
    if (stageInfo(state).calm) return true;
    return [true, false].every((keep) => {
      const m = soloMatch(state, me, state.players[this.port]!.control);
      let held = true;
      const drive = (t: number, g: Readonly<FighterState>) => {
        held &&= keep || !ends(t, g);
        return press({ x: held ? stick : 0, buttons: t < hold ? Btn.Jump : 0 });
      };
      const end = run(m, 150, drive, (g, t) => t > 4 && g.ground !== null).at(-1);
      return end !== undefined && end.grounded && standSafe(stageInfo(m), me.fighter, end.x, end.y);
    });
  }

  private isEdgeguarding(
    state: Readonly<MatchState>,
    me: Readonly<FighterState>,
    snap: FighterState,
    info: StageInfo,
  ): boolean {
    if (me.ground === null || floorBelow(info, snap.pos.x, snap.pos.y) !== null) return false;
    if (snap.ground !== null || snap.action.startsWith('ledge')) return false;
    return this.roll(`edge:${snap.port}:${Math.floor(state.frame / 90)}`, this.lv.edgeguard);
  }

  private move(
    state: Readonly<MatchState>,
    me: Readonly<FighterState>,
    info: StageInfo,
    path: Sample[],
    snap: FighterState,
    dir: 1 | -1,
    situation: Situation,
    edgeguarding: boolean,
  ): void {
    if (!actionable(me)) return;
    const s = path[Math.min(path.length - 1, 8)]!;
    const margin = 6;
    if (me.ground === null) {
      const x = landingX(info, me, clampToStage(info, s.x - dir * 10, margin));
      this.start(drift(x, this.rand() < this.lv.fastFall, 12, info));
      return;
    }
    const oppOff = floorBelow(info, snap.pos.x, snap.pos.y) === null && !snap.action.startsWith('ledge');
    if (oppOff) {
      const L = targetLedge(info, snap.pos.x);
      if (edgeguarding && L) {
        this.start(goTo(L.x - L.side * (6 + this.rand() * 8), true, 30, info, L.side));
      } else {
        this.start(goTo(clampToStage(info, (snap.pos.x + info.centerX) / 2, 30), false, 30, info));
      }
      return;
    }
    if (situation === 'combo' && this.rand() < this.lv.followUp) {
      const tAct = path.findIndex((p) => actionable(p) || p.grounded);
      const p = path[tAct < 0 ? path.length - 1 : Math.min(tAct, 30)]!;
      this.start(goTo(clampToStage(info, p.x, margin), true, 20, info));
      return;
    }
    const above = s.y - me.pos.y;
    if (above > 14 && Math.abs(s.x - me.pos.x) < 35 && this.rand() < 0.3 + 0.4 * this.lv.aggression) {
      const stick = Math.sign(s.x - me.pos.x) * 70;
      if (this.hopLands(state, me, stick, 8, (t) => t > 24)) {
        this.start(fullHop('jumpToward', stick, 8, 24));
        return;
      }
    }
    if (above < -14 && me.ground?.kind === 'platform' && this.rand() < 0.6) {
      this.start(dropThrough());
      return;
    }
    if (this.rand() < this.lv.aggression) {
      const gap = 6 + this.rand() * 10;
      const tx = clampToStage(info, s.x - dir * gap, margin);
      if (
        Math.abs(s.x - me.pos.x) < 40 &&
        Math.abs(s.x - me.pos.x) > 18 &&
        this.rand() < 0.15 + 0.2 * this.lv.aggression &&
        this.hopLands(state, me, dir * 100, 1, (t, g) => t > 3 && g.vel.y <= 0)
      ) {
        this.start(shortHop(dir));
        return;
      }
      this.start(goTo(tx, true, 24, info, dir));
      return;
    }
    const space = 28 + this.rand() * 26;
    this.start(goTo(clampToStage(info, s.x - dir * space, margin), this.rand() < 0.4, 24, info, dir));
  }

  private aimless(me: Readonly<FighterState>, info: StageInfo): Program {
    const r = this.rand();
    if (me.ground === null) return drift(landingX(info, me, info.centerX), false, 10, info);
    if (r < 0.4) return wait(20 + Math.floor(this.rand() * 40));
    if (r < 0.75) {
      const x = info.left + 15 + this.rand() * (info.right - info.left - 30);
      return goTo(x, false, 60, info);
    }
    if (r < 0.9) return shortHop(0);
    return crouch(20 + Math.floor(this.rand() * 30));
  }

  /** Airborne and nothing to do: drift back over the stage and maybe fast fall. */
  private airIdle(me: Readonly<FighterState>, info: StageInfo): InputFrame {
    if (this.fastFallAir !== me.airFrames || me.airFrames <= 1) {
      if (me.airFrames <= 1) this.wantFastFall = this.rand() < this.lv.fastFall * 0.5;
    }
    this.fastFallAir = me.airFrames;
    const toward =
      me.pos.x < info.left + 10 || me.pos.x > info.right - 10 ? Math.sign(info.centerX - me.pos.x) * 100 : 0;
    const x = info.calm ? toward : steer(me, info, toward);
    const ff = this.wantFastFall && actionable(me) && canFastFall(me, info) && this.last.y > -30;
    return press({ x, y: ff ? -100 : 0 });
  }
}

type LedgeOption = 'climb' | 'jump' | 'roll' | 'attack' | 'drop';
type GetupOption = 'stand' | 'roll' | 'attack';

/** Frames before touching down that the CPU presses Shield to tech (the window is TECH_WINDOW, 11). */
const TECH_LEAD = 4;
/** Knocked down, getting up, or in a grab: nothing to input until it ends. */
const BUSY = new Set([
  'downBound',
  'techInPlace',
  'techRoll',
  'getupStand',
  'getupRoll',
  'grabPummel',
  'grabThrow',
  'grabRelease',
]);
/** Throws and the stick direction that starts each, facing right. */
const THROWS: [string, InputFrame][] = [
  ['fthrow', press({ x: 100 })],
  ['bthrow', press({ x: -100 })],
  ['uthrow', press({ y: 100 })],
  ['dthrow', press({ y: -100 })],
];

/** The most damage one of the fighter's throws does (what a grab is worth). */
function throwDamage(k: FighterKnowledge): number {
  return Math.max(0, ...THROWS.map(([name]) => k.def.moves?.[name]?.throw?.hit.damage ?? 0));
}

/** Frames of hitlag a pummel adds on top of its own length (an estimate, for the escape margin). */
const PUMMEL_HITLAG = 3;

/** Run the launch `hit` would cause on a private copy of `victim` standing at `at`, and see if it reaches a blast zone. */
function launchKills(
  state: Readonly<MatchState>,
  victim: Readonly<FighterState>,
  at: { x: number; y: number; grounded: boolean },
  hit: Pick<HitboxDef | ThrowHitDef, 'damage' | 'kbg' | 'bkb' | 'wbkb' | 'angle'>,
  dir: 1 | -1,
): boolean {
  const kb = knockback({
    percent: victim.damage,
    damage: hit.damage,
    kbg: hit.kbg,
    bkb: hit.bkb,
    wbkb: hit.wbkb,
    weight: getFighter(victim.fighter).stats.weight,
  });
  if (kb < 80) return false;
  const v: FighterState = {
    ...snapshot(victim),
    pos: { x: at.x, y: at.y },
    prevPos: { x: at.x, y: at.y },
    vel: { x: 0, y: 0 },
    kb: { x: 0, y: 0 },
    ground: at.grounded ? victim.ground : null,
    action: 'tumble',
    actionFrame: 0,
    hitlag: 0,
    hitstun: 0,
    ledge: -1,
    grabPartner: -1,
    launch: { kb, angle: hit.angle, dir, setKnockback: (hit.wbkb ?? 0) > 0 },
  };
  const m = soloMatch(state, v);
  const path = run(m, 160, undefined, (g, t) => t > 2 && !g.launch && g.hitstun <= 0);
  const end = path.at(-1);
  return end !== undefined && (end.action === 'ko' || end.action === 'out');
}

function snapshot(f: Readonly<FighterState>): FighterState {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    out[k] = Array.isArray(v) ? v.slice() : v !== null && typeof v === 'object' ? { ...v } : v;
  }
  return out as unknown as FighterState;
}

function samplesFallback(snap: FighterState): Sample {
  const stats = getFighter(snap.fighter).stats;
  return {
    x: snap.pos.x,
    y: snap.pos.y,
    vx: 0,
    vy: 0,
    action: snap.action,
    actionFrame: snap.actionFrame,
    move: null,
    grounded: snap.ground !== null,
    facing: snap.facing,
    hurt: hurtbox(snap, stats),
    intangible: true,
    boxes: [],
    ledge: snap.ledge,
    hitstun: 0,
    landingLag: 0,
    jumpsUsed: snap.jumpsUsed,
  };
}

const GONE = new Set(['ko', 'out']);

function nearestOpponent(
  state: Readonly<MatchState>,
  me: Readonly<FighterState>,
  lag = 0,
  seen?: (port: number, lag: number) => FighterState,
): FighterState | null {
  let best: FighterState | null = null;
  let bestD = Infinity;
  for (const f of state.fighters) {
    if (f.port === me.port || GONE.has(f.action)) continue;
    const g = seen ? seen(f.port, lag) : f;
    const d = Math.hypot(g.pos.x - me.pos.x, g.pos.y - me.pos.y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

function classify(path: Sample[]): Situation {
  const s = path[0]!;
  if (s.action === 'hitstun' || (s.action === 'tumble' && s.hitstun > 0)) return 'combo';
  const free = path.findIndex((p) => actionable(p));
  if (free > 8 || free < 0) return 'punish';
  return 'neutral';
}

/** What the CPU assumes the opponent keeps doing: shielding keeps shielding, running keeps running, recovering recovers. */
function assumedInput(snap: FighterState, info: StageInfo, state: Readonly<MatchState>): Driver {
  if (snap.action === 'shield' || snap.action === 'shieldStun') return () => press({ buttons: Btn.Shield });
  if (!actionable(snap) && snap.action !== 'helpless') return () => neutralInput();
  if (snap.ground === null && floorBelow(info, snap.pos.x, snap.pos.y) === null) {
    const k = knowledge(snap.fighter, state.config.stage);
    const special = (k.hints.recovery ?? ['upB', 'sideB']).find((s) => k.air[s]) ?? null;
    return recoveryDriver(info, k, { jumpAt: 1, special, specialAt: Infinity, below: 10, dodgeAt: Infinity });
  }
  const vx = snap.vel.x;
  if (Math.abs(vx) < 0.4) return () => neutralInput();
  const walk = getFighter(snap.fighter).stats.walkSpeed;
  const x =
    snap.ground !== null && Math.abs(vx) <= walk + 0.05
      ? Math.sign(vx) * STICK.tilt
      : Math.sign(vx) * STICK.full;
  return () => press({ x });
}
