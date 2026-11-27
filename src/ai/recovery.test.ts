import { describe, expect, it, vi } from 'vitest';
import { Btn, neutralInput, type InputFrame } from '../input/types';
import { entityPlatform, spawnEntity } from '../sim/entities/entities';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { compiledStage } from '../sim/step';
import { Cpu } from './cpu';
import { createCpu } from './index';
import { STICK } from './inputs';
import { knowledge } from './knowledge';
import { recoveryDriver, type RecoveryParams } from './recovery';
import { stageInfo } from './stage';
import {
  canRecover,
  cpuRecovers,
  drill,
  registerWide150,
  spots,
  WIDE_150,
  type Spot,
} from './testing/recovery';

registerWide150();

const STAGES = ['battlefield', 'snail-bob-construction', WIDE_150.id];
const possible = new Map<string, boolean>();

/** Whether any drift, double jump and up special timing gets back from the spot (cached per stage and spot). */
function recoverable(stage: string, spot: Spot): boolean {
  const key = `${stage} ${spot.x} ${spot.y}`;
  let ok = possible.get(key);
  if (ok === undefined) {
    ok = canRecover(stage, spot);
    possible.set(key, ok);
  }
  return ok;
}

describe('CPU recovery from under and beside the stage', () => {
  it.each(STAGES.flatMap((stage) => [4, 7, 9].map((level) => [stage, level] as const)))(
    'on %s, a level %d CPU gets back from every spot it physically can',
    (stage, level) => {
      const all = spots(stage);
      const lost: string[] = [];
      let back = 0;
      for (const spot of all) {
        const r = cpuRecovers(stage, spot, level, 5);
        if (r === 'safe') back++;
        else if (recoverable(stage, spot)) lost.push(`${spot.where} (${spot.x}, ${spot.y}): ${r}`);
      }
      expect(lost).toEqual([]);
      expect(back / all.length).toBeGreaterThan(0.9);
    },
    60_000,
  );

  it.each(STAGES)('on %s, drifts out from 13 under the middle before the up special', (stage) => {
    const start = spots(stage).find((s) => s.where === 'under' && s.x === 0)!;
    const m = drill(stage, start.x, start.y);
    const f = m.fighters[0]!;
    const ledge = Math.max(...compiledStage(stage).geo.ledges.map((l) => Math.abs(l.x)));
    const cpu = createCpu({ port: 0, level: 7, seed: 5 });
    let upAt: number | null = null;
    for (let i = 0; i < 600 && f.ground === null && f.action !== 'ledgeHang' && f.stocks === 3; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      if (upAt === null && f.move === 'upB') upAt = f.pos.x;
    }
    expect(f.stocks).toBe(3);
    expect(upAt).not.toBeNull();
    expect(Math.abs(upAt!)).toBeGreaterThan(ledge / 2);
  });
});

