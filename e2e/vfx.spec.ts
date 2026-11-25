import { expect, test } from '@playwright/test';

/**
 * Renders straight to the canvas and reads it back (the renderer keeps its drawing buffer), so the stepping loop
 * never waits on an animation frame, which software WebGL can hold back for seconds.
 */
test('effects at a frame look the same however often the frames before it were drawn', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(async () => {
    const s = window.__smash!;
    const canvas = document.querySelector('canvas')!;
    const draw = () => void s.render();
    const shots: Record<number, string[]> = {};
    for (const frame of [28, 47, 58]) {
      await s.runScenario('ko-blast', { frame });
      shots[frame] = [canvas.toDataURL()];
    }
    // The scenario's script is over by frame 20, so plain neutral steps continue it.
    await s.runScenario('ko-blast', { frame: 20 });
    for (let f = 21; f <= 58; f++) {
      s.step(1);
      draw();
      shots[f]?.push(canvas.toDataURL());
    }
    return shots;
  });
  for (const [frame, [once, everyFrame]] of Object.entries(r))
    expect(everyFrame, `frame ${frame}`).toBe(once);
  expect(new Set(Object.values(r).map(([once]) => once)).size).toBe(3);
});
