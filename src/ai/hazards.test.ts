import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import type { StageGeometry } from '../sim/stage';
import { hazardTestbed } from '../stages/hazardTestbed';
import { registerStage } from '../stages/registry';
import { stage as runTunnel } from '../stages/run-tunnel/geometry';
import { createCpu } from './index';
import { floorBelow, stageInfo, walkTarget } from './stage';

/** Run Tunnel with its left gap (x -48 to -32) filled by a block that is there for 120 frames, then gone for 60. */
const timedFill: StageGeometry = {
  ...runTunnel,
  id: 'run-tunnel-timed-fill',
  solids: [
    ...runTunnel.solids,
    {
      points: [
        [-48, 0],
        [-48, -10],
        [-32, -10],
        [-32, 0],
      ],
      schedule: { period: 180, off: [[120, 179]] },
    },
  ],
};
registerStage(timedFill);
registerStage(hazardTestbed);

/** A match with each fighter placed on the floor at xs[i]. */
function matchOn(stage: string, fighters: string[], xs: number[], hazards?: boolean): MatchState {
  const m = createMatch({
    seed: 1,
    stage,
    stocks: 3,
    hazards,
    ports: fighters.map((fighter) => ({ fighter })),
  });
  m.fighters.forEach((f, i) =>
    Object.assign(f, { pos: { x: xs[i]!, y: 0.001 }, prevPos: { x: xs[i]!, y: 0.001 } }),
  );
  return m;
}

function stepTo(m: MatchState, frame: number): void {
  const idle = m.fighters.map(() => neutralInput());
  while (m.frame < frame) stepMatch(m, idle);
}

describe('the CPU stage view', () => {
  it('sees the floor under a timed fill only while the fill is there', () => {
    const m = matchOn('run-tunnel-timed-fill', ['fireboy'], [-64]);
    stepTo(m, 60);
    expect(floorBelow(stageInfo(m), -40, 5)).toBe(0);
    stepTo(m, 150);
    expect(floorBelow(stageInfo(m), -40, 5)).toBeNull();
    stepTo(m, 200);
    expect(floorBelow(stageInfo(m), -40, 5)).toBe(0);
  });

  it('does not count ground about to vanish as somewhere to stand or land', () => {
    const m = matchOn('run-tunnel-timed-fill', ['fireboy'], [-64]);
    stepTo(m, 100);
    expect(floorBelow(stageInfo(m), -40, 5)).toBe(0);
    expect(floorBelow(stageInfo(m), -40, 5, true, true)).toBeNull();
    expect(floorBelow(stageInfo(m), -64, 5, true, true)).toBe(0);
  });

  it('keeps a trapdoor shut with hazards off', () => {
    const on = matchOn('hazard-testbed', ['fireboy'], [-25]);
    const off = matchOn('hazard-testbed', ['fireboy'], [-25], false);
    stepTo(on, 200);
    stepTo(off, 200);
    expect(floorBelow(stageInfo(on), 0, 5)).toBeNull();
    expect(floorBelow(stageInfo(off), 0, 5)).toBe(0);
    expect(stageInfo(off).zones).toEqual([]);
  });

  it('stops a walk short of an open trapdoor and of a damage zone that hurts', () => {
    const m = matchOn('hazard-testbed', ['fireboy'], [-25]);
    stepTo(m, 200);
    const info = stageInfo(m);
    const toTrapdoor = walkTarget(info, 'fireboy', -25, 0, 25);
    expect(toTrapdoor).toBeLessThan(-15);
    expect(toTrapdoor).toBeGreaterThan(-25);
    // Lava (x -60 to -36) burns Watergirl but not Fireboy; both stop short of the goo (x -92 to -72).
    expect(walkTarget(info, 'watergirl', -25, 0, -66)).toBeGreaterThan(-36 + 4);
    expect(walkTarget(info, 'fireboy', -25, 0, -66)).toBe(-66);
    expect(walkTarget(info, 'fireboy', -25, 0, -90)).toBeGreaterThan(-72 + 4);
  });
});

interface Incidents {
  /** Frames the CPU spent in the trapdoor's pit after walking or jumping in on its own. */
  pit: number;
  /** Damage-zone hits the CPU took after walking or jumping in on its own. */
  zone: number;
  /** Stocks lost after walking or jumping off on its own. */
  selfDestructs: number;
}

/**
 * A CPU (port 0) against a fighter that stands still (port 1) on the hazard testbed, from frame `from` to `to`.
 * Counts what the CPU did to itself: incidents while it had not been hit since it last stood on the stage.
 */
function hazardRun(
  level: number,
  seed: number,
  fighters: [string, string],
  xs: [number, number],
  from: number,
  to: number,
): Incidents {
  const m = matchOn('hazard-testbed', fighters, xs);
  stepTo(m, from);
  const cpu = createCpu({ port: 0, level, seed });
  const out: Incidents = { pit: 0, zone: 0, selfDestructs: 0 };
  const me = m.fighters[0]!;
  let own = true;
  while (m.frame < to) {
    const was = me.action;
    stepMatch(m, [cpu.input(m), neutralInput()]);
    // A zone hit launches on the frame it lands, so count it against the state before that frame.
    const hit = m.events.some((e) => e.type === 'stageHit' && e.victim === 0 && e.source === 'zone');
    if (own && hit) out.zone++;
    if (me.launch || me.action === 'hitstun' || me.action === 'tumble') own = false;
    else if (me.ground !== null || me.action.startsWith('ledge') || me.action === 'respawn') own = true;
    if (own && Math.abs(me.pos.x) < 15 && me.pos.y < -2) out.pit++;
    if (own && me.action === 'ko' && was !== 'ko') out.selfDestructs++;
  }
  return out;
}

describe('CPUs on the hazard testbed', () => {
  // The trapdoor (x -15 to 15) is open on frames 180-299 of every 360; the CPU starts beside it, the other fighter
  // across it.
  it("don't walk or jump into the open trapdoor", () => {
    for (const level of [3, 6, 9]) {
      for (const seed of [1, 2]) {
        const r = hazardRun(level, seed, ['fireboy', 'fireboy'], [25, -80], 170, 300);
        expect(r, `level ${level} seed ${seed}`).toEqual({ pit: 0, zone: 0, selfDestructs: 0 });
      }
    }
  });

  // Lava (x -60 to -36) between Red Ball and a fighter standing beyond it, before the blade starts its sweep.
  it("don't walk into lava that burns them", () => {
    for (const level of [3, 6, 9]) {
      for (const seed of [1, 2]) {
        const r = hazardRun(level, seed, ['redball', 'fireboy'], [-25, -66], 0, 118);
        expect(r, `level ${level} seed ${seed}`).toEqual({ pit: 0, zone: 0, selfDestructs: 0 });
      }
    }
  });

  // Three trapdoor and blade cycles. Zone hits aren't asserted here: an aerial with its own motion (a stalling,
  // plunging down air) can still come down in a pool, because attack arcs don't model move-specific motion.
  it('stay out of the pit over full trapdoor and blade cycles', () => {
    for (const level of [5, 9]) {
      const { pit, selfDestructs } = hazardRun(level, 3, ['redball', 'fireboy'], [-25, 25], 0, 1080);
      expect({ pit, selfDestructs }, `level ${level}`).toEqual({ pit: 0, selfDestructs: 0 });
    }
  });
});
