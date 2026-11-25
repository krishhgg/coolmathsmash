import { expect, test } from '@playwright/test';

test('stage scene renders at a camera and toggles the collision overlay', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/lab.html?scene=stage&x=0&y=20&zoom=4.5&collision=1');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(async () => {
    await window.__lab!.call('camera', -170, -80, 9);
    await window.__lab!.call('frame', 600);
    await window.__lab!.call('collision', false);
    await window.__lab!.call('camera', 170, 130, 2.5);
  });
  expect(errors).toEqual([]);
});
