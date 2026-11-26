import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { createCpu } from './index';

/**
 * Air dodges that carry a CPU off the stage. A neutral air dodge keeps the momentum it starts with and falls for its
 * 52 frames without catching a ledge, so out of a hop toward the ledge, or a dash off a side platform, it can leave the
 * CPU under the ledge with no way back. The CPU now plays a dodge out on a copy of the match first (airEscape in
 * cpu.ts).
 */

/** Battlefield with `fighter` and `other`, settled. */
function battlefield(fighter: string, other: string): MatchState {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter }, { fighter: other }],
  });
  for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  return m;
}

/** How a level 9 CPU on port 0 got on: the air dodge it took ('neutral', 'directional' or '') and where it ended. */
interface Outcome {
  dodge: string;
  end: string;
  actions: string[];
}

/**
 * Run a level 9 CPU on port 0 for up to 600 frames while port 1 presses nothing, until it loses a stock or, from
 * frame `from` on, stands on the stage or catches a ledge.
 */
function play(m: MatchState, seed: number, from = 0): Outcome {
  const f = m.fighters[0]!;
  const cpu = createCpu({ port: 0, level: 9, seed });
  let dodge = '';
  const actions: string[] = [];
  for (let i = 0; i < 600; i++) {
    stepMatch(m, [cpu.input(m), neutralInput()]);
    if (actions.at(-1) !== f.action) actions.push(f.action);
    if (!dodge && f.action === 'airDodge') dodge = f.dodgeDir.x || f.dodgeDir.y ? 'directional' : 'neutral';
    if (f.stocks < 3) return { dodge, end: 'ko', actions };
    if (i < from) continue;
    if (f.ground !== null) return { dodge, end: 'stage', actions };
    if (f.action === 'ledgeCatch') return { dodge, end: 'ledge', actions };
  }
  return { dodge, end: f.action, actions };
}

interface Air {
  fighter: string;
  at: { x: number; y: number };
  vel: { x: number; y: number };
  action: string;
  actionFrame: number;
  /** Where Fireboy starts his neutral air, from `at`, in the direction `fighter` moves. */
  fireboy: number;
}

/**
 * `fighter` in the air at `at`, moving `vel`, with its double jump left, and Fireboy at the same height starting a
 * neutral air (frames 3 to 27 of it hit) close enough that the CPU expects it to hit within 6 frames.
 */
function fromAir(s: Air, seed: number): Outcome {
  const m = battlefield(s.fighter, 'fireboy');
  const f = m.fighters[0]!;
  const dir = Math.sign(s.vel.x) as 1 | -1;
  Object.assign(f, {
    pos: { ...s.at },
    prevPos: { ...s.at },
    vel: { ...s.vel },
    ground: null,
    action: s.action,
    actionFrame: s.actionFrame,
    jumpsUsed: 1,
    airDodgeUsed: false,
    fastFalling: false,
    facing: dir,
  });
  const o = m.fighters[1]!;
  const p = { x: s.at.x + dir * s.fireboy, y: s.at.y };
  Object.assign(o, {
    pos: p,
    prevPos: { ...p },
    vel: { x: 0, y: 0 },
    ground: null,
    jumpsUsed: 2,
    facing: dir,
  });
  Object.assign(o, {
    action: 'aerial',
    actionFrame: 0,
    move: 'nair',
    hitVictims: [],
    hitEntities: [],
    moveStale: 0,
  });
  return play(m, seed);
}

const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('CPU air dodges near the ledge', () => {
  // Bench match seed 4, Raft Wars against Wheely, frame 3381, as it played before #326 changed that match: Wheely
  // short hops toward the right ledge to edgeguard, neutral air dodges at (76.4, 12.5) the next frame, falls under the
  // ledge to (105.3, -56.0) by the time the dodge ends, and can't get back. In this setup main does that, and is KO'd,
  // at every seed.
  it('a level 9 Wheely short hopping toward the ledge dodges toward the stage and gets back', () => {
    const hop: Air = {
      fighter: 'wheely',
      at: { x: 75.6, y: 12.5 },
      vel: { x: 0.83, y: 0 },
      action: 'jump',
      actionFrame: 14,
      fireboy: -10,
    };
    const runs = seeds(10).map((seed) => ({ seed, ...fromAir(hop, seed) }));
    expect(runs.filter((r) => r.dodge).length).toBeGreaterThan(5);
    expect(runs.filter((r) => r.end === 'ko' || r.dodge === 'neutral').map((r) => r.seed)).toEqual([]);
  }, 60_000);

  // #318's bench, seed 18, Bloxorz against Wheely: the block tips off the end of the right side platform in its lying
  // form at 2.3 units a frame, three times its air speed, and on main its neutral air dodge keeps that speed and
  // carries it 90 units past the ledge. In this setup it did that, and was KO'd, at every seed.
  it('a level 9 Bloxorz block flying off a side platform at 2.3 units a frame dodges toward the stage and gets back', () => {
    const off: Air = {
      fighter: 'bloxorz-lying',
      at: { x: 66, y: 22 },
      vel: { x: 2.3, y: -0.5 },
      action: 'fall',
      actionFrame: 1,
      fireboy: 24,
    };
    const runs = seeds(10).map((seed) => ({ seed, ...fromAir(off, seed) }));
    expect(runs.filter((r) => r.dodge).length).toBeGreaterThan(5);
    expect(runs.filter((r) => r.end === 'ko' || r.dodge === 'neutral').map((r) => r.seed)).toEqual([]);
  }, 60_000);

  // Over the stage's middle a neutral air dodge comes down on the stage, so the CPU takes it as before.
  it.each(['wheely', 'bloxorz', 'fireboy', 'runner'])(
    'a level 9 %s over the middle of the stage still neutral air dodges',
    (fighter) => {
      const mid: Air = {
        fighter,
        at: { x: 0, y: 40 },
        vel: { x: 0.5, y: 0 },
        action: 'fall',
        actionFrame: 1,
        fireboy: -10,
      };
      const runs = seeds(10).map((seed) => ({ seed, ...fromAir(mid, seed) }));
      expect(runs.filter((r) => r.dodge === 'neutral').length).toBeGreaterThan(5);
      expect(runs.filter((r) => r.dodge === 'directional' || r.end !== 'stage').map((r) => r.seed)).toEqual(
        [],
      );
    },
    60_000,
  );
});
