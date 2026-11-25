import { expect, test } from '@playwright/test';

test('the hazard testbed: lava spares Fireboy and burns Watergirl, and hazards off spares both', async ({
  page,
}) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const run = (hazards: boolean) =>
    page.evaluate((hazards) => {
      const s = window.__smash!;
      s.newMatch({
        stage: 'hazard-testbed',
        hazards,
        seed: 5,
        ports: [{ fighter: 'fireboy' }, { fighter: 'watergirl' }, { fighter: 'fireboy' }],
      });
      for (const [port, x] of [
        [0, -50],
        [1, -44],
        [2, 80],
      ] as const)
        s.patch(port, { pos: { x, y: 0.001 }, prevPos: { x, y: 0.001 } });
      s.step(60);
      const st = s.getState();
      return {
        damage: st.fighters.map((f) => f.damage),
        actions: st.fighters.map((f) => f.action),
        hash: s.hash(),
      };
    }, hazards);
  const on = await run(true);
  expect(on.damage).toEqual([0, 12, 0]);
  expect(on.actions[1]).toBe('tumble');
  expect((await run(true)).hash).toBe(on.hash);
  const off = await run(false);
  expect(off.damage).toEqual([0, 0, 0]);
  await page.evaluate(() => window.__smash!.render());
  await expect(page.locator('canvas')).toBeVisible();
});
