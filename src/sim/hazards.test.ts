import { describe, expect, it } from 'vitest';
import { hashState } from '../engine/hash';
import { registerFighter } from '../fighters/registry';
import { defineFighter } from '../fighters/types';
import { registerStage } from '../stages/registry';
import type { SimEvent } from './events';
import type { FighterState } from './fighter';
import { zoneAt } from './hazards';
import { createMatch, type MatchState } from './match';
import type { DamageZone } from './stage';
import { compiledStage } from './step';
import { marioReference as mario } from './testing/reference';
import { attack, run, runPorts, until } from './testing/sim';

/** A match on the hazard testbed with fighter `p` placed on the floor (or a platform) at `xs[p]`. */
function hazardMatch(
  fighters: string[],
  xs: (number | [number, number])[],
  opts: { hazards?: boolean; stage?: string } = {},
): MatchState {
  const m = createMatch({
    seed: 1,
    stage: opts.stage ?? 'hazard-testbed',
    stocks: 3,
    hazards: opts.hazards,
    ports: fighters.map((fighter) => ({ fighter })),
  });
  m.fighters.forEach((f, i) => {
    const at = xs[i]!;
    const [x, y] = typeof at === 'number' ? [at, 0.001] : at;
    Object.assign(f, { pos: { x, y }, prevPos: { x, y } });
  });
  return m;
}

/** Stage hits during the next `frames` frames, with the frame each landed on. */
function stageHitsOver(
  m: MatchState,
  frames: number,
): (Extract<SimEvent, { type: 'stageHit' }> & { frame: number })[] {
  const hits = [];
  for (let i = 0; i < frames; i++) {
    run(m, 1);
    for (const e of m.events) if (e.type === 'stageHit') hits.push({ ...e, frame: m.frame });
  }
  return hits;
}

const groundSolid = (m: MatchState, f: FighterState) =>
  f.ground?.kind === 'solid' ? compiledStage(m.config.stage).edges[f.ground.index]!.solid : -1;

