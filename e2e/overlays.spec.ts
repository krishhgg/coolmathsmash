import { expect, test } from '@playwright/test';

test('F2-F5 toggle the debug overlays and keep the browser from acting on them (F5 would reload)', async ({
  page,
}) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const prevented = await page.evaluate(() =>
    ['F2', 'F3', 'F4', 'F5'].map((code) => {
      const e = new KeyboardEvent('keydown', { code, cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    }),
  );
  expect(prevented).toEqual([true, true, true, true]);
});
