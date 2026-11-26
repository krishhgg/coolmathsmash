import { describe, expect, it } from 'vitest';
import { hashState } from '../engine/hash';
import { getFighter } from '../fighters/registry';
import { Btn, neutralInput, type InputFrame } from '../input/types';
import { DOWN_AUTO_GETUP } from '../sim/constants';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { CPU_LEVELS, cpuLevel, createCpu } from './index';
import { press } from './inputs';
import { knowledge } from './knowledge';
import { run, soloMatch } from './look';
import { findAttacks } from './options';
import { stageInfo } from './stage';

const ALL_BUTTONS = Object.values(Btn).reduce((a, b) => a | b, 0);

function match(): MatchState {
  return createMatch({
    seed: 3,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }],
  });
}

/** Play `frames` frames of CPU against CPU, returning every input sent. */
function play(m: MatchState, levels: [number, number], frames: number, seed = 1): InputFrame[][] {
  const cpus = levels.map((level, port) => createCpu({ port, level, seed: seed + port }));
  const log: InputFrame[][] = [];
  for (let i = 0; i < frames; i++) {
    const inputs = cpus.map((c) => c.input(m));
    log.push(inputs);
    stepMatch(m, inputs);
  }
  return log;
}

describe('CPU players', () => {
  it('send controller inputs a person could send', () => {
    const log = play(match(), [9, 5], 900);
    for (const frame of log) {
      for (const i of frame) {
        for (const v of [i.x, i.y, i.cx, i.cy]) {
          expect(Number.isInteger(v)).toBe(true);
          expect(Math.abs(v)).toBeLessThanOrEqual(100);
        }
        expect(i.buttons & ~ALL_BUTTONS).toBe(0);
      }
    }
    expect(log.some((f) => f[0]!.buttons !== 0)).toBe(true);
  });

  it('never write to the match they read', () => {
    const m = match();
    const cpus = [createCpu({ port: 0, level: 9, seed: 1 }), createCpu({ port: 1, level: 4, seed: 2 })];
    for (let i = 0; i < 600; i++) {
      const before = hashState(m);
      const inputs = cpus.map((c) => c.input(m));
      expect(hashState(m)).toBe(before);
      stepMatch(m, inputs);
    }
  });

  it('play the same match for the same seed', () => {
    const a = match();
    const b = match();
    const la = play(a, [8, 6], 1200, 7);
    const lb = play(b, [8, 6], 1200, 7);
    expect(lb).toEqual(la);
    expect(hashState(b)).toBe(hashState(a));
  });
});

