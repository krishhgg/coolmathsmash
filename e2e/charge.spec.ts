import { expect, test } from '@playwright/test';

test('the harness registers the charge test fighter, and a stored charge glows', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const stored = await page.evaluate(() => {
    const s = window.__smash!;
    s.newMatch({ ports: [{ fighter: 'test-charger' }, { fighter: 'fireboy' }] });
    s.step(10);
    const start = s.frame();
    s.runScript(
      [
        { port: 0, from: start, to: start + 40, buttons: ['special'] },
        { port: 0, from: start + 40, to: start + 41, buttons: ['special', 'shield'] },
      ],
      start + 70,
    );
    return s.getState().fighters[0]!.storedCharge;
  });
  expect(stored?.move).toBe('neutralB');
  expect(stored?.frames).toBeGreaterThan(20);
  const canvas = page.locator('#app canvas');
  await page.evaluate(() => window.__smash!.render());
  const glowing = await canvas.screenshot();
  await page.evaluate(async () => {
    window.__smash!.patch(0, { storedCharge: null });
    await window.__smash!.render();
  });
  expect(glowing.equals(await canvas.screenshot())).toBe(false);
});

test('a charging move glows', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(async () => {
    const s = window.__smash!;
    s.newMatch({ ports: [{ fighter: 'test-charger' }, { fighter: 'fireboy' }] });
    s.step(10);
    const start = s.frame();
    s.runScript([{ port: 0, from: start, to: start + 60, buttons: ['special'] }], start + 40);
    await s.render();
  });
  const canvas = page.locator('#app canvas');
  const glowing = await canvas.screenshot();
  const charge = await page.evaluate(async () => {
    const charge = window.__smash!.getState().fighters[0]!.charge;
    window.__smash!.patch(0, { charge: 0 });
    await window.__smash!.render();
    return charge;
  });
  expect(charge).toBeGreaterThan(20);
  expect(glowing.equals(await canvas.screenshot())).toBe(false);
});
