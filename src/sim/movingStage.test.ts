import { describe, expect, it } from 'vitest';
import { hashState } from '../engine/hash';
import { neutralInput, type InputFrame } from '../input/types';
import { registerStage, STAGES } from '../stages/registry';
import { createMatch, stepMatch, type MatchState } from './match';
import { motionOffset, posedStage, scheduledOn } from './movingStage';
import type { SimEvent } from './events';
import type { FighterState } from './fighter';
import type { StageGeometry } from './stage';
import { compiledStage } from './step';
import { marioReference as mario } from './testing/reference';
import { input, placeInAir, run, until } from './testing/sim';

const S = mario.stats;

function stageMatch(stage: string, players = 1): MatchState {
  return createMatch({
    seed: 1,
    stage,
    stocks: 3,
    ports: Array.from({ length: players }, () => ({ fighter: mario.id })),
  });
}

/** Test-only geometry: a floor-less arena with wide blast zones. */
function arena(id: string, solids: StageGeometry['solids']): StageGeometry {
  return {
    id,
    name: id,
    solids,
    platforms: [],
    ledges: [],
    blastZones: { left: -400, right: 400, top: 300, bottom: -300 },
    camera: { left: -170, right: 170, top: 130, bottom: -80 },
    spawns: [[0, 30, 1]],
    respawns: [[0, 80]],
  };
}

const rect = (x1: number, y1: number, x2: number, y2: number): [number, number][] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];

/** Is the middle of the fighter's collision box inside a solid that is there this frame? */
function embedded(m: MatchState, f: FighterState): boolean {
  const stage = posedStage(m);
  const px = f.pos.x;
  const py = f.pos.y + S.height * 0.375;
  return stage.geo.solids.some((s, i) => {
    if (!stage.present.solids[i]) return false;
    const xs = s.points.map((p) => p[0]);
    const ys = s.points.map((p) => p[1]);
    return px > Math.min(...xs) && px < Math.max(...xs) && py > Math.min(...ys) && py < Math.max(...ys);
  });
}

const groundSolid = (m: MatchState, f: FighterState) =>
  f.ground?.kind === 'solid' ? compiledStage(m.config.stage).edges[f.ground.index]!.solid : -1;

describe('stage motion', () => {
  it('interpolates keyframes and loops from the last key back to the first', () => {
    const path = {
      period: 200,
      keys: [[0, 0, 0] as [number, number, number], [100, 10, -20] as [number, number, number]],
    };
    expect(motionOffset(path, 0)).toEqual([0, 0]);
    expect(motionOffset(path, 50)).toEqual([5, -10]);
    expect(motionOffset(path, 100)).toEqual([10, -20]);
    expect(motionOffset(path, 150)).toEqual([5, -10]);
    expect(motionOffset(path, 250)).toEqual([5, -10]);
    expect(motionOffset({ ...path, ease: true }, 25)).toEqual([1.5625, -3.125]);
    const late = {
      period: 200,
      keys: [[50, 0, 0] as [number, number, number], [150, 10, 0] as [number, number, number]],
    };
    expect(motionOffset(late, 0)).toEqual([5, 0]);
    expect(motionOffset({ period: 60, keys: [[10, 3, 4]] }, 37)).toEqual([3, 4]);
    expect(motionOffset((f) => [f, -f], 7)).toEqual([7, -7]);
  });

  it('switches pieces off on their schedule', () => {
    const blink = { period: 300, off: [[200, 299]] as [number, number][] };
    expect([0, 199, 200, 299, 300, 499, 500].map((f) => scheduledOn(blink, f))).toEqual([
      true,
      true,
      false,
      false,
      true,
      true,
      false,
    ]);
    expect(scheduledOn((f) => f % 2 === 0, 3)).toBe(false);
  });

  it("every stage's keyframes and schedules fit inside their period", () => {
    for (const geo of Object.values(STAGES)) {
      for (const piece of [...geo.solids, ...geo.platforms]) {
        const { motion, schedule } = piece;
        if (motion && typeof motion !== 'function') {
          expect(motion.keys.length, geo.id).toBeGreaterThan(0);
          motion.keys.forEach(([f], i) => {
            expect(f, geo.id).toBeGreaterThanOrEqual(i === 0 ? 0 : motion.keys[i - 1]![0] + 1);
            expect(f, geo.id).toBeLessThan(motion.period);
          });
        }
        if (schedule && typeof schedule !== 'function') {
          for (const [a, b] of schedule.off) {
            expect(a, geo.id).toBeGreaterThanOrEqual(0);
            expect(b, geo.id).toBeGreaterThanOrEqual(a);
            expect(b, geo.id).toBeLessThan(schedule.period);
          }
        }
      }
    }
  });

  it('leaves a stage without moving pieces untouched', () => {
    const m = stageMatch('battlefield');
    run(m, 30);
    expect(posedStage(m)).toBe(compiledStage('battlefield'));
    expect(m.stage.solids).toEqual([{ x: 0, y: 0, dx: 0, dy: 0, on: true }]);
  });
});

