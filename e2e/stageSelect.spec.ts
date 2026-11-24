import { expect, test } from '@playwright/test';

test('stage select: preview follows focus, rules change and stick, back and choose', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.css-screen')).toBeVisible();
  await page.keyboard.press('KeyF');
  await expect(page.locator('.css-ready')).toBeVisible();
  await page.keyboard.press('Enter');

  await expect(page.locator('.ss-screen')).toBeVisible();
  const tiles = page.locator('.ss-tile');
  await expect(tiles.first()).toHaveAttribute('data-stage', 'random');
  await expect(tiles.nth(1)).toHaveAttribute('data-stage', 'battlefield');
  await expect(page.locator('.ss-slot')).toHaveCount(0);
  const focused = page.locator('.ss-tile.is-focus');
  await expect(focused).toHaveAttribute('data-stage', 'battlefield');
  await expect(page.locator('.ss-preview-name')).toHaveText('Coolmath Battlefield');
  await expect(page.locator('.ss-pill-text')).toHaveText('3 Stock · 7:00');
  await expect(page.locator('.ss-pill-badge')).toBeHidden();
  const footer = page.locator('.ss-screen .footer-hints');
  await expect(footer).toContainText('Choose stage');
  await expect(footer).not.toContainText('Change rule');

  await page.keyboard.press('KeyA');
  await expect(focused).toHaveAttribute('data-stage', 'random');
  await expect(page.locator('.ss-preview-name')).toHaveText('Random');

  const row = (rule: string) => page.locator(`.ss-rule[data-rule="${rule}"]`);
  await expect(row('stocks').locator('.ss-arrow.is-right')).toHaveCSS('opacity', '0');
  await page.keyboard.press('KeyS');
  await expect(row('stocks')).toHaveClass(/is-focus/);
  await expect(row('stocks').locator('.ss-arrow.is-right')).toHaveCSS('opacity', '1');
  await expect(row('minutes').locator('.ss-arrow.is-right')).toHaveCSS('opacity', '0');
  await expect(footer).toContainText('Change rule');
  await expect(footer).not.toContainText('Choose stage');
  await page.keyboard.press('KeyD');
  await expect(row('stocks').locator('.ss-rule-value')).toHaveText('4');
  await page.keyboard.press('KeyS');
  await page.keyboard.press('KeyA');
  await expect(row('minutes').locator('.ss-rule-value')).toHaveText('6:00');
  await page.keyboard.press('KeyS');
  await page.keyboard.press('KeyT');
  await expect(row('items').locator('.ss-rule-value')).toHaveText('On');
  await expect(page.locator('.ss-pill-badge')).toBeVisible();
  await row('stocks').locator('.ss-arrow.is-right').click();
  await expect(row('stocks').locator('.ss-rule-value')).toHaveText('5');
  await expect(page.locator('.ss-pill-text')).toHaveText('5 Stock · 6:00');
  await page.keyboard.press('KeyA');
  await expect(row('stocks').locator('.ss-rule-value')).toHaveText('4');
  await page.keyboard.press('Enter');
  await expect(row('stocks').locator('.ss-rule-value')).toHaveText('5');

  await page.keyboard.press('KeyG');
  await expect(page.locator('.css-screen .header-plate')).toHaveText('5 Stock · 6:00');
  await page.keyboard.press('Enter');
  await expect(row('items').locator('.ss-rule-value')).toHaveText('On');
  await page.locator('.ss-screen .back-tab').click();
  await expect(page.locator('.css-screen')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(focused).toHaveAttribute('data-stage', 'battlefield');

  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyF');
  await expect(page.locator('.ss-screen')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('stage select lab presets: custom rules with Random last picked', async ({ page }) => {
  await page.goto('/lab.html?scene=menu&screen=stages&preset=rules');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.ss-pill-text')).toHaveText('2 Stock · 5:00');
  await expect(page.locator('.ss-pill-badge')).toBeVisible();
  await expect(page.locator('.ss-tile.is-focus')).toHaveAttribute('data-stage', 'random');
  await expect(page.locator('.ss-rule[data-rule="items"] .ss-rule-value')).toHaveText('On');
  await expect(page.locator('.ss-slot')).toHaveCount(0);
});
