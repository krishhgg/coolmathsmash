import { Container, type Application } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import type { RigView } from '../../render/rig/view';

const views: RigView[] = [];
vi.mock('../../render/rig/view', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../render/rig/view')>();
  return {
    ...real,
    createRigView: (...args: Parameters<typeof real.createRigView>) => {
      const view = real.createRigView(...args);
      views.push(view);
      return view;
    },
  };
});

const { scene } = await import('./fighter');

async function mount(query: string) {
  views.length = 0;
  const app = { stage: new Container(), ticker: { add() {} } } as unknown as Application;
  await scene.mount(app, new URLSearchParams(query));
  return scene.api as { show(clip: string, frame: number): unknown; sheet(states?: string[]): unknown };
}

/** The rig's `under` slots sit in the scene just behind its body, at the body's scale, as the game draws them. */
function expectUnderBehindBody(view: RigView) {
  const parent = view.container.parent;
  expect(parent).toBeTruthy();
  expect(view.under.parent).toBe(parent);
  expect(parent!.getChildIndex(view.under)).toBeLessThan(parent!.getChildIndex(view.container));
  expect(view.under.scale.x).toBe(view.container.scale.x);
  expect(view.under.scale.y).toBe(view.container.scale.y);
}

describe('fighter lab scene', () => {
  // Tunnel Flip's tunnel is Runner's `fxUnder` slot (Slot.under), drawn on move frames 40-61.
  it('draws the under slots behind the fighter in a single view', async () => {
    const api = await mount('fighter=runner');
    api.show('finalSmash', 50);
    const view = views.at(-1)!;
    expectUnderBehindBody(view);
    expect(view.under.children.some((c) => c.visible)).toBe(true);
  });

  it('draws the under slots behind the fighter in every contact sheet cell', async () => {
    const api = await mount('fighter=runner');
    views.length = 0;
    api.sheet(['idle@0', 'finalSmash@50']);
    expect(views).toHaveLength(2);
    views.forEach(expectUnderBehindBody);
    expect(views[1]!.under.children.some((c) => c.visible)).toBe(true);
  });
});