describe('riding moving pieces', () => {
  it('carries a fighter standing on a moving platform through a whole loop', () => {
    const m = stageMatch('testbed');
    const f = placeInAir(m, -5, 34);
    until(m, (g) => g.ground !== null);
    expect(f.ground).toEqual({ kind: 'platform', index: 0 });
    const offset = () => f.pos.x - m.stage.platforms[0]!.x;
    const start = offset();
    let travel = 0;
    for (let i = 0; i < 480; i++) {
      run(m, 1);
      expect(f.ground).toEqual({ kind: 'platform', index: 0 });
      expect(offset()).toBeCloseTo(start, 9);
      expect(f.pos.y).toBeCloseTo(30, 9);
      travel = Math.max(travel, Math.abs(m.stage.platforms[0]!.x + 5));
    }
    expect(travel).toBeCloseTo(55, 6);
  });

  it('keeps a fighter on an elevator the whole way up and down', () => {
    const m = stageMatch('testbed');
    const f = placeInAir(m, 120, -35);
    until(m, (g) => g.ground !== null);
    let top = -Infinity;
    for (let i = 0; i < 420; i++) {
      run(m, 1);
      expect(groundSolid(m, f)).toBe(1);
      expect(f.pos.y).toBeCloseTo(m.stage.solids[1]!.y, 9);
      top = Math.max(top, f.pos.y);
    }
    expect(top).toBeCloseTo(30, 6);
  });

  it('moves a ledge with its solid: the hang follows it and the climb ends on top', () => {
    const m = stageMatch('testbed');
    run(m, 5);
    const f = m.fighters[0]!;
    const hang = () => ({ x: 100 - (S.width / 2 + 0.5), y: m.stage.solids[1]!.y - S.height * 0.85 });
    Object.assign(f, { ledge: 2, action: 'ledgeHang', actionFrame: 1, ground: null, facing: 1, pos: hang() });
    for (let i = 0; i < 250; i++) {
      run(m, 1);
      expect(f.action).toBe('ledgeHang');
      expect(f.pos.x).toBeCloseTo(hang().x, 9);
      expect(f.pos.y).toBeCloseTo(hang().y, 9);
    }
    run(m, 1, { x: 100 });
    expect(f.action).toBe('ledgeClimb');
    until(m, (g) => g.action === 'idle');
    expect(groundSolid(m, f)).toBe(1);
    expect(f.pos.y).toBeCloseTo(m.stage.solids[1]!.y, 9);
  });

  it('drops a fighter whose platform vanishes, and lets fighters fall through it while it is gone', () => {
    const m = stageMatch('testbed');
    const f = placeInAir(m, 0, 62);
    until(m, (g) => g.ground !== null);
    expect(f.ground).toEqual({ kind: 'platform', index: 1 });
    while (m.frame < 199) run(m, 1);
    expect(f.ground).toEqual({ kind: 'platform', index: 1 });
    run(m, 1);
    expect(m.stage.platforms[1]!.on).toBe(false);
    expect(f.ground).toBeNull();
    expect(f.action).toBe('fall');
    run(m, 20);
    placeInAir(m, 0, 64);
    until(m, (g) => g.pos.y < 50);
    expect(m.stage.platforms[1]!.on).toBe(false);
  });

  /** Port `holder` grabs the other fighter on the testbed's blinking platform, one frame before it vanishes. */
  function grabOnBlinker(holder: number) {
    const m = createMatch({
      seed: 1,
      stage: 'testbed',
      stocks: 3,
      ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }],
    });
    const a = m.fighters[holder]!;
    const v = m.fighters[1 - holder]!;
    Object.assign(a, { pos: { x: -6, y: 58.001 }, prevPos: { x: -6, y: 58.001 }, facing: 1 });
    Object.assign(v, { pos: { x: 6, y: 58.001 }, prevPos: { x: 6, y: 58.001 }, facing: -1 });
    const step = (grab = false) => {
      const inputs = [neutralInput(), neutralInput()];
      if (grab) inputs[holder] = input({ buttons: ['grab'] });
      stepMatch(m, inputs);
    };
    while (m.frame < 185) step();
    step(true);
    while (m.frame < 199) step();
    expect([a.action, v.action, a.grabPartner, v.grabPartner]).toEqual([
      'grabHold',
      'grabbed',
      v.port,
      a.port,
    ]);
    return { m, a, v, step };
  }

  it('ends a grab when its platform vanishes, whichever port holds: a grab release, then both fall', () => {
    for (const holder of [0, 1]) {
      const { m, a, v, step } = grabOnBlinker(holder);
      step();
      expect(m.stage.platforms[1]!.on).toBe(false);
      expect(m.events.filter((e) => e.type === 'grabRelease')).toEqual([
        { type: 'grabRelease', holder: a.port, held: v.port },
      ]);
      expect([a.grabPartner, v.grabPartner]).toEqual([-1, -1]);
      expect([a.ground, v.ground]).toEqual([null, null]);
      expect([a.action, v.action]).toEqual(['fall', 'fall']);
      expect(v.grabbableFrom).toBeGreaterThan(m.frame);
    }
  });

  it("lets go of a partner KO'd during the grab without bringing it back", () => {
    for (const gone of ['held', 'holder'] as const) {
      const { m, a, v, step } = grabOnBlinker(0);
      const ko = gone === 'held' ? v : a;
      const other = gone === 'held' ? a : v;
      Object.assign(ko, { action: 'ko', ground: null, pos: { x: 300, y: 58 }, prevPos: { x: 300, y: 58 } });
      ko.respawnTimer = 999;
      const events: SimEvent[] = [];
      for (let i = 0; i < 10; i++) {
        step();
        events.push(...m.events);
      }
      expect(events.filter((e) => e.type === 'grabRelease')).toEqual(
        gone === 'held' ? [] : [{ type: 'grabRelease', holder: -1, held: v.port }],
      );
      expect(events.filter((e) => e.type === 'ko')).toEqual([]);
      expect([ko.action, ko.stocks]).toEqual(['ko', 3]);
      expect(other.grabPartner).toBe(-1);
      expect(other.ground).toBeNull();
    }
  });
});