describe('CPU levels', () => {
  it('run 1-9, reacting faster and erring less as they rise', () => {
    expect([...CPU_LEVELS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let l = 2; l <= 9; l++) {
      const lo = cpuLevel(l - 1);
      const hi = cpuLevel(l);
      expect(hi.reaction).toBeLessThan(lo.reaction);
      expect(hi.spacingError).toBeLessThanOrEqual(lo.spacingError);
      expect(hi.defense).toBeGreaterThan(lo.defense);
      expect(hi.recoveryError).toBeLessThanOrEqual(lo.recoveryError);
    }
    expect(cpuLevel(0).level).toBe(1);
    expect(cpuLevel(12).level).toBe(9);
  });
});

describe('fighter knowledge', () => {
  it("reads Fireboy's frame data by trying his moves", () => {
    const k = knowledge('fireboy', 'battlefield');
    const jab = getFighter('fireboy').moves!.jab!;
    expect(k.ground.jab!.first).toBe(jab.hits[0]!.frames[0] - 1);
    expect(k.ground.fsmash!.first).toBe(14);
    expect(k.ground.fsmash!.reach.x2).toBeCloseTo(17.5);
    expect(k.ground.dashAttack!.start).toBe('dash');
    expect(k.air.nair!.first).toBe(2);
    expect(k.air.bair!.reach.x1).toBeLessThan(0);
    expect(k.air.upB!.helpless).toBe(true);
  });
});

describe('CPU knockdowns', () => {
  /** Drop port 0 into the middle of the stage in tumble and run its CPU until it is back on its feet. */
  function knockdown(level: number, seed: number): { seen: string[]; down: number } {
    const m = match();
    const f = m.fighters[0]!;
    Object.assign(f, {
      pos: { x: 10, y: 25 },
      prevPos: { x: 10, y: 25 },
      vel: { x: 0, y: -1 },
      kb: { x: 0, y: -1 },
      ground: null,
      action: 'tumble',
      actionFrame: 0,
      hitstun: 40,
    });
    m.fighters[1]!.pos = { x: -60, y: 0 };
    const cpu = createCpu({ port: 0, level, seed });
    const seen: string[] = [];
    let down = 0;
    for (let i = 0; i < 400; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      if (seen.at(-1) !== f.action) seen.push(f.action);
      if (f.action === 'down') down++;
      if (seen.length > 2 && (f.action === 'idle' || f.action === 'attack')) break;
    }
    return { seen, down };
  }

  it('tech at level 9', () => {
    const teched = [1, 2, 3, 4, 5].filter((seed) => /^tech/.test(knockdown(9, seed).seen[1] ?? ''));
    expect(teched.length).toBeGreaterThanOrEqual(4);
  });

  it('miss techs at level 1, then get up long before the automatic getup', () => {
    for (const seed of [1, 2, 3]) {
      const { seen, down } = knockdown(1, seed);
      expect(seen.slice(0, 3)).toEqual(['tumble', 'downBound', 'down']);
      expect(seen[3]).toMatch(/^getup|attack/);
      expect(down).toBeLessThan(DOWN_AUTO_GETUP / 2);
    }
  });
});

describe('CPU grabs', () => {
  it('grab a held shield and throw at level 9', () => {
    for (const seed of [1, 2, 3]) {
      const m = match();
      const cpu = createCpu({ port: 1, level: 9, seed });
      const seen = new Set<string>();
      for (let i = 0; i < 300 && !seen.has('grabThrow'); i++) {
        stepMatch(m, [{ ...neutralInput(), buttons: Btn.Shield }, cpu.input(m)]);
        seen.add(m.fighters[1]!.action);
      }
      expect(seen.has('grabHold')).toBe(true);
      expect(seen.has('grabThrow')).toBe(true);
    }
  });

  it("don't plan a grab that lands during regrab immunity", () => {
    const m = match();
    for (let i = 0; i < 120; i++) stepMatch(m, [{ ...neutralInput(), buttons: Btn.Shield }, neutralInput()]);
    const [opp, me] = m.fighters;
    Object.assign(me!, { pos: { x: opp!.pos.x + 10, y: opp!.pos.y }, facing: -1 });
    const path = run(soloMatch(m, opp!), 45, () => press({ buttons: Btn.Shield }));
    const self = {
      f: me!,
      k: knowledge('fireboy', 'battlefield'),
      info: stageInfo(m),
      groundDelay: 0,
      jumpDelay: 0,
    };
    const grabs = (grabbableIn: number) =>
      findAttacks(self, { path, errX: 0, grabbableIn }).filter((a) => a.box.grab);
    expect(grabs(0).length).toBeGreaterThan(0);
    expect(grabs(60)).toEqual([]);
  });

  it('throw a mashing opponent before it escapes', () => {
    for (const seed of [1, 2, 3, 4]) {
      const m = match();
      for (let i = 0; i < 120; i++) stepMatch(m, [neutralInput(), neutralInput()]);
      Object.assign(m.fighters[0]!, { pos: { x: 0, y: 0 }, facing: 1 });
      Object.assign(m.fighters[1]!, { pos: { x: 9, y: 0 }, facing: -1, damage: 10 });
      const [holder, victim] = [
        createCpu({ port: 0, level: 9, seed }),
        createCpu({ port: 1, level: 9, seed }),
      ];
      const actions = new Set<string>();
      let shortened = false;
      for (let i = 0; i < 300 && !actions.has('grabThrow') && !actions.has('grabRelease'); i++) {
        if (m.fighters[1]!.action === 'grabbed' && !shortened) {
          m.fighters[1]!.grabTimer = 60;
          shortened = true;
        }
        const own = [holder.input(m), victim.input(m)];
        const caught = m.fighters[1]!.action === 'grabbed';
        stepMatch(m, [
          i === 0 ? { ...neutralInput(), buttons: Btn.Grab } : caught ? own[0]! : neutralInput(),
          caught ? own[1]! : neutralInput(),
        ]);
        actions.add(m.fighters[0]!.action);
      }
      expect(actions.has('grabThrow')).toBe(true);
    }
  });

  it('mash out of a grab faster as the level rises', () => {
    const held = (level: number) => {
      const m = match();
      for (let i = 0; i < 120; i++) stepMatch(m, [neutralInput(), neutralInput()]);
      const [a, v] = m.fighters;
      Object.assign(a!, { pos: { x: 0, y: 0 }, facing: 1, damage: 0 });
      Object.assign(v!, { pos: { x: 9, y: 0 }, facing: -1, damage: 60 });
      const cpu = createCpu({ port: 1, level, seed: 4 });
      let frames = 0;
      for (let i = 0; i < 400; i++) {
        const own = cpu.input(m);
        const grab = i === 0 ? { ...neutralInput(), buttons: Btn.Grab } : neutralInput();
        stepMatch(m, [grab, v!.action === 'grabbed' ? own : neutralInput()]);
        if (v!.action === 'grabbed') frames++;
        else if (frames > 0) break;
      }
      return frames;
    };
    const [l1, l5, l9] = [held(1), held(5), held(9)];
    expect(l1).toBeGreaterThan(0);
    expect(l5).toBeLessThan(l1);
    expect(l9).toBeLessThan(l5);
  });
});

describe('CPU recovery', () => {
  const spots: [number, number][] = [
    [-110, -10],
    [118, 25],
    [-98, -40],
    [104, -28],
    [0, -20],
  ];
  it.each(spots)('a level 7 CPU gets back to the stage from (%d, %d)', (x, y) => {
    const m = match();
    const f = m.fighters[0]!;
    Object.assign(f, {
      pos: { x, y },
      prevPos: { x, y },
      vel: { x: 0, y: 0 },
      ground: null,
      action: 'fall',
      actionFrame: 1,
      jumpsUsed: 1,
      airDodgeUsed: false,
      facing: x < 0 ? 1 : -1,
    });
    m.fighters[1]!.pos = { x: 0, y: 0 };
    const cpu = createCpu({ port: 0, level: 7, seed: 5 });
    let safe = false;
    for (let i = 0; i < 420 && !safe; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      safe = f.ground !== null || f.action === 'ledgeHang';
    }
    expect(f.stocks).toBe(3);
    expect(safe).toBe(true);
  });

  it('gets up from the ledge', () => {
    const m = match();
    const cpu = createCpu({ port: 0, level: 9, seed: 2 });
    const f = m.fighters[0]!;
    Object.assign(f, {
      pos: { x: 90, y: -12 },
      prevPos: { x: 90, y: -12 },
      ground: null,
      action: 'fall',
      facing: -1,
    });
    let hung = false;
    for (let i = 0; i < 400; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      hung ||= f.action === 'ledgeHang';
      if (hung && f.ground !== null) break;
    }
    expect(hung).toBe(true);
    expect(f.ground).not.toBeNull();
    expect(f.stocks).toBe(3);
  });
});
