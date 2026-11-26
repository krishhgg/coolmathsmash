import { describe, expect, it } from 'vitest';
import { getFighter } from '../fighters/registry';
import { neutralInput } from '../input/types';
import { posedStage } from '../sim/context';
import { entityPlatform, spawnEntity } from '../sim/entities/entities';
import type { GroundRef } from '../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { groundSpan, surfaceY } from '../sim/movement';
import { createCpu } from './index';
import { stageInfo } from './stage';

/** Battlefield's right side platform (24.79 to 59.42 at 24.12), its top platform (-17.32 to 17.32 at 47.19). */
const SIDE: GroundRef = { kind: 'platform', index: 2 };
const TOP: GroundRef = { kind: 'platform', index: 1 };
const FLOOR: GroundRef = { kind: 'solid', index: 0 };
const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
const ROLLS = new Set(['rollForward', 'rollBack']);

function duel(stage = 'battlefield', me = 'fireboy'): MatchState {
  return createMatch({ seed: 3, stage, stocks: 3, ports: [{ fighter: me }, { fighter: 'fireboy' }] });
}

/** Port `port` standing still at `x` on `ground`, facing `facing`. */
function stand(m: MatchState, port: number, x: number, ground: GroundRef, facing: 1 | -1): void {
  const y = surfaceY(posedStage(m), ground, x);
  Object.assign(m.fighters[port]!, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    kb: { x: 0, y: 0 },
    ground,
    action: 'idle',
    actionFrame: 1,
    facing,
  });
}

/** Where port `port` stands along its ground, from that ground's left end: what a moving platform carries. */
function along(m: MatchState, port: number): number {
  const f = m.fighters[port]!;
  return f.pos.x - groundSpan(posedStage(m), f.ground!)[0];
}

interface Roll {
  dir: number;
  /** The roll's full length: a forward roll's rollDistance, a back roll's backRollDistance. */
  length: number;
  /** How far along its ground the CPU was when the roll started and when it ended. */
  from: number;
  to: number;
}

/**
 * Port 0's CPU standing at `x` on `ground` (facing `facing`), port 1 at `foe` on `foeGround` on the first frame of a
 * forward smash at it, which hits on frame 15 unless the CPU gets out of the way. Returns the shield rolls the CPU
 * finishes in the next 90 frames. A roll a hit cuts off is left out: where it stopped says nothing about its length.
 */
function shieldRolls(
  m: MatchState,
  seed: number,
  [x, ground, facing]: [number, GroundRef, 1 | -1],
  [foe, foeGround]: [number, GroundRef],
): Roll[] {
  stand(m, 0, x, ground, facing);
  stand(m, 1, foe, foeGround, x > foe ? 1 : -1);
  Object.assign(m.fighters[1]!, { action: 'attack', move: 'fsmash', actionFrame: 1 });
  const f = m.fighters[0]!;
  const cpu = createCpu({ port: 0, level: 9, seed });
  const out: Roll[] = [];
  let roll: Roll | null = null;
  for (let i = 0; i < 90; i++) {
    stepMatch(m, [cpu.input(m), neutralInput()]);
    if (!roll && ROLLS.has(f.action)) {
      const s = getFighter(f.fighter).stats;
      const length = f.action === 'rollBack' ? (s.backRollDistance ?? s.rollDistance) : s.rollDistance;
      roll = { dir: f.dodgeDir.x, length, from: along(m, 0), to: NaN };
    }
    if (roll && !ROLLS.has(f.action)) {
      if (f.action === 'idle') out.push({ ...roll, to: along(m, 0) });
      roll = null;
    }
  }
  return out;
}

/** Every roll covers its full length along its ground: nothing stopped it short at an end. */
function expectWholeRolls(rolls: Roll[], label: string): void {
  for (const r of rolls) {
    expect(
      r.to - r.from,
      `${label}: roll ${r.dir > 0 ? 'right' : 'left'} from ${r.from.toFixed(2)}`,
    ).toBeCloseTo(r.dir * r.length, 3);
  }
}

