import { describe, expect, it } from 'vitest';
import { registerFighter } from '../fighters/registry';
import { defineFighter, type FighterStats } from '../fighters/types';
import { activeHitboxes } from './combat/hits';
import { marioReference } from './testing/reference';
import { MOBILITY_TEST_FIGHTERS, testFloater, testGlider, testHover } from './testing/mobility';
import { placeInAir, run, testMatch, until, type Hold } from './testing/sim';

for (const def of MOBILITY_TEST_FIGHTERS) registerFighter(def);

const JUMP: Hold = { buttons: ['jump'] };

/** A Mario-bodied fighter with some stats changed, registered under `id`. */
function variant(id: string, stats: Partial<FighterStats>): string {
  registerFighter(
    defineFighter({ id, name: id, series: 'test', stats: { ...marioReference.stats, ...stats } }),
  );
  return id;
}

/** Press Jump at each apex from a fall high above the stage; the rise of every midair jump that came out. */
function airJumpRises(id: string): number[] {
  const m = testMatch({ fighter: id });
  const f = placeInAir(m, 0, 100);
  const rises: number[] = [];
  for (let i = 0; i < 10; i++) {
    const y0 = f.pos.y;
    const used = f.jumpsUsed;
    run(m, 1, JUMP);
    if (f.jumpsUsed === used) break;
    let top = f.pos.y;
    while (f.vel.y > 0) {
      run(m, 1);
      top = Math.max(top, f.pos.y);
    }
    rises.push(top - y0);
  }
  return rises;
}

describe('multi-jump (roster jump counts and air-jump heights)', () => {
  it.each([
    ['Red Ball', 4, 28],
    ['The Duck', 5, 21],
    ['Balloon Boy', 4, 24],
    ['Moby', 4, 26],
  ] as const)('%s: %i jumps, every midair jump rising %d', (name, jumps, height) => {
    const id = variant(`test-jumps-${name}`, { jumps, doubleJumpHeight: height });
    const rises = airJumpRises(id);
    expect(rises).toHaveLength(jumps - 1);
    for (const r of rises) expect(r).toBeCloseTo(height, 6);
  });

  it('airJumpHeights gives each midair jump its own height, repeating the last (Kirby-style)', () => {
    const id = variant('test-jumps-kirby', { jumps: 6, doubleJumpHeight: 21, airJumpHeights: [21, 18, 15] });
    const rises = airJumpRises(id);
    expect(rises).toHaveLength(5);
    [21, 18, 15, 15, 15].forEach((h, i) => expect(rises[i]).toBeCloseTo(h, 6));
  });
});

/** The test glider double-jumped at (x, y) with Jump held until it glides. */
function glider(x = -200, y = 110) {
  const m = testMatch({ fighter: testGlider.id });
  const f = placeInAir(m, x, y);
  until(m, (g) => g.action === 'glide', JUMP, 120);
  return { m, f };
}

/** Velocities over `frames` frames of holding `hold` (Jump is added). */
function track(m: ReturnType<typeof testMatch>, frames: number, hold: Hold = {}) {
  const f = m.fighters[0]!;
  const out: { vx: number; vy: number; y: number; action: string }[] = [];
  for (let i = 0; i < frames; i++) {
    run(m, 1, { ...hold, buttons: ['jump', ...(hold.buttons ?? [])] });
    out.push({ vx: f.vel.x, vy: f.vel.y, y: f.pos.y, action: f.action });
  }
  return out;
}

