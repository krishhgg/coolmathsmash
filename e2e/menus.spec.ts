import { expect, test } from '@playwright/test';

test('title, main menu, character select and back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.title-screen')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await expect(page.locator('.menu-tile.is-focus')).toContainText('Smash');
  await page.keyboard.press('KeyF');
  await expect(page.locator('.css-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.title-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('menu lab scene shows each screen', async ({ page }) => {
  for (const screen of ['title', 'main', 'css']) {
    await page.goto(`/lab.html?scene=menu&screen=${screen}`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.screen')).toHaveCount(1);
  }
});