describe('CPU on a Duck Raft off the stage', () => {
  /**
   * Port 0, a `fighter`, standing on a Duck Raft centred at (x, y): its own, or that of port 1, a Raft Wars standing
   * in the middle of Battlefield.
   */
  function onRaft(fighter: string, own: boolean, x: number, y: number): { m: MatchState; raft: number } {
    const ports = [{ fighter }, { fighter: own ? 'fireboy' : 'raftwars' }];
    const m = createMatch({ seed: 1, stage: 'battlefield', stocks: 3, ports });
    const raft = spawnEntity(m, { kind: 'raftwars/duckRaft', owner: own ? 0 : 1, pos: { x, y } });
    const deck = entityPlatform(raft)!;
    Object.assign(m.fighters[0]!, {
      pos: { x, y: deck.y },
      prevPos: { x, y: deck.y },
      vel: { x: 0, y: 0 },
      kb: { x: 0, y: 0 },
      ground: { kind: 'entity', index: raft.id, ...deck },
      action: 'idle',
      actionFrame: 1,
      facing: x > 0 ? -1 : 1,
    });
    Object.assign(m.fighters[1]!, { pos: { x: 0, y: 0 }, prevPos: { x: 0, y: 0 } });
    return { m, raft: raft.id };
  }

  it("gets back to the stage from its own raft or an opponent's off either side, while the raft is still out", () => {
    // Beside the stage from 9 to 89 units under the ledge, and under the stage. Stood on, a raft lasts 75 frames, and
    // a CPU that waited that long fell from 89 under. Leaving at once, it jumps from the raft with its double jump and
    // up special still to come.
    const spots = [
      [95, -10],
      [105, -30],
      [100, -60],
      [100, -90],
      [48, -60],
    ];
    for (const [fighter, own] of [
      ['raftwars', true],
      ['fireboy', false],
    ] as const) {
      for (const [x, y] of spots) {
        for (const side of [1, -1]) {
          for (const seed of [1, 2, 3, 4]) {
            const { m, raft } = onRaft(fighter, own, side * x!, y!);
            const f = m.fighters[0]!;
            const cpu = createCpu({ port: 0, level: 9, seed });
            let stood = 0;
            let end = '';
            for (let i = 0; i < 400 && !end; i++) {
              stepMatch(m, [cpu.input(m), neutralInput()]);
              if (f.ground?.kind === 'entity') stood++;
              if (f.stocks < 3) end = 'KO';
              else if (f.action === 'ledgeCatch' || (f.ground !== null && f.ground.kind !== 'entity'))
                end = 'back';
            }
            const at = `${fighter} from (${side * x!}, ${y}), seed ${seed}`;
            expect(end, at).toBe('back');
            expect(stood, at).toBeLessThan(15);
            expect(
              m.entities.some((e) => e.id === raft && !e.dead),
              at,
            ).toBe(true);
          }
        }
      }
    }
  }, 60_000);

  it('plays on a raft over the stage as on any ground, and recovers from one off it', () => {
    const recover = vi.spyOn(Cpu.prototype as unknown as { recover(): InputFrame }, 'recover');
    for (const [x, y] of [
      [0, 12],
      [-60, 5],
      [70, 30],
    ]) {
      for (const seed of [1, 2, 3, 4]) {
        const { m } = onRaft('fireboy', false, x!, y!);
        const cpu = createCpu({ port: 0, level: 9, seed });
        for (let i = 0; i < 60; i++) stepMatch(m, [cpu.input(m), neutralInput()]);
      }
    }
    expect(recover).not.toHaveBeenCalled();
    const { m } = onRaft('fireboy', false, 100, -10);
    createCpu({ port: 0, level: 9, seed: 1 }).input(m);
    expect(recover).toHaveBeenCalledOnce();
    recover.mockRestore();
  }, 60_000);
});

/** A level 9 CPU from drill spot (x, y) on Battlefield with its double jump left: how it ended, and in what order it
 * double jumped (J) and used its up special (U). */
function recoveryOrder(fighter: string, x: number, y: number, seed: number): string {
  const m = drill('battlefield', x, y, fighter);
  const f = m.fighters[0]!;
  const cpu = createCpu({ port: 0, level: 9, seed });
  let order = '';
  for (let i = 0; i < 600; i++) {
    stepMatch(m, [cpu.input(m), neutralInput()]);
    if (f.action === 'doubleJump' && !order.includes('J')) order += 'J';
    if (f.move === 'upB' && !order.includes('U')) order += 'U';
    if (f.stocks < 3) return `ko ${order}`;
    if (f.ground !== null || f.action === 'ledgeHang') return `back ${order}`;
  }
  return `stuck ${order}`;
}