describe('glide (Papa Louie: max fall 0.6, horizontal 1.2, one per airtime)', () => {
  it('starts when Jump is held past the apex of the last midair jump', () => {
    const { f } = glider();
    expect(f.jumpsUsed).toBe(testGlider.stats.jumps);
    expect(f.mobility.glideUsed).toBe(true);
  });

  it('does not start while a midair jump is left', () => {
    const m = testMatch({ fighter: testGlider.id });
    const f = m.fighters[0]!;
    const actions = new Set<string>();
    run(m, 10, JUMP);
    while (!f.ground) {
      run(m, 1, JUMP);
      actions.add(f.action);
    }
    expect(actions).toContain('fall');
    expect(actions).not.toContain('glide');
  });

  it('a neutral glide settles at 1.2 across and never sinks faster than 0.6', () => {
    const { m, f } = glider();
    const v = track(m, 180);
    expect(v.every((s) => s.action === 'glide')).toBe(true);
    for (const s of v) {
      expect(s.vx).toBeGreaterThan(0);
      expect(s.vx).toBeLessThanOrEqual(1.2);
      expect(s.vy).toBeLessThanOrEqual(0);
      expect(s.vy).toBeGreaterThanOrEqual(-0.6);
    }
    expect(f.vel.x).toBeCloseTo(1.2, 1);
    expect(f.vel.y).toBeCloseTo(-1.2 * Math.tan((20 * Math.PI) / 180), 1);
  });

  it('diving (down) reaches the 0.6 sink cap and the 1.2 speed cap but never passes them', () => {
    const { m } = glider();
    const v = track(m, 90, { y: -100 });
    expect(Math.min(...v.map((s) => s.vy))).toBe(-0.6);
    expect(Math.max(...v.map((s) => s.vx))).toBe(1.2);
  });

  it('climbing (up) trades speed for height, then stalls into a fall', () => {
    const { m, f } = glider();
    const y0 = f.pos.y;
    const v = track(m, 90, { y: 100 });
    expect(Math.max(...v.map((s) => s.vy))).toBeGreaterThan(0);
    expect(Math.max(...v.map((s) => s.y))).toBeGreaterThan(y0);
    expect(v.at(-1)!.action).toBe('fall');
  });

  it('holding back brakes, then turns the glide around', () => {
    const { m, f } = glider();
    track(m, 60);
    const v = track(m, 90, { x: -100 });
    expect(f.facing).toBe(-1);
    expect(v.at(-1)!.vx).toBeLessThan(0);
    expect(v.every((s) => s.action === 'glide')).toBe(true);
  });

  it('Attack out of a glide is nair', () => {
    const { m, f } = glider();
    run(m, 1, { buttons: ['jump', 'attack'] });
    expect(f.action).toBe('aerial');
    expect(f.move).toBe('nair');
  });

  it('releasing Jump falls, and the glide is spent until landing', () => {
    const { m, f } = glider(-60, 60);
    run(m, 1);
    expect(f.action).toBe('fall');
    run(m, 20, JUMP);
    expect(f.action).toBe('fall');
    until(m, (g) => g.ground !== null);
    expect(f.mobility.glideUsed).toBe(false);
  });

  it('up special rises and ends in a glide while Jump is held, then helpless with its landing lag', () => {
    const m = testMatch({ fighter: testGlider.id });
    const f = m.fighters[0]!;
    run(m, 1, { y: 50, buttons: ['special'] });
    expect(f.move).toBe('upB');
    until(m, (g) => g.action === 'glide', JUMP, 60);
    expect(f.mobility.glideHelpless).toBe(true);
    run(m, 1);
    expect(f.action).toBe('helpless');
    until(m, (g) => g.action === 'land');
    expect(f.landingLag).toBe(20);
  });

  it("landing still gliding out of up special takes the move's landing lag", () => {
    const m = testMatch({ fighter: testGlider.id });
    const f = m.fighters[0]!;
    run(m, 1, { y: 50, buttons: ['special'] });
    until(m, (g) => g.action === 'glide', JUMP, 60);
    until(m, (g) => g.ground !== null, { y: -100, buttons: ['jump'] });
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(20);
  });
});

describe('float (Balloon Boy: 120 frames per airtime)', () => {
  /** Full hop holding Jump until the float starts. */
  function floater() {
    const m = testMatch({ fighter: testFloater.id });
    const f = m.fighters[0]!;
    until(m, (g) => g.action === 'float', JUMP, 120);
    return { m, f };
  }

  it('holding Jump through a full hop floats at its apex for exactly 120 frames', () => {
    const { m, f } = floater();
    expect(f.pos.y).toBeCloseTo(testFloater.stats.fullHopHeight, 6);
    const y = f.pos.y;
    let frames = 0;
    while (f.action === 'float') {
      expect(f.pos.y).toBe(y);
      frames++;
      run(m, 1, JUMP);
    }
    expect(frames).toBe(120);
    expect(f.action).toBe('fall');
    run(m, 5, JUMP);
    expect(f.pos.y).toBeLessThan(y);
  });

  it('aerials out of the float keep floating, and the float resumes after them', () => {
    const { m, f } = floater();
    run(m, 10, JUMP);
    const y = f.pos.y;
    run(m, 1, { buttons: ['jump', 'attack'] });
    expect(f.move).toBe('nair');
    while (f.action === 'aerial') {
      expect(f.pos.y).toBe(y);
      run(m, 1, JUMP);
    }
    expect(f.action).toBe('float');
    expect(f.mobility.floatFrames).toBeGreaterThan(50);
  });

  it('drifts sideways at air speed while floating', () => {
    const { m, f } = floater();
    run(m, 60, { x: 100, buttons: ['jump'] });
    expect(f.action).toBe('float');
    expect(f.vel.x).toBeCloseTo(testFloater.stats.airSpeed, 6);
  });

  it('releasing Jump ends it for the rest of the airtime; landing gives it back', () => {
    const { m, f } = floater();
    run(m, 1);
    expect(f.action).toBe('fall');
    run(m, 60, JUMP);
    expect(f.action).not.toBe('float');
    until(m, (g) => g.ground !== null);
    expect(f.mobility.floatFrames).toBe(0);
  });

  it('a fast fall ends it', () => {
    const { m, f } = floater();
    run(m, 1, { y: -100, buttons: ['jump'] });
    run(m, 1, { y: -100, buttons: ['jump'] });
    expect(f.action).toBe('fall');
    expect(f.mobility.floating).toBe(false);
  });
});

