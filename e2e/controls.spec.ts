import { expect, test, type Page } from '@playwright/test';

const saved = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('coolmathsmash.settings.v1') ?? 'null') as {
        keyboard: { buttons: Record<string, string[]> }[];
        gamepad: Record<string, number[]>;
      },
  );
const row = (page: Page, key: string) => page.locator(`.ctl-row[data-key="${key}"]`);
const chips = (page: Page, key: string) => row(page, key).locator('.chip');

/** Menu input is read once per animation frame, so let one pass after each key. */
const nextFrame = (page: Page) =>
  page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

async function focusRow(page: Page, key: string, dir: 'ArrowDown' | 'ArrowUp' = 'ArrowDown') {
  const target = page.locator(`.controls-screen [data-key="${key}"]`);
  for (let i = 0; i < 14 && !(await target.getAttribute('class'))?.includes('is-focus'); i++) {
    await page.keyboard.press(dir);
    await nextFrame(page);
  }
  await expect(target).toHaveClass(/is-focus/);
}

test('controls: rebind keys and pad buttons, resolve conflicts, cancel, reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.tile-controls')).toHaveClass(/is-focus/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.controls-screen')).toBeVisible();
  await expect(page.locator('.ctl-tab.is-active')).toContainText('Keyboard 1');
  await expect(row(page, 'up')).toHaveClass(/is-focus/);
  await expect(chips(page, 'walk')).toHaveText(['L-Shift']);

  await focusRow(page, 'attack');
  await expect(chips(page, 'attack')).toHaveText(['F']);
  await page.keyboard.press('Enter');
  await expect(row(page, 'attack')).toHaveClass(/is-capturing/);
  await expect(row(page, 'attack')).toContainText('Press a key');
  await page.keyboard.press('KeyQ');
  await expect(chips(page, 'attack')).toHaveText(['Q']);
  await expect(row(page, 'attack')).not.toHaveClass(/is-capturing/);
  expect((await saved(page)).keyboard[0]!.buttons.attack).toEqual(['KeyQ']);

  // G is Keyboard 1's special (menu back): captured, it is bound and does not also leave the screen.
  await page.keyboard.press('Enter');
  await expect(row(page, 'attack')).toHaveClass(/is-capturing/);
  await page.keyboard.press('KeyG');
  await expect(chips(page, 'attack')).toHaveText(['G']);
  await expect(chips(page, 'special')).toHaveText(['Not set']);
  await expect(page.locator('.ctl-notice')).toHaveText('G moved here from Special');
  await expect(page.locator('.controls-screen')).toBeVisible();
  await expect(row(page, 'attack')).not.toHaveClass(/is-capturing/);

  // Escape cancels a capture and nothing else.
  await page.keyboard.press('Enter');
  await expect(row(page, 'attack')).toHaveClass(/is-capturing/);
  await page.keyboard.press('Escape');
  await expect(row(page, 'attack')).not.toHaveClass(/is-capturing/);
  await expect(chips(page, 'attack')).toHaveText(['G']);
  await expect(page.locator('.controls-screen')).toBeVisible();

  // Enter is a menu key (Pause): Attack on Enter would confirm and start at once, so the rebind is refused.
  await page.keyboard.press('Enter');
  await expect(row(page, 'attack')).toHaveClass(/is-capturing/);
  await page.keyboard.press('Enter');
  await expect(row(page, 'attack')).not.toHaveClass(/is-capturing/);
  await expect(page.locator('.ctl-notice')).toHaveText('Enter is a menu key, so it can only be Pause');
  await expect(chips(page, 'attack')).toHaveText(['G']);

  // The pointer crossing another tab mid-capture leaves the capture on Keyboard 1.
  await page.keyboard.press('Enter');
  await expect(row(page, 'attack')).toHaveClass(/is-capturing/);
  const kb2 = await page.locator('.ctl-tab[data-tab="kb2"]').boundingBox();
  await page.mouse.move(kb2!.x + kb2!.width / 2, kb2!.y + kb2!.height / 2, { steps: 4 });
  await expect(page.locator('.ctl-tab.is-active')).toContainText('Keyboard 1');
  await expect(row(page, 'attack')).toHaveClass(/is-capturing/);
  await page.keyboard.press('Escape');
  await expect(row(page, 'attack')).not.toHaveClass(/is-capturing/);
  await focusRow(page, 'attack');

  // Both halves share the keyboard: J leaves Keyboard 2's attack.
  await page.keyboard.press('Enter');
  await expect(row(page, 'attack')).toHaveClass(/is-capturing/);
  await page.keyboard.press('KeyJ');
  await expect(chips(page, 'attack')).toHaveText(['J']);
  await expect(page.locator('.ctl-notice')).toHaveText('J moved here from Keyboard 2 Attack');
  expect((await saved(page)).keyboard[1]!.buttons.attack).toEqual(['Numpad1']);

  await focusRow(page, 'reset');
  await page.keyboard.press('Enter');
  await expect(chips(page, 'attack')).toHaveText(['F']);
  await expect(chips(page, 'special')).toHaveText(['G']);
  expect((await saved(page)).keyboard[0]!.buttons.special).toEqual(['KeyG']);

  await page.keyboard.press('KeyT');
  await expect(page.locator('.ctl-tab.is-active')).toContainText('Keyboard 2');
  await expect(chips(page, 'attack')).toHaveText(['Num 1']);
  await expect(chips(page, 'left')).toHaveText(['←']);

  // Gamepad tab with a fake standard pad.
  await page.keyboard.press('KeyT');
  await expect(page.locator('.ctl-tab.is-active')).toContainText('Gamepad');
  await expect(row(page, 'walk')).toHaveCount(0);
  await expect(chips(page, 'taunt')).toHaveText(['D-pad']);
  await page.evaluate(() => {
    const pad = {
      id: 'Test pad',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    (window as unknown as { testPad: typeof pad }).testPad = pad;
    navigator.getGamepads = () => [pad as unknown as Gamepad];
  });
  await expect(page.locator('.ctl-pad-status')).toHaveText('1 gamepad connected');
  const setButton = (index: number, pressed: boolean) =>
    page.evaluate(
      ([i, p]) => {
        const b = (window as unknown as { testPad: { buttons: { pressed: boolean; value: number }[] } })
          .testPad.buttons[i as number]!;
        b.pressed = p as boolean;
        b.value = p ? 1 : 0;
      },
      [index, pressed],
    );
  await focusRow(page, 'attack', 'ArrowUp');
  await page.keyboard.press('Enter');
  await expect(row(page, 'attack')).toContainText('Press a button');
  await setButton(3, true);
  await expect(chips(page, 'attack')).toHaveText(['Y']);
  await expect(chips(page, 'jump')).toHaveText(['X']);
  await setButton(3, false);
  expect((await saved(page)).gamepad.attack).toEqual([3]);
  expect((await saved(page)).gamepad.jump).toEqual([2]);

  // The pad's B (menu back) captured on the Special row is bound, not used to leave.
  await focusRow(page, 'special');
  await setButton(0, true);
  await expect(row(page, 'special')).toContainText('Press a button');
  await setButton(0, false);
  await setButton(1, true);
  await expect(chips(page, 'special')).toHaveText(['B']);
  await expect(page.locator('.controls-screen')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.main-menu')).toBeVisible();
  await setButton(1, false);
  expect(errors).toEqual([]);
});
