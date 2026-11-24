import { describe, expect, it } from 'vitest';
import { hashState } from '../engine/hash';
import { Btn, neutralInput, type InputFrame } from '../input/types';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { CPU_LEVELS, cpuLevel, createCpu } from './index';
import { knowledge } from './knowledge';

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
    expect(k.ground.jab!.first).toBe(2);
    expect(k.ground.fsmash!.first).toBe(14);
    expect(k.ground.fsmash!.reach.x2).toBeCloseTo(17.5);
    expect(k.ground.dashAttack!.start).toBe('dash');
    expect(k.air.nair!.first).toBe(2);
    expect(k.air.bair!.reach.x1).toBeLessThan(0);
    expect(k.air.upB!.helpless).toBe(true);
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
