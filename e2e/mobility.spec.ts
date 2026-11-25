import { expect, test } from '@playwright/test';

test('the harness registers the air-mobility test fighters: float, glide and hover', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const actions = await page.evaluate(() => {
    const s = window.__smash!;
    type Step = Parameters<typeof s.runScript>[0][number];
    const play = (fighter: string, steps: Step[], frames: number, inAir = false) => {
      s.newMatch({ ports: [{ fighter }, { fighter: 'fireboy' }] });
      s.step(10);
      if (inAir) s.patch(0, { pos: { x: -60, y: 60 }, ground: null, action: 'fall', jumpsUsed: 1 });
      const start = s.frame();
      s.runScript(
        steps.map((st) => ({ ...st, from: start + st.from, to: start + (st.to ?? st.from + 1) })),
        start + frames,
      );
      return s.getState().fighters[0]!.action;
    };
    const holdJump: Step = { port: 0, from: 0, to: 80, buttons: ['jump'] };
    return {
      float: play('test-floater', [holdJump], 60),
      glide: play('test-glider', [holdJump], 60, true),
      hover: play(
        'test-hover',
        [
          { port: 0, from: 0, y: 50, buttons: ['special'] },
          { port: 0, from: 1, to: 50, buttons: ['special'] },
        ],
        40,
      ),
    };
  });
  expect(actions).toEqual({ float: 'float', glide: 'glide', hover: 'hover' });
});
