import { expect, test, type Page } from '@playwright/test';
import { Btn } from '../src/input/types';

const frame = (page: Page) => page.evaluate(() => window.__smash!.frame());

test('a full match: select, countdown, pause, the last KO, GAME!, results and a rematch', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.css-screen')).toBeVisible();
  await page.keyboard.press('KeyF');
  await expect(page.locator('.css-ready')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ss-screen')).toBeVisible();
  await page.keyboard.press('Enter');

  await expect(page.locator('.match-screen')).toBeVisible();
  await expect(page.locator('.callout-slot[data-label="3"] svg')).toBeVisible();
  await expect(page.locator('.match-clock')).toContainText('7:00');
  await expect(page.locator('.callout-slot[data-label="GO!"]')).toBeAttached({ timeout: 10_000 });

  await page.keyboard.press('Escape');
  await expect(page.locator('.pause-layer')).toBeVisible();
  const paused = await frame(page);
  await page.waitForTimeout(300);
  expect(await frame(page)).toBe(paused);
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause-layer')).toBeHidden();
  await expect.poll(() => frame(page)).toBeGreaterThan(paused);

  await page.evaluate(() =>
    window.__smash!.patch(1, {
      stocks: 1,
      ground: null,
      action: 'fall',
      pos: { x: 30, y: -300 },
      vel: { x: 0, y: -5 },
    }),
  );
  await expect(page.locator('.is-finale svg.callout')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.results-screen[data-phase="winner"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.winner-name')).toContainText(/\w/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.results-screen[data-phase="cards"]')).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(2);
  await expect(page.locator('.result-card').nth(1).locator('.card-out b')).toHaveText(/\d:\d\d/);
  await expect(page.locator('.results-button.is-focus')).toHaveText('Rematch');

  await page.keyboard.press('Enter');
  await expect(page.locator('.match-screen')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__smash!.getState().fighters.map((f) => f.stocks)))
    .toEqual([3, 3]);
  expect(errors).toEqual([]);
});

test('four-player match uses saved controls and quits back to character select', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'coolmathsmash.settings.v1',
      JSON.stringify({ keyboard: [{ buttons: { attack: ['KeyQ'] } }], tapJump: false }),
    );
  });
  await page.goto('/?debug');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.css-screen')).toBeVisible();
  for (const slots of [3, 4]) {
    await page.locator('.css-add').click();
    await expect(page.locator('.css-panel')).toHaveCount(slots);
  }
  await page.keyboard.press('KeyQ');
  await expect(page.locator('.css-ready')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ss-screen')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.match-screen')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__smash!.getState().config.ports.map((p) => p.tapJump)))
    .toEqual([false, false, false, false]);

  await page.keyboard.down('KeyQ');
  await expect
    .poll(
      () =>
        page.evaluate(
          (bit) => (window.__smash!.getState().players[0]!.control.cur.buttons & (bit as number)) !== 0,
          Btn.Attack,
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
  await page.keyboard.up('KeyQ');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause-layer')).toBeVisible();
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.locator('.css-panel')).toHaveCount(4);
});

test('match lab scene and results presets render', async ({ page }) => {
  for (const at of ['countdown', 'go', 'pause', 'game']) {
    await page.goto(`/lab.html?scene=match&at=${at}`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.match-screen')).toHaveCount(1);
  }
  await expect(page.locator('.is-finale svg')).toBeVisible();
  for (const preset of ['winner-2p', 'cards-4p']) {
    await page.goto(`/lab.html?scene=menu&screen=results&preset=${preset}`);
    await expect(page.locator('.results-screen')).toHaveAttribute('data-phase', preset.split('-')[0]!);
  }
});
