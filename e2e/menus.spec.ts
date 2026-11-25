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
  for (const screen of ['title', 'main', 'css', 'credits']) {
    await page.goto(`/lab.html?scene=menu&screen=${screen}`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.screen')).toHaveCount(1);
  }
});

test('credits: reachable from the main menu, names every rights holder, back returns', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.title-foot')).toContainText('Not affiliated with Coolmath Games, Nintendo');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('KeyW');
  await expect(page.locator('.menu-credits')).toHaveClass(/is-focus/);
  await page.keyboard.press('KeyS');
  await expect(page.locator('.menu-tile.is-focus')).toContainText('Smash');
  await page.locator('.menu-credits').click();
  await expect(page.locator('.credits-screen')).toBeVisible();
  await expect(page.locator('.credits-disclaimer')).toContainText('unofficial, non-commercial fan game');
  await expect(page.locator('.credits-table tbody tr')).toHaveCount(15);
  await expect(page.locator('.credits-table')).toContainText('Flipline Studios');
  await page.keyboard.press('Escape');
  await expect(page.locator('.main-menu')).toBeVisible();
});
