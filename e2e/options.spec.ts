import { expect, test, type Page } from '@playwright/test';

const tapJump = (page: Page) =>
  page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem('coolmathsmash.settings.v1') ?? '{}') as { tapJump?: boolean })
        .tapJump,
  );
const row = (page: Page, id: string) => page.locator(`.opt-row[data-option="${id}"]`);

/** Menu input is read once per animation frame, so let one pass after each key. */
const nextFrame = (page: Page) =>
  page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

async function focusRow(page: Page, id: string) {
  for (let i = 0; i < 10 && !(await row(page, id).getAttribute('class'))?.includes('is-focus'); i++) {
    await page.keyboard.press('ArrowDown');
    await nextFrame(page);
  }
  await expect(row(page, id)).toHaveClass(/is-focus/);
}

test('options: sliders, tap jump and reset all with a confirm step', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.tile-options')).toHaveClass(/is-focus/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.options-screen')).toBeVisible();

  await expect(row(page, 'master')).toHaveClass(/is-focus/);
  await expect(row(page, 'master')).toContainText('80%');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(row(page, 'master')).toContainText('60%');
  await expect(page.locator('.opt-big')).toHaveText('60%');

  await focusRow(page, 'tapJump');
  await expect(row(page, 'tapJump')).toContainText('On');
  await page.keyboard.press('ArrowRight');
  await expect(row(page, 'tapJump')).toContainText('Off');
  expect(await tapJump(page)).toBe(false);

  await focusRow(page, 'reset');
  await page.keyboard.press('Enter');
  await expect(page.locator('.opt-dialog')).toBeVisible();
  await expect(page.locator('.opt-btn.is-focus')).toHaveText('Cancel');
  await page.keyboard.press('Enter');
  await expect(page.locator('.opt-dialog')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('.opt-dialog')).toHaveCount(0);
  await expect(page.locator('.options-screen')).toBeVisible();
  expect(await tapJump(page)).toBe(false);

  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.opt-btn.is-focus')).toHaveText('Reset');
  await page.keyboard.press('Enter');
  await expect(page.locator('.opt-dialog')).toHaveCount(0);
  await expect(row(page, 'tapJump')).toContainText('On');
  await expect(row(page, 'master')).toContainText('80%');
  expect(await tapJump(page)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.locator('.main-menu')).toBeVisible();
  expect(errors).toEqual([]);
});
