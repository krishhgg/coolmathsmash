import { describe, expect, it } from 'vitest';
import { getFighter } from '../fighters/registry';
import { neutralInput } from '../input/types';
import { posedStage } from '../sim/context';
import { entityPlatform, registerEntity, spawnEntity } from '../sim/entities/entities';
import type { FighterState, GroundRef } from '../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { groundSpan, surfaceY } from '../sim/movement';
import { hazardTestbed } from '../stages/hazardTestbed';
import { registerStage } from '../stages/registry';
import { createCpu } from './index';
import { inZone, stageInfo } from './stage';

registerStage(hazardTestbed);
/** An 80-wide soft platform 1 above the entity's centre, which stays put: a tech roll fits each way from its middle. */
registerEntity('test/wideDeck', { radius: 3, floor: 'pass', wall: 'pass', platform: { width: 80, y: 1 } });

/** Fireboy's tech roll and getup roll length. */
const ROLL = getFighter('fireboy').stats.rollDistance;
/** Battlefield's right side platform (24.79 to 59.42 at 24.12) and its top platform (-17.32 to 17.32 at 47.19). */
const SIDE: GroundRef = { kind: 'platform', index: 2 };
const TOP: GroundRef = { kind: 'platform', index: 1 };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function duel(stage = 'battlefield', foe = 'fireboy'): MatchState {
  return createMatch({ seed: 3, stage, stocks: 3, ports: [{ fighter: 'fireboy' }, { fighter: foe }] });
}

/**
 * Where `f` stands along the ground it is on, from that ground's left end (with the floors connected to it): what a
 * moving platform carries.
 */
function along(m: MatchState, f: Readonly<FighterState>): number {
  return f.pos.x - groundSpan(posedStage(m), f.ground!)[0];
}

/** Port 0 lying down at `x` on `ground`; port 1 standing on the main floor at `foe`, too far off to crowd it. */
function lieDown(m: MatchState, x: number, ground: GroundRef, foe = x > 0 ? -70 : 70): void {
  const y = surfaceY(posedStage(m), ground, x);
  Object.assign(m.fighters[0]!, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    kb: { x: 0, y: 0 },
    ground,
    action: 'down',
    actionFrame: 1,
    hitstun: 0,
  });
  m.fighters[1]!.pos.x = foe;
}

/** Port 0 tumbling 20 units above (x, top), falling straight down onto the ground there. */
function tumbleOnto(m: MatchState, x: number, top: number): void {
  const y = top + 20;
  Object.assign(m.fighters[0]!, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: -1 },
    kb: { x: 0, y: -1 },
    ground: null,
    action: 'tumble',
    actionFrame: 0,
    hitstun: 40,
  });
  m.fighters[1]!.pos.x = x > 0 ? -70 : 70;
}

interface Getup {
  /** The action that ended the knockdown: getupStand, getupRoll, getupAttack's attack, techInPlace or techRoll. */
  action: string;
  /** Roll direction, and how far along its surface the fighter was when the roll started and when it ended. */
  dir: number;
  from: number;
  to: number;
  /** Every action port 0 went through. */
  seen: string[];
  /** The ground it got up on. */
  ground: GroundRef | null;
}

const ROLLS = new Set(['getupRoll', 'techRoll']);
const GETUPS = new Set(['getupStand', 'getupRoll', 'attack', 'techInPlace', 'techRoll']);

/** Run port 0's CPU from a knockdown until it is standing again; port 1 holds still. */
function getUp(m: MatchState, level: number, seed: number): Getup {
  const f = m.fighters[0]!;
  const cpu = createCpu({ port: 0, level, seed });
  const out: Getup = { action: '', dir: 0, from: 0, to: 0, seen: [f.action], ground: null };
  for (let i = 0; i < 300; i++) {
    stepMatch(m, [cpu.input(m), neutralInput()]);
    if (out.seen.at(-1) !== f.action) out.seen.push(f.action);
    if (!out.action && GETUPS.has(f.action)) {
      out.action = f.action;
      out.ground = f.ground;
      if (ROLLS.has(f.action)) [out.dir, out.from] = [f.dodgeDir.x, along(m, f)];
    }
    if (out.action && !GETUPS.has(f.action)) {
      if (f.ground) out.to = along(m, f);
      break;
    }
  }
  return out;
}