describe('CPU shield rolls away from a threat on a platform', () => {
  // Each spot puts the CPU 3 to 15 units from one end of its platform with the threat on the other side, so a roll
  // away from it heads for that end. None of these platforms leaves room for a 28-unit roll there, so the CPU picks
  // something else. Each such roll would end inside the main stage's ends, which is all the CPU used to check.
  const FACINGS = [1, -1] as const;

  /** No roll fits from there: any roll picked stops short (the first check) and none is picked at all. */
  function expectNoRoll(rolls: Roll[], label: string): void {
    expectWholeRolls(rolls, label);
    expect(rolls.length, `${label}: rolls picked`).toBe(0);
  }

  it("on Battlefield's side platform, toward either end", () => {
    for (const [x, foe] of [
      [32, 46],
      [45, 31],
    ] as const) {
      for (const facing of FACINGS) {
        const rolls = SEEDS.flatMap((seed) => shieldRolls(duel(), seed, [x, SIDE, facing], [foe, SIDE]));
        expectNoRoll(rolls, `side platform from x ${x}, facing ${facing}`);
      }
    }
  }, 60_000);

  it("on Battlefield's top platform, toward either end", () => {
    for (const [x, foe] of [
      [-8, 6],
      [8, -6],
    ] as const) {
      for (const facing of FACINGS) {
        const rolls = SEEDS.flatMap((seed) => shieldRolls(duel(), seed, [x, TOP, facing], [foe, TOP]));
        expectNoRoll(rolls, `top platform from x ${x}, facing ${facing}`);
      }
    }
  }, 60_000);

  it("on Truck Convoy's moving decks, toward either end", () => {
    // From frame 960 both haulers pull ahead 36 units in 120 frames, the left deck from -61..-23 and the right one
    // from 23..61, carrying whoever is on them. Rolls are measured along the deck.
    const base = duel('wheely-trucks');
    for (let i = 0; i < 960; i++) stepMatch(base, [neutralInput(), neutralInput()]);
    const decks = posedStage(base).geo.platforms;
    expect([decks[0]!.x1, decks[0]!.x2, decks[1]!.x1, decks[1]!.x2]).toEqual([-61, -23, 23, 61]);
    for (const [index, at, foeAt] of [
      [0, 31, 17],
      [1, 7, 21],
    ] as const) {
      const deck: GroundRef = { kind: 'platform', index };
      const x1 = decks[index]!.x1;
      for (const facing of FACINGS) {
        const rolls = SEEDS.flatMap((seed) =>
          shieldRolls(structuredClone(base), seed, [x1 + at, deck, facing], [x1 + foeAt, deck]),
        );
        expectNoRoll(rolls, `deck ${index} from ${at} along it, facing ${facing}`);
      }
    }
  }, 60_000);

  it('on a Duck Raft, 14 wide, half a roll', () => {
    // The CPU is a Raft Wars kid on its own raft. Its look-ahead carries only its own entities: on an opponent's raft
    // the predicted opponent would fall through, and the CPU would see no threat to roll from.
    for (const [x, foe] of [
      [-3, 4],
      [3, -4],
    ] as const) {
      for (const facing of FACINGS) {
        const rolls = SEEDS.flatMap((seed) => {
          const m = duel('battlefield', 'raftwars');
          const raft = spawnEntity(m, { kind: 'raftwars/duckRaft', owner: 0, pos: { x: 0, y: 12 } });
          const deck: GroundRef = { kind: 'entity', index: raft.id, ...entityPlatform(raft)! };
          return shieldRolls(m, seed, [x, deck, facing], [foe, deck]);
        });
        expectNoRoll(rolls, `raft from x ${x}, facing ${facing}`);
      }
    }
  }, 60_000);
});

describe('CPU shield rolls on the main floor', () => {
  it("judges Battlefield's floor by its ledges, 4 units in, as before", () => {
    // The floor's span is the ledges, -80 to 80, which the old check used.
    const info = stageInfo(duel());
    expect(groundSpan(info.c, FLOOR)).toEqual([info.left, info.right]);
    // A roll left from x -46 ends at -74, 6 units in, and one from -50 at -78, 2 units in. Mirrored on the right.
    for (const [x, foe, fits] of [
      [0, 14, true],
      [-46, -32, true],
      [-50, -36, false],
      [0, -14, true],
      [46, 32, true],
      [50, 36, false],
    ] as const) {
      for (const facing of [1, -1] as const) {
        const rolls = SEEDS.flatMap((seed) => shieldRolls(duel(), seed, [x, FLOOR, facing], [foe, FLOOR]));
        expectWholeRolls(rolls, `floor from x ${x}, facing ${facing}`);
        expect(rolls.length > 0, `floor from x ${x}, facing ${facing}: ${rolls.length} rolls`).toBe(fits);
      }
    }
  }, 60_000);
});