describe('fuel hover (Snail Bob: 120 frames of fuel, refills on the ground)', () => {
  const UP_B: Hold = { y: 50, buttons: ['special'] };

  it('thrusts for exactly 120 frames on a full tank, then falls without going helpless', () => {
    const m = testMatch({ fighter: testHover.id });
    const f = m.fighters[0]!;
    run(m, 1, UP_B);
    expect(f.action).toBe('hover');
    let thrust = 1;
    let top = f.pos.y;
    while (f.action === 'hover') {
      const fuel = f.mobility.hoverFuel;
      run(m, 1, { buttons: ['special'] });
      if (f.mobility.hoverFuel < fuel) thrust++;
      top = Math.max(top, f.pos.y);
    }
    expect(thrust).toBe(120);
    expect(f.mobility.hoverFuel).toBe(0);
    expect(f.action).toBe('fall');
    expect(top).toBeGreaterThan(100);
    run(m, 1, JUMP);
    expect(f.action).toBe('doubleJump');
  });

  it('a hover out of a fast fall rises, and letting go keeps rising instead of fast falling again', () => {
    const m = testMatch({ fighter: testHover.id });
    const f = placeInAir(m, 0, 150);
    run(m, 1);
    run(m, 1, { y: -100 });
    expect(f.fastFalling).toBe(true);
    run(m, 1, UP_B);
    expect(f.action).toBe('hover');
    expect(f.fastFalling).toBe(false);
    run(m, 46, { buttons: ['special'] });
    const vy = f.vel.y;
    expect(vy).toBeGreaterThan(0);
    run(m, 1);
    expect(f.action).toBe('fall');
    expect(f.fastFalling).toBe(false);
    expect(f.vel.y).toBeGreaterThan(vy - 3 * testHover.stats.gravity);
  });

  it('letting go keeps the fuel that is left for the next use', () => {
    const m = testMatch({ fighter: testHover.id });
    const f = m.fighters[0]!;
    run(m, 1, UP_B);
    run(m, 49, { buttons: ['special'] });
    run(m, 1);
    expect(f.action).toBe('fall');
    expect(f.mobility.hoverFuel).toBe(70);
    run(m, 1, UP_B);
    expect(f.action).toBe('hover');
    run(m, 100, { buttons: ['special'] });
    expect(f.mobility.hoverFuel).toBe(0);
  });

  it('refills an empty tank in 90 frames on the ground (R.O.B.: about 1.5 s)', () => {
    const m = testMatch({ fighter: testHover.id });
    const f = m.fighters[0]!;
    f.mobility.hoverFuel = 0;
    run(m, 45);
    expect(f.mobility.hoverFuel).toBeCloseTo(60, 6);
    run(m, 44);
    expect(f.mobility.hoverFuel).toBeLessThan(120);
    run(m, 1);
    expect(f.mobility.hoverFuel).toBeCloseTo(120, 6);
  });

  it('does not refill in the air', () => {
    const m = testMatch({ fighter: testHover.id });
    const f = placeInAir(m, 0, 150);
    f.mobility.hoverFuel = 10;
    run(m, 30);
    expect(f.mobility.hoverFuel).toBe(10);
  });

  it("plays the move's hitboxes: the nozzle hits on frame 6", () => {
    const m = testMatch({ fighter: testHover.id });
    const f = m.fighters[0]!;
    run(m, 1, UP_B);
    run(m, 4, { buttons: ['special'] });
    expect(f.actionFrame).toBe(5);
    expect(activeHitboxes(f)).toHaveLength(0);
    run(m, 1, { buttons: ['special'] });
    expect(activeHitboxes(f)).toHaveLength(1);
  });
});
