import { expect, test } from '@playwright/test';

test("Fireboy's fireball is an entity in the match state and hits P2", async ({ page }) => {
  await page.goto('/?harness&hitboxes');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(async () => {
    const s = window.__smash!;
    s.newMatch({ ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }] });
    s.patch(0, { pos: { x: -30, y: 0 }, facing: 1 });
    s.patch(1, { pos: { x: 10, y: 0 }, facing: -1 });
    s.step(10);
    s.runScript([{ port: 0, from: 10, to: 11, buttons: ['special'] }], 27);
    const spawned = s.getState().entities;
    s.step(60);
    const hit = s.getState();
    await s.render();
    return { spawned, damage: hit.fighters[1]!.damage, left: hit.entities.length };
  });
  expect(r.spawned).toHaveLength(1);
  expect(r.spawned[0]).toMatchObject({ kind: 'fireboy/fireball', owner: 0, age: 1 });
  expect(r.damage).toBeCloseTo(5.5 * 1.05 * 1.2, 5);
  expect(r.left).toBe(0);
});

test("a match draws Fireboy's fireball with its art and Papa Louie's Pepper Bomb as the placeholder disc", async ({
  page,
}) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(async () => {
    const s = window.__smash!;
    /** Canvas pixels of exactly one colour: the disc's fill (#fff3c4) or the fireball's flame (#ff6a1a). */
    const count = async (rgb: [number, number, number]) => {
      await s.render();
      const src = document.querySelector('canvas')!;
      const cv = Object.assign(document.createElement('canvas'), { width: src.width, height: src.height });
      const g = cv.getContext('2d')!;
      g.drawImage(src, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2]) n++;
      return n;
    };
    const DISC: [number, number, number] = [255, 243, 196];
    const FLAME: [number, number, number] = [255, 106, 26];
    const age = (kind: string) => s.getState().entities.find((e) => e.kind === kind)?.age ?? 0;
    /** Step until the entity of `kind` reaches `n` frames of age (or give up after 200 frames). */
    const until = (kind: string, n: number) => {
      for (let i = 0; i < 200 && age(kind) < n; i++) s.step(1);
    };
    const start = (fire: number) => {
      s.newMatch({ ports: [{ fighter: 'fireboy' }, { fighter: 'papa-louie' }] });
      s.patch(0, { pos: { x: -40, y: 0 }, facing: 1 });
      s.patch(1, { pos: { x: 60, y: 0 }, facing: -1 });
      s.step(10);
      s.runScript([{ port: fire, from: 10, to: 11, buttons: ['special'] }], 12);
    };
    start(0);
    // Fireboy is back in idle by the fireball's 45th frame, so the flame colour on screen is the fireball's.
    until('fireboy/fireball', 45);
    const flying = {
      disc: await count(DISC),
      flame: await count(FLAME),
      action: s.getState().fighters[0]!.action,
    };
    s.step(30);
    const gone = { flame: await count(FLAME), left: s.getState().entities.length };
    start(1);
    until('papa-louie/pepperBomb', 12);
    const bomb = await count(DISC);
    return { flying, gone, bomb };
  });
  expect(r.flying.action).toBe('idle');
  expect(r.flying.disc).toBe(0);
  expect(r.gone.left).toBe(0);
  expect(r.flying.flame - r.gone.flame).toBeGreaterThan(20);
  expect(r.bomb).toBeGreaterThan(20);
});
