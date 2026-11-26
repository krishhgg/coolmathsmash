import type { Container, Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { tetherOrigin } from '../sim/actions/tether';
import type { FighterState } from '../sim/fighter';
import type { MatchState } from '../sim/match';
import { tetherTester } from '../sim/testing/tethers';
import { placeInAir, run, testMatch, type Hold } from '../sim/testing/sim';
import { ReticleView } from './reticle';

/** Where `view` draws the one fighter's reticle in world units (y up, like the sim), or null when it draws none. */
function drawn(view: ReticleView, m: MatchState): { x: number; y: number } | null {
  view.draw(m, 1);
  const shown = (view.container.children as Container[]).filter((c) => c.visible);
  if (shown.length === 0) return null;
  expect(shown).toHaveLength(1);
  const { x, y } = shown[0]!.position;
  return { x, y: -y };
}

/** Where the reticle belongs: the fighter's hand plus its aim. */
function aimPoint(f: FighterState): { x: number; y: number } {
  const o = tetherOrigin(f);
  return { x: o.x + f.aim!.x, y: o.y + f.aim!.y };
}

describe('the aimed tether reticle', () => {
  it("draws Fluffy's reticle at Point Grapple's aim as the stick walks it, and at the target while the line flies", () => {
    const m = testMatch({ fighter: 'fluffy' });
    const f = placeInAir(m, -60, 80);
    const view = new ReticleView();
    expect(drawn(view, m)).toBeNull();
    const step = (frames: number, hold: Hold) => {
      for (let i = 0; i < frames; i++) {
        run(m, 1, hold);
        expect(f.aim).not.toBeNull();
        const at = drawn(view, m)!;
        const want = aimPoint(f);
        expect(at.x).toBeCloseTo(want.x, 9);
        expect(at.y).toBeCloseTo(want.y, 9);
      }
    };
    run(m, 1, { buttons: ['special'] });
    expect(f.move).toBe('neutralB');
    // Out to the right, then up, then back left past him: the drawing follows each step of the aim.
    step(8, { x: 100, buttons: ['special'] });
    expect(f.aim).toEqual({ x: 48, y: 0 });
    step(6, { y: 100, buttons: ['special'] });
    expect(f.aim).toEqual({ x: 48, y: 36 });
    step(20, { x: -100, buttons: ['special'] });
    expect(f.aim!.x).toBeLessThan(0);
    expect(f.facing).toBe(-1);
    // Released: the line flies to the reticle, which stays on the target until the line anchors.
    const target = aimPoint(f);
    step(1, {});
    expect(f.tether?.kind).toBe('out');
    for (let i = 0; i < 30 && f.tether?.kind === 'out'; i++) {
      run(m, 1);
      if (f.tether?.kind !== 'out') break;
      expect(drawn(view, m)!.x).toBeCloseTo(aimPoint(f).x, 9);
    }
    expect(target.x).toBeLessThan(f.pos.x);
    expect(f.action).toBe('tetherPull');
    expect(drawn(view, m)).toBeNull();
  });

  it('draws it in the costume of the port that aims, swapping the drawing when the costume changes', () => {
    const m = testMatch({ fighter: 'fluffy' });
    const f = placeInAir(m, -60, 80);
    const view = new ReticleView();
    run(m, 1, { buttons: ['special'] });
    run(m, 4, { x: 100, buttons: ['special'] });
    view.draw(m, 1, ['default']);
    const first = (view.container.children[0] as Container).children[0] as Graphics;
    expect(first.context.instructions.length).toBeGreaterThan(0);
    view.draw(m, 1, ['xmas']);
    expect(view.container.children).toHaveLength(1);
    expect((view.container.children[0] as Container).children[0]).not.toBe(first);
    expect(f.aim).not.toBeNull();
  });

  it("draws none for Quick Grapple, whose line isn't aimed, or for a fighter whose art has no reticle", () => {
    const m = testMatch({ fighter: 'fluffy' });
    const f = placeInAir(m, -60, 80);
    const view = new ReticleView();
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    for (let i = 0; i < 12; i++) {
      run(m, 1);
      expect(drawn(view, m)).toBeNull();
    }
    expect(f.tether).not.toBeNull();

    const t = testMatch({ fighter: tetherTester.id });
    const g = placeInAir(t, -60, 80);
    run(t, 1, { buttons: ['special'] });
    run(t, 4, { x: 100, buttons: ['special'] });
    expect(g.aim).not.toBeNull();
    expect(drawn(view, t)).toBeNull();
  });
});
