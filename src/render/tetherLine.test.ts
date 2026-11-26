import type { Container, Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { getFighter } from '../fighters/registry';
import { tetherOrigin } from '../sim/actions/tether';
import type { FighterState } from '../sim/fighter';
import { createMatch, type MatchState } from '../sim/match';
import { placeInAir, run, runPorts, testMatch, type Hold } from '../sim/testing/sim';
import type { Vec } from '../sim/vec';
import { TetherLineView } from './tetherLine';

/**
 * Where `view` draws the one tether line, in world units with y up like the sim: the stretched line's two ends and
 * the tip's centre. Null when it draws none.
 */
function drawn(view: TetherLineView, m: MatchState): { from: Vec; to: Vec; tip: Vec } | null {
  view.draw(m, 1);
  const lines = (view.behind.children as Container[]).filter((c) => c.visible);
  const tips = (view.front.children as Container[]).filter((c) => c.visible);
  expect(lines.length).toBe(tips.length);
  if (lines.length === 0) return null;
  expect(lines).toHaveLength(1);
  const stretch = lines[0]!.children[0] as Graphics;
  expect(stretch.context.instructions.length).toBeGreaterThan(0);
  const up = (p: { x: number; y: number }) => ({ x: p.x, y: -p.y });
  const from = up(lines[0]!.position);
  const tip = up(tips[0]!.position);
  // A line with the hand on its end (a hang, or the arrival) is too short to draw: only the tip shows.
  if (!stretch.visible) {
    expect(Math.hypot(tip.x - from.x, tip.y - from.y)).toBeLessThan(0.01);
    return { from, to: tip, tip };
  }
  return { from: up(stretch.toGlobal({ x: 0, y: 0 })), to: up(stretch.toGlobal({ x: 1, y: 0 })), tip };
}

/** Each frame, the drawn line runs from the hand to the tether's end, and nothing is drawn without a tether. */
function expectLine(view: TetherLineView, m: MatchState, f: FighterState): { from: Vec; to: Vec } | null {
  const at = drawn(view, m);
  if (!f.tether) {
    expect(at).toBeNull();
    return null;
  }
  const hand = tetherOrigin(f);
  const end = f.tether.anchor;
  expect(at).not.toBeNull();
  for (const [p, q] of [
    [at!.from, hand],
    [at!.to, end],
    [at!.tip, end],
  ] as const) {
    expect(p.x).toBeCloseTo(q.x, 6);
    expect(p.y).toBeCloseTo(q.y, 6);
  }
  return at;
}

/** Degrees up from level of the line from `from` to `to`, measured on Fluffy's facing side. */
const elevation = ({ from, to }: { from: Vec; to: Vec }, facing: number) =>
  (Math.atan2(to.y - from.y, (to.x - from.x) * facing) * 180) / Math.PI;

describe('the tether line, drawn from game state', () => {
  it('runs level from the hand to the shot, then to Fireboy, and reels in as Fluffy closes', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'fluffy' }, { fighter: 'fireboy' }],
    });
    runPorts(m, 10, [{}, {}]);
    const [f, v] = m.fighters as [FighterState, FighterState];
    Object.assign(f, { pos: { x: -50, y: 0 }, prevPos: { x: -50, y: 0 }, facing: 1 });
    Object.assign(v, { pos: { x: 20, y: 0 }, prevPos: { x: 20, y: 0 }, facing: -1 });
    const view = new TetherLineView();
    const step = (hold: Hold) => {
      runPorts(m, 1, [hold, {}]);
      return expectLine(view, m, f);
    };
    step({ buttons: ['special'] });
    for (let i = 0; i < 12; i++) step({ x: 100, buttons: ['special'] });
    expect(f.aim).toEqual({ x: 72, y: 0 });
    const lengths: number[] = [];
    const kinds = new Set<string>();
    for (let i = 0; i < 60 && (lengths.length === 0 || f.tether); i++) {
      const at = step({});
      if (!at) continue;
      kinds.add(f.tether!.kind);
      expect(elevation(at, f.facing)).toBeCloseTo(0, 6);
      lengths.push(Math.hypot(at.to.x - at.from.x, at.to.y - at.from.y));
    }
    expect([...kinds]).toEqual(['out', 'fighter']);
    expect(Math.max(...lengths)).toBeGreaterThan(55);
    // Out to Fireboy, then shorter every frame of the reel until the kick.
    const peak = lengths.indexOf(Math.max(...lengths));
    for (let i = peak + 1; i < lengths.length; i++) expect(lengths[i]!).toBeLessThanOrEqual(lengths[i - 1]!);
    expect(lengths.at(-1)!).toBeLessThan(10);
    expect(m.fighters[1]!.damage).toBeGreaterThan(0);
    expect(drawn(view, m)).toBeNull();
  });

  it('runs 45 degrees up to the shot and the sky anchor, facing either way', () => {
    for (const facing of [1, -1] as const) {
      const m = testMatch({ fighter: 'fluffy' });
      const f = placeInAir(m, -40 * facing, 60, facing);
      const view = new TetherLineView();
      run(m, 1, { buttons: ['special'] });
      run(m, 2, { x: 100 * facing, y: 100, buttons: ['special'] });
      run(m, 1, { x: 100 * facing, y: 100 });
      let frames = 0;
      for (let i = 0; i < 80 && (frames === 0 || f.tether); i++) {
        run(m, 1);
        const at = expectLine(view, m, f);
        if (!at || Math.hypot(at.to.x - at.from.x, at.to.y - at.from.y) < 1) continue;
        frames++;
        // 45 degrees from the hand when it fired; he falls a little after each frame's line step, so a touch steeper.
        expect(Math.abs(elevation(at, f.facing) - 45)).toBeLessThan(3);
      }
      expect(frames).toBeGreaterThan(30);
      expect(f.skyAnchorsUsed).toBe(1);
    }
  });

  it('flies out and is gone after a whiff, for the rest of the move', () => {
    const m = testMatch({ fighter: 'fluffy' });
    const f = placeInAir(m, -40, 80);
    // All of his sky anchors spent. (Importing fluffy/moves first would load Fluffy before the registry.)
    f.skyAnchorsUsed = getFighter('fluffy').moves!.neutralB!.tether!.skyAnchors!;
    const view = new TetherLineView();
    run(m, 1, { buttons: ['special'] });
    run(m, 2, { x: 100, buttons: ['special'] });
    run(m, 1, { x: 100 });
    let flying = 0;
    let after = 0;
    for (let i = 0; i < 60 && f.move === 'neutralB'; i++) {
      run(m, 1);
      const at = expectLine(view, m, f);
      if (at) flying++;
      else if (flying > 0) after++;
    }
    // Out for 11 of its 12 travel frames: on the 12th it reaches full range, finds nothing and is let go.
    expect(flying).toBe(11);
    expect(after).toBeGreaterThan(10);
    expect(f.move).toBeNull();
  });
});

