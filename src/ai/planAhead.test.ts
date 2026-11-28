import { describe, expect, it } from 'vitest';
import { stepMatch, type MatchState } from '../sim/match';
import { Cpu } from './cpu';
import { knowledge } from './knowledge';
import { planRecovery, type RecoveryPlan } from './recovery';
import { stageInfo } from './stage';
import { drill } from './testing/recovery';

/** What the tests read of a Cpu: the plans it keeps between frames. */
interface Inside {
  ahead: { frame: number } | null;
  recovery: RecoveryPlan | null;
  rng: { rng: number };
  lv: Cpu['lv'];
}

/**
 * A level 9 CPU's `fighter` tumbling out from (x, y) in hitstun on Battlefield, its opponent standing on the stage.
 * Plays until the frame the CPU plans its recovery, `nudge` moving the fighter 0.5 units on that frame, after the CPU last
 * checked it against its prediction (as a push the prediction can't know of would). Returns the plan the CPU made, the one planRecovery makes from scratch from the
 * same match and the CPU's random state, and whether the CPU had worked one out ahead for that frame.
 */
function planned(fighter: string, x: number, y: number, nudge = false) {
  const m: MatchState = drill('battlefield', x, y, fighter);
  Object.assign(m.fighters[0]!, {
    action: 'tumble',
    actionFrame: 1,
    hitstun: 30,
    vel: { x: Math.sign(x) * 1.2, y: 1 },
  });
  const cpu = new Cpu(0, 9, 1);
  const inside = cpu as unknown as Inside;
  for (let i = 0; i < 120; i++) {
    const me = m.fighters[0]!;
    const ahead = inside.ahead?.frame === m.frame;
    const plan = inside.recovery;
    if (nudge && ahead) me.pos.x += 0.5;
    // What planRecovery reads on this frame, kept so the plan can be made from scratch for the frame the CPU plans on.
    const before = {
      m: structuredClone(m),
      me: structuredClone(me),
      control: structuredClone(m.players[0]!.control),
      rng: { ...inside.rng },
    };
    stepMatch(m, [cpu.input(m), { x: 0, y: 0, cx: 0, cy: 0, buttons: 0 }]);
    if (inside.recovery && inside.recovery !== plan) {
      const { m: b, me: f, control, rng } = before;
      const scratch = planRecovery(
        b,
        f,
        control,
        stageInfo(b),
        knowledge(f.fighter, 'battlefield'),
        inside.lv,
        rng,
      );
      return { cpu: inside.recovery, scratch, ahead };
    }
  }
  throw new Error('no recovery planned');
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
