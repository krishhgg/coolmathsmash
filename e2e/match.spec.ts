import { expect, test, type Page } from '@playwright/test';
import { Btn } from '../src/input/types';

const frame = (page: Page) => page.evaluate(() => window.__smash!.frame());
const advanceToGo = (page: Page) =>
  page.evaluate(() => {
    const harness = window.__smash!;
    harness.step(Math.max(0, 180 - harness.frame()));
  });
/**
 * Stop real-time stepping and advance to the first frame of GO!. Under software WebGL (CI's SwiftShader) the
 * page can go seconds without an animation frame once the match starts drawing; holding the sim keeps GO! up
 * until the screen catches up.
 */
const holdAtGo = (page: Page) =>
  page.evaluate(() => {
    const harness = window.__smash!;
    harness.setManual(true);
    harness.step(Math.max(0, 180 - harness.frame()));
  });
const setManual = (page: Page, on: boolean) => page.evaluate((v) => window.__smash!.setManual(v), on);

test('a full match: select, countdown, pause, the last KO, GAME!, results and a rematch', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug&quality=lite');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.css-screen')).toBeVisible();
  await page.locator('[data-key="tile:johnny"]').click();
  await page.locator('[data-key="panel:1:token"]').click();
  await page.locator('[data-key="tile:fireboy"]').click();
  for (let level = 4; level <= 9; level++) {
    await page.locator('[data-key="panel:1:up"]').click();
  }
  await expect(page.locator('.css-level-value')).toHaveText('9');
  await expect(page.locator('.css-ready')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ss-screen')).toBeVisible();
  await page.locator('.ss-tile[data-stage="battlefield"]').click();

  await expect(page.locator('.match-screen')).toBeVisible();
  // Hold the countdown on "3" until the screen draws it; see holdAtGo.
  await setManual(page, true);
  expect(await page.evaluate(() => window.__smash!.getState().config.ports.map((p) => p.fighter))).toEqual([
    'johnny',
    'fireboy',
  ]);
  await expect(page.locator('.callout-slot[data-label="3"] svg')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.match-clock')).toContainText('7:00');
  await holdAtGo(page);
  await expect(page.locator('.callout-slot[data-label="GO!"]')).toBeAttached({ timeout: 30_000 });
  await setManual(page, false);

  await page.keyboard.down('Escape');
  await expect(page.locator('.pause-layer')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.up('Escape');
  // No pad is plugged in or playing, so the tip shows Keyboard 1's default Attack and Pause keys only.
  await expect(page.locator('.pause-tip span')).toHaveText(['↑↓ Move', 'F Select', 'Esc Resume']);
  const paused = await frame(page);
  await page.waitForTimeout(300);
  expect(await frame(page)).toBe(paused);
  await page.keyboard.down('Escape');
  await expect(page.locator('.pause-layer')).toBeHidden({ timeout: 15_000 });
  await page.keyboard.up('Escape');
  await expect.poll(() => frame(page)).toBeGreaterThan(paused);

  // Drop P2 below the blast zone on their last stock and step past the KO by hand, as with GO!.
  await page.evaluate(() => {
    const harness = window.__smash!;
    harness.setManual(true);
    harness.patch(1, {
      stocks: 1,
      ground: null,
      action: 'fall',
      pos: { x: 30, y: -300 },
      vel: { x: 0, y: -5 },
    });
    harness.step(60);
  });
  await expect(page.locator('.is-finale svg.callout')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.results-screen[data-phase="winner"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.winner-name')).toContainText(/\w/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.results-screen[data-phase="cards"]')).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(2);
  await expect(page.locator('.result-card').nth(1).locator('.card-who')).toContainText('Level 9');
  await expect(page.locator('.result-card').nth(1).locator('.card-out b')).toHaveText(/\d:\d\d/);
  await expect(page.locator('.results-button.is-focus')).toHaveText('Rematch');

  await page.keyboard.press('Enter');
  await expect(page.locator('.match-screen')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__smash!.getState().fighters.map((f) => f.stocks)))
    .toEqual([3, 3]);
  expect(errors).toEqual([]);
});