describe('the sim at a platform end', () => {
  it('stops a getup roll and a tech roll at the end, still on the platform', () => {
    for (const action of ['getupRoll', 'techRoll']) {
      const m = duel();
      lieDown(m, 50, SIDE);
      Object.assign(m.fighters[0]!, { action, actionFrame: 0, dodgeDir: { x: 1, y: 0 } });
      const seen = new Set<string>();
      for (let i = 0; i < 60 && m.fighters[0]!.action !== 'idle'; i++) {
        stepMatch(m, [neutralInput(), neutralInput()]);
        seen.add(m.fighters[0]!.action);
      }
      const f = m.fighters[0]!;
      expect([...seen], action).not.toContain('fall');
      expect(f.action).toBe('idle');
      expect(f.ground).toEqual(SIDE);
      expect(f.pos.x).toBe(posedStage(m).geo.platforms[2]!.x2);
    }
  });
});

describe('CPU rolls out of a knockdown on a platform', () => {
  /** Rolls run their full length; nothing stops one short at an end. */
  function expectWholeRolls(runs: Getup[]): void {
    for (const r of runs.filter((r) => ROLLS.has(r.action))) {
      expect(r.to - r.from, `${r.action} ${r.dir > 0 ? 'right' : 'left'}: ${r.seen.join(' > ')}`).toBeCloseTo(
        r.dir * ROLL,
        3,
      );
    }
  }

  it("roll up from lying on Battlefield's platforms only where the roll fits", () => {
    // From x 27 only a roll right fits on the side platform, from 57 only a roll left, and from 45 neither. On the
    // top platform only a roll right from x -15 fits.
    const spots: [GroundRef, number, number[]][] = [
      [SIDE, 27, [1]],
      [SIDE, 45, []],
      [SIDE, 57, [-1]],
      [TOP, -15, [1]],
      [TOP, 0, []],
    ];
    for (const [ground, x, fits] of spots) {
      const runs = SEEDS.map((seed) => {
        const m = duel();
        lieDown(m, x, ground);
        return getUp(m, 9, seed);
      });
      expectWholeRolls(runs);
      const dirs = new Set(runs.filter((r) => r.action === 'getupRoll').map((r) => r.dir));
      expect([...dirs].sort(), `from x ${x}`).toEqual(fits);
    }
  });

  it("tech roll onto Battlefield's side platform only where the roll fits", () => {
    for (const [x, fits] of [
      [27, [0, 1]],
      [45, [0]],
      [57, [-1, 0]],
    ] as const) {
      const runs = SEEDS.map((seed) => {
        const m = duel();
        tumbleOnto(m, x, posedStage(m).geo.platforms[2]!.y);
        return getUp(m, 9, seed);
      });
      expectWholeRolls(runs);
      const techs = runs.filter((r) => /^tech/.test(r.action));
      expect(techs.length, `from x ${x}`).toBeGreaterThanOrEqual(6);
      expect([...new Set(techs.map((r) => r.dir))].sort(), `from x ${x}`).toEqual(fits);
    }
  });

  it('tech roll onto the floor of a stage with hazards, clear of its damage zones', () => {
    // The tech roll is picked a few frames before touching down. Its end has to be somewhere the CPU can stand, judged
    // at the height of the ground under it. The hazard testbed's floor has damage zones from x 36 to 60 and -60 to -36,
    // and a trapdoor from -15 to 15.
    const runs = SEEDS.flatMap((seed) =>
      [-15, 0, 15].map((x) => {
        const m = duel('hazard-testbed');
        expect(stageInfo(m).calm).toBe(false);
        tumbleOnto(m, x, 0);
        const r = getUp(m, 9, seed);
        if (r.action === 'techRoll') {
          const f = m.fighters[0]!;
          expect(inZone(stageInfo(m), f.fighter, f.pos.x, f.pos.y), r.seen.join(' > ')).toBe(false);
        }
        return r;
      }),
    );
    expectWholeRolls(runs);
    expect(runs.filter((r) => r.action === 'techRoll').length).toBeGreaterThan(0);
  });

  it('never roll up from lying on a Duck Raft, 14 wide, half a roll', () => {
    for (const x of [-6, 0, 6]) {
      for (const seed of SEEDS) {
        const m = duel('battlefield', 'raftwars');
        const raft = spawnEntity(m, { kind: 'raftwars/duckRaft', owner: 1, pos: { x: 0, y: 12 } });
        lieDown(m, x, { kind: 'entity', index: raft.id, ...entityPlatform(raft)! }, -60);
        const r = getUp(m, 9, seed);
        expect(r.action, `from x ${x} seed ${seed}: ${r.seen.join(' > ')}`).not.toBe('getupRoll');
      }
    }
  });

  it('tech onto a Duck Raft over the stage and off it, in place as no roll fits, as they tech on the floor', () => {
    // The look-ahead that times the tech press has to hold the raft (soloMatch), or it sees the fall go on past it and
    // never presses. Raft Wars techs onto its own raft as Fireboy does onto Raft Wars'. Without the raft, the same
    // falls over the stage tech on the floor below, rolling as well.
    for (const [fighter, owner] of [
      ['fireboy', 1],
      ['raftwars', 0],
    ] as const) {
      for (const [rx, ry] of [
        [0, 12],
        [100, -10],
      ]) {
        for (const dx of [-5, 0, 5]) {
          const runs = SEEDS.map((seed) => {
            const m = createMatch({
              seed: 3,
              stage: 'battlefield',
              stocks: 3,
              ports: [{ fighter }, { fighter: 'raftwars' }],
            });
            const raft = spawnEntity(m, { kind: 'raftwars/duckRaft', owner, pos: { x: rx!, y: ry! } });
            tumbleOnto(m, rx! + dx, entityPlatform(raft)!.y);
            return { ...getUp(m, 9, seed), raft: raft.id };
          });
          for (const r of runs) {
            const at = `${fighter} at x ${rx! + dx}: ${r.seen.join(' > ')}`;
            expect(r.action, at).toBe('techInPlace');
            expect(r.ground, at).toMatchObject({ kind: 'entity', index: r.raft });
          }
          if (ry! < 0) continue;
          const floor = SEEDS.map((seed) => {
            const m = createMatch({
              seed: 3,
              stage: 'battlefield',
              stocks: 3,
              ports: [{ fighter }, { fighter: 'raftwars' }],
            });
            tumbleOnto(m, rx! + dx, 0);
            return getUp(m, 9, seed).action;
          });
          expect(floor.filter((a) => /^tech/.test(a)).length, `${fighter} at x ${rx! + dx}`).toBe(
            SEEDS.length,
          );
          expect(new Set(floor).size, `${fighter} at x ${rx! + dx}`).toBe(2);
        }
      }
    }
  });

  it('tech roll onto an entity platform only where the roll fits on it', () => {
    // An 80-wide deck from x -40 to 40, high over Battlefield's top platform (-17 to 17): from its middle a roll fits
    // either way, which on the top platform it wouldn't, and from 25 in from either end only a roll inward fits.
    for (const [x, fits] of [
      [0, [-1, 0, 1]],
      [25, [-1, 0]],
      [-25, [0, 1]],
    ] as const) {
      const runs = SEEDS.map((seed) => {
        const m = duel();
        const deck = spawnEntity(m, { kind: 'test/wideDeck', owner: -1, pos: { x: 0, y: 70 } });
        tumbleOnto(m, x, entityPlatform(deck)!.y);
        return getUp(m, 9, seed);
      });
      expectWholeRolls(runs);
      const techs = runs.filter((r) => /^tech/.test(r.action));
      expect(techs.length, `from x ${x}`).toBeGreaterThanOrEqual(6);
      expect(techs.every((r) => r.ground?.kind === 'entity')).toBe(true);
      expect([...new Set(techs.map((r) => r.dir))].sort(), `from x ${x}`).toEqual(fits);
    }
  });

  it("roll up from lying on Truck Convoy's moving deck past the stage's end only where the roll fits", () => {
    // From frame 600 the left hauler's deck (38 wide) catches up from 36 units back, from -97..-59 toward
    // -61..-23, carrying whoever is on it. Rolls are measured along the deck.
    const base = duel('wheely-trucks');
    for (let i = 0; i < 600; i++) stepMatch(base, [neutralInput(), neutralInput()]);
    const deck = posedStage(base).geo.platforms[0]!;
    expect([deck.x1, deck.x2]).toEqual([-97, -59]);
    const spots: [number, number[]][] = [
      [3, [1]],
      [19, []],
      [35, [-1]],
    ];
    for (const [at, fits] of spots) {
      const runs = SEEDS.map((seed) => {
        const m = structuredClone(base);
        lieDown(m, deck.x1 + at, { kind: 'platform', index: 0 }, 70);
        return getUp(m, 9, seed);
      });
      expectWholeRolls(runs);
      const dirs = new Set(runs.filter((r) => r.action === 'getupRoll').map((r) => r.dir));
      expect([...dirs].sort(), `${at} along the deck`).toEqual(fits);
    }
  });
});
