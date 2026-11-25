import { describe, expect, it } from 'vitest';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../config';
import { poseBounds } from '../../render/rig/geometry';
import { samplePose } from '../../render/rig/sample';
import { art } from './art';
import { scenarios } from './scenarios';

/** Rig units that outlines reach past the shapes poseBounds measures. */
const STROKE = 0.4;
/** Pixels at the top of each sheet cell taken by its clip@frame label. */
const LABEL = 24;

describe("Johnny's lab contact sheets", () => {
  for (const s of scenarios.extra ?? []) {
    const params = s.page.kind === 'lab' ? s.page.params : undefined;
    if (!params?.states) continue;
    it(`${s.name} fits every pose inside its cell`, () => {
      const states = params.states!.split(',');
      const cols = Math.min(5, states.length);
      const w = VIEW_WIDTH / cols;
      const h = VIEW_HEIGHT / Math.ceil(states.length / cols);
      const zoom = Number(params.zoom);
      expect(zoom, 'sheets pass a fitted zoom').toBeGreaterThan(0);
      for (const state of states) {
        const [clip, frame] = state.split('@');
        expect(art.clips, state).toHaveProperty(clip!);
        const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, clip!, Number(frame), 0, params.palette));
        expect((STROKE - x0) * zoom, `${state} left`).toBeLessThanOrEqual(0.4 * w);
        expect((x1 + STROKE) * zoom, `${state} right`).toBeLessThanOrEqual(0.6 * w);
        expect((STROKE - y0) * zoom, `${state} top`).toBeLessThanOrEqual(0.8 * h - LABEL);
        expect((y1 + STROKE) * zoom, `${state} bottom`).toBeLessThanOrEqual(0.2 * h);
      }
    });
  }
});
