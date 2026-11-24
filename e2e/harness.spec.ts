import { expect, test } from '@playwright/test';

test('harness steps the match deterministically from scripted inputs', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const run = () =>
    page.evaluate(() => {
      const s = window.__smash!;
      s.newMatch({ seed: 7 });
      s.runScript([
        { port: 0, from: 0, to: 40, x: 100 },
        { port: 0, from: 20, buttons: ['jump'] },
        { port: 1, from: 10, to: 60, y: -100, buttons: ['shield'] },
      ]);
      const state = s.getState();
      return { frame: s.frame(), hash: s.hash(), p2: state.players[1]!.control.cur };
    });
  const first = await run();
  const second = await run();
  expect(first.frame).toBe(60);
  expect(first.p2).toMatchObject({ y: -100 });
  expect(second.hash).toBe(first.hash);
});

test('a recorded replay reproduces the same state', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const same = await page.evaluate(() => {
    const s = window.__smash!;
    s.newMatch();
    s.runScript([{ port: 1, from: 3, to: 90, x: -100, buttons: ['attack'] }]);
    const hash = s.hash();
    const replay = s.replay();
    s.newMatch();
    s.loadReplay(replay);
    return s.hash() === hash;
  });
  expect(same).toBe(true);
});
