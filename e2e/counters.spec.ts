import { expect, test } from '@playwright/test';

test('the harness registers the counter test fighters, and a counter catches a jab and answers it', async ({
  page,
}) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const result = await page.evaluate(() => {
    const s = window.__smash!;
    s.newMatch({ stage: 'battlefield', ports: [{ fighter: 'fireboy' }, { fighter: 'test-counter' }] });
    s.step(10);
    s.patch(0, { pos: { x: -10, y: 0 }, prevPos: { x: -10, y: 0 }, facing: 1 });
    s.patch(1, { pos: { x: -2, y: 0 }, prevPos: { x: -2, y: 0 }, facing: -1 });
    const start = s.frame();
    // P2 counters at once; P1 jabs 8 frames later, inside the counter's window.
    const script = [
      { port: 1, from: start, y: -100, buttons: ['special' as const] },
      { port: 0, from: start + 8, buttons: ['attack' as const] },
    ];
    const seen: string[] = [];
    for (let f = start + 1; f <= start + 60; f++) {
      s.runScript(script, f);
      for (const e of s.getState().events) {
        if (e.type === 'counter') seen.push(`counter ${e.port} < ${e.attacker}`);
        if (e.type === 'hit') seen.push(`hit ${e.attacker} > ${e.victim} ${e.move}`);
      }
    }
    const [a, v] = s.getState().fighters;
    return { seen, damage: [a!.damage, v!.damage] };
  });
  expect(result.seen).toEqual(['counter 1 < 0', 'hit 1 > 0 downBHit']);
  expect(result.damage[1]).toBe(0);
  expect(result.damage[0]).toBeCloseTo(8 * 1.05 * 1.2, 6);
});
