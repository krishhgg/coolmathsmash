import { describe, expect, it } from 'vitest';
import { FRESHNESS_BONUS, ONE_V_ONE_DAMAGE } from '../../sim/combat/formulas';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import { createMatch } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { placeInAir, run, runPorts, testMatch, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { DASH_SPEED, FOX_ILLUSION, TRAIL } from './strafe-dash';
import { stats } from './stats';
import { STRAFE_DASH } from './timing';

const SIDE_SPECIAL: Hold = { x: 100, buttons: ['special'] };
const { dash: DASH, active: ACTIVE, end: END } = STRAFE_DASH;
const HIT = (damage: number) => damage * FRESHNESS_BONUS * ONE_V_ONE_DAMAGE;

/** Runner at `x` facing right against the Mario reference standing at `x + gap`, both settled. */
function duel(x: number, gap: number, damage = 0) {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'runner' }, { fighter: marioReference.id }],
  });
  run(m, 10);
  const [runner, mario] = m.fighters as [FighterState, FighterState];
  for (const [f, at, facing] of [
    [runner, x, 1],
    [mario, x + gap, -1],
  ] as const)
    Object.assign(f, { pos: { x: at, y: 0 }, prevPos: { x: at, y: 0 }, vel: { x: 0, y: 0 }, facing });
  mario.damage = damage;
  return { m, runner, mario };
}

/** Plays the move from its first frame, recording where she is after each frame until it ends (or `frames`). */
function trace(m: ReturnType<typeof testMatch>, frames = 90, hold: Hold = {}) {
  const f = m.fighters[0]!;
  const start = { ...f.pos };
  run(m, 1, SIDE_SPECIAL);
  const move = f.move;
  const path = new Map<number, { x: number; y: number }>();
  for (let i = 0; i < frames && f.move === move; i++) {
    path.set(f.actionFrame, { x: f.pos.x - start.x, y: f.pos.y - start.y });
    run(m, 1, hold);
  }
  return { f, move, path };
}