test('Restart replays the Random CPU, its costume and the Random stage; Rematch draws again', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const lineUp = () =>
    page.evaluate(() => {
      const { seed, stage, ports } = window.__smash!.getState().config;
      return { seed, stage, ports };
    });
  /** Hold the sim past GO! so a restart shows up as the frame count dropping back. */
  const holdAt400 = () =>
    page.evaluate(() => {
      const harness = window.__smash!;
      harness.setManual(true);
      harness.step(Math.max(0, 400 - harness.frame()));
    });
  await page.goto('/?debug&quality=lite');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.css-screen')).toBeVisible();
  await page.locator('[data-key="tile:johnny"]').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ss-screen')).toBeVisible();
  await page.locator('.ss-tile[data-stage="random"]').click();
  await expect(page.locator('.match-screen')).toBeVisible();
  await holdAt400();
  const first = await lineUp();
  expect(first.ports[0]!.fighter).toBe('johnny');

  for (let restart = 1; restart <= 3; restart++) {
    await page.keyboard.down('Escape');
    await expect(page.locator('.pause-layer')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.up('Escape');
    await page.getByRole('button', { name: 'Restart' }).click();
    await expect.poll(() => frame(page), { timeout: 30_000 }).toBeLessThan(400);
    await holdAt400();
    expect(await lineUp()).toEqual(first);
  }

  await page.evaluate(() => {
    const harness = window.__smash!;
    harness.patch(1, {
      stocks: 1,
      ground: null,
      action: 'fall',
      pos: { x: 30, y: -300 },
      vel: { x: 0, y: -5 },
    });
    harness.step(60);
  });
  await expect(page.locator('.results-screen[data-phase="winner"]')).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Enter');
  await expect(page.locator('.results-button.is-focus')).toHaveText('Rematch');
  await page.keyboard.press('Enter');
  await expect(page.locator('.match-screen')).toBeVisible();
  await expect.poll(async () => (await lineUp()).seed).not.toBe(first.seed);
  expect(errors).toEqual([]);
});

test('four-player match uses saved controls and quits back to character select', async ({ page }) => {
  // The key presses reach the match only through real-time frames, which a software-rendered runner draws slowly.
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem(
      'coolmathsmash.settings.v1',
      JSON.stringify({ keyboard: [{ buttons: { attack: ['KeyQ'], start: ['KeyP'] } }], tapJump: false }),
    );
  });
  await page.goto('/?debug&quality=lite');
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
  await page.locator('.ss-tile[data-stage="testbed"]').click();
  await expect(page.locator('.match-screen')).toBeVisible();
  expect(await page.evaluate(() => window.__smash!.getState().config.stage)).toBe('testbed');
  await expect
    .poll(() => page.evaluate(() => window.__smash!.getState().config.ports.map((p) => p.tapJump)))
    .toEqual([false, false, false, false]);

  await advanceToGo(page);
  await page.keyboard.down('KeyQ');
  await expect
    .poll(
      () =>
        page.evaluate(
          (bit) => (window.__smash!.getState().players[0]!.control.cur.buttons & (bit as number)) !== 0,
          Btn.Attack,
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
  await page.keyboard.up('KeyQ');
  await page.keyboard.press('KeyP');
  await expect(page.locator('.pause-layer')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.pause-tip span')).toHaveText(['↑↓ Move', 'Q Select', 'P Resume']);
  await page.keyboard.press('KeyP');
  await expect(page.locator('.pause-layer')).toBeHidden({ timeout: 15_000 });
  await page.keyboard.press('KeyP');
  await expect(page.locator('.pause-layer')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.locator('.css-panel')).toHaveCount(4);
});

test('match lab scene and results presets render', async ({ page }) => {
  test.setTimeout(90_000);
  for (const at of ['countdown', 'go', 'pause', 'game']) {
    await page.goto(`/lab.html?scene=match&at=${at}`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 15_000 });
    await expect(page.locator('.match-screen')).toHaveCount(1);
  }
  await expect(page.locator('.is-finale svg')).toBeVisible();
  for (const preset of ['winner-2p', 'cards-4p']) {
    await page.goto(`/lab.html?scene=menu&screen=results&preset=${preset}`);
    await expect(page.locator('.results-screen')).toHaveAttribute('data-phase', preset.split('-')[0]!);
  }
});
