import { expect, test } from '@playwright/test';

test('the sound test loads every sound and announcer line and plays them after the first click', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.text().startsWith('audio:')) problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto('/lab.html?scene=sound');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-sound]')).toHaveCount(34);
  await expect(page.locator('[data-announce]')).toHaveCount(30);
  await page.mouse.click(640, 700);
  await expect.poll(() => page.evaluate(() => window.__lab!.call('play', 'hit-heavy', 0.5))).toBe(true);
  expect(await page.evaluate(() => window.__lab!.call('missing'))).toEqual([]);
  expect(await page.evaluate(() => window.__lab!.call('play', 'voice-winner-is', 0))).toBe(true);
  await page.locator('[data-announce="winner"]').click();
  await page.locator('input[data-channel="music"]').fill('0.25');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('coolmathsmash.audio') ?? '{}') as { music?: number },
  );
  expect(saved.music).toBe(0.25);
  expect(problems).toEqual([]);
});