describe('recovery plans with a double jump and a special', () => {
  const none: RecoveryParams = {
    jumpAt: Infinity,
    special: null,
    specialAt: Infinity,
    below: 0,
    reach: Infinity,
    dodgeAt: Infinity,
  };

  /** The driver's first `n` inputs for Wheely falling 35 units beside Battlefield's right ledge and 50 under it. */
  const inputs = (p: RecoveryParams, n: number) => {
    const m = drill('battlefield', 115, -50, 'wheely');
    const drive = recoveryDriver(stageInfo(m), knowledge('wheely', 'battlefield'), p);
    return Array.from({ length: n }, (_, t) => {
      const i = drive(t, m.fighters[0]!);
      stepMatch(m, [i, neutralInput()]);
      return i.buttons;
    });
  };

  it('use the special on the frame it is due when the plan has no double jump', () => {
    expect(inputs({ ...none, special: 'upB', below: -24 }, 1)).toEqual([Btn.Special]);
  });

  it('double jump first when the plan has one, and use the special after it', () => {
    const buttons = inputs({ ...none, jumpAt: 1, special: 'upB', below: -24 }, 40);
    expect(buttons.slice(0, 2)).toEqual([0, Btn.Jump]);
    expect(buttons.indexOf(Btn.Special)).toBeGreaterThan(1);
  });

  // Before, a fighter that started this low used its special on the first frame, before the double jump: Ramp Jump and
  // the block's up special rose into the stage's side, and the CPU was KO'd from all four on every seed. Wheely can
  // also get back by drifting further out and Ramp Jumping without the double jump, and some seeds pick that.
  it.each([
    ['wheely', 115, -50, ['back JU', 'back U']],
    ['wheely', -115, -50, ['back JU', 'back U']],
    ['bloxorz', 115, -50, ['back JU']],
    ['bloxorz', -140, -50, ['back JU']],
  ] as const)(
    'a level 9 %s gets back from (%d, %d) on every seed',
    (fighter, x, y, ok) => {
      const ends = [1, 2, 3, 4, 5].map((seed) => recoveryOrder(fighter, x, y, seed));
      expect(ends.filter((e) => !(ok as readonly string[]).includes(e))).toEqual([]);
    },
    60_000,
  );

  // Plans with a jump left also try the special alone: from here Point Grapple used at once reaches the ledge.
  it('a level 9 Fluffy still grapples at once from under the stage, 48 units in, on every seed', () => {
    const ends = [1, 2, 3, 4, 5].map((seed) => recoveryOrder('fluffy', 48, -69, seed));
    expect(ends).toEqual(ends.map(() => 'back U'));
  }, 60_000);
});

describe('recoveries the planner missed, from spots the sim can get back from', () => {
  /** How a level 9 CPU's drill runs from a spot on Battlefield end, on seeds 1 to 4. */
  const ends = (fighter: string, spot: Spot) =>
    [1, 2, 3, 4].map((seed) => cpuRecovers('battlefield', spot, 9, seed, fighter));

  it('hold the stick straight up while the special plays in a plan that says so, and steer again once helpless', () => {
    const m = drill('battlefield', 140, -20, 'wheely');
    const f = m.fighters[0]!;
    const plan: RecoveryParams = {
      jumpAt: Infinity,
      special: 'upB',
      specialAt: 1,
      below: 0,
      reach: Infinity,
      dodgeAt: Infinity,
      holdUp: true,
    };
    const drive = recoveryDriver(stageInfo(m), knowledge('wheely', 'battlefield'), plan);
    const during: [number, number][] = [];
    const helpless: number[] = [];
    for (let t = 0; t < 80 && f.ground === null && f.action !== 'ledgeCatch'; t++) {
      const inMove = f.move === 'upB';
      const i = drive(t, f);
      if (inMove && f.action !== 'helpless') during.push([i.x, i.y]);
      if (f.action === 'helpless') helpless.push(i.x);
      stepMatch(m, [i, neutralInput()]);
    }
    expect(during.length).toBeGreaterThanOrEqual(10);
    expect(new Set(during.map(([x, y]) => `${x},${y}`))).toEqual(new Set([`0,${STICK.special}`]));
    expect(helpless.length).toBeGreaterThan(0);
    expect(helpless.every((x) => x !== 0)).toBe(true);
  });

  // Quick Grapple fires up from under the stage and reels Fluffy to the ledge if the line passes it. Steering toward
  // the ledge bends it up to 30 degrees, and it passed the ledge only in windows of about 3 frames that the planner's
  // timings missed; held straight up, two to five times as many timings get him back. From 90 under the middle he also
  // falls to 9 units above the bottom blast line before the line pulls him up, and the planner stopped simulating 10
  // above it. On #333's head a level 9 Fluffy was KO'd from all eight on every seed.
  it.each([
    [0, -53],
    [0, -90],
    [-24, -53],
    [24, -53],
    [-24, -70],
    [24, -70],
    [-48, -89],
    [48, -89],
  ])(
    'a level 9 Fluffy grapples back from under the stage at (%d, %d) on every seed',
    (x, y) => {
      expect(ends('fluffy', { x, y, where: 'under' })).toEqual(['safe', 'safe', 'safe', 'safe']);
    },
    60_000,
  );

  // 12 units beside the ledge and 50 under it, Ramp Jump used there rises into the stage's side. After drifting 8 or more
  // units further out it comes back up over the ledge. On #333's head a level 9 Wheely double jumped, air dodged and
  // was KO'd from both on every seed.
  it.each([
    [92, -50],
    [-92, -50],
  ])(
    'a level 9 Wheely drifts out, then Ramp Jumps back from (%d, %d) on every seed',
    (x, y) => {
      expect(ends('wheely', { x, y, where: 'beside' })).toEqual(['safe', 'safe', 'safe', 'safe']);
    },
    60_000,
  );
});

