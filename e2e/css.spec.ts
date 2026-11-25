import { expect, test, type Page } from '@playwright/test';

/** Tile names and player panels the Ready to fight banner overlaps (KRI-44: it used to hide the second row). */
const underBanner = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector('.css-ready')!.getBoundingClientRect();
    return [...document.querySelectorAll('.css-tile-name, .css-panel')]
      .filter((n) => {
        const b = n.getBoundingClientRect();
        return b.left < r.right && r.left < b.right && b.top < r.bottom && r.top < b.bottom;
      })
      .map((n) => n.textContent);
  });

const plates = (page: Page) => page.locator('.css-plate-label');

test('character select: pick, join a second keyboard as P2, add and remove a CPU', async ({ page }) => {
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

  const firstTile = (await page.locator('.css-tile-name').first().textContent())!;
  await page.keyboard.press('KeyF');
  await expect(page.locator('.css-panel').first().locator('.css-name')).toHaveText(firstTile);
  await expect(page.locator('.css-ready')).toBeVisible();
  expect(await underBanner(page)).toEqual([]);

  // The second human takes P2 ahead of the CPU, which moves to the third panel with its level.
  await page.locator('[data-key="panel:1:up"]').click();
  await page.keyboard.press('KeyJ');
  await expect(page.locator('.css-panel')).toHaveCount(3);
  await expect(plates(page)).toHaveText(['P1', 'P2', 'CPU']);
  await expect(page.locator('.css-panel').nth(1)).toContainText('Keyboard 2');
  await expect(page.locator('.css-panel').nth(2).locator('.css-level-value')).toHaveText('4');
  await expect(page.locator('.css-hand > span')).toHaveText(['P1', 'P2']);
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

test('special/B backs out: first undoes a pick, then leaves for the main menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('KeyD');
  await expect(page.locator('.tile-controls')).toHaveClass(/is-focus/);
  await page.keyboard.press('KeyA');
  await expect(page.locator('.menu-tile.is-focus')).toContainText('Smash');
  await page.keyboard.press('Enter');
  await expect(page.locator('.css-screen')).toBeVisible();
  await page.keyboard.press('KeyF');
  await expect(page.locator('.css-ready')).toBeVisible();
  await page.keyboard.press('KeyG');
  await expect(page.locator('.css-ready')).toBeHidden();
  await expect(page.locator('.css-screen')).toBeVisible();
  await page.keyboard.press('KeyG');
  await expect(page.locator('.main-menu')).toBeVisible();
});

test('the planned roster fills the grid; locked fighters cannot be picked', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.css-screen')).toBeVisible();
  await expect(page.locator('.css-tile-name').first()).toHaveText('Papa Louie');
  await expect(page.locator('.css-tile-name').last()).toHaveText('Random');

  const name = page.locator('.css-panel').first().locator('.css-name');
  const locked = page.locator('.css-tile.is-locked');
  if ((await locked.count()) > 0) {
    await locked.first().click();
    await expect(name).toHaveText('Choose');
    await expect(page.locator('.css-ready')).toBeHidden();
  }

  const open = page.locator('.css-tile:not(.is-locked)').nth(1);
  const openName = (await open.locator('.css-tile-name').textContent())!;
  await open.click();
  await expect(name).toHaveText(openName);
  await expect(page.locator('.css-ready')).toBeVisible();
  expect(await underBanner(page)).toEqual([]);
  await page.locator('.css-ready').click();
  await expect(page.locator('.ss-screen')).toBeVisible();
});

test('a gamepad that presses A joins as P2, ahead of the CPU', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.css-screen')).toBeVisible();
  await expect(plates(page)).toHaveText(['P1', 'CPU']);

  await page.evaluate(() => {
    const pad = {
      id: 'Test pad',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({
        pressed: i === 0,
        touched: false,
        value: +(i === 0),
      })),
    };
    navigator.getGamepads = () => [pad as unknown as Gamepad];
  });
  await expect(plates(page)).toHaveText(['P1', 'P2', 'CPU']);
  await expect(page.locator('.css-panel').nth(1)).toContainText('Gamepad 1');
});
