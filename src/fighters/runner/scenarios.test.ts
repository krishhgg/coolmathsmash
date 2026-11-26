import { describe, expect, it } from 'vitest';
// Keep this import before Runner's own modules: the harness loads her scenarios.ts before the fighter registry, as
// it does in Node scripts, so a scenarios.ts that imports her moves leaves her registered without them.
import { planScenario, type GameScenario } from '../../harness/scenarios';
import { sheetLayout } from '../../lab/sheet';
import { poseBounds } from '../../render/rig/geometry';
import { samplePose } from '../../render/rig/sample';
import { art } from './art';
import { moves } from './moves';
import { scenarios } from './scenarios';

/** Rig units that outlines reach past the shapes poseBounds measures. */
const STROKE = 0.4;
/** Pixels at the top of each sheet cell taken by its clip@frame label. */
const LABEL = 24;

/** Every lab sheet with its own states and zoom: its name, its `clip@frame` states, and its zoom. */
const sheets = (scenarios.extra ?? []).flatMap((s) => {
  const params = s.page.kind === 'lab' ? s.page.params : undefined;
  if (!params?.states || !params.zoom) return [];
  return [{ name: s.name, states: params.states.split(','), zoom: Number(params.zoom) }];
});

describe("Runner's lab contact sheets", () => {
  for (const { name, states, zoom } of sheets) {
    it(`${name} fits every pose inside its cell`, () => {
      const { w, h } = sheetLayout(states.length);
      for (const state of states) {
        const [clip, frame] = state.split('@');
        expect(art.clips, state).toHaveProperty(clip!);
        const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, clip!, Number(frame), 0));
        expect((STROKE - x0) * zoom, `${state} left`).toBeLessThanOrEqual(0.4 * w);
        expect((x1 + STROKE) * zoom, `${state} right`).toBeLessThanOrEqual(0.6 * w);
        expect((STROKE - y0) * zoom, `${state} top`).toBeLessThanOrEqual(0.8 * h - LABEL);
        expect((y1 + STROKE) * zoom, `${state} bottom`).toBeLessThanOrEqual(0.2 * h);
      }
    });
  }

  it('shows every move on its first hit frame (or its pummel or throw frame)', () => {
    const shown = new Map(
      sheets.flatMap(({ states }) => states.map((s) => s.split('@') as [string, string])),
    );
    for (const [name, move] of Object.entries(moves)) {
      const first = move.hits[0]?.frames[0] ?? move.throw?.frame ?? move.pummel?.frame;
      expect(shown.get(name), name).toBe(String(first));
    }
  });
});

describe("Runner's game scenarios", () => {
  const games = (scenarios.extra ?? []).filter((s): s is GameScenario => s.page.kind === 'game');

  it('cover every special move, on the ground and in the air', () => {
    const required = new Set(games.flatMap((s) => s.requires ?? []));
    for (const move of ['neutralB', 'neutralBAir', 'upB', 'downB', 'downBAir'])
      expect(required.has(`move:${move}`), move).toBe(true);
  });

  it.each(games.map((s) => [s.name, s] as const))('%s plays its move and reaches its capture', (_, s) => {
    const plan = planScenario(s);
    expect(plan.status, plan.reason).toBe('captured');
  });
});
