import { expect, test } from '@playwright/test';
import { Btn } from '../src/input/types';

const PLANET = 'item/coolmath-planet';

test('Items On: the Coolmath Planet floats in, takes hits, and whoever breaks it glows', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

  const spawned = await page.evaluate((kind) => {
    const s = window.__smash!;
    s.setManual(true);
    s.newMatch({ seed: 12, items: true, ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }] });
    const planet = () => s.getState().entities.find((e) => e.kind === kind);
    while (s.frame() < 12_000 && !planet()) s.step(10);
    const first = planet();
    s.step(240);
    return { first, now: planet() };
  }, PLANET);
  expect(spawned.first).toMatchObject({ kind: PLANET, owner: -1, hp: expect.any(Number) });
  expect(spawned.now).toBeDefined();
  await page.evaluate(() => window.__smash!.render());
  await page.screenshot({ path: info.outputPath('planet-floating.png') });

  // Fly Fireboy up beside it and neutral-air it until it breaks.
  const result = await page.evaluate(
    ({ kind, attack }) => {
      const s = window.__smash!;
      const neutral = { x: 0, y: 0, cx: 0, cy: 0, buttons: 0 };
      let cracked = false;
      for (let i = 0; i < 40; i++) {
        const st = s.getState();
        if (st.fighters[0]!.finalReady) return { broke: true, cracked, frame: s.frame() };
        const p = st.entities.find((e) => e.kind === kind);
        if (!p) return { broke: false, cracked, frame: s.frame() };
        s.patch(0, {
          pos: { x: p.pos.x - 4, y: p.pos.y - 7 },
          vel: { x: 0, y: 0 },
          kb: { x: 0, y: 0 },
          ground: null,
          action: 'fall',
          actionFrame: 1,
          move: null,
          facing: 1,
          jumpsUsed: 1,
          damage: 0,
        });
        s.step(1, [{ ...neutral, buttons: attack }, neutral]);
        s.step(14);
        const hp = s.getState().entities.find((e) => e.kind === kind)?.hp ?? 0;
        if (!cracked && hp > 0 && hp < 40 / 3) {
          cracked = true;
          return { broke: false, cracked, frame: s.frame() };
        }
        s.step(30);
      }
      return { broke: false, cracked, frame: s.frame() };
    },
    { kind: PLANET, attack: Btn.Attack },
  );
  expect(result.cracked).toBe(true);
  await page.evaluate(() => window.__smash!.render());
  await page.screenshot({ path: info.outputPath('planet-cracked.png') });

  const broke = await page.evaluate(
    ({ kind, attack }) => {
      const s = window.__smash!;
      const neutral = { x: 0, y: 0, cx: 0, cy: 0, buttons: 0 };
      for (let i = 0; i < 20; i++) {
        const st = s.getState();
        if (st.fighters[0]!.finalReady) break;
        const p = st.entities.find((e) => e.kind === kind);
        if (!p) break;
        s.patch(0, {
          pos: { x: p.pos.x - 4, y: p.pos.y - 7 },
          vel: { x: 0, y: 0 },
          kb: { x: 0, y: 0 },
          ground: null,
          action: 'fall',
          actionFrame: 1,
          move: null,
          facing: 1,
          jumpsUsed: 1,
        });
        s.step(1, [{ ...neutral, buttons: attack }, neutral]);
        s.step(45);
      }
      s.step(60);
      const st = s.getState();
      return {
        ready: st.fighters.map((f) => f.finalReady),
        planets: st.entities.filter((e) => e.kind === kind).length,
      };
    },
    { kind: PLANET, attack: Btn.Attack },
  );
  expect(broke).toEqual({ ready: [true, false], planets: 0 });
  await page.evaluate(() => window.__smash!.render());
  await page.screenshot({ path: info.outputPath('final-ready-glow.png') });
  expect(errors).toEqual([]);
});

test('Items Off: no planet in a seven-minute match', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const count = await page.evaluate((kind) => {
    const s = window.__smash!;
    s.setManual(true);
    s.newMatch({ seed: 12, ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }] });
    let seen = 0;
    for (let i = 0; i < 7 * 60 * 60; i += 60) {
      s.step(60);
      seen += s.getState().entities.filter((e) => e.kind === kind).length;
    }
    return seen;
  }, PLANET);
  expect(count).toBe(0);
});