describe("Runner: Strafe Dash (side special) on Fox Illusion's Ultimate data", () => {
  it("has Fox Illusion's frames, landing lag and hits, on the ground and in the air", () => {
    const ground = moves.sideB!;
    const air = moves.sideBAir!;
    expect(ground).toMatchObject({ faf: 56, air: 'sideBAir' });
    expect(air).toMatchObject({ faf: 73, landingLag: 16, ledgeFrom: 25 });
    expect(air.helpless).toBeUndefined();
    for (const [move, numbers] of [
      [ground, { damage: 8, angle: 85, bkb: 35, kbg: 110 }],
      [air, { damage: 5, angle: 60, bkb: 15, kbg: 148 }],
    ] as const) {
      expect(move.hits.map((h) => h.frames)).toEqual([[25, 29]]);
      for (const b of move.hits[0]!.boxes) expect(b).toMatchObject({ y: 4, radius: 4, ...numbers });
    }
  });

  it('coils for 23 frames, bursts 58 units on frames 24-28 and slides to a stop 80 units on, half of FD', () => {
    const { f, move, path } = trace(testMatch({ fighter: 'runner', x: -70 }));
    expect(move).toBe('sideB');
    expect(path.get(DASH[0] - 1)).toEqual({ x: 0, y: 0 });
    for (let frame = DASH[0]; frame <= DASH[1]; frame++)
      expect(path.get(frame)!.x).toBeCloseTo((frame - DASH[0] + 1) * DASH_SPEED, 6);
    expect(path.get(DASH[1])!.x).toBeCloseTo(58, 6);
    expect(path.get(END)!.x - path.get(DASH[1])!.x).toBeCloseTo(FOX_ILLUSION.endSpeed.ground, 6);
    expect(path.get(55)!.x).toBeCloseTo(80, 0);
    expect(path.get(55)!.y).toBe(0);
    expect(f).toMatchObject({ action: 'idle', ground: { kind: 'solid' } });
    expect(Math.max(...path.keys())).toBe(55);
  });

  it('in the air sinks under a unit through the coil, bursts level, floats 5 frames and ends in a fall, not helpless', () => {
    const m = testMatch({ fighter: 'runner' });
    placeInAir(m, -70, 150);
    const { f, move, path } = trace(m);
    expect(move).toBe('sideBAir');
    expect(path.get(FOX_ILLUSION.startupFloat)!.y).toBe(0);
    const sunk = -path.get(DASH[0] - 1)!.y;
    expect(sunk).toBeCloseTo(FOX_ILLUSION.startupGravity * 55, 6);
    for (let frame = DASH[0]; frame < END + FOX_ILLUSION.endFloat; frame++)
      expect(path.get(frame)!.y, `frame ${frame}`).toBeCloseTo(-sunk, 6);
    expect(path.get(DASH[1])!.x).toBeCloseTo(58, 6);
    expect(path.get(END)!.x - path.get(DASH[1])!.x).toBeCloseTo(FOX_ILLUSION.endSpeed.air, 6);
    expect(path.get(72)!.x).toBeGreaterThan(95);
    expect(path.get(72)!.x).toBeLessThan(99);
    expect(f.action).toBe('fall');
  });

  it('drifts after the burst at 0.7x her air speed, as Fox Illusion lets him', () => {
    const m = testMatch({ fighter: 'runner' });
    const f = placeInAir(m, -70, 150);
    run(m, 1, SIDE_SPECIAL);
    run(m, 60, { x: 100 });
    expect(f.move).toBe('sideBAir');
    expect(f.vel.x).toBeCloseTo(stats.airSpeed * FOX_ILLUSION.airDriftSpeed, 6);
  });

  it('lands out of the air version with 16 frames of landing lag', () => {
    const m = testMatch({ fighter: 'runner' });
    const f = placeInAir(m, -40, 6);
    run(m, 1, SIDE_SPECIAL);
    let lag: number | undefined;
    for (let i = 0; i < 80 && lag === undefined; i++) {
      run(m, 1);
      lag = m.events.find((e) => e.type === 'land')?.lag;
    }
    expect(lag).toBe(16);
    expect(f.action).toBe('land');
  });

  it("can't be stopped early with Special, as in Ultimate", () => {
    const travel = (press: boolean) => {
      const m = testMatch({ fighter: 'runner', x: -70 });
      const f = m.fighters[0]!;
      run(m, 1, SIDE_SPECIAL);
      run(m, 25);
      if (press) run(m, 1, { buttons: ['special'] });
      run(m, 60 - f.actionFrame);
      return { x: f.pos.x, action: f.action };
    };
    expect(travel(true)).toEqual(travel(false));
  });

  it('stops at the edge of the stage instead of dashing off it', () => {
    const { f } = trace(testMatch({ fighter: 'runner', x: 40 }));
    expect(f.ground).not.toBeNull();
    expect(f.pos.x).toBeCloseTo(80, 6);
    expect(f.action).toBe('idle');
  });

  it('the air version catches the ledge on its way back to the stage', () => {
    const m = testMatch({ fighter: 'runner' });
    const f = placeInAir(m, 115, -8, -1);
    run(m, 1, { x: -100, buttons: ['special'] });
    expect(f.move).toBe('sideBAir');
    for (let i = 0; i < 40 && !f.action.startsWith('ledge'); i++) run(m, 1);
    expect(f.action).toBe('ledgeCatch');
    expect(f.ledge).toBe(1);
  });
});

