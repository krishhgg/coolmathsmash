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

test('the game paints the stage backdrop at full quality and leaves the sky flat at lite', async ({
  page,
}) => {
  const corner = async (url: string) => {
    await page.goto(url);
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    return page.evaluate(async () => {
      const s = window.__smash!;
      s.newMatch();
      s.runScript([], 1);
      await s.render();
      const probe = document.createElement('canvas').getContext('2d')!;
      probe.drawImage(document.querySelector('canvas')!, 20, 20, 1, 1, 0, 0, 1, 1);
      return [...probe.getImageData(0, 0, 1, 1).data];
    });
  };
  const flatSky = [0x4f, 0xb3, 0xff, 255];
  expect(await corner('/?harness')).toEqual(flatSky);
  expect(await corner('/?harness&quality=full')).not.toEqual(flatSky);
});
