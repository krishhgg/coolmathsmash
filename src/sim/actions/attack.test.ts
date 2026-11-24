import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { defineFighter } from '../../fighters/types';
import { marioReference } from '../testing/reference';
import { placeInAir, run, testMatch } from '../testing/sim';

/** A test fighter whose neutral special has an air variant and whose side special does not. */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'test-air-variant',
    moves: {
      neutralB: {
        kind: 'other',
        faf: 30,
        air: 'neutralBAir',
        hits: [
          {
            frames: [5, 6],
            boxes: [{ id: 0, x: 8, y: 2, radius: 4, damage: 8, angle: 90, kbg: 80, bkb: 40 }],
          },
        ],
      },
      neutralBAir: {
        kind: 'other',
        faf: 20,
        hits: [
          {
            frames: [3, 4],
            boxes: [{ id: 0, x: 6, y: 6, radius: 4, damage: 4, angle: 45, kbg: 50, bkb: 30 }],
          },
        ],
      },
      sideB: { kind: 'other', faf: 25, hits: [] },
    },
  }),
);

describe('ground/air move variants (MoveDef.air)', () => {
  it('a special started on the ground plays the move itself', () => {
    const m = testMatch({ fighter: 'test-air-variant' });
    run(m, 1, { buttons: ['special'] });
    expect(m.fighters[0]!.move).toBe('neutralB');
    expect(m.fighters[0]!.action).toBe('attack');
  });

  it('started in the air it plays the variant, which the move event names', () => {
    const m = testMatch({ fighter: 'test-air-variant' });
    const f = placeInAir(m, 0, 60);
    run(m, 1, { buttons: ['special'] });
    expect(f.move).toBe('neutralBAir');
    expect(f.action).toBe('aerial');
    expect(m.events).toContainEqual({ type: 'move', port: 0, move: 'neutralBAir' });
    expect(m.events.some((e) => e.type === 'move' && e.move === 'neutralB')).toBe(false);
  });

  it('a move without a variant plays as itself in the air', () => {
    const m = testMatch({ fighter: 'test-air-variant' });
    const f = placeInAir(m, 0, 60);
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f.move).toBe('sideB');
  });
});
