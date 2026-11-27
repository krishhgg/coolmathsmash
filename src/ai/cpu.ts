import { getFighter } from '../fighters/registry';
import { nextRandom } from '../engine/rng';
import type { HitboxDef, ThrowHitDef } from '../fighters/types';
import { Btn, neutralInput, type InputFrame } from '../input/types';
import { hurtbox } from '../sim/combat/hits';
import { hitstunFrames, knockback, shieldstunFrames } from '../sim/combat/formulas';
import {
  AIR_DODGE_TECH_WINDOW,
  GRAB,
  INPUT_BUFFER_FRAMES,
  SHIELD_DROP_FRAMES,
  SPECIAL_REVERSE,
  TECH_WINDOW,
} from '../sim/constants';
import { buffered, type ControlState } from '../sim/control';
import { statusDef, statusLength } from '../sim/statuses';
import type { FighterState } from '../sim/fighter';
import { finalReach } from '../sim/finalSmash';
import { stepMatch, type MatchState } from '../sim/match';
import { groundSpan, surfaceY } from '../sim/movement';
import { STICK, TURNING_MOVES, press } from './inputs';
import { actionable, knowledge, type FighterKnowledge } from './knowledge';
import { cpuLevel, type CpuLevel } from './levels';
import { overlaps, run, runAmong, soloMatch, type Driver, type OwnFrame, type Sample } from './look';
import { findAttacks, groundEndX, type Attack, type Self, type Target } from './options';
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
  driftBack,
  floorBelow,
  groundUnder,
  landingX,
  landsSafe,
  safeSpot,
  stageInfo,
  standSafe,
  type StageInfo,
} from './stage';
import * as SimMath from '../sim/math';

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
/** An opponent this far behind the CPU's feet still overlaps its body, so a Final Smash in front can reach it. */
const FINAL_BEHIND = 4;
const HORIZON = 45;
/**
 * How far ahead a CPU whose fighter shoots reads the opponent: long enough for a Fireball to cross most of
 * Battlefield (17 frames of startup and 70 of flight) or a Grenade's fuse to run out.
 */
const SHOT_HORIZON = 110;
const NEUTRAL = Object.freeze(neutralInput());
/** Units inside the ends of its ground that a shield roll, tech roll or getup roll the CPU picks must end. */
const ROLL_ROOM = 4;

type Situation = 'combo' | 'punish' | 'neutral';

export class Cpu {
  readonly lv: CpuLevel;
  private readonly rng: { rng: number };
  private history: FighterState[][] = [];
  /** The CPU's own fighter and live entities on each frame of `history`. */
  private ownHistory: OwnFrame[] = [];
  private prog: (Program & { t: number }) | null = null;
  private last: InputFrame = neutralInput();
  private nextThink = 0;
  private recovery: RecoveryPlan | null = null;
  private recoveryDrive: Driver | null = null;
  /** The recovery plan was made while the fighter couldn't act (in an air dodge, say). */
  private recoveryBusy = false;
  private ledgePlan: { option: LedgeOption; at: number } | null = null;
  private techPlan: { tech: boolean; dir: number | null; pressed: boolean } | null = null;
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
    const frame = state.fighters.map(snapshot);
    this.history.push(frame);
    this.ownHistory.push({
      f: frame[this.port]!,
      entities: state.entities.filter((e) => e.owner === this.port && !e.dead).map((e) => structuredClone(e)),
    });
    if (this.history.length > HISTORY) {
      this.history.shift();
      this.ownHistory.shift();
    }
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
    // A tech press an air dodge took keeps its plan, and its stick, until the dodge touches down.
    const teching = a === 'tumble' || (a === 'airDodge' && this.techPlan?.pressed === true);
    if (!teching || me.launch) this.techPlan = null;
    if (a !== 'down') this.getupPlan = null;
    if (a !== 'grabHold' && a !== 'grabPummel') this.grabPlan = null;
    if (a === 'ko' || a === 'out') {
      this.prog = null;
      this.recovery = null;
      return NEUTRAL;
    }
    if (a === 'respawn') return this.onRespawn(state, me);
    if (me.launch) return this.onLaunch(state, me);
    if (teching) {
      const i = this.onTumble(state, me);
      if (i) return i;
    }
    if (a === 'down') return this.onDown(state, me);
    if (a === 'grabbed' || a === 'dizzy') return this.mash(state);
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
    const final = this.finalSmash(state, me);
    if (final) return final;
    const info = stageInfo(state);
    // Off the stage: in the air with no stage under it, or standing on an entity's platform (a Duck Raft) with no stage
    // under it, which holds only until it pops. Either way the CPU recovers to the stage.
    const offstage =
      (me.ground === null || me.ground.kind === 'entity') &&
      floorBelow(info, me.pos.x, me.pos.y) === null &&
      !a.startsWith('ledge');
    if (this.prog && !this.prog.interruptible && (!offstage || this.prog.offstage)) {
      const i = this.runProgram(me, info);
      if (i) return i;
    }
    if (offstage) {
      this.prog = null;
      return this.recover(state, me, info);
    }
    // A recovery that brings the fighter back over the stage still unable to act (in its special, or the helpless fall
    // after it) carries on until it lands: the plan was checked steering through that fall. Wheely's Ramp Jump can carry
    // him over the stage at 2 units a frame, and with no input he would drift across it and off the far side.
    if (this.recovery && me.ground === null && !actionable(me)) return this.recover(state, me, info);
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

