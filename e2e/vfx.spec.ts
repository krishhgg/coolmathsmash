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

test('a 1v1 KO forward smash flashes red through its hitlag, a strong non-KO hit blue, then both let go', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(async () => {
    const s = window.__smash!;
    const canvas = document.querySelector('canvas')!;
    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    /** The average colour of the top-left 80x80 pixels: sky or stage, never a fighter or the HUD. */
    const corner = () => {
      probe.canvas.width = 1;
      probe.canvas.height = 1;
      probe.drawImage(canvas, 0, 0, 80, 80, 0, 0, 1, 1);
      return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const out: Record<string, { during: number[]; after: number[] }> = {};
    for (const name of ['finish-zoom', 'special-zoom']) {
      await s.runScenario(name);
      const during = corner();
      // The capture frame has 10 frames of hitlag left; the zoom lets go 4 frames after the launch.
      s.step(16);
      void s.render();
      out[name] = { during, after: corner() };
    }
    return out;
  });
  const [fr, fg, fb] = r['finish-zoom']!.during;
  expect(fr, `finish flash ${r['finish-zoom']!.during.join()}`).toBeGreaterThan(fb! + 40);
  expect(fr).toBeGreaterThan(fg! + 40);
  const [sr, , sb] = r['special-zoom']!.during;
  expect(sb, `special flash ${r['special-zoom']!.during.join()}`).toBeGreaterThan(sr! + 40);
  for (const name of ['finish-zoom', 'special-zoom']) {
    const { during, after } = r[name]!;
    expect(after[2]!, `${name} after ${after.join()}`).toBeGreaterThan(after[0]!);
    expect(Math.hypot(...during.map((c, i) => c - after[i]!)), name).toBeGreaterThan(60);
  }
});
