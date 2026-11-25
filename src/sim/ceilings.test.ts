import { describe, expect, it } from 'vitest';
import { getFighter } from '../fighters/registry';
import {
  findScenario,
  scenarioConfig,
  scenarioInputs,
  startScenario,
  type GameScenario,
} from '../harness/scenarios';
import { registerStage } from '../stages/registry';
import type { FighterState } from './fighter';
import { createMatch, stepMatch, type MatchState } from './match';
import { posedStage } from './movingStage';
import type { StageGeometry } from './stage';
import { placeInAir, run, testMatch, type Hold } from './testing/sim';

/**
 * Solid ground blocks fighters from below. Ultimate's ECB diamond never enters a solid: a fighter rising into the
 * underside of a stage stops against it (its up special keeps pressing until the rise ends) or slides along it,
 * and one rising past a corner (a side wall meeting the underside, a ledge) slides off it. Drop-through platforms
 * still let fighters through from below.
 */

/** Raft War Lagoon's hull (PR #184): 10 deep with chamfered corners, bobbing 1.6 up and back every 300 frames. */
const bobbingHull: StageGeometry = {
  id: 'bobbing-hull',
  name: 'Bobbing hull',
  solids: [
    {
      points: [
        [-75, 0],
        [75, 0],
        [75, -6.1],
        [74.4, -8.8],
        [72.8, -10],
        [-72.8, -10],
        [-74.4, -8.8],
        [-75, -6.1],
      ],
      motion: {
        period: 300,
        ease: true,
        keys: [
          [0, 0, 0],
          [150, 0, 1.6],
        ],
      },
    },
  ],
  platforms: [],
  ledges: [
    { x: -75, y: 0, side: -1 },
    { x: 75, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [[-40, 0, 1]],
  respawns: [[0, 70]],
};
registerStage(bobbingHull);

/** The fighter's collision box (movement.ts ecb): a diamond from the feet to 0.75 of its height, half its width wide. */
function boxOf(f: FighterState) {
  const s = getFighter(f.fighter).stats;
  return { h: s.height * 0.75, w: s.width / 2 };
}

function insidePolygon(pts: [number, number][], px: number, py: number): boolean {
  let inside = false;
  for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
    const [xa, ya] = pts[a]!;
    const [xb, yb] = pts[b]!;
    if (ya > py !== yb > py && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}

/**
 * Whether the fighter's collision box overlaps a solid by more than `slack`: one of its points inside a solid, or
 * a solid's corner inside it.
 */
function inSolid(m: MatchState, f: FighterState, slack = 0.01): boolean {
  const { h, w } = boxOf(f);
  const { x, y } = f.pos;
  const points = [
    [x, y + slack],
    [x, y + h - slack],
    [x - w + slack, y + h / 2],
    [x + w - slack, y + h / 2],
  ] as const;
  const inBox = (px: number, py: number) =>
    Math.abs(px - x) / (w - slack) + Math.abs(py - y - h / 2) / (h / 2 - slack) < 1;
  const stage = posedStage(m);
  return stage.geo.solids.some(
    (s, i) =>
      stage.present.solids[i] &&
      (points.some(([px, py]) => insidePolygon(s.points, px, py)) ||
        s.points.some(([px, py]) => inBox(px, py))),
  );
}

/** Fireboy in the air at (x, y), already up-specialling; the next frame is his up special's frame 1. */
function flameJump(stage: string, x: number, y: number, settle = 0): { m: MatchState; f: FighterState } {
  const m = testMatch({ fighter: 'fireboy', stage });
  run(m, settle);
  const f = placeInAir(m, x, y);
  f.ledgeLock = 1000; // keep him off the ledges, so every rise ends against the stage or past it
  run(m, 1, { y: 100, buttons: ['special'] });
  expect(f.move).toBe('upB');
  return { m, f };
}

/** Step `frames` frames holding `hold`, failing the first frame the fighter's box is inside a solid. */
function clearOfSolids(m: MatchState, f: FighterState, frames: number, hold: Hold = {}): number[] {
  const ys: number[] = [];
  for (let i = 0; i < frames; i++) {
    run(m, 1, hold);
    if (f.action === 'ko') break;
    expect(
      inSolid(m, f),
      `frame ${i + 1} at (${f.pos.x.toFixed(2)}, ${f.pos.y.toFixed(2)}) ${f.action}`,
    ).toBe(false);
    ys.push(f.pos.y);
  }
  return ys;
}

const FIREBOY_BOX_TOP = 15 * 0.75;
/** Battlefield's underside at x = 0 (the bottom edge runs from (41.42, -40.12) to (-41.4, -40.1)). */
const BATTLEFIELD_UNDERSIDE = -40.11;

describe("Fireboy's up special under solid ground", () => {
  it("bonks on Battlefield's underside, presses against it until the rise ends, then falls", () => {
    const { m, f } = flameJump('battlefield', 0, -60);
    const ys = clearOfSolids(m, f, 40);
    const top = BATTLEFIELD_UNDERSIDE - FIREBOY_BOX_TOP;
    expect(Math.max(...ys)).toBeCloseTo(top, 2);
    // Frames 4-24 rise (fireboy/moves.ts upB); against the underside he stays there, then falls when they end.
    expect(ys.filter((y) => Math.abs(y - top) < 0.01).length).toBeGreaterThan(10);
    expect(ys.at(-1)).toBeLessThan(top - 5);
    expect(f.ground).toBeNull();
  });

  it("stops under Construction Site's 15-deep hull and slides along it with the stick held", () => {
    const { m, f } = flameJump('snail-bob-construction', -20, -40);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 20; i++) {
      ys.push(...clearOfSolids(m, f, 1, { x: 100 }));
      xs.push(f.pos.x);
    }
    const top = -15 - FIREBOY_BOX_TOP;
    const pressed = ys.map((y, i) => (Math.abs(y - top) < 0.01 ? i : -1)).filter((i) => i >= 0);
    expect(pressed.length).toBeGreaterThan(8);
    expect(Math.max(...ys)).toBeCloseTo(top, 2);
    expect(xs[pressed.at(-1)!]! - xs[pressed[0]!]!).toBeGreaterThan(8);
  });

  for (const stage of ['battlefield', 'snail-bob-construction', 'papas-pizzeria']) {
    it(`never enters ${stage}'s solid from anywhere under it or past its corners, steering either way`, () => {
      const bottom = Math.min(...posedStage(testMatch({ stage })).geo.solids[0]!.points.map((p) => p[1]));
      for (let x = -96; x <= 96; x += 4) {
        for (const stick of [-100, 0, 100]) {
          const { m, f } = flameJump(stage, x, bottom - FIREBOY_BOX_TOP - 2);
          clearOfSolids(m, f, 60, { x: stick });
        }
      }
    });
  }

  it('the fireboy-upb-under-hull capture never puts him inside the hull', () => {
    const scenario = findScenario('fireboy-upb-under-hull') as GameScenario;
    const m = createMatch(scenarioConfig(scenario));
    startScenario(m, scenario);
    const f = m.fighters[0]!;
    while (m.frame < 70) {
      stepMatch(m, scenarioInputs(scenario, m));
      expect(inSolid(m, f), `frame ${m.frame} at (${f.pos.x.toFixed(2)}, ${f.pos.y.toFixed(2)})`).toBe(false);
    }
    // On main he came out on top of the hull and landed at x -28.
    expect(f.ground).toBeNull();
    expect(f.pos.y).toBeLessThan(-15);
  });

  it("straight up just past Battlefield's ledge, slides off the corner under it instead of rising through the stage", () => {
    // On main this rose through the corner where the side wall meets the slanted underside and came out on top.
    const { m, f } = flameJump('battlefield', -83, -53.4);
    clearOfSolids(m, f, 60);
    expect(f.pos.x).toBeLessThan(-80 - 4);
  });
});

describe('under a moving solid', () => {
  it("stops at the testbed elevator's underside while it rises, waits and sinks, and never enters it", () => {
    for (const settle of [0, 100, 160, 240, 300, 350]) {
      for (const [x, stick] of [
        [120, 0],
        [98, 100],
        [142, -100],
        [104, -100],
        [136, 100],
      ] as const) {
        const m0 = testMatch({ stage: 'testbed' });
        run(m0, settle);
        const bottom = -8 + m0.stage.solids[1]!.y;
        const { m, f } = flameJump('testbed', x, bottom - FIREBOY_BOX_TOP - 3, settle);
        for (let i = 0; i < 50; i++) {
          clearOfSolids(m, f, 1, { x: stick });
          if (x === 120)
            expect(f.pos.y + FIREBOY_BOX_TOP).toBeLessThanOrEqual(-8 + m.stage.solids[1]!.y + 0.01);
        }
      }
    }
  });

  it("stops under a bobbing raft hull and never enters it, whatever the swell's phase", () => {
    for (const settle of [0, 75, 150, 225]) {
      for (let x = -84; x <= 84; x += 6) {
        for (const stick of [-100, 0, 100]) {
          const { m, f } = flameJump('bobbing-hull', x, -10 - FIREBOY_BOX_TOP - 2, settle);
          clearOfSolids(m, f, 50, { x: stick });
        }
      }
    }
  });
});

/**
 * The reference Mario mid-launch at (x, y): tumbling, in hitstun, with launch speed `kb` (Ultimate: 0.03 units per
 * frame per point of knockback, so 4 is a 133-knockback launch).
 */
function launched(x: number, y: number, kb: { x: number; y: number }): { m: MatchState; v: FighterState } {
  const m = testMatch();
  const v = placeInAir(m, x, y);
  Object.assign(v, { action: 'tumble', actionFrame: 1, hitstun: 40, kb: { ...kb }, ledgeLock: 1000 });
  return { m, v };
}

describe('jumps and launches into the underside', () => {
  it('a double jump drifting into the corner under the ledge slides off it instead of entering the stage', () => {
    // Each of these entered the stage on main.
    for (const [fighter, stage, x, y, stick] of [
      ['fireboy', 'snail-bob-construction', -92, -32.3, 100],
      ['fireboy', 'snail-bob-construction', 92, -32.3, -100],
      ['duck', 'battlefield', -92, -50.4, 100],
    ] as const) {
      const m = testMatch({ fighter, stage });
      const f = placeInAir(m, x, y);
      f.ledgeLock = 1000;
      run(m, 1, { x: stick, buttons: ['jump'] });
      expect(f.action).toBe('doubleJump');
      clearOfSolids(m, f, 60, { x: stick });
    }
  });

  it('a fighter launched up into the underside stops against it and loses the launch speed into it', () => {
    const { m, v } = launched(0, -80, { x: 0, y: 4 });
    const ys = clearOfSolids(m, v, 30);
    const top = BATTLEFIELD_UNDERSIDE - FIREBOY_BOX_TOP; // the reference Mario is 15 tall too
    expect(Math.max(...ys)).toBeCloseTo(top, 2);
    expect(v.kb.y).toBeLessThanOrEqual(0);
    expect(v.pos.y).toBeLessThan(top);
  });

  it('a launch up past the underside corners never carries the fighter into the stage', () => {
    for (const x of [-86, -82, -78, -66, 66, 78, 82, 86]) {
      for (const angle of [60, 90, 120]) {
        const a = (angle * Math.PI) / 180;
        const { m, v } = launched(x, -70, { x: 4 * Math.cos(a), y: 4 * Math.sin(a) });
        clearOfSolids(m, v, 40);
      }
    }
  });
});

describe('drop-through platforms from below', () => {
  it("Fireboy's up special from the stage rises up through Battlefield's side platform", () => {
    const m = testMatch({ fighter: 'fireboy', x: -42 });
    const f = m.fighters[0]!;
    run(m, 1, { y: 100, buttons: ['special'] });
    let highest = f.pos.y;
    for (let i = 0; i < 30; i++) {
      run(m, 1);
      highest = Math.max(highest, f.pos.y);
    }
    expect(highest).toBeGreaterThan(24.12 + 10);
  });

  it("a launch from the stage carries the fighter up through Battlefield's side platforms", () => {
    const { m, v } = launched(-42, 1, { x: 0, y: 4 });
    let highest = v.pos.y;
    for (let i = 0; i < 30; i++) {
      run(m, 1);
      highest = Math.max(highest, v.pos.y);
    }
    expect(highest).toBeGreaterThan(24.12 + 10);
  });
});
