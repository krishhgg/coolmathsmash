import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENARIOS, isLabScenario, scenarioConfig } from '../src/harness/scenarios';

/**
 * `.github/workflows/captures.yml` runs the capture suite on every PR that can change what a scenario draws. Fighter
 * folders are covered by `src/**` as a whole, so a new fighter needs no workflow edit; only stages are listed by name.
 */
const workflow = readFileSync(new URL('../.github/workflows/captures.yml', import.meta.url), 'utf8');
const listed = (pattern: string) => workflow.includes(`- '${pattern}'`);

describe('captures.yml path filter', () => {
  it('covers every fighter folder generically, naming none and excluding none', () => {
    for (const line of workflow.split('\n')) {
      const rule = line.trim();
      expect(rule, `${rule} restricts fighter changes`).not.toMatch(/^-\s*'!?src\/fighters\//);
    }
  });

  it('includes every stage a capture scenario draws', () => {
    const stages = new Set<string>();
    for (const s of SCENARIOS) {
      if (isLabScenario(s)) {
        if (s.page.params?.stage) stages.add(s.page.params.stage);
        continue;
      }
      stages.add(scenarioConfig(s).stage);
    }
    expect(stages.size).toBeGreaterThan(0);
    for (const stage of stages)
      expect(listed(`src/stages/${stage}/**`), `add 'src/stages/${stage}/**'`).toBe(true);
  });
});