registerStage({
  id: 'test-deep-goo',
  name: 'test-deep-goo',
  solids: [
    {
      points: [
        [-80, 0],
        [-80, -30],
        [80, -30],
        [80, 0],
      ],
    },
  ],
  platforms: [],
  ledges: [],
  zones: [{ x1: -30, x2: 30, y1: -1, y2: 200, element: 'goo' }],
  blastZones: { left: -400, right: 400, top: 300, bottom: -300 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [[0, 0, 1]],
  respawns: [[0, 80]],
});

registerFighter(
  defineFighter({
    ...mario,
    id: 'test-hazard-armor',
    name: 'Test hazard armor',
    moves: { ...mario.moves, brace: { kind: 'other', faf: 50, hits: [], armor: { frames: [1, 30] } } },
  }),
);

describe('damage zones', () => {
  it('goo hurts everyone: 2% and the same weak pop straight up at any %', () => {
    const m = hazardMatch(['fireboy', 'watergirl', 'fireboy'], [-88, -82, -76]);
    m.fighters[2]!.damage = 150;
    const hits = stageHitsOver(m, 1);
    expect(hits.map((h) => [h.victim, h.element, h.damage])).toEqual([
      [0, 'goo', 2],
      [1, 'goo', 2],
      [2, 'goo', 2],
    ]);
    expect(hits[2]!.kb).toBe(hits[0]!.kb);
    until(m, () => m.fighters.every((f) => f.hitlag === 0));
    run(m, 1);
    for (const f of m.fighters) {
      expect(f.action).toBe('hitstun');
      expect(f.kb.x).toBeCloseTo(0, 9);
      expect(f.kb.y).toBeGreaterThan(0);
    }
  });

  it('lava hurts Watergirl and not Fireboy, water the other way round, and both launch into tumble', () => {
    const lava = hazardMatch(['fireboy', 'watergirl', mario.id], [-50, -44, 80]);
    const water = hazardMatch(['fireboy', 'watergirl', mario.id], [44, 50, -25]);
    const hits = [...stageHitsOver(lava, 60), ...stageHitsOver(water, 60)];
    expect(hits.map((h) => [h.victim, h.element, h.damage])).toEqual([
      [1, 'lava', 12],
      [0, 'water', 12],
    ]);
    expect([lava.fighters[0]!.damage, lava.fighters[1]!.damage]).toEqual([0, 12]);
    expect([water.fighters[0]!.damage, water.fighters[1]!.damage]).toEqual([12, 0]);
    expect(lava.fighters[1]!.action).toBe('tumble');
    expect(water.fighters[0]!.action).toBe('tumble');
    expect(lava.fighters[0]!.action).toBe('idle');
  });

  it("hits again only after the zone's rehit time", () => {
    const m = hazardMatch([mario.id], [0], { stage: 'test-deep-goo' });
    const frames = stageHitsOver(m, 60).map((h) => h.frame);
    expect(frames).toEqual([1, 11, 21, 31, 41, 51]);
  });

  it('hit through armor like any other hit: damage and hitlag, no launch', () => {
    const m = hazardMatch(['test-hazard-armor'], [-25]);
    const f = m.fighters[0]!;
    run(m, 5);
    f.pos.x = f.prevPos.x = -48;
    attack(m, 0, 'brace');
    const hits = stageHitsOver(m, 1);
    expect(hits.map((h) => [h.element, h.damage])).toEqual([['lava', 12]]);
    expect([f.action, f.move, f.launch]).toEqual(['attack', 'brace', null]);
    expect(f.hitlag).toBeGreaterThan(0);
  });

  it('skips intangible fighters', () => {
    const m = hazardMatch([mario.id], [-48]);
    m.fighters[0]!.intangible = 20;
    const hits = stageHitsOver(m, 40);
    expect(hits.map((h) => h.frame)).toEqual([20]);
  });

  it('moves with its motion and is gone while its schedule has it off', () => {
    const z: DamageZone = {
      x1: -10,
      x2: 10,
      y1: 0,
      y2: 4,
      element: 'lava',
      motion: {
        period: 200,
        keys: [
          [0, 0, 0],
          [100, 100, 0],
        ],
      },
      schedule: { period: 200, off: [[50, 199]] },
    };
    expect(zoneAt(z, 0)).toEqual({ x1: -10, x2: 10, y1: 0, y2: 4 });
    expect(zoneAt(z, 25)).toEqual({ x1: 15, x2: 35, y1: 0, y2: 4 });
    expect(zoneAt(z, 60)).toBeNull();
    expect(zoneAt(z, 225)).toEqual({ x1: 15, x2: 35, y1: 0, y2: 4 });
  });
});

describe('hazards and grabs', () => {
  /** Fireboy (port 0) holding Watergirl (port 1) in front of him, facing left, at x. */
  function held(x: number): MatchState {
    const m = hazardMatch(['fireboy', 'watergirl', mario.id], [-25, -20, 80]);
    run(m, 5);
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(a, { action: 'grabHold', actionFrame: 1, move: null, facing: -1, grabPartner: 1 });
    Object.assign(v, { action: 'grabbed', actionFrame: 1, facing: 1, grabPartner: 0, grabTimer: 999 });
    a.pos.x = x;
    a.prevPos.x = x;
    v.pos.x = x - 12;
    v.prevPos.x = x - 12;
    return m;
  }

  it('a hazard hit counts toward breaking a grab: lava breaks it at once, goo only adds up', () => {
    const lava = held(-28);
    const [a, v] = lava.fighters as [FighterState, FighterState];
    const hits = stageHitsOver(lava, 1);
    expect(hits.map((h) => [h.victim, h.element])).toEqual([[1, 'lava']]);
    expect(lava.events.filter((e) => e.type === 'grabRelease')).toEqual([
      { type: 'grabRelease', holder: 0, held: 1 },
    ]);
    expect([a.grabPartner, v.grabPartner]).toEqual([-1, -1]);
    expect(v.action).toBe('tumble');
    expect(v.launch).not.toBeNull();

    const goo = held(-66);
    const w = goo.fighters[1]!;
    expect(stageHitsOver(goo, 1).map((h) => [h.victim, h.element])).toEqual([[1, 'goo']]);
    expect([w.action, w.grabPartner, w.grabDamage, w.launch]).toEqual(['grabbed', 0, 2, null]);
  });
});

describe('conveyors', () => {
  it('carry a fighter standing on the belt along it and off its end', () => {
    const m = hazardMatch([mario.id], [[-60, 30.001]]);
    run(m, 10);
    const f = m.fighters[0]!;
    expect(f.ground).toEqual({ kind: 'platform', index: 0 });
    const x = f.pos.x;
    run(m, 10);
    expect(f.pos.x - x).toBeCloseTo(6, 9);
    until(m, () => f.ground === null);
    expect(f.prevPos.x).toBeGreaterThan(-35 - 0.6);
    expect(f.pos.x).toBeGreaterThan(-35);
    expect(f.action).toBe('fall');
  });

  it('end a grab whose holder they carry off the end, as when the stage takes the ground away', () => {
    const m = hazardMatch(['fireboy', 'watergirl', mario.id], [[-55, 30.001], [-45, 30.001], 80]);
    run(m, 5);
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(a, { action: 'grabHold', actionFrame: 1, move: null, facing: 1, grabPartner: 1 });
    Object.assign(v, { action: 'grabbed', actionFrame: 1, facing: -1, grabPartner: 0, grabTimer: 999 });
    const releases: SimEvent[] = [];
    for (let i = 0; i < 60 && a.ground; i++) {
      run(m, 1);
      releases.push(...m.events.filter((e) => e.type === 'grabRelease'));
    }
    expect(releases).toEqual([{ type: 'grabRelease', holder: 0, held: 1 }]);
    expect([a.grabPartner, v.grabPartner]).toEqual([-1, -1]);
    expect([a.ground, a.action]).toEqual([null, 'fall']);
  });

  it('stand still with hazards off', () => {
    const m = hazardMatch([mario.id], [[-60, 30.001]], { hazards: false });
    run(m, 60);
    expect(m.fighters[0]!.pos.x).toBe(-60);
    expect(m.fighters[0]!.ground).toEqual({ kind: 'platform', index: 0 });
  });
});

describe('trapdoors', () => {
  it('can be walked across like the floor around them', () => {
    const m = hazardMatch([mario.id], [-30]);
    const f = m.fighters[0]!;
    const solids: number[] = [];
    run(m, 5);
    for (let i = 0; i < 120 && f.pos.x < 25; i++) {
      run(m, 1, { x: 100 });
      if (solids.at(-1) !== groundSolid(m, f)) solids.push(groundSolid(m, f));
    }
    expect(solids).toEqual([0, 1, 2]);
    expect(f.pos.y).toBe(0);
  });

  it('drop whoever stands on them when they open, and stay shut with hazards off', () => {
    const on = hazardMatch([mario.id], [0]);
    const off = hazardMatch([mario.id], [0], { hazards: false });
    run(on, 179);
    run(off, 179);
    expect(groundSolid(on, on.fighters[0]!)).toBe(1);
    run(on, 20);
    run(off, 121);
    expect(on.fighters[0]!.ground).toBeNull();
    expect(on.fighters[0]!.pos.y).toBeLessThan(-6);
    expect(groundSolid(off, off.fighters[0]!)).toBe(1);
    expect(off.stage.solids[1]).toEqual({ x: 0, y: 0, dx: 0, dy: 0, on: true });
  });
});

describe('stage hitboxes', () => {
  it('the testbed blade misses while retracted, then hits as its sweep starts and launches forward', () => {
    const m = hazardMatch([mario.id], [-97]);
    const f = m.fighters[0]!;
    expect(stageHitsOver(m, 119)).toEqual([]);
    const hits = stageHitsOver(m, 1);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      victim: 0,
      source: 'hitbox',
      index: 0,
      element: null,
      damage: 8,
      frame: 120,
    });
    until(m, () => f.hitlag === 0);
    run(m, 1);
    expect(f.kb.x).toBeGreaterThan(0);
    expect(f.kb.y).toBeGreaterThan(0);
  });
});

describe('MatchConfig.hazards', () => {
  it('false turns off zones and stage hitboxes', () => {
    const m = hazardMatch(['fireboy', 'watergirl', mario.id, mario.id], [-82, -48, 48, -97], {
      hazards: false,
    });
    expect(stageHitsOver(m, 360)).toEqual([]);
    expect(m.fighters.map((f) => f.damage)).toEqual([0, 0, 0, 0]);
  });

  it('two runs of the hazard testbed agree', () => {
    const play = () => {
      const m = hazardMatch(['fireboy', 'watergirl', mario.id, mario.id], [-82, -48, 0, 48]);
      for (let i = 0; i < 420; i++)
        runPorts(m, 1, [{ x: i % 90 < 45 ? 100 : -100, buttons: i % 37 === 0 ? ['jump'] : [] }, {}, {}, {}]);
      return hashState(m);
    };
    expect(play()).toBe(play());
  });
});
