import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Manifest } from '../scripts/lib/manifest';

test('runScenario plays a named scenario to its capture frame, or says what is missing', async ({ page }) => {
  await page.goto('/?harness');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const r = await page.evaluate(async () => {
    const s = window.__smash!;
    const names = s.scenarios().map((x) => x.name);
    const ledge = await s.runScenario('ledge-hang');
    const patched = s.patch(1, { damage: 150, pos: { x: 10 } });
    const attack = await s.runScenario('attack-active');
    return { names, ledge, patched, attack };
  });
  expect(r.names).toEqual(
    expect.arrayContaining(['idle', 'run', 'jump-apex', 'shield', 'ledge-hang', 'hud']),
  );
  expect(r.ledge).toMatchObject({ status: 'captured', frame: r.ledge.captureFrame });
  expect(r.ledge.fighters[0]).toMatchObject({ action: 'ledgeHang', actionFrame: 10 });
  expect(r.patched).toMatchObject({ damage: 150, pos: { x: 10 }, prevPos: { x: 10 } });
  if (r.attack.status === 'pending') expect(r.attack.reason).toContain("move 'fsmash'");
  else expect(r.attack.fighters[0]!.move).toBe('fsmash');
});

test('the capture runner writes byte-identical PNGs on every run', ({ baseURL }) => {
  test.setTimeout(240_000);
  const capture = () => {
    const out = mkdtempSync(join(tmpdir(), 'capture-'));
    execFileSync(
      'node',
      ['scripts/capture.ts', '--only', 'idle,jump-apex,hud', '--out', out, '--url', baseURL!],
      {
        stdio: 'pipe',
      },
    );
    return { out, manifest: JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')) as Manifest };
  };
  const a = capture();
  const b = capture();
  const statuses = a.manifest.scenarios.map((s) => [s.name, s.status]);
  expect(statuses.slice(0, 2)).toEqual([
    ['idle', 'captured'],
    ['jump-apex', 'captured'],
  ]);
  expect(['captured', 'pending']).toContain(statuses[2]![1]);
  for (const s of a.manifest.scenarios.filter((x) => x.files.png)) {
    const first = readFileSync(join(a.out, s.files.png!));
    expect(readFileSync(join(b.out, s.files.png!)).equals(first), s.name).toBe(true);
  }
  const jump = a.manifest.scenarios[1]!;
  expect(jump.files.strip).toBe('jump-apex.strip.png');
  expect(jump.motion!.frames).toHaveLength(jump.motion!.to - jump.motion!.from + 1);
  expect(jump.fighters![0]!.vel.y).toBeLessThanOrEqual(0);
});