  /**
   * Holding a Final Smash charge: neutral special as soon as an opponent, as the CPU sees it, is in the Final Smash's
   * reach in front (finalReach). Special is let go for a frame first if it was held, so the press registers.
   */
  private finalSmash(state: Readonly<MatchState>, me: Readonly<FighterState>): InputFrame | null {
    if (!me.finalReady || !actionable(me)) return null;
    const reach = finalReach(me.fighter);
    if (!reach) return null;
    const lag = this.lv.reaction;
    const opp = nearestOpponent(state, me, lag, (p, l) => this.seen(p, l));
    if (!opp) return null;
    const g = this.seen(opp.port, lag);
    const ahead = (g.pos.x - me.pos.x) * me.facing;
    const up = g.pos.y - me.pos.y;
    const tall = getFighter(g.fighter).stats.height;
    if (ahead < -FINAL_BEHIND || ahead > reach.ahead || up + tall < reach.low || up > reach.high) return null;
    this.prog = null;
    if (this.last.buttons & Btn.Special) return NEUTRAL;
    return { ...NEUTRAL, buttons: Btn.Special };
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
      // A program's first press is let go for a frame when the last input held it, so the sim sees a new press. Not
      // Shield held into a shield or its stun: the shield took the press it started with, and a new one there stays
      // in the buffer, so a jump out of the shield air dodges with it on its first frame in the air.
      const shielding = me.action === 'shield' || me.action === 'shieldStun';
      const again = this.last.buttons & ~(shielding ? Btn.Shield : 0);
      const reused = (i.buttons & again) !== 0;
      const cAgain = (i.cx !== 0 || i.cy !== 0) && (this.last.cx !== 0 || this.last.cy !== 0);
      if (reused || cAgain) return { ...i, buttons: i.buttons & ~again, cx: 0, cy: 0 };
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
      this.diStick = press({ x: Math.round(SimMath.cos(a) * 100), y: Math.round(SimMath.sin(a) * 100) });
    } else {
      this.diStick = neutralInput();
    }
    return this.diStick;
  }

  /**
   * Tumbling into the floor: decide once whether to tech, then press Shield inside the tech window (the TECH_WINDOW
   * frames before touching down, which a look-ahead with no input predicts) and hold the stick for a tech roll or let
   * go for a tech in place. Each press is tried on a copy of the match first (techPress). A press waits in the input
   * buffer, and an air dodge takes it as soon as one is possible: from frame 41 of hitstun by the hitstun cancel
   * (HITSTUN_CANCEL_AIR_DODGE), or once hitstun runs out. While hitstun lasts the CPU never presses where that would
   * happen. It presses TECH_LEAD frames before touching down, or earlier in the window when only an earlier press
   * leaves the buffer before a dodge opens. Once hitstun is over every press air dodges, and the CPU presses only
   * when that dodge touches down soon enough to tech (AIR_DODGE_TECH_WINDOW), never into landing lag.
   */
  private onTumble(state: Readonly<MatchState>, me: Readonly<FighterState>): InputFrame | null {
    this.techPlan ??= { tech: this.rand() < this.lv.tech, dir: null, pressed: false };
    const plan = this.techPlan;
    if (!plan.tech) return null;
    if (plan.pressed) return press({ x: (plan.dir ?? 0) * 100 });
    const control = state.players[this.port]!.control;
    const m = soloMatch(state, me, control);
    const fall = run(m, TECH_WINDOW, undefined, (g) => g.action !== 'tumble');
    const touch = fall.at(-1);
    if (touch?.action !== 'downBound') return null;
    // Where the look-ahead touches down, which can be an entity's platform (a Duck Raft) that the stage doesn't have.
    const ground = m.fighters[0]!.ground;
    plan.dir ??= this.getupDirection(state, { ...me, pos: { x: touch.x, y: touch.y }, ground }, [0, 1, -1]);
    const ahead = fall.length - 1;
    const now = techPress(state, me, control, 0, plan.dir);
    if (ahead > TECH_LEAD) {
      // Early in the window: press now only when this press techs and one a frame later would not.
      if (now !== 'tech' || techPress(state, me, control, 1, plan.dir) === 'tech') return null;
    } else if (now === null || (now === 'dodge' && me.hitstun > 0)) {
      return null;
    }
    plan.pressed = true;
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

  /**
   * Held in a grab or dizzy from a shield break: mash at the level's rate, a new stick direction each time and a button
   * every other time. Ultimate's CPUs mash out of both, faster at higher levels (SmashWiki: Button mashing).
   */
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
   * A random roll direction (0 for in place) among the options whose roll ends ROLL_ROOM inside the ends of the ground
   * the CPU lies on (or, still tumbling, the ground under it) and, on a stage with hazards, somewhere it can stand. The
   * sim stops a roll at the end of that ground (groundSpan), so a longer roll would end short at the edge.
   */
  private getupDirection(state: Readonly<MatchState>, me: Readonly<FighterState>, options: number[]): number {
    const info = stageInfo(state);
    const reach = getFighter(me.fighter).stats.rollDistance;
    const ground = me.ground ?? groundUnder(info, me.pos.x, me.pos.y);
    const [lo, hi] = ground ? groundSpan(info.c, ground) : [info.left, info.right];
    const y = ground ? surfaceY(info.c, ground, me.pos.x) : me.pos.y;
    const safe = options.filter((d) => {
      const x = me.pos.x + d * reach;
      if (d !== 0 && (x < lo + ROLL_ROOM || x > hi - ROLL_ROOM)) return false;
      return info.calm || standSafe(info, me.fighter, x, y);
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
    const { input, then } = ledgeStart(option, me.facing);
    if (then) this.start(then);
    return input;
  }

  /**
   * A getup and the hang frame to take it on. A jump or a drop leaves the CPU in the air, so one picked is played out
   * on a copy of the match first (ledgeReturns), and another option is drawn when it wouldn't bring the CPU back.
   */
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
    let left = weights;
    let r = this.rand();
    for (;;) {
      let option: LedgeOption = 'climb';
      for (const [o, w] of left) {
        if ((r -= w) < 0) {
          option = o;
          break;
        }
      }
      if (!AIR_GETUPS.has(option) || ledgeReturns(state, me, option, at)) return { option, at };
      left = left.filter(([o]) => o !== option);
      r = this.rand() * left.reduce((sum, [, w]) => sum + w, 0);
    }
  }

  // ---------------------------------------------------------------- recovery

  private recover(state: Readonly<MatchState>, me: Readonly<FighterState>, info: StageInfo): InputFrame {
    const k = this.knowledge(state, me);
    const plan = this.recovery;
    const t = plan ? state.frame - plan.start : 0;
    const expected = plan?.path[t - 1];
    const drifted = expected !== undefined && SimMath.hypot(expected.x - me.pos.x, expected.y - me.pos.y) > 2;
    const free = actionable(me) && me.action !== 'helpless';
    // A plan made while the fighter couldn't act that found no way back is made again once it can. Wheely's neutral air
    // dodge past the ledge (airDodge.test.ts) planned early in the dodge, found nothing and kept that plan to a KO;
    // planned again when the dodge ends, he double jumps and Ramp Jumps to the ledge.
    const retry = plan?.outcome === 'fail' && this.recoveryBusy && free;
    if (!plan || !this.recoveryDrive || drifted || retry || t >= plan.path.length) {
      if (me.action !== 'helpless' && !actionable(me) && plan) return this.recoveryDrive!(t, me);
      const control = state.players[this.port]!.control;
      this.recoveryBusy = !free;
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

  /**
   * The opponent's next frames as the CPU expects them, t = 0 being the frame about to be simulated: HORIZON frames,
   * and `horizon` frames of the same prediction as `far` when that is longer (for projectiles). The CPU's own
   * entities play out in it too, so their hits move the opponent. They start as they were when the opponent was last
   * seen, so a shot that has hit since still hits, and the ones out now replace them when the look-ahead reaches now.
   */
  private foresee(
    state: Readonly<MatchState>,
    opp: Readonly<FighterState>,
    horizon = HORIZON,
  ): { path: Sample[]; far?: Sample[]; snap: FighterState } {
    const lag = Math.min(this.lv.reaction, this.history.length - 1);
    const snap = this.seen(opp.port, lag);
    const m = soloMatch(state, snap);
    // Ids for what spawns in the look-ahead start past the match's, so the CPU's entities keep their own.
    m.nextEntityId = state.nextEntityId;
    const info = stageInfo(state);
    const drive = assumedInput(snap, info, state);
    const samples = runAmong(m, lag + Math.max(horizon, HORIZON) + 1, drive, lag, this.ownHistory, opp.port);
    const far = samples.slice(lag);
    while (far.length < Math.max(horizon, HORIZON)) far.push(far.at(-1) ?? samplesFallback(snap));
    if (horizon <= HORIZON) return { path: far, snap };
    return { path: far.slice(0, HORIZON), far, snap };
  }

  private think(state: Readonly<MatchState>, me: Readonly<FighterState>, info: StageInfo): void {
    const opp = nearestOpponent(state, me, this.lv.reaction, (p, lag) => this.seen(p, lag));
    if (!opp) {
      if (this.escape(me, info)) return;
      if (actionable(me) && me.ground) this.start(goTo(info.centerX, false, 30, info));
      return;
    }
    const k = this.knowledge(state, me);
    const { path, far, snap } = this.foresee(state, opp, k.shoots ? SHOT_HORIZON : HORIZON);
    const target: Target = {
      path,
      errX: (this.rand() * 2 - 1) * this.lv.spacingError,
      grabbableIn: snap.grabbableFrom - state.frame,
      ...(far && { far }),
      ...(k.shoots && { rush: rush(far ?? path, me.pos.x, knowledge(snap.fighter, state.config.stage)) }),
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

    const self: Self = { f: me, k, info, groundDelay: me.ground ? 0 : Infinity, jumpDelay: 0, state };
    const edgeguarding = this.isEdgeguarding(state, me, snap, info);
    const attacks = this.rank(state, attacksFor(self, target), target, snap, k, info, edgeguarding);
    const chance =
      situation === 'combo' ? this.lv.followUp : situation === 'punish' ? this.lv.punish : this.lv.aggression;
    if (attacks.length && this.rand() < chance && this.startAttack(state, attacks, me, info)) return;
    if (Math.abs(now.x - me.pos.x) < 45 && this.rand() < this.lv.whiff * 0.3) {
      const facing = (move: string) => (TURNING_MOVES.has(move) ? dir : me.facing);
      const any = Object.keys(k.ground).filter(
        (move) =>
          !savesFinal(me, move) && (info.calm || this.groundMoveSafe(me, k, info, move, facing(move))),
      );
      if (any.length && me.ground && actionable(me)) {
        const move = any[Math.floor(this.rand() * any.length)]!;
        this.start(groundMove(move, facing(move)));
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
      if (!actionable(me) || me.airDodgeUsed || threat.t > 6) return false;
      const escape = this.airEscape(state, me, k, info);
      if (escape) this.start(escape);
      return escape !== null;
    }
    if (!actionable(me)) return false;
    const self: Self = { f: me, k, info, groundDelay: 0, jumpDelay: 0, state };
    const counters = attacksFor(self, target).filter((a) => a.kind === 'ground' && a.tHit < threat.t - 1);
    if (counters.length && this.rand() < 0.35 * skill) {
      counters.sort((a, b) => a.tHit - b.tHit);
      this.startAttack(state, [counters[0]!], me, info);
      return true;
    }
    const r = this.rand();
    // A shield roll away from the threat (a back roll facing it, a forward roll facing away) counts only if it ends
    // ROLL_ROOM inside the ends of the ground the CPU is on and, on a stage with hazards, somewhere it can stand. The
    // sim stops a roll at those ends (groundSpan), so a longer one would end short there.
    const reach =
      me.facing === dir ? (k.stats.backRollDistance ?? k.stats.rollDistance) : k.stats.rollDistance;
    const [lo, hi] = groundSpan(info.c, me.ground);
    const end = me.pos.x - dir * reach;
    const roomBehind =
      end >= lo + ROLL_ROOM &&
      end <= hi - ROLL_ROOM &&
      (info.calm || standSafe(info, me.fighter, end, me.pos.y));
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

  /**
   * How to get out of a hit in the air, played out first on a copy of the match (airReturns): a neutral air dodge if
   * the CPU gets back to the stage from where it leaves it, else an air dodge toward the stage (AIR_ESCAPES), else a
   * double jump toward it. A neutral air dodge keeps the momentum it starts with and can't catch a ledge, so out of a
   * hop toward the ledge or a dash off a platform it can carry the CPU past the ledge and under it. Null when nothing
   * gets back: taking the hit is better than that.
   */
  private airEscape(
    state: Readonly<MatchState>,
    me: Readonly<FighterState>,
    k: FighterKnowledge,
    info: StageInfo,
  ): Program | null {
    const returns = (input: InputFrame) => airReturns(state, me, this.lv, this.last, input);
    if (returns(press({ buttons: Btn.Shield }))) return airDodge();
    const toward = Math.sign(info.centerX - me.pos.x) || me.facing;
    for (const [x, y] of AIR_ESCAPES) {
      if (returns(press({ x: toward * x, y, buttons: Btn.Shield }))) return airDodge(toward * x, y);
    }
    if (me.jumpsUsed < k.stats.jumps && returns(press({ x: toward * STICK.full, buttons: Btn.Jump }))) {
      return fullHop('jumpBack', toward * STICK.full, 1, 20);
    }
    return null;
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
      state,
    };
    const freeAt = target.path.findIndex((s) => actionable(s) || (s.grounded && s.action === 'shield'));
    const window = freeAt < 0 ? target.path.length : freeAt;
    const attacks = this.rank(state, attacksFor(self, target), target, snap, k, info, false).filter(
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
    const me = state.fighters[this.port]!;
    const offstageOk = edgeguarding && this.lv.level >= 6;
    const arrive = target.rush?.arrive ?? 0;
    const below = farBelow(snap, info);
    const out: Attack[] = [];
    for (const a of attacks) {
      const s = (target.far ?? target.path)[a.tHit]!;
      // A shot that lands past HORIZON is aimed at a guess of where the opponent will be by then and leaves the CPU
      // busy a long time. Against an opponent far below the stage, only its assumed recovery (assumedInput) brings it
      // back into the shot, and one that falls instead is KO'd with the shot still in the air.
      if (a.shot && a.tHit > HORIZON && below) continue;
      const onStage =
        landsSafe(info, k.id, a.endX, a.endY + 1) &&
        (info.calm || a.landX === undefined || landsSafe(info, k.id, a.landX, a.endY + 1)) &&
        (info.calm || a.kind !== 'ground' || this.groundMoveSafe(me, k, info, a.move, a.facing));
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
      // A shot into a held shield chips it and nothing more; walking in for the grab is worth more. Dropped here, so
      // the KO bonus below can't bring it back. That includes the shield stun from a shot of the CPU's already out.
      if ((s.action === 'shield' || s.action === 'shieldStun') && a.shot) continue;
      const damage = a.shot?.damage ?? box.damage;
      let v = damage * (k.hints.prefer?.[a.move] ?? 1) * (1 + Math.min(1.5, kb / 110));
      if (s.action === 'shield') {
        const kind = k.def.moves?.[a.move]?.kind ?? 'other';
        const unsafe = a.busy - a.tHit - shieldstunFrames(box.damage, kind) - 5;
        v = box.damage * 0.2 - Math.max(0, unsafe) * 0.6;
      } else if (s.action !== 'hitstun' && s.action !== 'tumble') {
        v -= Math.max(0, a.busy - a.tHit) * 0.06;
      }
      if (a.shot) v -= exposure(a, arrive, holdUp(box, kb)) * SHOT_EXPOSURE;
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
    return Math.abs(a.endX - L.x) < 25 && a.endY > L.y - FAR_BELOW;
  }

  private wouldKill(state: Readonly<MatchState>, a: Attack, target: Target, snap: FighterState): boolean {
    const s = (target.far ?? target.path)[a.tHit]!;
    // A shot launches from its entity's facing and position, as the sim's launchDir does.
    const facing = a.shot?.facing ?? a.facing;
    const from = a.shot?.x ?? a.endX;
    const dir =
      a.box.direction === 'back'
        ? -facing
        : a.box.direction === 'away'
          ? Math.sign(s.x - from) || facing
          : facing;
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
      const facing = TURNING_MOVES.has(pick.move) ? pick.facing : me.facing;
      const ground = () => groundMove(pick.move, facing, pick.held ?? 0);
      this.start(
        (this.takesOff(state, me, pick.move) ? this.steerAttack(state, me, ground, pick.move) : ground)(),
      );
      return true;
    }
    const aerial = () => (pick.kind === 'jump' ? jumpAerial(pick, ff, info) : airAerial(pick, ff, info));
    const make = this.steerAttack(state, me, aerial, pick.move);
    if (!info.calm && !this.landsClear(state, me, make())) return false;
    this.start(make());
    return true;
  }

  /**
   * Whether grounded move `move` takes the CPU into the air: it takes off or ends helpless (MoveDef), or its probe
   * hops or rises.
   */
  private takesOff(state: Readonly<MatchState>, me: Readonly<FighterState>, move: string): boolean {
    const def = getFighter(me.fighter).moves?.[move];
    if (def?.leavesGround || def?.helpless) return true;
    const p = this.knowledge(state, me).ground[move];
    return (
      p !== undefined && (!p.endsGrounded || Math.abs(p.endDy) > 0.5 || p.active.some((a) => a.dy > 0.5))
    );
  }

  /**
   * A chosen attack whose move takes the CPU into the air, played out on a copy of the match first (playOut). One that
   * comes down on the stage without leaving it is left as it is. Otherwise, when holding the stick toward the stage
   * while in the air brings it down there, the program holds it from the latest step that does: from just after the
   * move's last active hitbox frame or shot when that is enough, so the hit plays as chosen, else as late as still lands,
   * giving up where the rest of the hit goes to stay on the stage. A move that locks drift, or one no steering saves,
   * is left as it is. `make` builds the program, fresh for each play, as programs keep state; the result does too.
   */
  private steerAttack(
    state: Readonly<MatchState>,
    me: Readonly<FighterState>,
    make: () => Program,
    move: string,
  ): () => Program {
    const base = this.playOut(state, me, make());
    if (base.end === 'stage') return make;
    // The move's last active hitbox frame, or the frame it puts out its last shot: steering after it can't move them.
    const def = getFighter(me.fighter).moves?.[move];
    const last = Math.max(
      0,
      ...(def?.hits ?? []).map((h) => h.frames[1]),
      ...(def?.spawn ?? []).map((s) => s.frame),
    );
    // Never inside a special's B-reverse window, where the stick behind turns the move round instead of drifting it.
    const air = base.steps.findIndex((s) => s.move === move && s.air && s.frame >= SPECIAL_REVERSE.window[1]);
    if (air < 0) return make;
    const after = base.steps.findIndex((s, t) => t >= air && (s.move !== move || s.frame >= last));
    const latest = after < 0 ? base.steps.length - 1 : after;
    const info = stageInfo(state);
    for (let from = latest; from >= air; from -= STEER_STEP) {
      const dir = Math.sign(info.centerX - base.steps[from]!.x) || -me.facing;
      const steered = () => steerFrom(make(), from, dir);
      if (this.playOut(state, me, steered()).end === 'stage') return steered;
    }
    return make;
  }

  /**
   * Play `program` out on a copy of the match, then let it fall as airIdle steers (idleStick), until the CPU comes
   * down: 'stage' when it lands somewhere it can stand without having left the stage, 'off' when it goes out over no
   * ground first (where the real CPU drops the program for its recovery) or doesn't come down, 'ko' when it is KO'd.
   * `steps` is the fighter before each step: its move and frame, x, and whether it was in the air.
   */
  private playOut(
    state: Readonly<MatchState>,
    me: Readonly<FighterState>,
    program: Program,
  ): {
    end: 'stage' | 'off' | 'ko';
    steps: { move: string | null; frame: number; x: number; air: boolean }[];
  } {
    const m = soloMatch(state, me, state.players[this.port]!.control);
    const g = m.fighters[0]!;
    const steps: { move: string | null; frame: number; x: number; air: boolean }[] = [];
    let running = true;
    let flew = false;
    for (let t = 0; t < ATTACK_PLAYOUT; t++) {
      const info = stageInfo(m);
      steps.push({ move: g.move, frame: g.actionFrame, x: g.pos.x, air: g.ground === null });
      const i: InputFrame | null = running ? program.step(t, g, info) : null;
      running &&= i !== null;
      stepMatch(m, [i ?? (g.ground === null ? press({ x: idleStick(g, info) }) : NEUTRAL)]);
      if (g.action === 'ko' || g.action === 'out') return { end: 'ko', steps };
      const after = stageInfo(m);
      if (g.ground === null) {
        flew = true;
        if (floorBelow(after, g.pos.x, g.pos.y) === null && !g.action.startsWith('ledge'))
          return { end: 'off', steps };
      } else if (flew || !running) {
        return { end: standSafe(after, g.fighter, g.pos.x, g.pos.y) ? 'stage' : 'off', steps };
      }
    }
    return { end: 'off', steps };
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
   * Whether a grounded move started here facing `facing` keeps the CPU somewhere safe, from its probe and the speed
   * the CPU carries into it (groundEndX): every point it slides over and where it ends (a roll or charge special can
   * carry the CPU into a gap or a damage zone). Moves that leave the ground only need a safe landing under where
   * they end.
   */
  private groundMoveSafe(
    me: Readonly<FighterState>,
    k: FighterKnowledge,
    info: StageInfo,
    move: string,
    facing: number,
  ): boolean {
    const p = k.ground[move];
    if (!p) return true;
    const end = groundEndX(me, info, p, facing);
    if (!p.endsGrounded || Math.abs(p.endDy) > 1) return landsSafe(info, k.id, end, me.pos.y + p.endDy + 1);
    const step = Math.sign(end - me.pos.x);
    for (let x = me.pos.x; step * (end - x) > 0; x += step) {
      if (!standSafe(info, k.id, x, me.pos.y)) return false;
    }
    return standSafe(info, k.id, end, me.pos.y);
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

  /**
   * Airborne and nothing to do: drift back over the stage and maybe fast fall. A helpless or free fall that would come
   * down past an edge with no input steers back onto the stage (driftBack): a helpless fall after an up special used
   * as an attack, or a fall with no opponent to think about, can carry the CPU over the stage and off the far side.
   */
  private airIdle(me: Readonly<FighterState>, info: StageInfo): InputFrame {
    if (this.fastFallAir !== me.airFrames || me.airFrames <= 1) {
      if (me.airFrames <= 1) this.wantFastFall = this.rand() < this.lv.fastFall * 0.5;
    }
    this.fastFallAir = me.airFrames;
    const ff = this.wantFastFall && actionable(me) && canFastFall(me, info) && this.last.y > -30;
    return press({ x: idleStick(me, info), y: ff ? -100 : 0 });
  }
}

/**
 * Stick x for a CPU in the air with nothing else to do (airIdle): steer a helpless or free fall back over the stage
 * when it would come down past an edge (driftBack), else push toward the middle within 10 units of the stage's ends
 * (and round damage zones on a stage with hazards).
 */
function idleStick(me: Readonly<FighterState>, info: StageInfo): number {
  const toward =
    me.pos.x < info.left + 10 || me.pos.x > info.right - 10 ? Math.sign(info.centerX - me.pos.x) * 100 : 0;
  const back = me.action === 'helpless' || actionable(me) ? driftBack(info, me) : null;
  return back ?? (info.calm ? toward : steer(me, info, toward));
}

/** Frames steerAttack plays an attack out for: long enough for a helpless fall from a high up special to land. */
const ATTACK_PLAYOUT = 240;
/** Steps between the steering starts steerAttack tries, from the latest back. */
const STEER_STEP = 2;

/** `program`, holding the stick full toward `dir` (-1 or 1) from its step `from` on while the fighter is in the air. */
function steerFrom(program: Program, from: number, dir: number): Program {
  return {
    ...program,
    step(t, f, stage) {
      const i = program.step(t, f, stage);
      if (!i || t < from || f.ground !== null) return i;
      return { ...i, x: dir * STICK.full };
    },
  };
}

type LedgeOption = 'climb' | 'jump' | 'roll' | 'attack' | 'drop';
type GetupOption = 'stand' | 'roll' | 'attack';

/** Frames before touching down that the CPU presses Shield to tech (the window is TECH_WINDOW, 11). */
const TECH_LEAD = 4;

/**
 * What pressing Shield `wait` frames from now, then holding the stick toward `dir`, does for a tumbling CPU, run on
 * a copy of the match: 'tech' when it techs on touching down and no air dodge takes the press, 'dodge' when an air
 * dodge takes it (the hitstun cancel, or hitstun running out while the press is buffered) and still techs by
 * touching down within AIR_DODGE_TECH_WINDOW frames (Ultimate's air_escape_passive_trigger_frame, 15), and null when
 * it misses the tech or lands in landing lag.
 */
function techPress(
  state: Readonly<MatchState>,
  me: Readonly<FighterState>,
  control: Readonly<ControlState>,
  wait: number,
  dir: number,
): 'tech' | 'dodge' | null {
  const shield = press({ buttons: Btn.Shield });
  const hold = press({ x: dir * 100 });
  const m = soloMatch(state, me, control);
  const ctl = m.players[0]!.control;
  let dodged = false;
  const path = run(
    m,
    wait + AIR_DODGE_TECH_WINDOW + 1,
    (t) => (t < wait ? NEUTRAL : t === wait ? shield : hold),
    (g, t) => {
      // A dodge consumes the press it takes, even one that starts on the touchdown frame and never shows in a
      // sample, so a press gone from the buffer before it would expire went to an air dodge.
      if (t >= wait && t - wait < INPUT_BUFFER_FRAMES && !buffered(ctl, Btn.Shield)) dodged = true;
      return g.action !== 'tumble' && g.action !== 'airDodge';
    },
  );
  const end = path.at(-1)?.action;
  if (end !== 'techInPlace' && end !== 'techRoll') return null;
  return dodged ? 'dodge' : 'tech';
}

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

/** Ledge getups that leave the CPU in the air, to come down on the stage by itself. */
const AIR_GETUPS = new Set<LedgeOption>(['jump', 'drop']);
/** Frames after its press that an airborne getup has to land or catch a ledge again in (ledgeReturns). */
const LEDGE_RETURN = 150;

/** The press that starts ledge getup `option` facing the stage (`toward`), and the program that runs after it. */
function ledgeStart(option: LedgeOption, toward: number): { input: InputFrame; then?: Program } {
  switch (option) {
    case 'climb':
      return { input: press({ x: STICK.tilt * toward }) };
    case 'jump':
      return { input: press({ buttons: Btn.Jump }), then: ledgeJump(toward) };
    case 'roll':
      return { input: press({ buttons: Btn.Shield }) };
    case 'attack':
      return { input: press({ buttons: Btn.Attack }) };
    case 'drop':
      return { input: press({ x: -STICK.tilt * toward }), then: dropJump(toward) };
  }
}

/**
 * Whether ledge getup `option`, pressed on frame `at` of the hang, brings `me` back by itself. It plays out on a copy
 * of the match: the press, the program after it, then the stick held toward the stage. It must land somewhere `me`
 * can stand, or catch a ledge, within LEDGE_RETURN frames of the press. Bloxorz's block hangs 20 units under
 * Battlefield's ledge, so its drop and double jump hits the stage's corner and falls short, and the recovery after it
 * starts under the stage.
 */
function ledgeReturns(
  state: Readonly<MatchState>,
  me: Readonly<FighterState>,
  option: LedgeOption,
  at: number,
): boolean {
  const { input, then } = ledgeStart(option, me.facing);
  const m = soloMatch(state, me, state.players[me.port]!.control);
  let program = then ?? null;
  let pressed = -1;
  const drive: Driver = (t, g) => {
    if (pressed < 0) {
      if (g.action !== 'ledgeHang' || g.actionFrame < at) return NEUTRAL;
      pressed = t;
      return input;
    }
    const i = program?.step(t - pressed - 1, g, stageInfo(m)) ?? null;
    if (i) return i;
    program = null;
    return press({ x: STICK.full * me.facing });
  };
  const back = (g: Readonly<FighterState>, t: number) =>
    pressed >= 0 &&
    t > pressed &&
    (g.ground !== null || g.action === 'ledgeCatch' || t > pressed + LEDGE_RETURN);
  // The press comes `at` frames into the hang, after the rest of the catch (19 frames at most).
  run(m, at + 2 * LEDGE_RETURN, drive, back);
  const g = m.fighters[0]!;
  if (pressed < 0 || g.action === 'ledgeCatch') return true;
  return g.ground !== null && standSafe(stageInfo(m), g.fighter, g.pos.x, g.pos.y);
}

/** Frames airReturns plays an air option out for at most: a directional air dodge straight up lasts 116. */
const AIR_RETURN = 150;
/**
 * The sticks of the air dodges toward the stage that airEscape tries, in order, with x toward the stage: sideways,
 * diagonally up, then diagonally down, each at full tilt (71 is 100 over the square root of 2). Sideways first: it
 * flies level, without gravity, until its intangibility ends on frame 21, while one down onto the stage lands at once
 * and stands in landing lag where the hit was coming.
 */
const AIR_ESCAPES: readonly (readonly [number, number])[] = [
  [STICK.full, 0],
  [71, 71],
  [71, -71],
];

/**
 * Whether pressing `input` in the air now leaves `me` somewhere it gets back to the stage from. It plays out on a copy
 * of the match: the press (a frame later when `last`, the CPU's input last frame, already holds its button, as
 * runProgram sends it), then the stick toward the stage while the fighter is within 10 units of the stage's ends or
 * past them, as airIdle and the recovery steer. It runs until the fighter lands, catches a ledge, or can act again and
 * is falling. Landed, it must be somewhere it can stand. Still in the air, it must be over the stage or have a
 * recovery from there (planRecovery, without its random mistakes) that ends on the stage or a ledge. It draws no
 * random numbers.
 */
function airReturns(
  state: Readonly<MatchState>,
  me: Readonly<FighterState>,
  lv: CpuLevel,
  last: InputFrame,
  input: InputFrame,
): boolean {
  const m = soloMatch(state, me, state.players[me.port]!.control);
  const { left, right, centerX } = stageInfo(state);
  const at = (last.buttons & input.buttons) !== 0 ? 1 : 0;
  const drive: Driver = (t, g) => {
    if (t < at) return NEUTRAL;
    if (t === at) return input;
    const near = g.pos.x < left + 10 || g.pos.x > right - 10;
    return press({ x: near ? Math.sign(centerX - g.pos.x) * STICK.full : 0 });
  };
  const done = (g: Readonly<FighterState>, t: number) =>
    t > at && (g.ground !== null || g.action === 'ledgeCatch' || (actionable(g) && g.vel.y <= 0));
  run(m, AIR_RETURN, drive, done);
  const g = m.fighters[0]!;
  if (g.action === 'ko' || g.action === 'out') return false;
  if (g.action === 'ledgeCatch') return true;
  const info = stageInfo(m);
  if (g.ground !== null) return standSafe(info, g.fighter, g.pos.x, g.pos.y);
  if (floorBelow(info, g.pos.x, g.pos.y) !== null) return true;
  const k = knowledge(g.fighter, state.config.stage);
  const sure = { ...lv, recoveryError: 0 };
  return planRecovery(m, g, m.players[0]!.control, info, k, sure, { rng: 1 }).outcome !== 'fail';
}

/**
 * Score lost per frame a shot leaves the CPU busy after the opponent could be on it. A shot hits long after it is
 * thrown, so unlike a melee hit it does not stop an opponent who is already close: a slow one thrown up close is
 * the opening the opponent punishes.
 */
const SHOT_EXPOSURE = 0.25;
/** How close the opponent must get to strike, for `rush`. */
const STRIKE = 15;

/**
 * The target (`opp`) running straight at x from the first frame it can act on its path, at its run speed, until it is
 * within striking distance: its path doing so (rising and falling as predicted), the frame it gets there and the
 * frame its quickest grounded hit could land from there (Target.rush).
 */
function rush(path: Sample[], x: number, opp: FighterKnowledge): NonNullable<Target['rush']> {
  const speed = opp.stats.runSpeed;
  const startup = Math.min(...Object.values(opp.ground).map((p) => (p.first < 0 ? Infinity : p.first)));
  const free = path.findIndex((s) => actionable(s));
  const t0 = free < 0 ? path.length : free;
  const from = path[Math.min(t0, path.length - 1)]!.x;
  const gap = Math.max(0, Math.abs(from - x) - STRIKE);
  const dir = Math.sign(x - from);
  const ran = path.map((s, t) => {
    if (t < t0) return s;
    const nx = from + dir * Math.min(gap, speed * (t - t0));
    return { ...s, x: nx, hurt: { ...s.hurt, x: s.hurt.x + nx - s.x } };
  });
  const arrive = t0 + gap / speed;
  return { path: ran, arrive, strikes: arrive + (Number.isFinite(startup) ? startup : 0) };
}

/**
 * Frames a shot leaves the CPU busy after the target could arrive. A shot that lands first, or that would meet the
 * target on its way in (Attack.shot.stops), holds it up for `hold` frames.
 */
function exposure(a: Attack, arrive: number, hold: number): number {
  const at = a.tHit <= arrive || a.shot?.stops ? arrive + hold : arrive;
  return Math.max(0, a.busy - at);
}

/**
 * Frames a hit with `box` at knockback `kb` holds the target up: its hitstun, after the freeze of a status that
 * freezes (Bob the Robber's paralysis, which lasts longer than the hitstun it comes before).
 */
function holdUp(box: HitboxDef, kb: number): number {
  const def = box.status ? statusDef(box.status) : null;
  const freeze = def?.freeze
    ? statusLength(def, { damage: box.damage, knockback: kb * (box.hitlag ?? 1) })
    : 0;
  return hitstunFrames(kb) + freeze;
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

/** How far under the ledge counts as far below the stage, for the CPU's offstage attacks and for long shots. */
const FAR_BELOW = 15;

/** Off the stage and more than FAR_BELOW under the ledge it would come back to. */
function farBelow(f: Readonly<FighterState>, info: StageInfo): boolean {
  if (f.ground !== null || f.action.startsWith('ledge') || floorBelow(info, f.pos.x, f.pos.y) !== null)
    return false;
  const L = targetLedge(info, f.pos.x);
  return L !== null && f.pos.y < L.y - FAR_BELOW;
}

/**
 * Holding the charge, neutral special is the Final Smash, which the CPU saves for an opponent in its reach
 * (Cpu.finalSmash), so it is left out of the attack options.
 */
const savesFinal = (me: Readonly<FighterState>, move: string) =>
  move === 'neutralB' && me.finalReady && finalReach(me.fighter) !== null;

const attacksFor = (self: Self, target: Target) =>
  findAttacks(self, target).filter((a) => !savesFinal(self.f, a.move));

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
    const d = SimMath.hypot(g.pos.x - me.pos.x, g.pos.y - me.pos.y);
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
    return recoveryDriver(info, k, {
      jumpAt: 1,
      special,
      specialAt: Infinity,
      below: 10,
      reach: Infinity,
      dodgeAt: Infinity,
      specialFirst: true,
    });
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
