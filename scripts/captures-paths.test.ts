import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENARIOS, isLabScenario, scenarioConfig } from '../src/harness/scenarios';

/**
 * `.github/workflows/captures.yml` skips PRs that only touch fighter and stage folders no capture scenario draws, so
 * every fighter and stage a scenario puts on screen has to be in its path filter.
 */
const workflow = readFileSync(new URL('../.github/workflows/captures.yml', import.meta.url), 'utf8');

function drawn(): string[] {
  const folders = new Set<string>();
  for (const s of SCENARIOS) {
    if (isLabScenario(s)) {
      if (s.page.params?.fighter) folders.add(`src/fighters/${s.page.params.fighter}`);
      if (s.page.params?.stage) folders.add(`src/stages/${s.page.params.stage}`);
      continue;
    }
    const config = scenarioConfig(s);
    folders.add(`src/stages/${config.stage}`);
    for (const port of config.ports) folders.add(`src/fighters/${port.fighter}`);
  }
  return [...folders].sort();
}

describe('captures.yml path filter', () => {
  it('includes the folder of every fighter and stage a capture scenario draws', () => {
    const folders = drawn();
    expect(folders.length).toBeGreaterThan(1);
    for (const folder of folders) {
      expect(existsSync(new URL(`../${folder}`, import.meta.url)), `${folder} exists`).toBe(true);
      expect(workflow, `add '${folder}/**' to captures.yml's paths`).toContain(`- '${folder}/**'`);
    }
  });
});
