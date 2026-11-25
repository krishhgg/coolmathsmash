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

test('recorded inputs are snapshots, not caller references', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const same = await page.evaluate(() => {
    const s = window.__smash!;
    s.newMatch();
    const inputs = [
      { x: 0, y: 0, cx: 0, cy: 0, buttons: 1 },
      { x: 0, y: 0, cx: 0, cy: 0, buttons: 0 },
    ];
    s.step(3, inputs);
    inputs[0]!.buttons = 0;
    s.step(3, inputs);
    const hash = s.hash();
    s.loadReplay(s.replay());
    return s.hash() === hash;
  });
  expect(same).toBe(true);
});

test('fighters run, jump and shield from scripted inputs', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(() => {
    const s = window.__smash!;
    s.newMatch();
    s.runScript([
      { port: 0, from: 10, to: 40, x: 100 },
      { port: 1, from: 10, to: 40, buttons: ['shield'] },
    ]);
    const mid = s.getState();
    s.runScript([{ port: 0, from: 40, to: 50, buttons: ['jump'] }], 50);
    const end = s.getState();
    return {
      run: mid.fighters[0]!.action,
      x0: mid.fighters[0]!.pos.x,
      shield: mid.fighters[1]!.action,
      airborne: end.fighters[0]!.ground === null,
      y: end.fighters[0]!.pos.y,
    };
  });
  expect(r.run).toBe('run');
  expect(r.x0).toBeGreaterThan(-20);
  expect(r.shield).toBe('shield');
  expect(r.airborne).toBe(true);
  expect(r.y).toBeGreaterThan(10);
});

test('a frame looks the same however often the frames before it were drawn', async ({ page }) => {
  // 61 full renders of the painted stage: slow on CI's software GPU (SwiftShader), instant on a real one.
  test.slow();
  const capture = async (everyFrame: boolean) => {
    await page.goto('/?harness');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    return page.evaluate(async (everyFrame) => {
      const s = window.__smash!;
      const script = [
        { port: 0, from: 0, to: 60, x: 100 },
        { port: 1, from: 0, to: 60, x: -100 },
      ];
      s.newMatch();
      if (everyFrame) {
        for (let f = 1; f <= 60; f++) {
          s.runScript(script, f);
          await s.render();
        }
      } else {
        s.runScript(script, 60);
        await s.render();
      }
      return document.querySelector('canvas')!.toDataURL();
    }, everyFrame);
  };
  const drawnEveryFrame = await capture(true);
  const drawnOnce = await capture(false);
  expect(drawnOnce).toBe(drawnEveryFrame);
});