describe('recovering to a ledge an opponent holds', () => {
  /**
   * Fluffy falling at (x, y) beside Battlefield's left ledge with his double jump used, while Johnny hangs from that
   * ledge: how a level 9 CPU's run ends.
   */
  function pastHolder(x: number, y: number, seed: number): string {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'fluffy' }, { fighter: 'johnny' }],
    });
    for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    const f = m.fighters[0]!;
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
    Object.assign(f, {
      pos: { x, y },
      prevPos: { x, y: y + 0.5 },
      vel: { x: 0, y: -0.5 },
      ground: null,
      action: 'fall',
      actionFrame: 5,
      facing: 1,
      jumpsUsed: 2,
      airDodgeUsed: false,
    });
    const cpu = createCpu({ port: 0, level: 9, seed });
    for (let i = 0; i < 400; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      if (f.stocks < 3) return 'ko';
      if (f.ground !== null || f.action === 'ledgeHang') return 'back';
    }
    return 'stuck';
  }

  // Quick Grapple's line doesn't latch onto a ledge someone holds (tether.ts). The planner tried its plans with only
  // Fluffy in the copy of the match, so the held ledge looked free: he grappled, missed and fell. With Johnny in the
  // copy, the grapple fails there too, and Fluffy air dodges onto the stage, or to the ledge and trumps Johnny.
  it.each([
    [-92, -10],
    [-100, -20],
  ])(
    'a level 9 Fluffy with no jump left gets back from (%d, %d) on every seed while Johnny holds the ledge',
    (x, y) => {
      expect([1, 2, 3, 4].map((seed) => pastHolder(x, y, seed))).toEqual(['back', 'back', 'back', 'back']);
    },
    60_000,
  );
});

describe("recovering out of a gap in Run Tunnel's floor", () => {
  /** A level 9 CPU dropped into the gap between Run Tunnel's middle and right floors with its double jump used. */
  function outOfGap(fighter: string, x: number, y: number, seed: number): string {
    const m = drill('run-tunnel', x, y, fighter);
    const f = m.fighters[0]!;
    f.jumpsUsed = 2;
    const cpu = createCpu({ port: 0, level: 9, seed });
    for (let i = 0; i < 600; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      if (f.stocks < 3) return 'ko';
      if (f.ground !== null || f.action === 'ledgeHang')
        return f.ground ? `lands at x ${Math.round(f.pos.x)}` : 'ledge';
    }
    return 'stuck';
  }

  // The floor is three pieces with 16 unit gaps between them and ledges only at its outer ends (x 88). The planner
  // aimed for the nearest ledge, so from deep in a gap it steered out under the right floor toward x 88 and was KO'd.
  // It now also aims for the floor beside the gap: it rises in the gap with its up special and lands on a floor.
  it.each([
    ['fireboy', 40, -40],
    ['wheely', 40, -5],
    ['bloxorz', 44, -30],
  ] as const)(
    'a level 9 %s with no double jump rises out of the gap from (%d, %d) and lands on every seed',
    (fighter, x, y) => {
      const ends = [1, 2, 3, 4].map((seed) => outOfGap(fighter, x, y, seed));
      expect(ends.filter((e) => !e.startsWith('lands'))).toEqual([]);
    },
    60_000,
  );
});
