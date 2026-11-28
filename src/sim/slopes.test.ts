import { describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from './match';
import { marioReference } from './testing/reference';
import { placeInAir, run, type Hold } from './testing/sim';

/**
 * Forest Temple's middle is a dip: a floor 10 wide (x -5 to 5) at y -6, with a slope up to the main floor (y 0) on
 * each side, 7 wide (x 5 to 12 on the right). A fighter flying low out of the dip, rising more slowly than the slope
 * does, crosses the slope from above while it is still going up.
 */
function forestTemple(fighter: string): MatchState {
  const m = createMatch({ seed: 1, stage: 'forest-temple', stocks: 3, hazards: false, ports: [{ fighter }] });
  run(m, 10);
  return m;
}

/** Height of the right slope's surface at x, from (5, -6) to (12, 0). */
const slopeY = (x: number) => -6 + ((x - 5) * 6) / 7;

describe('flying low into a rising slope', () => {
  it("lands Duck's Running Ram on the side of Forest Temple's dip, and it runs on along the floor", () => {
    const m = forestTemple('duck');
    const f = placeInAir(m, 0, -5);
    run(m, 10);
    expect([f.ground?.kind, f.pos.y]).toEqual(['solid', -6]);
    // Tapped, as the CPU's knowledge probe fires it: it flies headfirst from frame 18, rising 1.7 at most.
    run(m, 1, { x: 60, buttons: ['special'] });
    let onSlope = false;
    let lowest = Infinity;
    for (let i = 0; i < 120 && f.move === 'sideB'; i++) {
      run(m, 1);
      if (f.pos.x > 5 && f.pos.x < 12) lowest = Math.min(lowest, f.pos.y - slopeY(f.pos.x));
      if (f.ground !== null && f.pos.x > 5 && f.pos.x < 12) onSlope = true;
    }
    run(m, 20);
    expect(onSlope).toBe(true);
    // Never under the slope's surface; before, it passed under it on frame 20 and fell out of the stage's bottom.
    expect(lowest).toBeGreaterThanOrEqual(-1e-6);
    expect(f.stocks).toBe(3);
    expect([f.ground?.kind, f.pos.y]).toEqual(['solid', 0]);
    expect(f.pos.x).toBeGreaterThan(60);
  });

  it('lands a fighter drifting low and slowly rising into the slope on it, not inside the ground', () => {
    const m = createMatch({
      seed: 1,
      stage: 'forest-temple',
      stocks: 3,
      hazards: false,
      ports: [{ fighter: marioReference.id }],
    });
    run(m, 10);
    // Just above the dip's floor, drifting right at about air speed and rising 0.3 a frame, as at the top of a small
    // hop or after a weak launch. The slope rises 0.86 for every unit across.
    const f = placeInAir(m, 3, -5.6);
    f.vel = { x: 1.2, y: 0.3 };
    const right: Hold = { x: 100 };
    let lowest = Infinity;
    for (let i = 0; i < 30 && f.ground === null; i++) {
      run(m, 1, right);
      if (f.pos.x > 5 && f.pos.x < 12) lowest = Math.min(lowest, f.pos.y - slopeY(f.pos.x));
    }
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos.x).toBeGreaterThan(5);
    expect(f.pos.x).toBeLessThan(12);
    expect(f.pos.y).toBeCloseTo(slopeY(f.pos.x), 6);
    expect(lowest).toBeGreaterThanOrEqual(-1e-6);
  });

  it('still lets a jump pass up through a soft platform and land on it', () => {
    // Battlefield's left platform is at y 24.12, above x -42. A full hop from under it rises 36.33.
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: marioReference.id }],
    });
    run(m, 10);
    const f = m.fighters[0]!;
    Object.assign(f, { pos: { x: -42, y: 0 }, prevPos: { x: -42, y: 0 } });
    run(m, 5);
    let highest = 0;
    run(m, 6, { buttons: ['jump'] });
    for (let i = 0; i < 80 && !(f.ground !== null && f.pos.y > 1); i++) {
      run(m, 1);
      highest = Math.max(highest, f.pos.y);
    }
    expect(highest).toBeGreaterThan(24.12 + 5);
    expect(f.ground?.kind).toBe('platform');
    expect(f.pos.y).toBeCloseTo(24.12, 6);
  });
});
