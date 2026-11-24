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

test('hud scene renders 2 and 4 players and accepts new players', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const players of [2, 4]) {
    await page.goto(`/lab.html?scene=hud&players=${players}`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  }
  await page.evaluate(async () => {
    await window.__lab!.call(
      'set',
      [
        { port: 0, name: 'Fireboy', damage: 12.5, stocks: 2, maxStocks: 3, eliminated: false, hitFrame: 10 },
        { port: 1, name: 'Watergirl', damage: 0, stocks: 0, maxStocks: 3, eliminated: true, hitFrame: -1 },
        { port: 2, name: 'Bob', damage: 99, stocks: 7, maxStocks: 8, eliminated: false, hitFrame: -1 },
      ],
      12,
    );
  });
  expect(errors).toEqual([]);
});
