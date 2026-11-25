import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { defineFighter } from '../../fighters/types';
import { KEYBOARD_BINDINGS } from '../../input/bindings';
import { KeyboardState } from '../../input/keyboard';
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

/** Specials in all four directions, for the stick-angle rules. */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'test-specials',
    moves: Object.fromEntries(
      ['neutralB', 'sideB', 'upB', 'downB'].map((name) => [
        name,
        { kind: 'other' as const, faf: 30, hits: [] },
      ]),
    ),
  }),
);

describe('special directions (Ultimate: up/down from 0.5 of the stick, side from 0.6)', () => {
  const keys = (codes: string[]) => {
    const k = new KeyboardState();
    for (const code of codes) k.keyDown(code);
    return k.read(KEYBOARD_BINDINGS[0]!);
  };
  const special = (stick: { x: number; y: number }, air = false) => {
    const m = testMatch({ fighter: 'test-specials' });
    if (air) placeInAir(m, 0, 60);
    run(m, 1, { x: stick.x, y: stick.y, buttons: ['special'] });
    return m.fighters[0]!.move;
  };
  const p1 = KEYBOARD_BINDINGS[0]!;

  it('a keyboard up + side is an up special, on the ground and in the air, whichever key went down first', () => {
    for (const order of [
      [p1.up[0]!, p1.right[0]!],
      [p1.right[0]!, p1.up[0]!],
      [p1.left[0]!, p1.up[0]!],
    ]) {
      expect(special(keys(order))).toBe('upB');
      expect(special(keys(order), true)).toBe('upB');
    }
  });

  it('a keyboard down + side is a down special', () => {
    expect(special(keys([p1.down[0]!, p1.right[0]!]))).toBe('downB');
  });

  it('side special needs the stick 0.6 sideways and under half way up or down', () => {
    expect(special({ x: 100, y: 0 })).toBe('sideB');
    expect(special({ x: 100, y: 45 })).toBe('sideB');
    expect(special({ x: 60, y: 0 })).toBe('sideB');
    expect(special({ x: 55, y: 0 })).toBe('neutralB');
    expect(special({ x: 30, y: 50 })).toBe('upB');
  });
});
