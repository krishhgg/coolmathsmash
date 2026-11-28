import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { Cpu } from './cpu';
import { knowledge } from './knowledge';
import { planRecovery, type PlanWork, type RecoveryPlan } from './recovery';
import { stageInfo } from './stage';
import { drill } from './testing/recovery';

/** What the tests read of a Cpu: the plans it keeps between frames. */
interface Inside {
  ahead: { frame: number; work: PlanWork } | null;
  recovery: RecoveryPlan | null;
  rng: { rng: number };
  lv: Cpu['lv'];
}

/**
 * Plays a level 9 CPU on port 0 of `m`, port 1 with no input, until the frame the CPU plans its recovery. `change` changes
 * the match on that frame, after the CPU last checked it against its prediction. Returns the plan the CPU made, the one
 * planRecovery makes from scratch from the same match and the CPU's random state, whether the CPU had worked one out
 * ahead for that frame, and whether it used that work (its plan's path is one the work played) and what it aimed at.
 */
function plannedFrom(m: MatchState, change?: (m: MatchState) => void) {
  const cpu = new Cpu(0, 9, 1);
  const inside = cpu as unknown as Inside;
  for (let i = 0; i < 120; i++) {
    const me = m.fighters[0]!;
    const work = inside.ahead?.frame === m.frame ? inside.ahead.work : null;
    const plan = inside.recovery;
    if (work) change?.(m);
    // What planRecovery reads on this frame, kept so the plan can be made from scratch for the frame the CPU plans on.
    const before = {
      m: structuredClone(m),
      me: structuredClone(me),
      control: structuredClone(m.players[0]!.control),
      rng: { ...inside.rng },
    };
    stepMatch(m, [cpu.input(m), neutralInput()]);
    if (inside.recovery && inside.recovery !== plan) {
      const { m: b, me: f, control, rng } = before;
      const scratch = planRecovery(
        b,
        f,
        control,
        stageInfo(b),
        knowledge(f.fighter, b.config.stage),
        inside.lv,
        rng,
      );
      const cpuPlan = inside.recovery;
      const used = work !== null && work.run.paths.includes(cpuPlan.path);
      return { cpu: cpuPlan, scratch, ahead: work !== null, used, aims: work?.aims };
    }
  }
  throw new Error('no recovery planned');
}

/**
 * A level 9 CPU's `fighter` tumbling out from (x, y) in hitstun on Battlefield, its opponent standing on the stage.
 * Plays until the frame the CPU plans its recovery, `nudge` moving the fighter 0.5 units on that frame, after the CPU
 * last checked it against its prediction (as a push the prediction can't know of would). Returns what plannedFrom does.
 */
function planned(fighter: string, x: number, y: number, nudge = false) {
  const m: MatchState = drill('battlefield', x, y, fighter);
  Object.assign(m.fighters[0]!, {
    action: 'tumble',
    actionFrame: 1,
    hitstun: 30,
    vel: { x: Math.sign(x) * 1.2, y: 1 },
  });
  return plannedFrom(m, nudge ? (m) => void (m.fighters[0]!.pos.x += 0.5) : undefined);
}

describe('recovery plans worked out during hitstun', () => {
  it.each([
    ['wheely', 100, 20],
    ['fireboy', -110, 0],
    ['raftwars', 120, 40],
  ] as const)(
    'are the plan made on the frame from scratch: %s from (%d, %d)',
    (fighter, x, y) => {
      const r = planned(fighter, x, y);
      expect(r.ahead).toBe(true);
      expect(r.cpu).toEqual(r.scratch);
    },
    60_000,
  );

  it('count only when the match is exactly as predicted: half a unit off, the plan is made from the match as it is', () => {
    const r = planned('wheely', 100, 20, true);
    expect(r.ahead).toBe(true);
    expect(r.cpu).toEqual(r.scratch);
    expect(r.cpu.path).not.toEqual(planned('wheely', 100, 20).cpu.path);
  }, 60_000);
});