describe('Runner: Strafe Dash hits', () => {
  it.each([3, 25, 50])('the afterimage trail hits Mario %s units ahead for 8%% at 85 degrees', (gap) => {
    const { m, runner, mario } = duel(-60, gap, 30);
    run(m, 1, SIDE_SPECIAL);
    for (let i = 0; i < 40 && mario.damage === 30; i++) run(m, 1);
    expect(runner.actionFrame).toBeGreaterThanOrEqual(ACTIVE[0]);
    expect(runner.actionFrame).toBeLessThanOrEqual(ACTIVE[1]);
    expect(mario.damage).toBeCloseTo(30 + HIT(8), 6);
    expect(mario.launch).toMatchObject({ angle: 85, dir: 1 });
  });

  it('the trail reaches back to where she stood two frames before', () => {
    expect(TRAIL[0]).toBe(0);
    expect(TRAIL.at(-1)).toBeCloseTo(-2 * DASH_SPEED, 6);
    const m = testMatch({ fighter: 'runner', x: -70 });
    const f = m.fighters[0]!;
    run(m, 1, SIDE_SPECIAL);
    run(m, ACTIVE[0] - 1);
    const boxes = activeHitboxes(f).map((h) => h.x);
    expect(Math.min(...boxes)).toBeCloseTo(-70, 6);
  });

  it('in the air it hits for 5% at 60 degrees', () => {
    const { m, mario } = duel(-60, 25, 30);
    placeInAir(m, -60, 4);
    Object.assign(mario, { pos: { x: -35, y: 4 }, ground: null, action: 'fall' });
    run(m, 1, SIDE_SPECIAL);
    for (let i = 0; i < 40 && mario.damage === 30; i++) {
      Object.assign(mario, { pos: { x: -35, y: 4 }, vel: { x: 0, y: 0 } });
      run(m, 1);
    }
    expect(mario.damage).toBeCloseTo(30 + HIT(5), 6);
    expect(mario.launch).toMatchObject({ angle: 60, dir: 1 });
  });

  it('stops dead on a shield: 0.5 a frame from then on, skipping to frame 29', () => {
    const { m, runner, mario } = duel(-60, 25);
    runPorts(m, 10, [{}, { buttons: ['shield'] }]);
    expect(mario.action).toBe('shield');
    const x0 = runner.pos.x;
    runPorts(m, 1, [SIDE_SPECIAL, { buttons: ['shield'] }]);
    for (let i = 0; i < 40 && mario.action === 'shield'; i++) runPorts(m, 1, [{}, { buttons: ['shield'] }]);
    expect(mario.action).toBe('shieldStun');
    const hitFrame = runner.actionFrame;
    expect(hitFrame).toBeLessThan(END);
    while (runner.hitlag > 0) runPorts(m, 1, [{}, { buttons: ['shield'] }]);
    runPorts(m, 1, [{}, { buttons: ['shield'] }]);
    expect(runner.actionFrame).toBe(END);
    const at = runner.pos.x;
    runPorts(m, 30, [{}, { buttons: ['shield'] }]);
    expect(runner.pos.x - at).toBeLessThan(2);
    expect(runner.pos.x - x0).toBeLessThan(45);
  });
});

/**
 * Fox Illusion's own numbers (SmashWiki, Fox (SSBU)/Side_special): 8%, 85°, BKB 35, KBG 110 on the ground; 5%, 60°,
 * BKB 15, KBG 148 in the air. SmashWiki says the grounded hit KOs "middleweights at around 180% or earlier with rage".
 */
describe("Runner: Strafe Dash kill % against Fox Illusion's (Mario at the Battlefield ledge, fresh, no DI)", () => {
  const from = { x: 79.9, y: 0 };

  it.each([
    ['sideB', { damage: 8, angle: 85, bkb: 35, kbg: 110 }, false],
    ['sideBAir', { damage: 5, angle: 60, bkb: 15, kbg: 148 }, true],
  ] as const)('%s kills within 5%% of Fox Illusion', (move, fox, air) => {
    const ours = koPercent({ hit: { fighter: 'runner', move }, from, air });
    const analogue = koPercent({ hit: fox, from, air });
    expect(ours).not.toBeNull();
    expect(analogue).not.toBeNull();
    expect(Math.abs(ours! - analogue!)).toBeLessThanOrEqual(5);
  });

  it('the grounded hit kills Mario in the high 100s, as SmashWiki says of Fox Illusion', () => {
    const percent = koPercent({ hit: { fighter: 'runner', move: 'sideB' }, from });
    expect(percent).toBeGreaterThan(165);
    expect(percent).toBeLessThan(190);
  });
});
