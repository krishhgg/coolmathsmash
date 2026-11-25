import { expect, test } from '@playwright/test';

test('effects at a frame look the same however often the frames before it were drawn', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(async () => {
    const s = window.__smash!;
    const shot = () => document.querySelector('canvas')!.toDataURL();
    const shots: Record<number, string[]> = {};
    for (const frame of [28, 47, 58]) {
      await s.runScenario('ko-blast', { frame });
      shots[frame] = [shot()];
    }
    await s.runScenario('ko-blast', { frame: 20 });
    for (let f = 21; f <= 58; f++) {
      await s.stepScenario(1);
      shots[f]?.push(shot());
    }
    return shots;
  });
  for (const [frame, [once, everyFrame]] of Object.entries(r))
    expect(everyFrame, `frame ${frame}`).toBe(once);
  expect(new Set(Object.values(r).map(([once]) => once)).size).toBe(3);
});
