import { expect, test } from '@playwright/test';

test("Fireboy's fireball is an entity in the match state and hits P2", async ({ page }) => {
  await page.goto('/?harness&hitboxes');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(async () => {
    const s = window.__smash!;
    s.newMatch({ ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }] });
    s.patch(0, { pos: { x: -30, y: 0 }, facing: 1 });
    s.patch(1, { pos: { x: 10, y: 0 }, facing: -1 });
    s.step(10);
    s.runScript([{ port: 0, from: 10, to: 11, buttons: ['special'] }], 27);
    const spawned = s.getState().entities;
    s.step(60);
    const hit = s.getState();
    await s.render();
    return { spawned, damage: hit.fighters[1]!.damage, left: hit.entities.length };
  });
  expect(r.spawned).toHaveLength(1);
  expect(r.spawned[0]).toMatchObject({ kind: 'fireboy/fireball', owner: 0, age: 1 });
  expect(r.damage).toBeCloseTo(5.5 * 1.05 * 1.2, 5);
  expect(r.left).toBe(0);
});
