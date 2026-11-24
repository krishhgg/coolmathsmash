import { expect, test } from '@playwright/test';

test('character select: pick, join a second keyboard, add and remove a CPU', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.css-screen')).toBeVisible();
  await expect(page.locator('.css-panel')).toHaveCount(2);
  await expect(page.locator('.css-ready')).toBeHidden();

  await page.keyboard.press('KeyF');
  await expect(page.locator('.css-panel').first().locator('.css-name')).toHaveText('Fireboy');
  await expect(page.locator('.css-ready')).toBeVisible();

  await page.keyboard.press('KeyJ');
  await expect(page.locator('.css-panel')).toHaveCount(3);
  await expect(page.locator('.css-panel').nth(2)).toContainText('Keyboard 2');
  await expect(page.locator('.css-ready')).toBeHidden();

  await page.keyboard.press('KeyG');
  await expect(page.locator('.css-panel').first().locator('.css-name')).toHaveText('Choose');

  await page.locator('.css-add').click();
  await expect(page.locator('.css-panel')).toHaveCount(4);
  await expect(page.locator('.css-add')).toHaveCount(0);
  await page.locator('.css-panel').nth(3).locator('.css-remove').click();
  await expect(page.locator('.css-panel')).toHaveCount(3);

  await page.keyboard.press('Escape');
  await expect(page.locator('.main-menu')).toBeVisible();
  expect(errors).toEqual([]);
});
