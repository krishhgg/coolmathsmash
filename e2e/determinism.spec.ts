import { expect, test, type Page } from '@playwright/test';
import { loadSource } from '../scripts/lib/ssr';
import type * as Determinism from '../src/harness/determinism';
import type { CpuMatch } from '../src/harness/determinism';

/**
 * The simulation must play the same match bit for bit in every runtime, or replays, headless checks of browser
 * matches and netplay break. Each match in src/harness/determinism.ts plays twice: in Node, from the source through
 * Vite's SSR loader, and in Chromium, in the built game through the harness with the sim held and stepped by hand.
 * Their state hashes must agree after every frame.
 */

/** Play `match` through the harness, stopping after `until` frames. Returns each frame's hash, or the final state. */
function inBrowser(page: Page, match: CpuMatch, until: number, want: 'hashes'): Promise<string[]>;
function inBrowser(page: Page, match: CpuMatch, until: number, want: 'state'): Promise<unknown>;
function inBrowser(page: Page, match: CpuMatch, until: number, want: 'hashes' | 'state'): Promise<unknown> {
  return page.evaluate(
    ({ match, until, want }) => {
      const s = window.__smash!;
      s.setManual(true);
      s.newMatch(match.config);
      match.cpus.forEach((cpu, port) => s.setCpu(port, cpu));
      const hashes: string[] = [];
      while (s.frame() < until) {
        s.step(1);
        if (want === 'hashes') hashes.push(s.hash());
      }
      return want === 'hashes' ? hashes : s.getState();
    },
    { match, until, want },
  );
}

/** The first 10 values that differ between two states, as `path: node value / chromium value`. */
function differences(a: unknown, b: unknown, path = 'state', out: string[] = []): string[] {
  if (out.length >= 10) return out;
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const x = a as Record<string, unknown>;
    const y = b as Record<string, unknown>;
    for (const key of new Set([...Object.keys(x), ...Object.keys(y)]))
      differences(x[key], y[key], `${path}.${key}`, out);
  } else if (!Object.is(a, b)) {
    out.push(`${path}: ${JSON.stringify(a)} in Node, ${JSON.stringify(b)} in Chromium`);
  }
  return out;
}

test('CPU matches hash the same in Node and Chromium on every frame', async ({ page }) => {
  test.setTimeout(240_000);
  const node = await loadSource<typeof Determinism>('/src/harness/determinism.ts');
  try {
    await page.goto('/?harness');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    for (const match of node.mod.DETERMINISM_MATCHES) {
      const expected = node.mod.frameHashes(match);
      const actual = await inBrowser(page, match, match.frames, 'hashes');
      expect(actual.length, match.name).toBe(match.frames);
      const at = actual.findIndex((h, i) => h !== expected[i]);
      const firstDifference =
        at < 0
          ? null
          : {
              frame: at + 1,
              values: differences(
                node.mod.stateAt(match, at + 1),
                await inBrowser(page, match, at + 1, 'state'),
              ),
            };
      expect.soft(firstDifference, match.name).toBeNull();
    }
  } finally {
    await node.close();
  }
});