describe('collision with moving solids', () => {
  registerStage(
    arena('test-fast-lift', [
      {
        points: rect(-10, -6, 10, 0),
        motion: {
          period: 600,
          keys: [
            [0, 0, -100],
            [10, 0, 60],
            [599, 0, 60],
          ],
        },
      },
    ]),
  );
  registerStage(
    arena('test-fast-wall', [
      {
        points: rect(-5, 0, 5, 40),
        motion: {
          period: 600,
          keys: [
            [0, -150, 0],
            [20, 150, 0],
            [599, 150, 0],
          ],
        },
      },
    ]),
  );
  registerStage(
    arena('test-diagonal', [
      {
        points: rect(-30, -30, -20, 10),
        motion: {
          period: 600,
          keys: [
            [0, 0, 0],
            [1, 50, 50],
            [599, 50, 50],
          ],
        },
      },
    ]),
  );
  registerStage({
    ...arena('test-vanishing-ledge', [
      { points: rect(-20, -10, 20, 0), schedule: { period: 600, off: [[20, 599]] } },
    ]),
    ledges: [{ x: -20, y: 0, side: -1 }],
  });
  registerStage(
    arena('test-sweeper', [
      { points: rect(-60, -10, 60, 0) },
      {
        points: rect(-80, 3, -70, 30),
        motion: {
          period: 600,
          keys: [
            [0, 0, 0],
            [200, 160, 0],
            [599, 160, 0],
          ],
        },
      },
    ]),
  );

  it('catches a fighter with a floor rising 16 units a frame, faster than the fighter is tall', () => {
    const m = stageMatch('test-fast-lift');
    const f = m.fighters[0]!;
    for (let i = 0; i < 60; i++) {
      run(m, 1);
      expect(embedded(m, f)).toBe(false);
    }
    expect(groundSolid(m, f)).toBe(0);
    expect(f.pos.y).toBeCloseTo(60, 9);
  });

  it('shoves an airborne fighter with a wall moving 15 units a frame instead of passing through it', () => {
    const m = stageMatch('test-fast-wall');
    const f = m.fighters[0]!;
    for (let i = 0; i < 20; i++) {
      run(m, 1);
      expect(embedded(m, f)).toBe(false);
    }
    expect(f.pos.x).toBeCloseTo(155 + S.width / 2, 2);
  });

  it('shoves a fighter that a solid passes diagonally, 50 units in one frame', () => {
    const m = stageMatch('test-diagonal');
    const f = placeInAir(m, 0, 0.5);
    run(m, 1);
    expect(embedded(m, f)).toBe(false);
    expect(f.pos.x).toBeGreaterThan(15);
  });

  it('keeps a pending launch when a rising floor catches a fighter frozen in hitlag', () => {
    const m = stageMatch('test-fast-lift');
    const f = m.fighters[0]!;
    Object.assign(f, {
      hitlag: 14,
      launch: { kb: 100, angle: 90, dir: 1, setKnockback: false },
      action: 'tumble',
      actionFrame: 0,
    });
    const actions = new Set<string>();
    while (f.hitlag > 0) {
      run(m, 1);
      actions.add(f.action);
    }
    expect(groundSolid(m, f)).toBe(0);
    expect([...actions]).toEqual(['tumble']);
    run(m, 1);
    expect(f.action).toBe('tumble');
    expect(f.ground).toBeNull();
    expect(f.kb.y).toBeGreaterThan(2);
  });

  it('lets a fighter hanging from a vanishing ledge go, unless a launch is waiting on hitlag', () => {
    const hang = (launch: boolean) => {
      const m = stageMatch('test-vanishing-ledge');
      const f = m.fighters[0]!;
      Object.assign(f, {
        ledge: 0,
        action: launch ? 'tumble' : 'ledgeHang',
        actionFrame: 1,
        ground: null,
        facing: 1,
        pos: { x: -20 - (S.width / 2 + 0.5), y: -S.height * 0.85 },
        ...(launch ? { hitlag: 30, launch: { kb: 100, angle: 45, dir: 1, setKnockback: false } } : {}),
      });
      while (m.frame < 20) run(m, 1);
      return f;
    };
    const free = hang(false);
    expect(free.ledge).toBe(-1);
    expect(free.action).toBe('fall');
    const hit = hang(true);
    expect(hit.action).toBe('tumble');
    expect(hit.launch).not.toBeNull();
  });

  it('pushes a grounded fighter along the floor, then off its end', () => {
    const m = stageMatch('test-sweeper');
    const f = m.fighters[0]!;
    until(m, (g) => g.action === 'idle');
    let pushed = false;
    for (let i = 0; m.frame < 200 && i < 200; i++) {
      run(m, 1);
      expect(embedded(m, f)).toBe(false);
      const face = -70 + m.stage.solids[1]!.x;
      if (face > -S.width / 2) pushed = true;
      if (pushed && f.pos.x <= 60) {
        expect(f.ground).not.toBeNull();
        expect(f.pos.y).toBeCloseTo(0, 9);
        expect(f.pos.x).toBeCloseTo(face + S.width / 2, 2);
      }
    }
    expect(pushed).toBe(true);
    expect(f.ground).toBeNull();
    expect(f.action).toBe('fall');
  });

  it('squeezes a fighter out on top of a crusher instead of into the floor (testbed)', () => {
    const m = stageMatch('testbed');
    const f = m.fighters[0]!;
    f.pos.x = -50;
    for (let i = 0; i < 200; i++) {
      run(m, 1);
      expect(embedded(m, f)).toBe(false);
      expect(f.pos.y).toBeGreaterThan(-0.01);
    }
    expect(groundSolid(m, f)).toBe(2);
    expect(f.pos.y).toBeCloseTo(15, 9);
    while (m.frame < 300) run(m, 1);
    expect(groundSolid(m, f)).toBe(2);
    expect(f.pos.y).toBeCloseTo(60, 9);
  });
});