describe('recovery plans worked out during hitstun with a ledge held', () => {
  /** Johnny (port 1) hanging from Battlefield's left ledge, with no input, as he'd stay until his hang runs out. */
  function hanging(): MatchState {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'fluffy' }, { fighter: 'johnny' }],
    });
    for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    const o = m.fighters[1]!;
    Object.assign(o, {
      pos: { x: -85, y: -12 },
      prevPos: { x: -85, y: -11 },
      vel: { x: 0, y: -1 },
      ground: null,
      action: 'fall',
      actionFrame: 5,
      facing: 1,
      jumpsUsed: 2,
    });
    for (let i = 0; i < 20 && o.action !== 'ledgeHang'; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    expect(o.action).toBe('ledgeHang');
    return m;
  }

  /** Johnny in the air over the stage, off the ledge. */
  const offLedge = (m: MatchState) =>
    void Object.assign(m.fighters[1]!, {
      pos: { x: -60, y: 30 },
      prevPos: { x: -60, y: 30 },
      vel: { x: 0, y: 0 },
      ground: null,
      ledge: -1,
      action: 'fall',
      actionFrame: 1,
    });

  /**
   * Fluffy with his double jump used, tumbling out from (-100, 0) in hitstun beside the left ledge, with Johnny hanging
   * from it (`held`) or off it. `change` changes the match on the frame Fluffy plans his recovery, as plannedFrom.
   */
  function fluffy(held: boolean, change?: (m: MatchState) => void) {
    const m = hanging();
    if (!held) offLedge(m);
    Object.assign(m.fighters[0]!, {
      pos: { x: -100, y: 0 },
      prevPos: { x: -100, y: 0 },
      vel: { x: -0.6, y: 0.5 },
      ground: null,
      action: 'tumble',
      actionFrame: 1,
      hitstun: 20,
      facing: 1,
      jumpsUsed: 2,
      airDodgeUsed: false,
    });
    return plannedFrom(m, change);
  }

  // The planner's copy of the match has whoever holds a ledge in it (planStart), since Fluffy's Quick Grapple can't
  // latch onto a held ledge. With Johnny on the ledge, Fluffy air dodges; with nobody on it, he grapples it.
  it('predict the ledge holder: with Johnny still hanging, Fluffy uses the plan worked out ahead', () => {
    const r = fluffy(true);
    expect(r.used).toBe(true);
    expect(r.cpu).toEqual(r.scratch);
    expect(r.cpu.params).not.toEqual(fluffy(false).cpu.params);
  }, 60_000);

  it('count only with the same ledge holders: Johnny letting go on the frame, Fluffy plans from scratch', () => {
    const r = fluffy(true, offLedge);
    expect(r.ahead).toBe(true);
    expect(r.used).toBe(false);
    expect(r.cpu).toEqual(r.scratch);
    expect(r.cpu.params).not.toEqual(fluffy(true).cpu.params);
  }, 60_000);

  it('count only with the same ledge holders: Johnny catching the ledge on the frame, Fluffy plans from scratch', () => {
    const hang = structuredClone(hanging().fighters[1]!);
    const r = fluffy(false, (m) => void Object.assign(m.fighters[1]!, structuredClone(hang)));
    expect(r.ahead).toBe(true);
    expect(r.used).toBe(false);
    expect(r.cpu).toEqual(r.scratch);
    expect(r.cpu.params).not.toEqual(fluffy(false).cpu.params);
  }, 60_000);
});

describe("recovery plans worked out during hitstun in a gap in Run Tunnel's floor", () => {
  /**
   * Fireboy with his double jump used, tumbling down from (38, -10) in the gap between the middle and right floors,
   * moved `shift` units on the frame he plans his recovery (plannedFrom).
   */
  function inGap(shift: number) {
    const m = drill('run-tunnel', 38, -10, 'fireboy');
    Object.assign(m.fighters[0]!, {
      action: 'tumble',
      actionFrame: 1,
      hitstun: 20,
      vel: { x: 0, y: -0.5 },
      jumpsUsed: 2,
    });
    return plannedFrom(m, shift ? (m) => void (m.fighters[0]!.pos.x += shift) : undefined);
  }

  // He rises in the gap and lands on the floor beside it, aiming at the corner nearer him (gapTarget): the middle
  // floor's end (x 32), or 3 units on, past the gap's middle, the right floor's (x 48).
  it('aim at the gap corner predicted: Fireboy uses the plan worked out ahead, and it lands by the middle floor', () => {
    const r = inGap(0);
    expect(r.used).toBe(true);
    expect(r.cpu).toEqual(r.scratch);
    expect(r.cpu.params.gap?.x).toBe(32);
  }, 60_000);

  it("count only aiming at the same gap corner: moved past the gap's middle, Fireboy plans from scratch", () => {
    const r = inGap(3);
    expect(r.ahead).toBe(true);
    expect(r.aims?.gap?.x).toBe(32);
    expect(r.used).toBe(false);
    expect(r.cpu).toEqual(r.scratch);
    expect(r.cpu.params.gap?.x).toBe(48);
  }, 60_000);
});
