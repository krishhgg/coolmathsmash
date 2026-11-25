import { expect, test } from '@playwright/test';

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

test('the match shows the damage HUD, so the hud scenarios capture', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const results = await page.evaluate(async () => {
    const s = window.__smash!;
    return [await s.runScenario('hud'), await s.runScenario('hud-hit')];
  });
  for (const r of results) expect(r).toMatchObject({ status: 'captured' });
  expect(errors).toEqual([]);
});

test("every fighter's card icon is centred in and fits the portrait and stock boxes", async ({ page }) => {
  await page.goto('/lab.html?scene=hud&players=2');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const icons = (await page.evaluate(() => window.__lab!.call('iconBounds'))) as {
    id: string;
    box: string;
    size: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  expect(new Set(icons.map((i) => i.id))).toContain('snailbob');
  const problems: string[] = [];
  for (const { id, box, size, x, y, width, height } of icons) {
    const half = size / 2;
    const where = `${id} ${box} (box ±${half.toFixed(1)}): x ${x.toFixed(1)}..${(x + width).toFixed(1)}, y ${y.toFixed(1)}..${(y + height).toFixed(1)}`;
    const slack = size * 0.01;
    if (x < -half - slack || y < -half - slack || x + width > half + slack || y + height > half + slack)
      problems.push(`${where} spills out of the box`);
    if (Math.abs(x + width / 2) > size * 0.05 || Math.abs(y + height / 2) > size * 0.05)
      problems.push(`${where} is off centre`);
  }
  expect(problems).toEqual([]);
});
