import { describe, expect, it } from 'vitest';
import { castSegment } from './cast';
import type { FighterState } from './fighter';
import { testMatch } from './testing/sim';

/** Two reference fighters on Battlefield's main stage: P1 at -40, P2 at 20. */
function match() {
  const m = testMatch({ players: 2 });
  const [a, b] = m.fighters as [FighterState, FighterState];
  for (const [f, x] of [
    [a, -40],
    [b, 20],
  ] as const)
    Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 } });
  return { m, a, b };
}

const none = { platforms: false, fighters: false };

describe('castSegment', () => {
  it('hits the main floor from above where the segment crosses it', () => {
    const { m } = match();
    const hit = castSegment(m, { x: -30, y: 30 }, { x: -30, y: -10 }, none);
    expect(hit).toMatchObject({
      kind: 'surface',
      t: 0.75,
      point: { x: -30, y: 0 },
      surface: { kind: 'solid' },
    });
  });

  it('hits platforms from either side only when they are on', () => {
    const { m } = match();
    const up = castSegment(m, { x: 0, y: 30 }, { x: 0, y: 60 }, { ...none, platforms: true });
    expect(up).toMatchObject({ kind: 'surface', surface: { kind: 'platform', index: 1 } });
    expect(up!.point.y).toBeCloseTo(47.19, 9);
    expect(castSegment(m, { x: 0, y: 60 }, { x: 0, y: 30 }, { ...none, platforms: true })?.kind).toBe(
      'surface',
    );
    expect(castSegment(m, { x: 0, y: 30 }, { x: 0, y: 60 }, none)).toBeNull();
  });

  it('snaps to a ledge passed within the radius from off the stage, never from on it', () => {
    const { m } = match();
    const from = { x: 100, y: -5 };
    const to = { x: 60, y: -5 };
    expect(castSegment(m, from, to, { ...none, ledges: 6 })).toMatchObject({
      kind: 'ledge',
      ledge: 1,
      point: { x: 80, y: 0 },
    });
    expect(castSegment(m, from, to, none)).toMatchObject({ kind: 'surface', point: { x: 80, y: -5 } });
    expect(castSegment(m, from, to, { ...none, ledges: 4 })?.kind).toBe('surface');
    expect(castSegment(m, { x: 70, y: 3 }, { x: 90, y: 3 }, { ...none, ledges: 6 })).toBeNull();
  });

  it('hits fighters at the edge of their hurtbox, skipping the ignored port', () => {
    const { m, b } = match();
    const fighters = { platforms: false, fighters: true };
    const hit = castSegment(m, { x: 0, y: 7 }, { x: 40, y: 7 }, fighters);
    expect(hit).toMatchObject({ kind: 'fighter', port: 1 });
    expect(hit!.point.x).toBeCloseTo(b.pos.x - 4, 6);
    expect(castSegment(m, { x: 0, y: 7 }, { x: 40, y: 7 }, { ...fighters, ignore: 1 })).toBeNull();
    expect(castSegment(m, { x: 0, y: 7 }, { x: 40, y: 7 }, none)).toBeNull();
  });

  it('returns the nearest of everything it touches', () => {
    const { m } = match();
    const hit = castSegment(m, { x: -40, y: 60 }, { x: -40, y: -10 }, { platforms: true, fighters: true });
    expect(hit).toMatchObject({ kind: 'surface', surface: { kind: 'platform', index: 0 } });
    const below = castSegment(m, { x: -40, y: 20 }, { x: -40, y: -10 }, { platforms: true, fighters: true });
    expect(below).toMatchObject({ kind: 'fighter', port: 0 });
  });
});
