import { expect, test } from '@playwright/test';

test('the testbed stage moves deterministically and carries a fighter on its glider', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const run = () =>
    page.evaluate(() => {
      const s = window.__smash!;
      s.newMatch({ stage: 'testbed', seed: 3 });
      s.patch(0, { pos: { x: -5, y: 34 }, prevPos: { x: -5, y: 34 }, action: 'fall', ground: null });
      s.step(30);
      const start = s.getState();
      s.step(240);
      const end = s.getState();
      return {
        ground: end.fighters[0]!.ground,
        glider: [start.stage.platforms[0]!.x, end.stage.platforms[0]!.x],
        rider: [start.fighters[0]!.pos.x, end.fighters[0]!.pos.x],
        hash: s.hash(),
      };
    });
  const first = await run();
  expect(first.ground).toEqual({ kind: 'platform', index: 0 });
  expect(first.glider[1]! - first.glider[0]!).toBeCloseTo(55, 6);
  expect(first.rider[1]! - first.rider[0]!).toBeCloseTo(55, 6);
  expect((await run()).hash).toBe(first.hash);
  await page.evaluate(() => window.__smash!.render());
  await expect(page.locator('canvas')).toBeVisible();
});