describe('the Quick Grapple line, drawn from game state', () => {
  /** Quick Grapple's tether, read through the registry (importing fluffy/moves first would load Fluffy too early). */
  const quick = () => getFighter('fluffy').moves!.upB!.tether!;
  const length = ({ from, to }: { from: Vec; to: Vec }) => Math.hypot(to.x - from.x, to.y - from.y);

  /**
   * Quick Grapple from the air at (x, y), the stick held `stick` towards his facing after the press. Checks the drawn
   * line against the tether on every frame until the move and its reel end, and returns what each frame drew.
   */
  function grapple(
    x: number,
    y: number,
    facing: 1 | -1,
    o: { stick?: number; skyAnchorsUsed?: number } = {},
  ) {
    const m = testMatch({ fighter: 'fluffy' });
    const f = placeInAir(m, x, y, facing);
    if (o.skyAnchorsUsed !== undefined) f.skyAnchorsUsed = o.skyAnchorsUsed;
    const view = new TetherLineView();
    run(m, 1, { y: 100, buttons: ['special'] });
    expect(f.move).toBe('upB');
    const seen: { at: { from: Vec; to: Vec } | null; kind: string | null }[] = [];
    for (let i = 0; i < 90 && f.move === 'upB'; i++) {
      run(m, 1, { x: (o.stick ?? 0) * facing });
      seen.push({ at: expectLine(view, m, f), kind: f.tether?.kind ?? null });
    }
    expect(f.move).toBeNull();
    expect(drawn(view, m)).toBeNull();
    const lines = seen.flatMap((s) => (s.at ? [{ ...s.at, kind: s.kind! }] : []));
    return { f, lines, kinds: [...new Set(lines.map((l) => l.kind))], frames: seen.length };
  }

  /** Longer each frame up to the longest, then shorter each frame after it: out, then reeled in. */
  function expectOutThenIn(lengths: number[]) {
    const peak = lengths.indexOf(Math.max(...lengths));
    for (let i = 1; i <= peak; i++) expect(lengths[i]!).toBeGreaterThan(lengths[i - 1]!);
    for (let i = peak + 1; i < lengths.length; i++) expect(lengths[i]!).toBeLessThanOrEqual(lengths[i - 1]!);
  }

  it('runs straight up 120 units to the sky anchor and shortens as Fluffy reels, facing either way', () => {
    for (const facing of [1, -1] as const) {
      const { f, lines, kinds } = grapple(-150 * facing, -20, facing);
      expect(kinds).toEqual(['out', 'sky']);
      for (const at of lines) if (length(at) >= 1) expect(elevation(at, facing)).toBeCloseTo(90, 6);
      const lengths = lines.map(length);
      expect(Math.max(...lengths)).toBeCloseTo(quick().range, 6);
      expectOutThenIn(lengths);
      expect(lengths.at(-1)!).toBeLessThan(1);
      expect(f.action).toBe('helpless');
    }
  });

  it('bends 30 degrees forward with the stick and keeps that angle through the reel, facing either way', () => {
    for (const facing of [1, -1] as const) {
      const { lines, kinds } = grapple(-150 * facing, -20, facing, { stick: 100 });
      expect(kinds).toEqual(['out', 'sky']);
      const steep = lines.filter((at) => length(at) >= 1);
      expect(steep.length).toBeGreaterThan(30);
      // He drifts forward a little after each frame's line step while it flies, so the line leans a touch past 60.
      for (const at of steep)
        expect(Math.abs(elevation(at, facing) - (90 - quick().stickAdjust!))).toBeLessThan(2);
      expectOutThenIn(lines.map(length));
    }
  });

  it('catches the ledge from below: up the shot, then onto the corner, and gone at the ledge grab', () => {
    const { f, lines, kinds } = grapple(88, -40, -1);
    expect(kinds).toEqual(['out', 'ledge']);
    for (const at of lines.filter((l) => l.kind === 'out' && length(l) >= 1))
      expect(elevation(at, -1)).toBeCloseTo(90, 6);
    for (const at of lines.filter((l) => l.kind === 'ledge')) {
      expect(at.to.x).toBeCloseTo(80, 6);
      expect(at.to.y).toBeCloseTo(0, 6);
    }
    expectOutThenIn(lines.filter((l) => l.kind === 'ledge').map(length));
    expect(f.action).toBe('ledgeCatch');
  });

  it('flies out and is gone after a miss, for the rest of the move', () => {
    const { f, lines, kinds, frames } = grapple(150, -20, -1, { skyAnchorsUsed: quick().skyAnchors });
    expect(kinds).toEqual(['out']);
    // Out on the shot and 8 frames more: on its 10th travel frame it reaches full range, finds nothing and is let go.
    expect(lines).toHaveLength(quick().travel - 1);
    expect(frames - lines.length).toBeGreaterThan(20);
    expect(f.action).toBe('helpless');
    expectOutThenIn(lines.map(length));
    for (const at of lines) if (length(at) >= 1) expect(elevation(at, -1)).toBeCloseTo(90, 6);
  });
});