describe('determinism on moving stages', () => {
  const script = (frame: number): InputFrame[] => [
    input(frame % 120 < 50 ? { x: 100 } : frame % 120 < 60 ? { buttons: ['jump'] } : { x: -60 }),
    input(frame % 90 < 30 ? { x: -100 } : frame % 90 < 40 ? { buttons: ['jump'] } : {}),
  ];

  it('a cloned match continues exactly like the original', () => {
    const m = stageMatch('testbed', 2);
    for (let i = 0; i < 300; i++) stepMatch(m, script(m.frame));
    const copy = structuredClone(m);
    for (let i = 0; i < 600; i++) {
      stepMatch(m, script(m.frame));
      stepMatch(copy, script(copy.frame));
    }
    expect(hashState(copy)).toBe(hashState(m));
    expect(m.fighters.some((f) => f.pos.x !== 0)).toBe(true);
  });

  it('two runs of the same inputs agree frame by frame', () => {
    const a = stageMatch('testbed', 2);
    const b = stageMatch('testbed', 2);
    for (let i = 0; i < 900; i++) {
      stepMatch(a, script(a.frame));
      stepMatch(b, i % 2 ? script(b.frame) : [...script(b.frame).map((x) => ({ ...x }))]);
      if (i % 150 === 0) expect(hashState(b)).toBe(hashState(a));
    }
    expect(hashState(b)).toBe(hashState(a));
    expect(neutralInput().buttons).toBe(0);
  });
});
