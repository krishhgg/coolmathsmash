import { expect, test } from '@playwright/test';

test('lab lists scenes and mounts one', async ({ page }) => {
  await page.goto('/lab.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const scenes = await page.evaluate(() => window.__lab!.scenes);
  expect(scenes).toContain('inputs');
  await page.goto('/lab.html?scene=inputs');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => window.__lab!.scene)).toBe('inputs');
});
